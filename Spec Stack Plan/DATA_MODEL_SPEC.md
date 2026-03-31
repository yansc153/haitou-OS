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

Implementation may use PostgreSQL, Supabase, or another relational backend. The model should translate cleanly into any relational schema.

## Canonical Enumerations

All enumerations below are authoritative. Frontend, backend, skill outputs, and orchestration must use these exact values.

### StrategyMode

```ts
type StrategyMode = "balanced" | "broad" | "precise"
```

- `balanced`: default mode, balances coverage and relevance
- `broad`: wider search, faster expansion, higher tolerance for imperfect fit
- `precise`: tighter fit, narrower selection, lower volume

Note: `aggressive` was used in some earlier drafts but is retired. `broad` absorbs that intent. Three modes only.

### CoverageScope

```ts
type CoverageScope = "china" | "global_english" | "cross_market"
```

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

Note: `material_ready` replaces the conceptual `tailored` stage from `PRODUCT_FLOWS.md`. This is when materials have been prepared but submission has not yet started. `needs_takeover` is the active state requiring user action; once the user resolves it, the opportunity either continues or closes.

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

Distinction from TeamStatus:

- `TeamStatus` is the long-lived lifecycle state of the team entity
- `TeamRuntimeStatus` is the live operational status, changes frequently during active use
- Both are persisted; runtime status changes do not alter lifecycle status unless explicitly transitioned

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

### AgentFrontendStatus

This is the derived display status for frontend consumption. It is not stored in the database; it is computed from `AgentRuntimeState`.

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
| `handoff` | `working` |

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

### PlatformRegion

```ts
type PlatformRegion = "china" | "global_english"
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

## Core Entities

### User

```ts
type User = {
  id: string                          // primary key, UUID
  email: string                       // unique, from OAuth
  display_name: string
  avatar_url?: string
  locale: "zh-CN" | "en"
  timezone: string
  auth_provider: string               // e.g. "google", "github", "wechat"
  auth_provider_id: string            // provider-specific user ID
  created_at: string                  // ISO 8601
  updated_at: string
}
```

Constraints:

- one user has one active team in v1
- email is unique

### Team

```ts
type Team = {
  id: string                          // primary key, UUID
  user_id: string                     // FK → User.id, unique in v1
  name: string                        // display name, e.g. "我的求职团队"
  status: TeamStatus
  runtime_status: TeamRuntimeStatus
  strategy_mode: StrategyMode
  coverage_scope: CoverageScope
  pause_origin?: PauseOrigin
  onboarding_draft_id?: string        // FK → OnboardingDraft.id
  plan_tier: PlanTier
  runtime_balance_seconds: number     // remaining runtime in current billing cycle
  runtime_used_seconds: number        // used runtime in current billing cycle
  billing_cycle_start: string
  billing_cycle_end: string
  created_at: string
  activated_at?: string
  started_at?: string
  paused_at?: string
  updated_at: string
}
```

Constraints:

- `user_id` is unique (1:1 with user in v1)
- `runtime_balance_seconds` is the source of truth for billing, not per-agent counters

### OnboardingDraft

```ts
type OnboardingDraft = {
  id: string
  user_id: string                     // FK → User.id
  team_id?: string                    // FK → Team.id, set after team creation
  status: "resume_required" | "questions_in_progress" | "ready_for_activation" | "completed"
  resume_asset_id?: string            // FK → ResumeAsset.id
  resume_upload_status: "missing" | "uploading" | "uploaded" | "processing" | "processed" | "failed"
  resume_parse_error_code?: string
  resume_parse_error_message?: string
  answered_fields: Record<string, unknown>
  completed_question_ids: string[]
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
  file_mime_type: string              // "application/pdf" | "application/msword" | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  storage_path: string                // internal storage reference
  upload_status: "uploading" | "uploaded" | "failed"
  parse_status: "pending" | "processing" | "parsed" | "failed"
  is_primary: boolean
  created_at: string
  updated_at: string
}
```

### ProfileBaseline

This is the structured profile that the `履历分析师` produces from resume parsing. It is the foundational input for all downstream skills.

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
  seniority_level?: string            // e.g. "junior", "mid", "senior", "lead", "executive"
  primary_domain?: string             // e.g. "software_engineering", "product_management", "design"
  headline_summary?: string           // 1-2 sentence capability summary

  // structured experience
  experiences: ProfileExperience[]
  education: ProfileEducation[]
  skills: string[]
  languages: ProfileLanguage[]
  certifications?: string[]

  // capability inference
  inferred_role_directions: string[]  // e.g. ["frontend_engineer", "full_stack_engineer"]
  capability_tags: string[]           // e.g. ["react", "typescript", "system_design"]
  capability_gaps?: string[]          // known weak areas

  // metadata
  source_language: "zh" | "en" | "bilingual"
  parse_confidence: ConfidenceBand
  factual_gaps: string[]              // fields that could not be reliably extracted
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

### SubmissionProfile

Execution-critical personal information not guaranteed to be in the resume. Required for platform form filling.

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
  relocation_preference?: string
  notice_period?: string
  compensation_preference?: string
  external_links?: string[]
  completion_band: "missing" | "partial" | "minimum_ready" | "complete"
  missing_required_fields: string[]
  created_at: string
  updated_at: string
}
```

