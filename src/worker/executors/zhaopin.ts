/**
 * 智联招聘 (Zhaopin) Platform Executor — Passthrough Pipeline
 *
 * - Discovery: Browser-based keyword search with font-obfuscation handling
 * - Apply: Browser form submit with platform-stored online resume (no tailoring)
 * - Session: Cookie-based, browser-backed
 *
 * IMPORTANT: Passthrough pipeline — no material generation.
 * The user's original resume is used directly.
 *
 * Source: PLATFORM_RULE_AND_AGENT_SPEC.md § 智联招聘
 * Source: Platform Research § Experiments Z1-Z8
 */

type ZhaopinJob = {
  job_title: string;
  company_name: string;
  location_label: string;
  salary_text?: string;
  job_description_url: string;
  job_description_text: string;
  external_ref: string;
};

const DAILY_BUDGET = { applications: 30 };
const DELAY_RANGE = { pageLoad: [2000, 5000], click: [1000, 2000] } as const;

/**
 * Discover jobs via 智联 keyword search.
 * Requires active cookie session.
 *
 * Known platform behavior:
 * - Font obfuscation on salary/text fields (custom web fonts)
 * - Search works on both www.zhaopin.com and sou.zhaopin.com
 * - Detail pages are stable once position IDs are known
 */
export async function discoverZhaopinJobs(params: {
  sessionCookies: string;
  keywords: string[];
  city?: string;
  limit?: number;
}): Promise<ZhaopinJob[]> {
  console.log(`[zhaopin] Stub discovery: keywords=${params.keywords.join(', ')}, city=${params.city || 'all'}`);
  // Real implementation:
  // 1. Launch Playwright with injected cookies (www.zhaopin.com + i.zhaopin.com)
  // 2. Navigate to search page with keyword params
  // 3. Extract job cards (handle font obfuscation for salary)
  // 4. For each card: extract title, company, location, salary, detail URL
  // 5. Navigate to detail pages for full JD text
  return [];
}

/**
 * Submit application via 智联 web apply.
 * Uses the platform's online resume — no file upload needed.
 *
 * Validated behavior from research:
 * - Click 立即投递 on detail page
 * - Page state changes to 已投递 on success
 * - No blocking confirmation step observed in tested samples
 */
export async function submitZhaopinApplication(params: {
  sessionCookies: string;
  jobDetailUrl: string;
}): Promise<{
  outcome: 'success' | 'soft_failure' | 'hard_failure';
  confirmationSignal?: string;
  errorMessage?: string;
}> {
  console.log(`[zhaopin] Stub apply to: ${params.jobDetailUrl}`);
  // Real implementation:
  // 1. Navigate to job detail page with cookies
  // 2. Check for 已投递 state (dedup)
  // 3. Click 立即投递
  // 4. Detect state change to 已投递
  // 5. Handle possible CAPTCHA (image CAPTCHA, rare)
  return {
    outcome: 'success',
    confirmationSignal: 'Stub: 智联 application submitted (已投递)',
  };
}

/**
 * Check capability-level health for 智联.
 * Tests search, detail, apply, resume separately.
 */
export async function checkZhaopinCapabilityHealth(params: {
  sessionCookies: string;
}): Promise<Record<string, 'healthy' | 'degraded' | 'blocked' | 'unknown'>> {
  console.log(`[zhaopin] Stub capability health check`);
  // Real implementation: lightweight probes per capability
  return {
    search: 'unknown',
    detail: 'unknown',
    apply: 'unknown',
    chat: 'unknown',
    resume: 'unknown',
  };
}
