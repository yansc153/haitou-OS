/**
 * Entity Type Definitions — Single Source of Truth
 * Source: DATA_MODEL_SPEC.md § Entity Definitions
 *
 * These types mirror the database schema exactly.
 * All application code uses these types for entity handling.
 */

import type {
  StrategyMode, CoverageScope, TeamStatus, TeamRuntimeStatus, PauseOrigin,
  PlanTier, ExecutionReadinessLevel, OnboardingStatus, ResumeUploadStatus,
  ResumeParseStatus, SubmissionProfileCompleteness, AgentRoleCode,
  AgentLifecycleState, AgentRuntimeState, HealthStatus, OpportunityStage,
  OpportunityClosureReason, RecommendationVerdict, FitPosture, Freshness,
  Priority, HandoffType, HandoffState, Urgency, HandoffResolutionType,
  MaterialType, MaterialStatus, ExecutionOutcome, ConfidenceBand,
  ConversationThreadStatus, ReplyPosture, PlatformStatus,
  PlatformCapabilityStatus, TaskStatus, TaskLoop, TimelineVisibility,
  RuntimeLedgerEntryType, PipelineMode,
} from './enums.js';

// --- Nested Types ---

export type ProfileExperience = {
  company_name: string;
  job_title: string;
  start_date?: string;
  end_date?: string;
  is_current: boolean;
  location?: string;
  description_summary?: string;
  key_achievements?: string[];
};

export type ProfileEducation = {
  institution: string;
  degree?: string;
  field_of_study?: string;
  start_date?: string;
  end_date?: string;
  location?: string;
};

export type ProfileLanguage = {
  language: string;
  proficiency: 'native' | 'fluent' | 'professional' | 'conversational' | 'basic';
};

export type CapabilityStatusMap = Record<
  'search' | 'detail' | 'apply' | 'chat' | 'resume',
  PlatformCapabilityStatus
>;

// --- Core Entities ---

export type User = {
  id: string;
  email: string;
  display_name: string;
  avatar_url?: string;
  locale: 'zh-CN' | 'en';
  timezone: string;
  auth_provider: string;
  auth_provider_id: string;
  created_at: string;
  updated_at: string;
};

export type Team = {
  id: string;
  user_id: string;
  name: string;
  status: TeamStatus;
  runtime_status: TeamRuntimeStatus;
  strategy_mode: StrategyMode;
  coverage_scope: CoverageScope;
  pause_origin?: PauseOrigin;
  onboarding_draft_id?: string;
  plan_tier: PlanTier;
  current_profile_baseline_id?: string;
  execution_readiness_status: ExecutionReadinessLevel;
  execution_readiness_blockers: string[];
  created_at: string;
  activated_at?: string;
  started_at?: string;
  paused_at?: string;
  updated_at: string;
};

export type OnboardingDraft = {
  id: string;
  user_id: string;
  team_id?: string;
  status: OnboardingStatus;
  resume_asset_id?: string;
  resume_upload_status: ResumeUploadStatus;
  resume_parse_error_code?: string;
  resume_parse_error_message?: string;
  answered_fields: Record<string, unknown>;
  completed_question_ids: string[];
  created_at: string;
  updated_at: string;
};

export type ResumeAsset = {
  id: string;
  user_id: string;
  file_name: string;
  file_size_bytes: number;
  file_mime_type: string;
  storage_path: string;
  upload_status: ResumeUploadStatus;
  parse_status: ResumeParseStatus;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
};

export type ProfileBaseline = {
  id: string;
  user_id: string;
  team_id: string;
  resume_asset_id: string;
  version: number;
  full_name?: string;
  contact_email?: string;
  contact_phone?: string;
  current_location?: string;
  nationality?: string;
  years_of_experience?: number;
  seniority_level?: string;
  primary_domain?: string;
  headline_summary?: string;
  experiences: ProfileExperience[];
  education: ProfileEducation[];
  skills: string[];
  languages: ProfileLanguage[];
  certifications?: string[];
  inferred_role_directions: string[];
  capability_tags: string[];
  capability_gaps?: string[];
  source_language: 'zh' | 'en' | 'bilingual';
  parse_confidence: ConfidenceBand;
  factual_gaps: string[];
  created_at: string;
  updated_at: string;
};

