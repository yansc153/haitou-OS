import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { ok, err } from '../_shared/response.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';

/**
 * GET /settings-get
 * Returns user info, team preferences, and submission profile for the settings page.
 */
serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const { user, error: authError, supabase } = await getAuthenticatedUser(req);
  if (authError) return authError;

  const { data: team } = await supabase!
    .from('team')
    .select('id, strategy_mode, coverage_scope')
    .eq('user_id', user!.id)
    .single();

  if (!team) return err(404, 'NOT_FOUND', 'No team found');

  const [prefsRes, profileRes] = await Promise.all([
    supabase!
      .from('user_preferences')
      .select('strategy_mode, coverage_scope, work_mode')
      .eq('team_id', team.id)
      .single(),
    supabase!
      .from('submission_profile')
      .select('phone, contact_email, current_city, current_country, notice_period, compensation_preference')
      .eq('team_id', team.id)
      .single(),
  ]);

  return ok({
    user: {
      display_name: user!.user_metadata?.full_name || '',
      email: user!.email,
    },
    preferences: prefsRes.data || { strategy_mode: 'balanced', coverage_scope: 'global_english', work_mode: 'flexible' },
    submission_profile: profileRes.data || {},
  });
});
