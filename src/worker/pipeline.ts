/**
 * Pipeline Orchestrator — Wires skills and executors into the full pipeline
 *
 * Two paths:
 * - full_tailored (global_english): discover → screen → tailor materials → submit
 * - passthrough (china): discover → screen → submit with original resume
 *
 * Source: BACKEND_API_AND_ARCHITECTURE_SPEC.md § Loop A: Opportunity Generation
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { executeSkill } from './skills/runtime.js';
import { discoverGreenhouseJobs, submitGreenhouseApplication } from './executors/greenhouse.js';
import { discoverLeverJobs, submitLeverApplication } from './executors/lever.js';
import { discoverLinkedInJobs, submitLinkedInEasyApply } from './executors/linkedin.js';
import { discoverZhaopinJobs, submitZhaopinApplication } from './executors/zhaopin.js';
import { discoverLagouJobs, submitLagouApplication } from './executors/lagou.js';
import { discoverLiepinJobs, submitLiepinApplication } from './executors/liepin.js';
import { discoverBossJobs, sendBossGreeting } from './executors/boss-zhipin.js';
import { downloadResumeToTemp, cleanupTempFile } from './utils/storage.js';
import { BudgetService } from './services/budget.js';
import { OpportunityStage, PipelineMode } from '../shared/enums.js';
import { validateOpportunityTransition } from '../shared/state-machines.js';

const REC_ZH_MAP: Record<string, string> = {
  advance: '推荐投递', watch: '持续观望', drop: '不匹配放弃', needs_context: '需更多信息',
};

/** Industry → Greenhouse/Lever board tokens mapping
 * IMPORTANT: Lever slugs are verified against https://api.lever.co/v0/postings/{slug}
 * Only include slugs that return 200. Slugs are case-sensitive (lowercase).
 */
const DOMAIN_BOARD_MAP: Record<string, Array<{ token: string; company: string; platform: 'greenhouse' | 'lever' }>> = {
  fintech: [
    { token: 'stripe', company: 'Stripe', platform: 'greenhouse' },
    { token: 'square', company: 'Square', platform: 'greenhouse' },
    { token: 'coinbase', company: 'Coinbase', platform: 'greenhouse' },
    { token: 'revolut', company: 'Revolut', platform: 'greenhouse' },
    { token: 'plaid', company: 'Plaid', platform: 'lever' },
    { token: 'wealthsimple', company: 'Wealthsimple', platform: 'lever' },
  ],
  web3: [
    { token: 'coinbase', company: 'Coinbase', platform: 'greenhouse' },
    { token: 'consensys', company: 'ConsenSys', platform: 'greenhouse' },
    { token: 'uniswaplabs', company: 'Uniswap', platform: 'greenhouse' },
    { token: 'chainalysis', company: 'Chainalysis', platform: 'greenhouse' },
    { token: 'palantir', company: 'Palantir', platform: 'lever' },
  ],
  ai: [
    { token: 'openai', company: 'OpenAI', platform: 'greenhouse' },
    { token: 'anthropic', company: 'Anthropic', platform: 'greenhouse' },
    { token: 'scale', company: 'Scale AI', platform: 'greenhouse' },
    { token: 'databricks', company: 'Databricks', platform: 'greenhouse' },
    { token: 'palantir', company: 'Palantir', platform: 'lever' },
    { token: 'netflix', company: 'Netflix', platform: 'lever' },
  ],
  saas: [
    { token: 'notion', company: 'Notion', platform: 'greenhouse' },
    { token: 'vercel', company: 'Vercel', platform: 'greenhouse' },
    { token: 'supabase', company: 'Supabase', platform: 'greenhouse' },
    { token: 'toptal', company: 'Toptal', platform: 'lever' },
    { token: 'spotify', company: 'Spotify', platform: 'lever' },
    { token: 'lever', company: 'Lever', platform: 'lever' },
  ],
  general: [
    { token: 'netflix', company: 'Netflix', platform: 'lever' },
    { token: 'spotify', company: 'Spotify', platform: 'lever' },
    { token: 'toptal', company: 'Toptal', platform: 'lever' },
    { token: 'notion', company: 'Notion', platform: 'greenhouse' },
    { token: 'stripe', company: 'Stripe', platform: 'greenhouse' },
    { token: 'airbnb', company: 'Airbnb', platform: 'greenhouse' },
    { token: 'datadog', company: 'Datadog', platform: 'greenhouse' },
  ],
};

/** Get board tokens for a team based on profile_baseline.primary_domain */
function getBoardsForDomain(domain: string | null, platformCode: 'greenhouse' | 'lever'): Array<{ token: string; company: string }> {
  const key = domain?.toLowerCase() || 'general';
  const boards = DOMAIN_BOARD_MAP[key] || DOMAIN_BOARD_MAP.general;
  const filtered = boards.filter(b => b.platform === platformCode);
  // Shuffle and take 5 per cycle to avoid always hitting the same boards
  const shuffled = filtered.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 5).map(({ token, company }) => ({ token, company }));
}

