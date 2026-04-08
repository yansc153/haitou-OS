/**
 * LinkedIn Platform Executor (Supervised Mode)
 *
 * Anti-scraping: Very High | Session: cookie (li_at) | Headless: No (stealth)
 * Apply method: easy_apply | Messaging: http_inbox
 * Daily budget: 15 Easy Apply, 10 messages
 * Delays: 3-8s page loads, 1-3s clicks
 *
 * Source: PLATFORM_RULE_AND_AGENT_SPEC.md § LinkedIn
 */

import { createContext, randomDelay } from '../utils/browser-pool.js';
import type { BrowserContext, Page } from 'playwright';

const DAILY_BUDGET = { applications: 15, messages: 10 };
const DELAY = { page: [3000, 8000] as const, click: [1000, 3000] as const };

// --- Discovery ---

type LinkedInJob = {
  job_title: string;
  company_name: string;
  location_label: string;
  job_description_url: string;
  job_description_text: string;
  external_ref: string;
  is_easy_apply: boolean;
};

/**
 * Discover LinkedIn jobs via authenticated search.
 * Navigates linkedin.com/jobs/search with keywords and extracts results.
 */
export async function discoverLinkedInJobs(params: {
  sessionCookies: string;
  keywords: string[];
  location?: string;
  limit?: number;
}): Promise<LinkedInJob[]> {
  const limit = params.limit ?? 10;
  const context = await createContext({ cookies: params.sessionCookies });
  const page = await context.newPage();

  try {
    const keyword = params.keywords.join(' ');
    const searchUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(keyword)}${params.location ? `&location=${encodeURIComponent(params.location)}` : ''}&f_AL=true`; // f_AL=true = Easy Apply filter

    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await randomDelay(DELAY.page[0], DELAY.page[1]);

    // Check for auth wall / CAPTCHA
    if (await isAuthWall(page)) {
      throw new Error('session_expired: LinkedIn auth wall detected');
    }

    // Extract job cards
    const jobs: LinkedInJob[] = [];
    const cards = page.locator('.jobs-search-results__list-item, .job-card-container');
    const count = Math.min(await cards.count(), limit);

    for (let i = 0; i < count; i++) {
      try {
        const card = cards.nth(i);
        await card.scrollIntoViewIfNeeded();
        await randomDelay(500, 1000);

        const title = await card.locator('.job-card-list__title, .artdeco-entity-lockup__title').first().textContent() || '';
        const company = await card.locator('.job-card-container__primary-description, .artdeco-entity-lockup__subtitle').first().textContent() || '';
        const location = await card.locator('.job-card-container__metadata-item, .artdeco-entity-lockup__caption').first().textContent() || '';

        const linkEl = card.locator('a[href*="/jobs/view/"]').first();
        const href = await linkEl.getAttribute('href') || '';
        const jobId = href.match(/\/jobs\/view\/(\d+)/)?.[1] || '';

        const isEasyApply = (await card.locator('.job-card-container__apply-method, [aria-label*="Easy Apply"]').count()) > 0;

        if (title.trim() && jobId) {
          jobs.push({
            job_title: title.trim(),
            company_name: company.trim(),
            location_label: location.trim(),
            job_description_url: `https://www.linkedin.com/jobs/view/${jobId}/`,
            job_description_text: '', // Would need clicking into detail
            external_ref: `linkedin:${jobId}`,
            is_easy_apply: isEasyApply,
          });
        }
      } catch {
        // Skip card on error, continue with next
      }
    }

    // Load JD text for top results (click into detail view)
    for (const job of jobs.slice(0, 5)) {
      try {
        await page.goto(job.job_description_url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await randomDelay(DELAY.page[0], DELAY.page[1]);

        if (await isAuthWall(page)) {
          console.warn('[linkedin] Auth wall on job detail, stopping JD fetch');
          break;
        }

        const jd = await page.locator('.jobs-description__content, .jobs-box__html-content, .jobs-description-content__text').first().textContent();
        job.job_description_text = jd?.trim() || '';
      } catch { /* skip detail */ }
    }

    return jobs;

  } catch (err) {
    console.error(`[linkedin] Discovery error: ${err instanceof Error ? err.message : err}`);
    return [];
  } finally {
    await page.close();
    await context.close();
  }
}

