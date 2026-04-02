import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { ok, err } from '../_shared/response.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

const AGENT_ROSTER = [
  { role_code: 'orchestrator', title_zh: '调度官', persona: 'Commander' },
  { role_code: 'profile_intelligence', title_zh: '履历分析师', persona: 'Analyst' },
  { role_code: 'materials_advisor', title_zh: '简历顾问', persona: 'Advisor' },
  { role_code: 'opportunity_research', title_zh: '岗位研究员', persona: 'Scout' },
  { role_code: 'matching_review', title_zh: '匹配审核员', persona: 'Reviewer' },
  { role_code: 'application_executor', title_zh: '投递专员', persona: 'Executor' },
  { role_code: 'relationship_manager', title_zh: '招聘关系经理', persona: 'Liaison' },
] as const;

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== 'POST') {
    return err(405, 'METHOD_NOT_ALLOWED', 'POST only');
  }

  const { user, error: authError } = await getAuthenticatedUser(req);
  if (authError) return authError;

  const serviceClient = getServiceClient();

  // Get team
  const { data: team } = await serviceClient
    .from('team')
    .select('*')
    .eq('user_id', user!.id)
    .single();

  if (!team) {
    return err(404, 'NOT_FOUND', 'No team found. Complete onboarding first.');
  }

  if (team.status !== 'activation_pending') {
    return ok({ team_id: team.id, already_activated: true });
  }

  // Check if agents already exist
  const { count } = await serviceClient
    .from('agent_instance')
    .select('id', { count: 'exact', head: true })
    .eq('team_id', team.id);

  if (count && count >= 7) {
    // Already activated — just update team status
    await serviceClient
      .from('team')
      .update({ status: 'ready', activated_at: new Date().toISOString() })
      .eq('id', team.id);

    return ok({ team_id: team.id, already_activated: true });
  }

  // Create 7 agent instances
  const agentInserts = AGENT_ROSTER.map((agent) => ({
    team_id: team.id,
    template_role_code: agent.role_code,
    role_title_zh: agent.title_zh,
    persona_name: agent.persona,
    lifecycle_state: 'initialized',
    runtime_state: 'sleeping',
  }));

  const { error: insertError } = await serviceClient
    .from('agent_instance')
    .insert(agentInserts);

  if (insertError) {
    return err(500, 'INTERNAL_ERROR', `Failed to create agents: ${insertError.message}`);
  }

  // Update team status
  await serviceClient
    .from('team')
    .update({ status: 'ready', activated_at: new Date().toISOString() })
    .eq('id', team.id);

  // Seed initial runtime balance based on plan tier
  // Free: 2 hours (7200s), Pro: 8 hours (28800s), Plus: 24 hours (86400s)
  const PLAN_ALLOCATIONS: Record<string, number> = {
    free: 7200,
    pro: 28800,
    plus: 86400,
  };
  const allocationSeconds = PLAN_ALLOCATIONS[team.plan_tier] || 7200;

  await serviceClient.from('runtime_ledger_entry').insert({
    team_id: team.id,
    entry_type: 'allocation',
    runtime_delta_seconds: allocationSeconds,
    balance_after_seconds: allocationSeconds,
    trigger_source: 'billing',
    reason: `Initial ${team.plan_tier} plan allocation`,
  });

  return ok({
    team_id: team.id,
    agents_created: 7,
    runtime_status: 'paused',
    runtime_balance_seconds: allocationSeconds,
  });
});
