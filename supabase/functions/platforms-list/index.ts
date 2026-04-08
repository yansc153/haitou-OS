import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { ok, err } from '../_shared/response.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';

/**
 * GET /platforms-list
 * Returns all platforms grouped by region with connection status.
 */
serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const { user, error: authError, supabase } = await getAuthenticatedUser(req);
  if (authError) return authError;

  // Get team
  const { data: team } = await supabase!
    .from('team')
    .select('id, plan_tier')
    .eq('user_id', user!.id)
    .single();

  // Get all active platform definitions
  const { data: platforms } = await supabase!
    .from('platform_definition')
    .select('*')
    .eq('is_active', true)
    .order('region')
    .order('display_name');

  // Get user's connections
  const connections = team
    ? (await supabase!
        .from('platform_connection')
        .select('*')
        .eq('team_id', team.id)
      ).data || []
    : [];

  // Build response grouped by region
  const grouped = {
    global_english: [] as unknown[],
    china: [] as unknown[],
  };

  for (const p of platforms || []) {
    const conn = connections.find((c: { platform_id: string }) => c.platform_id === p.id);
    const isLocked = p.min_plan_tier !== 'free' && team?.plan_tier === 'free';

    const entry = {
      platform_id: p.id,
      code: p.code,
      display_name: p.display_name,
      display_name_zh: p.display_name_zh,
      region: p.region,
      platform_type: p.platform_type,
      pipeline_mode: p.pipeline_mode,
      anti_scraping_level: p.anti_scraping_level,
      min_plan_tier: p.min_plan_tier,
      supports_cookie_session: p.supports_cookie_session,

      // Connection state
      connection_id: conn?.id || null,
      connection_status: isLocked ? 'plan_locked' : (conn?.status || 'available_unconnected'),
      session_granted_at: conn?.session_granted_at || null,
      session_expires_at: conn?.session_expires_at || null,
      last_health_check_at: conn?.last_health_check_at || null,
      failure_reason: conn?.failure_reason || null,
      capability_status: conn?.capability_status || null,
      requires_user_action: conn?.requires_user_action || false,
    };

    if (p.region === 'china') {
      grouped.china.push(entry);
    } else {
      grouped.global_english.push(entry);
    }
  }

  return ok(grouped);
});