// --- Easy Apply ---

/**
 * Submit via LinkedIn Easy Apply.
 * Multi-step modal: contact info → resume → screening Qs → review → submit.
 */
export async function submitLinkedInEasyApply(params: {
  jobUrl: string;
  sessionCookies: string;
  resumeLocalPath: string;
  applicantName?: string;
  applicantEmail?: string;
  applicantPhone?: string;
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

    if (await isAuthWall(page)) {
      return { outcome: 'hard_failure', errorMessage: 'Session expired — auth wall detected' };
    }

    // Click Easy Apply button
    const easyApplyBtn = page.locator('button.jobs-apply-button, button:has-text("Easy Apply"), button:has-text("轻松申请")').first();
    if (!(await easyApplyBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      return { outcome: 'soft_failure', errorMessage: 'Easy Apply button not found — may require external apply' };
    }

    await easyApplyBtn.click();
    await randomDelay(DELAY.click[0], DELAY.click[1]);

    // Navigate through multi-step modal
    const MAX_STEPS = 8;
    let hasUploadedResume = false;

    for (let step = 0; step < MAX_STEPS; step++) {
      await randomDelay(1000, 2000);

      // Check for submit/review button (final step)
      const submitBtn = page.locator('button[aria-label*="Submit application"], button[aria-label*="提交申请"], button:has-text("Submit application")').first();
      if (await submitBtn.isVisible().catch(() => false)) {
        await submitBtn.click();
        await randomDelay(DELAY.page[0], DELAY.page[1]);

        const dismissed = await page.locator('.artdeco-modal--is-open:has-text("Application submitted"), .artdeco-modal--is-open:has-text("已提交")').isVisible({ timeout: 5000 }).catch(() => false);
        const confirmText = await page.textContent('body') || '';
        if (dismissed || /application.*submitted/i.test(confirmText) || /已提交/.test(confirmText)) {
          return { outcome: 'success', confirmationSignal: 'LinkedIn Easy Apply confirmation detected' };
        }
        return { outcome: 'soft_failure', errorMessage: 'Submitted but no clear confirmation' };
      }

      // Check for Review button
      const reviewBtn = page.locator('button[aria-label*="Review"], button:has-text("Review your application")').first();
      if (await reviewBtn.isVisible().catch(() => false)) {
        await reviewBtn.click();
        continue;
      }

      // Upload resume (once only)
      if (!hasUploadedResume && params.resumeLocalPath) {
        const fileInput = page.locator('.jobs-document-upload-redesign-card__container input[type="file"], input[type="file"]').first();
        if (await fileInput.count() > 0) {
          await fileInput.setInputFiles(params.resumeLocalPath);
          hasUploadedResume = true;
          await randomDelay(2000, 3000);
        }
      }

      // Fill phone if visible
      if (params.applicantPhone) {
        const phoneField = page.locator('input[name*="phoneNumber"], input[type="tel"]').first();
        if (await phoneField.isVisible().catch(() => false)) {
          await phoneField.fill(params.applicantPhone);
        }
      }

      // Click Next button to advance
      const nextBtn = page.locator('button[aria-label*="Continue"], button[aria-label*="Next"], button:has-text("Next"), button:has-text("下一步")').first();
      if (await nextBtn.isVisible().catch(() => false)) {
        await nextBtn.click();
      } else {
        break;
      }
    }

    return { outcome: 'soft_failure', errorMessage: 'Easy Apply modal did not reach submit step' };

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[linkedin] Easy Apply error: ${msg}`);

    if (msg.includes('captcha') || msg.includes('security')) {
      return { outcome: 'hard_failure', errorMessage: `Security challenge: ${msg}` };
    }
    return { outcome: 'soft_failure', errorMessage: msg };

  } finally {
    await page.close();
    await context.close();
  }
}

// --- Messaging ---

/**
 * Send a first-contact message (InMail or connection message).
 */
export async function sendLinkedInMessage(params: {
  sessionCookies: string;
  recipientProfileUrl: string;
  messageText: string;
}): Promise<{ outcome: 'success' | 'soft_failure' | 'hard_failure'; errorMessage?: string }> {
  const context = await createContext({ cookies: params.sessionCookies });
  const page = await context.newPage();

  try {
    await page.goto(params.recipientProfileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await randomDelay(DELAY.page[0], DELAY.page[1]);

    if (await isAuthWall(page)) {
      return { outcome: 'hard_failure', errorMessage: 'Session expired' };
    }

    // Click Message button on profile
    const msgBtn = page.locator('button:has-text("Message"), button:has-text("发消息"), a:has-text("Message")').first();
    if (!(await msgBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      return { outcome: 'soft_failure', errorMessage: 'Message button not found' };
    }

    await msgBtn.click();
    await randomDelay(DELAY.click[0], DELAY.click[1]);

    // Type message in the compose box
    const textBox = page.locator('.msg-form__contenteditable, div[role="textbox"][aria-label*="message"], div[contenteditable="true"]').first();
    if (!(await textBox.isVisible({ timeout: 5000 }).catch(() => false))) {
      return { outcome: 'soft_failure', errorMessage: 'Message compose box not found' };
    }

    await textBox.click();
    await page.keyboard.type(params.messageText, { delay: 30 }); // Human-like typing speed
    await randomDelay(DELAY.click[0], DELAY.click[1]);

    // Click send
    const sendBtn = page.locator('button.msg-form__send-button, button[type="submit"]:has-text("Send"), button:has-text("发送")').first();
    await sendBtn.click();
    await randomDelay(2000, 3000);

    return { outcome: 'success' };

  } catch (err) {
    return { outcome: 'soft_failure', errorMessage: err instanceof Error ? err.message : 'Unknown error' };
  } finally {
    await page.close();
    await context.close();
  }
}

/**
 * Poll LinkedIn inbox for new messages.
 */
export async function pollLinkedInInbox(params: {
  sessionCookies: string;
  sinceTimestamp?: string;
}): Promise<Array<{ threadId: string; senderName: string; messageText: string; receivedAt: string }>> {
  const context = await createContext({ cookies: params.sessionCookies });
  const page = await context.newPage();

  try {
    await page.goto('https://www.linkedin.com/messaging/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await randomDelay(DELAY.page[0], DELAY.page[1]);

    if (await isAuthWall(page)) return [];

    const messages: Array<{ threadId: string; senderName: string; messageText: string; receivedAt: string }> = [];
    const threads = page.locator('.msg-conversation-listitem');
    const count = Math.min(await threads.count(), 10);

    for (let i = 0; i < count; i++) {
      try {
        const thread = threads.nth(i);
        const sender = await thread.locator('.msg-conversation-listitem__participant-names').textContent() || '';
        const preview = await thread.locator('.msg-conversation-card__message-snippet-body').textContent() || '';
        const time = await thread.locator('time').getAttribute('datetime') || new Date().toISOString();
        const threadLink = await thread.locator('a').getAttribute('href') || '';
        const threadId = threadLink.match(/thread\/(.+?)\//)?.[1] || `thread-${i}`;

        messages.push({
          threadId,
          senderName: sender.trim(),
          messageText: preview.trim(),
          receivedAt: time,
        });
      } catch { /* skip */ }
    }

    return messages;

  } catch {
    return [];
  } finally {
    await page.close();
    await context.close();
  }
}

/**
 * Check LinkedIn session health via lightweight page fetch.
 */
export async function checkLinkedInSessionHealth(params: {
  sessionCookies: string;
}): Promise<{ healthy: boolean; reason?: string }> {
  const context = await createContext({ cookies: params.sessionCookies });
  const page = await context.newPage();

  try {
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 15000 });

    if (await isAuthWall(page)) {
      return { healthy: false, reason: 'Session expired — redirected to login' };
    }

    return { healthy: true };

  } catch (err) {
    return { healthy: false, reason: err instanceof Error ? err.message : 'Health check failed' };
  } finally {
    await page.close();
    await context.close();
  }
}

// --- Helpers ---

async function isAuthWall(page: Page): Promise<boolean> {
  const url = page.url();
  if (url.includes('/login') || url.includes('/authwall') || url.includes('/uas/login')) return true;

  const loginForm = page.locator('form#login, .login__form, #username').first();
  return loginForm.isVisible({ timeout: 2000 }).catch(() => false);
}
