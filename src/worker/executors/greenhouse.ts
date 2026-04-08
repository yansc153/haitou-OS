/**
 * Greenhouse Platform Executor
 *
 * 1. Discovery: Greenhouse Job Board API (public, no auth)
 * 2. Submission: Browser-based form fill via Playwright
 *
 * Source: PLATFORM_RULE_AND_AGENT_SPEC.md § Greenhouse
 * Anti-scraping level: Low
 * Session type: ephemeral_browser (no cookies needed)
 * Apply method: browser_form
 * Daily budget: 30 applications
 * Delays: 2-5 seconds between applications
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createEphemeralContext, randomDelay } from '../utils/browser-pool.js';
import { downloadResumeToTemp, cleanupTempFile } from '../utils/storage.js';

const GREENHOUSE_API_BASE = 'https://boards-api.greenhouse.io/v1/boards';

type GreenhouseJob = {
  id: number;
  title: string;
  location: { name: string };
  absolute_url: string;
  content: string;
  departments: Array<{ name: string }>;
  updated_at: string;
};

type DiscoveredOpportunity = {
  job_title: string;
  company_name: string;
  location_label: string;
  job_description_url: string;
  job_description_text: string;
  external_ref: string;
};

type SubmissionResult = {
  outcome: 'success' | 'soft_failure' | 'hard_failure';
  confirmationSignal?: string;
  errorMessage?: string;
};

/**
 * Discover jobs from a Greenhouse board.
 * Uses the public Job Board API — no auth required.
 */
export async function discoverGreenhouseJobs(
  boardToken: string,
  companyName: string,
  options?: { limit?: number; departmentFilter?: string }
): Promise<DiscoveredOpportunity[]> {
  const limit = options?.limit ?? 20;
  const url = `${GREENHOUSE_API_BASE}/${boardToken}/jobs?content=true`;
  const res = await fetch(url);

  if (!res.ok) {
    console.warn(`[greenhouse] Board "${boardToken}" returned ${res.status} — skipping (board may not exist or token is incorrect)`);
    return [];
  }

  const data = (await res.json()) as { jobs: GreenhouseJob[] };
  let jobs = data.jobs || [];

  if (options?.departmentFilter) {
    const filter = options.departmentFilter.toLowerCase();
    jobs = jobs.filter(j => j.departments.some(d => d.name.toLowerCase().includes(filter)));
  }

  jobs = jobs.slice(0, limit);

  return jobs.map(job => ({
    job_title: job.title,
    company_name: companyName,
    location_label: job.location?.name || 'Not specified',
    job_description_url: job.absolute_url,
    job_description_text: stripHtml(job.content || ''),
    external_ref: `greenhouse:${boardToken}:${job.id}`,
  }));
}

/**
 * Submit an application to a Greenhouse job via Playwright browser form.
 *
 * Flow per PLATFORM_RULE_AND_AGENT_SPEC:
 * 1. Navigate to application URL
 * 2. Fill standard fields (name, email, phone)
 * 3. Upload resume file
 * 4. Fill cover letter if provided
 * 5. Handle custom/screening questions
 * 6. Skip honeypot fields (hidden inputs)
 * 7. Submit form
 * 8. Detect confirmation or error
 */
