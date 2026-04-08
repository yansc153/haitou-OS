/**
 * 智联招聘 (Zhaopin) Platform Executor — Passthrough Pipeline
 *
 * Anti-scraping: Low-Moderate | Session: cookie | Headless: Yes
 * Apply method: browser_form | Pipeline: passthrough (no material generation)
 * Daily budget: 30 | Delays: 2-5s
 *
 * Per spec mandatory non-goals:
 * - Do NOT build 招聘关系经理 around 智联网页聊天
 * - Treat 立即沟通 as app-gated / partial
 *
 * Source: PLATFORM_RULE_AND_AGENT_SPEC.md § 智联招聘
 */

import { createContext, randomDelay } from '../utils/browser-pool.js';
import type { Page } from 'playwright';

const DAILY_BUDGET = { applications: 30 };
const DELAY = { page: [2000, 5000] as const, click: [1000, 2000] as const };

type ZhaopinJob = {
  job_title: string;
  company_name: string;
  location_label: string;
  salary_text?: string;
  job_description_url: string;
  job_description_text: string;
  external_ref: string;
};

/**
 * Discover jobs via 智联 keyword search.
 * Requires active cookie session (both www.zhaopin.com and i.zhaopin.com).
 */
export async function discoverZhaopinJobs(params: {
  sessionCookies: string;
  keywords: string[];
  city?: string;
  limit?: number;
}): Promise<ZhaopinJob[]> {
  const limit = params.limit ?? 10;
  const context = await createContext({ cookies: params.sessionCookies });
  const page = await context.newPage();

  try {
    const keyword = params.keywords.join(' ');
    const searchUrl = `https://sou.zhaopin.com/?kw=${encodeURIComponent(keyword)}${params.city ? `&ct=${encodeURIComponent(params.city)}` : ''}`;

    console.log(`[zhaopin] Navigating to search: ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log(`[zhaopin] Page loaded, URL: ${page.url()}`);
    await randomDelay(DELAY.page[0], DELAY.page[1]);

    // Check for login redirect
    if (isLoginPage(page)) {
      throw new Error('session_expired: 智联招聘 login redirect detected');
    }
    console.log('[zhaopin] Auth check passed, scraping results...');

    const jobs: ZhaopinJob[] = [];
    const cards = page.locator('.joblist-box__item, .contentpile__content__wrapper__item');
    const count = Math.min(await cards.count(), limit);

    for (let i = 0; i < count; i++) {
      try {
        const card = cards.nth(i);
        await card.scrollIntoViewIfNeeded();

        const title = await card.locator('.jobinfo__name, .iteminfo__line1__jobname, a[data-at="job-name"]').first().textContent({ timeout: 3000 }).catch(() => '') || '';
        const company = await card.locator('.companyinfo__name, .iteminfo__line1__compname, a[data-at="company-name"]').first().textContent({ timeout: 3000 }).catch(() => '') || '';
        const location = await card.locator('.jobinfo__other-info-item:first-child, .iteminfo__line2__jobdesc span').first().textContent({ timeout: 3000 }).catch(() => '') || '';
        const salary = await card.locator('.jobinfo__salary, .iteminfo__line2__jobdesc__salary, .iteminfo__line1__salary').first().textContent({ timeout: 3000 }).catch(() => '') || '';

        const linkEl = card.locator('a.jobinfo__name, a[href*="jobs.zhaopin.com"], a[href*="/jobdetail"]').first();
        const href = await linkEl.getAttribute('href', { timeout: 3000 }).catch(() => '') || '';

        // Extract job ID from URL
        const jobId = href.match(/\/(\d+)\.htm/)?.[1] || href.match(/jobid=(\d+)/i)?.[1] || `zhaopin-${i}`;

        if (title.trim()) {
          jobs.push({
            job_title: title.trim(),
            company_name: company.trim(),
            location_label: location.trim(),
            salary_text: salary.trim() || undefined,
            job_description_url: href.startsWith('http') ? href : `https://jobs.zhaopin.com/${jobId}.htm`,
            job_description_text: '', // Loaded on detail page
            external_ref: `zhaopin:${jobId}`,
          });
        }
      } catch { /* skip card */ }
    }

    // Load JD text for top results
    for (const job of jobs.slice(0, 5)) {
      try {
        await page.goto(job.job_description_url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await randomDelay(DELAY.page[0], DELAY.page[1]);
        const jd = await page.locator('.describtion__detail-content, .job-detail__content, .pos-ul').first().textContent();
        job.job_description_text = jd?.trim() || '';
      } catch { /* skip detail */ }
    }

    console.log(`[zhaopin] Discovery complete: ${jobs.length} jobs found`);
    return jobs;

  } catch (err) {
    console.error(`[zhaopin] Discovery error: ${err instanceof Error ? err.message : err}`);
    return [];
  } finally {
    await page.close();
    await context.close();
  }
}

