# Frontend Interface Spec

## Document Purpose

This document defines the frontend state model, page data requirements, event flows, and component contracts for Haitou OS.

It is intended to serve as a shared implementation contract between:

- frontend engineering
- backend engineering
- product
- design

This document should make the product easier to build without forcing the team to guess:

- what data each page needs
- what shared models should exist
- how state should be organized
- which actions are user-triggered vs system-triggered
- how realtime updates should behave
- what API contracts should exist
- which components are first-class and reusable

## Relationship To Earlier Specs

This document builds on:

- `PRD_FIRST_PRINCIPLES.md`
- `BUSINESS_REQUIREMENTS_FIRST_PRINCIPLES.md`
- `PRODUCT_FLOWS.md`
- `UI_GENERATION_BRIEF.md`
- `UI_SURFACE_SPEC.md`

Those documents define:

- product truth
- business and automation boundaries
- lifecycle and handoff behavior
- UI narrative and visual direction
- page responsibilities

This document translates those decisions into:

`frontend state, interface contracts, and implementation-facing interaction models`

## Core Interface Principle

The frontend should not be modeled as a set of disconnected screens.

It should be modeled as:

`one persistent team-based application shell with multiple operating surfaces sharing a stable domain model`

That means:

- shared entities should stay consistent across pages
- page-specific payloads should be aggregated for frontend convenience
- realtime data should be scoped to meaningful live surfaces
- component contracts should be stable even if visual design evolves

## Architecture Direction

The recommended implementation direction is:

1. domain-first data modeling
2. UI-facing aggregation layer
3. React-friendly state separation
4. layered data freshness strategy

Concretely:

- backend core contracts should center on stable domain entities
- frontend should receive page-friendly aggregate payloads
- frontend state should be split into global, page-local, and live-stream layers
- not every surface should be realtime in the same way

## Recommended Frontend State Layers

The frontend state should be organized into three layers.

### 1. Global App State

This state is shared across logged-in pages and survives route changes.

Examples:

- current user
- current team identity
- team runtime state
- execution readiness status
- shell navigation state
- lightweight plan/runtime indicator
- language
- account state
- global pending handoff count
- global unread or unseen live event count if used

### 2. Page-Local State

This state is owned by a specific page or route and can be reset when the user leaves the page.

Examples:

- current opportunity filters
- selected pipeline stage
- current open opportunity detail panel
- handoff list sort mode
- current settings tab
- selected platform region
- review timeframe

### 3. Live Stream State

This state represents fast-changing operational data that needs near-realtime updates.

Examples:

- live feed events
- team runtime transitions
- pending handoff count
- opportunity latest event stream
- opportunity detail timeline tail

This layer should be isolated so the entire app does not rerender as operational data changes.

## Data Freshness Strategy

The app should use a layered freshness strategy rather than treating all data as equally realtime.

### Hot State

Hot state should be near-realtime.

Examples:

- `Live Feed`
- `Start Team / Pause Team` state
- pending handoff count
- latest opportunity timeline events

Recommended transport:

- SSE or WebSocket for event delivery
- fallback polling when transport is unavailable

### Warm State

Warm state should refresh regularly but does not need event-stream semantics.

Examples:

- Team Home high-value opportunity summaries
- Handoff list
- Opportunity list
- platform availability summaries

Recommended transport:

- polling
- route revalidation
- explicit refresh after mutations

### Cold State

Cold state changes relatively infrequently.

Examples:

- plan details
- settings values
- onboarding defaults
- submission profile defaults
- review summary windows
- static platform metadata

## Submission Profile And Readiness Models

The frontend should model execution readiness explicitly rather than treating missing execution data as ad hoc form errors.

```ts
type StrategyMode = "broad" | "balanced" | "aggressive" | "precise"

type SubmissionProfile = {
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
  missing_required_fields?: string[]
  updated_at?: string
}

type ExecutionReadinessStatus = {
  readiness_status: "not_ready" | "partially_ready" | "minimum_ready" | "fully_ready"
  blockers: string[]
  warnings?: string[]
  recommended_next_steps: string[]
  requires_platform_connection: boolean
  requires_submission_profile_completion: boolean
}

type ProfileBaseline = {
  id: string
  source_resume_id?: string
  preferred_role_directions: string[]
  experience_theme_tags: string[]
  seniority_hint?: string
  education_summary?: string
  language_profile: Array<{
    language: string
    confidence: "high" | "medium" | "low"
  }>
  location_constraints?: string[]
  factual_gaps?: string[]
  confidence_notes?: string[]
  updated_at: string
}
```

Recommended transport:

- standard request-response fetch
- cache with background revalidation

## Minimum Readiness Baseline

The canonical `minimum_ready` baseline for v1 is:

- resume upload completed
- onboarding questions completed
- team activation confirmed
- at least one execution-capable platform connected or authenticated
- submission profile includes:
  - `phone`
  - `contact_email`
  - at least one location anchor from `current_city` or `current_country`

Fields such as `notice_period`, `compensation_preference`, `external_links`, or `relocation_preference` may remain incomplete unless a target platform or opportunity explicitly requires them.

Backend validation remains the source of truth for readiness gating.

## Recommended Routing Structure

The frontend should use a route system that reflects page responsibility and keeps logged-in surfaces under one app shell.

### Public Routes

- `/`
- `/login`

### Activation Routes

- `/onboarding`
- `/activate`

### Logged-In App Routes

- `/app/readiness`
- `/app/home`
- `/app/opportunities`
- `/app/handoffs`
- `/app/platforms`
- `/app/plan`
- `/app/settings`
- `/app/review`

### Detail Surface Routes

These may be represented as panels first, but stable route patterns should still exist for deep-linking and future expansion.

- `/app/opportunities/:opportunityId`
- `/app/agents/:agentId`
- `/app/handoffs/:handoffId`

## Route Guards And Entry Rules

The frontend must enforce route entry rules consistently.

### Public Route Rule

If the user is not authenticated:

- public routes remain accessible
- any logged-in route must redirect to `/login`

### Login Redirect Rule

Unauthenticated users should always go through `Login Entry` first.

That means:

- direct navigation to `/app/...` should redirect to `/login`
- direct navigation to activation routes should redirect to `/login`

### Post-Login Progression Rule

After login, the next route depends on user setup state.

Recommended progression:

1. `resume not uploaded`
- redirect to `/onboarding`

2. `resume uploaded but onboarding questions incomplete`
- remain in `/onboarding`

3. `onboarding answers complete but team activation not confirmed`
- redirect to `/activate`

4. `activation confirmed but execution readiness incomplete`
- redirect to `/app/readiness`

5. `activation confirmed and minimum execution readiness satisfied`
- redirect to `/app/home`