/** Record token usage — uses raw SQL for atomic increment to avoid race conditions */
async function recordTokenUsage(
  db: SupabaseClient, teamId: string,
  input: number, output: number,
) {
  if (input === 0 && output === 0) return;
  // Atomic increment — avoids read-then-write race condition
  await db.rpc('increment_token_usage', {
    p_team_id: teamId,
    p_input: input,
    p_output: output,
  }).then(() => {}, () => {
    // Fallback if RPC doesn't exist: non-atomic but won't crash
    db.from('team')
      .select('total_input_tokens, total_output_tokens, total_llm_calls')
      .eq('id', teamId).single().then(({ data: t }) => {
        if (!t) return;
        db.from('team').update({
          total_input_tokens: (t.total_input_tokens || 0) + input,
          total_output_tokens: (t.total_output_tokens || 0) + output,
          total_llm_calls: (t.total_llm_calls || 0) + 1,
        }).eq('id', teamId);
      });
  });
}

export class PipelineOrchestrator {
  private budget: BudgetService;

  constructor(private db: SupabaseClient) {
    this.budget = new BudgetService(db);
  }

  /** Validate and execute a stage transition. Throws on illegal transition. */
  private async transitionOpportunityStage(
    opportunityId: string,
    currentStage: OpportunityStage,
    targetStage: OpportunityStage,
  ): Promise<void> {
    const result = validateOpportunityTransition(currentStage, targetStage);
    if (!result.valid) {
      throw new Error(`Illegal stage transition ${currentStage} → ${targetStage}: ${result.error}`);
    }
    await this.db
      .from('opportunity')
      .update({
        stage: targetStage,
        previous_stage: currentStage,
        stage_changed_at: new Date().toISOString(),
      })
      .eq('id', opportunityId);
  }

  /**
   * Run a full pipeline cycle for a team.
   * Called by the dispatch loop when a discovery task is dispatched.
   */
  async runDiscoveryCycle(teamId: string): Promise<void> {
    // Get team config
    const { data: team } = await this.db
      .from('team')
      .select('id, strategy_mode, coverage_scope')
      .eq('id', teamId)
      .single();

    if (!team) return;

    // Get connected platforms
    const { data: connections } = await this.db
      .from('platform_connection')
      .select('id, platform_id, status')
      .eq('team_id', teamId)
      .eq('status', 'active');

    if (!connections || connections.length === 0) return;

    // Get platform definitions for connected platforms
    const platformIds = connections.map((c: { platform_id: string }) => c.platform_id);
    const { data: platforms } = await this.db
      .from('platform_definition')
      .select('*')
      .in('id', platformIds);

    if (!platforms) return;

    // Run discovery per platform
    for (const platform of platforms) {
      const pipelineMode = platform.pipeline_mode as PipelineMode;

      try {
        switch (platform.code) {
          case 'greenhouse':
            await this.runGreenhouseDiscovery(teamId, platform, pipelineMode);
            break;
          case 'lever':
            await this.runLeverDiscovery(teamId, platform, pipelineMode);
            break;
          case 'linkedin':
            await this.runLinkedInDiscovery(teamId, platform, pipelineMode);
            break;
          case 'zhaopin':
            await this.runChinaPlatformDiscovery(teamId, platform, pipelineMode, 'zhaopin');
            break;
          case 'lagou':
            await this.runChinaPlatformDiscovery(teamId, platform, pipelineMode, 'lagou');
            break;
          case 'liepin':
            await this.runChinaPlatformDiscovery(teamId, platform, pipelineMode, 'liepin');
            break;
          case 'boss_zhipin':
            await this.runBossDiscovery(teamId, platform, pipelineMode);
            break;
        }
      } catch (err) {
        console.error(`[pipeline] Discovery error for ${platform.code}:`, err);
      }
    }
  }

  private async runGreenhouseDiscovery(
    teamId: string,
    platform: Record<string, unknown>,
    pipelineMode: string
  ): Promise<void> {
    // Get boards from profile_baseline.primary_domain
    const { data: baseline } = await this.db
      .from('profile_baseline')
      .select('primary_domain')
      .eq('team_id', teamId)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    const sampleBoards = getBoardsForDomain(baseline?.primary_domain ?? null, 'greenhouse');

    for (const board of sampleBoards) {
      const jobs = await discoverGreenhouseJobs(board.token, board.company, { limit: 10 });

      for (const job of jobs) {
        // Check for duplicates
        const { count } = await this.db
          .from('opportunity')
          .select('id', { count: 'exact', head: true })
          .eq('team_id', teamId)
          .eq('external_ref', job.external_ref);

        if (count && count > 0) continue; // Already discovered

        // Create opportunity
        const { data: opp } = await this.db
          .from('opportunity')
          .insert({
            team_id: teamId,
            stage: OpportunityStage.Discovered,
            company_name: job.company_name,
            job_title: job.job_title,
            location_label: job.location_label,
            job_description_url: job.job_description_url,
            job_description_text: job.job_description_text,
            source_platform_id: platform.id as string,
            external_ref: job.external_ref,
            source_freshness: 'new',
          })
          .select('id')
          .single();

        if (!opp) continue;

        // Run screening pipeline
        await this.runScreeningPipeline(teamId, opp.id, pipelineMode);
      }
    }
  }