### AgentInstance

Defined in `AGENT_INSTANCE_AND_STATE_SPEC.md` and carried forward here as the canonical schema.

```ts
type AgentInstance = {
  id: string
  team_id: string                     // FK → Team.id
  template_role_code: AgentRoleCode
  template_version: string
  role_title_zh: string
  persona_name: string
  persona_portrait_ref?: string
  lifecycle_state: AgentLifecycleState
  runtime_state: AgentRuntimeState
  total_active_runtime_seconds: number
  total_tasks_completed: number
  total_handoffs_triggered: number
  total_blocked_count: number
  current_assignment_id?: string
  current_assignment_type?: string
  last_active_at?: string
  last_completed_at?: string
  last_block_reason_code?: string
  last_blocked_at?: string
  health_status?: "healthy" | "degraded" | "unstable"
  created_at: string
  initialized_at?: string
  activated_at?: string
  archived_at?: string
  updated_at: string
}
```

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

Role code to Chinese title mapping:

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

  // source
  source_platform_id: string          // FK → Platform.id
  external_ref?: string               // platform-specific job ID
  source_freshness: "new" | "recent" | "stale" | "unknown"

  // evaluation
  fit_posture?: FitPosture
  fit_reason_tags?: string[]
  recommendation?: RecommendationVerdict
  recommendation_reason_tags?: string[]
  recommendation_next_step_hint?: string

  // execution
  execution_outcome?: ExecutionOutcome
  execution_failure_reason?: string
  submitted_at?: string
  submitted_resume_asset_id?: string
  submitted_cover_letter?: boolean

  // progression
  priority_level: "low" | "medium" | "high" | "critical"
  lead_agent_id?: string              // FK → AgentInstance.id
  requires_takeover: boolean
  closure_reason?: OpportunityClosureReason
  closed_at?: string

  // meta
  why_selected_summary?: string
  risk_flags: string[]
  next_step_summary?: string
  current_owner_type: "team" | "user" | "shared"
  latest_event_at?: string
  latest_event_summary?: string
  created_at: string
  updated_at: string
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
  urgency: "low" | "medium" | "high" | "critical"

  // context
  source_agent_id?: string            // FK → AgentInstance.id
  source_agent_role_code?: AgentRoleCode
  handoff_reason: string
  context_summary: string
  explanation_text?: string
  suggested_next_action?: string
  suggested_reply_text?: string
  risk_notes: string[]

  // assets
  included_assets?: HandoffAsset[]

  // lifecycle
  due_at?: string
  takeover_started_at?: string
  resolved_at?: string
  returned_at?: string
  closed_at?: string
  resolution_type?: "resolved" | "returned_to_team" | "closed_by_user" | "expired"

  created_at: string
  updated_at: string
}

