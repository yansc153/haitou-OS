import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { ok, err } from '../_shared/response.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

/**
 * POST /team-start
 * Starts team execution. Pre-conditions checked server-side.
 *
 * Source: BACKEND_API_AND_ARCHITECTURE_SPEC.md § POST /api/team/start
 */
serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== 'POST') return err(405, 'METHOD_NOT_ALLOWED', 'POST only');

  try {

  const { user, error: authError } = await getAuthenticatedUser(req);
  if (authError) return authError;

  const serviceClient = getServiceClient();

  const { data: team } = await serviceClient
    .from('team')
    .select('*')
    .eq('user_id', user!.id)
    .single();

  if (!team) return err(404, 'NOT_FOUND', 'No team found');

  if (team.runtime_status === 'active') {
    return err(409, 'TEAM_ALREADY_ACTIVE', 'Team is already active');
  }

  // TeamStatus state machine gate: only 'ready' or 'paused' can start
  const allowedStatuses = ['ready', 'paused', 'active'];
  if (!allowedStatuses.includes(team.status)) {
    return err(422, 'TEAM_NOT_READY', `团队状态「${team.status}」无法启动，需要先完成 onboarding`);
  }

  // Readiness gate checks
  const blockers: string[] = [];

  // 1. Profile baseline must exist
  const { count: baselineCount } = await serviceClient
    .from('profile_baseline')
    .select('id', { count: 'exact', head: true })
    .eq('team_id', team.id);
  if (!baselineCount || baselineCount === 0) {
    blockers.push('ProfileBaseline missing');
  }

  // 2. At least one active platform connection
  const { count: connCount } = await serviceClient
    .from('platform_connection')
    .select('id', { count: 'exact', head: true })
    .eq('team_id', team.id)
    .eq('status', 'active');
  if (!connCount || connCount === 0) {
    blockers.push('No active platform connection');
  }

  // 3. Submission profile must be at least minimum_ready
  const { data: profile } = await serviceClient
    .from('submission_profile')
    .select('completion_band')
    .eq('team_id', team.id)
    .single();
  if (!profile || profile.completion_band === 'missing') {
    blockers.push('Submission profile not ready');
  }

  // 4. Effective runtime balance > 0
  const { data: ledgerRows } = await serviceClient
    .from('runtime_ledger_entry')
    .select('balance_after_seconds')
    .eq('team_id', team.id)
    .order('created_at', { ascending: false })
    .limit(1);
  const balance = ledgerRows?.[0]?.balance_after_seconds ?? 0;
  if (balance <= 0) {
    blockers.push('Runtime balance exhausted');
  }

  if (blockers.length > 0) {
    return err(422, 'TEAM_NOT_READY', `启动条件未满足：${blockers.join('、')}`, { blockers });
  }

  const now = new Date().toISOString();

  // Update team status
  await serviceClient
    .from('team')
    .update({
      status: 'active',
      runtime_status: 'active',
      started_at: now,
      pause_origin: null,
    })
    .eq('id', team.id);

  // Record session_start in ledger
  await serviceClient.from('runtime_ledger_entry').insert({
    team_id: team.id,
    entry_type: 'session_start',
    runtime_delta_seconds: 0,
    balance_after_seconds: balance,
    trigger_source: 'user',
    session_window_start: now,
  });

  // Transition agents to ready
  await serviceClient
    .from('agent_instance')
    .update({ runtime_state: 'ready', last_active_at: now })
    .eq('team_id', team.id)
    .in('lifecycle_state', ['initialized', 'ready', 'activated']);

  // Create timeline event
  await serviceClient.from('timeline_event').insert({
    team_id: team.id,
    event_type: 'team_started',
    summary_text: '团队已启动运行',
    actor_type: 'user',
    visibility: 'feed',
  });

  return ok({
    team_id: team.id,
    runtime_status: 'active',
  });

  } catch (e) {
    return err(500, 'INTERNAL_ERROR', `Uncaught: ${(e as Error).message}`);
  }
});
