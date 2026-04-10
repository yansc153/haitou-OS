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

/**
 * Search keywords are now AI-generated from the user's resume.
 * Stored in profile_baseline.search_keywords as JSONB.
 * See: KEYWORD_EXTRACTION_REDESIGN.md § 七 因果链
 */
type SearchKeywords = {
  en_keywords: string[];
  zh_keywords: string[];
  target_companies: string[];
  primary_domain: string;
  seniority_bracket: string;
  job_directions: Array<{ zh: string; en: string }>;
};

/**
 * Simplify a keyword for broader search results.
 * "Senior Blockchain Protocol Engineer" → "blockchain protocol"
 * "区块链协议工程师" → "区块链"
 * "首席Substrate核心开发工程师" → "Substrate 开发"
 */
function simplifyKeyword(kw: string): string {
  // English: strip seniority + generic role words, keep domain terms
  const enNoise = /\b(senior|junior|lead|staff|principal|head|chief|associate|intern|entry.level|mid.level)\b/gi;
  const enRoles = /\b(engineer|developer|architect|manager|specialist|analyst|consultant|director|vp)\b/gi;
  let simplified = kw.replace(enNoise, '').trim();
  // If after stripping roles we still have 2+ meaningful words, strip roles too
  const withoutRoles = simplified.replace(enRoles, '').trim();
  if (withoutRoles.split(/\s+/).filter(w => w.length > 2).length >= 1) {
    simplified = withoutRoles;
  }
  // Chinese: strip seniority prefixes and generic suffixes
  simplified = simplified
    .replace(/^(首席|高级|资深|初级|中级|主任|副|助理)/, '')
    .replace(/(工程师|开发者|架构师|专家|顾问|分析师|经理|总监)$/, '')
    .trim();
  // If result is too short (< 2 chars), return original
  if (simplified.length < 2) return kw;
  return simplified.replace(/\s{2,}/g, ' ').trim();
}

/** Normalize company name to Greenhouse/Lever board slug */
function companyToSlug(company: string): string {
  return company.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/inc$|ltd$|co$/, '');
}

