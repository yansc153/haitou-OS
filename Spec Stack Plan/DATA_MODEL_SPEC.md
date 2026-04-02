# Data Model Spec

## Document Purpose

This document defines the authoritative data model for Haitou OS.

It answers:

- what core entities exist
- what fields each entity carries
- which enumerations are canonical
- how entities relate to each other
- how state machines govern entity transitions
- what audit and event records must be stored
- how row-level security scopes data access
- how skill outputs map into stored entities

This is the single source of truth for all entity shapes, enumerations, and state definitions.

All other specs — frontend types, API contracts, skill outputs, and UI surfaces — must align to the definitions in this document.

## Relationship To Earlier Specs

This document resolves known inconsistencies across:

- `FRONTEND_INTERFACE_SPEC.md` (frontend TypeScript types)
- `AGENT_INSTANCE_AND_STATE_SPEC.md` (agent lifecycle and runtime)
- `AGENT_TEMPLATE_SPEC.md` (role definitions)
- `AGENT_SKILL_AND_PROMPT_SPEC.md` (skill output schemas)
- `PRODUCT_FLOWS.md` (opportunity progression)
- `UI_SURFACE_SPEC.md` (page state requirements)

Where a conflict exists between this document and earlier specs, this document wins for data modeling purposes.

## Technology Assumption

The data model is defined in technology-neutral terms using TypeScript-like type notation for readability.

Implementation targets PostgreSQL via Supabase. RLS policies use Supabase conventions (`auth.uid()`). The model should translate cleanly into SQL DDL.

---

## Canonical Enumerations

Every persisted enum in the system is cataloged in this section. No inline string unions may be used in entity definitions without being listed here first.

### StrategyMode

```ts
type StrategyMode = "balanced" | "broad" | "precise"
```

- `balanced`: default mode, balances coverage and relevance
- `broad`: wider search, faster expansion, higher tolerance for imperfect fit
- `precise`: tighter fit, narrower selection, lower volume

Note: `aggressive` appeared in earlier drafts but is retired. `broad` absorbs that intent.

### CoverageScope

```ts
type CoverageScope = "china" | "global_english" | "cross_market"
```

Note: `cross_market_global` appeared in `FRONTEND_INTERFACE_SPEC.md` but is superseded by `cross_market` here. Frontend must align.

### OpportunityStage

```ts
type OpportunityStage =
  | "discovered"
  | "screened"
  | "prioritized"
  | "material_ready"
  | "submitted"
  | "contact_started"
  | "followup_active"
  | "positive_progression"
  | "needs_takeover"
  | "closed"
```

### OpportunityClosureReason

```ts
type OpportunityClosureReason =
  | "user_declined"
  | "employer_rejected"
  | "employer_no_response"
  | "position_filled"
  | "position_expired"
  | "duplicate_collapsed"
  | "fit_dropped"
  | "platform_blocked"
  | "user_resolved_handoff"
  | "system_expired"
```

### HandoffType

```ts
type HandoffType =
  | "private_contact"
  | "salary_confirmation"
  | "interview_time"
  | "work_arrangement"
  | "visa_eligibility"
  | "reference_check"
  | "offer_decision"
  | "other_high_risk"
```

Note: Frontend `HandoffSummary.handoff_type` must be updated to include `reference_check` and `offer_decision`.

### HandoffState

```ts
type HandoffState =
  | "awaiting_takeover"
  | "in_user_handling"
  | "waiting_external"
  | "resolved"
  | "returned_to_team"
  | "closed"
```

### TeamStatus

```ts
type TeamStatus =
  | "draft"
  | "onboarding"
  | "activation_pending"
  | "ready"
  | "active"
  | "paused"
  | "suspended"
  | "archived"
```

### TeamRuntimeStatus

```ts
type TeamRuntimeStatus =
  | "idle"
  | "starting"
  | "active"
  | "pausing"
  | "paused"
  | "attention_required"
```

### PauseOrigin

```ts
type PauseOrigin =
  | "user"
  | "system_entitlement"
  | "system_safety"
  | "system_admin"
```

### AgentLifecycleState

```ts
type AgentLifecycleState =
  | "created"
  | "initialized"
  | "ready"
  | "activated"
  | "running"
  | "paused"
  | "archived"
```

### AgentRuntimeState

```ts
type AgentRuntimeState =
  | "sleeping"
  | "ready"
  | "active"
  | "waiting"
  | "blocked"
  | "paused"
  | "handoff"
  | "completed"
```

### AgentFrontendStatus (derived, not stored)

```ts
type AgentFrontendStatus = "idle" | "working" | "waiting" | "paused" | "blocked"
```

Mapping rules:

| AgentRuntimeState | AgentFrontendStatus |
|---|---|
| `sleeping` | `idle` |
| `ready` | `idle` |
| `completed` | `idle` |
| `active` | `working` |
| `waiting` | `waiting` |
| `blocked` | `blocked` |
| `paused` | `paused` |
| `handoff` | `waiting` |

Note: `handoff` maps to `waiting` (not `working`) because the agent is no longer actively executing — it is waiting for user takeover. This aligns with frontend expectation.

### PlatformStatus

```ts
type PlatformStatus =
  | "active"
  | "available_unconnected"
  | "pending_login"
  | "session_expired"
  | "restricted"
  | "unavailable"
  | "plan_locked"
```

Note: Frontend uses `reconnect_required` which should be mapped from `session_expired` at the API aggregation layer.

### PlatformRegion

```ts
type PlatformRegion = "china" | "global_english"
```

### PipelineMode

```ts
type PipelineMode = "full_tailored" | "passthrough"
```

- `full_tailored`: full material pipeline — resume tailoring, cover letter generation, localization, then submission. Used for `global_english` platforms where each application supports independent file upload.
- `passthrough`: skip material generation — use the user's original resume directly. Used for `china` platforms where per-application resume customization is impractical due to platform constraints.

Determination rule: `PipelineMode` is derived from `PlatformDefinition.region`. The orchestrator resolves it as:

```ts
function getPipelineMode(platform: PlatformDefinition): PipelineMode {
  return platform.region === "global_english" ? "full_tailored" : "passthrough"
}
```

For `cross_market` coverage scope users: an opportunity's pipeline mode is determined by the platform it was discovered on, not by the user's coverage scope setting.

### PlatformType

```ts
type PlatformType = "job_board" | "recruiter_network" | "ats_portal" | "email_outreach"
```

### AntiScrapingLevel