/**
 * Submit application via 智联 web apply.
 * Passthrough: uses platform-stored online resume, no file upload.
 *
 * Flow: Navigate detail → check 已投递 dedup → click 立即投递 → detect 已投递
 */
export async function submitZhaopinApplication(params: {
  sessionCookies: string;
  jobUrl: string;
}): Promise<{
  outcome: 'success' | 'soft_failure' | 'hard_failure';
  confirmationSignal?: string;
  errorMessage?: string;
}> {
  const context = await createContext({ cookies: params.sessionCookies });
  const page = await context.newPage();

  try {
    await page.goto(params.jobUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await randomDelay(DELAY.page[0], DELAY.page[1]);

    if (isLoginPage(page)) {
      return { outcome: 'hard_failure', errorMessage: 'Session expired' };
    }

    // Check for 已投递 (already applied)
    const pageText = await page.textContent('body') || '';
    if (/已投递|已申请/.test(pageText)) {
      return { outcome: 'soft_failure', errorMessage: 'Already applied (已投递)' };
    }

    // Click 立即投递 button
    const applyBtn = page.locator('button:has-text("立即投递"), a:has-text("立即投递"), button:has-text("申请职位"), .apply-btn').first();
    if (!(await applyBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      return { outcome: 'soft_failure', errorMessage: '立即投递 button not found' };
    }

    await applyBtn.click();
    await randomDelay(DELAY.page[0], DELAY.page[1]);

    // Detect success: page should now show 已投递
    const newPageText = await page.textContent('body') || '';
    if (/已投递|投递成功|申请成功/.test(newPageText)) {
      return { outcome: 'success', confirmationSignal: '已投递 state detected' };
    }

    // Check for resume selection dialog
    const resumeDialog = page.locator('.resume-select, .deliver-dialog').first();
    if (await resumeDialog.isVisible().catch(() => false)) {
      // Select first resume and confirm
      const firstResume = resumeDialog.locator('input[type="radio"], .resume-item').first();
      if (await firstResume.isVisible().catch(() => false)) {
        await firstResume.click();
        await randomDelay(DELAY.click[0], DELAY.click[1]);
      }
      const confirmBtn = resumeDialog.locator('button:has-text("确定"), button:has-text("投递")').first();
      if (await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click();
        await randomDelay(DELAY.page[0], DELAY.page[1]);
      }

      const finalText = await page.textContent('body') || '';
      if (/已投递|投递成功/.test(finalText)) {
        return { outcome: 'success', confirmationSignal: '已投递 after resume selection' };
      }
    }

    return { outcome: 'soft_failure', errorMessage: 'Apply clicked but no 已投递 confirmation' };

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[zhaopin] Submit error: ${msg}`);
    return { outcome: 'soft_failure', errorMessage: msg };

  } finally {
    await page.close();
    await context.close();
  }
}

/**
 * Capability-level health check.
 */
export async function checkZhaopinCapabilityHealth(params: {
  sessionCookies: string;
}): Promise<Record<string, 'healthy' | 'degraded' | 'blocked' | 'unknown'>> {
  const context = await createContext({ cookies: params.sessionCookies });
  const page = await context.newPage();
  const caps: Record<string, 'healthy' | 'degraded' | 'blocked' | 'unknown'> = {
    search: 'unknown', detail: 'unknown', apply: 'unknown', chat: 'unknown', resume: 'unknown',
  };

  try {
    // Probe search
    await page.goto('https://sou.zhaopin.com/?kw=test', { waitUntil: 'domcontentloaded', timeout: 15000 });
    caps.search = isLoginPage(page) ? 'blocked' : 'healthy';

    if (caps.search === 'healthy') {
      // Probe detail (use first result link)
      const firstLink = await page.locator('a[href*="jobs.zhaopin.com"]').first().getAttribute('href').catch(() => null);
      if (firstLink) {
        await page.goto(firstLink, { waitUntil: 'domcontentloaded', timeout: 15000 });
        const hasJd = await page.locator('.describtion__detail-content, .job-detail__content').first().isVisible().catch(() => false);
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
  return url.includes('/login') || url.includes('/passport') || url.includes('/loginPage');
}