export type SubmissionProfile = {
  id: string;
  user_id: string;
  team_id: string;
  phone?: string;
  contact_email?: string;
  current_city?: string;
  current_country?: string;
  work_authorization_status?: string;
  visa_sponsorship_needed?: boolean;
  relocation_willingness?: 'yes' | 'no' | 'negotiable';
  onsite_acceptance?: 'yes' | 'no' | 'hybrid_only';
  region_eligibility_notes?: string;
  notice_period?: string;
  compensation_preference?: string;
  external_links?: string[];
  completion_band: SubmissionProfileCompleteness;
  missing_required_fields: string[];
  created_at: string;
  updated_at: string;
};

export type AgentInstance = {
  id: string;
  team_id: string;
  template_role_code: AgentRoleCode;
  template_version: string;
  role_title_zh: string;
  persona_name: string;
  persona_portrait_ref?: string;
  lifecycle_state: AgentLifecycleState;
  runtime_state: AgentRuntimeState;
  health_status: HealthStatus;
  total_active_runtime_seconds: number;
  total_tasks_completed: number;
  total_handoffs_triggered: number;
  total_blocked_count: number;
  current_assignment_id?: string;
  last_active_at?: string;
  last_completed_at?: string;
  last_block_reason_code?: string;
  last_blocked_at?: string;
  created_at: string;
  initialized_at?: string;
  activated_at?: string;
  archived_at?: string;
  updated_at: string;
};

export type UserPreferences = {
  id: string;
  user_id: string;
  team_id: string;
  locale: 'zh-CN' | 'en';
  notifications_enabled: boolean;
  preferred_locations: string[];
  work_mode: 'remote' | 'onsite' | 'hybrid' | 'flexible' | 'other';
  salary_expectation?: string;
  strategy_mode: StrategyMode;
  coverage_scope: CoverageScope;
  boundary_preferences?: Record<string, boolean>;
  created_at: string;
  updated_at: string;
};

// --- Platform Entities ---

