-- M0: Platform Entities
-- PlatformDefinition, PlatformConnection, PlatformConsentLog, PlatformDailyUsage

CREATE TABLE platform_definition (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  display_name text NOT NULL,
  display_name_zh text NOT NULL,
  region platform_region NOT NULL,
  platform_type platform_type NOT NULL,
  base_url text NOT NULL,
  supports_direct_apply boolean NOT NULL DEFAULT false,
  supports_messaging boolean NOT NULL DEFAULT false,
  supports_first_contact boolean NOT NULL DEFAULT false,
  supports_reply_reading boolean NOT NULL DEFAULT false,
  supports_follow_up boolean NOT NULL DEFAULT false,
  supports_screening_questions boolean NOT NULL DEFAULT false,
  supports_cookie_session boolean NOT NULL DEFAULT false,
  supports_attachment_upload boolean NOT NULL DEFAULT false,
  current_v1_role text,
  pipeline_mode pipeline_mode NOT NULL DEFAULT 'full_tailored',
  anti_scraping_level anti_scraping_level NOT NULL DEFAULT 'low',
  max_daily_applications integer,
  max_daily_messages integer,
  captcha_frequency captcha_frequency,
  rate_limit_notes text,
  rule_pack_version text,
  rule_pack_ref text,
  min_plan_tier plan_tier NOT NULL DEFAULT 'free',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE platform_connection (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES team(id),
  platform_id uuid NOT NULL REFERENCES platform_definition(id),
  status platform_status NOT NULL DEFAULT 'available_unconnected',
  session_token_ref text,
  session_granted_at timestamptz,
  session_expires_at timestamptz,
  session_grant_scope text,
  session_revoked_at timestamptz,
  user_consent_granted_at timestamptz,
  user_consent_scope consent_scope NOT NULL DEFAULT 'read_only',
  last_health_check_at timestamptz,
  last_successful_action_at timestamptz,
  failure_count integer NOT NULL DEFAULT 0,
  failure_reason text,
  requires_user_action boolean NOT NULL DEFAULT false,
  verification_state verification_state DEFAULT 'none',
  capability_status jsonb NOT NULL DEFAULT '{"search":"unknown","detail":"unknown","apply":"unknown","chat":"unknown","resume":"unknown"}'::jsonb,
  last_capability_check_at timestamptz,
  last_search_ok_at timestamptz,
  last_detail_ok_at timestamptz,
  last_apply_ok_at timestamptz,
  last_chat_ok_at timestamptz,
  last_resume_ok_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(team_id, platform_id)
);

CREATE TABLE platform_consent_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_connection_id uuid NOT NULL REFERENCES platform_connection(id),
  team_id uuid NOT NULL REFERENCES team(id),
  action consent_action NOT NULL,
  consent_scope consent_scope NOT NULL,
  granted_by text NOT NULL DEFAULT 'user',
  session_token_fingerprint text,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE platform_daily_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_connection_id uuid NOT NULL REFERENCES platform_connection(id),
  team_id uuid NOT NULL REFERENCES team(id),
  date date NOT NULL,
  applications_count integer NOT NULL DEFAULT 0,
  messages_count integer NOT NULL DEFAULT 0,
  searches_count integer NOT NULL DEFAULT 0,
  total_actions_count integer NOT NULL DEFAULT 0,
  budget_exhausted boolean NOT NULL DEFAULT false,
  last_action_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(platform_connection_id, date)
);
