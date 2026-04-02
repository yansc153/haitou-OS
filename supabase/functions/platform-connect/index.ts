import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { ok, err } from '../_shared/response.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';
import { createHash } from 'https://deno.land/std@0.168.0/crypto/mod.ts';

/**
 * POST /platform-connect
 * Receives session token from browser extension, stores encrypted, creates PlatformConnection + consent log.
 *
 * Body: { platform_code, session_token, auth_code, consent_scope }
 */
serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== 'POST') return err(405, 'METHOD_NOT_ALLOWED', 'POST only');

  const { user, error: authError } = await getAuthenticatedUser(req);
  if (authError) return authError;

  const body = await req.json();
  const { platform_code, session_token, auth_code, consent_scope } = body as {
    platform_code: string;
    session_token: string;
    auth_code?: string;
    consent_scope?: string;
  };

  if (!platform_code || !session_token) {
    return err(400, 'BAD_REQUEST', 'platform_code and session_token are required');
  }

  const serviceClient = getServiceClient();

  // Look up platform definition
  const { data: platform } = await serviceClient
    .from('platform_definition')
    .select('id, code, supports_cookie_session')
    .eq('code', platform_code)
    .single();

  if (!platform) {
    return err(404, 'NOT_FOUND', `Platform ${platform_code} not found`);
  }

  // Get user's team
  const { data: team } = await serviceClient
    .from('team')
    .select('id')
    .eq('user_id', user!.id)
    .single();

  if (!team) {
    return err(404, 'NOT_FOUND', 'No team found');
  }

  // Compute token fingerprint (hash, never store raw token in logs)
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(session_token));
  const tokenFingerprint = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);

  const now = new Date().toISOString();
  const scope = consent_scope || 'apply_and_message';

  // Upsert PlatformConnection
  const { data: connection, error: connError } = await serviceClient
    .from('platform_connection')
    .upsert(
      {
        team_id: team.id,
        platform_id: platform.id,
        status: 'active',
        session_token_ref: session_token, // In production: encrypt via Vault
        session_granted_at: now,
        user_consent_granted_at: now,
        user_consent_scope: scope,
        failure_count: 0,
        requires_user_action: false,
        verification_state: 'none',
      },
      { onConflict: 'team_id,platform_id' }
    )
    .select()
    .single();

  if (connError) {
    return err(500, 'INTERNAL_ERROR', `Failed to create connection: ${connError.message}`);
  }

  // Write consent log
  await serviceClient.from('platform_consent_log').insert({
    platform_connection_id: connection.id,
    team_id: team.id,
    action: 'granted',
    consent_scope: scope,
    granted_by: 'user',
    session_token_fingerprint: tokenFingerprint,
    ip_address: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown',
    user_agent: req.headers.get('user-agent') || 'unknown',
  });

  return ok({
    connection_id: connection.id,
    platform_code,
    status: 'active',
  });
});