type HandoffAsset = {
  asset_type: "resume" | "cover_letter" | "summary" | "reply_draft" | "context_card"
  asset_ref?: string
}
```

### PlatformDefinition

Static platform metadata. Not user-specific.

```ts
type PlatformDefinition = {
  id: string
  code: string                        // e.g. "boss_zhipin", "linkedin", "greenhouse"
  display_name: string
  display_name_zh: string
  region: PlatformRegion
  platform_type: "job_board" | "recruiter_network" | "ats_portal" | "email_outreach"
  base_url: string
  supports_direct_apply: boolean
  supports_messaging: boolean
  supports_cookie_session: boolean
  anti_scraping_level: "low" | "medium" | "high" | "extreme"
  min_plan_tier: PlanTier             // minimum plan tier required
  is_active: boolean                  // globally enabled/disabled
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
  session_token_ref?: string          // encrypted reference to stored session/cookie
  session_expires_at?: string
  last_health_check_at?: string
  last_successful_action_at?: string
  failure_count: number               // consecutive failures
  failure_reason?: string
  requires_user_action: boolean
  created_at: string
  updated_at: string
}
```

### RuntimeLedger

Team-level billing source of truth.

```ts
type RuntimeLedgerEntry = {
  id: string
  team_id: string                     // FK → Team.id
  entry_type: "start" | "pause" | "resume" | "tick" | "allocation" | "adjustment"
  runtime_delta_seconds: number       // positive for allocation, negative for usage
  balance_after_seconds: number
  trigger_source: "user" | "system" | "billing" | "admin"
  reason?: string
  created_at: string
}
```

### AgentTask

Tracks individual work assignments dispatched by the orchestrator.

```ts
type AgentTask = {
  id: string
  team_id: string                     // FK → Team.id
  agent_instance_id: string           // FK → AgentInstance.id
  task_type: string                   // e.g. "opportunity_discovery", "fit_evaluation", "submission"
  task_loop: TaskLoop
  status: TaskStatus
  priority: "low" | "medium" | "high" | "critical"

  // context
  related_entity_type?: "opportunity" | "handoff" | "platform" | "material" | "team"
  related_entity_id?: string
  trigger_source: "orchestrator" | "platform_event" | "user_action" | "timer" | "upstream_completion"
  input_summary?: string
  output_summary?: string
  dependency_ids?: string[]           // FK → AgentTask.id[]
  boundary_flags?: string[]

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

### TimelineEvent

Shared event shape for all timeline-like surfaces.

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
  related_entity_type?: "team" | "opportunity" | "handoff" | "platform" | "task"
  related_entity_id?: string
  handoff_to_actor_id?: string
  handoff_to_actor_name?: string
  visibility: "feed" | "opportunity_timeline" | "internal" | "audit"
  metadata?: Record<string, unknown>
  created_at: string
}
```

### AgentStateTransition

Audit log for agent state changes.

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

Durable settings editable by the user.

```ts
type UserPreferences = {
  id: string
  user_id: string                     // FK → User.id
  team_id: string                     // FK → Team.id
  locale: "zh-CN" | "en"
  notifications_enabled: boolean
  preferred_locations: string[]
  work_mode: WorkMode
  salary_expectation?: string
  strategy_mode: StrategyMode
  coverage_scope: CoverageScope
  boundary_preferences?: Record<string, boolean>
  created_at: string
  updated_at: string
}
```

Source of truth rule:

- `UserPreferences` is the editable preference source
- `Team.strategy_mode` and `Team.coverage_scope` reflect the currently applied team state
- After a settings mutation, the corresponding Team fields must be synchronized

## Entity Relationships

```
User (1) ──── (1) Team
User (1) ──── (1) OnboardingDraft
User (1) ──── (N) ResumeAsset
Team (1) ──── (1) ProfileBaseline (latest version)
Team (1) ──── (1) SubmissionProfile
Team (1) ──── (7) AgentInstance
Team (1) ──── (N) Opportunity
Team (1) ──── (N) Handoff
Team (1) ──── (N) PlatformConnection
Team (1) ──── (N) RuntimeLedgerEntry
Team (1) ──── (N) AgentTask
Team (1) ──── (N) TimelineEvent
Team (1) ──── (1) UserPreferences
Opportunity (1) ──── (N) Handoff
Opportunity (N) ──── (1) PlatformDefinition (via source_platform_id)
AgentInstance (1) ──── (N) AgentTask
AgentInstance (1) ──── (N) AgentStateTransition
PlatformConnection (N) ──── (1) PlatformDefinition
```

## State Machines

### Opportunity Stage Transitions

```
discovered → screened → prioritized → material_ready → submitted
                                                      → contact_started
                                        submitted → contact_started
                                  contact_started → followup_active
                                  followup_active → positive_progression
                              positive_progression → needs_takeover
                                                   → closed

