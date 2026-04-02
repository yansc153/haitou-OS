import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { ok, err } from '../_shared/response.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

/**
 * POST /platform-disconnect
 * Revokes a platform connection — clears session, logs revocation.
 * Body: { connection_id }
 */
serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== 'POST') return err(405, 'METHOD_NOT_ALLOWED', 'POST only');

  const { user, error: authError } = await getAuthenticatedUser(req);
  if (authError) return authError;

  const { connection_id } = await req.json() as { connection_id: string };
  if (!connection_id) return err(400, 'BAD_REQUEST', 'connection_id required');

  const serviceClient = getServiceClient();

  // Verify ownership via team
  const { data: team } = await serviceClient
    .from('team')
    .select('id')
    .eq('user_id', user!.id)
    .single();

  if (!team) return err(404, 'NOT_FOUND', 'No team found');

  const { data: conn } = await serviceClient
    .from('platform_connection')
    .select('id, team_id')
    .eq('id', connection_id)
    .eq('team_id', team.id)
    .single();

  if (!conn) return err(404, 'NOT_FOUND', 'Connection not found');

  const now = new Date().toISOString();

  // Clear session and update status
  await serviceClient
    .from('platform_connection')
    .update({
      status: 'available_unconnected',
      session_token_ref: null,
      session_revoked_at: now,
      requires_user_action: false,
    })
    .eq('id', connection_id);

  // Log revocation
  await serviceClient.from('platform_consent_log').insert({
    platform_connection_id: connection_id,
    team_id: team.id,
    action: 'revoked',
    consent_scope: 'read_only',
    granted_by: 'user',
  });

  return ok({ connection_id, status: 'disconnected' });
});
