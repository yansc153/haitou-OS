import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { ok, err, created } from '../_shared/response.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';
import { extractResumeText } from '../_shared/pdf-extract.ts';
import { callHaiku } from '../_shared/llm.ts';

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

  // Parse mode: 'create_team' (Step 2) or 'activate' (Step 4, default)
  let mode = 'activate';
  try {
    const body = await req.clone().json();
    if (body.mode === 'create_team') mode = 'create_team';
  } catch { /* no body = default activate */ }

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

  if (mode === 'activate' && !draft.resume_asset_id && draft.resume_upload_status !== 'uploaded' && draft.resume_upload_status !== 'processed') {
    return err(422, 'RESUME_MISSING', '请先上传简历');
  }

  // Check if team already exists (idempotency)
  const { data: existingTeam } = await serviceClient
    .from('team')
    .select('id, runtime_status')
    .eq('user_id', user!.id)
    .single();

  if (existingTeam) {
    // Team exists — ensure all dependent entities exist (idempotent repair)
    const parsedProfile = (draft.answered_fields as Record<string, unknown>)?._parsed_profile as Record<string, unknown> | null;
    if (parsedProfile && Object.keys(parsedProfile).length > 3) {
      await serviceClient.from('profile_baseline').update({
        full_name: parsedProfile.full_name || null,
        contact_email: parsedProfile.contact_email || null,
        contact_phone: parsedProfile.contact_phone || null,
        current_location: parsedProfile.current_location || null,
        years_of_experience: parsedProfile.years_of_experience || null,
        seniority_level: parsedProfile.seniority_level || null,
        primary_domain: parsedProfile.primary_domain || null,
        headline_summary: parsedProfile.headline_summary || null,
        experiences: parsedProfile.experiences || [],
        education: parsedProfile.education || [],
        skills: parsedProfile.skills || [],
        languages: parsedProfile.languages || [],
        certifications: parsedProfile.certifications || [],
        inferred_role_directions: parsedProfile.inferred_role_directions || [],
        capability_tags: parsedProfile.capability_tags || [],
        capability_gaps: parsedProfile.capability_gaps || [],
        source_language: parsedProfile.source_language || 'en',
        parse_confidence: parsedProfile.parse_confidence || 'medium',
        search_keywords: null, // Force keyword regeneration
        updated_at: new Date().toISOString(),
      }).eq('team_id', existingTeam.id);
    }

    // Ensure agents exist (repair if previous run partially failed)
    const { count: agentCount } = await serviceClient
      .from('agent_instance')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', existingTeam.id);

    if (!agentCount || agentCount < 7) {
      // Delete partial agents and recreate all 7
      await serviceClient.from('agent_instance').delete().eq('team_id', existingTeam.id);
      await serviceClient.from('agent_instance').insert(AGENT_ROSTER.map((agent) => ({
        team_id: existingTeam.id,
        template_role_code: agent.role_code,
        role_title_zh: agent.title_zh,
        persona_name: agent.persona,
        lifecycle_state: 'initialized',
        runtime_state: 'ready',
        last_active_at: new Date().toISOString(),
      })));
    }

    // Ensure profile_baseline exists
    const { data: baseline } = await serviceClient
      .from('profile_baseline')
      .select('id')
      .eq('team_id', existingTeam.id)
      .single();

    if (!baseline) {
      const pp = parsedProfile || {};
      await serviceClient.from('profile_baseline').insert({
        user_id: user!.id,
        team_id: existingTeam.id,
        resume_asset_id: draft.resume_asset_id,
        version: 1,
        full_name: pp.full_name ?? user!.user_metadata?.full_name ?? null,
        contact_email: pp.contact_email ?? user!.email,
        skills: pp.skills ?? [],
        experiences: pp.experiences ?? [],
        education: pp.education ?? [],
        inferred_role_directions: pp.inferred_role_directions ?? [],
        source_language: pp.source_language ?? 'en',
        parse_confidence: pp.parse_confidence ?? 'low',
      });
    }

    // Ensure submission_profile exists
    const { data: subProfile } = await serviceClient
      .from('submission_profile')
      .select('id')
      .eq('team_id', existingTeam.id)
      .single();

    if (!subProfile) {
      const pp = parsedProfile || {};
      await serviceClient.from('submission_profile').insert({
        user_id: user!.id,
        team_id: existingTeam.id,
        contact_email: pp.contact_email ?? user!.email,
        phone: pp.contact_phone ?? null,
        current_city: pp.current_location ?? null,
        completion_band: 'partial',
      });
    }

    // Mark draft completed
    await serviceClient.from('onboarding_draft')
      .update({ team_id: existingTeam.id, status: 'completed' })
      .eq('id', draft.id);

    return ok({ team_id: existingTeam.id, already_exists: true, profile_updated: !!parsedProfile, repaired: true });
  }

  // ── Step 0: Parse resume if not already parsed ──
  const answers = draft.answered_fields as Record<string, unknown>;
  let parsedProfileData = answers._parsed_profile as Record<string, unknown> | null;

  if (!parsedProfileData && draft.resume_asset_id) {
    try {
      const { data: asset } = await serviceClient
        .from('resume_asset')
        .select('storage_path, file_mime_type, parse_status')
        .eq('id', draft.resume_asset_id)
        .single();

      if (asset && asset.parse_status !== 'parsed') {
        const { data: fileData } = await serviceClient.storage.from('resumes').download(asset.storage_path);
        if (fileData) {
          const bytes = new Uint8Array(await fileData.arrayBuffer());
          const rawText = await extractResumeText(bytes, asset.file_mime_type);

          const parseResult = await callHaiku(
            'You are a resume parsing + profile extraction engine. Given raw resume text, extract a structured profile. Return JSON with: full_name, contact_email, contact_phone, current_location, years_of_experience, seniority_level, primary_domain, headline_summary, experiences (array), education (array), skills (array), languages (array), inferred_role_directions (array), source_language ("zh"|"en"|"bilingual"), parse_confidence ("high"|"medium"|"low"). Do not invent data not in the text.',
            rawText.substring(0, 20000),
            2048,
          );
          parsedProfileData = parseResult.parsed;

          // Save parsed profile back to draft
          answers._parsed_profile = parsedProfileData;
          await serviceClient.from('onboarding_draft').update({
            answered_fields: answers,
            resume_upload_status: 'processed',
          }).eq('id', draft.id);

          await serviceClient.from('resume_asset').update({
            parse_status: 'parsed', upload_status: 'processed',
          }).eq('id', draft.resume_asset_id);
        }
      }
    } catch (parseErr) {
      const msg = (parseErr as Error).message;
      console.warn('[onboarding-complete] Resume parsing failed:', msg);
      if (mode === 'activate') {
        // For activation, we need SOME profile data. If parsing totally fails,
        // create minimal profile from user metadata so team can still start.
        // Worker keyword_generation will use fallback keywords.
        parsedProfileData = {
          full_name: user!.user_metadata?.full_name || null,
          contact_email: user!.email || null,
          skills: [],
          experiences: [],
          education: [],
          inferred_role_directions: [],
          source_language: 'en',
          parse_confidence: 'low',
          _parse_error: msg,
        };
      }
    }
  }

  // ── Step 1: Create team ──
  const isCreateOnly = mode === 'create_team';
  const planTier = 'free';
  const now = new Date().toISOString();

  const { data: team, error: teamError } = await serviceClient
    .from('team')
    .insert({
      user_id: user!.id,
      name: `${user!.email?.split('@')[0]}'s Team`,
      status: isCreateOnly ? 'onboarding' : 'active',
      runtime_status: isCreateOnly ? 'paused' : 'active',
      strategy_mode: answers.strategy_mode || 'balanced',
      coverage_scope: 'cross_market',
      onboarding_draft_id: draft.id,
      plan_tier: planTier,
      started_at: isCreateOnly ? null : now,
      activated_at: isCreateOnly ? null : now,
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

    // ── create_team mode: return early (team + agents created, not activated) ──
    if (isCreateOnly) {
      // Auto-connect Greenhouse + Lever (so they show as connected in Step 3)
      const { data: publicPlatforms } = await serviceClient
        .from('platform_definition')
        .select('id, code')
        .eq('supports_cookie_session', false);

      if (publicPlatforms && publicPlatforms.length > 0) {
        await serviceClient.from('platform_connection').insert(
          publicPlatforms.map((p) => ({
            team_id: team.id,
            platform_id: p.id,
            status: 'active' as const,
            session_token_ref: null,
            user_consent_granted_at: now,
            user_consent_scope: 'apply_only' as const,
          }))
        );
      }

      await serviceClient.from('onboarding_draft')
        .update({ team_id: team.id })
        .eq('id', draft.id);

      return created({
        team_id: team.id,
        agents_created: 7,
        mode: 'create_team',
        runtime_status: 'paused',
      });
    }

    // ── Step 7: Allocate runtime (activate mode only) ──
    const allocationSeconds = PLAN_ALLOCATIONS[planTier] || 21600;

    await serviceClient.from('runtime_ledger_entry').insert({
      team_id: team.id,
      entry_type: 'allocation',
      runtime_delta_seconds: allocationSeconds,
      balance_after_seconds: allocationSeconds,
      trigger_source: 'billing',
      reason: `Initial ${planTier} plan allocation`,
    });

    // ── Step 8: Auto-connect Greenhouse + Lever (if not already connected) ──
    const { data: publicPlatforms } = await serviceClient
      .from('platform_definition')
      .select('id, code')
      .eq('supports_cookie_session', false);

    if (publicPlatforms && publicPlatforms.length > 0) {
      for (const p of publicPlatforms) {
        const { data: existing } = await serviceClient.from('platform_connection')
          .select('id').eq('team_id', team.id).eq('platform_id', p.id).single();
        if (!existing) {
          await serviceClient.from('platform_connection').insert({
            team_id: team.id,
            platform_id: p.id,
            status: 'active' as const,
            session_token_ref: null,
            user_consent_granted_at: now,
            user_consent_scope: 'apply_only' as const,
          });
        }
      }
    }

    // ── Step 9: Activate team ──
    await serviceClient.from('team').update({
      status: 'active',
      runtime_status: 'active',
      started_at: now,
      activated_at: now,
    }).eq('id', team.id);

    // ── Step 10: Record session_start ──
    await serviceClient.from('runtime_ledger_entry').insert({
      team_id: team.id,
      entry_type: 'session_start',
      runtime_delta_seconds: 0,
      balance_after_seconds: allocationSeconds,
      trigger_source: 'system',
      session_window_start: now,
    });

    // ── Step 11: Timeline event ──
    await serviceClient.from('timeline_event').insert({
      team_id: team.id,
      event_type: 'team_started',
      summary_text: '团队已启动运行',
      actor_type: 'system',
      visibility: 'feed',
    });

    // ── Step 12: Mark draft completed ──
    await serviceClient.from('onboarding_draft').update({
      team_id: team.id,
      status: 'completed',
    }).eq('id', draft.id);

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