### Paused Team Rule

If the team is paused:

- all logged-in routes remain accessible
- no route should force the user out of the app
- paused state should be conveyed by shell and page status, not by route denial

## Auth And Session Contract

Authentication and session handling should be explicit in the frontend contract.

The product should prefer a stable, low-friction session model rather than frequent forced re-login.

## Auth Session Model

```ts
type SessionSummary = {
  is_authenticated: boolean
  user_id?: string
  session_state: "anonymous" | "authenticated" | "expired" | "refreshing"
  issued_at?: string
  expires_at?: string
  refresh_expires_at?: string
}
```

## Recommended Session Lifecycle

For v1, the recommended session policy is:

- short-lived access session
- longer-lived refresh session
- silent refresh where possible

Recommended baseline:

- access token or active app session: about `8 hours`
- refresh session: about `30 days`
- inactivity timeout may be shorter if needed for security

This is a practical default because:

- users do not need to log in repeatedly during normal use
- long-running job-team usage still feels persistent
- security remains more controlled than permanent sessions

## Session Rules

- an authenticated session should survive normal page refreshes
- silent refresh should happen before hard expiry when possible
- hard-expired sessions should redirect to `/login`
- session expiry should preserve intended destination so the user can resume after login

## Auth Endpoints

### GET `/api/auth/session`

Response:

```json
{
  "data": {
    "session": {
      "is_authenticated": true,
      "session_state": "authenticated",
      "issued_at": "",
      "expires_at": "",
      "refresh_expires_at": ""
    },
    "user": {}
  }
}
```

### POST `/api/auth/logout`

Response:

```json
{
  "data": {
    "logged_out": true
  }
}
```

## Session Expiry Handling

If the session expires while the user is in the app:

- current page state may remain in memory temporarily
- new protected requests should fail with `UNAUTHORIZED`
- frontend should clear authenticated global state
- user should be redirected to `/login`
- after successful login, the app should attempt to restore the intended route

## Auth Error UX Rule

Session expiry should feel controlled, not catastrophic.

The frontend should avoid:

- instantly blanking the interface
- losing draft onboarding answers already persisted
- losing route intent

It should instead:

- show a calm session-expired message
- redirect to login
- resume gracefully after re-authentication

## Internationalization Contract

The app should support Chinese-first operation with future-safe English switching.

## Locale Model

```ts
type LocaleCode = "zh-CN" | "en"
```

## i18n Rules

- the default locale should be `zh-CN`
- the shell may switch locale between `zh-CN` and `en`
- page structure should not depend on one locale only
- domain objects should support either localized labels or frontend translation keys

## Timeline And Summary Text Rule

Timeline-like objects should continue to provide:

- structured fields
- `summary_text`

For future bilingual support, the preferred path is:

- backend may return `summary_text`
- backend may also optionally return `summary_i18n_key`
- frontend may fall back to `summary_text` when structured translation is not yet implemented

Recommended optional extension:

```ts
type LocalizedText = {
  default_text: string
  i18n_key?: string
  params?: Record<string, string | number | boolean>
}
```

## i18n Fallback Rule

If a localized string is unavailable:

- use the default locale text
- never leave critical UI blank
- critical action labels should always have frontend-owned translations

## Global App Shell Contract

The logged-in shell is a first-class frontend concern.

### Shell Data Requirements

The shell should have access to:

- current user summary
- team summary
- team runtime state
- global pending handoff count
- lightweight plan/runtime summary
- route-aware navigation state
- language setting

### Shell Actions

The shell must support:

- navigate between primary surfaces
- start team
- pause team
- open account menu
- switch language

### Shell Realtime Awareness

The shell should receive near-realtime updates for:

- team runtime state
- pending handoff count
- runtime-limit warning state if applicable

## Onboarding And Activation Contracts

Onboarding must be treated as a real stateful workflow, not as a static form.

The frontend should be able to resume onboarding safely across refreshes and sessions.

## OnboardingDraft

```ts
type OnboardingDraft = {
  id: string
  status: "resume_required" | "questions_in_progress" | "ready_for_activation" | "completed"
  resume_upload_status: "missing" | "uploading" | "uploaded" | "processing" | "processed" | "failed"
  resume_asset_id?: string
  resume_file_name?: string
  resume_file_size_bytes?: number
  resume_file_mime_type?: string
  resume_parse_error_code?: string
  resume_parse_error_message?: string
  extracted_profile_summary?: string
  answered_fields: Record<string, string | string[] | boolean | null>
  pending_questions: OnboardingQuestion[]
  completed_question_ids: string[]
  last_updated_at: string
}
```

## File Upload Contract

Resume upload is a critical onboarding dependency and must be specified clearly.

## Accepted File Rules

The resume upload contract should support:

