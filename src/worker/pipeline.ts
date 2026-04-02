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
import { OpportunityStage, PipelineMode } from '../shared/enums.js';

export class PipelineOrchestrator {
  constructor(private db: SupabaseClient) {}

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
    // For Greenhouse, discover from known boards
    // In production: boards are configured per user's target companies
    // M5 stub: use a sample board
    const sampleBoards = [
      { token: 'example', company: 'Example Corp' },
    ];

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
    // Lever uses the same pattern as Greenhouse but with Lever Postings API
    const sampleCompanies = [{ slug: 'example', name: 'Example Corp' }];
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

    const { data: draft } = await this.db
      .from('onboarding_draft')
      .select('answered_fields')
      .eq('team_id', (await this.db.from('team').select('user_id').eq('id', teamId).single()).data?.user_id)
      .single();

    const keywords = (draft?.answered_fields as Record<string, unknown>)?.target_roles as string[] || ['software engineer'];

    const jobs = await discoverLinkedInJobs({
      sessionCookies: conn.session_token_ref,
      keywords,
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

    if (fitResult.success) {
      await this.db
        .from('opportunity')
        .update({
          fit_posture: mapFitPosture(fitResult.output.fit_posture as string),
          fit_reason_tags: fitResult.output.fit_reason_tags,
          stage: OpportunityStage.Screened,
          previous_stage: OpportunityStage.Discovered,
          stage_changed_at: new Date().toISOString(),
        })
        .eq('id', opportunityId);
    }

    // Step 2: Conflict detection
    const conflictResult = await executeSkill('conflict-detection', {
      profile_baseline: baseline,
      opportunity: { job_title: opp.job_title, company_name: opp.company_name, location_label: opp.location_label, job_description_text: opp.job_description_text },
      user_preferences: prefs || {},
    });

    // Step 3: Recommendation
    const { data: team } = await this.db.from('team').select('strategy_mode').eq('id', teamId).single();

    const recResult = await executeSkill('recommendation-generation', {
      fit_evaluation: fitResult.success ? fitResult.output : {},
      conflict_detection: conflictResult.success ? conflictResult.output : {},
      opportunity: { job_title: opp.job_title, company_name: opp.company_name },
      strategy_mode: team?.strategy_mode || 'balanced',
    });

    if (recResult.success) {
      const rec = recResult.output as { recommendation: string; recommendation_reason_tags: string[]; next_step_hint: string };

      await this.db
        .from('opportunity')
        .update({
          recommendation: rec.recommendation,
          recommendation_reason_tags: rec.recommendation_reason_tags,
          recommendation_next_step_hint: rec.next_step_hint,
          stage: OpportunityStage.Prioritized,
          previous_stage: OpportunityStage.Screened,
          stage_changed_at: new Date().toISOString(),
        })
        .eq('id', opportunityId);

      // If advance → continue to materials or submission
      if (rec.recommendation === 'advance') {
        if (pipelineMode === PipelineMode.FullTailored) {
          await this.runMaterialPipeline(teamId, opportunityId, baseline, opp);
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
      summary_text: `Screened ${opp.job_title} at ${opp.company_name}: ${recResult.success ? (recResult.output as { recommendation: string }).recommendation : 'unknown'}`,
      actor_type: 'agent',
      related_entity_type: 'opportunity',
      related_entity_id: opportunityId,
      visibility: 'feed',
    });
  }

  /**
   * Material pipeline: tailor resume → generate cover letter (full_tailored only)
   */
  private async runMaterialPipeline(
    teamId: string,
    opportunityId: string,
    baseline: Record<string, unknown>,
    opportunity: Record<string, unknown>
  ): Promise<void> {
    // Tailor resume
    const tailorResult = await executeSkill('truthful-rewrite', {
      profile_baseline: baseline,
      opportunity: { job_title: opportunity.job_title, company_name: opportunity.company_name, job_description_text: opportunity.job_description_text },
      source_resume_text: '', // Would be assembled from parsed sections
      target_language: (baseline.source_language as string) || 'en',
    });

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
    }

    // Generate cover letter
    const coverResult = await executeSkill('cover-letter-generation', {
      profile_baseline: baseline,
      opportunity: { job_title: opportunity.job_title, company_name: opportunity.company_name, company_summary: opportunity.company_summary, job_description_text: opportunity.job_description_text },
      fit_evaluation: {}, // Would be the actual fit result
      target_language: (baseline.source_language as string) || 'en',
    });

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
    }

    // Update opportunity stage
    await this.db
      .from('opportunity')
      .update({
        stage: OpportunityStage.MaterialReady,
        previous_stage: OpportunityStage.Prioritized,
        stage_changed_at: new Date().toISOString(),
      })
      .eq('id', opportunityId);

    // Proceed to submission
    await this.runSubmission(teamId, opportunityId, opportunity);
  }

  /**
   * Submit application via platform executor
   */
  private async runSubmission(
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
      .select('full_name, contact_email')
      .eq('team_id', teamId)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    // Get platform connection
    const { data: connection } = await this.db
      .from('platform_connection')
      .select('id')
      .eq('team_id', teamId)
      .eq('platform_id', opportunity.source_platform_id as string)
      .eq('status', 'active')
      .single();

    if (!connection) {
      console.log(`[pipeline] No active connection for platform, skipping submission`);
      return;
    }

    // Execute submission (stub in M5)
    const result = await submitGreenhouseApplication({
      jobUrl: (opportunity.job_description_url as string) || '',
      applicantName: (baseline?.full_name as string) || 'Unknown',
      applicantEmail: (profile?.contact_email as string) || (baseline?.contact_email as string) || '',
      resumeStoragePath: '', // Would be actual storage path
    });

    // Record submission attempt
    await this.db.from('submission_attempt').insert({
      team_id: teamId,
      opportunity_id: opportunityId,
      platform_connection_id: connection.id,
      execution_outcome: result.outcome === 'success' ? 'submitted' : 'failed',
      platform_response_hint: result.confirmationSignal || result.errorMessage,
    });

    // Update opportunity stage
    if (result.outcome === 'success') {
      await this.db
        .from('opportunity')
        .update({
          stage: OpportunityStage.Submitted,
          previous_stage: opportunity.stage as string,
          stage_changed_at: new Date().toISOString(),
        })
        .eq('id', opportunityId);
    }

    // Timeline event
    await this.db.from('timeline_event').insert({
      team_id: teamId,
      event_type: result.outcome === 'success' ? 'submission_success' : 'submission_failed',
      summary_text: `${result.outcome === 'success' ? 'Applied to' : 'Failed to apply to'} ${opportunity.job_title} at ${opportunity.company_name}`,
      actor_type: 'agent',
      related_entity_type: 'opportunity',
      related_entity_id: opportunityId,
      visibility: 'feed',
    });
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
