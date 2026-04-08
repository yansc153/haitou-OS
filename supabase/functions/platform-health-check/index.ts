import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { ok, err } from '../_shared/response.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';
import { decrypt, isEncrypted } from '../_shared/vault.ts';
import { PLATFORM_TTL_HOURS, PLATFORM_PROBE_URLS } from '../_shared/platform-rules.ts';

/**
 * POST /platform-health-check
 *
 * Mode 1 — Single connection (user JWT):
 *   POST { connection_id } with Authorization: Bearer <user-jwt>
 *   Checks one connection owned by the authenticated user.
 *
 * Mode 2 — Batch (service role / CRON_SECRET):
 *   POST {} with Authorization: Bearer <service-key|cron-secret>
 *   Checks all active connections (called by pg_cron or orchestrator).
 *
 * Two-phase check:
 * 1. TTL-based staleness (fast, no network)
 * 2. Lightweight connectivity probe per platform (if token available)
 */

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty body is fine for batch mode */ }

  const serviceClient = getServiceClient();

  // --- Auth path 1: User JWT + connection_id → single-connection mode ---
  if (body.connection_id) {
    const { user, error: authError } = await getAuthenticatedUser(req);
    if (authError || !user) return authError ?? err(401, 'AUTH_REQUIRED', 'Invalid session');

    // Look up user's team
    const { data: member } = await serviceClient
      .from('team')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (!member) return err(403, 'NO_TEAM', 'User has no team');

    // Fetch the specific connection — must belong to user's team
    const { data: conn } = await serviceClient
      .from('platform_connection')
      .select('id, team_id, platform_id, status, session_token_ref, session_granted_at, capability_status, user_consent_scope')
      .eq('id', body.connection_id)
      .eq('team_id', member.id)
      .single();

    if (!conn) return err(404, 'NOT_FOUND', 'Connection not found or not owned by your team');

    return await checkSingleConnection(serviceClient, conn);
  }

  // --- Auth path 2: Service role / CRON_SECRET → batch mode ---
  const authHeader = req.headers.get('Authorization') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const cronSecret = Deno.env.get('CRON_SECRET') || '';
  const isAuthorized = authHeader === `Bearer ${serviceKey}` ||
    (cronSecret && authHeader === `Bearer ${cronSecret}`);
  if (!isAuthorized) {
    return err(401, 'UNAUTHORIZED', 'Authentication required');
  }

  // Get all active connections with their token
  const { data: connections } = await serviceClient
    .from('platform_connection')
    .select('id, team_id, platform_id, status, session_token_ref, session_granted_at, capability_status, user_consent_scope')
    .eq('status', 'active');

  if (!connections || connections.length === 0) {
    return ok({ checked: 0, expired: 0, probed: 0 });
  }

  // Get platform codes for TTL lookup
  const platformIds = [...new Set(connections.map((c: { platform_id: string }) => c.platform_id))];
  const { data: platforms } = await serviceClient
    .from('platform_definition')
    .select('id, code')
    .in('id', platformIds);

  const platformCodeMap = new Map((platforms || []).map((p: { id: string; code: string }) => [p.id, p.code]));

  let expiredCount = 0;
  let probedCount = 0;
  const now = Date.now();
  const nowIso = new Date().toISOString();

  for (const conn of connections) {
    const code = platformCodeMap.get(conn.platform_id) || 'unknown';
    const ttlHours = PLATFORM_TTL_HOURS[code] ?? 24;

    // Phase 1: TTL check
    if (conn.session_granted_at) {
      const grantedAt = new Date(conn.session_granted_at).getTime();
      const ageHours = (now - grantedAt) / (1000 * 60 * 60);

      if (ageHours > ttlHours) {
        await markExpired(serviceClient, conn);
        expiredCount++;
        continue;
      }
    }

    // Phase 2: Lightweight connectivity probe (for platforms with probe URLs)
    const probeUrl = PLATFORM_PROBE_URLS[code];
    if (probeUrl && conn.session_token_ref) {
      try {
        const probeResult = await probeConnection(conn.session_token_ref, probeUrl, code);
        probedCount++;

        // Update capability_status
        const currentCaps = (conn.capability_status as Record<string, string>) || {};
        const updatedCaps = { ...currentCaps, ...probeResult.capabilities };

        await serviceClient
          .from('platform_connection')
          .update({
            last_health_check_at: nowIso,
            capability_status: updatedCaps,
            last_capability_check_at: nowIso,
          })
          .eq('id', conn.id);

        // If probe detected session expiry
        if (probeResult.sessionExpired) {
          await markExpired(serviceClient, conn);
          expiredCount++;
        }
      } catch {
        // Probe failed (network error, etc.) — don't mark expired, just update timestamp
        await serviceClient
          .from('platform_connection')
          .update({ last_health_check_at: nowIso })
          .eq('id', conn.id);
      }
    } else {
      // No probe available — just update health check timestamp
      await serviceClient
        .from('platform_connection')
        .update({ last_health_check_at: nowIso })
        .eq('id', conn.id);
    }
  }

  return ok({ checked: connections.length, expired: expiredCount, probed: probedCount });
});