  private async runLeverDiscovery(teamId: string, platform: Record<string, unknown>, pipelineMode: string): Promise<void> {
    // Get boards from profile_baseline.primary_domain
    const { data: baseline } = await this.db
      .from('profile_baseline')
      .select('primary_domain')
      .eq('team_id', teamId)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    const sampleCompanies = getBoardsForDomain(baseline?.primary_domain ?? null, 'lever')
      .map(b => ({ slug: b.token, name: b.company }));
    for (const company of sampleCompanies) {
      const jobs = await discoverLeverJobs(company.slug, company.name, { limit: 10 });
      for (const job of jobs) {
        const { count } = await this.db
          .from('opportunity')
          .select('id', { count: 'exact', head: true })
          .eq('team_id', teamId)
          .eq('external_ref', job.external_ref);
        if (count && count > 0) continue;

        const { data: opp } = await this.db
          .from('opportunity')
          .insert({
            team_id: teamId,
            stage: OpportunityStage.Discovered,
            company_name: job.company_name,
            job_title: job.job_title,
            location_label: job.location_label,
            job_description_url: job.job_description_url,
            job_description_text: job.job_description_text,
            source_platform_id: platform.id as string,
            external_ref: job.external_ref,
            source_freshness: 'new',
          })
          .select('id')
          .single();

        if (opp) await this.runScreeningPipeline(teamId, opp.id, pipelineMode);
      }
    }
  }

  private async runLinkedInDiscovery(teamId: string, platform: Record<string, unknown>, pipelineMode: string): Promise<void> {
    // Get session cookies
    const { data: conn } = await this.db
      .from('platform_connection')
      .select('session_token_ref')
      .eq('team_id', teamId)
      .eq('platform_id', platform.id as string)
      .eq('status', 'active')
      .single();

    if (!conn?.session_token_ref) return;

    // Get user's target roles for keywords
    const { data: prefs } = await this.db
      .from('user_preferences')
      .select('preferred_locations')
      .eq('team_id', teamId)
      .single();

    const { data: teamUser } = await this.db.from('team').select('user_id').eq('id', teamId).single();
    const { data: draft } = await this.db
      .from('onboarding_draft')
      .select('answered_fields')
      .eq('user_id', teamUser?.user_id)
      .single();

    const answeredFields = (draft?.answered_fields as Record<string, unknown>) || {};
    const rawRoles = answeredFields.target_roles;
    const keywords: string[] = Array.isArray(rawRoles) ? rawRoles
      : typeof rawRoles === 'string' ? rawRoles.split(',').map((k: string) => k.trim()).filter(Boolean)
      : ['software engineer'];
    const locations = (answeredFields.target_locations as string) || (prefs?.preferred_locations as string) || '';
    const locationFirst = locations.split(',')[0]?.trim() || undefined;

    const jobs = await discoverLinkedInJobs({
      sessionCookies: conn.session_token_ref,
      keywords,
      location: locationFirst,
      limit: 10,
    });

    for (const job of jobs) {
      const { count } = await this.db
        .from('opportunity')
        .select('id', { count: 'exact', head: true })
        .eq('team_id', teamId)
        .eq('external_ref', job.external_ref);
      if (count && count > 0) continue;

      const { data: opp } = await this.db
        .from('opportunity')
        .insert({
          team_id: teamId,
          stage: OpportunityStage.Discovered,
          company_name: job.company_name,
          job_title: job.job_title,
          location_label: job.location_label,
          job_description_url: job.job_description_url,
          job_description_text: job.job_description_text,
          source_platform_id: platform.id as string,
          external_ref: job.external_ref,
          source_freshness: 'new',
        })
        .select('id')
        .single();

      if (opp) await this.runScreeningPipeline(teamId, opp.id, pipelineMode);
    }
  }

