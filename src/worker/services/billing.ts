/**
 * Billing Service — Runtime ledger, session tracking, forced pause
 *
 * Billing model: session-based
 * - session_start when team starts
 * - session_end when team pauses
 * - effective_balance = last_ledger_balance - elapsed_since_session_start
 * - forced pause when balance reaches 0
 *
 * Source: BACKEND_API_AND_ARCHITECTURE_SPEC.md § Module 6: Billing Service
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export class BillingService {
  constructor(private db: SupabaseClient) {}

  /**
   * Record session_start when team starts executing.
   */
  async recordSessionStart(teamId: string): Promise<void> {
    const lastBalance = await this.getLastBalance(teamId);

    await this.db.from('runtime_ledger_entry').insert({
      team_id: teamId,
      entry_type: 'session_start',
      runtime_delta_seconds: 0,
      balance_after_seconds: lastBalance,
      trigger_source: 'user',
      session_window_start: new Date().toISOString(),
    });
  }

  /**
   * Record session_end when team pauses. Computes duration consumed.
   */
  async recordSessionEnd(teamId: string, pauseOrigin: string): Promise<void> {
    // Find the latest session_start
    const { data: lastStart } = await this.db
      .from('runtime_ledger_entry')
      .select('*')
      .eq('team_id', teamId)
      .eq('entry_type', 'session_start')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!lastStart) return;

    // Idempotency: check if session_end already exists after this session_start
    const { count: existingEnd } = await this.db
      .from('runtime_ledger_entry')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', teamId)
      .eq('entry_type', 'session_end')
      .gt('created_at', lastStart.created_at);

    if (existingEnd && existingEnd > 0) {
      console.log(`[billing] session_end already recorded for team ${teamId}, skipping`);
      return;
    }

    const startTime = new Date(lastStart.session_window_start || lastStart.created_at).getTime();
    const now = Date.now();
    const durationSeconds = Math.floor((now - startTime) / 1000);
    const newBalance = Math.max(0, lastStart.balance_after_seconds - durationSeconds);

    await this.db.from('runtime_ledger_entry').insert({
      team_id: teamId,
      entry_type: 'session_end',
      runtime_delta_seconds: -durationSeconds,
      balance_after_seconds: newBalance,
      trigger_source: pauseOrigin === 'user' ? 'user' : 'system',
      reason: pauseOrigin === 'system_entitlement' ? '运行时间余额耗尽' : undefined,
      session_window_start: lastStart.session_window_start,
      session_window_end: new Date().toISOString(),
    });
  }

  /**
   * Record a runtime allocation (billing cycle grant).
   */
  async recordAllocation(teamId: string, seconds: number, reason: string): Promise<void> {
    const lastBalance = await this.getLastBalance(teamId);

    await this.db.from('runtime_ledger_entry').insert({
      team_id: teamId,
      entry_type: 'allocation',
      runtime_delta_seconds: seconds,
      balance_after_seconds: lastBalance + seconds,
      trigger_source: 'billing',
      reason,
    });
  }

  /**
   * Compute effective balance for an active team.
   * effective_balance = last_ledger_balance - (now - last_session_start)
   */
  async getEffectiveBalance(teamId: string): Promise<number> {
    const lastBalance = await this.getLastBalance(teamId);

    // Find the most recent session_start (not just the most recent entry of any type)
    const { data: lastSessionStart } = await this.db
      .from('runtime_ledger_entry')
      .select('entry_type, session_window_start, created_at')
      .eq('team_id', teamId)
      .eq('entry_type', 'session_start')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Check if there's a session_end after the session_start
    if (lastSessionStart) {
      const { count: endAfterStart } = await this.db
        .from('runtime_ledger_entry')
        .select('id', { count: 'exact', head: true })
        .eq('team_id', teamId)
        .eq('entry_type', 'session_end')
        .gt('created_at', lastSessionStart.created_at);

      // Open session: deduct elapsed time
      if (!endAfterStart || endAfterStart === 0) {
        const startTime = new Date(lastSessionStart.session_window_start || lastSessionStart.created_at).getTime();
        const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
        return Math.max(0, lastBalance - elapsedSeconds);
      }
    }

    return lastBalance;
  }

  /**
   * Billing enforcement sweep — called every minute for active teams.
   * Forces pause when balance reaches 0.
   */
  async enforceBilling(): Promise<void> {
    try {
      const { data: activeTeams } = await this.db
        .from('team')
        .select('id')
        .eq('runtime_status', 'active');

      if (!activeTeams || activeTeams.length === 0) return;

      for (const team of activeTeams) {
        const balance = await this.getEffectiveBalance(team.id);

        if (balance <= 0) {
          console.log(`[billing] Team ${team.id} balance exhausted, forcing pause`);
          await this.forcePause(team.id);
        }
      }
    } catch (err) {
      console.error('[billing] Enforcement sweep error:', err);
    }
  }

  private async forcePause(teamId: string): Promise<void> {
    // Record session end
    await this.recordSessionEnd(teamId, 'system_entitlement');

    // Update team status
    await this.db
      .from('team')
      .update({
        runtime_status: 'paused',
        pause_origin: 'system_entitlement',
        paused_at: new Date().toISOString(),
      })
      .eq('id', teamId);

    // Normalize running tasks → queued
    await this.db
      .from('agent_task')
      .update({ status: 'queued' })
      .eq('team_id', teamId)
      .eq('status', 'running');

    // Create timeline event
    await this.db.from('timeline_event').insert({
      team_id: teamId,
      event_type: 'team_forced_pause',
      summary_text: '运行时间已用尽，团队已自动暂停。请充值以继续。',
      actor_type: 'system',
      visibility: 'feed',
    });
  }

  private async getLastBalance(teamId: string): Promise<number> {
    const { data } = await this.db
      .from('runtime_ledger_entry')
      .select('balance_after_seconds')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    return data?.balance_after_seconds ?? 0;
  }
}