- maximum file size: `10MB`
- accepted formats:
  - `application/pdf`
  - `application/msword`
  - `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

User-facing shorthand:

- `PDF`
- `DOC`
- `DOCX`

## Resume Upload Validation

Validation should occur at both frontend and backend layers.

### Frontend Validation

Before upload begins, the frontend should check:

- file exists
- file size <= `10MB`
- file extension or MIME type is allowed

### Backend Validation

The backend must re-check:

- file size
- file type
- parser support eligibility

Frontend validation improves UX.
Backend validation is the source of truth.

## Resume Upload States

The frontend should support the following upload and parse lifecycle:

1. `missing`
2. `uploading`
3. `uploaded`
4. `processing`
5. `processed`
6. `failed`

## Resume Upload UX Rules

The user should see:

- selected file name
- file size
- upload progress when available
- processing state after upload completes
- clear success or failure outcome

The user should not be left wondering whether parsing is still happening.

## Resume Parse Failure Recovery

If parsing fails:

- the onboarding draft must remain recoverable
- the user should be able to retry upload
- the user should be able to replace the file
- the UI should explain the likely reason in plain language

Examples:

- unsupported format
- file too large
- corrupted or unreadable document
- parsing failed unexpectedly

## Resume Upload Error Messages

Preferred user-facing guidance examples:

- `文件大小不能超过 10MB。`
- `请上传 PDF、DOC 或 DOCX 格式的简历。`
- `简历上传成功，正在解析内容。`
- `简历解析失败，请重新上传更清晰的 PDF 或 Word 文件。`
- `我们暂时无法读取这份文件，请更换格式后重试。`

## OnboardingQuestion

```ts
type OnboardingQuestion = {
  id: string
  key: string
  type: "single_select" | "multi_select" | "text" | "number" | "location_list"
  title: string
  description?: string
  required: boolean
  options?: Array<{ value: string; label: string }>
}
```

## ActivationSummary

```ts
type ActivationSummary = {
  team: TeamSummary
  onboarding_draft_id: string
  understanding_summary: {
    preferred_locations: string[]
    work_mode?: string
    salary_expectation?: string
    strategy_mode: StrategyMode
    coverage_scope: string
  }
  first_operating_focus: {
    markets: string[]
    platform_cluster: string[]
    emphasis_summary: string
  }
  automation_summary: string[]
  boundary_summary: string[]
  agents: AgentSummary[]
}
```

## Shared Domain Models

The backend should define stable domain entities first.

The frontend should not have to infer them from inconsistent page payloads.

## Core Entity: UserSummary

```ts
type UserSummary = {
  id: string
  display_name: string
  email: string
  avatar_url?: string
  locale: "zh-CN" | "en"
  timezone: string
}
```

## Core Entity: TeamSummary

```ts
type TeamSummary = {
  id: string
  name: string
  status: "draft" | "ready" | "active" | "paused" | "attention_required"
  started_at?: string
  paused_at?: string
  core_agent_count: number
  specialist_agent_count: number
  strategy_mode: StrategyMode
  coverage_scope: "china" | "global_english" | "cross_market_global"
}
```

## Core Entity: TeamRuntimeSummary

```ts
type TeamRuntimeSummary = {
  team_id: string
  runtime_status: "active" | "paused" | "starting" | "pausing" | "attention_required"
  pending_handoff_count: number
  active_opportunity_count: number
  live_feed_unseen_count?: number
  last_runtime_transition_at?: string
}
```

## Core Entity: AgentSummary

```ts
type AgentSummary = {
  id: string
  code: string
  name: string
  role_title_zh: string
  portrait_url?: string
  status: "idle" | "working" | "waiting" | "paused" | "blocked"
  tenure_label?: string
  primary_responsibility: string
  current_task_summary?: string
  accent_key?: string
}
```

## Agent Runtime To Surface Status Mapping

Frontend-facing `AgentSummary.status` is a presentation layer, not the raw runtime enum.

Canonical mapping:

- `sleeping` -> `idle`
- `ready` -> `idle`
- `completed` -> `idle`
- `active` -> `working`
- `waiting` -> `waiting`
- `handoff` -> `waiting`
- `paused` -> `paused`
- `blocked` -> `blocked`

This mapping should be applied consistently by backend aggregation or a single shared frontend adapter.

## Core Entity: OpportunitySummary

```ts
type OpportunitySummary = {
  id: string
  company_name: string
  job_title: string
  location_label?: string
  platform_id?: string
  platform_name?: string
  stage:
    | "discovered"
    | "screened"
    | "prioritized"
    | "submitted"
    | "contact_started"
    | "followup_active"
    | "positive_progression"
    | "needs_takeover"
    | "closed"
  stage_label: string
  priority_level: "low" | "medium" | "high" | "critical"
  lead_agent_id?: string
  lead_agent_name?: string
  requires_takeover: boolean
  latest_event_at?: string
  latest_event_summary?: string
  closure_reason_code?: string
}
```

## Opportunity Stage Canonical Rule

The canonical user-facing opportunity stage enum for v1 is:

- `discovered`
- `screened`
- `prioritized`
- `submitted`
- `contact_started`
- `followup_active`
- `positive_progression`
- `needs_takeover`
- `closed`

`tailored` should be treated as an internal material-preparation milestone rather than a top-level opportunity stage.

## Core Entity: OpportunityDetail

```ts
type OpportunityDetail = OpportunitySummary & {
  job_description_url?: string
  company_summary?: string
  why_selected_summary?: string
  risk_flags: string[]
  next_step_summary?: string
  current_owner_type: "team" | "user" | "shared"
  collaboration_chain: OpportunityActorStep[]
  timeline: TimelineEvent[]
}
```

## Core Entity: OpportunityActorStep

```ts
type OpportunityActorStep = {
  order: number
  actor_type: "agent" | "user" | "system"
  actor_id?: string
  actor_name: string
  action_label: string
  handed_to_actor_id?: string
  handed_to_actor_name?: string
  completed_at?: string
}
```

## Core Entity: HandoffSummary

```ts
type HandoffSummary = {
  id: string
  opportunity_id: string
  company_name: string
  job_title: string
  handoff_type:
    | "private_contact"
    | "salary_confirmation"
    | "interview_time"
    | "work_arrangement"
    | "visa_eligibility"
    | "other_high_risk"
  urgency: "low" | "medium" | "high" | "critical"
  state:
    | "awaiting_takeover"
    | "in_user_handling"
    | "waiting_external"
    | "resolved"
    | "returned_to_team"
    | "closed"
  source_agent_id?: string
  source_agent_name?: string
  summary_text: string
  due_at?: string
  created_at: string
}
```

## Core Entity: HandoffDetail

```ts
type HandoffDetail = HandoffSummary & {
  explanation_text: string
  suggested_next_action?: string
  suggested_reply?: string
  risk_notes: string[]
  latest_context_events: TimelineEvent[]
}
```

## Core Entity: PlatformSummary

```ts
type PlatformSummary = {
  id: string
  code: string
  display_name: string
  region_group: "china" | "global_english"
  platform_type?: "job_board" | "recruiter_network" | "email_outreach" | "other"
  status:
    | "active"
    | "available_unconnected"
    | "pending_login"
    | "restricted"
    | "unavailable"
    | "plan_locked"
  requires_user_action: boolean
  last_checked_at?: string
}
```

## Core Entity: PlanSummary

```ts
type PlanSummary = {
  tier: "free" | "pro" | "plus"
  display_name: string
  runtime_balance_label?: string
  usage_percent?: number
  refresh_at?: string
  limits: PlanLimit[]
}
```

type PlanLimit = {
  key: string
  label: string
  used_percent?: number
  used_value_label?: string
  reset_at?: string
}
```

## Core Entity: TimelineEvent

All timeline-like surfaces should use the same event shape.

Rule:

`timeline events should include structured fields and a ready-to-render summary_text`

```ts
type TimelineEvent = {
  id: string
  event_type: string
  summary_text: string
  occurred_at: string
  actor_type: "agent" | "user" | "system" | "platform"
  actor_id?: string
  actor_name?: string
  actor_role_title?: string
  actor_portrait_url?: string
  related_entity_type?: "team" | "opportunity" | "handoff" | "platform"
  related_entity_id?: string
  handoff_to_actor_id?: string
  handoff_to_actor_name?: string
  metadata?: Record<string, string | number | boolean | null>
}
```

## UI Aggregation Payloads

The backend should provide page-friendly aggregation payloads to reduce frontend orchestration complexity.

These payloads do not replace domain endpoints.
They sit on top of them.

## HomePayload

