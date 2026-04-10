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
import { execSync } from 'child_process';
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs';
import {
  validateOpportunityTransition,
  validateHandoffTransition,
} from '../shared/state-machines.js';
import { PipelineOrchestrator } from './pipeline.js';
import { executeSkill } from './skills/runtime.js';
import { HandoffDetectionService } from './services/handoff-detection.js';
import { pollBossMessages } from './executors/boss-zhipin.js';

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
  input_data?: Record<string, unknown>;
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

      // Quality gate: validate output is non-empty before marking completed
      if (result.output_data && typeof result.output_data === 'object' && Object.keys(result.output_data).length === 0) {
        throw new Error(`QUALITY_GATE: task ${task.task_type} produced empty output_data`);
      }

      // Only mark completed if task actually succeeded
      // Submission tasks report outcome in summary — check for failure signals
      const isFailure = result.summary?.includes('hard_failure') || result.summary?.includes('session_expired');
      if (isFailure) {
        await this.db
          .from('agent_task')
          .update({
            status: 'failed',
            failed_at: new Date().toISOString(),
            error_message: result.summary,
          })
          .eq('id', task.id);
      } else {
        await this.db
          .from('agent_task')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            output_summary: result.summary,
            ...(result.output_data && { output_data: result.output_data }),
          })
          .eq('id', task.id);
      }

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

  private async routeTask(task: AgentTask): Promise<{ summary: string; output_data?: Record<string, unknown> }> {
    switch (task.task_type) {
      case 'analyze_resume':
        return await this.handleAnalyzeResume(task);

      case 'generate_keywords':
      case 'keyword_generation':
        return await this.handleGenerateKeywords(task);

      case 'opportunity_discovery': {
        const discoveredCount = await this.pipeline.runDiscoveryCycle(task.team_id);
        return { summary: `岗位发现周期完成，新增 ${discoveredCount} 个岗位` };
      }

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
          .limit(10);

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
        console.log(`[executor] Screening batch done: ${screened}/${unscreened?.length || 0} opps screened`);
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

      case 'first_contact': {
        if (!task.related_entity_id) throw new Error('first_contact requires related_entity_id');
        await this.insertDispatchEvent(task.team_id, '投递专员', `收到打招呼任务，正在处理岗位 ${task.related_entity_id}`);
        const { data: opp } = await this.db.from('opportunity').select('*').eq('id', task.related_entity_id).single();
        if (!opp) throw new Error('Opportunity not found');
        await this.pipeline.runFirstContact(task.team_id, task.related_entity_id, opp);
        await this.insertReportEvent(task.team_id, '投递专员', `已向 ${opp.company_name} 发送打招呼消息`);
        return { summary: `已向 ${opp.company_name} 发送打招呼消息` };
      }

      case 'follow_up': {
        const skillCode = 'follow-up-drafting';
        const result = await executeSkill(skillCode, { task_context: task.input_summary });
        return { summary: result.success ? `follow_up completed` : `follow_up failed: ${result.error}` };
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

    // V1: Only Boss直聘 has conversation tracking (Loop 2).
    // All other platforms (LinkedIn, Greenhouse, Lever, 智联, 拉勾, 猎聘) stop at "submitted".
    // English platforms: replies go to email, we don't track email.
    // Chinese platforms (non-Boss): replies go to 站内信/APP, V1 doesn't track.
    if (platformDef.code === 'boss_zhipin') {
      const polled = await pollBossMessages({ sessionCookies: conn.session_token_ref });
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
        const platformMsgId = `boss:${msg.threadId}:${msg.receivedAt}`;
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
          message_type: msg.isSystemCard ? 'system_note' : 'reply',
          content_text: msg.messageText,
          sent_at: msg.receivedAt,
        });
      }

      // Update thread metadata
      await this.db
        .from('conversation_thread')
        .update({
          latest_message_at: polled[0].receivedAt,
        })
        .eq('id', thread.id);
    }
    // Other platforms: zhaopin, lagou, etc. — to be implemented per their specs
  }

  /**
   * Handle analyze_resume — 履历分析师 analyzes resume to produce ability model.
   * Step 1 of the causal chain: analyze_resume → generate_keywords → discovery
   */
  private async handleAnalyzeResume(task: AgentTask): Promise<{ summary: string; output_data?: Record<string, unknown> }> {
    const teamId = task.team_id;

    await this.insertDispatchEvent(teamId, '履历分析师', '检测到新简历，请分析能力模型');
    await this.insertEvent(teamId, 'resume_analysis_started', '履历分析师已上线，开始分析简历...');

    // Read profile_baseline
    const { data: baseline } = await this.db
      .from('profile_baseline')
      .select('*')
      .eq('team_id', teamId)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    if (!baseline) {
      throw new Error('ANALYZE_RESUME_BLOCKED: No profile_baseline found — cannot analyze resume');
    }

    // Extract resume text via markitdown CLI
    let resumeMarkdown = '';
    if (baseline.resume_asset_id) {
      const { data: asset } = await this.db
        .from('resume_asset')
        .select('storage_path, file_mime_type')
        .eq('id', baseline.resume_asset_id)
        .single();

      if (asset?.storage_path) {
        const tmpPath = `/tmp/resume_${task.id}`;
        const mdPath = `${tmpPath}.md`;

        // Download from storage
        const { data: fileData } = await this.db.storage.from('resumes').download(asset.storage_path);
        if (!fileData) throw new Error('Failed to download resume');
        const buffer = Buffer.from(await fileData.arrayBuffer());
        writeFileSync(tmpPath, buffer);

        // Try markitdown first
        try {
          execSync(`markitdown "${tmpPath}" -o "${mdPath}"`, { timeout: 30000 });
          if (existsSync(mdPath)) {
            resumeMarkdown = readFileSync(mdPath, 'utf-8');
          }
        } catch (e) {
          console.warn('[executor] markitdown failed, trying fallback:', (e as Error).message);
        }

        // Fallback: read as text
        if (resumeMarkdown.length < 50) {
          resumeMarkdown = buffer.toString('utf-8');
          const runs = resumeMarkdown.match(/[\u4e00-\u9fff\u3000-\u303fa-zA-Z0-9\s,.;:!?@#$%&*()\-+='"]{10,}/g);
          resumeMarkdown = runs ? runs.join('\n') : '';
        }

        // Cleanup
        try { unlinkSync(tmpPath); } catch {}
        try { unlinkSync(mdPath); } catch {}
      }
    }

    if (resumeMarkdown.length < 50) {
      throw new Error('ANALYZE_RESUME_FAILED: Could not extract text from resume file');
    }

    // Build skill input with extracted resume text
    const skillInput = {
      resume_raw_text: resumeMarkdown.substring(0, 20000),
      profile_baseline: { full_name: baseline.full_name, contact_email: baseline.contact_email },
    };

    const result = await executeSkill('analyze-resume', skillInput);

    if (!result.success) {
      throw new Error(`ANALYZE_RESUME_FAILED: ${result.error}`);
    }

    const output = result.output as { ability_model: Record<string, unknown> };
    if (!output.ability_model || Object.keys(output.ability_model).length === 0) {
      throw new Error('ANALYZE_RESUME_FAILED: LLM returned empty ability_model');
    }

    // Write ability_model + derived fields to profile_baseline
    const am = output.ability_model;
    await this.db
      .from('profile_baseline')
      .update({
        ability_model: am,
        skills: (am.core_skills as string[]) || [],
        primary_domain: ((am.domain_expertise as string[]) || [])[0] || null,
        seniority_level: (am.seniority_assessment as string) || null,
      })
      .eq('id', baseline.id);

    // Write output_data to agent_task
    await this.db
      .from('agent_task')
      .update({ output_data: output })
      .eq('id', task.id);

    const coreSkillsCount = (am.core_skills as string[])?.length || 0;
    await this.insertReportEvent(teamId, '履历分析师', `能力分析完成 — 识别出 ${coreSkillsCount} 项核心技能`);

    if (result.tokens_used) {
      const { recordTokenUsage } = await import('./pipeline.js');
      await recordTokenUsage(this.db, teamId, result.tokens_used.input, result.tokens_used.output);
    }

    return {
      summary: '履历分析师完成能力分析',
      output_data: output,
    };
  }

  /**
   * Handle generate_keywords — 岗位研究员 generates search keywords from ability model.
   * Step 2 of the causal chain: analyze_resume → generate_keywords → discovery
   * Also handles legacy 'keyword_generation' task type for backward compatibility.
   */
  private async handleGenerateKeywords(task: AgentTask): Promise<{ summary: string; output_data?: Record<string, unknown> }> {
    const teamId = task.team_id;

    await this.insertDispatchEvent(teamId, '岗位研究员', '能力模型已就绪，请生成搜索关键词');

    // Read ability_model from task input_data (preferred) or profile_baseline
    let abilityModel: Record<string, unknown> | null = null;
    if (task.input_data?.ability_model) {
      abilityModel = task.input_data.ability_model as Record<string, unknown>;
    }

    const { data: baseline } = await this.db
      .from('profile_baseline')
      .select('*')
      .eq('team_id', teamId)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    if (!baseline) {
      throw new Error('KEYWORD_GEN_BLOCKED: No profile_baseline found — cannot generate keywords');
    }

    if (!abilityModel && baseline.ability_model) {
      abilityModel = baseline.ability_model as Record<string, unknown>;
    }

    // If no ability_model at all, fall back to running analyze-resume inline (legacy compat)
    if (!abilityModel) {
      console.log('[executor] No ability_model found, running inline analyze-resume for backward compat');
      const analyzeResult = await executeSkill('analyze-resume', {
        profile_baseline: {
          experiences: baseline.experiences,
          skills: baseline.skills,
          education: baseline.education,
          primary_domain: baseline.primary_domain,
          headline_summary: baseline.headline_summary,
          capability_tags: baseline.capability_tags,
          capability_gaps: baseline.capability_gaps,
          inferred_role_directions: baseline.inferred_role_directions,
          languages: baseline.languages,
          certifications: baseline.certifications,
          seniority_level: baseline.seniority_level,
          source_language: baseline.source_language,
        },
      });
      if (analyzeResult.success) {
        abilityModel = (analyzeResult.output as { ability_model: Record<string, unknown> }).ability_model;
        await this.db.from('profile_baseline').update({ ability_model: abilityModel }).eq('id', baseline.id);
        if (analyzeResult.tokens_used) {
          const { recordTokenUsage } = await import('./pipeline.js');
          await recordTokenUsage(this.db, teamId, analyzeResult.tokens_used.input, analyzeResult.tokens_used.output);
        }
      }
    }

    await this.insertEvent(teamId, 'keyword_generation_started', '岗位研究员已上线，开始生成搜索关键词...');

    // Read team strategy_mode
    const { data: team } = await this.db.from('team').select('strategy_mode').eq('id', teamId).single();
    const strategyMode = (team?.strategy_mode as string) || 'balanced';
    const STRATEGY_INSTRUCTIONS: Record<string, string> = {
      broad: '广撒网模式: 生成 5-7 个岗位方向，包含核心、相邻和可迁移方向',
      balanced: '均衡模式: 生成 3-5 个岗位方向，核心方向加少量相邻方向',
      precise: '精准模式: 只生成 2-3 个最核心的岗位方向',
    };

    // Call keyword-generation skill with ability_model + strategy
    const skillInput: Record<string, unknown> = {
      ability_model: abilityModel || {},
      strategy_mode: strategyMode,
      strategy_instruction: STRATEGY_INSTRUCTIONS[strategyMode] || STRATEGY_INSTRUCTIONS.balanced,
    };

    const result = await executeSkill('keyword-generation', skillInput);

    if (!result.success) {
      // Fallback: use inferred_role_directions for EN only
      const directions = baseline.inferred_role_directions as string[] | null;
      const fallbackEn = (directions && directions.length > 0) ? directions : ['software engineer'];
      const fallback = { en_keywords: fallbackEn, zh_keywords: [] as string[], job_directions: [{ zh: fallbackEn[0], en: fallbackEn[0], is_core: true }], primary_domain: baseline.primary_domain || 'general', seniority_bracket: baseline.seniority_level || 'mid', strategy_applied: strategyMode };

      await this.db
        .from('profile_baseline')
        .update({ search_keywords: fallback })
        .eq('id', baseline.id);

      await this.insertReportEvent(teamId, '岗位研究员', `关键词生成（降级模式）— 使用推断方向: ${fallbackEn.slice(0, 3).join(', ')}`);
      return { summary: `关键词生成（降级）: ${fallbackEn.length} 个方向`, output_data: fallback };
    }

    const output = result.output as {
      job_directions: Array<{ zh: string; en: string; is_core?: boolean }>;
      en_keywords: string[];
      zh_keywords: string[];
      primary_domain: string;
      seniority_bracket: string;
      strategy_applied: string;
      reasoning: string;
    };

    // Quality validation: job_directions must have at least 1 entry, each with zh + en
    const validDirections = (output.job_directions || []).filter(d => d.zh && d.en);
    if (validDirections.length < 1) {
      const directions = baseline.inferred_role_directions as string[] | null;
      const fallbackEn = (directions && directions.length > 0) ? directions : ['software engineer'];
      output.en_keywords = output.en_keywords?.length > 0 ? output.en_keywords : fallbackEn;
      output.zh_keywords = output.zh_keywords?.length > 0 ? output.zh_keywords : [];
      output.job_directions = [{ zh: output.zh_keywords[0] || fallbackEn[0], en: fallbackEn[0], is_core: true }];
    }

    // Validate en/zh keywords are not both empty
    if ((!output.en_keywords || output.en_keywords.length === 0) &&
        (!output.zh_keywords || output.zh_keywords.length === 0)) {
      const directions = baseline.inferred_role_directions as string[] | null;
      output.en_keywords = (directions && directions.length > 0) ? directions : ['software engineer'];
      output.zh_keywords = [];
    }

    // Write to profile_baseline.search_keywords AND agent_task.output_data
    await this.db
      .from('profile_baseline')
      .update({ search_keywords: output })
      .eq('id', baseline.id);

    await this.db
      .from('agent_task')
      .update({ output_data: output })
      .eq('id', task.id);

    // Timeline events with keyword counts
    const enCount = output.en_keywords.length;
    const zhCount = output.zh_keywords.length;
    const dirCount = output.job_directions.length;
    const enPreview = output.en_keywords.slice(0, 3).join(', ');
    const zhPreview = output.zh_keywords.slice(0, 3).join('、');

    await this.insertReportEvent(teamId, '岗位研究员',
      `关键词生成完成: ${dirCount} 个岗位方向, ${enCount} 英文, ${zhCount} 中文 (${strategyMode}模式)\n方向: ${output.job_directions.slice(0, 3).map(d => d.zh).join('、')}\n英文: ${enPreview}\n中文: ${zhPreview}`);

    await this.insertEvent(teamId, 'task_assigned',
      `调度官将 ${zhCount} 个中文关键词分配给岗位研究员（智联/拉勾/猎聘/Boss）`);
    await this.insertEvent(teamId, 'task_assigned',
      `调度官将 ${enCount} 个英文关键词分配给岗位研究员（LinkedIn/Greenhouse/Lever）`);

    if (result.tokens_used) {
      const { recordTokenUsage } = await import('./pipeline.js');
      await recordTokenUsage(this.db, teamId, result.tokens_used.input, result.tokens_used.output);
    }

    return {
      summary: `关键词生成完成: ${dirCount} 方向 + ${enCount} 英文 + ${zhCount} 中文 (${strategyMode})`,
      output_data: output as unknown as Record<string, unknown>,
    };
  }

  private async insertEvent(teamId: string, eventType: string, summaryText: string): Promise<void> {
    await this.db.from('timeline_event').insert({
      team_id: teamId,
      event_type: eventType,
      summary_text: summaryText,
      actor_type: 'agent',
      visibility: 'feed',
    });
  }

  private async insertDispatchEvent(teamId: string, targetAgent: string, message: string): Promise<void> {
    await this.db.from('timeline_event').insert({
      team_id: teamId,
      event_type: 'dispatch_assign',
      summary_text: message,
      actor_type: 'agent',
      actor_name: '调度官',
      target_agent: targetAgent,
      visibility: 'feed',
    });
  }

  private async insertReportEvent(teamId: string, agentName: string, message: string): Promise<void> {
    await this.db.from('timeline_event').insert({
      team_id: teamId,
      event_type: 'agent_report',
      summary_text: message,
      actor_type: 'agent',
      actor_name: agentName,
      visibility: 'feed',
    });
  }
}
