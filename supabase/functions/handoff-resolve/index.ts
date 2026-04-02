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

  const { handoff_id, resolution_type } = await req.json() as {
    handoff_id: string;
    resolution_type: 'resolved' | 'returned_to_team';
  };
  if (!handoff_id) return err(400, 'BAD_REQUEST', 'handoff_id required');

  const serviceClient = getServiceClient();
  const { handoff, error: loadError } = await loadHandoffWithOwnership(supabase!, serviceClient, user!.id, handoff_id);
  if (loadError) return err(404, 'NOT_FOUND', loadError);

  const targetState = resolution_type === 'returned_to_team' ? 'returned_to_team' : 'resolved';
  const transition = validateHandoffTransition(handoff!.state, targetState);
  if (!transition.valid) return err(409, 'HANDOFF_NOT_ACTIONABLE', transition.error!);

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = {
    state: targetState,
    resolution_type: resolution_type || 'resolved',
  };

  if (targetState === 'resolved') updates.resolved_at = now;
  if (targetState === 'returned_to_team') updates.returned_at = now;

  await serviceClient.from('handoff').update(updates).eq('id', handoff_id);

  // If returned to team, transition opportunity back to followup_active
  if (targetState === 'returned_to_team') {
    await serviceClient
      .from('opportunity')
      .update({
        stage: 'followup_active',
        previous_stage: 'needs_takeover',
        stage_changed_at: now,
        requires_takeover: false,
      })
      .eq('id', handoff!.opportunity_id);
  }

  await serviceClient.from('timeline_event').insert({
    team_id: handoff!.team_id,
    event_type: `handoff_${targetState}`,
    summary_text: `Handoff ${targetState === 'resolved' ? 'resolved' : 'returned to team'}`,
    actor_type: 'user',
    related_entity_type: 'handoff',
    related_entity_id: handoff_id,
    visibility: 'feed',
  });

  return ok({ handoff_id, state: targetState });
});