```ts
type AntiScrapingLevel = "low" | "medium" | "high" | "extreme"
```

### PlanTier

```ts
type PlanTier = "free" | "pro" | "plus"
```

### TaskStatus

```ts
type TaskStatus =
  | "queued"
  | "running"
  | "waiting_dependency"
  | "blocked"
  | "completed"
  | "failed"
  | "cancelled"
```

### TaskLoop

```ts
type TaskLoop = "opportunity_generation" | "opportunity_progression"
```

### RecommendationVerdict

```ts
type RecommendationVerdict = "advance" | "watch" | "drop" | "needs_context"
```

### FitPosture

```ts
type FitPosture = "strong" | "moderate" | "weak" | "uncertain"
```

### ExecutionOutcome

```ts
type ExecutionOutcome = "submitted" | "partially_submitted" | "failed" | "blocked"
```

### ConfidenceBand

```ts
type ConfidenceBand = "high" | "medium" | "low"
```

### WorkMode

```ts
type WorkMode = "remote" | "onsite" | "hybrid" | "flexible" | "other"
```

### OnboardingStatus

```ts
type OnboardingStatus = "resume_required" | "questions_in_progress" | "ready_for_activation" | "completed"
```

### ResumeUploadStatus

```ts
type ResumeUploadStatus = "missing" | "uploading" | "uploaded" | "processing" | "processed" | "failed"
```

### ResumeParseStatus

```ts
type ResumeParseStatus = "pending" | "processing" | "parsed" | "failed"
```

### SubmissionProfileCompleteness

```ts
type SubmissionProfileCompleteness = "missing" | "partial" | "minimum_ready" | "complete"
```

### Urgency

```ts
type Urgency = "low" | "medium" | "high" | "critical"
```

### Priority

```ts
type Priority = "low" | "medium" | "high" | "critical"
```

### MaterialType

```ts
type MaterialType =
  | "source_resume"
  | "light_edit_resume"
  | "standard_tailored_resume"
  | "deep_tailored_resume"
  | "localized_resume"
  | "cover_letter"
  | "first_contact_draft"
  | "follow_up_draft"
  | "email_draft"
  | "reply_draft"
  | "supporting_text"
  | "summary_card"
  | "context_card"
  | "handoff_package"
```

### MaterialStatus

```ts
type MaterialStatus = "generating" | "ready" | "superseded" | "failed"
```

### ConversationMessageDirection

```ts
type ConversationMessageDirection = "outbound" | "inbound"
```

### ConversationMessageType

```ts
type ConversationMessageType = "first_contact" | "follow_up" | "reply" | "system_note"
```

### ReplyPosture

```ts
type ReplyPosture = "positive" | "neutral" | "unclear" | "handoff_trigger"
```

### TimelineVisibility

```ts
type TimelineVisibility = "feed" | "opportunity_timeline" | "internal" | "audit"
```

### RuntimeLedgerEntryType

```ts
type RuntimeLedgerEntryType = "session_start" | "session_end" | "allocation" | "adjustment" | "expiry"
```

### HandoffResolutionType

```ts
type HandoffResolutionType = "resolved" | "returned_to_team" | "closed_by_user" | "expired"
```

### HealthStatus

```ts
type HealthStatus = "healthy" | "degraded" | "unstable"
```

### PlatformCapabilityName

```ts
type PlatformCapabilityName = "search" | "detail" | "apply" | "chat" | "resume"
```

### PlatformCapabilityStatus

```ts
type PlatformCapabilityStatus = "healthy" | "degraded" | "blocked" | "unknown"
```

### Freshness

```ts
type Freshness = "new" | "recent" | "stale" | "unknown"
```

### ExecutionReadinessLevel

```ts
type ExecutionReadinessLevel = "not_ready" | "partially_ready" | "minimum_ready" | "fully_ready"
```

### RelocationWillingness

```ts
type RelocationWillingness = "yes" | "no" | "negotiable"
```

### OnsiteAcceptance

```ts
type OnsiteAcceptance = "yes" | "no" | "hybrid_only"
```

### ConversationThreadStatus

```ts
type ConversationThreadStatus = "active" | "paused" | "handoff_triggered" | "closed"
```

### VerificationState

```ts
type VerificationState = "none" | "captcha_required" | "sms_required" | "manual_required"
```

### ConsentScope

```ts
type ConsentScope = "apply_and_message" | "apply_only" | "read_only"
```

### CaptchaFrequency

```ts
type CaptchaFrequency = "none" | "rare" | "frequent" | "always"
```

### EditIntensity

```ts
type EditIntensity = "light" | "standard" | "deep"
```

### PreservationMode

```ts
type PreservationMode = "strict" | "adaptive" | "content_only_fallback"
```

### LanguageCode

```ts
type LanguageCode = "zh" | "en" | "bilingual"
```

### LanguageProficiency

```ts
type LanguageProficiency = "native" | "fluent" | "professional" | "conversational" | "basic"
```

### LocaleCode

```ts
type LocaleCode = "zh-CN" | "en"
```

### ConsentAction

```ts
type ConsentAction = "granted" | "renewed" | "rotated" | "revoked" | "expired"
```

---

## Core Entities

### User

```ts
type User = {
  id: string                          // PK, UUID
  email: string                       // unique
  display_name: string
  avatar_url?: string
  locale: "zh-CN" | "en"
  timezone: string
  auth_provider: string
  auth_provider_id: string
  created_at: string
  updated_at: string
}
```

### Team

```ts
type Team = {
  id: string                          // PK, UUID
  user_id: string                     // FK → User.id, UNIQUE
  name: string
  status: TeamStatus
  runtime_status: TeamRuntimeStatus
  strategy_mode: StrategyMode
  coverage_scope: CoverageScope
  pause_origin?: PauseOrigin
  onboarding_draft_id?: string        // FK → OnboardingDraft.id
  plan_tier: PlanTier
  current_profile_baseline_id?: string // FK → ProfileBaseline.id (latest version pointer)
  execution_readiness_status: ExecutionReadinessLevel
  execution_readiness_blockers: string[]
  created_at: string
  activated_at?: string
  started_at?: string
  paused_at?: string
  updated_at: string
}
```

Billing fields live on RuntimeLedger, not Team. See Billing section below.

### OnboardingDraft