export type PlatformDefinition = {
  id: string;
  code: string;
  display_name: string;
  display_name_zh: string;
  region: 'china' | 'global_english';
  platform_type: 'job_board' | 'recruiter_network' | 'ats_portal' | 'email_outreach';
  base_url: string;
  supports_direct_apply: boolean;
  supports_messaging: boolean;
  supports_first_contact: boolean;
  supports_reply_reading: boolean;
  supports_follow_up: boolean;
  supports_screening_questions: boolean;
  supports_cookie_session: boolean;
  supports_attachment_upload: boolean;
  current_v1_role?: string;
  pipeline_mode: PipelineMode;
  anti_scraping_level: 'low' | 'medium' | 'high' | 'extreme';
  max_daily_applications?: number;
  max_daily_messages?: number;
  captcha_frequency?: 'none' | 'rare' | 'frequent' | 'always';
  rate_limit_notes?: string;
  rule_pack_version?: string;
  rule_pack_ref?: string;
  min_plan_tier: PlanTier;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PlatformConnection = {
  id: string;
  team_id: string;
  platform_id: string;
  status: PlatformStatus;
  session_token_ref?: string;
  session_granted_at?: string;
  session_expires_at?: string;
  session_grant_scope?: string;
  session_revoked_at?: string;
  user_consent_granted_at?: string;
  user_consent_scope: 'apply_and_message' | 'apply_only' | 'read_only';
  last_health_check_at?: string;
  last_successful_action_at?: string;
  failure_count: number;
  failure_reason?: string;
  requires_user_action: boolean;
  verification_state?: 'none' | 'captcha_required' | 'sms_required' | 'manual_required';
  capability_status: CapabilityStatusMap;
  last_capability_check_at?: string;
  last_search_ok_at?: string;
  last_detail_ok_at?: string;
  last_apply_ok_at?: string;
  last_chat_ok_at?: string;
  last_resume_ok_at?: string;
  created_at: string;
  updated_at: string;
};

// --- Execution Entities ---

export type Opportunity = {
  id: string;
  team_id: string;
  stage: OpportunityStage;
  previous_stage?: OpportunityStage;
  stage_changed_at: string;
  company_name: string;
  job_title: string;
  location_label?: string;
  job_description_url?: string;
  job_description_text?: string;
  company_summary?: string;
  source_platform_id: string;
  external_ref?: string;
  source_freshness: Freshness;
  canonical_group_id?: string;
  fit_posture?: FitPosture;
  fit_reason_tags?: string[];
  recommendation?: RecommendationVerdict;
  recommendation_reason_tags?: string[];
  recommendation_next_step_hint?: string;
  priority_level: Priority;
  lead_agent_id?: string;
  requires_takeover: boolean;
  closure_reason?: OpportunityClosureReason;
  closed_at?: string;
  why_selected_summary?: string;
  risk_flags: string[];
  next_step_summary?: string;
  current_owner_type: 'team' | 'user' | 'shared';
  latest_event_at?: string;
  latest_event_summary?: string;
  created_at: string;
  updated_at: string;
};

export type Material = {
  id: string;
  team_id: string;
  opportunity_id?: string;
  material_type: MaterialType;
  status: MaterialStatus;
  language: 'zh' | 'en' | 'bilingual';
  storage_path?: string;
  content_text?: string;
  source_profile_baseline_id?: string;
  source_resume_asset_id?: string;
  edit_intensity?: 'light' | 'standard' | 'deep';
  preservation_mode?: 'strict' | 'adaptive' | 'content_only_fallback';
  version: number;
  superseded_by_id?: string;
  created_at: string;
  updated_at: string;
};

export type SubmissionAttempt = {
  id: string;
  team_id: string;
  opportunity_id: string;
  platform_connection_id: string;
  agent_task_id?: string;
  attempt_number: number;
  execution_outcome: ExecutionOutcome;
  failure_reason_code?: string;
  failure_reason_message?: string;
  platform_response_hint?: string;
  next_stage_hint?: string;
  started_at: string;
  completed_at?: string;
  created_at: string;
};

export type Handoff = {
  id: string;
  team_id: string;
  opportunity_id: string;
  handoff_type: HandoffType;
  state: HandoffState;
  urgency: Urgency;
  source_agent_id?: string;
  source_agent_role_code?: AgentRoleCode;
  handoff_reason: string;
  context_summary: string;
  explanation_text?: string;
  suggested_next_action?: string;
  suggested_reply_text?: string;
  risk_notes: string[];
  due_at?: string;
  takeover_started_at?: string;
  resolved_at?: string;
  returned_at?: string;
  closed_at?: string;
  resolution_type?: HandoffResolutionType;
  created_at: string;
  updated_at: string;
};

// --- Conversation ---

export type ConversationThread = {
  id: string;
  team_id: string;
  opportunity_id: string;
  platform_connection_id: string;
  platform_thread_id?: string;
  thread_status: ConversationThreadStatus;
  latest_message_at?: string;
  message_count: number;
  created_at: string;
  updated_at: string;
};

export type ConversationMessage = {
  id: string;
  thread_id: string;
  team_id: string;
  platform_message_id?: string;
  direction: 'outbound' | 'inbound';
  message_type: 'first_contact' | 'follow_up' | 'reply' | 'system_note';
  content_text: string;
  reply_posture?: ReplyPosture;
  extracted_signals?: string[];
  asks_or_requests?: string[];
  agent_id?: string;
  sent_at: string;
  created_at: string;
};

// --- Billing ---

export type RuntimeLedgerEntry = {
  id: string;
  team_id: string;
  entry_type: RuntimeLedgerEntryType;
  runtime_delta_seconds: number;
  balance_after_seconds: number;
  trigger_source: string;
  reason?: string;
  session_window_start?: string;
  session_window_end?: string;
  created_at: string;
};

// --- Task ---

export type AgentTask = {
  id: string;
  team_id: string;
  agent_instance_id: string;
  task_type: string;
  task_loop: TaskLoop;
  status: TaskStatus;
  idempotency_key?: string;
  priority: Priority;
  related_entity_type?: string;
  related_entity_id?: string;
  trigger_source: string;
  upstream_task_id?: string;
  input_summary?: string;
  output_summary?: string;
  boundary_flags?: string[];
  retry_count: number;
  max_retries: number;
  last_retry_at?: string;
  fallback_used: boolean;
  error_code?: string;
  error_message?: string;
  queued_at: string;
  started_at?: string;
  blocked_at?: string;
  completed_at?: string;
  failed_at?: string;
  cancelled_at?: string;
  created_at: string;
  updated_at: string;
};

// --- Timeline ---

export type TimelineEvent = {
  id: string;
  team_id: string;
  event_type: string;
  summary_text: string;
  occurred_at: string;
  actor_type: 'agent' | 'user' | 'system' | 'platform';
  actor_id?: string;
  actor_name?: string;
  actor_role_title?: string;
  related_entity_type?: string;
  related_entity_id?: string;
  handoff_to_actor_id?: string;
  handoff_to_actor_name?: string;
  visibility: TimelineVisibility;
  idempotency_key?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
};
