import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { ok, err } from '../_shared/response.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

/**
 * POST /platform-reconnect
 * Initiates reconnection flow for an expired session.
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

  const { data: team } = await serviceClient
    .from('team')
    .select('id')
    .eq('user_id', user!.id)
    .single();

  if (!team) return err(404, 'NOT_FOUND', 'No team found');

  const { data: conn } = await serviceClient
    .from('platform_connection')
    .select('id, team_id, status')
    .eq('id', connection_id)
    .eq('team_id', team.id)
    .single();

  if (!conn) return err(404, 'NOT_FOUND', 'Connection not found');

  // Update status to pending_login
  await serviceClient
    .from('platform_connection')
    .update({
      status: 'pending_login',
      requires_user_action: true,
    })
    .eq('id', connection_id);

  return ok({
    connection_id,
    status: 'pending_login',
    message: 'Please use the browser extension to re-export your session cookie.',
  });
});
