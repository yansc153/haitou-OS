import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { ok, err } from '../_shared/response.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';

function computeCompletionBand(profile: Record<string, unknown>): string {
  const requiredFields = ['phone', 'contact_email', 'current_city', 'current_country'];
  const optionalFields = ['work_authorization_status', 'relocation_willingness', 'onsite_acceptance', 'notice_period'];

  const requiredPresent = requiredFields.filter((f) => profile[f] != null && profile[f] !== '').length;
  const optionalPresent = optionalFields.filter((f) => profile[f] != null && profile[f] !== '').length;

  if (requiredPresent === 0) return 'missing';
  if (requiredPresent < requiredFields.length) return 'partial';
  if (optionalPresent < optionalFields.length) return 'minimum_ready';
  return 'complete';
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const { user, error: authError, supabase } = await getAuthenticatedUser(req);
  if (authError) return authError;

  const { data: team } = await supabase!
    .from('team')
    .select('id')
    .eq('user_id', user!.id)
    .single();

  if (!team) {
    return err(404, 'NOT_FOUND', 'No team found');
  }

  if (req.method === 'GET') {
    const { data: profile } = await supabase!
      .from('submission_profile')
      .select('*')
      .eq('team_id', team.id)
      .single();

    return ok(profile);
  }

  if (req.method === 'PATCH') {
    const body = await req.json();
    const allowedFields = [
      'phone', 'contact_email', 'current_city', 'current_country',
      'work_authorization_status', 'visa_sponsorship_needed',
      'relocation_willingness', 'onsite_acceptance', 'region_eligibility_notes',
      'notice_period', 'compensation_preference', 'external_links',
    ];

    const updates: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in body) updates[key] = body[key];
    }

    // Recompute completion band
    const { data: current } = await supabase!
      .from('submission_profile')
      .select('*')
      .eq('team_id', team.id)
      .single();

    const merged = { ...current, ...updates };
    updates.completion_band = computeCompletionBand(merged);

    const requiredFields = ['phone', 'contact_email', 'current_city', 'current_country'];
    updates.missing_required_fields = requiredFields.filter(
      (f) => merged[f] == null || merged[f] === ''
    );

    const { data: updated, error: updateError } = await supabase!
      .from('submission_profile')
      .update(updates)
      .eq('team_id', team.id)
      .select()
      .single();

    if (updateError) {
      return err(500, 'INTERNAL_ERROR', 'Failed to update profile');
    }

    return ok(updated);
  }

  return err(405, 'METHOD_NOT_ALLOWED', 'GET or PATCH only');
});