  private async runChinaPlatformDiscovery(
    teamId: string,
    platform: Record<string, unknown>,
    pipelineMode: string,
    platformCode: string
  ): Promise<void> {
    // Get session cookies
    const { data: conn } = await this.db
      .from('platform_connection')
      .select('session_token_ref')
      .eq('team_id', teamId)
      .eq('platform_id', platform.id as string)
      .eq('status', 'active')
      .single();

    if (!conn?.session_token_ref) return;

    // Get keywords from onboarding answers
    const { data: team } = await this.db.from('team').select('user_id').eq('id', teamId).single();
    const { data: draft } = await this.db
      .from('onboarding_draft')
      .select('answered_fields')
      .eq('user_id', team?.user_id)
      .single();

    const keywords = ((draft?.answered_fields as Record<string, unknown>)?.target_roles as string) || '软件工程师';
    const keywordList = typeof keywords === 'string' ? keywords.split(',').map((k: string) => k.trim()) : [keywords];

    let jobs: Array<{ job_title: string; company_name: string; location_label: string; job_description_url: string; job_description_text: string; external_ref: string }> = [];

    if (platformCode === 'zhaopin') {
      jobs = await discoverZhaopinJobs({ sessionCookies: conn.session_token_ref, keywords: keywordList, limit: 10 });
    } else if (platformCode === 'lagou') {
      jobs = await discoverLagouJobs({ sessionCookies: conn.session_token_ref, keywords: keywordList, limit: 10 });
    } else if (platformCode === 'liepin') {
      jobs = await discoverLiepinJobs({ sessionCookies: conn.session_token_ref, keywords: keywordList, limit: 10 });
    }

    for (const job of jobs) {
      const { count } = await this.db
        .from('opportunity')
        .select('id', { count: 'exact', head: true })
        .eq('team_id', teamId)
        .eq('external_ref', job.external_ref);
      if (count && count > 0) continue;

      const { data: opp } = await this.db
        .from('opportunity')
        .insert({
          team_id: teamId,
          stage: OpportunityStage.Discovered,
          company_name: job.company_name,
          job_title: job.job_title,
          location_label: job.location_label,
          job_description_url: job.job_description_url,
          job_description_text: job.job_description_text,
          source_platform_id: platform.id as string,
          external_ref: job.external_ref,
          source_freshness: 'new',
        })
        .select('id')
        .single();

      // Passthrough pipeline: screen → submit directly (no materials)
      if (opp) await this.runScreeningPipeline(teamId, opp.id, pipelineMode);
    }
  }

  /**
   * Boss直聘 Discovery — separate path because Boss uses chat_initiate, not browser_form.
   * After screening, advance → runFirstContact (greeting) instead of runSubmission.
   */
  private async runBossDiscovery(
    teamId: string,
    platform: Record<string, unknown>,
    pipelineMode: string
  ): Promise<void> {
    // Get session cookies
    const { data: conn } = await this.db
      .from('platform_connection')
      .select('session_token_ref')
      .eq('team_id', teamId)
      .eq('platform_id', platform.id as string)
      .eq('status', 'active')
      .single();

    if (!conn?.session_token_ref) return;

    // Get keywords from onboarding
    const { data: team } = await this.db.from('team').select('user_id').eq('id', teamId).single();
    const { data: draft } = await this.db
      .from('onboarding_draft')
      .select('answered_fields')
      .eq('user_id', team?.user_id)
      .single();

    const keywords = ((draft?.answered_fields as Record<string, unknown>)?.target_roles as string) || '软件工程师';
    const keywordList = typeof keywords === 'string' ? keywords.split(',').map((k: string) => k.trim()) : [keywords];

    const jobs = await discoverBossJobs({ sessionCookies: conn.session_token_ref, keywords: keywordList, limit: 10 });

    for (const job of jobs) {
      const { count } = await this.db
        .from('opportunity')
        .select('id', { count: 'exact', head: true })
        .eq('team_id', teamId)
        .eq('external_ref', job.external_ref);
      if (count && count > 0) continue;

      const { data: opp } = await this.db
        .from('opportunity')
        .insert({
          team_id: teamId,
          stage: OpportunityStage.Discovered,
          company_name: job.company_name,
          job_title: job.job_title,
          location_label: job.location_label,
          job_description_url: job.job_description_url,
          job_description_text: job.job_description_text,
          source_platform_id: platform.id as string,
          external_ref: job.external_ref,
          source_freshness: 'new',
        })
        .select('id')
        .single();

      // Boss pipeline: screen → greeting (not submit)
      if (opp) await this.runBossScreeningPipeline(teamId, opp.id, platform.id as string);
    }
  }

  /**
   * Boss-specific screening pipeline.
   * Same screening logic, but advance → runFirstContact instead of runSubmission.
   */
  private async runBossScreeningPipeline(
    teamId: string,
    opportunityId: string,
    platformId: string
  ): Promise<void> {
    // Run standard screening (fit + conflict + recommendation)
    await this.runScreeningPipeline(teamId, opportunityId, PipelineMode.Passthrough);

    // Check if recommendation was advance → send greeting
    const { data: opp } = await this.db
      .from('opportunity')
      .select('recommendation, stage, job_title, company_name, job_description_url, job_description_text, source_platform_id')
      .eq('id', opportunityId)
      .single();

    if (opp?.recommendation === 'advance' && opp.stage === OpportunityStage.Prioritized) {
      await this.runFirstContact(teamId, opportunityId, opp);
    }
  }

