/**
 * Lever Platform Executor
 *
 * 1. Discovery: Lever Postings API (public, no auth)
 * 2. Submission: Browser-based form fill via Playwright (ephemeral, no cookies)
 *
 * Anti-scraping: Low | Session: ephemeral_browser | Headless: Yes
 * Daily budget: 30 | Delays: 2-5s
 *
 * Source: PLATFORM_RULE_AND_AGENT_SPEC.md § Lever
 */

import { createEphemeralContext, randomDelay } from '../utils/browser-pool.js';

const LEVER_API_BASE = 'https://api.lever.co/v0/postings';

type LeverPosting = {
  id: string;
  text: string;
  categories: { location?: string; team?: string; department?: string; commitment?: string };
  hostedUrl: string;
  applyUrl: string;
  descriptionPlain: string;
  additional?: string;
  createdAt: number;
};

type DiscoveredOpportunity = {
  job_title: string;
  company_name: string;
  location_label: string;
  job_description_url: string;
  job_description_text: string;
  external_ref: string;
};

/**
 * Discover jobs via Lever Postings API (public, no auth).
 */
export async function discoverLeverJobs(
  companySlug: string,
  companyName: string,
  options?: { limit?: number; teamFilter?: string }
): Promise<DiscoveredOpportunity[]> {
  const limit = options?.limit ?? 20;
  const url = `${LEVER_API_BASE}/${companySlug}`;
  const res = await fetch(url);

  if (!res.ok) {
    console.log(`[lever] API ${res.status} for ${companySlug} — skipping`);
    return [];
  }

  let postings = (await res.json()) as LeverPosting[];

  if (options?.teamFilter) {
    const filter = options.teamFilter.toLowerCase();
    postings = postings.filter(p =>
      (p.categories.team || '').toLowerCase().includes(filter) ||
      (p.categories.department || '').toLowerCase().includes(filter)
    );
  }

  return postings.slice(0, limit).map(p => ({
    job_title: p.text,
    company_name: companyName,
    location_label: p.categories.location || 'Not specified',
    job_description_url: p.hostedUrl,
    job_description_text: p.descriptionPlain || '',
    external_ref: `lever:${companySlug}:${p.id}`,
  }));
}

/**
 * Submit application via Lever's browser form.
 * Lever forms follow a standard layout: name, email, phone, resume, cover letter, custom questions.
 */
export async function submitLeverApplication(params: {
  jobUrl: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone?: string;
  resumeLocalPath: string;
  coverLetterText?: string;
}): Promise<{
  outcome: 'success' | 'soft_failure' | 'hard_failure';
  confirmationSignal?: string;
  errorMessage?: string;
}> {
  const context = await createEphemeralContext();
  const page = await context.newPage();

  try {
    // Lever application pages are at {hostedUrl}/apply — append /apply to hosted URL
    const cleanUrl = params.jobUrl.replace(/\/+$/, ''); // strip trailing slashes
    const applyUrl = `${cleanUrl}/apply`;
    console.log(`[lever] Navigating to: ${applyUrl}`);

    await page.goto(applyUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await randomDelay(2000, 5000);

    // If we're on the job page (not apply), click the Apply button
    const applyButton = page.locator('a.postings-btn[href*="apply"], a:has-text("Apply for this job"), button:has-text("Apply")').first();
    if (await applyButton.isVisible().catch(() => false)) {
      await applyButton.click();
      await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
      await randomDelay(1000, 2000);
    }

    // Fill name
    await fillField(page, ['input[name="name"]', 'input[name="full_name"]', '#name'], params.applicantName);

    // Fill email
    await fillField(page, ['input[name="email"]', 'input[type="email"]', '#email'], params.applicantEmail);

    // Fill phone
    if (params.applicantPhone) {
      await fillField(page, ['input[name="phone"]', 'input[type="tel"]', '#phone'], params.applicantPhone);
    }

    await randomDelay(1000, 2000);

    // Upload resume
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.count() > 0) {
      await fileInput.setInputFiles(params.resumeLocalPath);
      await randomDelay(2000, 3000);
    }

    // Fill cover letter
    if (params.coverLetterText) {
      await fillField(page, [
        'textarea[name="comments"]',
        'textarea[name="coverLetter"]',
        'textarea[name*="cover"]',
      ], params.coverLetterText);
    }

    await randomDelay(1000, 2000);

    // Submit
    const submitBtn = page.locator('button[type="submit"], input[type="submit"], button:has-text("Submit application")').first();
    if (!(await submitBtn.isVisible().catch(() => false))) {
      return { outcome: 'soft_failure', errorMessage: 'Submit button not found' };
    }

    await submitBtn.click();

    try {
      await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
    } catch { /* some forms update in-place */ }

    await randomDelay(2000, 3000);

    // Detect outcome
    const pageText = await page.textContent('body') || '';
    const successPatterns = [
      /application.*submitted/i,
      /thank.*you/i,
      /successfully.*applied/i,
    ];

    if (successPatterns.some(p => p.test(pageText))) {
      return { outcome: 'success', confirmationSignal: 'Lever confirmation page detected' };
    }

    const hasFormError = await page.locator('.error, [role="alert"], .form-error').first().isVisible().catch(() => false);
    if (hasFormError) {
      const errorText = await page.locator('.error, [role="alert"]').first().textContent().catch(() => null);
      return { outcome: 'soft_failure', errorMessage: errorText || 'Form validation error' };
    }

    return { outcome: 'soft_failure', errorMessage: 'Submission outcome uncertain' };

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[lever] Submission error: ${msg}`);
    if (msg.includes('timeout') || msg.includes('net::')) {
      return { outcome: 'soft_failure', errorMessage: `Network error: ${msg}` };
    }
    return { outcome: 'hard_failure', errorMessage: msg };

  } finally {
    await page.close();
    await context.close();
  }
}

export async function getLeverPostingDetail(
  companySlug: string,
  postingId: string
): Promise<LeverPosting | null> {
  const url = `${LEVER_API_BASE}/${companySlug}/${postingId}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return (await res.json()) as LeverPosting;
}

async function fillField(page: import('playwright').Page, selectors: string[], value: string): Promise<void> {
  for (const selector of selectors) {
    const el = page.locator(selector).first();
    try {
      if (await el.isVisible({ timeout: 2000 })) {
        await el.fill(value);
        return;
      }
    } catch { /* try next */ }
  }
  console.log(`[lever] Could not find field for selectors: ${selectors.join(', ')}`);
}
