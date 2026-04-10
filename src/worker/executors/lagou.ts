/**
 * 拉勾 (Lagou) Platform Executor — Passthrough Pipeline
 *
 * Anti-scraping: Moderate | Session: cookie | Headless: Yes
 * Apply method: browser_form | Pipeline: passthrough
 * Daily budget: 30 | Delays: 2-5s
 *
 * Per spec mandatory non-goals:
 * - Do NOT build 招聘关系经理 around 拉勾网页聊天
 * - App-directed chat prompt is a handoff signal, not an automation target
 *
 * Source: PLATFORM_RULE_AND_AGENT_SPEC.md § 拉勾
 */

import { createContext, randomDelay } from '../utils/browser-pool.js';
import type { Page } from 'playwright';

const DAILY_BUDGET = { applications: 30 };
const DELAY = { page: [2000, 5000] as const, click: [1000, 2000] as const };

type LagouJob = {
  job_title: string;
  company_name: string;
  location_label: string;
  salary_text?: string;
  job_description_url: string;
  job_description_text: string;
  external_ref: string;
};

/**
 * Discover jobs via 拉勾 keyword search.
 * URL pattern: www.lagou.com/wn/zhaopin?...
 */
export async function discoverLagouJobs(params: {
  sessionCookies: string;
  keywords: string[];
  city?: string;
  limit?: number;
}): Promise<LagouJob[]> {
  const limit = params.limit ?? 10;
  const context = await createContext({ cookies: params.sessionCookies });
  const page = await context.newPage();

  try {
    const keyword = params.keywords[0] || params.keywords.join(' ');
    const searchUrl = `https://www.lagou.com/wn/zhaopin?kd=${encodeURIComponent(keyword)}${params.city ? `&city=${encodeURIComponent(params.city)}` : ''}`;

    console.log(`[lagou] Navigating to search: ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log(`[lagou] Page loaded, URL: ${page.url()}`);
    await randomDelay(DELAY.page[0], DELAY.page[1]);

    if (isLoginPage(page)) {
      throw new Error('session_expired: 拉勾 login redirect detected');
    }
    console.log('[lagou] Auth check passed, scraping results...');

    const jobs: LagouJob[] = [];
    const cards = page.locator('.item__10RTO, .position-list-item, .list_item_top');
    const count = Math.min(await cards.count(), limit);

    for (let i = 0; i < count; i++) {
      try {
        const card = cards.nth(i);
        await card.scrollIntoViewIfNeeded();

        const title = await card.locator('.p-top__1F7CL a, .position-name, .name__LmEJu').first().textContent() || '';
        const company = await card.locator('.company-name__2-SjF, .company_name').first().textContent() || '';
        const location = await card.locator('.add__laeGV, .position-address').first().textContent() || '';
        const salary = await card.locator('.money__3Lkgq, .position-salary').first().textContent().catch(() => '') || '';

        const linkEl = card.locator('a[href*="/jobs/"], a[href*="positionId"]').first();
        const href = await linkEl.getAttribute('href') || '';

        const jobId = href.match(/\/jobs\/(\d+)/)?.[1] || href.match(/positionId=(\d+)/)?.[1] || `lagou-${i}`;

        if (title.trim()) {
          jobs.push({
            job_title: title.trim(),
            company_name: company.trim(),
            location_label: location.trim(),
            salary_text: salary.trim() || undefined,
            job_description_url: href.startsWith('http') ? href : `https://www.lagou.com/jobs/${jobId}.html`,
            job_description_text: '',
            external_ref: `lagou:${jobId}`,
          });
        }
      } catch (e) { console.warn('[lagou] Card parse failed:', (e as Error).message); }
    }

    // Load JD for top results
    for (const job of jobs.slice(0, 5)) {
      try {
        await page.goto(job.job_description_url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await randomDelay(DELAY.page[0], DELAY.page[1]);
        const jd = await page.locator('.job-detail, .job_bt, .position-content').first().textContent();
        job.job_description_text = jd?.trim() || '';
      } catch (e) { console.warn('[lagou] Detail fetch failed:', (e as Error).message); }
    }

    console.log(`[lagou] Discovery complete: ${jobs.length} jobs found`);
    return jobs;

  } catch (err) {
    console.error(`[lagou] Discovery error: ${err instanceof Error ? err.message : err}`);
    return [];
  } finally {
    await page.close();
    await context.close();
  }
}

/**
 * Submit application via 拉勾 web apply.
 * Passthrough: uses platform-stored resume.
 *
 * Flow: Navigate detail → dedup check (已投递) → click apply → detect 已投递
 */