async function checkSingleConnection(
  serviceClient: ReturnType<typeof getServiceClient>,
  conn: { id: string; team_id: string; platform_id: string; status: string; session_token_ref: string | null; session_granted_at: string | null; capability_status: Record<string, string> | null; user_consent_scope?: string },
) {
  // Look up platform code
  const { data: platform } = await serviceClient
    .from('platform_definition')
    .select('code')
    .eq('id', conn.platform_id)
    .single();

  const code = platform?.code || 'unknown';
  const ttlHours = PLATFORM_TTL_HOURS[code] ?? 24;
  const now = Date.now();
  const nowIso = new Date().toISOString();
  let expired = false;

  // Phase 1: TTL check
  if (conn.session_granted_at) {
    const ageHours = (now - new Date(conn.session_granted_at).getTime()) / (1000 * 60 * 60);
    if (ageHours > ttlHours) {
      if (conn.status === 'active') await markExpired(serviceClient, conn);
      return ok({ checked: 1, expired: 1, probed: 0 });
    }
  }

  // Phase 2: Probe
  const probeUrl = PLATFORM_PROBE_URLS[code];
  if (probeUrl && conn.session_token_ref) {
    try {
      const probeResult = await probeConnection(conn.session_token_ref, probeUrl, code);
      const currentCaps = conn.capability_status || {};
      const updatedCaps = { ...currentCaps, ...probeResult.capabilities };

      await serviceClient
        .from('platform_connection')
        .update({ last_health_check_at: nowIso, capability_status: updatedCaps, last_capability_check_at: nowIso })
        .eq('id', conn.id);

      if (probeResult.sessionExpired) {
        if (conn.status === 'active') await markExpired(serviceClient, conn);
        expired = true;
      }

      return ok({ checked: 1, expired: expired ? 1 : 0, probed: 1 });
    } catch {
      await serviceClient
        .from('platform_connection')
        .update({ last_health_check_at: nowIso })
        .eq('id', conn.id);
      return ok({ checked: 1, expired: 0, probed: 0, probe_error: true });
    }
  }

  // No probe available
  await serviceClient
    .from('platform_connection')
    .update({ last_health_check_at: nowIso })
    .eq('id', conn.id);
  return ok({ checked: 1, expired: 0, probed: 0 });
}

async function markExpired(
  serviceClient: ReturnType<typeof getServiceClient>,
  conn: { id: string; team_id: string; user_consent_scope?: string },
) {
  await serviceClient
    .from('platform_connection')
    .update({
      status: 'session_expired',
      requires_user_action: true,
      last_health_check_at: new Date().toISOString(),
    })
    .eq('id', conn.id);

  await serviceClient.from('platform_consent_log').insert({
    platform_connection_id: conn.id,
    team_id: conn.team_id,
    action: 'expired',
    consent_scope: conn.user_consent_scope || 'apply_and_message',
    granted_by: 'system_refresh',
  });
}

type ProbeResult = {
  sessionExpired: boolean;
  capabilities: Record<string, string>;
};

/**
 * Lightweight HTTP probe to check if a session is still valid.
 * Uses the session cookies to make a simple GET request.
 * Checks for login redirect or 401 as signs of expiry.
 */
async function probeConnection(
  encryptedToken: string,
  probeUrl: string,
  platformCode: string,
): Promise<ProbeResult> {
  // Decrypt session token
  let tokenData: string;
  if (isEncrypted(encryptedToken)) {
    tokenData = await decrypt(encryptedToken);
  } else {
    // Legacy unencrypted token (migration period)
    tokenData = encryptedToken;
  }

  // Build cookie header from session token
  let cookieHeader = '';
  try {
    const cookies = JSON.parse(tokenData);
    if (Array.isArray(cookies)) {
      cookieHeader = cookies.map((c: { name: string; value: string }) => `${c.name}=${c.value}`).join('; ');
    } else if (typeof cookies === 'string') {
      cookieHeader = cookies;
    }
  } catch {
    cookieHeader = tokenData; // Raw cookie string
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(probeUrl, {
      method: 'GET',
      headers: {
        'Cookie': cookieHeader,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      redirect: 'manual', // Don't follow redirects — we want to detect login redirects
      signal: controller.signal,
    });

    const sessionExpired = isLoginRedirect(response, platformCode);
    const searchStatus = sessionExpired ? 'blocked' : 'healthy';

    return {
      sessionExpired,
      capabilities: {
        search: searchStatus,
        detail: searchStatus,
        apply: sessionExpired ? 'blocked' : 'unknown', // Can't determine without trying
        chat: sessionExpired ? 'blocked' : 'unknown',
        resume: sessionExpired ? 'blocked' : 'unknown',
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

function isLoginRedirect(response: Response, platformCode: string): boolean {
  // 401 = session expired. 403 = permission issue, not necessarily expired.
  if (response.status === 401) return true;

  // 3xx redirect to login page
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location') || '';
    const loginPatterns: Record<string, string[]> = {
      linkedin: ['/login', '/authwall', '/uas/login'],
      zhaopin: ['/login', '/passport'],
      lagou: ['/login', '/utrack/login'],
      boss_zhipin: ['/login', '/web/user'],
    };
    const patterns = loginPatterns[platformCode] || ['/login'];
    return patterns.some(p => location.toLowerCase().includes(p));
  }

  return false;
}