/** Record token usage — uses raw SQL for atomic increment to avoid race conditions */
export async function recordTokenUsage(
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

  /** Check if an opportunity already exists by external_ref OR by company+title combo. */
  private async isDuplicate(teamId: string, job: { external_ref: string; company_name: string; job_title: string }): Promise<boolean> {
    // Check by external_ref (exact platform ID match)
    const { count: refCount } = await this.db
      .from('opportunity')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', teamId)
      .eq('external_ref', job.external_ref);
    if (refCount && refCount > 0) return true;

    // Check by company_name + job_title (catches same job posted with different IDs)
    const { count: titleCount } = await this.db
      .from('opportunity')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', teamId)
      .eq('company_name', job.company_name)
      .eq('job_title', job.job_title);
    if (titleCount && titleCount > 0) return true;

    return false;
  }

  /** Load AI-generated search keywords from profile_baseline */
  async getSearchKeywords(teamId: string): Promise<SearchKeywords | null> {
    const { data: baseline } = await this.db
      .from('profile_baseline')
      .select('search_keywords')
      .eq('team_id', teamId)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    if (!baseline?.search_keywords) return null;
    const kw = baseline.search_keywords as Record<string, unknown>;
    return {
      en_keywords: (kw.en_keywords as string[]) || [],
      zh_keywords: (kw.zh_keywords as string[]) || [],
      target_companies: (kw.target_companies as string[]) || [],
      primary_domain: (kw.primary_domain as string) || 'general',
      seniority_bracket: (kw.seniority_bracket as string) || 'mid',
      job_directions: (kw.job_directions as Array<{ zh: string; en: string }>) || [],
    };
  }

  /** Insert a timeline event for the real-time feed */
  private async emitEvent(teamId: string, eventType: string, summary: string, entityId?: string): Promise<void> {
    await this.db.from('timeline_event').insert({
      team_id: teamId,
      event_type: eventType,
      summary_text: summary,
      actor_type: 'agent',
      related_entity_type: entityId ? 'opportunity' : undefined,
      related_entity_id: entityId,
      visibility: 'feed',
    });
  }

  /** Search Greenhouse public boards API for jobs matching a keyword */
  private async searchGreenhouseAPI(keyword: string, limit: number): Promise<Array<{ company: string; jobId: string; title: string; location: string; url: string; content: string }>> {
    // Well-known companies with public Greenhouse boards
    const BOARDS = ['stripe', 'airbnb', 'cloudflare', 'figma', 'notion', 'vercel', 'databricks', 'rippling',
      'airtable', 'plaid', 'brex', 'ramp', 'retool', 'linear', 'supabase', 'anthropic', 'openai',
      'coinbase', 'kraken', 'chainalysis', 'consensys', 'alchemy-2', 'dapper', 'polygon-labs',
      'gitlabinc', 'hashicorp', 'grafana-labs', 'elastic', 'twilio', 'sendgrid'];
    const results: Array<{ company: string; jobId: string; title: string; location: string; url: string; content: string }> = [];
    // Split keyword into meaningful words for broader matching
    const kwWords = keyword.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !['senior', 'junior', 'lead', 'staff', 'principal', 'the', 'and', 'for'].includes(w));

    const MAX_PER_BOARD = 5; // Cap per company for diversity
    // Fetch all boards in parallel (batched)
    const fetchBoard = async (board: string) => {
      try {
        const resp = await fetch(`https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`, { signal: AbortSignal.timeout(8000) });
        if (!resp.ok) return [];
        const data = await resp.json();
        const matched: typeof results = [];
        for (const job of (data.jobs || [])) {
          if (matched.length >= MAX_PER_BOARD) break;
          const title = (job.title || '').toLowerCase();
          const content = (job.content || '').toLowerCase();
          if (kwWords.some(w => title.includes(w) || content.includes(w))) {
            matched.push({
              company: board, jobId: String(job.id), title: job.title || keyword,
              location: job.location?.name || '', url: `https://boards.greenhouse.io/${board}/jobs/${job.id}`,
              content: (job.content || '').slice(0, 2000),
            });
          }
        }
        return matched;
      } catch { return []; }
    };
    // Fetch in batches of 10 to avoid rate limiting
    for (let i = 0; i < BOARDS.length && results.length < limit; i += 10) {
      const batch = await Promise.allSettled(BOARDS.slice(i, i + 10).map(fetchBoard));
      for (const b of batch) {
        if (b.status === 'fulfilled') results.push(...b.value);
      }
    }
    console.log(`[greenhouse-api] keyword="${keyword}" → ${results.length} jobs from ${BOARDS.length} boards`);
    return results;
  }

  /** Search Lever public postings API for jobs matching a keyword */
  private async searchLeverAPI(keyword: string, limit: number): Promise<Array<{ company: string; jobId: string; title: string; location: string; url: string; content: string }>> {
    const SITES = ['stripe', 'netflix', 'snap', 'pinterest', 'lyft', 'palantir', 'flexport', 'robinhood',
      'blockfi', 'solana-labs', 'aptos-labs', 'sui', 'near', 'layerzero-labs', 'eigenlayer',
      'aave', 'compound-2', 'uniswap', 'makerdao', 'lido', 'starkware-industries'];
    const results: Array<{ company: string; jobId: string; title: string; location: string; url: string; content: string }> = [];
    const kwWords = keyword.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !['senior', 'junior', 'lead', 'staff', 'principal', 'the', 'and', 'for'].includes(w));

    const MAX_PER_SITE = 5;
    // Fetch all sites in parallel
    const fetchSite = async (site: string) => {
      try {
        const resp = await fetch(`https://api.lever.co/v0/postings/${site}?mode=json`, { signal: AbortSignal.timeout(8000) });
        if (!resp.ok) return [];
        const postings = await resp.json();
        const matched: typeof results = [];
        for (const p of (postings || [])) {
          if (matched.length >= MAX_PER_SITE) break;
          const title = (p.text || '').toLowerCase();
          const desc = (p.descriptionPlain || '').toLowerCase();
          if (kwWords.some(w => title.includes(w) || desc.includes(w))) {
            matched.push({
              company: site, jobId: p.id || '', title: p.text || keyword,
              location: p.categories?.location || '',
              url: p.hostedUrl || `https://jobs.lever.co/${site}/${p.id}`,
              content: (p.descriptionPlain || '').slice(0, 2000),
            });
          }
        }
        return matched;
      } catch { return []; }
    };
    // Fetch in batches of 10 to avoid rate limiting
    for (let i = 0; i < SITES.length && results.length < limit; i += 10) {
      const batch = await Promise.allSettled(SITES.slice(i, i + 10).map(fetchSite));
      for (const b of batch) {
        if (b.status === 'fulfilled') results.push(...b.value);
      }
    }
    console.log(`[lever-api] keyword="${keyword}" → ${results.length} jobs from ${SITES.length} sites`);
    return results;
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
  async runDiscoveryCycle(teamId: string): Promise<number> {
    // Pre-flight: search_keywords must exist (generated by keyword_generation task)
    const keywords = await this.getSearchKeywords(teamId);
    const hasEn = (keywords?.en_keywords?.length ?? 0) > 0;
    const hasZh = (keywords?.zh_keywords?.length ?? 0) > 0;
    const hasCompanies = (keywords?.target_companies?.length ?? 0) > 0;
    if (!keywords || (!hasEn && !hasZh && !hasCompanies)) {
      console.log('[pipeline] No search_keywords for team, skipping discovery (waiting for keyword_generation)');
      return 0;
    }

    // Get team config
    const { data: team } = await this.db
      .from('team')
      .select('id, strategy_mode, coverage_scope')
      .eq('id', teamId)
      .single();

    if (!team) return 0;

    // Get connected platforms (include expiry and failure tracking)
    const { data: connections } = await this.db
      .from('platform_connection')
      .select('id, platform_id, status, session_expires_at, session_granted_at, failure_count')
      .eq('team_id', teamId)
      .eq('status', 'active');

    if (!connections || connections.length === 0) return 0;

    // Get platform definitions for connected platforms
    const platformIds = connections.map((c: { platform_id: string }) => c.platform_id);
    const { data: platforms } = await this.db
      .from('platform_definition')
      .select('*')
      .in('id', platformIds);

    if (!platforms) return 0;

    // Run discovery per platform
    // Count opportunities before and after to get total created
    const { count: beforeCount } = await this.db
      .from('opportunity').select('id', { count: 'exact', head: true })
      .eq('team_id', teamId);

    console.log(`[pipeline] Platforms to discover: ${platforms.map((p: { code: string }) => p.code).join(', ')} (${platforms.length} total, ${connections.length} active connections)`);
    for (const platform of platforms) {
      const pipelineMode = platform.pipeline_mode as PipelineMode;
      const conn = connections.find((c: { platform_id: string }) => c.platform_id === platform.id);
      console.log(`[pipeline] Starting ${platform.code} (mode=${pipelineMode}, conn=${conn ? 'found' : 'MISSING'})`);

      // TTL pre-flight: skip if session has expired (exempt no-cookie platforms like GH/Lever)
      const NO_COOKIE = ['greenhouse', 'lever'];
      if (conn?.session_expires_at && !NO_COOKIE.includes(platform.code) && new Date(conn.session_expires_at as string) < new Date()) {
        console.warn(`[pipeline] ${platform.code}: session TTL expired, marking session_expired`);
        await this.db.from('platform_connection').update({
          status: 'session_expired',
          requires_user_action: true,
          failure_reason: '登录凭据已超过有效期，请重新连接',
        }).eq('id', conn.id);
        // Emit team event for user notification
        await this.db.from('team_event').insert({
          team_id: teamId,
          event_type: 'platform_session_expired',
          summary: `${platform.display_name_zh || platform.display_name}登录已过期，已暂停相关任务`,
          metadata: { platform_code: platform.code, reason: 'ttl_expired' },
        });
        continue;
      }

      // TTL warning: if remaining < 20% of total TTL, emit a warning event
      if (conn?.session_expires_at && conn?.session_granted_at) {
        const expires = new Date(conn.session_expires_at as string).getTime();
        const granted = new Date(conn.session_granted_at as string).getTime();
        const now = Date.now();
        const totalTTL = expires - granted;
        const remaining = expires - now;
        if (remaining > 0 && remaining < totalTTL * 0.2) {
          const remainingMin = Math.round(remaining / (1000 * 60));
          console.warn(`[pipeline] ${platform.code}: session expiring soon (${remainingMin}min remaining)`);
          await this.db.from('team_event').insert({
            team_id: teamId,
            event_type: 'platform_session_expiring',
            summary: `${platform.display_name_zh || platform.display_name}登录即将过期（剩余 ${remainingMin} 分钟）`,
            metadata: { platform_code: platform.code, remaining_minutes: remainingMin },
          });
        }
      }

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
        // Success: update tracking
        if (conn) {
          await this.db.from('platform_connection').update({
            last_successful_action_at: new Date().toISOString(),
            failure_count: 0,
          }).eq('id', conn.id);
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`[pipeline] Discovery error for ${platform.code}:`, err);

        // Handle session expired errors from executors
        if (errMsg.includes('session_expired') || errMsg.includes('auth wall')) {
          if (conn) {
            const currentFailures = (conn.failure_count as number) || 0;
            await this.db.from('platform_connection').update({
              status: 'session_expired',
              requires_user_action: true,
              failure_reason: `${platform.display_name_zh || platform.display_name}登录已失效`,
              failure_count: currentFailures + 1,
            }).eq('id', conn.id);
            await this.db.from('team_event').insert({
              team_id: teamId,
              event_type: 'platform_session_expired',
              summary: `${platform.display_name_zh || platform.display_name}登录已失效，已暂停相关任务`,
              metadata: { platform_code: platform.code, reason: 'auth_wall', error: errMsg },
            });
          }
        }
      }
    }

    // Count total new opportunities created this cycle
    const { count: afterCount } = await this.db
      .from('opportunity').select('id', { count: 'exact', head: true })
      .eq('team_id', teamId);
    const totalCreated = (afterCount || 0) - (beforeCount || 0);
    console.log(`[pipeline] Discovery cycle complete: ${totalCreated} new opportunities created`);
    await this.emitEvent(teamId, 'task_opportunity_discovery_completed', `岗位发现周期完成，新增 ${totalCreated} 个岗位`);
    return totalCreated;
  }

  private async runGreenhouseDiscovery(
    teamId: string,
    platform: Record<string, unknown>,
    pipelineMode: string
  ): Promise<void> {
    const keywords = await this.getSearchKeywords(teamId);
    if (!keywords || keywords.en_keywords.length === 0) return;

    // Use Google site search to discover Greenhouse jobs
    const searchKeywords = keywords.en_keywords.slice(0, 3);
    console.log(`[pipeline] greenhouse: Google site search, keywords=${searchKeywords.join(', ')}`);

    await this.emitEvent(teamId, 'platform_search_started', `岗位研究员开始搜索 Greenhouse: ${searchKeywords.join(', ')}`);

    let totalFound = 0;
    for (const keyword of searchKeywords) {
      try {
        const apiResults = await this.searchGreenhouseAPI(keyword, 10);

        for (const job of apiResults) {
          const externalRef = `greenhouse:${job.company}:${job.jobId}`;
          if (await this.isDuplicate(teamId, { external_ref: externalRef, company_name: job.company, job_title: job.title })) continue;

          await this.db
            .from('opportunity')
            .insert({
              team_id: teamId, stage: OpportunityStage.Discovered,
              company_name: job.company, job_title: job.title,
              location_label: job.location,
              job_description_url: job.url,
              job_description_text: job.content,
              source_platform_id: platform.id as string, external_ref: externalRef,
              source_freshness: 'new',
            }).select('id').single();

          totalFound++;
        }
      } catch (e) {
        console.log(`[greenhouse] Search "${keyword}" error — skipping: ${(e as Error).message.slice(0, 80)}`);
      }
    }
    await this.emitEvent(teamId, 'platform_search_completed', `岗位研究员在 Greenhouse 搜索完成，发现 ${totalFound} 个岗位`);
  }

  private async runLeverDiscovery(teamId: string, platform: Record<string, unknown>, pipelineMode: string): Promise<void> {
    const keywords = await this.getSearchKeywords(teamId);
    if (!keywords || keywords.en_keywords.length === 0) return;

    // Use Lever public API to discover jobs
    const searchKeywords = keywords.en_keywords.slice(0, 3);
    console.log(`[pipeline] lever: API search, keywords=${searchKeywords.join(', ')}`);

    await this.emitEvent(teamId, 'platform_search_started', `岗位研究员开始搜索 Lever: ${searchKeywords.join(', ')}`);

    let totalFound = 0;
    for (const keyword of searchKeywords) {
      try {
        const apiResults = await this.searchLeverAPI(keyword, 10);

        for (const job of apiResults) {
          const externalRef = `lever:${job.company}:${job.jobId}`;
          if (await this.isDuplicate(teamId, { external_ref: externalRef, company_name: job.company, job_title: job.title })) continue;

          await this.db
            .from('opportunity')
            .insert({
              team_id: teamId, stage: OpportunityStage.Discovered,
              company_name: job.company, job_title: job.title,
              location_label: job.location,
              job_description_url: job.url,
              job_description_text: job.content,
              source_platform_id: platform.id as string, external_ref: externalRef,
              source_freshness: 'new',
            }).select('id').single();

          totalFound++;
        }
      } catch (e) {
        console.log(`[lever] Search "${keyword}" error — skipping: ${(e as Error).message.slice(0, 80)}`);
      }
    }
    await this.emitEvent(teamId, 'platform_search_completed', `岗位研究员在 Lever 搜索完成，发现 ${totalFound} 个岗位`);
  }

  private async runLinkedInDiscovery(teamId: string, platform: Record<string, unknown>, pipelineMode: string): Promise<void> {
    const conn$ = await this.db
      .from('platform_connection')
      .select('session_token_ref')
      .eq('team_id', teamId)
      .eq('platform_id', platform.id as string)
      .eq('status', 'active')
      .single();
    if (!conn$?.data?.session_token_ref) return;

    const keywords = await this.getSearchKeywords(teamId);
    if (!keywords || keywords.en_keywords.length === 0) return;

    // Pick 3 keywords per cycle, search each individually
    const searchTerms = keywords.en_keywords.sort(() => Math.random() - 0.5).slice(0, 3);
    console.log(`[pipeline] linkedin: AI keywords=${searchTerms.join(', ')}`);
    await this.emitEvent(teamId, 'platform_search_started', `岗位研究员开始搜索 LinkedIn: ${searchTerms.join(', ')}`);

    const jobs: Array<{ job_title: string; company_name: string; location_label: string; job_description_url: string; job_description_text: string; external_ref: string }> = [];
    for (const kw of searchTerms) {
      const batch = await discoverLinkedInJobs({
        sessionCookies: conn$.data.session_token_ref,
        keywords: [kw],
        limit: 5,
      });
      jobs.push(...batch);
    }

    let created = 0;
    for (const job of jobs) {
      if (await this.isDuplicate(teamId, job)) continue;
      const { data: opp } = await this.db
        .from('opportunity')
        .insert({
          team_id: teamId, stage: OpportunityStage.Discovered,
          company_name: job.company_name, job_title: job.job_title,
          location_label: job.location_label, job_description_url: job.job_description_url,
          job_description_text: job.job_description_text,
          source_platform_id: platform.id as string, external_ref: job.external_ref,
          source_freshness: 'new',
        }).select('id').single();
      if (opp) created++;
      // Discovery only inserts — screening is a separate task created by dispatch loop
    }
    await this.emitEvent(teamId, 'platform_search_completed', `岗位研究员在 LinkedIn 搜索「${searchTerms[0]}」等，发现 ${created} 个新岗位`);
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

    if (!conn?.session_token_ref) {
      console.warn(`[pipeline] ${platformCode}: no session_token_ref, skipping`);
      await this.emitEvent(teamId, 'platform_search_skipped', `${platformNameZh}搜索跳过: 未连接平台`);
      return;
    }

    // Use AI-generated Chinese keywords
    const searchKw = await this.getSearchKeywords(teamId);
    if (!searchKw || searchKw.zh_keywords.length === 0) {
      console.warn(`[pipeline] ${platformCode}: no zh_keywords, skipping`);
      await this.emitEvent(teamId, 'platform_search_skipped', `${platformNameZh}搜索跳过: 未生成中文关键词`);
      return;
    }

    // Read preferred_locations from user_preferences
    const { data: prefs } = await this.db
      .from('user_preferences')
      .select('preferred_locations')
      .eq('team_id', teamId)
      .single();
    const rawLoc = prefs?.preferred_locations;
    const preferredLocations = Array.isArray(rawLoc) ? rawLoc : typeof rawLoc === 'string' && rawLoc ? rawLoc.split(',').map((s: string) => s.trim()) : [];

    // Simplify keywords for broader search — "区块链协议工程师" → "区块链"
    const keywordList = searchKw.zh_keywords.sort(() => Math.random() - 0.5).slice(0, 3)
      .map(kw => simplifyKeyword(kw));
    console.log(`[pipeline] ${platformCode}: search keywords=${keywordList.join(',')}, locations=${preferredLocations.join(',')}`);
    const platformNameZh = platformCode === 'zhaopin' ? '智联招聘' : platformCode === 'lagou' ? '拉勾' : '猎聘';
    await this.emitEvent(teamId, 'platform_search_started', `岗位研究员开始搜索${platformNameZh}: ${keywordList.join('、')}`);

    let jobs: Array<{ job_title: string; company_name: string; location_label: string; job_description_url: string; job_description_text: string; external_ref: string }> = [];

    // City filter: find first Chinese city name (skip "Remote", pinyin, etc.)
    const primaryCity = preferredLocations.find(loc => /[\u4e00-\u9fff]/.test(loc));
    // Search each keyword individually
    for (const kw of keywordList) {
      let batch: typeof jobs = [];
      if (platformCode === 'zhaopin') {
        batch = await discoverZhaopinJobs({ sessionCookies: conn.session_token_ref, keywords: [kw], limit: 5, city: primaryCity });
      } else if (platformCode === 'lagou') {
        batch = await discoverLagouJobs({ sessionCookies: conn.session_token_ref, keywords: [kw], limit: 5, city: primaryCity });
      } else if (platformCode === 'liepin') {
        batch = await discoverLiepinJobs({ sessionCookies: conn.session_token_ref, keywords: [kw], limit: 5, city: primaryCity });
      }
      console.log(`[pipeline] ${platformCode}: keyword="${kw}" → ${batch.length} jobs`);
      if (batch.length === 0) console.warn(`[pipeline] ${platformCode}: ZERO results for "${kw}"`);

      jobs.push(...batch);
    }

    let created = 0;
    for (const job of jobs) {
      if (await this.isDuplicate(teamId, job)) continue;

      await this.db
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
      created++;
    }
    const platformZh = platformCode === 'zhaopin' ? '智联招聘' : platformCode === 'lagou' ? '拉勾' : '猎聘';
    await this.emitEvent(teamId, 'platform_search_completed', `岗位研究员在${platformZh}搜索「${keywordList[0]}」等，发现 ${created} 个新岗位`);
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

    // Use AI-generated Chinese keywords
    const searchKw = await this.getSearchKeywords(teamId);
    if (!searchKw || searchKw.zh_keywords.length === 0) return;

    // Read preferred_locations for Boss
    const { data: bossPrefs } = await this.db
      .from('user_preferences')
      .select('preferred_locations')
      .eq('team_id', teamId)
      .single();
    const rawBossLoc = bossPrefs?.preferred_locations;
    const bossLocations = Array.isArray(rawBossLoc) ? rawBossLoc : typeof rawBossLoc === 'string' && rawBossLoc ? rawBossLoc.split(',').map((s: string) => s.trim()) : [];

    // Simplify keywords for broader search
    const keywordList = searchKw.zh_keywords.sort(() => Math.random() - 0.5).slice(0, 3)
      .map(kw => simplifyKeyword(kw));
    console.log(`[pipeline] boss_zhipin: search keywords=${keywordList.join(',')}, locations=${bossLocations.join(',')}`);
    await this.emitEvent(teamId, 'platform_search_started', `岗位研究员开始搜索 Boss直聘: ${keywordList.join('、')}`);

    // City filter: find first Chinese city name
    const bossPrimaryCity = bossLocations.find(loc => /[\u4e00-\u9fff]/.test(loc));
    const jobs: Array<{ job_title: string; company_name: string; location_label: string; job_description_url: string; job_description_text: string; external_ref: string }> = [];
    for (const kw of keywordList) {
      const batch = await discoverBossJobs({ sessionCookies: conn.session_token_ref, keywords: [kw], limit: 5, city: bossPrimaryCity });
      jobs.push(...batch);
    }

    let bossCreated = 0;
    for (const job of jobs) {
      if (await this.isDuplicate(teamId, job)) continue;

      await this.db
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
      bossCreated++;
    }
    await this.emitEvent(teamId, 'platform_search_completed', `岗位研究员在 Boss直聘 搜索「${keywordList[0]}」等，发现 ${bossCreated} 个新岗位`);
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
  async runFirstContact(
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
    const greetResult = await executeSkill('first-contact-drafting', {
      opportunity: {
        job_title: opportunity.job_title,
        company_name: opportunity.company_name,
        job_description_text: opportunity.job_description_text,
      },
    });

    const greetingText = greetResult.success
      ? ((greetResult.output as { draft_text?: string }).draft_text || `您好，我对贵司的「${opportunity.job_title}」岗位很感兴趣，希望能进一步了解。`)
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

      // Screening only evaluates — material generation and submission are separate tasks
      // created by the dispatch loop decision tree based on stage/recommendation.
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
    // Material pipeline only generates materials — submission is a separate task
    // created by the dispatch loop decision tree.
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

    // Determine pipeline mode for this opportunity
    const { data: platDef } = await this.db
      .from('platform_definition')
      .select('pipeline_mode')
      .eq('id', opportunity.source_platform_id as string)
      .single();
    const oppPipelineMode = platDef?.pipeline_mode || 'full_tailored';

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

    let resumeLocalPath = '';

    if (oppPipelineMode === 'full_tailored') {
      // For full_tailored: use tailored resume from material table
      const { data: tailoredMaterial } = await this.db.from('material')
        .select('*')
        .eq('opportunity_id', opportunityId)
        .eq('team_id', teamId)
        .in('material_type', ['localized_resume', 'deep_tailored_resume', 'standard_tailored_resume', 'light_edit_resume'])
        .eq('status', 'ready')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!tailoredMaterial) {
        throw new Error('SUBMISSION_BLOCKED: No tailored resume found for full_tailored pipeline');
      }

      // If tailored material has a storage_path, download it; otherwise write content_text to temp
      if (tailoredMaterial.storage_path) {
        try {
          resumeLocalPath = await downloadResumeToTemp(this.db, tailoredMaterial.storage_path, `tailored_${opportunityId}.pdf`);
        } catch (dlErr) {
          console.error(`[pipeline] Tailored resume download failed: ${dlErr instanceof Error ? dlErr.message : dlErr}`);
          throw new Error('SUBMISSION_BLOCKED: Failed to download tailored resume');
        }
      } else if (tailoredMaterial.content_text) {
        // Write text content to a temp file
        const { writeFileSync } = await import('fs');
        const tmpPath = `/tmp/tailored_resume_${opportunityId}.txt`;
        writeFileSync(tmpPath, tailoredMaterial.content_text);
        resumeLocalPath = tmpPath;
      }
    } else {
      // For passthrough: use original resume
      const { data: teamForUser } = await this.db.from('team').select('user_id').eq('id', teamId).single();
      if (!teamForUser?.user_id) {
        console.error(`[pipeline] Cannot find user_id for team ${teamId}`);
        return;
      }
      const { data: resumeAsset } = await this.db
        .from('resume_asset')
        .select('storage_path, file_name')
        .eq('user_id', teamForUser.user_id)
        .eq('is_primary', true)
        .single();

      if (resumeAsset) {
        try {
          resumeLocalPath = await downloadResumeToTemp(this.db, resumeAsset.storage_path, resumeAsset.file_name);
        } catch (dlErr) {
          console.error(`[pipeline] Resume download failed: ${dlErr instanceof Error ? dlErr.message : dlErr}`);
          return; // Cannot submit without resume
        }
      }
    }

    // Parse cover letter: content_text is JSON string, extract full_text
    let coverLetterText: string | undefined;
    if (coverLetterMat?.content_text) {
      try {
        const parsed = JSON.parse(coverLetterMat.content_text);
        coverLetterText = parsed.full_text || parsed.text || coverLetterMat.content_text;
      } catch {
        coverLetterText = coverLetterMat.content_text; // fallback to raw text
      }
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
            coverLetterText,
          });
          break;

        case 'lever':
          result = await submitLeverApplication({
            jobUrl: (opportunity.job_description_url as string) || '',
            applicantName: (baseline?.full_name as string) || 'Unknown',
            applicantEmail: (profile?.contact_email as string) || (baseline?.contact_email as string) || '',
            resumeLocalPath,
            coverLetterText,
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