export async function submitLagouApplication(params: {
  sessionCookies: string;
  jobUrl: string;
}): Promise<{
  outcome: 'success' | 'soft_failure' | 'hard_failure';
  confirmationSignal?: string;
  errorMessage?: string;
  isDuplicate?: boolean;
}> {
  const context = await createContext({ cookies: params.sessionCookies });
  const page = await context.newPage();

  try {
    await page.goto(params.jobUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await randomDelay(DELAY.page[0], DELAY.page[1]);

    if (isLoginPage(page)) {
      return { outcome: 'hard_failure', errorMessage: 'Session expired' };
    }

    // Dedup: check for 已投递 state
    const pageText = await page.textContent('body') || '';
    if (/已投递|已申请/.test(pageText)) {
      return { outcome: 'soft_failure', errorMessage: 'Already applied (已投递)', isDuplicate: true };
    }

    // Click apply button
    const applyBtn = page.locator('button:has-text("投递简历"), button:has-text("立即投递"), .apply-btn, .resume-delivery').first();
    if (!(await applyBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      return { outcome: 'soft_failure', errorMessage: 'Apply button not found' };
    }

    await applyBtn.click();
    await randomDelay(DELAY.page[0], DELAY.page[1]);

    // Check for resume selection dialog
    const resumeDialog = page.locator('.resume-select-dialog, .delivery-dialog, .resume-list-dialog').first();
    if (await resumeDialog.isVisible().catch(() => false)) {
      // Select first available resume
      const firstResume = resumeDialog.locator('.resume-item, input[type="radio"]').first();
      if (await firstResume.isVisible().catch(() => false)) {
        await firstResume.click();
        await randomDelay(DELAY.click[0], DELAY.click[1]);
      }
      const confirmBtn = resumeDialog.locator('button:has-text("确定"), button:has-text("投递")').first();
      if (await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click();
        await randomDelay(DELAY.page[0], DELAY.page[1]);
      }
    }

    // Detect success
    const finalText = await page.textContent('body') || '';
    if (/已投递|投递成功|申请成功/.test(finalText)) {
      return { outcome: 'success', confirmationSignal: '已投递 state detected', isDuplicate: false };
    }

    return { outcome: 'soft_failure', errorMessage: 'Apply clicked but no 已投递 confirmation' };

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[lagou] Submit error: ${msg}`);
    return { outcome: 'soft_failure', errorMessage: msg };

  } finally {
    await page.close();
    await context.close();
  }
}

/**
 * Check if a job has already been applied to (dedup).
 */
export async function checkLagouDuplicate(params: {
  sessionCookies: string;
  jobDetailUrl: string;
}): Promise<boolean> {
  const context = await createContext({ cookies: params.sessionCookies });
  const page = await context.newPage();

  try {
    await page.goto(params.jobDetailUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await randomDelay(DELAY.page[0], DELAY.page[1]);

    const text = await page.textContent('body') || '';
    return /已投递|已申请/.test(text);

  } catch {
    return false; // Can't determine, assume not duplicate
  } finally {
    await page.close();
    await context.close();
  }
}

/**
 * Capability-level health check.
 */
export async function checkLagouCapabilityHealth(params: {
  sessionCookies: string;
}): Promise<Record<string, 'healthy' | 'degraded' | 'blocked' | 'unknown'>> {
  const context = await createContext({ cookies: params.sessionCookies });
  const page = await context.newPage();
  const caps: Record<string, 'healthy' | 'degraded' | 'blocked' | 'unknown'> = {
    search: 'unknown', detail: 'unknown', apply: 'unknown', chat: 'unknown', resume: 'unknown',
  };

  try {
    await page.goto('https://www.lagou.com/wn/zhaopin?kd=test', { waitUntil: 'domcontentloaded', timeout: 15000 });
    caps.search = isLoginPage(page) ? 'blocked' : 'healthy';

    if (caps.search === 'healthy') {
      const firstLink = await page.locator('a[href*="/jobs/"]').first().getAttribute('href').catch(() => null);
      if (firstLink) {
        const detailUrl = firstLink.startsWith('http') ? firstLink : `https://www.lagou.com${firstLink}`;
        await page.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        const hasJd = await page.locator('.job-detail, .job_bt').first().isVisible().catch(() => false);
        caps.detail = hasJd ? 'healthy' : 'degraded';
      }
    }
  } catch {
    // Leave as unknown
  } finally {
    await page.close();
    await context.close();
  }

  return caps;
}

function isLoginPage(page: Page): boolean {
  const url = page.url();
  return url.includes('/login') || url.includes('/utrack/login') || url.includes('/passport');
}