```ts
type HomePayload = {
  user: UserSummary
  team: TeamSummary
  runtime: TeamRuntimeSummary
  agents: AgentSummary[]
  live_feed: TimelineEvent[]
  high_value_opportunities: OpportunitySummary[]
  handoff_summary: HandoffSummary[]
  plan_summary: PlanSummary
}
```

## OpportunitiesPayload

```ts
type OpportunitiesPayload = {
  team: TeamSummary
  runtime: TeamRuntimeSummary
  filters: OpportunityFilterMeta
  counts_by_stage: Record<string, number>
  opportunities: OpportunitySummary[]
  list_meta: ListMeta
}
```

type OpportunityFilterMeta = {
  stages: Array<{ value: string; label: string }>
  platforms: Array<{ id: string; label: string }>
  priorities: Array<{ value: string; label: string }>
}
```

## HandoffsPayload

```ts
type HandoffsPayload = {
  team: TeamSummary
  runtime: TeamRuntimeSummary
  counts_by_type: Record<string, number>
  counts_by_state: Record<string, number>
  handoffs: HandoffSummary[]
  list_meta: ListMeta
}
```

## PlatformsPayload

```ts
type PlatformsPayload = {
  team: TeamSummary
  runtime: TeamRuntimeSummary
  by_region: Record<"china" | "global_english", PlatformSummary[]>
  generated_at: string
}
```

## PlanPayload

```ts
type PlanPayload = {
  team: TeamSummary
  runtime: TeamRuntimeSummary
  current_plan: PlanSummary
  available_plans: PlanSummary[]
}
```

## SettingsPayload

```ts
type SettingsPayload = {
  user: UserSummary
  team: TeamSummary
  preferences: SettingsPreferences
}
```

type SettingsPreferences = {
  locale: "zh-CN" | "en"
  notifications_enabled: boolean
  preferred_locations: string[]
  work_mode: "remote" | "onsite" | "hybrid" | "other"
  salary_expectation?: string
  strategy_mode: StrategyMode
  coverage_scope: "china" | "global_english" | "cross_market_global"
  boundary_preferences?: Record<string, boolean>
}
```

## Source Of Truth Rule

Some values appear in both team-level summary objects and settings-level preference objects.

Examples:

- `strategy_mode`
- `coverage_scope`

The source of truth rule should be:

- `SettingsPreferences` is the editable preference source
- `TeamSummary` reflects the currently applied team operating state

Frontend implication:

- settings forms should bind to `SettingsPreferences`
- shell and runtime summaries may read `TeamSummary`
- after successful settings mutation, both views should be refreshed or synchronized

## ReviewPayload

```ts
type ReviewPayload = {
  team: TeamSummary
  runtime: TeamRuntimeSummary
  review_window_label: string
  summary_text: string
  key_outcomes: Array<{ label: string; value: string }>
  suggestions: string[]
}
```

## Shared List Meta

All list-like page payloads should support common metadata so the frontend can implement consistent loading, empty, and pagination behavior.

```ts
type ListMeta = {
  generated_at: string
  total_count?: number
  next_cursor?: string | null
  empty_reason?: string
  applied_filters?: Record<string, string | number | boolean | string[]>
}
```

## API Design Rules

The API should follow three rules:

1. stable entity naming
2. page-facing aggregation endpoints
3. mutation endpoints for user decisions and runtime control

## Recommended API Prefixing

- entity endpoints: `/api/...`
- UI aggregation endpoints: `/api/ui/...`
- live stream endpoints: `/api/stream/...`

## Core UI Aggregation Endpoints

### GET `/api/ui/home`

Returns the primary Team Home payload.

Response:

```json
{
  "data": {
    "user": {},
    "team": {},
    "runtime": {},
    "agents": [],
    "live_feed": [],
    "high_value_opportunities": [],
    "handoff_summary": [],
    "plan_summary": {}
  }
}
```

### GET `/api/ui/opportunities`

Query params:

- `stage?`
- `platform_id?`
- `priority?`
- `search?`
- `sort?`
- `cursor?`

Response:

```json
{
  "data": {
    "team": {},
    "runtime": {},
    "filters": {},
    "counts_by_stage": {},
    "opportunities": [],
    "list_meta": {
      "generated_at": "",
      "total_count": 0,
      "next_cursor": null,
      "applied_filters": {}
    }
  }
}
```

### GET `/api/ui/handoffs`

Query params:

- `state?`
- `handoff_type?`
- `urgency?`
- `cursor?`

Response:

```json
{
  "data": {
    "team": {},
    "runtime": {},
    "counts_by_type": {},
    "counts_by_state": {},
    "handoffs": [],
    "list_meta": {
      "generated_at": "",
      "total_count": 0,
      "next_cursor": null,
      "applied_filters": {}
    }
  }
}
```

### GET `/api/ui/platforms`

Response:

```json
{
  "data": {
    "team": {},
    "runtime": {},
    "by_region": {
      "china": [],
      "global_english": []
    },
    "generated_at": ""
  }
}
```

### GET `/api/ui/plan`

Response:

```json
{
  "data": {
    "team": {},
    "runtime": {},
    "current_plan": {},
    "available_plans": []
  }
}
```

### GET `/api/ui/settings`

Response:

```json
{
  "data": {
    "user": {},
    "team": {},
    "preferences": {}
  }
}
```

### GET `/api/ui/review`

Query params:

- `window?=7d|14d|30d`

Response:

```json
{
  "data": {
    "team": {},
    "runtime": {},
    "review_window_label": "Past 7 days",
    "summary_text": "",
    "key_outcomes": [],
    "suggestions": []
  }
}
```

## Onboarding And Activation Endpoints

### GET `/api/ui/onboarding`

Response:

```json
{
  "data": {
    "draft": {},
    "strategy_options": [],
    "work_mode_options": [],
    "coverage_scope_options": []
  }
}
```

Where `draft` conforms to `OnboardingDraft`.

### POST `/api/onboarding/resume`

Request:

Multipart upload or signed-upload reference depending on implementation.

Response:

```json
{
  "data": {
    "draft": {
      "status": "questions_in_progress",
      "resume_upload_status": "processed"
    }
  }
}
```

Possible business errors:

- `BAD_REQUEST`
- `RESUME_MISSING`
- `REQUIRED_PROFILE_INFO_MISSING`
- `INVALID_PREFERENCE_VALUE`

Note:

For file-specific failures, the backend should still return the standard error envelope with a useful `message` and structured `details` where applicable.

### PATCH `/api/onboarding/draft`

Request:

```json
{
  "draft_id": "draft_123",
  "answers": {
    "preferred_locations": ["Shanghai", "Singapore"],
    "work_mode": "remote",
    "strategy_mode": "balanced"
  }
}
```

