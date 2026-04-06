import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { ok, err } from '../_shared/response.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';

/**
 * GET /home-get → HomePayload
 * Assembles team dashboard data in parallel queries.
 *
 * Source: BACKEND_API_AND_ARCHITECTURE_SPEC.md § HomePayload Assembly
 */
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

  if (!team) return err(404, 'NOT_FOUND', 'No team found');

  // Parallel queries
  const [agentsRes, feedRes, opportunitiesRes, handoffsRes, ledgerRes] = await Promise.all([
    supabase!
      .from('agent_instance')
      .select('id, template_role_code, role_title_zh, persona_name, lifecycle_state, runtime_state, health_status, total_tasks_completed, last_active_at')
      .eq('team_id', team.id)
      .order('created_at'),

    supabase!
      .from('timeline_event')
      .select('*')
      .eq('team_id', team.id)
      .eq('visibility', 'feed')
      .order('occurred_at', { ascending: false })
      .limit(50),

    supabase!
      .from('opportunity')
      .select('id, company_name, job_title, stage, priority_level, requires_takeover, latest_event_at, latest_event_summary')
      .eq('team_id', team.id)
      .in('priority_level', ['high', 'critical'])
      .neq('stage', 'closed')
      .order('latest_event_at', { ascending: false })
      .limit(10),

    supabase!
      .from('handoff')
      .select('id, handoff_type, urgency, state, handoff_reason, created_at, opportunity:opportunity_id(job_title, company_name)')
      .eq('team_id', team.id)
      .eq('state', 'awaiting_takeover')
      .order('urgency', { ascending: false })
      .limit(5),

    supabase!
      .from('runtime_ledger_entry')
      .select('balance_after_seconds, entry_type, session_window_start, created_at')
      .eq('team_id', team.id)
      .order('created_at', { ascending: false })
      .limit(1),
  ]);

  // Compute effective runtime balance
  const lastEntry = ledgerRes.data?.[0];
  let effectiveBalance = lastEntry?.balance_after_seconds ?? 0;
  if (lastEntry?.entry_type === 'session_start' && lastEntry.session_window_start) {
    const elapsed = Math.floor((Date.now() - new Date(lastEntry.session_window_start).getTime()) / 1000);
    effectiveBalance = Math.max(0, effectiveBalance - elapsed);
  }

  // Map agent frontend status
  const agents = (agentsRes.data || []).map((a: Record<string, unknown>) => ({
    ...a,
    frontend_status: mapAgentFrontendStatus(a.runtime_state as string),
  }));

  // Compute today's operation stats
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayIso = todayStart.toISOString();

  const [discoveredRes, screenedRes, submittedRes, materialsRes, aiTasksRes] = await Promise.all([
    supabase!.from('opportunity').select('id', { count: 'exact', head: true })
      .eq('team_id', team.id).gte('created_at', todayIso),
    supabase!.from('opportunity').select('id', { count: 'exact', head: true })
      .eq('team_id', team.id).neq('stage', 'discovered').gte('stage_changed_at', todayIso),
    supabase!.from('submission_attempt').select('id', { count: 'exact', head: true })
      .eq('team_id', team.id).gte('created_at', todayIso),
    supabase!.from('material').select('id', { count: 'exact', head: true })
      .eq('team_id', team.id).gte('created_at', todayIso),
    // Count today's completed tasks that involve AI skills (screening=3 calls, material=2 calls)
    supabase!.from('agent_task').select('id, task_type', { count: 'exact', head: false })
      .eq('team_id', team.id).eq('status', 'completed')
      .in('task_type', ['screening', 'material_generation', 'reply_processing', 'first_contact', 'follow_up'])
      .gte('completed_at', todayIso),
  ]);

  return ok({
    user: { id: user!.id, email: user!.email, display_name: user!.user_metadata?.full_name },
    team: {
      id: team.id,
      name: team.name,
      status: team.status,
      runtime_status: team.runtime_status,
      strategy_mode: team.strategy_mode,
      coverage_scope: team.coverage_scope,
      plan_tier: team.plan_tier,
    },
    runtime: {
      runtime_status: team.runtime_status,
      effective_balance_seconds: effectiveBalance,
      pause_origin: team.pause_origin,
    },
    today_stats: {
      discovered: discoveredRes.count || 0,
      screened: screenedRes.count || 0,
      submitted: submittedRes.count || 0,
      materials_generated: materialsRes.count || 0,
      total_llm_calls: estimateLlmCalls(aiTasksRes.data || []),
    },
    agents,
    live_feed: feedRes.data || [],
    high_value_opportunities: opportunitiesRes.data || [],
    handoff_summary: {
      pending_count: handoffsRes.data?.length || 0,
      items: handoffsRes.data || [],
    },
  });
});

// Estimate AI calls from completed tasks: screening=3, material=2, others=1
function estimateLlmCalls(tasks: Array<{ task_type: string }>): number {
  const CALLS_PER_TYPE: Record<string, number> = {
    screening: 3,           // fit + conflict + recommendation
    material_generation: 2, // truthful-rewrite + cover-letter
    reply_processing: 1,    // reply-reading
    first_contact: 1,       // boss-greeting-compose
    follow_up: 1,           // follow-up-drafting
  };
  return tasks.reduce((sum, t) => sum + (CALLS_PER_TYPE[t.task_type] || 1), 0);
}

function mapAgentFrontendStatus(runtimeState: string): string {
  const map: Record<string, string> = {
    sleeping: 'idle',
    ready: 'ready',
    active: 'working',
    waiting: 'working',
    blocked: 'blocked',
    paused: 'paused',
    handoff: 'waiting',
    completed: 'idle',
  };
  return map[runtimeState] || 'idle';
}