```ts
type OnboardingDraft = {
  id: string
  user_id: string                     // FK → User.id
  team_id?: string                    // FK → Team.id
  status: OnboardingStatus
  resume_asset_id?: string            // FK → ResumeAsset.id
  resume_upload_status: ResumeUploadStatus
  resume_parse_error_code?: string
  resume_parse_error_message?: string
  answered_fields: Record<string, unknown>  // JSONB
  completed_question_ids: string[]    // JSONB array
  created_at: string
  updated_at: string
}
```

### ResumeAsset

```ts
type ResumeAsset = {
  id: string
  user_id: string                     // FK → User.id
  file_name: string
  file_size_bytes: number
  file_mime_type: string
  storage_path: string                // encrypted reference
  upload_status: ResumeUploadStatus
  parse_status: ResumeParseStatus
  is_primary: boolean
  created_at: string
  updated_at: string
}
```

### ProfileBaseline

```ts
type ProfileBaseline = {
  id: string
  user_id: string                     // FK → User.id
  team_id: string                     // FK → Team.id
  resume_asset_id: string             // FK → ResumeAsset.id
  version: number                     // increments on re-parse

  // identity
  full_name?: string
  contact_email?: string
  contact_phone?: string
  current_location?: string
  nationality?: string

  // professional summary
  years_of_experience?: number
  seniority_level?: string
  primary_domain?: string
  headline_summary?: string

  // structured experience (JSONB)
  experiences: ProfileExperience[]
  education: ProfileEducation[]
  skills: string[]
  languages: ProfileLanguage[]
  certifications?: string[]

  // capability inference
  inferred_role_directions: string[]
  capability_tags: string[]
  capability_gaps?: string[]

  // metadata
  source_language: "zh" | "en" | "bilingual"
  parse_confidence: ConfidenceBand
  factual_gaps: string[]
  created_at: string
  updated_at: string
}

type ProfileExperience = {
  company_name: string
  job_title: string
  start_date?: string
  end_date?: string
  is_current: boolean
  location?: string
  description_summary?: string
  key_achievements?: string[]
}

type ProfileEducation = {
  institution: string
  degree?: string
  field_of_study?: string
  start_date?: string
  end_date?: string
  location?: string
}

type ProfileLanguage = {
  language: string
  proficiency: "native" | "fluent" | "professional" | "conversational" | "basic"
}
```

Versioning rule: Team → ProfileBaseline is 1:N. `Team.current_profile_baseline_id` points to the latest. Old versions are preserved for audit.

### SubmissionProfile

```ts
type SubmissionProfile = {
  id: string
  user_id: string                     // FK → User.id
  team_id: string                     // FK → Team.id
  phone?: string
  contact_email?: string
  current_city?: string
  current_country?: string
  work_authorization_status?: string
  visa_sponsorship_needed?: boolean
  relocation_willingness?: RelocationWillingness
  onsite_acceptance?: OnsiteAcceptance
  region_eligibility_notes?: string
  notice_period?: string
  compensation_preference?: string
  external_links?: string[]           // JSONB
  completion_band: SubmissionProfileCompleteness
  missing_required_fields: string[]   // JSONB
  created_at: string
  updated_at: string
}
```

### AgentInstance

```ts
type AgentInstance = {
  id: string
  team_id: string                     // FK → Team.id
  template_role_code: AgentRoleCode   // UNIQUE with team_id
  template_version: string
  role_title_zh: string
  persona_name: string
  persona_portrait_ref?: string
  lifecycle_state: AgentLifecycleState
  runtime_state: AgentRuntimeState
  health_status: HealthStatus
  total_active_runtime_seconds: number
  total_tasks_completed: number
  total_handoffs_triggered: number
  total_blocked_count: number
  current_assignment_id?: string
  last_active_at?: string
  last_completed_at?: string
  last_block_reason_code?: string
  last_blocked_at?: string
  created_at: string
  initialized_at?: string
  activated_at?: string
  archived_at?: string
  updated_at: string
}
```

Constraint: `UNIQUE(team_id, template_role_code)` — enforces exactly one instance per role per team.

### AgentRoleCode

```ts
type AgentRoleCode =
  | "orchestrator"
  | "profile_intelligence"
  | "materials_advisor"
  | "opportunity_research"
  | "matching_review"
  | "application_executor"
  | "relationship_manager"
```

| role_code | role_title_zh |
|---|---|
| `orchestrator` | `调度官` |
| `profile_intelligence` | `履历分析师` |
| `materials_advisor` | `简历顾问` |
| `opportunity_research` | `岗位研究员` |
| `matching_review` | `匹配审核员` |
| `application_executor` | `投递专员` |
| `relationship_manager` | `招聘关系经理` |

### Opportunity

```ts
type Opportunity = {
  id: string
  team_id: string                     // FK → Team.id
  stage: OpportunityStage
  previous_stage?: OpportunityStage
  stage_changed_at: string

  // job information
  company_name: string
  job_title: string
  location_label?: string
  job_description_url?: string
  job_description_text?: string
  company_summary?: string

  // source and dedup
  source_platform_id: string          // FK → PlatformDefinition.id
  external_ref?: string
  source_freshness: Freshness
  canonical_group_id?: string         // nullable self-referencing group key for dedup

  // evaluation
  fit_posture?: FitPosture
  fit_reason_tags?: string[]          // JSONB
  recommendation?: RecommendationVerdict
  recommendation_reason_tags?: string[]  // JSONB
  recommendation_next_step_hint?: string

  // progression
  priority_level: Priority
  lead_agent_id?: string              // FK → AgentInstance.id
  requires_takeover: boolean
  closure_reason?: OpportunityClosureReason
  closed_at?: string

  // meta
  why_selected_summary?: string
  risk_flags: string[]                // JSONB
  next_step_summary?: string
  current_owner_type: "team" | "user" | "shared"
  latest_event_at?: string
  latest_event_summary?: string
  created_at: string
  updated_at: string
}
```

Note: Execution outcome is on `SubmissionAttempt`, not on Opportunity directly. See below.

Dedup rule: `canonical_group_id` groups cross-platform variants of the same real job. Null means ungrouped.

### SubmissionAttempt

Records each platform action attempt. One Opportunity may have multiple attempts (retries, multi-step forms).

```ts
type SubmissionAttempt = {
  id: string
  team_id: string                     // FK → Team.id
  opportunity_id: string              // FK → Opportunity.id
  platform_connection_id: string      // FK → PlatformConnection.id
  agent_task_id?: string              // FK → AgentTask.id
  attempt_number: number
  execution_outcome: ExecutionOutcome
  failure_reason_code?: string
  failure_reason_message?: string
  // materials linked via SubmissionAttemptMaterial junction table
  platform_response_hint?: string
  next_stage_hint?: string
  started_at: string
  completed_at?: string
  created_at: string
}
```