Response:

```json
{
  "data": {
    "draft": {}
  }
}
```

### POST `/api/onboarding/complete`

Request:

```json
{
  "draft_id": "draft_123"
}
```

Response:

```json
{
  "data": {
    "draft": {
      "status": "ready_for_activation"
    }
  }
}
```

### GET `/api/ui/activation`

Response:

```json
{
  "data": {
    "activation_summary": {}
  }
}
```

Where `activation_summary` conforms to `ActivationSummary`.

### POST `/api/activation/confirm`

Request:

```json
{
  "team_id": "team_123",
  "onboarding_draft_id": "draft_123"
}
```

Response:

```json
{
  "data": {
    "team": {},
    "runtime": {
      "runtime_status": "paused"
    }
  }
}
```

Note:

Activation confirmation creates a ready team state.
Actual operation still begins through explicit `Start Team`.

## Core Entity Endpoints

### GET `/api/opportunities/:opportunityId`

Response:

```json
{
  "data": {
    "opportunity": {}
  }
}
```

Where `opportunity` conforms to `OpportunityDetail`.

### GET `/api/handoffs/:handoffId`

Response:

```json
{
  "data": {
    "handoff": {}
  }
}
```

Where `handoff` conforms to `HandoffDetail`.

### GET `/api/agents/:agentId`

Response:

```json
{
  "data": {
    "agent": {
      "id": "",
      "code": "",
      "name": "",
      "role_title_zh": "",
      "portrait_url": "",
      "status": "working",
      "primary_responsibility": "",
      "current_task_summary": "",
      "recent_actions": []
    }
  }
}
```

## Core Mutation Endpoints

## Mutation Operation Tracking Rule

Important mutations should support idempotent behavior and trackable operation state.

Recommended behavior:

- repeated requests for the same intended state should not create duplicate effects
- the response may include an `operation_id` when backend work is asynchronous
- the frontend should be able to correlate optimistic state with eventual completion

Recommended response extension:

```json
{
  "data": {
    "...": {}
  },
  "meta": {
    "operation_id": "op_123",
    "accepted": true
  }
}
```

### POST `/api/team/start`

Request:

```json
{
  "team_id": "team_123"
}
```

Response:

```json
{
  "data": {
    "team": {},
    "runtime": {
      "runtime_status": "starting"
    }
  },
  "meta": {
    "operation_id": "op_start_123",
    "accepted": true
  }
}
```

### POST `/api/team/pause`

Request:

```json
{
  "team_id": "team_123"
}
```

Response:

```json
{
  "data": {
    "team": {},
    "runtime": {
      "runtime_status": "pausing"
    }
  },
  "meta": {
    "operation_id": "op_pause_123",
    "accepted": true
  }
}
```

### PATCH `/api/settings/preferences`

Request:

```json
{
  "preferred_locations": ["Shanghai", "Singapore"],
  "strategy_mode": "balanced",
  "coverage_scope": "cross_market_global"
}
```

Response:

```json
{
  "data": {
    "preferences": {}
  }
}
```

### POST `/api/handoffs/:handoffId/takeover`

Request:

```json
{
  "action": "start_takeover"
}
```

Response:

```json
{
  "data": {
    "handoff": {},
    "runtime": {}
  }
}
```

### POST `/api/handoffs/:handoffId/resolve`

Request:

```json
{
  "resolution_type": "resolved"
}
```

Response:

```json
{
  "data": {
    "handoff": {},
    "runtime": {}
  }
}
```

### POST `/api/opportunities/:opportunityId/mark-focus`

Request:

```json
{
  "focused": true
}
```

Response:

```json
{
  "data": {
    "opportunity": {}
  }
}
```

## Live Transport Endpoints

The transport choice may be SSE or WebSocket, but the interface contract should assume event streaming semantics.

### GET `/api/stream/home`

Recommended for:

- live feed tail
- team runtime state transitions
- pending handoff count updates

### GET `/api/stream/opportunities/:opportunityId`

Recommended for:

- opportunity timeline tail
- state progression updates
- takeover boundary changes

## Stream Event Envelope

All stream messages should use a consistent event envelope.

```ts
type StreamEnvelope = {
  event_name: string
  entity_type?: "team" | "opportunity" | "handoff" | "platform"
  entity_id?: string
  sequence: number
  sent_at: string
  delivery_mode: "append" | "replace" | "invalidate"
  payload: Record<string, unknown>
}
```

### Stream Rules

- `sequence` should be monotonic per stream channel
- frontend should ignore duplicate or older sequence numbers
- `append` is used for new feed or timeline events
- `replace` is used for state snapshots such as runtime status or count totals
- `invalidate` instructs frontend to refetch a related warm or cold resource

### Reconnect Rules

If the stream disconnects:

- frontend should attempt reconnect with backoff
- frontend should keep existing visible data
- after reconnect, frontend should either resume from the last known sequence or refetch affected resource summaries
- stream failure should not blank the page

## Standard API Response Envelope

All frontend-consumed APIs should use a consistent response envelope.

### Success Shape

```json
{
  "data": {},
  "meta": {},
  "error": null
}
```

### Failure Shape

```json
{
  "data": null,
  "meta": {},
  "error": {
    "code": "PLATFORM_AUTH_REQUIRED",
    "message": "One or more required platforms need re-authentication.",
    "details": {}
  }
}
```

## Error Handling Strategy

The system should use:

`uniform error envelope + enumerated core business error codes`

This follows a mature product pattern:

- generic technical failures remain generic
- predictable business failures are explicit
- frontend can map error code to user-facing guidance

## Technical Error Codes

These should exist globally:

- `UNAUTHORIZED`
- `FORBIDDEN`
- `NOT_FOUND`
- `RATE_LIMITED`
- `NETWORK_UNAVAILABLE`
- `TIMEOUT`
- `INTERNAL_ERROR`
- `BAD_REQUEST`

## Core Business Error Codes

The following business error groups should be enumerated in v1 contracts.

### Team Runtime

- `TEAM_ALREADY_ACTIVE`
- `TEAM_ALREADY_PAUSED`
- `TEAM_NOT_READY`
- `TEAM_RUNTIME_BLOCKED`
- `FORBIDDEN_ACTION_WHILE_PAUSED`

### Onboarding / Activation

- `RESUME_MISSING`
- `ONBOARDING_INCOMPLETE`
- `INVALID_COVERAGE_SCOPE`
- `INVALID_STRATEGY_MODE`
- `REQUIRED_PROFILE_INFO_MISSING`

### Platform

- `PLATFORM_AUTH_REQUIRED`
- `PLATFORM_RESTRICTED`
- `PLATFORM_UNAVAILABLE`
- `PLATFORM_PLAN_LOCKED`
- `PLATFORM_RECONNECT_REQUIRED`

