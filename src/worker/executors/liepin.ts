/**
 * 猎聘 (Liepin) Platform Executor — Passthrough Pipeline
 *
 * Anti-scraping: Medium | Session: cookie | Headless: No
 * Apply method: browser_form | Pipeline: passthrough
 * Daily budget: 20 | Delays: 2-5s
 *
 * Source: PLATFORM_RULE_AND_AGENT_SPEC.md § Tier 2, MULTI_PLATFORM_PIPELINE_SPEC.md § 6.1
 */

import { createContext, randomDelay } from '../utils/browser-pool.js';
import type { Page } from 'playwright';

const DELAY = { page: [2000, 5000] as const, click: [1000, 2000] as const };

type LiepinJob = {
  job_title: string;
  company_name: string;
  location_label: string;
  salary_text?: string;
  job_description_url: string;
  job_description_text: string;
  external_ref: string;
};

/**
 * Discover jobs via 猎聘 keyword search.
 * URL pattern: www.liepin.com/zhaopin/?key=xxx&dq=xxx
 */
export async function discoverLiepinJobs(params: {
  sessionCookies: string;
  keywords: string[];
  city?: string;
  limit?: number;
}): Promise<LiepinJob[]> {
  const limit = params.limit ?? 10;
  const context = await createContext({ cookies: params.sessionCookies });
  const page = await context.newPage();

  try {
    const keyword = params.keywords[0] || params.keywords.join(' ');
    const searchUrl = `https://www.liepin.com/zhaopin/?key=${encodeURIComponent(keyword)}${params.city ? `&dq=${encodeURIComponent(params.city)}` : ''}`;

    console.log(`[liepin] Navigating to search: ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log(`[liepin] Page loaded, URL: ${page.url()}`);
    await randomDelay(DELAY.page[0], DELAY.page[1]);

    if (isLoginPage(page)) {
      throw new Error('session_expired: 猎聘 login redirect detected');
    }
    console.log('[liepin] Auth check passed, scraping results...');

    const jobs: LiepinJob[] = [];
    const cards = page.locator('.job-list-item, .job-card-pc-container, .job-card');
    const count = Math.min(await cards.count(), limit);

    for (let i = 0; i < count; i++) {
      try {
        const card = cards.nth(i);
        await card.scrollIntoViewIfNeeded();

        // Liepin uses CSS module obfuscation — extract via innerText + link
        const linkEl = card.locator('a[href*="/job/"]').first();
        const href = await linkEl.getAttribute('href') || '';
        const jobId = href.match(/\/job\/(\w+)/)?.[1] || `liepin-${i}`;

        // Parse card text: line 0=title, line 1-2=location brackets, rest=salary/exp
        const cardText = await card.innerText();
        const lines = cardText.split('\n').map(l => l.trim()).filter(Boolean);
        const title = lines[0] || '';
        // Location is usually in 【...】brackets
        const locMatch = cardText.match(/【([^】]+)】/);
        const location = locMatch ? locMatch[1] : '';
        // Company: find text after the salary/experience lines (usually line 7+)
        // Use the link's closest ancestor text or fall back to later lines
        const companyEl = card.locator('a[href*="/company/"], a[href*="/com/"]').first();
        const company = await companyEl.textContent().catch(() => '') || lines.find(l => !l.includes('k') && !l.includes('年') && !l.includes('本科') && !l.includes('硕士') && !l.includes('急聘') && !l.includes('【') && l !== title && l.length > 2) || '';

        if (title.trim() && href) {
          jobs.push({
            job_title: title.trim(),
            company_name: company.trim(),
            location_label: location.trim(),
            salary_text: '',
            job_description_url: href.startsWith('http') ? href : `https://www.liepin.com/job/${jobId}.shtml`,
            job_description_text: '',
            external_ref: `liepin:${jobId}`,
          });
        }
      } catch (e) { console.warn('[liepin] Card parse failed:', (e as Error).message); }
    }

    // Skip JD detail fetch — passthrough mode, saves ~75s of overseas timeouts
    console.log(`[liepin] Skipping JD detail fetch (passthrough mode, ${jobs.length} jobs)`);

    console.log(`[liepin] Discovery complete: ${jobs.length} jobs found`);
    return jobs;

  } catch (err) {
    console.error(`[liepin] Discovery error: ${err instanceof Error ? err.message : err}`);
    return [];
  } finally {
    await page.close();
    await context.close();
  }
}

