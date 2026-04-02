import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { ok, err } from '../_shared/response.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const { user, error: authError, supabase } = await getAuthenticatedUser(req);
  if (authError) return authError;

  const { data: team } = await supabase!
    .from('team')
    .select('*')
    .eq('user_id', user!.id)
    .single();

  if (!team) {
    return err(404, 'NOT_FOUND', 'No team found');
  }

  const { data: profile } = await supabase!
    .from('submission_profile')
    .select('*')
    .eq('team_id', team.id)
    .single();

  // Get platform connections
  const { data: connections } = await supabase!
    .from('platform_connection')
    .select('id, platform_id, status')
    .eq('team_id', team.id);

  // Get platform definitions for display
  const { data: platforms } = await supabase!
    .from('platform_definition')
    .select('id, code, display_name, display_name_zh, min_plan_tier, region')
    .eq('is_active', true);

  // Compute readiness
  const blockingItems: string[] = [];
  const nonBlockingItems: string[] = [];

  // Check profile baseline
  const { data: baseline } = await supabase!
    .from('profile_baseline')
    .select('id')
    .eq('team_id', team.id)
    .limit(1)
    .single();

  if (!baseline) {
    blockingItems.push('Resume not yet parsed — ProfileBaseline missing');
  }

  // Check submission profile
  if (!profile || profile.completion_band === 'missing') {
    blockingItems.push('Submission profile is incomplete');
  } else if (profile.completion_band === 'partial') {
    nonBlockingItems.push('Submission profile could be more complete');
  }

  // Check platform connections
  const activeConnections = (connections || []).filter((c: { status: string }) => c.status === 'active');
  if (activeConnections.length === 0) {
    blockingItems.push('No platform connected — connect at least one platform');
  }

  // Build platform tasks
  const platformTasks = (platforms || []).map((p: { id: string; display_name: string; code: string; min_plan_tier: string }) => {
    const conn = (connections || []).find((c: { platform_id: string }) => c.platform_id === p.id);
    let actionRequired: string | null = null;
    const status = conn ? conn.status : 'available_unconnected';

    if (!conn) actionRequired = 'connect';
    else if (conn.status === 'session_expired') actionRequired = 'reconnect';
    else if (conn.status === 'plan_locked') actionRequired = 'upgrade_plan';

    return {
      platform_id: p.id,
      platform_name: p.display_name,
      platform_code: p.code,
      status,
      action_required: actionRequired,
    };
  });

  const readinessLevel = blockingItems.length === 0
    ? (nonBlockingItems.length === 0 ? 'fully_ready' : 'minimum_ready')
    : (profile && profile.completion_band !== 'missing' ? 'partially_ready' : 'not_ready');

  return ok({
    team: { id: team.id, name: team.name, status: team.status, runtime_status: team.runtime_status },
    submission_profile: profile,
    execution_readiness: readinessLevel,
    platform_tasks: platformTasks,
    blocking_items: blockingItems,
    non_blocking_items: nonBlockingItems,
  });
});