### Opportunity

- `OPPORTUNITY_NOT_FOUND`
- `OPPORTUNITY_CLOSED`
- `OPPORTUNITY_ALREADY_FOCUSED`
- `OPPORTUNITY_NOT_TAKEOVER_ELIGIBLE`

### Handoff

- `HANDOFF_NOT_FOUND`
- `HANDOFF_ALREADY_RESOLVED`
- `HANDOFF_ALREADY_IN_USER_HANDLING`
- `HANDOFF_NOT_ACTIONABLE`

### Plan / Runtime

- `PLAN_LIMIT_REACHED`
- `RUNTIME_EXHAUSTED`
- `UPGRADE_REQUIRED`
- `BILLING_ACTION_REQUIRED`

### Settings

- `SETTINGS_CONFLICT`
- `INVALID_PREFERENCE_VALUE`
- `BOUNDARY_CONFIGURATION_INVALID`

## Frontend Error Handling Rule

The frontend should map error codes into one of these treatments:

1. silent no-op with state refresh
2. lightweight toast
3. inline component error
4. blocking modal
5. navigation to resolving surface

Examples:

- `TEAM_ALREADY_ACTIVE` -> lightweight toast
- `PLATFORM_AUTH_REQUIRED` -> inline callout plus link to `Platform Coverage`
- `PLAN_LIMIT_REACHED` -> upgrade callout plus link to `Plan & Billing`
- `HANDOFF_ALREADY_RESOLVED` -> lightweight toast plus data refresh

## Error Recovery Mapping

The frontend should maintain a predictable mapping from key business errors to recovery actions.

### Team Runtime

- `TEAM_ALREADY_ACTIVE` -> lightweight toast, refresh runtime summary
- `TEAM_ALREADY_PAUSED` -> lightweight toast, refresh runtime summary
- `TEAM_NOT_READY` -> navigate to `/onboarding` or `/activate` based on user state
- `TEAM_RUNTIME_BLOCKED` -> blocking modal or inline callout with reason
- `FORBIDDEN_ACTION_WHILE_PAUSED` -> lightweight toast, keep page readable

### Onboarding / Activation

- `RESUME_MISSING` -> navigate to `/onboarding`, focus resume step
- `ONBOARDING_INCOMPLETE` -> navigate to `/onboarding`
- `INVALID_COVERAGE_SCOPE` -> inline onboarding field error
- `INVALID_STRATEGY_MODE` -> inline onboarding/settings field error
- `REQUIRED_PROFILE_INFO_MISSING` -> inline callout plus onboarding resume

### Platform

- `PLATFORM_AUTH_REQUIRED` -> link to `/app/platforms`
- `PLATFORM_RESTRICTED` -> inline platform warning
- `PLATFORM_UNAVAILABLE` -> inline platform warning
- `PLATFORM_PLAN_LOCKED` -> link to `/app/plan`
- `PLATFORM_RECONNECT_REQUIRED` -> link to `/app/platforms`

### Opportunity

- `OPPORTUNITY_NOT_FOUND` -> close panel or show not-found state
- `OPPORTUNITY_CLOSED` -> show read-only closed state
- `OPPORTUNITY_ALREADY_FOCUSED` -> lightweight toast
- `OPPORTUNITY_NOT_TAKEOVER_ELIGIBLE` -> lightweight toast

### Handoff

- `HANDOFF_NOT_FOUND` -> close panel or show not-found state
- `HANDOFF_ALREADY_RESOLVED` -> refresh list and show lightweight toast
- `HANDOFF_ALREADY_IN_USER_HANDLING` -> refresh detail and show current state
- `HANDOFF_NOT_ACTIONABLE` -> inline disabled-state explanation

### Plan / Runtime

- `PLAN_LIMIT_REACHED` -> link to `/app/plan`
- `RUNTIME_EXHAUSTED` -> link to `/app/plan`
- `UPGRADE_REQUIRED` -> open upgrade CTA
- `BILLING_ACTION_REQUIRED` -> link to `/app/plan`

## Page Data Requirements

This section summarizes the minimum data requirements per page.

## Landing Page Data

Mostly static or CMS-like content.

Needs:

- hero copy
- section copy
- platform logo metadata
- plan card metadata
- FAQ items

## Login Entry Data

Needs:

- enabled login providers
- redirect targets
- session summary

## Onboarding Data

Needs:

- onboarding draft state
- resume upload state
- strategy options
- work mode options
- coverage scope options
- dynamic follow-up question definitions

## Team Activation Data

Needs:

- finalized onboarding summary
- initial team roster
- first operating emphasis
- automation and boundary summary

## Execution Readiness Data

Needs:

- `SubmissionProfile`
- `ExecutionReadinessStatus`
- recommended platform connection tasks
- blocking and non-blocking readiness items

## Team Home Data

Needs:

- `HomePayload`
- live stream subscription

## Opportunity Workspace Data

Needs:

- `OpportunitiesPayload`
- opportunity detail fetch on selection
- incremental updates for visible items

## Handoff Center Data

Needs:

- `HandoffsPayload`
- handoff detail fetch on selection
- live count updates

## Platform Coverage Data

Needs:

- `PlatformsPayload`
- mutation feedback for reconnect or activation-related actions
- readiness-impact hints for each platform

## Plan & Billing Data

Needs:

- `PlanPayload`
- limit refresh labels
- upgrade action availability

## Settings & Preferences Data

Needs:

- `SettingsPayload`
- optimistic or confirm-on-save mutation path

## Review & Summary Data

Needs:

- `ReviewPayload`

## Key Event Flows

This section defines core user and system event sequences.

## Flow: Start Team

1. user clicks `Start Team`
2. frontend verifies current `ExecutionReadinessStatus`
3. if readiness is insufficient, redirect or focus user on `/app/readiness`
4. if readiness is sufficient, frontend sends `POST /api/team/start`
5. frontend moves shell runtime state to optimistic `starting`
6. backend returns accepted runtime transition
7. live state updates runtime to `active`
8. Team Home begins receiving or refreshing live feed

Frontend requirements:

- disable duplicate clicks while pending
- preserve previous page data
- show clear status transition
- never use `Start Team` as a substitute for readiness validation

## Flow: Pause Team

1. user clicks `Pause Team`
2. frontend sends `POST /api/team/pause`
3. shell state moves to optimistic `pausing`
4. backend confirms transition
5. runtime becomes `paused`
6. live surfaces stop implying new automation work
7. historical data remains visible

## Flow: Opportunity Selection

