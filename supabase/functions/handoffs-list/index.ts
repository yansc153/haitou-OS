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
    .select('id')
    .eq('user_id', user!.id)
    .single();

  if (!team) return err(404, 'NOT_FOUND', 'No team found');

  const url = new URL(req.url);
  const state = url.searchParams.get('state');
  const handoffType = url.searchParams.get('handoff_type');
  const urgency = url.searchParams.get('urgency');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '25'), 100);

  let query = supabase!
    .from('handoff')
    .select('*, opportunity:opportunity_id(id, job_title, company_name)')
    .eq('team_id', team.id)
    .order('urgency', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (state) query = query.eq('state', state);
  if (handoffType) query = query.eq('handoff_type', handoffType);
  if (urgency) query = query.eq('urgency', urgency);

  const { data: handoffs, error: queryError } = await query;

  if (queryError) return err(500, 'INTERNAL_ERROR', queryError.message);

  // Compute pending count
  const { count: pendingCount } = await supabase!
    .from('handoff')
    .select('id', { count: 'exact', head: true })
    .eq('team_id', team.id)
    .eq('state', 'awaiting_takeover');

  return ok({
    handoffs: handoffs || [],
    pending_count: pendingCount || 0,
  });
});