### Material

Canonical artifact model. Covers generated resumes, cover letters, email drafts, and all other produced materials.

```ts
type Material = {
  id: string
  team_id: string                     // FK → Team.id
  opportunity_id?: string             // FK → Opportunity.id (null for default/general materials)
  material_type: MaterialType
  status: MaterialStatus
  language: "zh" | "en" | "bilingual"
  storage_path?: string               // encrypted reference to file
  content_text?: string               // for text-based materials (drafts, emails)
  source_profile_baseline_id?: string // FK → ProfileBaseline.id
  source_resume_asset_id?: string     // FK → ResumeAsset.id
  edit_intensity?: EditIntensity
  preservation_mode?: PreservationMode
  version: number
  superseded_by_id?: string           // FK → Material.id
  created_at: string
  updated_at: string
}
```

### ConversationThread

Stores platform-contained conversation threads managed by `招聘关系经理`.

```ts
type ConversationThread = {
  id: string
  team_id: string                     // FK → Team.id
  opportunity_id: string              // FK → Opportunity.id
  platform_connection_id: string      // FK → PlatformConnection.id
  platform_thread_id?: string         // external thread ID on platform for sync/dedup
  thread_status: ConversationThreadStatus
  latest_message_at?: string
  message_count: number
  created_at: string
  updated_at: string
}
```

### ConversationMessage

Individual messages within a conversation thread.

```ts
type ConversationMessage = {
  id: string
  thread_id: string                   // FK → ConversationThread.id
  team_id: string                     // FK → Team.id (denormalized for RLS)
  platform_message_id?: string        // external message ID on platform for dedup
  direction: ConversationMessageDirection
  message_type: ConversationMessageType
  content_text: string
  reply_posture?: ReplyPosture        // set on inbound messages after reply-reading
  extracted_signals?: string[]        // JSONB
  asks_or_requests?: string[]         // JSONB
  agent_id?: string                   // FK → AgentInstance.id (for outbound)
  sent_at: string
  created_at: string
}
```

### Handoff

```ts
type Handoff = {
  id: string
  team_id: string                     // FK → Team.id
  opportunity_id: string              // FK → Opportunity.id
  handoff_type: HandoffType
  state: HandoffState
  urgency: Urgency

  // context
  source_agent_id?: string            // FK → AgentInstance.id
  source_agent_role_code?: AgentRoleCode
  handoff_reason: string
  context_summary: string
  explanation_text?: string
  suggested_next_action?: string
  suggested_reply_text?: string
  risk_notes: string[]                // JSONB
  // materials linked via HandoffMaterial junction table

  // lifecycle
  due_at?: string
  takeover_started_at?: string
  resolved_at?: string
  returned_at?: string
  closed_at?: string
  resolution_type?: HandoffResolutionType

  created_at: string
  updated_at: string
}
```

### PlatformDefinition

Static platform metadata. Shared reference table.

```ts
type PlatformDefinition = {
  id: string
  code: string                        // UNIQUE, e.g. "boss_zhipin", "linkedin"
  display_name: string
  display_name_zh: string
  region: PlatformRegion
  platform_type: PlatformType
  base_url: string

  // capability flags
  supports_direct_apply: boolean
  supports_messaging: boolean
  supports_first_contact: boolean
  supports_reply_reading: boolean
  supports_follow_up: boolean
  supports_screening_questions: boolean
  supports_cookie_session: boolean
  supports_attachment_upload: boolean
  current_v1_role?: "search_conversation" | "search_detail_apply" | "search_detail_apply_attachment" | "research_only"
  pipeline_mode: PipelineMode           // derived from region; stored for query convenience

  // constraints
  anti_scraping_level: AntiScrapingLevel
  max_daily_applications?: number
  max_daily_messages?: number
  captcha_frequency?: CaptchaFrequency
  rate_limit_notes?: string

  // platform rule pack
  rule_pack_version?: string
  rule_pack_ref?: string              // reference to external rule pack definition

  // access
  min_plan_tier: PlanTier
  is_active: boolean
  created_at: string
  updated_at: string
}
```

### PlatformConnection

User-specific platform session state.

```ts
type PlatformConnection = {
  id: string
  team_id: string                     // FK → Team.id
  platform_id: string                 // FK → PlatformDefinition.id
  status: PlatformStatus

  // session
  session_token_ref?: string          // encrypted reference
  session_granted_at?: string
  session_expires_at?: string
  session_grant_scope?: string        // what was authorized
  session_revoked_at?: string

  // consent
  user_consent_granted_at?: string
  user_consent_scope: ConsentScope

  // health
  last_health_check_at?: string
  last_successful_action_at?: string
  failure_count: number
  failure_reason?: string
  requires_user_action: boolean
  verification_state?: VerificationState
  capability_status: Record<PlatformCapabilityName, PlatformCapabilityStatus>
  last_capability_check_at?: string
  last_search_ok_at?: string
  last_detail_ok_at?: string
  last_apply_ok_at?: string
  last_chat_ok_at?: string
  last_resume_ok_at?: string

  created_at: string
  updated_at: string
}
```

Constraint: `UNIQUE(team_id, platform_id)` — one connection per platform per team.

Important modeling rule:

- `PlatformConnection.status` is a coarse connection-level state
- capability truth lives in `PlatformConnection.capability_status`
- orchestration must route on capability health, not on connection status alone

### PlatformConsentLog

Durable audit trail for platform authorization grants, revocations, and rotations.

```ts
type PlatformConsentLog = {
  id: string
  platform_connection_id: string      // FK → PlatformConnection.id
  team_id: string                     // FK → Team.id (denormalized for RLS)
  action: ConsentAction
  consent_scope: ConsentScope
  granted_by: "user" | "system_refresh"
  session_token_fingerprint?: string  // hash of token for audit without storing secret
  ip_address?: string
  user_agent?: string
  created_at: string
}
```

### RuntimeLedger

Team-level billing source of truth. This is the ONLY authoritative billing record. No other field is authoritative for billing.