1. user opens `Opportunity Workspace`
2. page loads list or pipeline data
3. user selects one opportunity card
4. frontend opens detail panel
5. frontend fetches `GET /api/opportunities/:opportunityId`
6. panel renders detail and timeline
7. live tail may subscribe for fresh events

## Flow: Handoff Resolution

1. user opens `Handoff Center`
2. page loads handoff list
3. user selects a handoff item
4. frontend loads handoff detail
5. user begins takeover or resolves the item
6. frontend posts handoff mutation
7. handoff state updates
8. affected summary counts refresh in shell and Team Home

## Flow: Settings Update

1. user changes a durable preference
2. frontend validates local input
3. frontend sends partial settings patch
4. backend returns updated preference object
5. affected pages revalidate if needed

## Flow: Platform Reconnect

1. user views `Platform Coverage`
2. platform shows `pending_login` or `reconnect_required`
3. user initiates reconnect flow
4. reconnect succeeds or fails
5. platform state updates
6. dependent opportunity flows can resume

## Flow: Platform Auth Expires During Operation

1. backend detects platform auth expiry
2. platform state changes to `pending_login` or `reconnect_required`
3. stream emits platform invalidation or warning event
4. shell may show lightweight warning state if meaningful
5. `Platform Coverage` becomes the primary resolution surface
6. affected opportunities may show limited progression state

## Flow: Opportunity Automatically Enters Takeover

1. backend determines an opportunity crossed a takeover boundary
2. opportunity stage changes to `needs_takeover`
3. new handoff item is created
4. live stream updates:
- handoff count
- opportunity state
- live feed event
5. Team Home shows updated takeover summary
6. Handoff Center displays the new actionable item

## Flow: Runtime Limit Approaching

1. backend detects plan or runtime threshold approaching
2. plan summary or runtime warning state updates
3. shell receives lightweight warning state
4. `Plan & Billing` shows full explanatory detail
5. user may continue browsing without forced interruption unless execution is blocked

## Analytics Event Strategy

The app should not define a full event catalog here, but it should define a complete set of core product events and a near-future reserve set.

## Event Naming Rule

Prefer stable product-event naming such as:

- `<surface>_viewed`
- `<object>_opened`
- `<action>_clicked`
- `<workflow>_completed`
- `<state>_changed`

## Core Product Analytics Events

### Entry & Conversion

- `landing_viewed`
- `landing_primary_cta_clicked`
- `landing_secondary_cta_clicked`
- `login_clicked`
- `login_succeeded`

### Onboarding & Activation

- `resume_upload_started`
- `resume_upload_completed`
- `onboarding_question_answered`
- `onboarding_completed`
- `team_activation_viewed`
- `team_activation_confirmed`
- `team_start_clicked`
- `team_started`
- `team_pause_clicked`
- `team_paused`

### Team Home

- `team_home_viewed`
- `live_feed_item_opened`
- `high_value_opportunity_opened`
- `takeover_summary_opened`

### Opportunities

- `opportunities_viewed`
- `opportunity_filter_changed`
- `opportunity_view_mode_changed`
- `opportunity_detail_opened`
- `opportunity_focus_marked`
- `opportunity_takeover_triggered`

### Handoffs

- `handoff_center_viewed`
- `handoff_item_opened`
- `handoff_takeover_started`
- `handoff_resolved`
- `handoff_returned_to_team`
- `suggested_reply_viewed`

### Platforms / Plan / Settings

- `platform_coverage_viewed`
- `platform_reconnect_started`
- `platform_reconnect_completed`
- `plan_viewed`
- `upgrade_clicked`
- `settings_viewed`
- `settings_updated`
- `strategy_mode_changed`
- `coverage_scope_changed`

## Near-Future Reserved Analytics Events

Even if not implemented in v1, reserve semantic space for:

- `specialist_agent_enabled`
- `specialist_agent_opened`
- `review_viewed`
- `review_suggestion_accepted`
- `review_suggestion_dismissed`
- `platform_activated`
- `platform_deactivated`
- `runtime_limit_warning_seen`
- `billing_action_required_seen`

## Key Component Contracts

Only page-level and major reusable components are defined here.

Base atomic controls such as buttons, text inputs, chips, and dividers are intentionally out of scope.

Each key component should define:

1. responsibility
2. input data contract
3. output events
4. loading / empty / error / disabled states
5. page placement
6. live or async dependencies
7. executable actions
8. availability constraints
9. display hierarchy
10. future-safe expansion fields

## Component: AppShell

### Responsibility

Provide the persistent logged-in frame.

### Input Contract

- `user: UserSummary`
- `team: TeamSummary`
- `runtime: TeamRuntimeSummary`
- `plan_summary: PlanSummary`
- `active_route_key: string`

### Output Events

- `onNavigate(routeKey)`
- `onStartTeam()`
- `onPauseTeam()`
- `onLanguageChange(locale)`
- `onOpenAccountMenu()`

### States

- loading
- active
- paused
- warning
- error

### Placement

- all logged-in routes

### Async Dependencies

- team runtime updates
- pending handoff count updates
- lightweight plan summary refresh

### Executable Actions

- start team
- pause team
- navigate

### Availability Constraints

- runtime controls may be disabled while mutation is pending

### Display Hierarchy

- runtime control and state are top-priority
- lightweight plan indicator is secondary

### Future-Safe Fields

- specialist agent indicator
- org-level team switching if ever added

### Data Ownership

This should be a container-aware component.

It may receive state from global app stores or route loaders, but presentational subparts inside the shell should remain dumb where possible.

## Component: TeamBadgeCard

### Responsibility

Represent one agent as a visible team member.

### Input Contract

- `agent: AgentSummary`
- optional `expanded: boolean`

### Output Events

- `onOpenAgentDetail(agentId)`
- `onFlip(agentId)`

### States

- loading
- working
- idle
- blocked
- paused

### Placement

- Team Home
- Team Activation
- agent roster fragments on other pages

### Async Dependencies

- agent status changes
- current task summary changes

### Executable Actions

- open detail
- flip front/back

### Availability Constraints

- none; detail remains viewable when team paused

### Display Hierarchy

- role title
- persona name
- current status
- task summary

### Future-Safe Fields

- specialist badge
- availability percent

### Data Ownership

This should be primarily presentational.
It should not fetch its own detail payload directly.

## Component: LiveFeedList

### Responsibility

Render the Team Home structured action timeline.

### Input Contract

- `items: TimelineEvent[]`

### Output Events

- `onOpenFeedItem(eventId)`
- `onOpenRelatedOpportunity(opportunityId)`

### States

- loading
- empty
- populated
- stream-disconnected
- error

### Placement

- Team Home

### Async Dependencies

- hot stream updates

### Executable Actions

- inspect related entity

### Availability Constraints

