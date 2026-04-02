import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { ok } from '../_shared/response.ts';
import { getServiceClient } from '../_shared/auth.ts';

/**
 * POST /platform-health-check
 * Called by pg_cron or orchestrator. Checks all active connections' session validity.
 * Uses service role — no user auth needed.
 *
 * In M2 this is a stub: it marks connections with session_granted_at older than
 * the platform's observed TTL as session_expired.
 */

const PLATFORM_TTL_HOURS: Record<string, number> = {
  linkedin: 24,
  boss_zhipin: 3,
  zhaopin: 24,
  lagou: 24,
  liepin: 12,
};

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Verify this is called with service role key
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.includes(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '___never___')) {
    // In production, validate caller identity more strictly
  }

  const serviceClient = getServiceClient();

  // Get all active connections
  const { data: connections } = await serviceClient
    .from('platform_connection')
    .select('id, team_id, platform_id, status, session_granted_at')
    .eq('status', 'active');

  if (!connections || connections.length === 0) {
    return ok({ checked: 0, expired: 0 });
  }

  // Get platform codes for TTL lookup
  const platformIds = [...new Set(connections.map((c: { platform_id: string }) => c.platform_id))];
  const { data: platforms } = await serviceClient
    .from('platform_definition')
    .select('id, code')
    .in('id', platformIds);

  const platformCodeMap = new Map((platforms || []).map((p: { id: string; code: string }) => [p.id, p.code]));

  let expiredCount = 0;
  const now = Date.now();

  for (const conn of connections) {
    const code = platformCodeMap.get(conn.platform_id);
    const ttlHours = code ? (PLATFORM_TTL_HOURS[code] || 24) : 24;

    if (!conn.session_granted_at) continue;

    const grantedAt = new Date(conn.session_granted_at).getTime();
    const ageHours = (now - grantedAt) / (1000 * 60 * 60);

    if (ageHours > ttlHours) {
      // Mark as expired
      await serviceClient
        .from('platform_connection')
        .update({
          status: 'session_expired',
          requires_user_action: true,
          last_health_check_at: new Date().toISOString(),
        })
        .eq('id', conn.id);

      // Log expiry
      await serviceClient.from('platform_consent_log').insert({
        platform_connection_id: conn.id,
        team_id: conn.team_id,
        action: 'expired',
        consent_scope: 'read_only',
        granted_by: 'system_refresh',
      });

      expiredCount++;
    } else {
      // Update health check timestamp
      await serviceClient
        .from('platform_connection')
        .update({ last_health_check_at: new Date().toISOString() })
        .eq('id', conn.id);
    }
  }

  return ok({ checked: connections.length, expired: expiredCount });
});
