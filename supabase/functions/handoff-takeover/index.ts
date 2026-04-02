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

  const transition = validateHandoffTransition(handoff!.state, 'in_user_handling');
  if (!transition.valid) return err(409, 'HANDOFF_NOT_ACTIONABLE', transition.error!);

  await serviceClient
    .from('handoff')
    .update({ state: 'in_user_handling', takeover_started_at: new Date().toISOString() })
    .eq('id', handoff_id);

  await serviceClient.from('timeline_event').insert({
    team_id: handoff!.team_id,
    event_type: 'handoff_takeover',
    summary_text: `User started handling handoff: ${handoff!.handoff_reason}`,
    actor_type: 'user',
    related_entity_type: 'handoff',
    related_entity_id: handoff_id,
    visibility: 'feed',
  });

  return ok({ handoff_id, state: 'in_user_handling' });
});
