import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { ok, err } from '../_shared/response.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';
import { loadHandoffWithOwnership, validateHandoffTransition } from '../_shared/handoff-helpers.ts';

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  if (req.method !== 'POST') return err(405, 'METHOD_NOT_ALLOWED', 'POST only');

  const { user, error: authError, supabase } = await getAuthenticatedUser(req);
  if (authError) return authError;

  const { handoff_id } = await req.json() as { handoff_id: string };
  if (!handoff_id) return err(400, 'BAD_REQUEST', 'handoff_id required');

  const serviceClient = getServiceClient();
  const { handoff, error: loadError } = await loadHandoffWithOwnership(supabase!, serviceClient, user!.id, handoff_id);
  if (loadError) return err(404, 'NOT_FOUND', loadError);

  const transition = validateHandoffTransition(handoff!.state, 'waiting_external');
  if (!transition.valid) return err(409, 'HANDOFF_NOT_ACTIONABLE', transition.error!);

  await serviceClient
    .from('handoff')
    .update({ state: 'waiting_external' })
    .eq('id', handoff_id);

  return ok({ handoff_id, state: 'waiting_external' });
});
