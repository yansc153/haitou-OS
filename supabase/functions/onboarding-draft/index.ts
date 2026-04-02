import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { ok, err } from '../_shared/response.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== 'PATCH') {
    return err(405, 'METHOD_NOT_ALLOWED', 'PATCH only');
  }

  const { user, error: authError, supabase } = await getAuthenticatedUser(req);
  if (authError) return authError;

  const body = await req.json();
  const { answers } = body as { answers: Record<string, unknown> };

  if (!answers || typeof answers !== 'object') {
    return err(400, 'BAD_REQUEST', 'answers object is required');
  }

  // Get current draft
  const { data: draft, error: fetchError } = await supabase!
    .from('onboarding_draft')
    .select('*')
    .eq('user_id', user!.id)
    .single();

  if (fetchError || !draft) {
    return err(404, 'NOT_FOUND', 'No onboarding draft found');
  }

  // Merge answers
  const mergedAnswers = { ...draft.answered_fields, ...answers };
  const answeredIds = Object.keys(mergedAnswers);

  // Determine new status
  let newStatus = draft.status;
  if (draft.resume_upload_status === 'processed' && answeredIds.length > 0) {
    newStatus = 'questions_in_progress';
  }

  // Check if all required questions are answered
  const requiredIds = ['target_roles', 'target_locations', 'work_mode', 'coverage_scope', 'strategy_mode'];
  const allRequired = requiredIds.every((id) => mergedAnswers[id] != null);
  if (allRequired && draft.resume_upload_status === 'processed') {
    newStatus = 'ready_for_activation';
  }

  const { data: updated, error: updateError } = await supabase!
    .from('onboarding_draft')
    .update({
      answered_fields: mergedAnswers,
      completed_question_ids: answeredIds,
      status: newStatus,
    })
    .eq('user_id', user!.id)
    .select()
    .single();

  if (updateError) {
    return err(500, 'INTERNAL_ERROR', 'Failed to update draft');
  }

  return ok(updated);
});
