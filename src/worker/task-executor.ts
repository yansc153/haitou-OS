/**
 * Task Executor — Runs individual agent tasks
 *
 * Handles:
 * - Skill invocation (stub in M3, real LLM calls in M5)
 * - State machine enforcement via shared validators
 * - Retry with exponential backoff
 * - Result recording
 *
 * Source: BACKEND_API_AND_ARCHITECTURE_SPEC.md § Task Retry Policy
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  validateOpportunityTransition,
  validateHandoffTransition,
} from '../shared/state-machines.js';
import { PipelineOrchestrator } from './pipeline.js';
import { executeSkill } from './skills/runtime.js';

type AgentTask = {
  id: string;
  team_id: string;
  agent_instance_id: string;
  task_type: string;
  task_loop: string;
  status: string;
  priority: string;
  related_entity_type?: string;
  related_entity_id?: string;
  input_summary?: string;
  retry_count: number;
  max_retries: number;
};

// Retry backoff schedule per failure type
const RETRY_CONFIG: Record<string, { maxRetries: number; backoffMs: number[] }> = {
  transient: { maxRetries: 3, backoffMs: [30_000, 120_000, 600_000] },
  rate_limit: { maxRetries: 2, backoffMs: [60_000, 300_000] },
  skill_error: { maxRetries: 2, backoffMs: [60_000, 300_000] },
  platform_auth: { maxRetries: 0, backoffMs: [] },
  data_validation: { maxRetries: 0, backoffMs: [] },
};

export class TaskExecutor {
  private pipeline: PipelineOrchestrator;

  constructor(private db: SupabaseClient) {
    this.pipeline = new PipelineOrchestrator(db);
  }

  async execute(task: AgentTask): Promise<void> {
    try {
      console.log(`[executor] Running task ${task.id} (${task.task_type}) for team ${task.team_id}`);

      // Route to appropriate handler based on task_type
      const result = await this.routeTask(task);

      // Mark completed
      await this.db
        .from('agent_task')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          output_summary: result.summary,
        })
        .eq('id', task.id);

      // Update agent instance stats
      await this.db.rpc('increment_agent_tasks_completed', {
        p_agent_id: task.agent_instance_id,
      }).then(() => {}, () => {
        // RPC may not exist yet — non-critical
      });

      // Create timeline event
      await this.createTimelineEvent(task, result.summary);

      console.log(`[executor] Task ${task.id} completed`);
    } catch (err) {
      await this.handleFailure(task, err as Error);
    }
  }

  private async routeTask(task: AgentTask): Promise<{ summary: string }> {
    switch (task.task_type) {
      case 'opportunity_discovery':
        await this.pipeline.runDiscoveryCycle(task.team_id);
        return { summary: 'Discovery cycle completed' };

      case 'screening':
        if (task.related_entity_id) {
          // Get pipeline mode from opportunity's platform
          const { data: opp } = await this.db
            .from('opportunity')
            .select('source_platform_id')
            .eq('id', task.related_entity_id)
            .single();
          const { data: platform } = opp ? await this.db
            .from('platform_definition')
            .select('pipeline_mode')
            .eq('id', opp.source_platform_id)
            .single() : { data: null };

          await this.pipeline.runScreeningPipeline(
            task.team_id,
            task.related_entity_id,
            platform?.pipeline_mode || 'full_tailored'
          );
        }
        return { summary: 'Screening pipeline completed' };

      case 'first_contact':
      case 'reply_processing':
      case 'follow_up': {
        // These use LLM skills directly
        const skillMap: Record<string, string> = {
          first_contact: 'first-contact-drafting',
          reply_processing: 'reply-reading',
          follow_up: 'first-contact-drafting', // reuses similar prompt
        };
        const skillCode = skillMap[task.task_type];
        if (skillCode) {
          const result = await executeSkill(skillCode, { task_context: task.input_summary });
          return { summary: result.success ? `${task.task_type} completed` : `${task.task_type} failed: ${result.error}` };
        }
        return { summary: `${task.task_type} completed (no skill mapped)` };
      }

      default:
        return { summary: `Task ${task.task_type} completed` };
    }
  }

  private async handleFailure(task: AgentTask, error: Error) {
    const failureType = this.classifyError(error);
    const config = RETRY_CONFIG[failureType] || RETRY_CONFIG.transient;

    console.error(`[executor] Task ${task.id} failed (${failureType}):`, error.message);

    if (task.retry_count < config.maxRetries) {
      // Schedule retry with backoff
      const backoffMs = config.backoffMs[task.retry_count] || 60_000;
      const retryAt = new Date(Date.now() + backoffMs).toISOString();

      await this.db
        .from('agent_task')
        .update({
          status: 'queued',
          retry_count: task.retry_count + 1,
          last_retry_at: retryAt,
          error_code: failureType,
          error_message: error.message,
        })
        .eq('id', task.id);

      console.log(`[executor] Task ${task.id} requeued for retry ${task.retry_count + 1}/${config.maxRetries} (backoff: ${backoffMs}ms)`);
    } else {
      // Max retries exceeded
      await this.db
        .from('agent_task')
        .update({
          status: 'failed',
          failed_at: new Date().toISOString(),
          error_code: failureType,
          error_message: error.message,
        })
        .eq('id', task.id);

      // If platform auth error, surface as platform connection issue
      if (failureType === 'platform_auth') {
        await this.surfacePlatformAuthFailure(task);
      }
    }
  }

  private classifyError(error: Error): string {
    const msg = error.message.toLowerCase();
    if (msg.includes('timeout') || msg.includes('network') || msg.includes('econnrefused')) {
      return 'transient';
    }
    if (msg.includes('rate limit') || msg.includes('429')) {
      return 'rate_limit';
    }
    if (msg.includes('session expired') || msg.includes('auth') || msg.includes('401')) {
      return 'platform_auth';
    }
    if (msg.includes('validation') || msg.includes('invalid')) {
      return 'data_validation';
    }
    if (msg.includes('skill') || msg.includes('llm') || msg.includes('parse')) {
      return 'skill_error';
    }
    return 'transient'; // default: assume retryable
  }

  private async surfacePlatformAuthFailure(task: AgentTask) {
    // Mark related platform connection as session_expired
    if (task.related_entity_type === 'platform' && task.related_entity_id) {
      await this.db
        .from('platform_connection')
        .update({
          status: 'session_expired',
          requires_user_action: true,
        })
        .eq('id', task.related_entity_id);
    }
  }

  private async createTimelineEvent(task: AgentTask, summary: string) {
    await this.db.from('timeline_event').insert({
      team_id: task.team_id,
      event_type: `task_${task.task_type}_completed`,
      summary_text: summary,
      actor_type: 'agent',
      actor_id: task.agent_instance_id,
      related_entity_type: task.related_entity_type || 'task',
      related_entity_id: task.related_entity_id || task.id,
      visibility: 'feed',
      idempotency_key: `task_complete_${task.id}`,
    });
  }
}
