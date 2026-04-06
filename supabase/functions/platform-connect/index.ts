import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { ok, err } from '../_shared/response.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';
import { encrypt } from '../_shared/vault.ts';

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== 'POST') return err(405, 'METHOD_NOT_ALLOWED', 'POST only');

  try {
    const { user, error: authError } = await getAuthenticatedUser(req);
    if (authError) return authError;

    const body = await req.json();
    const { platform_code, session_token, consent_scope } = body;

    if (!platform_code) {
      return err(400, 'BAD_REQUEST', 'platform_code is required');
    }

    const serviceClient = getServiceClient();

    const { data: platform } = await serviceClient
      .from('platform_definition')
      .select('id, code')
      .eq('code', platform_code)
      .single();

    if (!platform) {
      return err(404, 'NOT_FOUND', `Platform ${platform_code} not found`);
    }

    const { data: team } = await serviceClient
      .from('team')
      .select('id')
      .eq('user_id', user!.id)
      .single();

    if (!team) {
      return err(404, 'NOT_FOUND', 'No team found');
    }

    const now = new Date().toISOString();
    const scope = consent_scope || 'apply_and_message';
    const hasToken = session_token && session_token.length > 0 && session_token !== 'none';

    // Encrypt if we have a real token
    let encryptedToken = null;
    let tokenFingerprint = 'no_token';
    if (hasToken) {
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(session_token));
      tokenFingerprint = Array.from(new Uint8Array(hashBuffer))
        .map((b: number) => b.toString(16).padStart(2, '0'))
        .join('')
        .slice(0, 16);
      encryptedToken = await encrypt(session_token);
    }

    // Upsert connection
    const { data: connection, error: connError } = await serviceClient
      .from('platform_connection')
      .upsert(
        {
          team_id: team.id,
          platform_id: platform.id,
          status: 'active',
          session_token_ref: encryptedToken,
          session_granted_at: now,
          user_consent_granted_at: now,
          user_consent_scope: scope,
          failure_count: 0,
          requires_user_action: false,
        },
        { onConflict: 'team_id,platform_id' }
      )
      .select()
      .single();

    if (connError) {
      return err(500, 'INTERNAL_ERROR', connError.message);
    }

    // Consent log
    await serviceClient.from('platform_consent_log').insert({
      platform_connection_id: connection.id,
      team_id: team.id,
      action: 'granted',
      consent_scope: scope,
      granted_by: 'user',
      session_token_fingerprint: tokenFingerprint,
      ip_address: req.headers.get('x-forwarded-for') || 'unknown',
      user_agent: req.headers.get('user-agent') || 'unknown',
    });

    return ok({ connection_id: connection.id, platform_code, status: 'active' });
  } catch (e) {
    return err(500, 'INTERNAL_ERROR', `Unexpected: ${(e as Error).message}`);
  }
});