/**
 * Submit application via 猎聘 web apply.
 * Passthrough: uses platform-stored resume, no file upload.
 *
 * Flow: Navigate detail → dedup check (已投递) → click 立即投递 → detect 已投递
 */
export async function submitLiepinApplication(params: {
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

    // Dedup: check for 已投递 state
    const pageText = await page.textContent('body') || '';
    if (/已投递|已申请|已沟通/.test(pageText)) {
      return { outcome: 'soft_failure', errorMessage: 'Already applied (已投递)' };
    }

    // Click apply button
    const applyBtn = page.locator('button:has-text("立即投递"), button:has-text("投递简历"), button:has-text("立即申请"), .apply-btn').first();
    if (!(await applyBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      return { outcome: 'soft_failure', errorMessage: 'Apply button not found' };
    }

    await applyBtn.click();
    await randomDelay(DELAY.page[0], DELAY.page[1]);

    // Check for resume selection dialog
    const resumeDialog = page.locator('.resume-select-dialog, .resume-dialog, .delivery-dialog').first();
    if (await resumeDialog.isVisible().catch(() => false)) {
      const firstResume = resumeDialog.locator('.resume-item, input[type="radio"]').first();
      if (await firstResume.isVisible().catch(() => false)) {
        await firstResume.click();
        await randomDelay(DELAY.click[0], DELAY.click[1]);
      }
      const confirmBtn = resumeDialog.locator('button:has-text("确定"), button:has-text("投递"), button:has-text("确认投递")').first();
      if (await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click();
        await randomDelay(DELAY.page[0], DELAY.page[1]);
      }
    }

    // Detect success
    const finalText = await page.textContent('body') || '';
    if (/已投递|投递成功|申请成功/.test(finalText)) {
      return { outcome: 'success', confirmationSignal: '已投递 state detected' };
    }

    return { outcome: 'soft_failure', errorMessage: 'Apply clicked but no 已投递 confirmation' };

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[liepin] Submit error: ${msg}`);
    return { outcome: 'soft_failure', errorMessage: msg };

  } finally {
    await page.close();
    await context.close();
  }
}

/**
 * Capability-level health check.
 */
export async function checkLiepinCapabilityHealth(params: {
  sessionCookies: string;
}): Promise<Record<string, 'healthy' | 'degraded' | 'blocked' | 'unknown'>> {
  const context = await createContext({ cookies: params.sessionCookies });
  const page = await context.newPage();
  const caps: Record<string, 'healthy' | 'degraded' | 'blocked' | 'unknown'> = {
    search: 'unknown', detail: 'unknown', apply: 'unknown', chat: 'unknown', resume: 'unknown',
  };

  try {
    await page.goto('https://www.liepin.com/zhaopin/?key=test', { waitUntil: 'domcontentloaded', timeout: 15000 });
    caps.search = isLoginPage(page) ? 'blocked' : 'healthy';

    if (caps.search === 'healthy') {
      const firstLink = await page.locator('a[href*="/job/"]').first().getAttribute('href').catch(() => null);
      if (firstLink) {
        const detailUrl = firstLink.startsWith('http') ? firstLink : `https://www.liepin.com${firstLink}`;
        await page.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        const hasJd = await page.locator('.job-intro-container, .job-description').first().isVisible().catch(() => false);
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
  return url.includes('/login') || url.includes('/acountLogin') || url.includes('/user/login');
}
