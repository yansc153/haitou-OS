import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { ok, err } from '../_shared/response.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

/**
 * POST /team-pause
 * Pauses team execution. Normalizes running tasks to queued.
 *
 * Source: BACKEND_API_AND_ARCHITECTURE_SPEC.md § POST /api/team/pause
 */
serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== 'POST') return err(405, 'METHOD_NOT_ALLOWED', 'POST only');

  const { user, error: authError } = await getAuthenticatedUser(req);
  if (authError) return authError;

  const serviceClient = getServiceClient();

  const { data: team } = await serviceClient
    .from('team')
    .select('*')
    .eq('user_id', user!.id)
    .single();

  if (!team) return err(404, 'NOT_FOUND', 'No team found');

  if (team.runtime_status === 'paused') {
    return err(409, 'TEAM_ALREADY_PAUSED', 'Team is already paused');
  }

  const now = new Date().toISOString();

  // Record session_end in ledger
  const { data: ledgerRows } = await serviceClient
    .from('runtime_ledger_entry')
    .select('*')
    .eq('team_id', team.id)
    .eq('entry_type', 'session_start')
    .order('created_at', { ascending: false })
    .limit(1);
  const lastLedger = ledgerRows?.[0] ?? null;

  if (lastLedger) {
    // Idempotency: skip if session_end already recorded (race with billing forced-pause)
    const { count: existingEnd } = await serviceClient
      .from('runtime_ledger_entry')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', team.id)
      .eq('entry_type', 'session_end')
      .gt('created_at', lastLedger.created_at);

    if (!existingEnd || existingEnd === 0) {
      const startTime = new Date(lastLedger.session_window_start || lastLedger.created_at).getTime();
      const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
      const newBalance = Math.max(0, lastLedger.balance_after_seconds - durationSeconds);

      await serviceClient.from('runtime_ledger_entry').insert({
        team_id: team.id,
        entry_type: 'session_end',
        runtime_delta_seconds: -durationSeconds,
        balance_after_seconds: newBalance,
        trigger_source: 'user',
        session_window_start: lastLedger.session_window_start,
        session_window_end: now,
      });
    }
  }

  // Update team status
  await serviceClient
    .from('team')
    .update({
      runtime_status: 'paused',
      pause_origin: 'user',
      paused_at: now,
    })
    .eq('id', team.id);

  // Normalize running tasks → queued
  const { count: normalized } = await serviceClient
    .from('agent_task')
    .update({ status: 'queued' })
    .eq('team_id', team.id)
    .eq('status', 'running')
    .select('id', { count: 'exact', head: true });

  // Transition agents to paused
  await serviceClient
    .from('agent_instance')
    .update({ runtime_state: 'paused' })
    .eq('team_id', team.id);

  // Create timeline event
  await serviceClient.from('timeline_event').insert({
    team_id: team.id,
    event_type: 'team_paused',
    summary_text: `团队已暂停，${normalized || 0} 个任务已重新排队`,
    actor_type: 'user',
    visibility: 'feed',
  });

  return ok({
    team_id: team.id,
    runtime_status: 'paused',
    tasks_normalized: normalized || 0,
  });
});
