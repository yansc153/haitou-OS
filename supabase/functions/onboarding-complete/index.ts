import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { ok, err, created } from '../_shared/response.ts';
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

const PLAN_ALLOCATIONS: Record<string, number> = {
  free: 21600,   // 6h
  pro: 28800,    // 8h
  plus: 86400,   // 24h
};

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

  // Check if team already exists (idempotency)
  const { data: existingTeam } = await serviceClient
    .from('team')
    .select('id, runtime_status')
    .eq('user_id', user!.id)
    .single();

  if (existingTeam) {
    return ok({ team_id: existingTeam.id, already_exists: true });
  }

  // ── Step 1: Create team (status=active from the start) ──
  const answers = draft.answered_fields as Record<string, unknown>;
  const planTier = 'free';
  const now = new Date().toISOString();

  const { data: team, error: teamError } = await serviceClient
    .from('team')
    .insert({
      user_id: user!.id,
      name: `${user!.email?.split('@')[0]}'s Team`,
      status: 'active',
      runtime_status: 'active',
      strategy_mode: answers.strategy_mode || 'balanced',
      coverage_scope: 'cross_market',
      onboarding_draft_id: draft.id,
      plan_tier: planTier,
      started_at: now,
      activated_at: now,
    })
    .select()
    .single();

  if (teamError) {
    return err(500, 'INTERNAL_ERROR', 'Failed to create team');
  }

  // Helper: cascade rollback on failure
  const rollback = async () => {
    await serviceClient.from('timeline_event').delete().eq('team_id', team.id);
    await serviceClient.from('runtime_ledger_entry').delete().eq('team_id', team.id);
    await serviceClient.from('platform_connection').delete().eq('team_id', team.id);
    await serviceClient.from('agent_instance').delete().eq('team_id', team.id);
    await serviceClient.from('user_preferences').delete().eq('team_id', team.id);
    await serviceClient.from('submission_profile').delete().eq('team_id', team.id);
    await serviceClient.from('profile_baseline').delete().eq('team_id', team.id);
    await serviceClient.from('team').delete().eq('id', team.id);
  };

  try {
    // ── Step 2: Link draft ──
    await serviceClient
      .from('onboarding_draft')
      .update({ team_id: team.id, status: 'completed' })
      .eq('id', draft.id);

    // ── Step 3: Create ProfileBaseline ──
    const parsedProfile = (answers._parsed_profile ?? {}) as Record<string, unknown>;

    const { error: baselineError } = await serviceClient.from('profile_baseline').insert({
      user_id: user!.id,
      team_id: team.id,
      resume_asset_id: draft.resume_asset_id,
      version: 1,
      full_name: parsedProfile.full_name ?? user!.user_metadata?.full_name ?? null,
      contact_email: parsedProfile.contact_email ?? user!.email,
      contact_phone: parsedProfile.contact_phone ?? null,
      current_location: parsedProfile.current_location ?? null,
      nationality: parsedProfile.nationality ?? null,
      years_of_experience: parsedProfile.years_of_experience != null ? Math.round(parsedProfile.years_of_experience as number) : null,
      seniority_level: parsedProfile.seniority_level ?? null,
      primary_domain: parsedProfile.primary_domain ?? null,
      headline_summary: parsedProfile.headline_summary ?? null,
      experiences: parsedProfile.experiences ?? [],
      education: parsedProfile.education ?? [],
      skills: parsedProfile.skills ?? [],
      languages: parsedProfile.languages ?? [],
      certifications: parsedProfile.certifications ?? [],
      inferred_role_directions: parsedProfile.inferred_role_directions ?? [],
      capability_tags: parsedProfile.capability_tags ?? [],
      capability_gaps: parsedProfile.capability_gaps ?? [],
      source_language: parsedProfile.source_language ?? 'en',
      parse_confidence: parsedProfile.parse_confidence ?? 'low',
      factual_gaps: parsedProfile.factual_gaps ?? [],
    });

    if (baselineError) throw new Error(`Failed to create profile: ${baselineError.message}`);

    // ── Step 4: Create SubmissionProfile ──
    const hasRequiredFields = parsedProfile.contact_email && parsedProfile.contact_phone
      && parsedProfile.current_location;
    const { error: profileError } = await serviceClient.from('submission_profile').insert({
      user_id: user!.id,
      team_id: team.id,
      contact_email: parsedProfile.contact_email ?? user!.email,
      phone: parsedProfile.contact_phone ?? null,
      current_city: parsedProfile.current_location ?? null,
      completion_band: hasRequiredFields ? 'minimum_ready' : 'partial',
    });

    if (profileError) throw new Error(`Failed to create submission profile: ${profileError.message}`);

    // ── Step 5: Create UserPreferences ──
    const { error: prefsError } = await serviceClient.from('user_preferences').insert({
      user_id: user!.id,
      team_id: team.id,
      strategy_mode: answers.strategy_mode || 'balanced',
      coverage_scope: 'cross_market',
      work_mode: answers.work_mode || 'flexible',
    });

    if (prefsError) throw new Error(`Failed to create preferences: ${prefsError.message}`);

    // ── Step 6: Create 7 agent instances ──
    const { error: agentError } = await serviceClient
      .from('agent_instance')
      .insert(AGENT_ROSTER.map((agent) => ({
        team_id: team.id,
        template_role_code: agent.role_code,
        role_title_zh: agent.title_zh,
        persona_name: agent.persona,
        lifecycle_state: 'initialized',
        runtime_state: 'ready',
        last_active_at: now,
      })));

    if (agentError) throw new Error(`Failed to create agents: ${agentError.message}`);

    // ── Step 7: Allocate runtime ──
    const allocationSeconds = PLAN_ALLOCATIONS[planTier] || 21600;

    await serviceClient.from('runtime_ledger_entry').insert({
      team_id: team.id,
      entry_type: 'allocation',
      runtime_delta_seconds: allocationSeconds,
      balance_after_seconds: allocationSeconds,
      trigger_source: 'billing',
      reason: `Initial ${planTier} plan allocation`,
    });

    // ── Step 8: Auto-connect Greenhouse + Lever (public platforms, no cookie needed) ──
    const { data: publicPlatforms } = await serviceClient
      .from('platform_definition')
      .select('id, code')
      .eq('supports_cookie_session', false);

    if (publicPlatforms && publicPlatforms.length > 0) {
      const { error: connError } = await serviceClient.from('platform_connection').insert(
        publicPlatforms.map((p) => ({
          team_id: team.id,
          platform_id: p.id,
          status: 'active' as const,
          session_token_ref: null,
          user_consent_granted_at: now,
          user_consent_scope: 'apply_only' as const,
        }))
      );
      if (connError) throw new Error(`Failed to connect platforms: ${connError.message}`);
    }

    // ── Step 9: Record session_start (team auto-start) ──
    await serviceClient.from('runtime_ledger_entry').insert({
      team_id: team.id,
      entry_type: 'session_start',
      runtime_delta_seconds: 0,
      balance_after_seconds: allocationSeconds,
      trigger_source: 'system',
      session_window_start: now,
    });

    // ── Step 10: Timeline event ──
    await serviceClient.from('timeline_event').insert({
      team_id: team.id,
      event_type: 'team_started',
      summary_text: '团队已启动运行',
      actor_type: 'system',
      visibility: 'feed',
    });

    return created({
      team_id: team.id,
      agents_created: 7,
      runtime_status: 'active',
      runtime_balance_seconds: allocationSeconds,
      auto_connected_platforms: publicPlatforms?.map(p => p.code) ?? [],
    });

  } catch (e) {
    await rollback();
    return err(500, 'INTERNAL_ERROR', (e as Error).message);
  }
});
