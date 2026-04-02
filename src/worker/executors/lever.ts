/**
 * Lever Platform Executor
 *
 * 1. Discovery: Lever Postings API (public, no auth)
 * 2. Submission: Browser-based form fill (same pattern as Greenhouse)
 *
 * Source: PLATFORM_RULE_AND_AGENT_SPEC.md § Lever
 */

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

export async function discoverLeverJobs(
  companySlug: string,
  companyName: string,
  options?: { limit?: number; teamFilter?: string }
): Promise<DiscoveredOpportunity[]> {
  const limit = options?.limit ?? 20;
  const url = `${LEVER_API_BASE}/${companySlug}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Lever API error: ${res.status} ${res.statusText}`);
  }

  let postings = (await res.json()) as LeverPosting[];

  if (options?.teamFilter) {
    const filter = options.teamFilter.toLowerCase();
    postings = postings.filter((p) =>
      (p.categories.team || '').toLowerCase().includes(filter) ||
      (p.categories.department || '').toLowerCase().includes(filter)
    );
  }

  return postings.slice(0, limit).map((p) => ({
    job_title: p.text,
    company_name: companyName,
    location_label: p.categories.location || 'Not specified',
    job_description_url: p.hostedUrl,
    job_description_text: p.descriptionPlain || '',
    external_ref: `lever:${companySlug}:${p.id}`,
  }));
}

export async function submitLeverApplication(params: {
  applyUrl: string;
  applicantName: string;
  applicantEmail: string;
  resumeStoragePath: string;
  coverLetterText?: string;
}): Promise<{
  outcome: 'success' | 'soft_failure' | 'hard_failure';
  confirmationSignal?: string;
  errorMessage?: string;
}> {
  // Stub — same pattern as Greenhouse. Real Playwright execution in later iteration.
  console.log(`[lever] Stub submission to: ${params.applyUrl}`);
  return {
    outcome: 'success',
    confirmationSignal: 'Stub: Lever application submitted successfully',
  };
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