  /**
   * Boss直聘 First Contact — send greeting message (打招呼).
   * This replaces runSubmission for Boss. Stage: prioritized → contact_started.
   */
  private async runFirstContact(
    teamId: string,
    opportunityId: string,
    opportunity: Record<string, unknown>
  ): Promise<void> {
    // Get connection
    const { data: connection } = await this.db
      .from('platform_connection')
      .select('id, session_token_ref')
      .eq('team_id', teamId)
      .eq('platform_id', opportunity.source_platform_id as string)
      .eq('status', 'active')
      .single();

    if (!connection?.session_token_ref) return;

    // Budget check (greetings count as 'application' in budget)
    const budgetAllowed = await this.budget.canPerformAction(connection.id, teamId, 'boss_zhipin', 'application');
    if (!budgetAllowed) {
      console.log('[pipeline] Daily greeting budget exhausted for boss_zhipin');
      await this.db.from('timeline_event').insert({
        team_id: teamId,
        event_type: 'budget_exhausted',
        summary_text: '今日打招呼次数已用完 (Boss直聘)',
        actor_type: 'system',
        related_entity_type: 'opportunity',
        related_entity_id: opportunityId,
        visibility: 'feed',
      });
      return;
    }

    // Compose greeting message via skill
    const greetResult = await executeSkill('boss-greeting-compose', {
      opportunity: {
        job_title: opportunity.job_title,
        company_name: opportunity.company_name,
        job_description_text: opportunity.job_description_text,
      },
    });

    const greetingText = greetResult.success
      ? ((greetResult.output as { greeting_text?: string }).greeting_text || `您好，我对贵司的「${opportunity.job_title}」岗位很感兴趣，希望能进一步了解。`)
      : `您好，我对贵司的「${opportunity.job_title}」岗位很感兴趣，希望能进一步了解。`;

    if (greetResult.success) {
      await recordTokenUsage(this.db, teamId, greetResult.tokens_used.input, greetResult.tokens_used.output);
    }

    // Send greeting
    const result = await sendBossGreeting({
      sessionCookies: connection.session_token_ref,
      jobDetailUrl: (opportunity.job_description_url as string) || '',
      greetingText,
    });

    // Record budget usage on success
    if (result.outcome === 'success') {
      await this.budget.recordAction(connection.id, teamId, 'boss_zhipin', 'application');

      // Create conversation thread
      await this.db.from('conversation_thread').insert({
        team_id: teamId,
        opportunity_id: opportunityId,
        platform_connection_id: connection.id,
        thread_status: 'active',
        message_count: 1,
        latest_message_at: new Date().toISOString(),
      });

      // Transition: prioritized → contact_started
      await this.transitionOpportunityStage(opportunityId, OpportunityStage.Prioritized, OpportunityStage.ContactStarted);

      await this.db.from('timeline_event').insert({
        team_id: teamId,
        event_type: 'boss_greeting_sent',
        summary_text: `已向 ${opportunity.company_name} 发送打招呼消息「${opportunity.job_title}」`,
        actor_type: 'agent',
        related_entity_type: 'opportunity',
        related_entity_id: opportunityId,
        visibility: 'feed',
      });
    } else {
      console.error(`[pipeline] Boss greeting failed for ${opportunity.company_name}: ${result.errorMessage}`);

      await this.db.from('timeline_event').insert({
        team_id: teamId,
        event_type: 'boss_greeting_failed',
        summary_text: `打招呼失败: ${opportunity.company_name}「${opportunity.job_title}」— ${result.errorMessage}`,
        actor_type: 'system',
        related_entity_type: 'opportunity',
        related_entity_id: opportunityId,
        visibility: 'feed',
      });
    }
  }

