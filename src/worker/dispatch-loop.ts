/**
 * Dispatch Loop — The brain of the 7x24 orchestration engine
 *
 * Replaced sweep-based approach with a decision tree (causal chain).
 * Each heartbeat: evaluate team state -> create the ONE highest-priority task needed.
 *
 * Gate 1: ability_model exists?     -> No -> assign analyze_resume
 * Gate 2: search_keywords populated? -> No -> assign generate_keywords
 * Gate 3: last discovery > 5 min?   -> Yes -> assign opportunity_discovery
 * Gate 4: discovered opportunities?  -> Yes -> assign screening
 * Gate 5: advance + no materials?   -> Yes -> assign material_generation
 * Gate 6: material_ready or passthrough? -> Yes -> assign submission
 * Gate 7: Boss advance?             -> Yes -> assign first_contact
 * Gate 8: active conversations?     -> Yes -> assign reply_processing / follow_up
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { TaskExecutor } from './task-executor.js';
import type { BillingService } from './services/billing.js';

// Production intervals
const DISPATCH_INTERVAL_MS = 30_000;               // 30s
const SWEEP_STALE_INTERVAL_MS = 5 * 60_000;       // 5 min
const SWEEP_BILLING_INTERVAL_MS = 60_000;          // 60s
const HEARTBEAT_INTERVAL_MS = 5 * 60_000;          // 5 min
const MAX_CONCURRENT_TASKS_PER_TEAM = 3;

// Decision tree intervals
const DISCOVERY_INTERVAL_MS = 5 * 60_000;           // 5 min
const FOLLOWUP_STALE_DAYS = 3;

export class DispatchLoop {
  private running = false;
  private dispatchTimer: ReturnType<typeof setInterval> | null = null;
  private staleSweepTimer: ReturnType<typeof setInterval> | null = null;
  private billingSweepTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private executor: TaskExecutor;

  constructor(
    private db: SupabaseClient,
    private billing: BillingService
  ) {
    this.executor = new TaskExecutor(db);
  }

  start() {
    this.running = true;
    console.log('[dispatch] Starting dispatch loop — decision tree active');

    this.dispatchTimer = setInterval(() => this.cycle(), DISPATCH_INTERVAL_MS);
    this.staleSweepTimer = setInterval(() => this.sweepStaleTasks(), SWEEP_STALE_INTERVAL_MS);
    this.billingSweepTimer = setInterval(() => this.billing.enforceBilling(), SWEEP_BILLING_INTERVAL_MS);
    this.heartbeatTimer = setInterval(() => this.writeHeartbeat(), HEARTBEAT_INTERVAL_MS);

    // Run first cycle + heartbeat immediately
    this.cycle();
    this.writeHeartbeat();
  }

  isRunning() { return this.running; }

  stop() {
    this.running = false;
    if (this.dispatchTimer) clearInterval(this.dispatchTimer);
    if (this.staleSweepTimer) clearInterval(this.staleSweepTimer);
    if (this.billingSweepTimer) clearInterval(this.billingSweepTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    console.log('[dispatch] Dispatch loop stopped');
  }

  private async cycle() {
    if (!this.running) return;

    try {
      const { data: teams } = await this.db
        .from('team')
        .select('id')
        .eq('runtime_status', 'active');

      if (!teams || teams.length === 0) return;

      for (const team of teams) {
        // Get agent instances for this team
        const { data: agents } = await this.db
          .from('agent_instance')
          .select('id, template_role_code')
          .eq('team_id', team.id);

        if (!agents || agents.length === 0) continue;

        const agentMap = new Map(agents.map(a => [a.template_role_code, a.id]));

        // Phase 1: Decision tree — create the next needed task
        await this.decideNextAction(team.id, agentMap);

        // Phase 2: Dispatch queued tasks
        await this.dispatchForTeam(team.id);
      }
    } catch (err) {
      console.error('[dispatch] Cycle error:', err);
    }
  }

  // ================================================================
  //  DECISION TREE — Replace all sweeps with causal-chain gates
  // ================================================================

  private async decideNextAction(teamId: string, agentMap: Map<string, string>): Promise<void> {
    const baseline = await this.getBaseline(teamId);

    // Gate 1: Ability model
    if (!baseline?.ability_model) {
      if (await this.noActiveTask(teamId, 'analyze_resume')) {
        const agentId = agentMap.get('profile_intelligence') || agentMap.get('orchestrator');
        if (agentId) {
          await this.createTask(teamId, agentId, 'analyze_resume', 'opportunity_generation', 'critical',
            `analyze_resume:${teamId}:${Date.now()}`);
          console.log(`[decide] Gate 1: 履历分析师 -> analyze_resume for team ${teamId}`);
        }
        return;
      }
      return; // Wait for analyze_resume to complete
    }

    // Gate 2: Keywords
    const kw = baseline.search_keywords as Record<string, unknown> | null;
    const hasKeywords = kw &&
      (((kw.en_keywords as string[]) || []).length > 0 ||
       ((kw.zh_keywords as string[]) || []).length > 0 ||
       ((kw.target_companies as string[]) || []).length > 0);

    if (!hasKeywords) {
      if (await this.noActiveTask(teamId, 'generate_keywords')) {
        // Also check legacy task type
        if (await this.noActiveTask(teamId, 'keyword_generation')) {
          const agentId = agentMap.get('opportunity_research') || agentMap.get('orchestrator');
          if (agentId) {
            await this.createTask(teamId, agentId, 'generate_keywords', 'opportunity_generation', 'critical',
              `generate_keywords:${teamId}:${Date.now()}`, undefined, undefined,
              { ability_model: baseline.ability_model });
            console.log(`[decide] Gate 2: 岗位研究员 -> generate_keywords for team ${teamId}`);
          }
          return;
        }
      }
      return; // Wait for generate_keywords to complete
    }

    // Gate 3: Discovery (every DISCOVERY_INTERVAL_MS)
    const since = new Date(Date.now() - DISCOVERY_INTERVAL_MS).toISOString();
    const { count: recentDiscovery } = await this.db
      .from('agent_task')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', teamId)
      .eq('task_type', 'opportunity_discovery')
      .gte('created_at', since);

    if (!recentDiscovery || recentDiscovery === 0) {
      if (await this.noActiveTask(teamId, 'opportunity_discovery')) {
        const agentId = agentMap.get('opportunity_research') || agentMap.get('orchestrator');
        if (agentId) {
          await this.createTask(teamId, agentId, 'opportunity_discovery', 'opportunity_generation', 'medium',
            `discovery:${teamId}:${Date.now()}`);
          console.log(`[decide] Gate 3: 岗位研究员 -> discovery for team ${teamId}`);
        }
        return;
      }
    }

    // Gate 4: Screening (discovered opportunities waiting)
    const { count: unscreened } = await this.db
      .from('opportunity')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', teamId)
      .eq('stage', 'discovered');

    if (unscreened && unscreened > 0) {
      if (await this.noActiveTask(teamId, 'screening')) {
        const agentId = agentMap.get('matching_review');
        if (agentId) {
          await this.createTask(teamId, agentId, 'screening', 'opportunity_generation', 'medium',
            `screening:${teamId}:${Date.now()}`);
          console.log(`[decide] Gate 4: 匹配审核员 -> screening ${unscreened} opps for team ${teamId}`);
        }
        return;
      }
    }

    // Gate 5: Material generation (advance + full_tailored + no materials)
    const { data: advanceOpps } = await this.db
      .from('opportunity')
      .select('id, source_platform_id')
      .eq('team_id', teamId)
      .eq('stage', 'prioritized')
      .eq('recommendation', 'advance')
      .limit(5);

    if (advanceOpps && advanceOpps.length > 0) {
      for (const opp of advanceOpps) {
        // Check pipeline mode: only full_tailored needs materials
        const { data: plat } = await this.db
          .from('platform_definition')
          .select('pipeline_mode, code')
          .eq('id', opp.source_platform_id)
          .single();

        // Passthrough platforms (Chinese) and Boss skip materials
        if (plat?.pipeline_mode === 'passthrough' || plat?.code === 'boss_zhipin') continue;

        // Check no materials exist
        const { count: materialCount } = await this.db
          .from('material')
          .select('id', { count: 'exact', head: true })
          .eq('opportunity_id', opp.id);
        if (materialCount && materialCount > 0) continue;

        // Check no pending task
        if (await this.noActiveTaskForEntity(teamId, 'material_generation', opp.id)) {
          const agentId = agentMap.get('materials_advisor') || agentMap.get('orchestrator');
          if (agentId) {
            await this.createTask(teamId, agentId, 'material_generation', 'opportunity_generation', 'medium',
              `material:${opp.id}:${Date.now()}`, opp.id, 'opportunity');
            console.log(`[decide] Gate 5: 简历顾问 -> material_generation for opp ${opp.id}`);
          }
          return;
        }
      }
    }

    // Gate 6: Submission (material_ready OR passthrough advance)
    const { data: readyOpps } = await this.db
      .from('opportunity')
      .select('id')
      .eq('team_id', teamId)
      .eq('stage', 'material_ready')
      .limit(5);

    if (readyOpps && readyOpps.length > 0) {
      for (const opp of readyOpps) {
        if (await this.noActiveTaskForEntity(teamId, 'submission', opp.id)) {
          const agentId = agentMap.get('application_executor') || agentMap.get('orchestrator');
          if (agentId) {
            await this.createTask(teamId, agentId, 'submission', 'opportunity_generation', 'high',
              `submission:${opp.id}:${Date.now()}`, opp.id, 'opportunity');
            console.log(`[decide] Gate 6: 投递专员 -> submission for opp ${opp.id}`);
          }
          return;
        }
      }
    }

    // Also handle passthrough submissions: prioritized + advance + passthrough platform
    if (advanceOpps && advanceOpps.length > 0) {
      for (const opp of advanceOpps) {
        const { data: plat } = await this.db
          .from('platform_definition')
          .select('pipeline_mode, code')
          .eq('id', opp.source_platform_id)
          .single();

        // Only passthrough non-Boss platforms
        if (plat?.pipeline_mode !== 'passthrough' || plat?.code === 'boss_zhipin') continue;

        if (await this.noActiveTaskForEntity(teamId, 'submission', opp.id)) {
          const agentId = agentMap.get('application_executor') || agentMap.get('orchestrator');
          if (agentId) {
            await this.createTask(teamId, agentId, 'submission', 'opportunity_generation', 'high',
              `submission:${opp.id}:${Date.now()}`, opp.id, 'opportunity');
            console.log(`[decide] Gate 6b: 投递专员 -> passthrough submission for opp ${opp.id}`);
          }
          return;
        }
      }
    }

    // Gate 7: First contact (Boss advance)
    if (advanceOpps && advanceOpps.length > 0) {
      for (const opp of advanceOpps) {
        const { data: plat } = await this.db
          .from('platform_definition')
          .select('code')
          .eq('id', opp.source_platform_id)
          .single();

        if (plat?.code !== 'boss_zhipin') continue;

        if (await this.noActiveTaskForEntity(teamId, 'first_contact', opp.id)) {
          const agentId = agentMap.get('application_executor') || agentMap.get('orchestrator');
          if (agentId) {
            await this.createTask(teamId, agentId, 'first_contact', 'opportunity_generation', 'high',
              `first_contact:${opp.id}:${Date.now()}`, opp.id, 'opportunity');
            console.log(`[decide] Gate 7: 投递专员 -> first_contact (Boss) for opp ${opp.id}`);
          }
          return;
        }
      }
    }

    // Gate 8: Reply processing + follow-ups
    const { count: activeConversations } = await this.db
      .from('opportunity')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', teamId)
      .in('stage', ['contact_started', 'followup_active', 'positive_progression']);

    if (activeConversations && activeConversations > 0) {
      if (await this.noActiveTask(teamId, 'reply_processing')) {
        const agentId = agentMap.get('relationship_manager');
        if (agentId) {
          await this.createTask(teamId, agentId, 'reply_processing', 'opportunity_progression', 'high',
            `reply-poll:${teamId}:${Date.now()}`);
          console.log(`[decide] Gate 8: 招聘关系经理 -> reply_processing for ${activeConversations} conversations`);
          return;
        }
      }
    }

    // Follow-ups: submitted opportunities with no activity for 3+ days
    const threeDaysAgo = new Date(Date.now() - FOLLOWUP_STALE_DAYS * 24 * 60 * 60_000).toISOString();
    const { count: staleSubmissions } = await this.db
      .from('opportunity')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', teamId)
      .in('stage', ['submitted', 'contact_started'])
      .lt('stage_changed_at', threeDaysAgo);

    if (staleSubmissions && staleSubmissions > 0) {
      if (await this.noActiveTask(teamId, 'follow_up')) {
        const agentId = agentMap.get('relationship_manager');
        if (agentId) {
          await this.createTask(teamId, agentId, 'follow_up', 'opportunity_progression', 'medium',
            `followup:${teamId}:${Date.now()}`);
          console.log(`[decide] Gate 8b: 招聘关系经理 -> follow_up for ${staleSubmissions} stale submissions`);
          return;
        }
      }
    }
  }

  // ================================================================
  //  DISPATCH — Execute queued tasks with atomic checkout
  // ================================================================

  private async dispatchForTeam(teamId: string) {
    const { count: runningCount } = await this.db
      .from('agent_task')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', teamId)
      .eq('status', 'running');

    if ((runningCount || 0) >= MAX_CONCURRENT_TASKS_PER_TEAM) return;

    // Task-type priority per spec
    const TASK_TYPE_PRIORITY: Record<string, number> = {
      analyze_resume: 9,
      generate_keywords: 8,
      keyword_generation: 8,
      handoff_takeover: 7,
      reply_processing: 6,
      follow_up: 5,
      submission: 4,
      material_generation: 3,
      first_contact: 3,
      screening: 2,
      opportunity_discovery: 1,
    };

    // Fetch queued tasks, skipping those still in backoff
    const now = new Date().toISOString();
    const { data: tasks } = await this.db
      .from('agent_task')
      .select('*')
      .eq('team_id', teamId)
      .eq('status', 'queued')
      .or(`last_retry_at.is.null,last_retry_at.lte.${now}`)
      .order('queued_at', { ascending: true })
      .limit(10);

    if (!tasks || tasks.length === 0) return;

    tasks.sort((a, b) => {
      const pa = TASK_TYPE_PRIORITY[(a as Record<string, unknown>).task_type as string] ?? 0;
      const pb = TASK_TYPE_PRIORITY[(b as Record<string, unknown>).task_type as string] ?? 0;
      return pb - pa;
    });

    const task = tasks[0];

    // Idempotency check
    if (task.idempotency_key) {
      const { count } = await this.db
        .from('agent_task')
        .select('id', { count: 'exact', head: true })
        .eq('idempotency_key', task.idempotency_key)
        .in('status', ['running', 'completed']);

      if (count && count > 0) {
        await this.db.from('agent_task')
          .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
          .eq('id', task.id);
        return;
      }
    }

    // Atomic checkout via Postgres RPC (if available), fallback to direct update
    let checkedOut = false;
    try {
      const { data: rpcResult } = await this.db.rpc('checkout_task', { p_task_id: task.id });
      checkedOut = rpcResult?.[0]?.checked_out === true;
    } catch {
      // RPC not yet deployed — fallback to direct update
      const { error } = await this.db.from('agent_task')
        .update({ status: 'running', started_at: new Date().toISOString() })
        .eq('id', task.id)
        .eq('status', 'queued');
      checkedOut = !error;
    }

    if (!checkedOut) return; // Another worker grabbed it

    this.executor.execute(task).catch((err) => {
      console.error(`[dispatch] Task ${task.id} execution error:`, err);
    });
  }

  // ================================================================
  //  HELPERS
  // ================================================================

  /** Get profile_baseline for a team (latest version) */
  private async getBaseline(teamId: string): Promise<Record<string, unknown> | null> {
    const { data } = await this.db
      .from('profile_baseline')
      .select('search_keywords, ability_model')
      .eq('team_id', teamId)
      .order('version', { ascending: false })
      .limit(1)
      .single();
    return data;
  }

  /** Check if there are no queued or running tasks of the given type for a team */
  private async noActiveTask(teamId: string, taskType: string): Promise<boolean> {
    const { count } = await this.db
      .from('agent_task')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', teamId)
      .eq('task_type', taskType)
      .in('status', ['queued', 'running']);
    return !count || count === 0;
  }

  /** Check if there are no queued or running tasks of given type for a specific entity */
  private async noActiveTaskForEntity(teamId: string, taskType: string, entityId: string): Promise<boolean> {
    const { count } = await this.db
      .from('agent_task')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', teamId)
      .eq('task_type', taskType)
      .eq('related_entity_id', entityId)
      .in('status', ['queued', 'running']);
    return !count || count === 0;
  }

  private async createTask(
    teamId: string,
    agentInstanceId: string,
    taskType: string,
    taskLoop: string,
    priority: string,
    idempotencyKey: string,
    relatedEntityId?: string,
    relatedEntityType?: string,
    inputData?: Record<string, unknown>,
  ) {
    const { error } = await this.db.from('agent_task').insert({
      team_id: teamId,
      agent_instance_id: agentInstanceId,
      task_type: taskType,
      task_loop: taskLoop,
      status: 'queued',
      priority,
      idempotency_key: idempotencyKey,
      trigger_source: 'orchestrator',
      queued_at: new Date().toISOString(),
      max_retries: 3,
      retry_count: 0,
      ...(relatedEntityId && { related_entity_id: relatedEntityId }),
      ...(relatedEntityType && { related_entity_type: relatedEntityType }),
      ...(inputData && { input_data: inputData }),
    });
    if (error) {
      console.error(`[dispatch] Failed to create ${taskType} task: ${error.message}`);
    }
  }

  private async writeHeartbeat() {
    if (!this.running) return;
    try {
      const { data: teams } = await this.db
        .from('team')
        .select('id')
        .eq('runtime_status', 'active');

      if (!teams || teams.length === 0) {
        console.log('[heartbeat] No active teams, skipping');
        return;
      }

      const now = new Date().toISOString();
      await this.db.from('timeline_event').insert(
        teams.map(t => ({
          team_id: t.id,
          event_type: 'system_heartbeat',
          summary_text: `Worker heartbeat — ${now}`,
          actor_type: 'system',
          visibility: 'internal',
          idempotency_key: `heartbeat:${t.id}:${now.slice(0, 16)}`,
        }))
      );
      console.log(`[heartbeat] Written for ${teams.length} active team(s)`);
    } catch (err) {
      console.error('[heartbeat] Failed to write heartbeat:', err);
    }
  }

  private async sweepStaleTasks() {
    if (!this.running) return;

    try {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60_000).toISOString();

      const { data: staleTasks } = await this.db
        .from('agent_task')
        .select('id, team_id, retry_count, max_retries, task_type')
        .eq('status', 'running')
        .lt('started_at', tenMinutesAgo);

      if (!staleTasks || staleTasks.length === 0) return;

      console.log(`[sweep] Found ${staleTasks.length} stale tasks`);

      for (const task of staleTasks) {
        if (task.retry_count < task.max_retries) {
          await this.db.from('agent_task')
            .update({
              status: 'queued',
              retry_count: task.retry_count + 1,
              last_retry_at: new Date().toISOString(),
              error_message: 'Stale task requeued by sweep',
            })
            .eq('id', task.id);
          console.log(`[sweep] Requeued stale ${task.task_type} task ${task.id}`);
        } else {
          await this.db.from('agent_task')
            .update({
              status: 'failed',
              failed_at: new Date().toISOString(),
              error_code: 'MAX_RETRIES_EXCEEDED',
              error_message: 'Task exceeded maximum retries after becoming stale',
            })
            .eq('id', task.id);
          console.log(`[sweep] Failed stale ${task.task_type} task ${task.id} (max retries)`);
        }
      }
    } catch (err) {
      console.error('[sweep] Stale task sweep error:', err);
    }
  }
}