Any active stage → needs_takeover (when handoff boundary reached)
Any active stage → closed (when closure condition met)
needs_takeover → closed (user resolves)
needs_takeover → followup_active (returned to team, rare)
```

Illegal transitions:

- `closed → any active stage` (closed is terminal; create a new opportunity if needed)
- `submitted → discovered` (no backward movement)
- `needs_takeover → submitted` (cannot re-submit after handoff)

### Handoff State Transitions

```
awaiting_takeover → in_user_handling
in_user_handling → waiting_external
in_user_handling → resolved
in_user_handling → returned_to_team
waiting_external → in_user_handling
waiting_external → resolved
waiting_external → closed
resolved → closed (administrative cleanup)
returned_to_team → closed (if opportunity subsequently closes)
```

When `returned_to_team`:

- the associated opportunity should be evaluated by `调度官`
- if opportunity is still valid, it may return to `followup_active` or `positive_progression`
- the `匹配审核员` may be asked to re-evaluate before re-entering the automation loop

### Team Status Transitions

```
draft → onboarding → activation_pending → ready → active → paused → active (resume)
                                                         → suspended (system)
                                                         → archived
paused → active (user resume)
paused → archived (abandonment)
suspended → paused (after system recovery)
suspended → archived
```

### Platform Connection Status Transitions

```
available_unconnected → pending_login → active
active → session_expired → pending_login → active
active → restricted
session_expired → restricted
restricted → pending_login (after resolution)
plan_locked → available_unconnected (after upgrade)
unavailable (system-disabled)
```

## Skill Output To Entity Mapping

This section defines how skill outputs flow into stored entities.

### fit-evaluation → Opportunity

```
FitEvaluationOutput.fit_posture → Opportunity.fit_posture
FitEvaluationOutput.fit_reason_tags → Opportunity.fit_reason_tags
```

### recommendation-generation → Opportunity

```
RecommendationGenerationOutput.recommendation → Opportunity.recommendation
RecommendationGenerationOutput.reason_tags → Opportunity.recommendation_reason_tags
RecommendationGenerationOutput.next_step_hint → Opportunity.recommendation_next_step_hint
```

### execution-result-recording → Opportunity

```
ExecutionResultRecordingOutput.execution_outcome → Opportunity.execution_outcome
ExecutionResultRecordingOutput.failure_reason_code → Opportunity.execution_failure_reason
```

### handoff-package-generation → Handoff

```
HandoffPackageGenerationOutput.handoff_reason → Handoff.handoff_reason
HandoffPackageGenerationOutput.context_summary → Handoff.context_summary
HandoffPackageGenerationOutput.suggested_next_action → Handoff.suggested_next_action
HandoffPackageGenerationOutput.suggested_reply_text → Handoff.suggested_reply_text
HandoffPackageGenerationOutput.included_assets → Handoff.included_assets
```

### opportunity-discovery → Opportunity (creation)

```
OpportunityDiscoveryOutput.discovered_candidates → new Opportunity records
  .company_name → Opportunity.company_name
  .job_title → Opportunity.job_title
  .region_hint → Opportunity.location_label
  .source_platform → Opportunity.source_platform_id (via PlatformDefinition lookup)
  .external_ref → Opportunity.external_ref
  .freshness_hint → Opportunity.source_freshness
