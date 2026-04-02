import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { ok, err } from '../_shared/response.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const { user, error: authError, supabase } = await getAuthenticatedUser(req);
  if (authError) return authError;

  const { data: team } = await supabase!
    .from('team')
    .select('*')
    .eq('user_id', user!.id)
    .single();

  if (!team) {
    return err(404, 'NOT_FOUND', 'No team found');
  }

  const { data: agents } = await supabase!
    .from('agent_instance')
    .select('id, template_role_code, role_title_zh, persona_name, lifecycle_state, runtime_state')
    .eq('team_id', team.id)
    .order('created_at');

  const { data: draft } = await supabase!
    .from('onboarding_draft')
    .select('answered_fields')
    .eq('user_id', user!.id)
    .single();

  return ok({
    team,
    agents: agents || [],
    onboarding_summary: draft?.answered_fields || {},
  });
});
