import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { ok, err } from '../_shared/response.ts';
import { getServiceClient } from '../_shared/auth.ts';
import { decrypt, isEncrypted } from '../_shared/vault.ts';

/**
 * POST /platform-health-check
 * Called by pg_cron or orchestrator. Checks all active connections.
 * Uses service role — no user auth needed.
 *
 * Two-phase check:
 * 1. TTL-based staleness (fast, no network)
 * 2. Lightweight connectivity probe per platform (if token available)
 */

const PLATFORM_TTL_HOURS: Record<string, number> = {
  linkedin: 24,
  boss_zhipin: 3,
  zhaopin: 24,
  lagou: 24,
  liepin: 12,
  greenhouse: 720, // API key, rarely expires
  lever: 720,
};

// Lightweight probe URLs — a simple authenticated GET to detect session validity
const PLATFORM_PROBE_URLS: Record<string, string> = {
  linkedin: 'https://www.linkedin.com/feed/',
  zhaopin: 'https://www.zhaopin.com/home',
  lagou: 'https://www.lagou.com/',
  boss_zhipin: 'https://www.zhipin.com/web/geek/job',
};

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Authenticate: require service role key or CRON_SECRET (exact match)
  const authHeader = req.headers.get('Authorization') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const cronSecret = Deno.env.get('CRON_SECRET') || '';
  const isAuthorized = authHeader === `Bearer ${serviceKey}` ||
    (cronSecret && authHeader === `Bearer ${cronSecret}`);
  if (!isAuthorized) {
    return err(401, 'UNAUTHORIZED', 'Authentication required');
  }

  const serviceClient = getServiceClient();

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
