-- Remove duplicate opportunities: keep the oldest (first discovered) per external_ref per team.
-- external_ref is the platform-specific unique ID (e.g., greenhouse:stripe:12345)
-- which correctly distinguishes different postings even with same company+title.

DELETE FROM opportunity
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY team_id, external_ref
             ORDER BY created_at ASC
           ) AS rn
    FROM opportunity
    WHERE external_ref IS NOT NULL
  ) ranked
  WHERE rn > 1
);

-- Unique index: one opportunity per external_ref per team
-- This is the correct dedupe key per PLATFORM_RULE_AND_AGENT_SPEC
CREATE UNIQUE INDEX IF NOT EXISTS idx_opportunity_team_external_ref
  ON opportunity (team_id, external_ref)
  WHERE external_ref IS NOT NULL;

-- Drop the overly-coarse company+title index if it exists
DROP INDEX IF EXISTS idx_opportunity_team_company_title;