  /**
   * Screen an opportunity: fit evaluation → conflict detection → recommendation
   */
  async runScreeningPipeline(teamId: string, opportunityId: string, pipelineMode: string): Promise<void> {
    // Load data
    const { data: opp } = await this.db
      .from('opportunity')
      .select('*')
      .eq('id', opportunityId)
      .single();

    const { data: baseline } = await this.db
      .from('profile_baseline')
      .select('*')
      .eq('team_id', teamId)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    const { data: prefs } = await this.db
      .from('user_preferences')
      .select('*')
      .eq('team_id', teamId)
      .single();

    if (!opp || !baseline) return;

    // Step 1: Fit evaluation
    const fitResult = await executeSkill('fit-evaluation', {
      profile_baseline: baseline,
      opportunity: { job_title: opp.job_title, company_name: opp.company_name, location_label: opp.location_label, job_description_text: opp.job_description_text },
      user_preferences: prefs || {},
    });
    if (fitResult.success) await recordTokenUsage(this.db, teamId, fitResult.tokens_used.input, fitResult.tokens_used.output);

    if (fitResult.success) {
      await this.transitionOpportunityStage(opportunityId, OpportunityStage.Discovered, OpportunityStage.Screened);
      await this.db
        .from('opportunity')
        .update({
          fit_posture: mapFitPosture(fitResult.output.fit_posture as string),
          fit_reason_tags: fitResult.output.fit_reason_tags,
        })
        .eq('id', opportunityId);
    }

    // Step 2: Conflict detection (skip if fit evaluation failed)
    if (!fitResult.success) {
      console.log(`[pipeline] Fit evaluation failed for ${opp.job_title}, skipping remaining screening`);
      return;
    }

    const conflictResult = await executeSkill('conflict-detection', {
      profile_baseline: baseline,
      opportunity: { job_title: opp.job_title, company_name: opp.company_name, location_label: opp.location_label, job_description_text: opp.job_description_text },
      user_preferences: prefs || {},
    });
    if (conflictResult.success) await recordTokenUsage(this.db, teamId, conflictResult.tokens_used.input, conflictResult.tokens_used.output);

    // Step 3: Recommendation
    const { data: team } = await this.db.from('team').select('strategy_mode').eq('id', teamId).single();

    const recResult = await executeSkill('recommendation-generation', {
      fit_evaluation: fitResult.output,
      conflict_detection: conflictResult.success ? conflictResult.output : {},
      opportunity: { job_title: opp.job_title, company_name: opp.company_name },
      strategy_mode: team?.strategy_mode || 'balanced',
    });

    if (recResult.success) await recordTokenUsage(this.db, teamId, recResult.tokens_used.input, recResult.tokens_used.output);

    if (recResult.success) {
      const rec = recResult.output as { recommendation: string; recommendation_reason_tags: string[]; next_step_hint: string };

      await this.transitionOpportunityStage(opportunityId, OpportunityStage.Screened, OpportunityStage.Prioritized);
      await this.db
        .from('opportunity')
        .update({
          recommendation: rec.recommendation,
          recommendation_reason_tags: rec.recommendation_reason_tags,
          recommendation_next_step_hint: rec.next_step_hint,
        })
        .eq('id', opportunityId);

      // If advance → continue to materials or submission
      if (rec.recommendation === 'advance') {
        if (pipelineMode === PipelineMode.FullTailored) {
          await this.runMaterialPipeline(teamId, opportunityId, baseline, opp, fitResult.output);
        } else {
          // Passthrough: skip materials, go straight to submission
          await this.runSubmission(teamId, opportunityId, opp);
        }
      }
    }

    // Create timeline event
    await this.db.from('timeline_event').insert({
      team_id: teamId,
      event_type: 'opportunity_screened',
      summary_text: `已筛选 ${opp.company_name} 的「${opp.job_title}」— ${recResult.success ? REC_ZH_MAP[(recResult.output as { recommendation: string }).recommendation] || (recResult.output as { recommendation: string }).recommendation : '未知'}`,
      actor_type: 'agent',
      related_entity_type: 'opportunity',
      related_entity_id: opportunityId,
      visibility: 'feed',
    });
  }

  /**
   * Assemble source resume text from ProfileBaseline structured data.
   * Used by truthful-rewrite skill as the raw material for tailoring.
   */
  private assembleResumeText(baseline: Record<string, unknown>): string {
    const parts: string[] = [];

    if (baseline.headline_summary) parts.push(baseline.headline_summary as string);

    // Parse JSONB fields — they may be strings or arrays depending on how they were stored
    const parseJsonField = (val: unknown): Array<Record<string, unknown>> => {
      if (Array.isArray(val)) return val;
      if (typeof val === 'string') { try { return JSON.parse(val); } catch { return []; } }
      return [];
    };

    const experiences = parseJsonField(baseline.experiences);
    if (experiences.length > 0) {
      parts.push('\n--- Experience ---');
      for (const exp of experiences) {
        const dateRange = [exp.start_date, exp.is_current ? 'Present' : exp.end_date].filter(Boolean).join(' - ');
        parts.push(`${exp.job_title} at ${exp.company_name} (${dateRange})`);
        if (exp.location) parts.push(`Location: ${exp.location}`);
        if (exp.description_summary) parts.push(exp.description_summary as string);
        const achievements = parseJsonField(exp.key_achievements) as unknown as string[];
        for (const a of achievements) parts.push(`• ${a}`);
        parts.push('');
      }
    }

    const education = parseJsonField(baseline.education);
    if (education.length > 0) {
      parts.push('--- Education ---');
      for (const edu of education) {
        parts.push(`${edu.degree || ''} ${edu.field_of_study || ''} — ${edu.institution}`.trim());
      }
    }

    const rawSkills = baseline.skills;
    const skills: string[] = Array.isArray(rawSkills) ? rawSkills :
      (typeof rawSkills === 'string' ? (() => { try { return JSON.parse(rawSkills); } catch { return []; } })() : []);
    if (skills.length > 0) {
      parts.push('\n--- Skills ---');
      parts.push(skills.join(', '));
    }

    return parts.join('\n').trim();
  }

