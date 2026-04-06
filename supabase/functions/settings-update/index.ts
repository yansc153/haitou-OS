import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { ok, err } from '../_shared/response.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

/**
 * POST /settings-update
 * Updates user preferences and submission profile.
 * Body: { preferences?: {...}, submission_profile?: {...} }
 */
serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  if (req.method !== 'POST') return err(405, 'METHOD_NOT_ALLOWED', 'POST only');

  const { user, error: authError, supabase } = await getAuthenticatedUser(req);
  if (authError) return authError;

  const { data: team } = await supabase!
    .from('team')
    .select('id')
    .eq('user_id', user!.id)
    .single();

  if (!team) return err(404, 'NOT_FOUND', 'No team found');

  const body = await req.json();
  const serviceClient = getServiceClient();

  // Update preferences
  if (body.preferences) {
    const allowed = ['strategy_mode', 'coverage_scope', 'work_mode'];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body.preferences) updates[key] = body.preferences[key];
    }
    if (Object.keys(updates).length > 0) {
      await serviceClient
        .from('user_preferences')
        .update(updates)
        .eq('team_id', team.id);

      // Sync strategy_mode and coverage_scope to team table
      const teamUpdates: Record<string, unknown> = {};
      if (updates.strategy_mode) teamUpdates.strategy_mode = updates.strategy_mode;
      if (updates.coverage_scope) teamUpdates.coverage_scope = updates.coverage_scope;
      if (Object.keys(teamUpdates).length > 0) {
        await serviceClient.from('team').update(teamUpdates).eq('id', team.id);
      }
    }
  }

  // Update submission profile
  if (body.submission_profile) {
    const allowed = ['phone', 'contact_email', 'current_city', 'current_country', 'notice_period', 'compensation_preference'];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body.submission_profile) updates[key] = body.submission_profile[key];
    }
    if (Object.keys(updates).length > 0) {
      await serviceClient
        .from('submission_profile')
        .update(updates)
        .eq('team_id', team.id);

      // Recalculate completion_band after update
      const { data: updated } = await serviceClient
        .from('submission_profile')
        .select('contact_email, phone, current_city')
        .eq('team_id', team.id)
        .single();
      if (updated) {
        const hasRequired = updated.contact_email && updated.phone && updated.current_city;
        const hasAny = updated.contact_email || updated.phone || updated.current_city;
        const band = hasRequired ? 'minimum_ready' : hasAny ? 'partial' : 'missing';
        await serviceClient
          .from('submission_profile')
          .update({ completion_band: band })
          .eq('team_id', team.id);
      }
    }
  }

  return ok({ updated: true });
});
