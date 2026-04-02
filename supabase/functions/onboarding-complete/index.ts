import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { ok, err } from '../_shared/response.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== 'POST') {
    return err(405, 'METHOD_NOT_ALLOWED', 'POST only');
  }

  const { user, error: authError } = await getAuthenticatedUser(req);
  if (authError) return authError;

  const serviceClient = getServiceClient();

  // Get draft and validate prereqs
  const { data: draft } = await serviceClient
    .from('onboarding_draft')
    .select('*')
    .eq('user_id', user!.id)
    .single();

  if (!draft) {
    return err(404, 'NOT_FOUND', 'No onboarding draft found');
  }

  if (draft.resume_upload_status !== 'processed') {
    return err(422, 'RESUME_MISSING', 'Resume must be uploaded and processed');
  }

  if (draft.status !== 'ready_for_activation') {
    return err(422, 'ONBOARDING_INCOMPLETE', 'All required questions must be answered');
  }

  // Check if team already exists
  const { data: existingTeam } = await serviceClient
    .from('team')
    .select('id')
    .eq('user_id', user!.id)
    .single();

  if (existingTeam) {
    return ok({ team_id: existingTeam.id, already_exists: true });
  }

  // Create team
  const answers = draft.answered_fields as Record<string, unknown>;
  const { data: team, error: teamError } = await serviceClient
    .from('team')
    .insert({
      user_id: user!.id,
      name: `${user!.email?.split('@')[0]}'s Team`,
      status: 'activation_pending',
      strategy_mode: answers.strategy_mode || 'balanced',
      coverage_scope: answers.coverage_scope || 'global_english',
      onboarding_draft_id: draft.id,
    })
    .select()
    .single();

  if (teamError) {
    return err(500, 'INTERNAL_ERROR', 'Failed to create team');
  }

  // Link draft to team
  await serviceClient
    .from('onboarding_draft')
    .update({ team_id: team.id, status: 'completed' })
    .eq('id', draft.id);

  // Create stub ProfileBaseline (linked to team now)
  if (draft.resume_asset_id) {
    await serviceClient.from('profile_baseline').insert({
      user_id: user!.id,
      team_id: team.id,
      resume_asset_id: draft.resume_asset_id,
      version: 1,
      full_name: user!.user_metadata?.full_name || null,
      contact_email: user!.email,
      parse_confidence: 'low',
      source_language: 'en',
    });
  }

  // Create SubmissionProfile
  await serviceClient.from('submission_profile').insert({
    user_id: user!.id,
    team_id: team.id,
    contact_email: user!.email,
    completion_band: 'partial',
  });

  // Create UserPreferences
  await serviceClient.from('user_preferences').insert({
    user_id: user!.id,
    team_id: team.id,
    strategy_mode: answers.strategy_mode || 'balanced',
    coverage_scope: answers.coverage_scope || 'global_english',
    work_mode: answers.work_mode || 'flexible',
  });

  return created({ team_id: team.id });
});

function created<T>(data: T): Response {
  return new Response(JSON.stringify({ data, error: null }), {
    status: 201,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
