/**
 * Dispatch Loop — The brain of the 7×24 orchestration engine
 *
 * This is the core loop that drives ALL 7 agents continuously.
 * It doesn't just dispatch existing tasks — it CREATES work by running sweeps.
 *
 * Per BACKEND_API_AND_ARCHITECTURE_SPEC.md § Module 2:
 *
 * Loop A (Opportunity Generation) — continuous when team active:
 *   - Discovery sweep: find new jobs (every 60 min)
 *   - Screening: auto-triggered during discovery
 *   - Material generation: auto-triggered on "advance" recommendation
 *   - Submission: auto-triggered when materials ready
 *
 * Loop B (Opportunity Progression) — when conversations/follow-ups exist:
 *   - Reply poll: check for recruiter replies (every 15 min)
 *   - Follow-up sweep: send follow-ups for stale conversations (every 15 min)
 *   - Handoff detection: triggered during reply processing
 *
 * Scheduling:
 *   - Main cycle: every 10s (dispatch queued tasks + run sweeps)
 *   - Stale task sweep: every 5 min
 *   - Billing enforcement: every 1 min
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { TaskExecutor } from './task-executor.js';
import type { BillingService } from './services/billing.js';

// Production intervals
const DISPATCH_INTERVAL_MS = 60_000;               // 60s — main cycle
const SWEEP_STALE_INTERVAL_MS = 5 * 60_000;       // 5 min
const SWEEP_BILLING_INTERVAL_MS = 60_000;          // 60s
const HEARTBEAT_INTERVAL_MS = 5 * 60_000;          // 5 min
const MAX_CONCURRENT_TASKS_PER_TEAM = 3;

// Sweep intervals — production
const DISCOVERY_INTERVAL_MS = 5 * 60_000;           // 5 min (temp: was 60 min)
const REPLY_POLL_INTERVAL_MS = 15 * 60_000;        // 15 min
const FOLLOWUP_SWEEP_INTERVAL_MS = 15 * 60_000;    // 15 min
const RESCREEN_INTERVAL_MS = 10 * 60_000;           // 10 min

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
    console.log('[dispatch] Starting dispatch loop — 7×24 orchestration active');

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
        // Phase 1: Create work (sweeps)
        await this.runSweepsForTeam(team.id);
        // Phase 2: Dispatch queued tasks
        await this.dispatchForTeam(team.id);
      }
    } catch (err) {
      console.error('[dispatch] Cycle error:', err);
    }
  }

  // ══════════════════════════════════════════════════════════
  //  SWEEPS — Create work for all 7 agents
  // ══════════════════════════════════════════════════════════

  private async runSweepsForTeam(teamId: string) {
    // Get agent instances for this team (cached per cycle)
    const { data: agents } = await this.db
      .from('agent_instance')
      .select('id, template_role_code')
      .eq('team_id', teamId);

    if (!agents || agents.length === 0) return;

    const agentMap = new Map(agents.map(a => [a.template_role_code, a.id]));

    // ── Pre-loop: Keyword generation (blocks discovery if missing) ──
    await this.sweepKeywordGeneration(teamId, agentMap);

    // ── Loop A: Opportunity Generation ──
    await this.sweepDiscovery(teamId, agentMap);
    await this.sweepUnscreenedOpportunities(teamId, agentMap);
    await this.sweepPrioritizedForMaterials(teamId, agentMap);
    await this.sweepMaterialReadyForSubmission(teamId, agentMap);

    // ── Loop B: Opportunity Progression ──
    await this.sweepReplyPolling(teamId, agentMap);
    await this.sweepFollowUps(teamId, agentMap);
  }

  /**
   * Sweep: Keyword Generation — 履历分析师
   * Checks if profile_baseline.search_keywords is null → creates keyword_generation task.
   * This MUST run before discovery — discovery depends on keywords.
   */
  private async sweepKeywordGeneration(teamId: string, agentMap: Map<string, string>) {
    // Check if keywords already exist
    const { data: baseline } = await this.db
      .from('profile_baseline')
      .select('search_keywords')
      .eq('team_id', teamId)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    if (baseline?.search_keywords) return; // Already generated

    // Check if keyword_generation task already pending/running
    const { count } = await this.db
      .from('agent_task')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', teamId)
      .eq('task_type', 'keyword_generation')
      .in('status', ['queued', 'running']);

    if (count && count > 0) return; // Already in progress

    const agentId = agentMap.get('profile_intelligence') || agentMap.get('orchestrator');
    if (!agentId) return;

    await this.createTask(teamId, agentId, 'keyword_generation', 'opportunity_generation', 'critical',
      `keyword_gen:${teamId}:${Date.now()}`);
    console.log(`[sweep] 履历分析师 → keyword_generation task created for team ${teamId}`);
  }

  /**
   * Sweep: Discovery —岗位研究员 every hour
   */
  private async sweepDiscovery(teamId: string, agentMap: Map<string, string>) {
    const since = new Date(Date.now() - DISCOVERY_INTERVAL_MS).toISOString();
    const { count } = await this.db
      .from('agent_task')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', teamId)
      .eq('task_type', 'opportunity_discovery')
      .gte('created_at', since);

    if (count && count > 0) return;

    // Discovery is owned by 岗位研究员 (opportunity_research)
    const agentId = agentMap.get('opportunity_research') || agentMap.get('orchestrator');
    if (!agentId) return;

    await this.createTask(teamId, agentId, 'opportunity_discovery', 'opportunity_generation', 'medium',
      `discovery:${teamId}:${Date.now()}`);
    console.log(`[sweep] 岗位研究员 → discovery task created for team ${teamId}`);
  }

  /**
   * Sweep: Re-screen opportunities stuck in "discovered" stage
   * (Failed screening from previous runs)
   */
  private async sweepUnscreenedOpportunities(teamId: string, agentMap: Map<string, string>) {
    const since = new Date(Date.now() - RESCREEN_INTERVAL_MS).toISOString();

    // Check if we already have a screening task recently
    const { count: recentScreening } = await this.db
      .from('agent_task')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', teamId)
      .eq('task_type', 'screening')
      .gte('created_at', since);

    if (recentScreening && recentScreening > 0) return;

    // Check for opportunities stuck in discovered
    const { count: unscreened } = await this.db
      .from('opportunity')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', teamId)
      .eq('stage', 'discovered');

    if (!unscreened || unscreened === 0) return;

    const agentId = agentMap.get('matching_review');
    if (!agentId) return;

    await this.createTask(teamId, agentId, 'screening', 'opportunity_generation', 'medium',
      `screening-sweep:${teamId}:${Date.now()}`);
    console.log(`[sweep] 匹配审核员 → screening sweep for ${unscreened} unscreened opps`);
  }

  /**
   * Sweep: Material Generation — 简历顾问 generates materials for prioritized opportunities
   * Catches opportunities stuck at "prioritized" with recommendation "advance" but no materials
   */
  private async sweepPrioritizedForMaterials(teamId: string, agentMap: Map<string, string>) {
    // Find prioritized opps with "advance" recommendation that have no materials yet
    const { data: stuck } = await this.db
      .from('opportunity')
      .select('id')
      .eq('team_id', teamId)
      .eq('stage', 'prioritized')
      .eq('recommendation', 'advance')
      .limit(5);

    if (!stuck || stuck.length === 0) return;

    // Filter out those that already have materials
    for (const opp of stuck) {
      const { count: materialCount } = await this.db
        .from('material')
        .select('id', { count: 'exact', head: true })
        .eq('opportunity_id', opp.id);

      if (materialCount && materialCount > 0) continue;

      // Check no pending/running material_generation task exists
      const { count: existingTask } = await this.db
        .from('agent_task')
        .select('id', { count: 'exact', head: true })
        .eq('team_id', teamId)
        .eq('task_type', 'material_generation')
        .eq('related_entity_id', opp.id)
        .in('status', ['queued', 'running']);

      if (existingTask && existingTask > 0) continue;

      const agentId = agentMap.get('materials_advisor') || agentMap.get('orchestrator');
      if (!agentId) return;

      await this.createTask(teamId, agentId, 'material_generation', 'opportunity_generation', 'medium',
        `material:${opp.id}:${Date.now()}`, opp.id, 'opportunity');
      console.log(`[sweep] 简历顾问 → material_generation for opp ${opp.id}`);
    }
  }

  /**
   * Sweep: Submission — 投递专员 submits applications for material_ready opportunities
   * Catches opportunities at "material_ready" with no submission attempt
   */
  private async sweepMaterialReadyForSubmission(teamId: string, agentMap: Map<string, string>) {
    const { data: ready } = await this.db
      .from('opportunity')
      .select('id')
      .eq('team_id', teamId)
      .eq('stage', 'material_ready')
      .limit(5);

    if (!ready || ready.length === 0) return;

    for (const opp of ready) {
      // Check no pending/running submission task exists
      const { count: existingTask } = await this.db
        .from('agent_task')
        .select('id', { count: 'exact', head: true })
        .eq('team_id', teamId)
        .eq('task_type', 'submission')
        .eq('related_entity_id', opp.id)
        .in('status', ['queued', 'running']);

      if (existingTask && existingTask > 0) continue;

      const agentId = agentMap.get('application_executor') || agentMap.get('orchestrator');
      if (!agentId) return;

      await this.createTask(teamId, agentId, 'submission', 'opportunity_generation', 'high',
        `submission:${opp.id}:${Date.now()}`, opp.id, 'opportunity');
      console.log(`[sweep] 投递专员 → submission for opp ${opp.id}`);
    }
  }

  /**
   * Sweep: Reply Polling — 招聘关系经理 checks for recruiter replies
   * Only runs if there are opportunities in contact_started or followup_active stage
   */
  private async sweepReplyPolling(teamId: string, agentMap: Map<string, string>) {
    const since = new Date(Date.now() - REPLY_POLL_INTERVAL_MS).toISOString();

    // Already have a recent poll task?
    const { count: recentPoll } = await this.db
      .from('agent_task')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', teamId)
      .eq('task_type', 'reply_processing')
      .gte('created_at', since);

    if (recentPoll && recentPoll > 0) return;

    // Any opportunities in conversation stages?
    const { count: activeConversations } = await this.db
      .from('opportunity')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', teamId)
      .in('stage', ['contact_started', 'followup_active', 'positive_progression']);

    if (!activeConversations || activeConversations === 0) return;

    const agentId = agentMap.get('relationship_manager');
    if (!agentId) return;

    await this.createTask(teamId, agentId, 'reply_processing', 'opportunity_progression', 'high',
      `reply-poll:${teamId}:${Date.now()}`);
    console.log(`[sweep] 招聘关系经理 → reply poll for ${activeConversations} active conversations`);
  }

  /**
   * Sweep: Follow-ups — 招聘关系经理 sends follow-up messages
   * Triggers when submitted opportunities haven't had activity for 3+ days
   */
  private async sweepFollowUps(teamId: string, agentMap: Map<string, string>) {
    const since = new Date(Date.now() - FOLLOWUP_SWEEP_INTERVAL_MS).toISOString();

    const { count: recentFollowup } = await this.db
      .from('agent_task')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', teamId)
      .eq('task_type', 'follow_up')
      .gte('created_at', since);

    if (recentFollowup && recentFollowup > 0) return;

    // Find submitted opportunities with no activity for 3+ days
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60_000).toISOString();
    const { count: staleSubmissions } = await this.db
      .from('opportunity')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', teamId)
      .in('stage', ['submitted', 'contact_started'])
      .lt('stage_changed_at', threeDaysAgo);

    if (!staleSubmissions || staleSubmissions === 0) return;

    const agentId = agentMap.get('relationship_manager');
    if (!agentId) return;

    await this.createTask(teamId, agentId, 'follow_up', 'opportunity_progression', 'medium',
      `followup-sweep:${teamId}:${Date.now()}`);
    console.log(`[sweep] 招聘关系经理 → follow-up for ${staleSubmissions} stale submissions`);
  }

  // ══════════════════════════════════════════════════════════
  //  DISPATCH — Execute queued tasks
  // ══════════════════════════════════════════════════════════

  private async dispatchForTeam(teamId: string) {
    const { count: runningCount } = await this.db
      .from('agent_task')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', teamId)
      .eq('status', 'running');

    if ((runningCount || 0) >= MAX_CONCURRENT_TASKS_PER_TEAM) return;

    // Task-type priority per spec § Priority Algorithm:
    // handoff > reply > follow-up > submission > material > screening > discovery
    const TASK_TYPE_PRIORITY: Record<string, number> = {
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

    // Fetch queued tasks, skipping those still in backoff (last_retry_at > now)
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

    // Mark running and execute
    await this.db.from('agent_task')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', task.id);

    this.executor.execute(task).catch((err) => {
      console.error(`[dispatch] Task ${task.id} execution error:`, err);
    });
  }

  // ══════════════════════════════════════════════════════════
  //  HELPERS
  // ══════════════════════════════════════════════════════════

  private async createTask(
    teamId: string,
    agentInstanceId: string,
    taskType: string,
    taskLoop: string,
    priority: string,
    idempotencyKey: string,
    relatedEntityId?: string,
    relatedEntityType?: string,
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
