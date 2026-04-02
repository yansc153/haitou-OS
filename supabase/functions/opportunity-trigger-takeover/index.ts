import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { ok, err } from '../_shared/response.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

/**
 * POST /opportunity-trigger-takeover
 * User manually triggers takeover for an opportunity.
 * Body: { opportunity_id }
 *
 * Source: BACKEND_API_AND_ARCHITECTURE_SPEC.md § POST /api/opportunities/:id/trigger-takeover
 */
serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  if (req.method !== 'POST') return err(405, 'METHOD_NOT_ALLOWED', 'POST only');

  const { user, error: authError } = await getAuthenticatedUser(req);
  if (authError) return authError;

  const { opportunity_id } = await req.json() as { opportunity_id: string };
  if (!opportunity_id) return err(400, 'BAD_REQUEST', 'opportunity_id required');

  const serviceClient = getServiceClient();

  const { data: team } = await serviceClient
    .from('team')
    .select('id')
    .eq('user_id', user!.id)
    .single();
  if (!team) return err(404, 'NOT_FOUND', 'No team found');

  const { data: opp } = await serviceClient
    .from('opportunity')
    .select('id, stage, job_title, company_name, team_id')
    .eq('id', opportunity_id)
    .eq('team_id', team.id)
    .single();

  if (!opp) return err(404, 'NOT_FOUND', 'Opportunity not found');
  if (opp.stage === 'needs_takeover') return err(409, 'OPPORTUNITY_NOT_TAKEOVER_ELIGIBLE', 'Already in needs_takeover');
  if (opp.stage === 'closed') return err(409, 'OPPORTUNITY_CLOSED', 'Opportunity is closed');

  const now = new Date().toISOString();

  // Create handoff
  const { data: handoff } = await serviceClient
    .from('handoff')
    .insert({
      team_id: team.id,
      opportunity_id,
      handoff_type: 'other_high_risk',
      state: 'awaiting_takeover',
      urgency: 'medium',
      handoff_reason: 'Manually triggered by user',
      context_summary: `User requested takeover for ${opp.job_title} at ${opp.company_name}`,
    })
    .select('id')
    .single();

  // Transition opportunity
  await serviceClient
    .from('opportunity')
    .update({
      stage: 'needs_takeover',
      previous_stage: opp.stage,
      stage_changed_at: now,
      requires_takeover: true,
    })
    .eq('id', opportunity_id);

  await serviceClient.from('timeline_event').insert({
    team_id: team.id,
    event_type: 'manual_takeover_triggered',
    summary_text: `User manually triggered takeover for ${opp.job_title} at ${opp.company_name}`,
    actor_type: 'user',
    related_entity_type: 'handoff',
    related_entity_id: handoff!.id,
    visibility: 'feed',
  });

  return ok({ handoff_id: handoff!.id, opportunity_stage: 'needs_takeover' });
});
