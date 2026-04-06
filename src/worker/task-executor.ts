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
import { HandoffDetectionService } from './services/handoff-detection.js';
import { pollLinkedInInbox } from './executors/linkedin.js';

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
  private handoffDetection: HandoffDetectionService;

  constructor(private db: SupabaseClient) {
    this.pipeline = new PipelineOrchestrator(db);
    this.handoffDetection = new HandoffDetectionService(db);
  }

  async execute(task: AgentTask): Promise<void> {
    try {
      console.log(`[executor] Running task ${task.id} (${task.task_type}) for team ${task.team_id}`);

      // Mark agent as working
      await this.db.from('agent_instance')
        .update({ runtime_state: 'active', last_active_at: new Date().toISOString() })
        .eq('id', task.agent_instance_id);

      // Route to appropriate handler based on task_type
      const result = await this.routeTask(task);

      // Mark task completed
      await this.db
        .from('agent_task')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          output_summary: result.summary,
        })
        .eq('id', task.id);

      // Mark agent back to ready
      await this.db.from('agent_instance')
        .update({
          runtime_state: 'ready',
          last_active_at: new Date().toISOString(),
        })
        .eq('id', task.agent_instance_id);

      await this.db.rpc('increment_agent_tasks_completed', {
        p_agent_id: task.agent_instance_id,
      }).then(() => {}, () => {});

      // Create timeline event
      await this.createTimelineEvent(task, result.summary);

      console.log(`[executor] Task ${task.id} completed`);
    } catch (err) {
      // Mark agent back to ready on failure too
      await this.db.from('agent_instance')
        .update({ runtime_state: 'ready', last_active_at: new Date().toISOString() })
        .eq('id', task.agent_instance_id)
        .then(() => {}, () => {});

      await this.handleFailure(task, err as Error);
    }
  }

  private async routeTask(task: AgentTask): Promise<{ summary: string }> {
    switch (task.task_type) {
      case 'opportunity_discovery':
        await this.pipeline.runDiscoveryCycle(task.team_id);
        return { summary: '岗位发现周期完成' };

      case 'screening': {
        if (task.related_entity_id) {
          // Screen a specific opportunity
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
          return { summary: '已完成 1 个岗位的筛选评估' };
        }

        // Batch screening: screen up to 5 unscreened opportunities
        const { data: unscreened } = await this.db
          .from('opportunity')
          .select('id, source_platform_id')
          .eq('team_id', task.team_id)
          .eq('stage', 'discovered')
          .order('created_at', { ascending: true })
          .limit(5);

        let screened = 0;
        for (const opp of (unscreened || [])) {
          const { data: plat } = await this.db
            .from('platform_definition')
            .select('pipeline_mode')
            .eq('id', opp.source_platform_id)
            .single();
          try {
            await this.pipeline.runScreeningPipeline(
              task.team_id, opp.id, plat?.pipeline_mode || 'full_tailored'
            );
            screened++;
          } catch (e) {
            console.error(`[executor] Screening failed for opp ${opp.id}:`, (e as Error).message);
          }
        }
        return { summary: `批量筛选完成：${screened}/${unscreened?.length || 0} 个岗位` };
      }

      case 'material_generation': {
        if (!task.related_entity_id) {
          return { summary: 'material_generation skipped: no related opportunity' };
        }
        const { data: opp } = await this.db
          .from('opportunity')
          .select('*')
          .eq('id', task.related_entity_id)
          .single();
        if (!opp) return { summary: 'material_generation skipped: opportunity not found' };

        const { data: baseline } = await this.db
          .from('profile_baseline')
          .select('*')
          .eq('team_id', task.team_id)
          .order('version', { ascending: false })
          .limit(1)
          .single();
        if (!baseline) return { summary: 'material_generation skipped: no profile baseline' };

        await this.pipeline.runMaterialPipeline(task.team_id, task.related_entity_id, baseline, opp);
        return { summary: `已为「${opp.job_title}」生成投递材料` };
      }

      case 'submission': {
        if (!task.related_entity_id) {
          return { summary: 'submission skipped: no related opportunity' };
        }
        const { data: opp } = await this.db
          .from('opportunity')
          .select('*')
          .eq('id', task.related_entity_id)
          .single();
        if (!opp) return { summary: 'submission skipped: opportunity not found' };

        await this.pipeline.runSubmission(task.team_id, task.related_entity_id, opp);
        return { summary: `已投递「${opp.job_title}」@ ${opp.company_name}` };
      }

      case 'first_contact':
      case 'follow_up': {
        const skillCode = task.task_type === 'first_contact' ? 'first-contact-drafting' : 'follow-up-drafting';
        const result = await executeSkill(skillCode, { task_context: task.input_summary });
        return { summary: result.success ? `${task.task_type} completed` : `${task.task_type} failed: ${result.error}` };
      }

      case 'reply_processing': {
        if (!task.related_entity_id) {
          return { summary: 'reply_processing skipped: no related opportunity' };
        }

        // Step 0: Poll platform for new messages and insert into DB
        await this.fetchPlatformMessages(task.team_id, task.related_entity_id);

        // Fetch conversation thread and recent inbound messages for this opportunity
        const { data: thread } = await this.db
          .from('conversation_thread')
          .select('id')
          .eq('opportunity_id', task.related_entity_id)
          .eq('team_id', task.team_id)
          .order('latest_message_at', { ascending: false })
          .limit(1)
          .single();

        if (!thread) {
          return { summary: 'reply_processing skipped: no conversation thread found' };
        }

        // Get recent unprocessed inbound messages
        const { data: messages } = await this.db
          .from('conversation_message')
          .select('id, content_text, direction, sent_at, reply_posture')
          .eq('thread_id', thread.id)
          .eq('direction', 'inbound')
          .is('reply_posture', null)
          .order('sent_at', { ascending: false })
          .limit(5);

        if (!messages || messages.length === 0) {
          return { summary: 'reply_processing skipped: no unprocessed inbound messages' };
        }

        // Build context with real message content
        const messageTexts = messages.map((m: { content_text: string; sent_at: string }) =>
          `[${m.sent_at}] ${m.content_text}`
        ).join('\n\n');

        // Call reply-reading skill with real message content
        const replyResult = await executeSkill('reply-reading', {
          message_content: messageTexts,
          task_context: task.input_summary || '',
        });
        if (!replyResult.success) {
          return { summary: `reply_processing failed: ${replyResult.error}` };
        }

        const output = replyResult.output as {
          reply_posture?: string;
          handoff_recommended?: boolean;
          handoff_reason?: string;
          contains_salary_discussion?: boolean;
          contains_interview_scheduling?: boolean;
          contains_private_channel_request?: boolean;
          extracted_signals?: string[];
          asks_or_requests?: string[];
          summary_text?: string;
        };

        // Update processed messages with extracted signals
        for (const msg of messages) {
          await this.db
            .from('conversation_message')
            .update({
              reply_posture: output.reply_posture || 'neutral',
              extracted_signals: output.extracted_signals || [],
              asks_or_requests: output.asks_or_requests || [],
            })
            .eq('id', msg.id);
        }

        // Handoff detection: check LLM recommendation + regex boundary scan
        if (output.handoff_recommended) {
          let handoffType = 'general';
          if (output.contains_salary_discussion) handoffType = 'salary_confirmation';
          else if (output.contains_interview_scheduling) handoffType = 'interview_time';
          else if (output.contains_private_channel_request) handoffType = 'private_contact';

          // Regex-based detection on raw message text for more precise type
          const regexBoundary = this.handoffDetection.detectBoundary(messageTexts);
          if (regexBoundary) handoffType = regexBoundary.type;

          await this.handoffDetection.createHandoff({
            teamId: task.team_id,
            opportunityId: task.related_entity_id,
            handoffType,
            urgency: regexBoundary?.urgency || 'high',
            sourceAgentId: task.agent_instance_id,
            reason: output.handoff_reason || 'Boundary detected in conversation',
            contextSummary: output.summary_text || '',
          });
        }

        return { summary: `reply_processing: ${messages.length} messages analyzed${output.handoff_recommended ? ' — handoff created' : ''}` };
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

  /**
   * Poll platform for new messages and insert into conversation_message table.
   * Currently supports LinkedIn; other platforms to be added.
   */
  private async fetchPlatformMessages(teamId: string, opportunityId: string): Promise<void> {
    // Get opportunity's platform
    const { data: opp } = await this.db
      .from('opportunity')
      .select('source_platform_id')
      .eq('id', opportunityId)
      .single();
    if (!opp) return;

    const { data: platformDef } = await this.db
      .from('platform_definition')
      .select('code')
      .eq('id', opp.source_platform_id)
      .single();
    if (!platformDef) return;

    // Get active connection with session
    const { data: conn } = await this.db
      .from('platform_connection')
      .select('id, session_token_ref')
      .eq('team_id', teamId)
      .eq('platform_id', opp.source_platform_id)
      .eq('status', 'active')
      .single();
    if (!conn?.session_token_ref) return;

    // Get or create conversation thread
    let { data: thread } = await this.db
      .from('conversation_thread')
      .select('id, platform_thread_id')
      .eq('opportunity_id', opportunityId)
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (platformDef.code === 'linkedin') {
      const polled = await pollLinkedInInbox({ sessionCookies: conn.session_token_ref });
      if (polled.length === 0) return;

      // Create thread if it doesn't exist
      if (!thread) {
        const { data: newThread } = await this.db
          .from('conversation_thread')
          .insert({
            team_id: teamId,
            opportunity_id: opportunityId,
            platform_connection_id: conn.id,
            platform_thread_id: polled[0].threadId,
            thread_status: 'active',
            message_count: 0,
          })
          .select('id, platform_thread_id')
          .single();
        thread = newThread;
      }
      if (!thread) return;

      // Insert new messages (dedup by platform_message_id)
      for (const msg of polled) {
        const platformMsgId = `linkedin:${msg.threadId}:${msg.receivedAt}`;
        const { count } = await this.db
          .from('conversation_message')
          .select('id', { count: 'exact', head: true })
          .eq('platform_message_id', platformMsgId);

        if (count && count > 0) continue;

        await this.db.from('conversation_message').insert({
          thread_id: thread.id,
          team_id: teamId,
          platform_message_id: platformMsgId,
          direction: 'inbound',
          message_type: 'reply',
          content_text: msg.messageText,
          sent_at: msg.receivedAt,
        });
      }

      // Update thread metadata
      await this.db
        .from('conversation_thread')
        .update({
          latest_message_at: polled[0].receivedAt,
          message_count: thread.platform_thread_id ? undefined : polled.length,
        })
        .eq('id', thread.id);
    }
    // Other platforms: zhaopin, lagou, etc. — to be implemented per their specs
  }
}
