import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { ok, err } from '../_shared/response.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';

/**
 * GET /opportunity-detail?id=<uuid>
 * Returns full opportunity with collaboration chain and timeline.
 *
 * Source: BACKEND_API_AND_ARCHITECTURE_SPEC.md § GET /api/opportunities/:id
 */
serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const { user, error: authError, supabase } = await getAuthenticatedUser(req);
  if (authError) return authError;

  const url = new URL(req.url);
  const opportunityId = url.searchParams.get('id');
  if (!opportunityId) return err(400, 'BAD_REQUEST', 'id parameter required');

  const { data: team } = await supabase!.from('team').select('id').eq('user_id', user!.id).single();
  if (!team) return err(404, 'NOT_FOUND', 'No team found');

  // Parallel: opportunity + timeline + materials + submissions + handoffs + conversations
  const [oppRes, timelineRes, materialsRes, submissionsRes, handoffsRes, threadsRes] = await Promise.all([
    supabase!
      .from('opportunity')
      .select('*')
      .eq('id', opportunityId)
      .eq('team_id', team.id)
      .single(),

    supabase!
      .from('timeline_event')
      .select('*')
      .eq('team_id', team.id)
      .eq('related_entity_id', opportunityId)
      .in('visibility', ['feed', 'opportunity_timeline'])
      .order('occurred_at', { ascending: false })
      .limit(50),

    supabase!
      .from('material')
      .select('id, material_type, status, language, version, created_at')
      .eq('team_id', team.id)
      .eq('opportunity_id', opportunityId)
      .order('created_at', { ascending: false }),

    supabase!
      .from('submission_attempt')
      .select('id, attempt_number, execution_outcome, failure_reason_code, platform_response_hint, started_at, completed_at')
      .eq('team_id', team.id)
      .eq('opportunity_id', opportunityId)
      .order('created_at', { ascending: false }),

    supabase!
      .from('handoff')
      .select('id, handoff_type, state, urgency, handoff_reason, context_summary, suggested_next_action, created_at')
      .eq('team_id', team.id)
      .eq('opportunity_id', opportunityId)
      .order('created_at', { ascending: false }),

    supabase!
      .from('conversation_thread')
      .select('id, thread_status, latest_message_at, message_count')
      .eq('team_id', team.id)
      .eq('opportunity_id', opportunityId),
  ]);

  if (!oppRes.data) return err(404, 'OPPORTUNITY_NOT_FOUND', 'Opportunity not found');

  const opp = oppRes.data;

  // Map material_ready → prioritized for frontend
  if (opp.stage === 'material_ready') opp.stage = 'prioritized';

  return ok({
    opportunity: opp,
    timeline: timelineRes.data || [],
    materials: materialsRes.data || [],
    submission_attempts: submissionsRes.data || [],
    handoffs: handoffsRes.data || [],
    conversation_threads: threadsRes.data || [],
  });
});
