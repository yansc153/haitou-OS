-- AI-generated search keywords stored on profile_baseline
-- Populated by keyword-generation skill at team-start
ALTER TABLE profile_baseline
  ADD COLUMN IF NOT EXISTS search_keywords jsonb DEFAULT NULL;

COMMENT ON COLUMN profile_baseline.search_keywords IS
  'AI-generated: {en_keywords[], zh_keywords[], target_companies[], primary_domain, seniority_bracket, reasoning}';