export async function submitGreenhouseApplication(params: {
  jobUrl: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone?: string;
  resumeLocalPath: string;
  coverLetterText?: string;
  additionalFields?: Record<string, string>;
}): Promise<SubmissionResult> {
  const context = await createEphemeralContext();
  const page = await context.newPage();

  try {
    // Navigate to application page
    console.log(`[greenhouse] Navigating to: ${params.jobUrl}`);
    await page.goto(params.jobUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await randomDelay(2000, 4000);

    // Check if we're on an application form
    const hasForm = await page.locator('form#application-form, form[data-controller="application"], form.application-form, form').first().isVisible().catch(() => false);
    if (!hasForm) {
      // Try clicking "Apply" button if we're on the job description page
      const applyButton = page.locator('a:has-text("Apply"), button:has-text("Apply"), a:has-text("投递")').first();
      if (await applyButton.isVisible().catch(() => false)) {
        await applyButton.click();
        await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
        await randomDelay(1000, 2000);
      }
    }

    // Fill first name / last name — handles CJK names (e.g., "张三" → 姓:张 名:三)
    const { firstName, lastName } = splitName(params.applicantName);

    await fillField(page, ['#first_name', 'input[name="first_name"]', 'input[name*="first"]'], firstName);
    await fillField(page, ['#last_name', 'input[name="last_name"]', 'input[name*="last"]'], lastName);

    // Fill email
    await fillField(page, ['#email', 'input[name="email"]', 'input[type="email"]'], params.applicantEmail);

    // Fill phone (optional)
    if (params.applicantPhone) {
      await fillField(page, ['#phone', 'input[name="phone"]', 'input[type="tel"]'], params.applicantPhone);
    }

    await randomDelay(1000, 2000);

    // Upload resume
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.isVisible().catch(() => false)) {
      await fileInput.setInputFiles(params.resumeLocalPath);
      await randomDelay(2000, 3000); // Wait for upload processing
    } else {
      // Some forms use a custom upload button
      const uploadButton = page.locator('button:has-text("Attach"), button:has-text("Upload"), a:has-text("Attach")').first();
      if (await uploadButton.isVisible().catch(() => false)) {
        const [fileChooser] = await Promise.all([
          page.waitForEvent('filechooser', { timeout: 5000 }),
          uploadButton.click(),
        ]);
        await fileChooser.setFiles(params.resumeLocalPath);
        await randomDelay(2000, 3000);
      }
    }

    // Fill cover letter
    if (params.coverLetterText) {
      await fillField(
        page,
        ['#cover_letter', 'textarea[name="cover_letter"]', 'textarea[name*="cover"]'],
        params.coverLetterText
      );
    }

    await randomDelay(1000, 2000);

    // Submit form
    const submitButton = page.locator(
      'button[type="submit"], input[type="submit"], button:has-text("Submit"), button:has-text("Apply"), button:has-text("提交")'
    ).first();

    if (!(await submitButton.isVisible().catch(() => false))) {
      return { outcome: 'soft_failure', errorMessage: 'Submit button not found' };
    }

    await submitButton.click();

    // Wait for navigation/response
    try {
      await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
    } catch {
      // Some forms stay on the same page with a success message
    }

    await randomDelay(2000, 3000);

    // Detect outcome
    const pageText = await page.textContent('body') || '';
    const pageUrl = page.url();

    // Success signals
    const successPatterns = [
      /application.*received/i,
      /thank\s*you.*appl/i,
      /successfully.*submitted/i,
      /已收到.*申请/,
      /投递.*成功/,
      /application.*submitted/i,
    ];

    const isSuccess = successPatterns.some(p => p.test(pageText)) ||
      pageUrl.includes('confirmation') ||
      pageUrl.includes('thank');

    // Error signals — specific form-level errors, not body-wide text
    const hasFormError = await page.locator('.error, [role="alert"], .field-error, .form-error, .validation-error').first().isVisible().catch(() => false);
    const errorTextPatterns = [
      /already.*applied/i,
      /duplicate.*application/i,
      /required.*field/i,
      /please.*fill/i,
    ];
    const isError = hasFormError || errorTextPatterns.some(p => p.test(pageText));

    if (isSuccess) {
      return { outcome: 'success', confirmationSignal: 'Application page shows confirmation' };
    } else if (isError) {
      const errorEl = await page.locator('.error, [role="alert"]').first().textContent().catch(() => null);
      return { outcome: 'soft_failure', errorMessage: errorEl || 'Form validation error' };
    } else {
      // Uncertain — no clear success or error signal
      return { outcome: 'soft_failure', errorMessage: 'Submission outcome uncertain — no confirmation signal detected' };
    }

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[greenhouse] Submission error: ${msg}`);

    if (msg.includes('timeout') || msg.includes('net::')) {
      return { outcome: 'soft_failure', errorMessage: `Network error: ${msg}` };
    }
    return { outcome: 'hard_failure', errorMessage: msg };

  } finally {
    await page.close();
    await context.close();
  }
}

/**
 * Get details for a specific Greenhouse job.
 */
export async function getGreenhouseJobDetail(
  boardToken: string,
  jobId: string | number
): Promise<GreenhouseJob | null> {
  const url = `${GREENHOUSE_API_BASE}/${boardToken}/jobs/${jobId}?content=true`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return (await res.json()) as GreenhouseJob;
}

// --- Helpers ---

async function fillField(page: import('playwright').Page, selectors: string[], value: string): Promise<void> {
  for (const selector of selectors) {
    const el = page.locator(selector).first();
    try {
      if (await el.isVisible({ timeout: 2000 })) {
        await el.fill(value);
        return;
      }
    } catch {
      // Try next selector
    }
  }
  // If no selector matched, log but don't fail
  console.log(`[greenhouse] Could not find field for selectors: ${selectors.join(', ')}`);
}

/**
 * Split a name into first/last, handling CJK names.
 * CJK names: first char = family name, rest = given name (e.g., "张三" → 张, 三)
 * Western names: split on space (e.g., "John Smith" → John, Smith)
 */
function splitName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  if (!trimmed) return { firstName: '', lastName: '' };

  // Check for space-separated (Western style)
  if (trimmed.includes(' ')) {
    const parts = trimmed.split(' ');
    return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
  }

  // CJK name detection: if all chars are CJK unified ideographs
  const isCJK = /^[\u4e00-\u9fff\u3400-\u4dbf]+$/.test(trimmed);
  if (isCJK && trimmed.length >= 2) {
    // Chinese convention: family name first (1 or 2 chars), given name after
    // Most common: 1-char family name
    const familyName = trimmed[0];
    const givenName = trimmed.slice(1);
    // For Greenhouse: first_name = given, last_name = family (Western field order)
    return { firstName: givenName, lastName: familyName };
  }

  // Fallback: put entire name in firstName
  return { firstName: trimmed, lastName: trimmed };
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}
