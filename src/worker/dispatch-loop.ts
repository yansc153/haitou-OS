/**
 * Dispatch Loop — Core orchestration cycle
 *
 * Design: Event-driven with scheduled sweeps (hybrid model)
 * - Polls pgmq task queue for event-driven dispatch
 * - Runs periodic sweeps for stale tasks, follow-ups, billing
 *
 * Source: BACKEND_API_AND_ARCHITECTURE_SPEC.md § Module 2
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { TaskExecutor } from './task-executor.js';
import type { BillingService } from './services/billing.js';

const DISPATCH_INTERVAL_MS = 10_000; // 10s between dispatch cycles
const SWEEP_STALE_INTERVAL_MS = 5 * 60_000; // 5 min
const SWEEP_BILLING_INTERVAL_MS = 60_000; // 1 min
const MAX_CONCURRENT_TASKS_PER_TEAM = 3;

export class DispatchLoop {
  private running = false;
  private dispatchTimer: ReturnType<typeof setInterval> | null = null;
  private staleSweepTimer: ReturnType<typeof setInterval> | null = null;
  private billingSweepTimer: ReturnType<typeof setInterval> | null = null;
  private executor: TaskExecutor;

  constructor(
    private db: SupabaseClient,
    private billing: BillingService
  ) {
    this.executor = new TaskExecutor(db);
  }

  start() {
    this.running = true;
    console.log('[dispatch] Starting dispatch loop');

    // Main dispatch cycle
    this.dispatchTimer = setInterval(() => this.cycle(), DISPATCH_INTERVAL_MS);

    // Stale task sweep
    this.staleSweepTimer = setInterval(() => this.sweepStaleTasks(), SWEEP_STALE_INTERVAL_MS);

    // Billing enforcement sweep
    this.billingSweepTimer = setInterval(() => this.billing.enforceBilling(), SWEEP_BILLING_INTERVAL_MS);

    // Run first cycle immediately
    this.cycle();
  }

  stop() {
    this.running = false;
    if (this.dispatchTimer) clearInterval(this.dispatchTimer);
    if (this.staleSweepTimer) clearInterval(this.staleSweepTimer);
    if (this.billingSweepTimer) clearInterval(this.billingSweepTimer);
    console.log('[dispatch] Dispatch loop stopped');
  }

  private async cycle() {
    if (!this.running) return;

    try {
      // Get all active teams
      const { data: teams } = await this.db
        .from('team')
        .select('id')
        .eq('runtime_status', 'active');

      if (!teams || teams.length === 0) return;

      for (const team of teams) {
        await this.dispatchForTeam(team.id);
      }
    } catch (err) {
      console.error('[dispatch] Cycle error:', err);
    }
  }

  private async dispatchForTeam(teamId: string) {
    // Advisory lock per team (prevents concurrent dispatch for same team)
    // Using a simple check instead of pg_advisory_lock since we're going through Supabase client
    const { count: runningCount } = await this.db
      .from('agent_task')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', teamId)
      .eq('status', 'running');

    if ((runningCount || 0) >= MAX_CONCURRENT_TASKS_PER_TEAM) return;

    // Get highest priority queued task
    const { data: tasks } = await this.db
      .from('agent_task')
      .select('*')
      .eq('team_id', teamId)
      .eq('status', 'queued')
      .order('priority', { ascending: false }) // critical > high > medium > low
      .order('queued_at', { ascending: true })  // FIFO within same priority
      .limit(1);

    if (!tasks || tasks.length === 0) return;

    const task = tasks[0];

    // Check idempotency — skip if already processed
    if (task.idempotency_key) {
      const { count } = await this.db
        .from('agent_task')
        .select('id', { count: 'exact', head: true })
        .eq('idempotency_key', task.idempotency_key)
        .in('status', ['running', 'completed']);

      if (count && count > 0) {
        // Already running or completed — cancel this duplicate
        await this.db
          .from('agent_task')
          .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
          .eq('id', task.id);
        return;
      }
    }

    // Mark as running
    await this.db
      .from('agent_task')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', task.id);

    // Execute (fire and forget — executor handles completion/failure)
    this.executor.execute(task).catch((err) => {
      console.error(`[dispatch] Task ${task.id} execution error:`, err);
    });
  }

  private async sweepStaleTasks() {
    if (!this.running) return;

    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60_000).toISOString();

      // Find tasks stuck in 'running' for too long (>5 min with no update)
      const { data: staleTasks } = await this.db
        .from('agent_task')
        .select('id, team_id, retry_count, max_retries')
        .eq('status', 'running')
        .lt('started_at', fiveMinutesAgo);

      if (!staleTasks || staleTasks.length === 0) return;

      console.log(`[sweep] Found ${staleTasks.length} stale tasks`);

      for (const task of staleTasks) {
        if (task.retry_count < task.max_retries) {
          // Re-queue for retry
          await this.db
            .from('agent_task')
            .update({
              status: 'queued',
              retry_count: task.retry_count + 1,
              last_retry_at: new Date().toISOString(),
              error_message: 'Stale task requeued by sweep',
            })
            .eq('id', task.id);
        } else {
          // Max retries exceeded — mark failed
          await this.db
            .from('agent_task')
            .update({
              status: 'failed',
              failed_at: new Date().toISOString(),
              error_code: 'MAX_RETRIES_EXCEEDED',
              error_message: 'Task exceeded maximum retries after becoming stale',
            })
            .eq('id', task.id);
        }
      }
    } catch (err) {
      console.error('[sweep] Stale task sweep error:', err);
    }
  }
}