```ts
type RuntimeLedgerEntry = {
  id: string
  team_id: string                     // FK → Team.id
  entry_type: RuntimeLedgerEntryType
  runtime_delta_seconds: number       // positive for allocation, negative for usage
  balance_after_seconds: number       // running balance snapshot
  trigger_source: "user" | "system" | "billing" | "admin"
  reason?: string
  session_window_start?: string       // for session_end entries
  session_window_end?: string         // for session_end entries
  created_at: string
}
```

Billing design:

- `session_start` is recorded when team starts running
- `session_end` is recorded when team pauses, with `runtime_delta_seconds` = negative duration of that session window
- `allocation` is recorded when a billing cycle grants runtime
- `adjustment` is recorded for manual corrections
- No per-tick entries. Usage is measured in session windows.
- `balance_after_seconds` is the running total. The latest entry's balance is the current balance.

### AgentTask

```ts
type AgentTask = {
  id: string
  team_id: string                     // FK → Team.id
  agent_instance_id: string           // FK → AgentInstance.id
  task_type: string
  task_loop: TaskLoop
  status: TaskStatus
  idempotency_key?: string            // UNIQUE, for dedup across concurrent dispatches
  priority: Priority

  // context
  related_entity_type?: "opportunity" | "handoff" | "platform" | "material" | "team" | "conversation"
  related_entity_id?: string
  trigger_source: "orchestrator" | "platform_event" | "user_action" | "timer" | "upstream_completion"
  upstream_task_id?: string           // FK → AgentTask.id (single parent, not array)
  input_summary?: string
  output_summary?: string
  boundary_flags?: string[]           // JSONB

  // execution
  retry_count: number
  max_retries: number
  last_retry_at?: string
  fallback_used: boolean
  error_code?: string
  error_message?: string

  // timestamps
  queued_at: string
  started_at?: string
  blocked_at?: string
  completed_at?: string
  failed_at?: string
  cancelled_at?: string
  created_at: string
  updated_at: string
}
```

Note: `upstream_task_id` replaces `dependency_ids` array. For multiple dependencies, create separate dependency records or use the orchestration layer.

### TimelineEvent

```ts
type TimelineEvent = {
  id: string
  team_id: string                     // FK → Team.id
  event_type: string
  summary_text: string
  occurred_at: string
  actor_type: "agent" | "user" | "system" | "platform"
  actor_id?: string
  actor_name?: string
  actor_role_title?: string
  related_entity_type?: "team" | "opportunity" | "handoff" | "platform" | "task" | "conversation"
  related_entity_id?: string
  handoff_to_actor_id?: string
  handoff_to_actor_name?: string
  visibility: TimelineVisibility
  idempotency_key?: string            // UNIQUE, for dedup under concurrency
  metadata?: Record<string, unknown>  // JSONB
  created_at: string
}
```

Dedup rule: `idempotency_key` is a unique nullable column. The producer generates a deterministic key (e.g., `{event_type}:{related_entity_id}:{trigger_id}`) and Postgres UNIQUE constraint prevents duplicates. This replaces the unsafe composite dedup key.

### SubmissionAttemptMaterial (junction)

```ts
type SubmissionAttemptMaterial = {
  submission_attempt_id: string       // FK → SubmissionAttempt.id
  material_id: string                 // FK → Material.id
  // PK: (submission_attempt_id, material_id)
}
```

### HandoffMaterial (junction)

```ts
type HandoffMaterial = {
  handoff_id: string                  // FK → Handoff.id
  material_id: string                 // FK → Material.id
  // PK: (handoff_id, material_id)
}
```

### PlatformDailyUsage

Tracks daily action counts per platform per team for rate limit enforcement.

```ts
type PlatformDailyUsage = {
  id: string
  platform_connection_id: string      // FK → PlatformConnection.id
  team_id: string                     // FK → Team.id
  date: string                        // YYYY-MM-DD
  applications_count: number
  messages_count: number
  searches_count: number
  total_actions_count: number
  budget_exhausted: boolean
  last_action_at?: string
  created_at: string
  updated_at: string
}
```

Constraint: `UNIQUE(platform_connection_id, date)`

### AgentTaskDependency (junction)

For tasks with multiple upstream dependencies.

```ts
type AgentTaskDependency = {
  task_id: string                     // FK → AgentTask.id
  depends_on_task_id: string          // FK → AgentTask.id
  // PK: (task_id, depends_on_task_id)
}
```

### AgentStateTransition

```ts
type AgentStateTransition = {
  id: string
  agent_instance_id: string           // FK → AgentInstance.id
  previous_lifecycle_state?: AgentLifecycleState
  new_lifecycle_state?: AgentLifecycleState
  previous_runtime_state?: AgentRuntimeState
  new_runtime_state?: AgentRuntimeState
  trigger_source: string
  related_entity_type?: string
  related_entity_id?: string
  reason_code?: string
  created_at: string
}
```

### UserPreferences

```ts
type UserPreferences = {
  id: string
  user_id: string                     // FK → User.id
  team_id: string                     // FK → Team.id
  locale: "zh-CN" | "en"
  notifications_enabled: boolean
  preferred_locations: string[]       // JSONB
  work_mode: WorkMode
  salary_expectation?: string
  strategy_mode: StrategyMode
  coverage_scope: CoverageScope
  boundary_preferences?: Record<string, boolean>  // JSONB
  created_at: string
  updated_at: string
}
```

---

## Entity Relationships

```
User (1) ──── (1) Team
User (1) ──── (1) OnboardingDraft
User (1) ──── (N) ResumeAsset
Team (1) ──── (N) ProfileBaseline        [current_profile_baseline_id → latest]
Team (1) ──── (1) SubmissionProfile
Team (1) ──── (7) AgentInstance          [UNIQUE(team_id, template_role_code)]
Team (1) ──── (N) Opportunity
Team (1) ──── (N) Handoff
Team (1) ──── (N) PlatformConnection     [UNIQUE(team_id, platform_id)]
Team (1) ──── (N) RuntimeLedgerEntry
Team (1) ──── (N) AgentTask
Team (1) ──── (N) TimelineEvent
Team (1) ──── (N) Material
Team (1) ──── (N) ConversationThread
Team (1) ──── (1) UserPreferences
Opportunity (1) ──── (N) Handoff
Opportunity (1) ──── (N) SubmissionAttempt
Opportunity (1) ──── (N) Material
Opportunity (1) ──── (N) ConversationThread
Opportunity (N) ──── (1) PlatformDefinition
AgentInstance (1) ──── (N) AgentTask
AgentInstance (1) ──── (N) AgentStateTransition
PlatformConnection (N) ──── (1) PlatformDefinition
ConversationThread (1) ──── (N) ConversationMessage
SubmissionAttempt (N) ──── (1) PlatformConnection
SubmissionAttempt (M) ──── (N) Material         [via SubmissionAttemptMaterial]
Handoff (M) ──── (N) Material                   [via HandoffMaterial]
AgentTask (N) ──── (N) AgentTask                [via AgentTaskDependency]
PlatformConnection (1) ──── (N) PlatformConsentLog
```

