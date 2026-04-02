-- M0: Core Entities
-- User, Team, OnboardingDraft, ResumeAsset, ProfileBaseline,
-- SubmissionProfile, AgentInstance, AgentStateTransition, UserPreferences

-- Note: "user" is a reserved word in PostgreSQL, quoted throughout.

CREATE TABLE "user" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  display_name text NOT NULL,
  avatar_url text,
  locale locale_code NOT NULL DEFAULT 'en',
  timezone text NOT NULL DEFAULT 'UTC',
  auth_provider text NOT NULL DEFAULT 'google',
  auth_provider_id text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE team (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES "user"(id),
  name text NOT NULL DEFAULT '',
  status team_status NOT NULL DEFAULT 'draft',
  runtime_status team_runtime_status NOT NULL DEFAULT 'idle',
  strategy_mode strategy_mode NOT NULL DEFAULT 'balanced',
  coverage_scope coverage_scope NOT NULL DEFAULT 'global_english',
  pause_origin pause_origin,
  onboarding_draft_id uuid,
  plan_tier plan_tier NOT NULL DEFAULT 'free',
  current_profile_baseline_id uuid,
  execution_readiness_status execution_readiness_level NOT NULL DEFAULT 'not_ready',
  execution_readiness_blockers jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  started_at timestamptz,
  paused_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE onboarding_draft (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES "user"(id),
  team_id uuid REFERENCES team(id),
  status onboarding_status NOT NULL DEFAULT 'resume_required',
  resume_asset_id uuid,
  resume_upload_status resume_upload_status NOT NULL DEFAULT 'missing',
  resume_parse_error_code text,
  resume_parse_error_message text,
  answered_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed_question_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE resume_asset (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES "user"(id),
  file_name text NOT NULL,
  file_size_bytes integer NOT NULL,
  file_mime_type text NOT NULL,
  storage_path text NOT NULL,
  upload_status resume_upload_status NOT NULL DEFAULT 'missing',
  parse_status resume_parse_status NOT NULL DEFAULT 'pending',
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add FK now that resume_asset exists
ALTER TABLE onboarding_draft
  ADD CONSTRAINT fk_onboarding_resume FOREIGN KEY (resume_asset_id) REFERENCES resume_asset(id);

CREATE TABLE profile_baseline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES "user"(id),
  team_id uuid NOT NULL REFERENCES team(id),
  resume_asset_id uuid NOT NULL REFERENCES resume_asset(id),
  version integer NOT NULL DEFAULT 1,
  full_name text,
  contact_email text,
  contact_phone text,
  current_location text,
  nationality text,
  years_of_experience integer,
  seniority_level text,
  primary_domain text,
  headline_summary text,
  experiences jsonb NOT NULL DEFAULT '[]'::jsonb,
  education jsonb NOT NULL DEFAULT '[]'::jsonb,
  skills jsonb NOT NULL DEFAULT '[]'::jsonb,
  languages jsonb NOT NULL DEFAULT '[]'::jsonb,
  certifications jsonb NOT NULL DEFAULT '[]'::jsonb,
  inferred_role_directions jsonb NOT NULL DEFAULT '[]'::jsonb,
  capability_tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  capability_gaps jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_language language_code NOT NULL DEFAULT 'en',
  parse_confidence confidence_band NOT NULL DEFAULT 'low',
  factual_gaps jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add FK now that profile_baseline exists
ALTER TABLE team
  ADD CONSTRAINT fk_team_profile_baseline FOREIGN KEY (current_profile_baseline_id) REFERENCES profile_baseline(id);

CREATE TABLE submission_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES "user"(id),
  team_id uuid NOT NULL UNIQUE REFERENCES team(id),
  phone text,
  contact_email text,
  current_city text,
  current_country text,
  work_authorization_status text,
  visa_sponsorship_needed boolean,
  relocation_willingness relocation_willingness,
  onsite_acceptance onsite_acceptance,
  region_eligibility_notes text,
  notice_period text,
  compensation_preference text,
  external_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  completion_band submission_profile_completeness NOT NULL DEFAULT 'missing',
  missing_required_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE agent_instance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES team(id),
  template_role_code agent_role_code NOT NULL,
  template_version text NOT NULL DEFAULT 'v1',
  role_title_zh text NOT NULL,
  persona_name text NOT NULL,
  persona_portrait_ref text,
  lifecycle_state agent_lifecycle_state NOT NULL DEFAULT 'created',
  runtime_state agent_runtime_state NOT NULL DEFAULT 'sleeping',
  health_status health_status NOT NULL DEFAULT 'healthy',
  total_active_runtime_seconds integer NOT NULL DEFAULT 0,
  total_tasks_completed integer NOT NULL DEFAULT 0,
  total_handoffs_triggered integer NOT NULL DEFAULT 0,
  total_blocked_count integer NOT NULL DEFAULT 0,
  current_assignment_id uuid,
  last_active_at timestamptz,
  last_completed_at timestamptz,
  last_block_reason_code text,
  last_blocked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  initialized_at timestamptz,
  activated_at timestamptz,
  archived_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(team_id, template_role_code)
);

CREATE TABLE agent_state_transition (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_instance_id uuid NOT NULL REFERENCES agent_instance(id),
  previous_lifecycle_state agent_lifecycle_state,
  new_lifecycle_state agent_lifecycle_state,
  previous_runtime_state agent_runtime_state,
  new_runtime_state agent_runtime_state,
  trigger_source text NOT NULL,
  related_entity_type text,
  related_entity_id uuid,
  reason_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES "user"(id),
  team_id uuid NOT NULL UNIQUE REFERENCES team(id),
  locale locale_code NOT NULL DEFAULT 'en',
  notifications_enabled boolean NOT NULL DEFAULT true,
  preferred_locations jsonb NOT NULL DEFAULT '[]'::jsonb,
  work_mode work_mode NOT NULL DEFAULT 'flexible',
  salary_expectation text,
  strategy_mode strategy_mode NOT NULL DEFAULT 'balanced',
  coverage_scope coverage_scope NOT NULL DEFAULT 'global_english',
  boundary_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