  /**
   * Material pipeline: tailor resume → generate cover letter (full_tailored only)
   */
  async runMaterialPipeline(
    teamId: string,
    opportunityId: string,
    baseline: Record<string, unknown>,
    opportunity: Record<string, unknown>,
    fitEvaluation: Record<string, unknown> = {},
  ): Promise<void> {
    // Assemble source resume text from parsed profile data
    const sourceResumeText = this.assembleResumeText(baseline);
    let materialsCreated = 0;

    // Tailor resume
    const tailorResult = await executeSkill('truthful-rewrite', {
      profile_baseline: baseline,
      opportunity: { job_title: opportunity.job_title, company_name: opportunity.company_name, job_description_text: opportunity.job_description_text },
      source_resume_text: sourceResumeText,
      target_language: (baseline.source_language as string) || 'en',
    });
    if (tailorResult.success) await recordTokenUsage(this.db, teamId, tailorResult.tokens_used.input, tailorResult.tokens_used.output);

    if (tailorResult.success) {
      await this.db.from('material').insert({
        team_id: teamId,
        opportunity_id: opportunityId,
        material_type: 'standard_tailored_resume',
        status: 'ready',
        language: (baseline.source_language as string) || 'en',
        content_text: JSON.stringify(tailorResult.output),
        source_profile_baseline_id: baseline.id as string,
      });
      materialsCreated++;
    } else {
      console.error(`[pipeline] truthful-rewrite failed for opp ${opportunityId}: ${tailorResult.error}`);
    }

    // Generate cover letter — pass real fit evaluation from screening
    const coverResult = await executeSkill('cover-letter-generation', {
      profile_baseline: baseline,
      opportunity: { job_title: opportunity.job_title, company_name: opportunity.company_name, company_summary: opportunity.company_summary, job_description_text: opportunity.job_description_text },
      fit_evaluation: fitEvaluation,
      target_language: (baseline.source_language as string) || 'en',
    });
    if (coverResult.success) await recordTokenUsage(this.db, teamId, coverResult.tokens_used.input, coverResult.tokens_used.output);

    if (coverResult.success) {
      await this.db.from('material').insert({
        team_id: teamId,
        opportunity_id: opportunityId,
        material_type: 'cover_letter',
        status: 'ready',
        language: (baseline.source_language as string) || 'en',
        content_text: (coverResult.output as { full_text?: string }).full_text || JSON.stringify(coverResult.output),
        source_profile_baseline_id: baseline.id as string,
      });
      materialsCreated++;
    } else {
      console.error(`[pipeline] cover-letter-generation failed for opp ${opportunityId}: ${coverResult.error}`);
    }

    // Advance if at least resume was created (1/2 is enough per V1 decision)
    if (materialsCreated < 1) {
      console.error(`[pipeline] Material pipeline failed for opp ${opportunityId}: 0 materials created`);
      return;
    }

    await this.transitionOpportunityStage(opportunityId, OpportunityStage.Prioritized, OpportunityStage.MaterialReady);

    // Proceed to submission
    await this.runSubmission(teamId, opportunityId, opportunity);
  }