---

## State Machines

### Opportunity Stage Transitions

```
discovered → screened
screened → prioritized

// full_tailored pipeline (global_english platforms)
prioritized → material_ready
material_ready → submitted
material_ready → contact_started

// passthrough pipeline (china platforms)
prioritized → submitted                    // skips material_ready — original resume used directly
prioritized → contact_started              // for chat-first platforms (e.g., Boss直聘 V1.1)

submitted → contact_started
contact_started → followup_active
followup_active → positive_progression
positive_progression → needs_takeover
positive_progression → closed

Any active stage → needs_takeover (handoff boundary)
Any active stage → closed (closure condition)
needs_takeover → closed (user resolves)
needs_takeover → followup_active (returned to team)
```

Pipeline mode routing rule: the orchestrator checks `getPipelineMode(opportunity.source_platform)` to determine whether the `prioritized → material_ready → submitted` path or the `prioritized → submitted` shortcut is used. The state machine validator must accept both paths.

Illegal: `closed → *`, backward movement (e.g., `submitted → discovered`).

### Handoff State Transitions

```
awaiting_takeover → in_user_handling
in_user_handling → waiting_external
in_user_handling → resolved
in_user_handling → returned_to_team
in_user_handling → closed
waiting_external → in_user_handling
waiting_external → resolved
waiting_external → closed
resolved → closed
returned_to_team → closed
```

### Team Status Transitions

```
draft → onboarding
onboarding → activation_pending
activation_pending → ready
ready → active
active → paused
paused → active
active → suspended
paused → suspended
suspended → paused
active → archived
paused → archived
suspended → archived
```

### TeamRuntimeStatus Transitions

```
idle → starting
starting → active
active → pausing
pausing → paused
paused → starting
active → attention_required
attention_required → active
attention_required → pausing
```

### OnboardingStatus Transitions

```
resume_required → questions_in_progress
questions_in_progress → ready_for_activation
ready_for_activation → completed
```

### ResumeUploadStatus Transitions

```
missing → uploading
uploading → uploaded
uploading → failed
uploaded → processing
processing → processed
processing → failed
failed → uploading (retry)
```

### TaskStatus Transitions

```
queued → running
running → waiting_dependency
running → blocked
running → completed
running → failed
running → queued (team pause normalization only)
waiting_dependency → running
blocked → queued (blocker cleared)
failed → queued (retry)
queued → cancelled
running → cancelled
blocked → cancelled
```

Note: `running → queued` is only legal during team pause normalization (not during normal execution). The orchestrator uses this to return in-flight tasks to a re-dispatchable state when the team pauses.

### PlatformConnection Status Transitions

```
available_unconnected → pending_login
pending_login → active
active → session_expired
session_expired → pending_login
active → restricted
session_expired → restricted
restricted → pending_login
plan_locked → available_unconnected (upgrade)
```

Important note:

- these transitions govern only the coarse platform-connection state
- capability-level degradation such as:
  - `search: healthy → blocked`
  - `chat: healthy → degraded`
  does **not** require a `PlatformConnection.status` transition
- this is necessary for Chinese platforms where one capability can fail while others remain usable

### ResumeParseStatus Transitions

```
pending → processing
processing → parsed
processing → failed
failed → pending (re-upload triggers re-parse)
```

### SubmissionProfileCompleteness Transitions

```
missing → partial (first field filled)
partial → minimum_ready (all required fields present)
minimum_ready → complete (all optional fields also present)
complete → partial (field removed or invalidated)
partial → missing (all fields cleared)
```

Note: This is a derived state, recomputed on each profile update based on field presence rules.

### ConversationThreadStatus Transitions

```
active → paused (team paused)
active → handoff_triggered (boundary detected)
active → closed (opportunity closed or no further action)
paused → active (team resumed)
handoff_triggered → closed (after user handles handoff)
```

---

## Skill Output To Entity Mapping (Complete)

### Round 1: Orchestration Skills → AgentTask / TimelineEvent

| Skill | Maps To |
|---|---|
| `loop-routing` | `AgentTask.task_loop` assignment |
| `task-dispatch` | New `AgentTask` creation |
| `priority-scoring` | `AgentTask.priority`, `Opportunity.priority_level` |
| `stage-transition` | `Opportunity.stage` update, `TimelineEvent` creation |
| `fallback-orchestration` | `AgentTask.fallback_used = true`, `TimelineEvent` |

### Round 2: Profile & Materials Skills → ProfileBaseline / Material

**Region guard:** Skills marked with ⚡ are only invoked when `pipeline_mode = "full_tailored"` (global_english platforms). For `passthrough` (china platforms), the orchestrator skips these skills entirely and proceeds directly from screening to submission using the user's original `ResumeAsset`.

| Skill | Maps To | Region Guard |
|---|---|---|
| `resume-parse` | `ResumeAsset.parse_status` update | Both (always runs at onboarding) |
| `profile-extraction` | New `ProfileBaseline` record, `Team.current_profile_baseline_id` update | Both (always runs at onboarding) |
| `truthful-rewrite` | New `Material` record | ⚡ `full_tailored` only |
| `section-editing` | New `Material` record (version increment) | ⚡ `full_tailored` only |
| `visual-fidelity-preservation` | `Material.preservation_mode` | ⚡ `full_tailored` only |
| `experience-normalization` | Updates `ProfileBaseline.experiences` (cleaned wording) | Both (improves screening quality) |
| `language-baseline-detection` | Sets `ProfileBaseline.source_language` | Both (always runs at onboarding) |
| `cover-letter-generation` | New `Material` (type: `cover_letter`) | ⚡ `full_tailored` only |
| `language-adaptation` / `material-localization` | New `Material` (type: `localized_resume` or language-adapted variant) | ⚡ `full_tailored` only |

### Round 3: Discovery & Matching Skills → Opportunity