- feed remains readable while paused, but no new automated events should imply active automation

### Display Hierarchy

- actor identity
- summary_text
- time
- related action hint

### Future-Safe Fields

- filter by agent
- collapse grouped events

### Data Ownership

This should be presentational with stream-fed props supplied by a container or hook.

## Component: OpportunityCard

### Responsibility

Represent an opportunity in summary form.

### Input Contract

- `opportunity: OpportunitySummary`

### Output Events

- `onOpenDetail(opportunityId)`
- `onMarkFocus(opportunityId)`
- `onOpenHandoff(opportunityId)`

### States

- loading
- normal
- selected
- disabled
- stale

### Placement

- Team Home summaries
- Opportunity Workspace

### Async Dependencies

- warm refresh for latest summary updates

### Executable Actions

- open detail
- mark focus
- go to related handoff

### Availability Constraints

- some actions disabled if opportunity closed

### Display Hierarchy

- company + role
- stage
- latest event summary
- takeover state

### Future-Safe Fields

- platform badge
- region badge

### Data Ownership

This should be presentational.
Querying or mutation logic should live in page containers or hooks.

## Component: OpportunityDetailPanel

### Responsibility

Show the deeper operating context for one opportunity.

### Input Contract

- `opportunity: OpportunityDetail`

### Output Events

- `onClose()`
- `onTriggerTakeover(opportunityId)`
- `onOpenPlatform(platformId)`

### States

- loading
- ready
- error
- not-found

### Placement

- Opportunity Workspace

### Async Dependencies

- opportunity detail fetch
- hot timeline tail

### Executable Actions

- inspect collaboration chain
- trigger handoff
- jump to related platform

### Availability Constraints

- mutation actions may depend on opportunity stage

### Display Hierarchy

- stage and status
- why selected
- recent timeline
- current risk
- next step

### Future-Safe Fields

- recruiter thread summary
- interview prep handoff

### Data Ownership

This may be container-backed because it coordinates fetch, live tail, and actions.
Subsections inside it should remain presentational where practical.

## Component: HandoffCard

### Responsibility

Represent a takeover-required item in summary form.

### Input Contract

- `handoff: HandoffSummary`

### Output Events

- `onOpenDetail(handoffId)`
- `onStartTakeover(handoffId)`

### States

- loading
- awaiting_takeover
- in_user_handling
- waiting_external
- resolved

### Placement

- Team Home summary module
- Handoff Center list

### Async Dependencies

- warm refresh
- count synchronization

### Executable Actions

- open
- start takeover

### Availability Constraints

- resolved items may be read-only

### Display Hierarchy

- handoff type
- company + role
- urgency
- source agent
- summary

### Future-Safe Fields

- SLA-style due badges
- grouped handoff mode

### Data Ownership

This should be presentational.

## Component: HandoffDetailPanel

### Responsibility

Show the context needed for the user to take over confidently.

### Input Contract

- `handoff: HandoffDetail`

### Output Events

- `onResolve(handoffId)`
- `onReturnToTeam(handoffId)`
- `onCopySuggestedReply(handoffId)`

### States

- loading
- ready
- error

### Placement

- Handoff Center

### Async Dependencies

- handoff detail fetch
- latest context events refresh

### Executable Actions

- resolve
- copy suggested reply
- return to team when valid

### Availability Constraints

- available actions depend on current handoff state

### Display Hierarchy

- why takeover is needed
- recommended next action
- context summary
- recent events

### Future-Safe Fields

- rich reply drafting
- calendar suggestion modules

### Data Ownership

This may be container-backed because it coordinates detail fetch and action mutations.

## Component: PlatformCard

### Responsibility

Represent a platform's availability and coverage state.

### Input Contract

- `platform: PlatformSummary`

### Output Events

- `onReconnect(platformId)`
- `onOpenPlatformDetail(platformId)`

### States

- active
- available_unconnected
- pending_login
- restricted
- unavailable
- plan_locked

### Placement

- Platform Coverage

### Async Dependencies

- warm status refresh

### Executable Actions

- reconnect
- inspect state

### Availability Constraints

- reconnect action only when applicable

### Display Hierarchy

- platform name
- status
- region group
- action need

### Future-Safe Fields

- per-platform performance summary

### Data Ownership

This should be presentational with reconnect and status logic owned by parent containers.

## Component: PlanUsagePanel

### Responsibility

Show the current plan and runtime-limit state clearly.

### Input Contract

- `plan: PlanSummary`

### Output Events

- `onUpgradeClick()`
- `onOpenBillingDetail()`

### States

- loading
- normal
- nearing_limit
- exhausted

### Placement

- AppShell lightweight variant
- Plan & Billing full variant

### Async Dependencies

- warm usage refresh

### Executable Actions

- open plan detail
- upgrade

### Availability Constraints

- upgrade CTA may vary by current tier

### Display Hierarchy

- current tier
- most important usage bar
- next refresh timing

### Future-Safe Fields

- forecast depletion
- auto-top-up controls

### Data Ownership

This should remain mostly presentational.
Upgrade and billing mutations should live in container logic.

## Component: SettingsSection

### Responsibility

Edit one coherent cluster of durable preferences.

### Input Contract

- `title: string`
- `fields: SettingsField[]`
- `disabled?: boolean`

### Output Events

- `onChange(fieldKey, value)`
- `onSave()`
- `onReset()`

### States

- loading
- dirty
- saving
- saved
- error

### Placement

- Settings & Preferences

### Async Dependencies

- settings fetch
- mutation lifecycle

### Executable Actions

- edit
- save
- reset

### Availability Constraints

- some fields may be read-only in runtime transition moments

### Display Hierarchy

- section title
- primary business-setting fields
- explanatory copy

### Future-Safe Fields

- advanced settings expansion

### Data Ownership

This may coordinate local dirty state, but persistence should be delegated to a page-level container or hook.

## React Implementation Guidance

This spec does not require a specific library choice, but the frontend should be implemented in a way that preserves:

- domain-model consistency
- route-level data loading boundaries
- isolated live-update handling
- reusable key components

Recommended implementation direction:

- central app-shell state
- route-level data loaders or query hooks
- event-stream adapter layer for hot state
- page-level view models

The frontend should avoid:

- embedding API shaping logic inside presentational components
- duplicating domain mapping per page
- forcing every page to manage its own runtime truth independently

## Final Interface Principle

The frontend contract should make Haitou OS feel stable, alive, and understandable.

The user should experience:

- one coherent team-based application
- clear page responsibilities
- predictable runtime behavior
- readable operating records
- explicit takeover boundaries
- calm but trustworthy status updates

If the backend data contract is clean, the frontend should be able to evolve visually without needing to redesign the product's logic model.