```

Initial stage on creation: `discovered`

### confidence-signaling

`ConfidenceSignalingOutput.confidence_band` is not stored on any entity directly. It is used as ephemeral orchestration metadata to influence routing decisions by `调度官`.

### summary-generation

`SummaryGenerationOutput.summary_text` is used to populate `summary_text` fields on TimelineEvent, Handoff, and Opportunity `latest_event_summary`.

## Row-Level Security

All user data must be scoped by team ownership.

### RLS Rules

1. Every query against user-owned data must include `team_id` in the WHERE clause
2. A user may only access data belonging to their own team
3. `PlatformDefinition` is a shared reference table and does not require team-scoped RLS
4. `TimelineEvent` with `visibility = "internal"` or `visibility = "audit"` should not be returned in user-facing API responses
5. Session tokens in `PlatformConnection.session_token_ref` must be encrypted at rest
6. `ResumeAsset.storage_path` should reference encrypted storage; raw files must not be accessible without authorization

### Soft Delete Rule

Entities should prefer soft delete (`archived` state or `deleted_at` timestamp) over hard delete wherever audit history matters.

Entities that must not be hard-deleted:

- `Opportunity`
- `Handoff`
- `AgentStateTransition`
- `TimelineEvent`
- `RuntimeLedgerEntry`

## Event Recording Rules

### When To Write TimelineEvent

A TimelineEvent should be created for:

1. Opportunity stage changes
2. Agent task completion with meaningful business outcome
3. Handoff creation
4. Handoff state changes
5. Team start / pause / resume
6. Platform connection changes that affect execution
7. Significant orchestration decisions (e.g., re-routing, fallback triggered)

### Visibility Classification

- `feed`: shown in Team Home live feed
- `opportunity_timeline`: shown in Opportunity Detail timeline
- `internal`: visible in admin/debug surfaces only
- `audit`: permanent record, never exposed to users

### Duplicate Event Prevention

Events should be idempotent where possible. The system should not create duplicate events for the same state transition. Use `(team_id, event_type, related_entity_id, occurred_at)` as a natural deduplication key.

## Index Recommendations

The following indexes should exist for query performance:

1. `Opportunity`: `(team_id, stage)`, `(team_id, created_at)`, `(team_id, source_platform_id)`
2. `Handoff`: `(team_id, state)`, `(team_id, opportunity_id)`
3. `AgentTask`: `(team_id, agent_instance_id, status)`, `(team_id, status)`
4. `TimelineEvent`: `(team_id, visibility, occurred_at)`, `(team_id, related_entity_id)`
5. `PlatformConnection`: `(team_id, platform_id)`
6. `RuntimeLedgerEntry`: `(team_id, created_at)`
7. `AgentStateTransition`: `(agent_instance_id, created_at)`

## Migration And Versioning

### Schema Versioning Rule

Every schema change must be tracked in a numbered migration.

### Backward Compatibility Rule

Enum additions are backward-compatible. Enum removals or renames require a migration plan.

### ProfileBaseline Versioning

When a user re-uploads a resume:

1. A new `ProfileBaseline` record is created with `version = previous + 1`
2. The previous version is preserved for audit
3. Downstream agents should always reference the latest version
4. In-flight tasks using the old version should complete but new tasks should use the new version

## Final Data Model Principle

This document is the single source of truth for entity shapes, enumerations, and state machines.

If a frontend type, API contract, skill output, or UI surface disagrees with this document, this document wins.

All cross-spec alignment issues identified in the adversarial review are resolved here:

1. `StrategyMode` is locked to 3 values: `balanced`, `broad`, `precise`
2. `OpportunityStage` includes `material_ready` and excludes the ambiguous `tailored`
3. `AgentRuntimeState` → `AgentFrontendStatus` mapping is explicitly defined
4. `TeamStatus` and `TeamRuntimeStatus` are distinct with clear purposes
5. `ProfileBaseline` is fully defined as an entity
6. All skill output → entity mappings are explicit