| Skill | Maps To |
|---|---|
| `opportunity-discovery` | New `Opportunity` records (stage: `discovered`) |
| `source-collection` | Populates `Opportunity.external_ref`, `.job_description_url`, `.job_description_text` |
| `light-deduplication` | Sets `Opportunity.canonical_group_id` for grouped variants |
| `fit-evaluation` | `Opportunity.fit_posture`, `.fit_reason_tags` |
| `conflict-detection` | `Opportunity.risk_flags` update |
| `strategy-aware-filtering` | Influences `Opportunity.recommendation` via orchestration |
| `source-quality-signaling` | `Opportunity.source_freshness` refinement |
| `freshness-scanning` | `Opportunity.source_freshness` update |
| `recommendation-generation` | `Opportunity.recommendation`, `.recommendation_reason_tags` |

### Round 4: Execution Skills → SubmissionAttempt / Material

| Skill | Maps To |
|---|---|
| `submission-planning` | `AgentTask` creation with execution plan. When `route_to_role = "招聘关系经理"` (conversation_entry platforms like Boss直聘), orchestrator re-routes to relationship manager instead of proceeding with 投递专员 execution. |
| `application-package-assembly` | New `Material` records bundled for submission; linked via `SubmissionAttemptMaterial` |
| `field-mapping` | Ephemeral (consumed by execution, not stored directly) |
| `screening-question-support` | Ephemeral (answers consumed by submission flow, may be logged in `SubmissionAttempt.platform_response_hint`) |
| `execution-result-recording` | New `SubmissionAttempt` record |

### Round 5: Relationship Skills → ConversationThread / ConversationMessage / Handoff

| Skill | Maps To |
|---|---|
| `first-contact-drafting` | New `Material` (type: `first_contact_draft`), New `ConversationMessage` (outbound) |
| `low-risk-followup` | New `Material` (type: `follow_up_draft`), New `ConversationMessage` (outbound) |
| `reply-reading` | `ConversationMessage.reply_posture`, `.extracted_signals`, `.asks_or_requests` |
| `conversation-progression` | `ConversationThread.thread_status` update, `Opportunity.stage` transition when progression detected |
| `handoff-package-generation` | New `Handoff` record, linked `Material` records via `HandoffMaterial` |

### Round 6: Shared Assistive Skills

| Skill | Maps To |
|---|---|
| `confidence-signaling` | Ephemeral orchestration metadata (not stored) |
| `reason-tagging` | Populates `*_reason_tags` JSONB fields on relevant entities |
| `summary-generation` | Populates `summary_text` on `TimelineEvent`, `Handoff`, `Opportunity.latest_event_summary` |

### Ephemeral Skill Enums (Not Canonical)

The following enums appear in skill output schemas but are ephemeral — they are consumed during execution and never persisted as standalone database columns. They do NOT need entries in the Canonical Enumerations section:

| Skill | Ephemeral Enum | Values | Reason |
|---|---|---|---|
| `field-mapping` | `completeness` | `"filled" \| "partial" \| "missing"` | Consumed during form fill, not stored |
| `first-contact-drafting` | `compliance_status` | `"ready" \| "needs_review" \| "blocked"` | Gate for execution, logged in task metadata only |
| `low-risk-followup` | `compliance_status` | `"ready" \| "needs_review" \| "blocked"` | Gate for execution, logged in task metadata only |
| `conflict-detection` | `conflict_severity` | `"none" \| "minor" \| "meaningful" \| "blocking"` | Consumed by recommendation-generation, not stored directly |

---

## Row-Level Security (Supabase RLS)

### Design Assumption

Supabase Auth is used. `auth.uid()` returns the Supabase auth user UUID. `User.id` IS the Supabase auth UUID (i.e., `User.id = auth.uid()` directly — no lookup indirection).

### Ownership Chain

```
auth.uid() = User.id
User.id = Team.user_id
Team.id = *.team_id (on all team-scoped tables)
```

### SQL RLS Policies

```sql
-- User: own row only
CREATE POLICY user_own ON "user"
  USING (id = auth.uid());

-- Team: own team only
CREATE POLICY team_own ON team
  USING (user_id = auth.uid());

-- All team-scoped tables (opportunity, handoff, agent_instance, material,
-- conversation_thread, conversation_message, agent_task, timeline_event,
-- runtime_ledger_entry, submission_attempt, platform_connection,
-- submission_profile, profile_baseline, user_preferences,
-- platform_consent_log):
-- Applied individually per table:
CREATE POLICY team_scope ON opportunity USING (team_id IN (SELECT id FROM team WHERE user_id = auth.uid()));
CREATE POLICY team_scope ON handoff USING (team_id IN (SELECT id FROM team WHERE user_id = auth.uid()));
CREATE POLICY team_scope ON agent_instance USING (team_id IN (SELECT id FROM team WHERE user_id = auth.uid()));
CREATE POLICY team_scope ON material USING (team_id IN (SELECT id FROM team WHERE user_id = auth.uid()));
CREATE POLICY team_scope ON conversation_thread USING (team_id IN (SELECT id FROM team WHERE user_id = auth.uid()));
CREATE POLICY team_scope ON conversation_message USING (team_id IN (SELECT id FROM team WHERE user_id = auth.uid()));
CREATE POLICY team_scope ON agent_task USING (team_id IN (SELECT id FROM team WHERE user_id = auth.uid()));
CREATE POLICY team_scope ON timeline_event USING (team_id IN (SELECT id FROM team WHERE user_id = auth.uid()));
CREATE POLICY team_scope ON runtime_ledger_entry USING (team_id IN (SELECT id FROM team WHERE user_id = auth.uid()));
CREATE POLICY team_scope ON submission_attempt USING (team_id IN (SELECT id FROM team WHERE user_id = auth.uid()));
CREATE POLICY team_scope ON platform_connection USING (team_id IN (SELECT id FROM team WHERE user_id = auth.uid()));
CREATE POLICY team_scope ON submission_profile USING (team_id IN (SELECT id FROM team WHERE user_id = auth.uid()));
CREATE POLICY team_scope ON profile_baseline USING (team_id IN (SELECT id FROM team WHERE user_id = auth.uid()));
CREATE POLICY team_scope ON user_preferences USING (team_id IN (SELECT id FROM team WHERE user_id = auth.uid()));
CREATE POLICY team_scope ON platform_consent_log USING (team_id IN (SELECT id FROM team WHERE user_id = auth.uid()));

-- Junction tables: inherit access through parent entity
CREATE POLICY junction_scope ON submission_attempt_material
  USING (submission_attempt_id IN (SELECT id FROM submission_attempt WHERE team_id IN (SELECT id FROM team WHERE user_id = auth.uid())));
CREATE POLICY junction_scope ON handoff_material
  USING (handoff_id IN (SELECT id FROM handoff WHERE team_id IN (SELECT id FROM team WHERE user_id = auth.uid())));
CREATE POLICY junction_scope ON agent_task_dependency
  USING (task_id IN (SELECT id FROM agent_task WHERE team_id IN (SELECT id FROM team WHERE user_id = auth.uid())));

-- OnboardingDraft: user-scoped
CREATE POLICY onboarding_own ON onboarding_draft
  USING (user_id = auth.uid());

-- ResumeAsset: user-scoped
CREATE POLICY resume_own ON resume_asset
  USING (user_id = auth.uid());

-- PlatformDefinition: read-only for all authenticated users
CREATE POLICY platform_def_read ON platform_definition
  FOR SELECT USING (auth.uid() IS NOT NULL);
```

