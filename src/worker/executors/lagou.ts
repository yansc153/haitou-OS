/**
 * 拉勾 (Lagou) Platform Executor — Passthrough Pipeline
 *
 * - Discovery: Browser-based keyword search
 * - Apply: Browser form submit with platform-stored resume
 * - Dedup: Check for 已投递 state before submitting
 * - Session: Cookie-based, browser-backed
 *
 * IMPORTANT: Passthrough pipeline — no material generation.
 *
 * Source: PLATFORM_RULE_AND_AGENT_SPEC.md § 拉勾
 * Source: Platform Research § Experiments L1-L9
 */

type LagouJob = {
  job_title: string;
  company_name: string;
  location_label: string;
  salary_text?: string;
  job_description_url: string;
  job_description_text: string;
  external_ref: string;
};

const DAILY_BUDGET = { applications: 30 };

/**
 * Discover jobs via 拉勾 keyword search.
 *
 * Known platform behavior:
 * - Keyword search pages are stable and query-specific
 * - Detail routes are stable once position IDs are known
 * - Search URL pattern: www.lagou.com/wn/zhaopin?...
 */
export async function discoverLagouJobs(params: {
  sessionCookies: string;
  keywords: string[];
  city?: string;
  limit?: number;
}): Promise<LagouJob[]> {
  console.log(`[lagou] Stub discovery: keywords=${params.keywords.join(', ')}, city=${params.city || 'all'}`);
  // Real implementation:
  // 1. Launch Playwright with injected cookies
  // 2. Navigate to keyword search route
  // 3. Extract job cards from search results
  // 4. Navigate to detail pages for full JD
  return [];
}

/**
 * Submit application via 拉勾 web apply.
 * Uses the platform's stored resume (online or previously uploaded attachment).
 *
 * Validated behavior from research:
 * - Web-side apply is supported
 * - Multi-position repeated delivery is possible
 * - Same-position duplicate delivery is UI-blocked (已投递 state)
 */
export async function submitLagouApplication(params: {
  sessionCookies: string;
  jobDetailUrl: string;
}): Promise<{
  outcome: 'success' | 'soft_failure' | 'hard_failure';
  confirmationSignal?: string;
  errorMessage?: string;
  isDuplicate?: boolean;
}> {
  console.log(`[lagou] Stub apply to: ${params.jobDetailUrl}`);
  // Real implementation:
  // 1. Navigate to job detail page
  // 2. Check for 已投递 state → if yes, return isDuplicate=true
  // 3. Click apply button
  // 4. Detect state change to 已投递
  // 5. Handle any confirmation dialog
  return {
    outcome: 'success',
    confirmationSignal: 'Stub: 拉勾 application submitted (已投递)',
    isDuplicate: false,
  };
}

/**
 * Check if a specific job has already been applied to.
 * Dedup by detecting 已投递 on the detail page.
 */
export async function checkLagouDuplicate(params: {
  sessionCookies: string;
  jobDetailUrl: string;
}): Promise<boolean> {
  console.log(`[lagou] Stub dedup check for: ${params.jobDetailUrl}`);
  // Real implementation: navigate to detail page, check for 已投递 text
  return false;
}

/**
 * Check capability-level health for 拉勾.
 */
export async function checkLagouCapabilityHealth(params: {
  sessionCookies: string;
}): Promise<Record<string, 'healthy' | 'degraded' | 'blocked' | 'unknown'>> {
  console.log(`[lagou] Stub capability health check`);
  return {
    search: 'unknown',
    detail: 'unknown',
    apply: 'unknown',
    chat: 'unknown',
    resume: 'unknown',
  };
}