  /**
   * Submit application via platform executor.
   * Routes to the correct executor based on platform_definition.code.
   */
  async runSubmission(
    teamId: string,
    opportunityId: string,
    opportunity: Record<string, unknown>
  ): Promise<void> {
    // Get profile for applicant info
    const { data: profile } = await this.db
      .from('submission_profile')
      .select('*')
      .eq('team_id', teamId)
      .single();

    const { data: baseline } = await this.db
      .from('profile_baseline')
      .select('full_name, contact_email, contact_phone')
      .eq('team_id', teamId)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    // Get platform definition for routing
    const { data: platformDef } = await this.db
      .from('platform_definition')
      .select('id, code')
      .eq('id', opportunity.source_platform_id as string)
      .single();

    // Get platform connection
    const { data: connection } = await this.db
      .from('platform_connection')
      .select('id, session_token_ref')
      .eq('team_id', teamId)
      .eq('platform_id', opportunity.source_platform_id as string)
      .eq('status', 'active')
      .single();

    if (!connection) {
      console.log(`[pipeline] No active connection for platform, skipping submission`);
      return;
    }

    // Check daily budget before proceeding
    const platformCode = platformDef?.code || 'unknown';
    const budgetAllowed = await this.budget.canPerformAction(connection.id, teamId, platformCode, 'application');
    if (!budgetAllowed) {
      console.log(`[pipeline] Daily budget exhausted for ${platformCode}, skipping submission`);
      await this.db.from('timeline_event').insert({
        team_id: teamId,
        event_type: 'budget_exhausted',
        summary_text: `今日投递次数已用完 (${platformCode})`,
        actor_type: 'system',
        related_entity_type: 'opportunity',
        related_entity_id: opportunityId,
        visibility: 'feed',
      });
      return;
    }

    // Get resume file info — resume_asset uses user_id, not team_id
    const { data: teamForUser } = await this.db.from('team').select('user_id').eq('id', teamId).single();
    const { data: resumeAsset } = await this.db
      .from('resume_asset')
      .select('storage_path, file_name')
      .eq('user_id', teamForUser?.user_id)
      .eq('is_primary', true)
      .single();

    // Get cover letter if it was generated (full_tailored)
    const { data: coverLetterMat } = await this.db
      .from('material')
      .select('content_text')
      .eq('team_id', teamId)
      .eq('opportunity_id', opportunityId)
      .eq('material_type', 'cover_letter')
      .eq('status', 'ready')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Download resume to temp file for Playwright upload
    let resumeLocalPath = '';
    if (resumeAsset) {
      resumeLocalPath = await downloadResumeToTemp(this.db, resumeAsset.storage_path, resumeAsset.file_name);
    }

    try {
      // Route to correct executor based on platform code
      const platformCode = platformDef?.code || 'greenhouse';
      let result: { outcome: string; confirmationSignal?: string; errorMessage?: string };

      switch (platformCode) {
        case 'greenhouse':
          result = await submitGreenhouseApplication({
            jobUrl: (opportunity.job_description_url as string) || '',
            applicantName: (baseline?.full_name as string) || 'Unknown',
            applicantEmail: (profile?.contact_email as string) || (baseline?.contact_email as string) || '',
            applicantPhone: (profile?.phone as string) || (baseline?.contact_phone as string) || '',
            resumeLocalPath,
            coverLetterText: coverLetterMat?.content_text || undefined,
          });
          break;

        case 'lever':
          result = await submitLeverApplication({
            jobUrl: (opportunity.job_description_url as string) || '',
            applicantName: (baseline?.full_name as string) || 'Unknown',
            applicantEmail: (profile?.contact_email as string) || (baseline?.contact_email as string) || '',
            resumeLocalPath,
            coverLetterText: coverLetterMat?.content_text || undefined,
          });
          break;

        case 'linkedin':
          result = await submitLinkedInEasyApply({
            jobUrl: (opportunity.job_description_url as string) || '',
            sessionCookies: connection.session_token_ref || '',
            resumeLocalPath,
          });
          break;

        case 'zhaopin':
          result = await submitZhaopinApplication({
            jobUrl: (opportunity.job_description_url as string) || '',
            sessionCookies: connection.session_token_ref || '',
          });
          break;

        case 'lagou':
          result = await submitLagouApplication({
            jobUrl: (opportunity.job_description_url as string) || '',
            sessionCookies: connection.session_token_ref || '',
          });
          break;

        case 'liepin':
          result = await submitLiepinApplication({
            jobUrl: (opportunity.job_description_url as string) || '',
            sessionCookies: connection.session_token_ref || '',
          });
          break;

        default:
          console.log(`[pipeline] No executor for platform ${platformCode}`);
          return;
      }

      // Get attempt number (increment from previous attempts for this opportunity)
      const { count: prevAttempts } = await this.db
        .from('submission_attempt')
        .select('id', { count: 'exact', head: true })
        .eq('opportunity_id', opportunityId);

      // Record submission attempt
      await this.db.from('submission_attempt').insert({
        team_id: teamId,
        opportunity_id: opportunityId,
        platform_connection_id: connection.id,
        attempt_number: (prevAttempts ?? 0) + 1,
        execution_outcome: result.outcome === 'success' ? 'submitted' : 'failed',
        platform_response_hint: result.confirmationSignal || result.errorMessage,
      });

      // Record budget usage on successful submission
      if (result.outcome === 'success') {
        await this.budget.recordAction(connection.id, teamId, platformCode, 'application');
      }

      // Update opportunity stage
      if (result.outcome === 'success') {
        await this.transitionOpportunityStage(
          opportunityId,
          opportunity.stage as OpportunityStage,
          OpportunityStage.Submitted,
        );
      }

      // Timeline event
      await this.db.from('timeline_event').insert({
        team_id: teamId,
        event_type: result.outcome === 'success' ? 'submission_success' : 'submission_failed',
        summary_text: `${result.outcome === 'success' ? '成功投递' : '投递失败'} ${opportunity.company_name} 的「${opportunity.job_title}」`,
        actor_type: 'agent',
        related_entity_type: 'opportunity',
        related_entity_id: opportunityId,
        visibility: 'feed',
      });

    } finally {
      // Clean up temp resume file
      if (resumeLocalPath) {
        await cleanupTempFile(resumeLocalPath).catch(() => {});
      }
    }
  }
}

function mapFitPosture(raw: string): string {
  const map: Record<string, string> = {
    strong_fit: 'strong',
    moderate_fit: 'moderate',
    weak_fit: 'weak',
    misaligned: 'uncertain',
  };
  return map[raw] || 'uncertain';
}