### Additional Security Rules

1. `TimelineEvent`: API aggregation layer must filter `visibility NOT IN ('internal', 'audit')` before returning to frontend. This is an application-layer filter on top of RLS, not a replacement.
2. `PlatformConnection.session_token_ref`: column-level encryption at rest via `pgcrypto` or Supabase Vault. Never returned in user-facing API responses.
3. `ConversationMessage.content_text`: may contain PII from employer replies. Encrypted at rest.

### Service Role

The backend orchestration engine uses Supabase service role key, which bypasses RLS. This is required for:

- system-triggered state transitions
- cross-team batch operations (admin only)
- billing ledger writes
- agent task dispatch

---

## Uniqueness Constraints Summary

| Entity | Constraint |
|---|---|
| User | `UNIQUE(email)` |
| Team | `UNIQUE(user_id)` |
| OnboardingDraft | `UNIQUE(user_id)` |
| SubmissionProfile | `UNIQUE(team_id)` |
| UserPreferences | `UNIQUE(team_id)` |
| AgentInstance | `UNIQUE(team_id, template_role_code)` |
| PlatformConnection | `UNIQUE(team_id, platform_id)` |
| PlatformDefinition | `UNIQUE(code)` |
| TimelineEvent | `UNIQUE(idempotency_key)` where not null |

---

## Index Recommendations

1. `Opportunity`: `(team_id, stage)`, `(team_id, created_at)`, `(team_id, source_platform_id)`, `(canonical_group_id)` where not null
2. `Handoff`: `(team_id, state)`, `(team_id, opportunity_id)`
3. `SubmissionAttempt`: `(team_id, opportunity_id)`, `(team_id, created_at)`
4. `Material`: `(team_id, opportunity_id)`, `(team_id, material_type)`
5. `ConversationThread`: `(team_id, opportunity_id)`
6. `ConversationMessage`: `(thread_id, sent_at)`
7. `AgentTask`: `(team_id, agent_instance_id, status)`, `(team_id, status)`
8. `TimelineEvent`: `(team_id, visibility, occurred_at)`, `(team_id, related_entity_id)`
9. `PlatformConnection`: `(team_id, platform_id)`
13. `PlatformConnection`: GIN or JSONB-path index on `capability_status` if stored as JSONB in SQL implementation
10. `RuntimeLedgerEntry`: `(team_id, created_at DESC)`
11. `AgentStateTransition`: `(agent_instance_id, created_at)`
12. `ProfileBaseline`: `(team_id, version DESC)`

---

## Soft Delete And Archival

Entities that must not be hard-deleted:

- `Opportunity` (use `closed` stage)
- `Handoff` (use `closed` state)
- `AgentStateTransition` (append-only)
- `TimelineEvent` (append-only)
- `RuntimeLedgerEntry` (append-only)
- `ConversationMessage` (append-only)
- `SubmissionAttempt` (append-only)
- `Material` (use `superseded` status)

---

## Migration And Versioning

### Schema Versioning Rule

Every schema change must be tracked in a numbered migration.

### Backward Compatibility Rule

Enum additions are backward-compatible. Enum removals or renames require a migration plan with explicit handling of existing data.

### ProfileBaseline Versioning

When a user re-uploads a resume:

1. New `ProfileBaseline` record with `version = previous + 1`
2. `Team.current_profile_baseline_id` updated to new record
3. Previous versions preserved for audit
4. In-flight tasks complete with old version; new tasks use new version

---

## Final Data Model Principle

This document is the single source of truth for entity shapes, enumerations, and state machines.

### Required Frontend Spec Updates

The following changes in `FRONTEND_INTERFACE_SPEC.md` are required to align with this document:

1. `TeamSummary.coverage_scope`: change `cross_market_global` → `cross_market`
2. `SettingsPreferences.coverage_scope`: change `cross_market_global` → `cross_market`
3. `SettingsPreferences.strategy_mode`: remove `aggressive`, keep only `balanced | broad | precise`
4. `TeamSummary.strategy_mode`: remove `aggressive`
5. `HandoffSummary.handoff_type`: add `reference_check` and `offer_decision`
6. `PlatformSummary.status`: replace `reconnect_required` with `session_expired`
7. `AgentSummary.status`: verify mapping from `AgentRuntimeState` uses table in this doc (notably `handoff` → `waiting`)
8. `PlatformSummary.platform_type`: align with canonical `PlatformType` (add `ats_portal`, remove `other`)
9. `PlatformSummary.capability_status`: add capability-level health to frontend-facing platform payloads

Cross-spec alignment resolutions:

1. `StrategyMode`: 3 values — `balanced`, `broad`, `precise`
2. `CoverageScope`: `cross_market` replaces `cross_market_global`
3. `AgentRuntimeState` → `AgentFrontendStatus`: `handoff` → `waiting`
4. `HandoffType`: includes `reference_check` and `offer_decision`
5. `PlatformStatus`: `session_expired` replaces frontend's `reconnect_required`
6. `ProfileBaseline`: fully defined with versioning
7. `Material`: new entity for all generated artifacts
8. `ConversationThread` / `ConversationMessage`: new entities for conversation tracking
9. `SubmissionAttempt`: new entity for execution records with retry support
10. `RuntimeLedger`: session-window billing, no per-tick entries
11. All skill outputs mapped to entities or marked ephemeral
12. RLS uses Supabase `auth.uid()` chain
13. All inline enums cataloged in Canonical Enumerations section
14. `PlatformConnection` must carry capability-level health rather than only a binary connection state
