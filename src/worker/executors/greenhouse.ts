/**
 * Greenhouse Platform Executor
 *
 * Two modes:
 * 1. Discovery: Greenhouse Job Board API (public, no auth)
 * 2. Submission: Browser-based form fill via Playwright
 *
 * Source: PLATFORM_RULE_AND_AGENT_SPEC.md § Greenhouse
 */

import type { SupabaseClient } from '@supabase/supabase-js';

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
    throw new Error(`Greenhouse API error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as { jobs: GreenhouseJob[] };
  let jobs = data.jobs || [];

  // Apply department filter if specified
  if (options?.departmentFilter) {
    const filter = options.departmentFilter.toLowerCase();
    jobs = jobs.filter((j) =>
      j.departments.some((d) => d.name.toLowerCase().includes(filter))
    );
  }

  // Limit results
  jobs = jobs.slice(0, limit);

  return jobs.map((job) => ({
    job_title: job.title,
    company_name: companyName,
    location_label: job.location?.name || 'Not specified',
    job_description_url: job.absolute_url,
    job_description_text: stripHtml(job.content || ''),
    external_ref: `greenhouse:${boardToken}:${job.id}`,
  }));
}

/**
 * Submit an application to a Greenhouse job via browser form.
 *
 * In M5 this is a structured stub that records what WOULD happen.
 * Real Playwright execution is wired in later (requires browser infra on Fly.io).
 */
export async function submitGreenhouseApplication(params: {
  jobUrl: string;
  applicantName: string;
  applicantEmail: string;
  resumeStoragePath: string;
  coverLetterText?: string;
  additionalFields?: Record<string, string>;
}): Promise<{
  outcome: 'success' | 'soft_failure' | 'hard_failure';
  confirmationSignal?: string;
  errorMessage?: string;
}> {
  // M5 stub: In production, this would:
  // 1. Launch Playwright browser
  // 2. Navigate to jobUrl
  // 3. Fill form fields (name, email, resume upload, cover letter, custom fields)
  // 4. Handle CSRF tokens and honeypot fields
  // 5. Submit form
  // 6. Detect confirmation page or error
  //
  // For now, simulate success for testing the pipeline flow.
  console.log(`[greenhouse] Stub submission to: ${params.jobUrl}`);
  console.log(`[greenhouse] Applicant: ${params.applicantName} <${params.applicantEmail}>`);
  console.log(`[greenhouse] Resume: ${params.resumeStoragePath}`);
  if (params.coverLetterText) {
    console.log(`[greenhouse] Cover letter: ${params.coverLetterText.slice(0, 100)}...`);
  }

  return {
    outcome: 'success',
    confirmationSignal: 'Stub: application submitted successfully',
  };
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
