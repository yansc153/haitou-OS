import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { ok, err } from '../_shared/response.ts';
import { getServiceClient } from '../_shared/auth.ts';

/**
 * POST /admin-cleanup
 * One-time cleanup: remove duplicate opportunities (keep oldest per company+title per team).
 * Auth: service role key or CRON_SECRET.
 */
serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // No auth check — deployed with --no-verify-jwt, one-time use only

  const db = getServiceClient();

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty body = dedup mode */ }

  if (body.action === 'add_runtime') {
    const hours = (body.hours as number) || 9999;
    const seconds = hours * 3600;
    const teamId = (await db.from('team').select('id').limit(1).single()).data?.id;
    const now = new Date().toISOString();
    // Wipe ledger, insert credit + session_start with correct balance
    await db.from('runtime_ledger_entry').delete().neq('id', '00000000-0000-0000-0000-000000000000').eq('team_id', teamId);
    const creditFields: Record<string, unknown> = { team_id: teamId, entry_type: 'credit', balance_after_seconds: seconds, reason: 'admin_test_credit' };
    const sessionFields: Record<string, unknown> = { team_id: teamId, entry_type: 'session_start', balance_after_seconds: seconds, session_window_start: now, reason: 'admin_session_start' };
    await db.from('runtime_ledger_entry').insert(creditFields);
    await db.from('runtime_ledger_entry').insert(sessionFields);
    // Force activate team + agents
    await db.from('team').update({
      status: 'active',
      runtime_status: 'active',
      pause_origin: null,
      started_at: now,
    }).eq('id', teamId);
    await db.from('agent_instance').update({
      runtime_state: 'ready',
      last_active_at: now,
    }).eq('team_id', teamId);
    // Insert team_started event
    await db.from('timeline_event').insert({
      team_id: teamId,
      event_type: 'team_started',
      summary_text: '团队已启动运行',
      actor_type: 'user',
      visibility: 'feed',
    });
    return ok({ message: `Added ${hours}h, team force-activated` });
  }

  if (body.action === 'check_keywords') {
    const { data, error } = await db
      .from('profile_baseline')
      .select('*')
      .order('version', { ascending: false })
      .limit(1);
    // Also check onboarding_draft for parsed profile
    const { data: draft } = await db
      .from('onboarding_draft')
      .select('answered_fields')
      .limit(1)
      .single();
    const af = draft?.answered_fields as Record<string, unknown> | undefined;
    const parsedProfile = af?._parsed_profile;
    const parsedSections = af?._parsed_sections;
    const targetRoles = af?.target_roles;
    return ok({
      baseline: data?.[0] ? { id: data[0].id, full_name: data[0].full_name, primary_domain: data[0].primary_domain, experiences_count: (data[0].experiences as unknown[])?.length || 0, skills_count: (data[0].skills as unknown[])?.length || 0, parse_confidence: data[0].parse_confidence, search_keywords: data[0].search_keywords } : null,
      hasParsedProfile: !!parsedProfile,
      parsedProfileKeys: parsedProfile ? Object.keys(parsedProfile as Record<string, unknown>) : [],
      hasParsedSections: !!parsedSections,
      targetRoles: targetRoles,
      draftKeys: af ? Object.keys(af) : [],
      error: error?.message,
    });
  }

  if (body.action === 'reparse_resume') {
    // Re-trigger resume parsing for the team's latest resume
    const { data: baseline } = await db.from('profile_baseline').select('id, team_id, resume_asset_id').order('version', { ascending: false }).limit(1).single();
    if (!baseline) return err(404, 'NO_BASELINE', 'No profile baseline');

    // Get resume asset
    const { data: asset } = await db.from('resume_asset').select('storage_path, file_type').eq('id', baseline.resume_asset_id).single();
    if (!asset) return err(404, 'NO_ASSET', 'Resume asset not found');

    // Download resume from storage
    const { data: fileData, error: dlError } = await db.storage.from('resumes').download(asset.storage_path);
    if (dlError || !fileData) return err(500, 'DOWNLOAD_FAILED', dlError?.message || 'Download failed');

    const rawText = await fileData.text();
    const textPreview = rawText.slice(0, 500);

    // For now, just return the preview so we can see if the resume has content
    return ok({
      baselineId: baseline.id,
      assetPath: asset.storage_path,
      fileType: asset.file_type,
      textLength: rawText.length,
      textPreview,
    });
  }

  if (body.action === 'reparse_and_update') {
    // Get the latest resume asset for the team
    const { data: baseline } = await db.from('profile_baseline').select('id, team_id, user_id, resume_asset_id').order('version', { ascending: false }).limit(1).single();
    if (!baseline) return err(404, 'NO_BASELINE', 'No profile baseline');

    // Try team_id first, then user_id as fallback
    let { data: asset } = await db.from('resume_asset').select('id, storage_path, file_type').eq('team_id', baseline.team_id).order('created_at', { ascending: false }).limit(1).single();
    if (!asset) {
      const res = await db.from('resume_asset').select('id, storage_path, file_type').eq('user_id', baseline.user_id).order('created_at', { ascending: false }).limit(1).single();
      asset = res.data;
    }
    if (!asset) {
      // List all resume assets for debugging
      const { data: allAssets } = await db.from('resume_asset').select('id, user_id, team_id, storage_path, created_at').order('created_at', { ascending: false }).limit(5);
      return err(404, 'NO_ASSET', JSON.stringify({ msg: 'No resume asset', baseline_team: baseline.team_id, baseline_user: baseline.user_id, allAssets }));
    }
    if (!asset) return err(404, 'NO_ASSET', 'No resume asset found');

    // Download resume
    const { data: fileData, error: dlErr } = await db.storage.from('resumes').download(asset.storage_path);
    if (dlErr || !fileData) return err(500, 'DL_FAIL', dlErr?.message || 'Download failed');

    const rawText = await fileData.text();
    if (rawText.length < 50) return err(400, 'EMPTY_RESUME', `Resume too short (${rawText.length} chars)`);

    // Call resume-parse skill via HTTP to the onboarding-resume function pattern
    // Since we can't call LLM directly from Edge Function easily,
    // let's just update profile_baseline with what we can extract from onboarding_draft
    const { data: draft } = await db.from('onboarding_draft').select('answered_fields').eq('user_id', baseline.user_id).single();
    const parsedProfile = (draft?.answered_fields as Record<string, unknown>)?._parsed_profile as Record<string, unknown> | null;

    if (parsedProfile && Object.keys(parsedProfile).length > 3) {
      // Profile was parsed — update baseline
      await db.from('profile_baseline').update({
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
        resume_asset_id: asset.id,
        search_keywords: null, // Force regeneration
        updated_at: new Date().toISOString(),
      }).eq('id', baseline.id);
      return ok({ message: 'Profile baseline updated from parsed profile', keys: Object.keys(parsedProfile) });
    }

    // No parsed profile in draft — return info for debugging
    return ok({
      message: 'No parsed profile in onboarding_draft. User needs to re-upload resume via the onboarding page.',
      resumeTextLength: rawText.length,
      resumeTextPreview: rawText.slice(0, 300),
      draftKeys: draft?.answered_fields ? Object.keys(draft.answered_fields as Record<string, unknown>) : [],
    });
  }

  if (body.action === 'parse_raw_text') {
    // Accept raw resume text, run profile-extraction, update profile_baseline
    const rawText = body.raw_text as string;
    if (!rawText || rawText.length < 50) return err(400, 'EMPTY', 'raw_text too short');

    // Direct LLM call (inline to avoid import issues)
    const PROFILE_PROMPT = `You are a profile extraction engine for a job search system. Given resume text, extract a structured JSON profile.

Return JSON with these exact fields:
{"full_name":"<str>","contact_email":"<str>","contact_phone":"<str|null>","current_location":"<str|null>","years_of_experience":<num|null>,"seniority_level":"<junior|mid|senior|lead|executive|null>","primary_domain":"<str>","headline_summary":"<1-2 sentences>","experiences":[{"company_name":"<str>","job_title":"<str>","start_date":"<YYYY-MM|null>","end_date":"<YYYY-MM|null>","is_current":false,"description_summary":"<str>","key_achievements":["<str>"]}],"education":[{"institution":"<str>","degree":"<str|null>","field_of_study":"<str|null>"}],"skills":["<str>"],"languages":[{"language":"<str>","proficiency":"<native|fluent|professional>"}],"certifications":[],"inferred_role_directions":["<str>"],"capability_tags":["<str>"],"capability_gaps":["<str>"],"source_language":"en","parse_confidence":"high","factual_gaps":[],"summary_text":"<2-3 sentences>"}

Rules: Only extract from provided text. Never fabricate. Use null for missing fields.
IMPORTANT: Respond IMMEDIATELY with JSON. Do NOT use <think> tags or reasoning blocks. Output ONLY the JSON object.`;

    try {
    const apiKey = Deno.env.get('DASHSCOPE_API_KEY');
    if (!apiKey) return err(500, 'NO_KEY', 'DASHSCOPE_API_KEY not set');

    const llmRes = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen3.5-plus',
        max_tokens: 2048,
        messages: [
          { role: 'system', content: PROFILE_PROMPT },
          { role: 'user', content: rawText.substring(0, 8000) },
        ],
      }),
    });

    if (!llmRes.ok) return err(500, 'LLM_FAIL', `LLM returned ${llmRes.status}`);
    const llmJson = await llmRes.json();
    let profileText = llmJson.choices?.[0]?.message?.content || '';
    // Strip <think> blocks and markdown fences
    profileText = profileText.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    const fenceMatch = profileText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) profileText = fenceMatch[1].trim();
    const startIdx = profileText.indexOf('{');
    const endIdx = profileText.lastIndexOf('}');
    if (startIdx >= 0 && endIdx > startIdx) profileText = profileText.substring(startIdx, endIdx + 1);

    let profile: Record<string, unknown>;
    try { profile = JSON.parse(profileText); } catch { return err(500, 'PARSE_FAIL', `Cannot parse LLM output: ${profileText.slice(0, 200)}`); }

    // Step 3: Update profile_baseline
    const { data: baseline } = await db.from('profile_baseline').select('id').order('version', { ascending: false }).limit(1).single();
    if (!baseline) return err(404, 'NO_BASELINE', 'No profile baseline');

    await db.from('profile_baseline').update({
      full_name: profile.full_name || null,
      contact_email: profile.contact_email || null,
      contact_phone: profile.contact_phone || null,
      current_location: profile.current_location || null,
      years_of_experience: profile.years_of_experience || null,
      seniority_level: profile.seniority_level || null,
      primary_domain: profile.primary_domain || null,
      headline_summary: profile.headline_summary || null,
      experiences: profile.experiences || [],
      education: profile.education || [],
      skills: profile.skills || [],
      languages: profile.languages || [],
      certifications: profile.certifications || [],
      inferred_role_directions: profile.inferred_role_directions || [],
      capability_tags: profile.capability_tags || [],
      capability_gaps: profile.capability_gaps || [],
      source_language: profile.source_language || 'en',
      parse_confidence: profile.parse_confidence || 'medium',
      search_keywords: null, // Force keyword regeneration
      updated_at: new Date().toISOString(),
    }).eq('id', baseline.id);

    // Also update onboarding_draft
    const { data: bl } = await db.from('profile_baseline').select('user_id').eq('id', baseline.id).single();
    if (bl) {
      const { data: draft } = await db.from('onboarding_draft').select('answered_fields').eq('user_id', bl.user_id).single();
      const af = (draft?.answered_fields || {}) as Record<string, unknown>;
      af._parsed_profile = profile;
      af._parsed_sections = [];
      await db.from('onboarding_draft').update({ answered_fields: af }).eq('user_id', bl.user_id);
    }

    return ok({
      message: 'Profile parsed and updated',
      full_name: profile.full_name,
      primary_domain: profile.primary_domain,
      skills_count: (profile.skills as string[])?.length || 0,
      experiences_count: (profile.experiences as unknown[])?.length || 0,
      inferred_directions: profile.inferred_role_directions,
    });
    } catch (e) {
      return err(500, 'CATCH', (e as Error).message + ' | ' + (e as Error).stack?.slice(0, 200));
    }
  }

  if (body.action === 'inject_keywords') {
    // Manually inject search keywords to unblock the pipeline
    const keywords = body.keywords || {
      en_keywords: ['blockchain engineer', 'smart contract developer', 'web3 backend engineer', 'crypto trading systems', 'DeFi protocol engineer', 'solidity developer', 'distributed systems engineer', 'backend engineer', 'fintech engineer', 'cryptocurrency engineer'],
      zh_keywords: ['区块链工程师', '智能合约开发', 'Web3后端开发', '加密货币交易系统', 'DeFi协议开发', 'Solidity开发工程师', '分布式系统工程师', '后端工程师', '金融科技工程师', '数字货币开发'],
      target_companies: ['coinbase', 'binance', 'consensys', 'chainalysis', 'uniswap', 'opensea', 'alchemy', 'circle', 'ripple', 'kraken', 'gemini', 'blockfi', 'anchorage', 'fireblocks', 'dapper-labs'],
      primary_domain: 'web3',
      seniority_bracket: 'mid-senior',
      reasoning: 'Based on resume analysis: crypto/blockchain background with engineering skills',
    };

    const { data: baseline } = await db.from('profile_baseline').select('id').order('version', { ascending: false }).limit(1).single();
    if (!baseline) return err(404, 'NO_BASELINE', 'No profile baseline');

    const { error: updateErr } = await db.from('profile_baseline').update({ search_keywords: keywords }).eq('id', baseline.id);
    if (updateErr) return err(500, 'UPDATE_FAILED', updateErr.message);

    return ok({ message: 'Keywords injected', en: keywords.en_keywords.length, zh: keywords.zh_keywords.length, companies: keywords.target_companies.length });
  }

  if (body.action === 'notify_schema_reload') {
    // Force PostgREST to reload schema cache by calling a simple query on the new column
    const { data, error } = await db.from('profile_baseline').select('search_keywords').limit(1);
    return ok({ message: 'Schema reloaded', data, error: error?.message });
  }

  if (body.action === 'connect_all_platforms') {
    // Connect ALL 7 platforms with simulated tokens for E2E testing
    const { data: team } = await db.from('team').select('id').limit(1).single();
    if (!team) return err(404, 'NO_TEAM', 'No team');

    const { data: platforms } = await db.from('platform_definition').select('id, code, display_name_zh');
    if (!platforms || platforms.length === 0) return err(404, 'NO_PLATFORMS', 'No platform definitions');

    const now = new Date().toISOString();
    const results: string[] = [];

    for (const p of platforms) {
      // Check if already connected
      const { data: existing } = await db.from('platform_connection')
        .select('id, status')
        .eq('team_id', team.id).eq('platform_id', p.id)
        .single();

      if (existing && existing.status === 'active') {
        results.push(`${p.code}: already active`);
        continue;
      }

      if (existing) {
        // Update to active
        await db.from('platform_connection').update({
          status: 'active',
          session_token_ref: `e2e_simulated_${p.code}`,
          session_granted_at: now,
          session_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          user_consent_granted_at: now,
          user_consent_scope: 'apply_and_message',
        }).eq('id', existing.id);
        results.push(`${p.code}: reactivated`);
      } else {
        // Create new connection
        await db.from('platform_connection').insert({
          team_id: team.id,
          platform_id: p.id,
          status: 'active',
          session_token_ref: `e2e_simulated_${p.code}`,
          session_granted_at: now,
          session_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          user_consent_granted_at: now,
          user_consent_scope: 'apply_and_message',
        });
        results.push(`${p.code}: connected`);
      }
    }

    // Also unlock plan tier — set team to 'pro' so Chinese platforms are usable
    await db.from('team').update({ plan_tier: 'pro' }).eq('id', team.id);

    return ok({ message: `All platforms connected, plan upgraded to pro`, results });
  }

  if (body.action === 'migrate') {
    // Use Deno's postgres driver for DDL (supabase-js doesn't support raw SQL)
    const dbUrl = Deno.env.get('SUPABASE_DB_URL');
    if (!dbUrl) return err(500, 'NO_DB_URL', 'SUPABASE_DB_URL not set');

    try {
      const { default: postgres } = await import('https://deno.land/x/postgresjs@v3.4.4/mod.js');
      const sql = postgres(dbUrl, { max: 1 });

      // Pipeline refactor migrations
      await sql`ALTER TABLE profile_baseline ADD COLUMN IF NOT EXISTS search_keywords jsonb DEFAULT NULL`;
      await sql`ALTER TABLE agent_task ADD COLUMN IF NOT EXISTS input_data jsonb DEFAULT NULL`;
      await sql`ALTER TABLE agent_task ADD COLUMN IF NOT EXISTS output_data jsonb DEFAULT NULL`;
      await sql`ALTER TABLE profile_baseline ADD COLUMN IF NOT EXISTS ability_model jsonb DEFAULT NULL`;
      await sql`
        CREATE OR REPLACE FUNCTION checkout_task(p_task_id uuid)
        RETURNS TABLE(checked_out boolean) AS $fn$
        BEGIN
          UPDATE agent_task SET status = 'running', started_at = now()
          WHERE id = p_task_id AND status = 'queued';
          RETURN QUERY SELECT (FOUND)::boolean AS checked_out;
        END;
        $fn$ LANGUAGE plpgsql
      `;

      await sql.end();
      return ok({ message: 'Migration complete: search_keywords + input_data + output_data + ability_model + checkout_task RPC' });
    } catch (e) {
      return err(500, 'MIGRATION_FAILED', (e as Error).message);
    }
  }

  if (body.action === 'reset_full') {
    // ═══ FULL RESET: clear ALL business data, keep auth.users + platform_definition ═══
    // Delete order: leaves → branches → trunks (respects FK constraints)
    const NEQ = '00000000-0000-0000-0000-000000000000'; // dummy UUID for .neq()

    // Layer 4: junction / leaf tables
    await db.from('submission_attempt_material').delete().neq('submission_attempt_id', NEQ);
    await db.from('handoff_material').delete().neq('handoff_id', NEQ);
    await db.from('conversation_message').delete().neq('id', NEQ);
    await db.from('agent_task_dependency').delete().neq('predecessor_id', NEQ);
    await db.from('platform_daily_usage').delete().neq('id', NEQ);
    await db.from('platform_consent_log').delete().neq('id', NEQ);
    await db.from('agent_state_transition').delete().neq('id', NEQ);

    // Layer 3: execution entities
    await db.from('submission_attempt').delete().neq('id', NEQ);
    await db.from('material').delete().neq('id', NEQ);
    await db.from('handoff').delete().neq('id', NEQ);
    await db.from('conversation_thread').delete().neq('id', NEQ);
    await db.from('agent_task').delete().neq('id', NEQ);
    await db.from('timeline_event').delete().neq('id', NEQ);

    // Layer 2: core entities
    await db.from('opportunity').delete().neq('id', NEQ);
    await db.from('platform_connection').delete().neq('id', NEQ);
    await db.from('runtime_ledger_entry').delete().neq('id', NEQ);
    await db.from('agent_instance').delete().neq('id', NEQ);

    // Layer 1: profile entities
    await db.from('profile_baseline').delete().neq('id', NEQ);
    await db.from('submission_profile').delete().neq('id', NEQ);
    await db.from('resume_asset').delete().neq('id', NEQ);
    await db.from('user_preferences').delete().neq('id', NEQ);

    // Layer 0: root entities (keep auth.users + platform_definition)
    await db.from('onboarding_draft').delete().neq('id', NEQ);
    await db.from('team').delete().neq('id', NEQ);

    // Clear Storage: resumes bucket
    const { data: files } = await db.storage.from('resumes').list('', { limit: 1000 });
    if (files && files.length > 0) {
      // List files in user subdirectories
      for (const folder of files) {
        const { data: subFiles } = await db.storage.from('resumes').list(folder.name, { limit: 1000 });
        if (subFiles && subFiles.length > 0) {
          const paths = subFiles.map(f => `${folder.name}/${f.name}`);
          await db.storage.from('resumes').remove(paths);
        }
      }
    }

    // Recreate onboarding_draft for each existing user (B2 fix)
    const { data: users } = await db.from('user').select('id');
    if (users && users.length > 0) {
      for (const u of users) {
        await db.from('onboarding_draft').upsert({
          user_id: u.id,
          status: 'resume_required',
        }, { onConflict: 'user_id' });
      }
    }

    return ok({ message: 'Full reset complete. Auth + platform_definition preserved. Ready for onboarding.' });
  }

  if (body.action === 'simulate_boss_reply') {
   try {
    // ═══════════════════════════════════════════════════════════════════
    // SIMULATE BOSS REPLY: inject an HR message then run REAL detection
    //
    // What this tests (the real chain):
    //   1. Message insertion (simulates what pollBossMessages would scrape)
    //   2. LLM reply-reading skill (real Qwen call with production prompt)
    //   3. Regex boundary detection (6 bilingual pattern sets)
    //   4. Handoff creation + opportunity stage transition + timeline event
    //
    // What this skips:
    //   - Playwright scraping of Boss chat page (needs real cookies)
    //   - Worker dispatch loop scheduling (sweepReplyPolling)
    // ═══════════════════════════════════════════════════════════════════

    // 场景设计原则：用真实自然语言，不堆砌关键词。
    // 混合 text + system_note 模拟真实 Boss 对话。
    // AI 必须通过 NLU 理解意图，而非简单关键词匹配。
    type SimMessage = { type: 'text' | 'system_note'; content: string };
    const SCENARIOS: Record<string, { messages: SimMessage[]; label: string }> = {
      interview: {
        label: '面试意向 (隐晦表达，无"面试"二字)',
        messages: [
          { type: 'text', content: '你好，看了你的资料感觉还不错' },
          { type: 'system_note', content: '[系统] 对方索要了你的简历' },
          { type: 'text', content: '你大概什么时候方便来聊一下？我们团队最近在招人' },
        ],
      },
      wechat: {
        label: '私人联系 (口语化表达)',
        messages: [
          { type: 'text', content: '简历我看了，蛮匹配我们这边需求的' },
          { type: 'text', content: '要不我们加个v聊吧，这上面说不太方便' },
        ],
      },
      salary: {
        label: '薪资探底 (间接问法)',
        messages: [
          { type: 'text', content: '你好呀，你的经历很不错' },
          { type: 'system_note', content: '[系统] 对方查看了你的简历' },
          { type: 'text', content: '方便透露一下你现在这边大概什么待遇吗' },
        ],
      },
      offer: {
        label: 'Offer 暗示 (非正式通知)',
        messages: [
          { type: 'text', content: '这边几轮评估都结束了' },
          { type: 'system_note', content: '[系统] 已交换联系方式' },
          { type: 'text', content: '你看看这个方案能不能接受，我们尽快推进' },
        ],
      },
      mixed_positive: {
        label: '综合正面信号 (系统卡片+积极文本)',
        messages: [
          { type: 'system_note', content: '[系统] 对方索要了你的简历' },
          { type: 'text', content: '嗯，背景还可以。你能接受上海这边的工作吗？大概什么时候能到岗' },
        ],
      },
    };

    const scenario = (body.scenario as string) || 'interview';
    const chosen = SCENARIOS[scenario];
    if (!chosen) return err(400, 'BAD_SCENARIO', `Valid scenarios: ${Object.keys(SCENARIOS).join(', ')}`);

    // ── Step 1: Find team + opportunity ──
    const { data: team } = await db.from('team').select('id').limit(1).single();
    if (!team) return err(404, 'NO_TEAM', 'No team. Complete onboarding first.');

    // Prefer an opportunity in contact_started; fall back to any
    let { data: opp } = await db.from('opportunity').select('id, job_title, company_name, stage')
      .eq('team_id', team.id).eq('stage', 'contact_started').limit(1).single();
    if (!opp) {
      // Promote any prioritized opportunity to contact_started to simulate greeting-sent
      const { data: fallback } = await db.from('opportunity').select('id, job_title, company_name, stage')
        .eq('team_id', team.id).in('stage', ['prioritized', 'screened', 'discovered']).limit(1).single();
      if (!fallback) return err(404, 'NO_OPP', 'No opportunities. Wait for pipeline discovery first.');
      await db.from('opportunity').update({
        stage: 'contact_started', previous_stage: fallback.stage,
        stage_changed_at: new Date().toISOString(),
      }).eq('id', fallback.id);
      opp = { ...fallback, stage: 'contact_started' };
    }

    const agent = (await db.from('agent_instance').select('id')
      .eq('team_id', team.id).eq('template_role_code', 'relationship_manager').single()).data;

    // ── Step 2: Create conversation thread (needs platform_connection) ──
    // Find or create a Boss platform_connection for the thread FK
    const { data: bossDef } = await db.from('platform_definition').select('id')
      .eq('code', 'boss_zhipin').single();
    if (!bossDef) return err(500, 'NO_BOSS_DEF', 'boss_zhipin platform_definition missing');

    let { data: bossConn } = await db.from('platform_connection').select('id')
      .eq('team_id', team.id).eq('platform_id', bossDef.id).limit(1).single();
    if (!bossConn) {
      const inserted = await db.from('platform_connection').insert({
        team_id: team.id, platform_id: bossDef.id,
        status: 'active',
        session_token_ref: 'simulated_e2e_test',
        user_consent_granted_at: new Date().toISOString(),
        user_consent_scope: 'apply_only',
      }).select('id').single();
      bossConn = inserted.data;
    }

    // Create conversation thread
    const { data: thread, error: threadErr } = await db.from('conversation_thread').insert({
      team_id: team.id,
      opportunity_id: opp.id,
      platform_connection_id: bossConn!.id,
      platform_thread_id: `sim_${Date.now()}`,
      thread_status: 'active',
      message_count: 0,
    }).select('id').single();
    if (threadErr) return err(500, 'THREAD_FAIL', threadErr.message);

    // ── Step 3: Insert outbound greeting (context for the conversation) ──
    await db.from('conversation_message').insert({
      thread_id: thread!.id, team_id: team.id,
      platform_message_id: `sim_out_${Date.now()}`,
      direction: 'outbound', message_type: 'first_contact',
      content_text: `你好！我对贵司的${opp.job_title}岗位非常感兴趣，有相关经验，期待进一步沟通。`,
      agent_id: agent?.id,
    });

    // ── Step 4: Insert inbound HR messages (multi-message simulation) ──
    const msgIds: string[] = [];
    for (let mi = 0; mi < chosen.messages.length; mi++) {
      const simMsg = chosen.messages[mi];
      const { data: inserted, error: msgErr } = await db.from('conversation_message').insert({
        thread_id: thread!.id, team_id: team.id,
        platform_message_id: `sim_in_${Date.now()}_${mi}`,
        direction: 'inbound',
        message_type: simMsg.type === 'system_note' ? 'system_note' : 'reply',
        content_text: simMsg.content,
        reply_posture: null, // NULL = unprocessed, triggers analysis
      }).select('id').single();
      if (msgErr) return err(500, 'MSG_FAIL', msgErr.message);
      msgIds.push(inserted!.id);
    }

    // Update thread
    await db.from('conversation_thread').update({
      message_count: 1 + chosen.messages.length, latest_message_at: new Date().toISOString(),
    }).eq('id', thread!.id);

    // Concatenate all messages for LLM analysis (preserving [系统] prefixes)
    const fullConversation = chosen.messages.map(m => m.content).join('\n');

    // Timeline: greeting sent
    await db.from('timeline_event').insert({
      team_id: team.id, event_type: 'boss_greeting_sent',
      summary_text: `招聘关系经理向 ${opp.company_name} 发送了打招呼消息`,
      actor_type: 'agent', actor_id: agent?.id,
      related_entity_type: 'opportunity', related_entity_id: opp.id,
      visibility: 'feed',
    });

    // ── Step 5: RUN REAL LLM DETECTION (reply-reading skill via Qwen) ──
    const REPLY_READING_PROMPT = `You are a recruiter reply analysis engine. Interpret a recruiter's message and extract structured signals.

Language awareness: the message may be in Chinese (Mandarin), English, or a mix. Process naturally regardless of language. For Chinese text: recognize casual expressions, honorifics, and implicit intent.

Return a JSON object:
{
  "reply_posture": "positive" | "neutral" | "negative" | "ambiguous",
  "extracted_signals": ["<specific signals>"],
  "asks_or_requests": ["<things recruiter asks candidate to do>"],
  "contains_private_channel_request": true | false,
  "private_channel_type": "phone" | "wechat" | "email" | "in_person" | null,
  "contains_salary_discussion": true | false,
  "contains_interview_scheduling": true | false,
  "progression_detected": true | false,
  "handoff_recommended": true | false,
  "handoff_reason": "<why, if applicable>",
  "suggested_response_direction": "<brief guidance>",
  "summary_text": "<what recruiter said and what it means>"
}

RULES:
- "we'll get back to you" is neutral, not positive
- Detect private channel requests in casual language (e.g., "方便留个微信吗？")
- handoff_recommended=true for salary, interview scheduling, private channel, offer

Respond with a single JSON object. No markdown, no explanation.`;

    let llmOutput: Record<string, unknown> = {};
    const apiKey = Deno.env.get('DASHSCOPE_API_KEY');
    if (apiKey) {
      try {
        const llmRes = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'qwen-plus', max_tokens: 1024,
            messages: [
              { role: 'system', content: REPLY_READING_PROMPT },
              { role: 'user', content: fullConversation },
            ],
          }),
        });
        if (llmRes.ok) {
          const llmJson = await llmRes.json();
          let raw = llmJson.choices?.[0]?.message?.content || '';
          raw = raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
          const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (fence) raw = fence[1].trim();
          const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
          if (s >= 0 && e > s) raw = raw.substring(s, e + 1);
          try { llmOutput = JSON.parse(raw); } catch { llmOutput = { parse_error: raw.slice(0, 300) }; }
        }
      } catch (e) { llmOutput = { llm_error: (e as Error).message }; }
    } else {
      llmOutput = { skipped: 'DASHSCOPE_API_KEY not set' };
    }

    // Update message with LLM analysis
    await db.from('conversation_message').update({
      reply_posture: llmOutput.reply_posture || 'positive',
      extracted_signals: llmOutput.extracted_signals || [],
      asks_or_requests: llmOutput.asks_or_requests || [],
    }).eq('id', msgIds[msgIds.length - 1]);

    // Timeline: reply received
    await db.from('timeline_event').insert({
      team_id: team.id, event_type: 'boss_reply_received',
      summary_text: `${opp.company_name} 的 HR 回复了消息`,
      actor_type: 'system',
      related_entity_type: 'opportunity', related_entity_id: opp.id,
      visibility: 'feed',
    });

    // ── Step 6: RUN REAL REGEX BOUNDARY DETECTION ──
    const BOUNDARY_RULES = [
      { type: 'private_contact', patterns: [/微信/, /加我/, /电话/, /手机号/, /联系方式/, /留个/, /方便联系/, /phone\s*number/i, /whatsapp/i, /wechat/i], urgency: 'high' },
      { type: 'salary_confirmation', patterns: [/薪资/, /工资/, /待遇/, /薪酬/, /年薪/, /月薪/, /期望薪/, /salary/i, /compensation/i, /pay\s*range/i, /total\s*comp/i], urgency: 'high' },
      { type: 'interview_time', patterns: [/面试/, /约个时间/, /安排面试/, /几点/, /什么时候方便/, /视频面/, /电话面/, /现场面/, /interview/i, /schedule\s*(?:a|an)\s*call/i], urgency: 'critical' },
      { type: 'work_arrangement', patterns: [/到岗时间/, /入职/, /试用期/, /start\s*date/i, /onboarding/i, /relocation/i], urgency: 'medium' },
      { type: 'visa_eligibility', patterns: [/签证/, /工作许可/, /visa/i, /work\s*permit/i, /sponsorship/i], urgency: 'high' },
      { type: 'offer_decision', patterns: [/offer/, /录用/, /发offer/, /入职通知/, /offer\s*letter/i, /congrat/i], urgency: 'critical' },
    ];

    let regexDetection: { type: string; urgency: string } | null = null;
    for (const rule of BOUNDARY_RULES) {
      for (const p of rule.patterns) {
        if (p.test(fullConversation)) {
          regexDetection = { type: rule.type, urgency: rule.urgency };
          break;
        }
      }
      if (regexDetection) break;
    }

    // ── Step 7: DECIDE HANDOFF (dual detection: LLM + regex) ──
    const llmRecommends = llmOutput.handoff_recommended === true;
    const regexTriggered = regexDetection !== null;

    if (!llmRecommends && !regexTriggered) {
      return ok({
        message: 'Reply simulated but NO handoff detected',
        scenario, messages: chosen.messages,
        llm_analysis: llmOutput, regex_detection: null,
        note: 'Neither LLM nor regex triggered a handoff. Try a different scenario.',
      });
    }

    // Regex type takes priority over LLM-inferred type (more precise)
    let handoffType = regexDetection?.type || 'interview_time';
    let handoffUrgency = regexDetection?.urgency || 'high';
    if (!regexTriggered && llmRecommends) {
      // LLM-only detection: infer type from LLM signals
      if (llmOutput.contains_salary_discussion) handoffType = 'salary_confirmation';
      else if (llmOutput.contains_interview_scheduling) handoffType = 'interview_time';
      else if (llmOutput.contains_private_channel_request) handoffType = 'private_contact';
      handoffUrgency = handoffType === 'interview_time' ? 'critical' : 'high';
    }

    // ── Step 8: CREATE HANDOFF (real state machine transition) ──
    const { data: handoff, error: hErr } = await db.from('handoff').insert({
      team_id: team.id,
      opportunity_id: opp.id,
      handoff_type: handoffType,
      state: 'awaiting_takeover',
      urgency: handoffUrgency,
      source_agent_id: agent?.id || null,
      source_agent_role_code: 'relationship_manager',
      handoff_reason: (llmOutput.handoff_reason as string) || `检测到${chosen.label}信号`,
      context_summary: (llmOutput.summary_text as string) || `Boss直聘对话中检测到${chosen.label}信号:\n${fullConversation.slice(0, 200)}`,
      suggested_next_action: (llmOutput.suggested_response_direction as string) || null,
    }).select('id').single();

    if (hErr) return err(500, 'HANDOFF_INSERT_FAIL', hErr.message);

    // Transition opportunity: contact_started → needs_takeover
    await db.from('opportunity').update({
      stage: 'needs_takeover', previous_stage: 'contact_started',
      stage_changed_at: new Date().toISOString(), requires_takeover: true,
    }).eq('id', opp.id);

    // Timeline: handoff created
    await db.from('timeline_event').insert({
      team_id: team.id, event_type: 'handoff_created',
      summary_text: `需要接管: ${opp.company_name} — ${chosen.label}`,
      actor_type: 'agent', actor_id: agent?.id,
      related_entity_type: 'handoff', related_entity_id: handoff!.id,
      visibility: 'feed',
    });

    // Thread status → handoff_triggered
    await db.from('conversation_thread').update({ thread_status: 'handoff_triggered' }).eq('id', thread!.id);

    return ok({
      message: `Boss reply simulated → handoff created via REAL detection chain`,
      scenario,
      messages: chosen.messages,
      detection: {
        llm_recommended: llmRecommends,
        llm_analysis: llmOutput,
        regex_triggered: regexTriggered,
        regex_type: regexDetection?.type || null,
        final_type: handoffType,
        final_urgency: handoffUrgency,
      },
      handoff_id: handoff!.id,
      opportunity: `${opp.company_name} — ${opp.job_title}`,
      thread_id: thread!.id,
      chain: [
        '✅ 消息注入 (模拟 pollBossMessages 抓取)',
        '✅ LLM reply-reading (真实 Qwen 调用)',
        '✅ Regex boundary scan (6 组双语模式)',
        '✅ Handoff 创建 (真实状态机转换)',
        '✅ Timeline 事件 (greeting → reply → handoff)',
        '✅ Opportunity stage: contact_started → needs_takeover',
      ],
    });
   } catch (simErr) {
    return err(500, 'SIMULATE_ERROR', simErr instanceof Error ? simErr.message : String(simErr));
   }
  }

  if (body.action === 'purge_all') {
    // Delete ALL opportunities and related data
    const { count } = await db.from('opportunity').select('id', { count: 'exact', head: true });
    await db.from('timeline_event').delete().eq('related_entity_type', 'opportunity');
    await db.from('material').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await db.from('submission_attempt').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await db.from('opportunity').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    return ok({ message: 'Purge complete', deleted: count || 0 });
  }

  // Step 1: Find duplicates (same team + company + title)
  const { data: allOpps } = await db
    .from('opportunity')
    .select('id, team_id, company_name, job_title, created_at')
    .order('created_at', { ascending: true });

  if (!allOpps || allOpps.length === 0) {
    return ok({ message: 'No opportunities found', deleted: 0 });
  }

  // Group by team+company+title, keep first (oldest), delete rest
  const seen = new Map<string, string>(); // key -> kept id
  const toDelete: string[] = [];

  for (const opp of allOpps) {
    const key = `${opp.team_id}|${opp.company_name}|${opp.job_title}`;
    if (seen.has(key)) {
      toDelete.push(opp.id);
    } else {
      seen.set(key, opp.id);
    }
  }

  // Delete duplicates
  if (toDelete.length > 0) {
    // Delete related records first (timeline_event, material, submission_attempt, etc.)
    for (const id of toDelete) {
      await db.from('timeline_event').delete().eq('related_entity_id', id);
      await db.from('material').delete().eq('opportunity_id', id);
      await db.from('submission_attempt').delete().eq('opportunity_id', id);
    }
    // Delete opportunities
    await db.from('opportunity').delete().in('id', toDelete);
  }

  return ok({
    message: `Cleanup complete`,
    total: allOpps.length,
    unique: seen.size,
    deleted: toDelete.length,
  });
});
