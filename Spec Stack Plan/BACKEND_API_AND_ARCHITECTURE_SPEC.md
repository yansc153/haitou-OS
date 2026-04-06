# Backend API And Architecture Spec

## Document Purpose

This document defines the backend architecture, module boundaries, API contracts, orchestration design, transformation layer, and runtime infrastructure for Haitou OS.

It answers:

- how the backend is structured into modules
- what each module is responsible for
- how the orchestration engine drives the 7-agent team
- what every API endpoint accepts and returns
- how domain entities transform into frontend-facing payloads
- how realtime streams, webhooks, and async operations work
- how errors are classified and handled

## Relationship To Earlier Specs

This document builds on:

- `DATA_MODEL_SPEC.md` — authoritative entity shapes, enums, state machines
- `FRONTEND_INTERFACE_SPEC.md` — frontend types, page payloads, API endpoint signatures
- `AGENT_TEMPLATE_SPEC.md` — role responsibilities and authority boundaries
- `AGENT_INSTANCE_AND_STATE_SPEC.md` — instance lifecycle, runtime state, task context
- `AGENT_SKILL_AND_PROMPT_SPEC.md` — skill definitions and prompt contracts
- `PRODUCT_FLOWS.md` — lifecycle, loops, handoff model

Where a data shape conflict exists, `DATA_MODEL_SPEC.md` wins.
Where an API endpoint signature conflict exists with `FRONTEND_INTERFACE_SPEC.md`, this document wins and the frontend spec must align.

## Technology Stack

| Layer | Technology |
|---|---|
| Database | PostgreSQL via Supabase |
| Auth | Supabase Auth (OAuth providers) |
| Backend Runtime | Edge Functions (API handlers + skill execution) |
| Orchestration Worker | Fly.io (dedicated long-running Node.js/Deno process) |
| API Transport | REST (JSON) |
| Realtime | Supabase Realtime (Postgres Changes) + SSE fallback |
| File Storage | Supabase Storage (encrypted buckets) |
| Secrets | Supabase Vault + environment variables |
| Queue / Scheduling | pg_cron (sweeps) + Supabase Background Tasks + pgmq (task queue) |
| Orchestration Worker | Dedicated long-running process on Fly.io (Node.js/Deno) |

---

## Architecture Overview

### Three-Layer Model

```
┌─────────────────────────────────────────────┐
│              Frontend (React)                │
│   Consumes /api/ui/* aggregation endpoints   │
│   Subscribes to /api/stream/* SSE channels   │
└───────────────┬─────────────────────────────┘
                │ HTTPS / SSE
┌───────────────▼─────────────────────────────┐
│          API Gateway Layer                   │
│   Edge Functions: auth, routing, rate limit  │
│   /api/ui/*  /api/*  /api/stream/*           │
└───────────────┬─────────────────────────────┘
                │
┌───────────────▼─────────────────────────────┐
│          Backend Service Layer               │
│                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
│  │ Domain   │ │ Orchestr.│ │ Platform     │ │
│  │ Services │ │ Engine   │ │ Executors    │ │
│  └──────────┘ └──────────┘ └──────────────┘ │
│                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
│  │ Skill    │ │ Material │ │ Billing      │ │
│  │ Runtime  │ │ Pipeline │ │ Service      │ │
│  └──────────┘ └──────────┘ └──────────────┘ │
└───────────────┬─────────────────────────────┘
                │
┌───────────────▼─────────────────────────────┐
│          Data Layer                          │
│   PostgreSQL + Supabase Storage + Vault      │
└─────────────────────────────────────────────┘
```

### Module Boundaries

Each backend module has a clear responsibility and owns specific database tables.

---

## Module 1: Domain Services

### Responsibility

CRUD operations, state transitions, and business rule enforcement for all core entities.

### Owned Tables

- `user`, `team`, `onboarding_draft`, `resume_asset`, `profile_baseline`, `submission_profile`, `user_preferences`
- `opportunity`, `handoff`, `material`, `conversation_thread`, `conversation_message`
- `agent_instance`, `agent_state_transition`
- `timeline_event`

### Key Operations

- Create/read/update entities with state machine enforcement
- Validate state transitions against `DATA_MODEL_SPEC.md` state machines
- Emit `TimelineEvent` on meaningful state changes
- Enforce business invariants (e.g., cannot start team without minimum readiness)

### State Transition Enforcement Rule

Every state change must:

1. validate the transition is legal per the relevant state machine
2. update the entity
3. write an audit record (`AgentStateTransition` or `TimelineEvent`)
4. return the updated entity

Illegal transitions must be rejected with a business error code.

---

## Module 2: Orchestration Engine

### Responsibility

The continuously running coordination layer that drives the 7-agent team. Implements `调度官` logic at the system level.

### Worker Topology

The orchestration engine is NOT an Edge Function. It is a **dedicated long-running worker process** deployed on **Fly.io** (primary) with Railway as fallback.

```
┌──────────────────────────────────────────┐
│         Orchestration Worker             │
│  (Node.js/Deno, long-running process)    │
│                                          │
│  - Connects to Supabase DB directly      │
│  - Uses service_role key (bypasses RLS)  │
│  - Polls pgmq task queue                 │
│  - Executes scheduled sweeps via pg_cron │
│  - Invokes Edge Functions for skills     │
│  - Invokes platform executors            │
└──────────────────────────────────────────┘
```

The worker:
- Reads from a `pgmq` task queue for event-driven dispatch
- Runs scheduled sweeps on `pg_cron` triggers (which enqueue work into pgmq)
- Calls Supabase Edge Functions for LLM skill execution
- Calls platform executors (which may be Edge Functions or external services)
- Writes results back to the database

Edge Functions handle: API request serving, skill execution (stateless LLM calls), and short platform actions. They do NOT run the orchestration loop.

### Design

The orchestration engine is **event-driven with scheduled sweeps**.

```
Event Sources:
  - Team started / paused / resumed
  - New opportunity discovered
  - Opportunity stage changed
  - Reply received on conversation thread
  - Platform connection state changed
  - Agent task completed / failed
  - Timer / scheduled sweep

     ↓

Orchestration Engine:
  1. Evaluate current team state
  2. Determine which loop needs work (Loop A: generation, Loop B: progression)
  3. Select highest-priority pending work
  4. Dispatch AgentTask to appropriate agent role
  5. Monitor task completion
  6. Route to next step or handoff

     ↓

Output:
  - New AgentTask records
  - Opportunity stage transitions
  - Handoff creation
  - Timeline events
```

### Owned Tables

- `agent_task`, `agent_task_dependency`

### Loop A: Opportunity Generation

Continuously runs when team is active.

Loop A has two pipeline paths determined by the opportunity's source platform `pipeline_mode`:

**Full Tailored Path** (`global_english` platforms: Greenhouse, Lever, LinkedIn):

1. `opportunity_research` discovers new candidates
2. `matching_review` evaluates fit and recommends
3. For `advance` recommendations: `materials_advisor` prepares tailored materials (resume, cover letter)
4. `application_executor` submits with tailored materials
5. `relationship_manager` initiates first contact where applicable

**Passthrough Path** (`china` platforms: 智联, 拉勾, Boss直聘):

1. `opportunity_research` discovers new candidates
2. `matching_review` evaluates fit and recommends
3. For `advance` recommendations: **skip material generation** — use user's original `ResumeAsset` directly
4. `application_executor` submits with original resume
5. `relationship_manager` initiates first contact where applicable (platform-dependent)

The orchestrator resolves the path at step 3 by checking `PlatformDefinition.pipeline_mode` for the opportunity's source platform. The `materials_advisor` agent is simply not dispatched for passthrough opportunities.

**Rationale:** Chinese platforms either don't support per-application file upload (智联's one-click apply uses the platform-stored resume) or make per-application upload impractical for automation (拉勾's attachment upload adds latency and anti-bot exposure). Skipping material generation also reduces LLM cost per Chinese-platform opportunity to near-zero (only screening skills are invoked).

### Loop B: Opportunity Progression

Runs when active conversations or pending follow-ups exist.

Cycle:

1. Monitor conversation threads for new replies
2. `relationship_manager` reads and responds
3. Detect progression signals
4. Detect handoff boundaries
5. Create handoff when boundary reached

### Scheduling Strategy

| Trigger | Mechanism |
|---|---|
| Team start/pause | Immediate event |
| New opportunity arrival | Database trigger or webhook |
| Reply detection | Platform polling (configurable interval per platform) |
| Sweep for stale tasks | `pg_cron` every 5 minutes |
| Sweep for follow-up timing | `pg_cron` every 15 minutes |
| Runtime billing tick | `pg_cron` every 1 minute (session window tracking) |

### Loop Cadence & Batch Size

These parameters control orchestration cost and database load. They are configurable per-team via `Team.orchestration_config` (JSONB, optional, uses defaults when absent).

| Parameter | Default | Range | Notes |
|---|---|---|---|
| **Loop A (Opportunity Generation)** | | | |
| Discovery sweep interval | 60 min | 30-180 min | How often the orchestrator checks for new opportunities across connected platforms |
| Discovery batch size | 20 opportunities/sweep | 10-50 | Max new opportunities ingested per platform per sweep |
| Screening batch size | 10 opportunities/dispatch | 5-25 | Max opportunities evaluated per screening dispatch cycle |
| **Loop B (Opportunity Progression)** | | | |
| Reply poll interval | Per platform rule pack | — | LinkedIn: 5 min, Boss: 2 min, others: 15 min |
| Follow-up check interval | 15 min (via pg_cron) | — | Checks for opportunities past their follow-up window |
| Progression batch size | 5 threads/dispatch | 3-10 | Max conversation threads processed per dispatch cycle |
| **Global** | | | |
| Max concurrent tasks per team | 3 | 1-5 | Prevents runaway execution; each task is an advisory-locked unit |
| Dispatch cooldown | 10 seconds | 5-30s | Minimum gap between dispatch cycles for the same team |

**Design rationale:** Loop A is primarily sweep-driven (pg_cron enqueues discovery tasks). Loop B is event-driven (reply detection triggers processing) with a sweep fallback (pg_cron catches missed follow-ups). This hybrid model avoids full-table scans while ensuring nothing falls through the cracks. The cost difference between sweep-only and event-driven is ~10x in database queries per hour for a 100-team deployment.

### Concurrency Control

- **Dispatch phase**: `pg_advisory_lock(team_id)` held briefly while determining what to dispatch next. Released after tasks are queued.
- **Execution phase**: tasks run outside the dispatch lock. Multiple tasks for the same team execute in parallel.
- **Per-opportunity locking**: state transitions on a single opportunity use `pg_advisory_lock(opportunity_id)` to prevent conflicting stage changes from concurrent tasks.
- **Platform isolation**: each platform executor runs independently. A slow action on LinkedIn does not block execution on Boss Zhipin.
- **Cross-team independence**: tasks for different teams are fully independent.

### Task Idempotency

Every `AgentTask` has an `idempotency_key` (UNIQUE, nullable). The orchestrator generates a deterministic key before dispatch:

```
idempotency_key = "{task_type}:{related_entity_id}:{trigger_event_id}"
```

If a duplicate key is detected on insert (UNIQUE violation), the dispatch is a no-op. This prevents duplicate tasks from concurrent sweeps and event triggers.

### Priority Algorithm

When multiple pending items exist, the orchestrator should prioritize:

1. Handoff-triggering events (highest — user needs to act)
2. Reply processing (time-sensitive — employer waiting)
3. Follow-up execution (time-sensitive — window may close)
4. Submission execution (opportunity may expire)
5. Material preparation (required before submission)
6. New opportunity screening (lowest — pipeline fill)

### Task Retry Policy

| Failure Type | Retry | Max Retries | Backoff |
|---|---|---|---|
| Transient (network, timeout) | Yes | 3 | Exponential: 30s, 2m, 10m |
| Platform rate limit | Yes | 2 | Wait for rate limit window |
| Platform auth expired | No | 0 | Surface as platform_connection status change |
| Skill execution error | Yes | 2 | 1m, 5m |
| Data validation error | No | 0 | Surface as task failure |

### Execution Readiness Gate

Before `Start Team` succeeds:

1. `SubmissionProfile.completion_band` must be `minimum_ready` or `complete`
2. At least one `PlatformConnection` must be `active`
3. `ProfileBaseline` must exist (at least one parsed version)
4. `Team.status` must be `ready` or `paused` (re-start)
5. Effective runtime balance must be > 0 (computed live, not from stale ledger)

If any condition fails, return `TEAM_NOT_READY` with specific blockers.

---

## Module 3: Platform Executors

### Responsibility

Execute platform-specific actions: form filling, submission, message sending, reply reading.

### Design

Each supported platform has a **platform executor** that:

1. Accepts a task from the orchestration engine
2. Uses the platform's `PlatformConnection` session
3. Executes the platform-specific action
4. Records the result in `SubmissionAttempt` or `ConversationMessage`
5. Updates `PlatformConnection` health state

### Platform Isolation Rule

Platform executors must be isolated from each other. A failure on one platform must not block execution on others.

### Session Management

- Sessions are stored encrypted in `PlatformConnection.session_token_ref`
- Each executor validates session before action
- If session is expired, executor updates `PlatformConnection.status` to `session_expired` and stops
- Health checks run on `pg_cron` schedule

### Rate Limiting

Each executor enforces platform-specific rate limits from `PlatformDefinition`:

- `max_daily_applications`
- `max_daily_messages`
- Per-request delays based on `anti_scraping_level`

### Detailed platform rules are defined in `PLATFORM_RULE_AND_AGENT_SPEC.md`.

---

## Module 4: Skill Runtime

### Responsibility

Execute agent skills (LLM-powered reasoning tasks) and return structured outputs.

### Design

Skills are LLM calls with:

- A system prompt (from `AGENT_SKILL_AND_PROMPT_SPEC.md` prompt contracts)
- Structured input (from entity data)
- Structured output (validated against skill output schema)
- Quality gates (from skill definitions)

### Execution Flow

```
AgentTask dispatched
  → Skill Runtime loads skill definition
  → Constructs prompt with relevant context
  → Calls LLM API
  → Parses structured output
  → Validates against output schema
  → Applies quality gates
  → Returns result to orchestration engine
  → Orchestration engine maps result to entities (per DATA_MODEL_SPEC mapping)
```

### LLM Provider

Default: Claude API (Anthropic)

### Skill → Model Mapping

Not all skills require the same reasoning depth. Using Opus for every skill call would exhaust the Anthropic budget within days. The mapping below assigns each skill to the cheapest model that meets its quality requirements.

| Model Tier | Claude Model | Token Budget (input/output) | Skills |
|---|---|---|---|
| **Tier 1: Deep Reasoning** | Sonnet (default) / Opus (fallback) | 8K / 2K | `fit-evaluation`, `recommendation-generation`, `conflict-detection`, `conversation-progression`, `reply-reading` |
| **Tier 2: Standard Generation** | Sonnet | 6K / 2K | `cover-letter-generation`, `first-contact-drafting`, `truthful-rewrite`, `handoff-package-generation`, `submission-planning`, `low-risk-followup` |
| **Tier 3: Light Processing** | Haiku | 4K / 1K | `summary-generation`, `reason-tagging`, `confidence-signaling`, `language-baseline-detection`, `experience-normalization`, `light-deduplication`, `source-quality-signaling`, `freshness-scanning` |
| **Tier 4: Structured Extraction** | Haiku | 8K / 2K | `resume-parse`, `field-mapping`, `screening-question-support`, `execution-result-recording`, `opportunity-discovery`, `source-collection` |

**Rules:**

1. **Model selection is configurable per skill** via a `skill_model_config` table (skill_code → model_id, max_input_tokens, max_output_tokens). Defaults from the table above apply when no override exists.
2. **Retry on format error:** if the LLM returns unparseable output, retry once with the same model. If the retry also fails, escalate to the next tier model (Haiku → Sonnet → Opus). Max 2 escalations per skill invocation.
3. **Caching:** skill results are cached keyed on `hash(skill_code + input_hash)`. Cache TTL = 24 hours for Tier 3/4, 4 hours for Tier 1/2. Cache is invalidated when upstream entity data changes.
4. **Budget guardrail:** per-team daily LLM spend is tracked. If a team exceeds 2x the expected daily cost, the orchestrator throttles to Tier 3/4 skills only until the next billing day.
5. **Opus is never the default.** It is only used as a fallback escalation path when Sonnet fails quality gates or returns unparseable output.

### Cost Control

- Skills should specify minimum required context window
- Unnecessary context should not be loaded
- Skill results should be cached when inputs are unchanged
- `confidence-signaling` output may be used to avoid re-running high-cost skills

---

## Module 5: Material Pipeline

### Responsibility

Resume parsing, material generation, localization, and storage.

### Owned Tables (writes)

- `material`
- Updates to `resume_asset.parse_status`

### Pipeline Paths

The material pipeline operates in two modes based on `PlatformDefinition.pipeline_mode`:

#### Shared Steps (both paths)

1. **Resume Upload** → store in Supabase Storage → update `ResumeAsset`
2. **Resume Parse** → extract structure → create `ProfileBaseline`

These always run during onboarding, regardless of which platforms the user connects.

#### Full Tailored Path (`global_english` platforms)

3. **Material Generation** → create `Material` records (light edit, standard, deep, localized)
4. **Cover Letter Generation** → create `Material` (type: `cover_letter`)
5. **Draft Generation** → create `Material` (type: `first_contact_draft`, `follow_up_draft`, etc.)

Triggered per-opportunity when the orchestrator dispatches `materials_advisor` for a `full_tailored` pipeline opportunity.

#### Passthrough Path (`china` platforms)

3. **No material generation** — the `SubmissionAttempt` references the user's original `ResumeAsset` directly
4. **No cover letter** — Chinese platform apply forms do not have cover letter fields
5. **Draft Generation** — `first_contact_draft` may still be generated for platforms with messaging (Boss直聘 V1.1)

The orchestrator skips `materials_advisor` dispatch entirely. The opportunity transitions directly from `prioritized` → `submitted`.

#### Cost Impact

For a `cross_market` user with 50% Chinese / 50% English opportunities:
- Full tailored path: ~5 LLM calls per opportunity (Tier 1-2 skills)
- Passthrough path: ~1 LLM call per opportunity (screening only)
- Estimated 60% reduction in total LLM cost compared to running full pipeline for all opportunities

### Visual Fidelity Rule

When generating resume variants (full_tailored path only):

- Start with `strict` preservation mode
- Fall to `adaptive` if content change causes visual damage
- Fall to `content_only_fallback` only when format cannot be preserved
- Record `Material.preservation_mode` for audit

---

## Module 6: Billing Service

### Responsibility

Track team runtime usage and enforce plan limits.

### Owned Tables

- `runtime_ledger_entry`

### Billing Model

- **Session-based**: record `session_start` when team starts, `session_end` when team pauses
- **No per-tick entries**: usage = duration of session windows
- **Runtime balance**: live computed as `last_ledger_balance - elapsed_since_session_start` (see Real-Time Balance Computation below)
- **Allocation**: billing cycle grants runtime via `allocation` entry
- **Enforcement**: when balance reaches 0, system triggers forced pause with `pause_origin = system_entitlement`

### Real-Time Balance Computation

The latest `RuntimeLedgerEntry.balance_after_seconds` reflects the balance at the last ledger write (session_end or allocation). While a team is actively running, the **effective current balance** is:

```
effective_balance = last_ledger_balance - (now - last_session_start_at)
```

The billing enforcement cron checks this computed value, not just the raw ledger entry. `Start Team` also gates on `effective_balance > 0`.

### Billing Cycle

- Each plan tier defines a billing cycle (e.g., monthly)
- At cycle start, an `allocation` entry grants the plan's runtime allowance
- At cycle end, unused runtime does not roll over (in v1)

---

## API Design

### Conventions

- All endpoints return the standard envelope:

```json
{
  "data": {},
  "meta": {},
  "error": null
}
```

- Error envelope:

```json
{
  "data": null,
  "meta": {},
  "error": {
    "code": "BUSINESS_ERROR_CODE",
    "message": "Human-readable message",
    "details": {}
  }
}
```

- All timestamps are ISO 8601 UTC
- All IDs are UUID v4
- Pagination uses cursor-based pagination (`next_cursor`)
- Rate limiting: 100 req/min per user for UI endpoints, 10 req/min for mutations

### API Prefix Structure

| Prefix | Purpose |
|---|---|
| `/api/auth/*` | Authentication |
| `/api/ui/*` | Page-facing aggregation endpoints |
| `/api/onboarding/*` | Onboarding workflow |
| `/api/activation/*` | Team activation |
| `/api/team/*` | Team runtime control |
| `/api/opportunities/*` | Opportunity CRUD |
| `/api/handoffs/*` | Handoff CRUD |
| `/api/agents/*` | Agent detail |
| `/api/platforms/*` | Platform connection management |
| `/api/settings/*` | User preferences |
| `/api/stream/*` | Realtime SSE streams |

---

## Transformation Layer

### Purpose

Convert domain entities into frontend-facing aggregation payloads. This layer sits between the database and the API response.

### Key Transformations

#### AgentRuntimeState → AgentFrontendStatus

Per `DATA_MODEL_SPEC.md` mapping table. Applied in `AgentSummary` construction.

#### PlatformStatus → Frontend PlatformStatus

- `session_expired` → frontend receives as `session_expired` (frontend should display as "needs reconnection")

#### CoverageScope alignment

- Database stores `cross_market`
- Frontend currently uses `cross_market_global`
- Transformation layer maps `cross_market` → `cross_market_global` until frontend is updated
- After frontend alignment, this mapping is removed

#### OpportunityStage Frontend Mapping

The canonical `material_ready` stage is an internal execution stage not visible in frontend. The transformation layer maps it:

- `material_ready` → frontend receives `prioritized` (materials being prepared is part of prioritization from user's perspective)

Note: for `passthrough` pipeline opportunities (china platforms), the `material_ready` stage is never entered — the opportunity transitions directly from `prioritized` → `submitted`. No mapping is needed for this path.

All other stages pass through directly.

#### Opportunity → OpportunitySummary

```ts
function toOpportunitySummary(opp: Opportunity, latestAttempt?: SubmissionAttempt): OpportunitySummary {
  return {
    id: opp.id,
    company_name: opp.company_name,
    job_title: opp.job_title,
    location_label: opp.location_label,
    platform_id: opp.source_platform_id,
    platform_name: lookupPlatformName(opp.source_platform_id),
    stage: mapStageForFrontend(opp.stage),  // material_ready → prioritized
    stage_label: stageToLabel(opp.stage),
    priority_level: opp.priority_level,
    lead_agent_id: opp.lead_agent_id,
    lead_agent_name: lookupAgentName(opp.lead_agent_id),
    requires_takeover: opp.requires_takeover,
    latest_event_at: opp.latest_event_at,
    latest_event_summary: opp.latest_event_summary,
    closure_reason_code: opp.closure_reason,
  }
}
```

#### HomePayload Assembly

```ts
function assembleHomePayload(teamId: string): HomePayload {
  // Parallel queries:
  const [user, team, runtime, agents, feed, opportunities, handoffs, plan] = await Promise.all([
    getUser(teamId),
    getTeam(teamId),
    getTeamRuntime(teamId),
    getAgentSummaries(teamId),          // with frontend status mapping
    getRecentFeedEvents(teamId, 50),     // visibility = 'feed', last 50
    getHighValueOpportunities(teamId, 10), // priority >= high, not closed
    getPendingHandoffs(teamId, 5),       // state = awaiting_takeover, limit 5
    getPlanSummary(teamId),
  ])
  return { user, team, runtime, agents, live_feed: feed, high_value_opportunities: opportunities, handoff_summary: handoffs, plan_summary: plan }
}
```

---

## Aggregation Endpoints (Full Contract)

### GET `/api/ui/home`

Returns `HomePayload` per `FRONTEND_INTERFACE_SPEC.md`.

Auth: Required.
Rate: Standard.

### GET `/api/ui/opportunities`

Query params: `stage?`, `platform_id?`, `priority?`, `search?`, `sort?`, `cursor?`, `limit?`

Returns `OpportunitiesPayload`.

Default sort: `latest_event_at DESC`.
Default limit: 25.
Max limit: 100.

### GET `/api/ui/handoffs`

Query params: `state?`, `handoff_type?`, `urgency?`, `cursor?`, `limit?`

Returns `HandoffsPayload`.

Default sort: `urgency DESC, created_at DESC`.

### GET `/api/ui/platforms`

Returns `PlatformsPayload` grouped by region.

### GET `/api/ui/plan`

Returns `PlanPayload` with current plan, available plans, and **live computed runtime balance** (not raw ledger value). Balance computation uses the formula from the Billing section: `effective_balance = last_ledger_balance - elapsed_since_session_start`.

### GET `/api/ui/settings`

Returns `SettingsPayload`.

### GET `/api/ui/review`

Query params: `window?=7d|14d|30d`

Returns `ReviewPayload`. Aggregates opportunity counts, stage distributions, and performance signals for the window.

### GET `/api/ui/onboarding`

Returns current `OnboardingDraft` with question definitions.

### GET `/api/ui/activation`

Returns `ActivationSummary` with team roster, onboarding summary, and automation boundaries.

### GET `/api/ui/readiness`

Returns a `ReadinessPayload`:

```ts
type ReadinessPayload = {
  team: TeamSummary
  submission_profile: SubmissionProfile
  execution_readiness: ExecutionReadinessStatus
  platform_tasks: Array<{
    platform_id: string
    platform_name: string
    status: PlatformStatus
    action_required: string | null  // e.g. "connect", "reconnect", "upgrade_plan"
  }>
  blocking_items: string[]
  non_blocking_items: string[]
}
```

### GET `/api/submission-profile`

Returns the user's `SubmissionProfile`.

### PATCH `/api/submission-profile`

Update submission profile fields. Recomputes `completion_band` on every write.

---

## Auth Endpoints

### GET `/api/auth/session`

Returns the current session state and user summary.

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

Auth: Optional (returns `is_authenticated: false` if no session).

### POST `/api/auth/logout`

Invalidates the current session.

Response: `{ "data": { "logged_out": true } }`

### Auth Implementation Note

Supabase Auth handles OAuth provider integration (Google, GitHub, WeChat). The `/api/auth/session` endpoint wraps `supabase.auth.getSession()` and enriches with the `UserSummary` from our `user` table.

---

## Entity Endpoints

### GET `/api/opportunities/:id`

Returns `OpportunityDetail` including collaboration chain, timeline, and **full material content**.

The `materials` array in the response MUST include `content_text` for frontend material preview:

```typescript
materials: Array<{
  id: string;
  material_type: string;
  status: string;
  language: string;
  version: number;
  content_text: string | null;  // Full content for preview
  created_at: string;
}>
```

**Material content format by type:**
- `standard_tailored_resume`: JSON `{ tailored_sections: [{ section_name, tailored_text, changes_made }], emphasis_strategy }`
- `cover_letter`: JSON `{ full_text, opening, value_proposition, closing }`

### GET `/api/handoffs/:id`

Returns `HandoffDetail` including context events and suggested actions.

### GET `/api/agents/:id`

Returns agent detail with current task summary and recent actions.

---

## Mutation Endpoints

### POST `/api/onboarding/resume`

Upload resume file. Multipart form data.

Validation:
- File size ≤ 10MB
- MIME type: PDF, DOC, DOCX
- One primary resume per user

Response: Updated `OnboardingDraft` with `resume_upload_status`.

Async: triggers `resume-parse` skill after upload completes. Frontend polls `OnboardingDraft.resume_upload_status` for progress.

### PATCH `/api/onboarding/draft`

Update answered fields.

Request: `{ draft_id, answers: { key: value } }`

Validation: validates answer values against question definitions.

### POST `/api/onboarding/complete`

Mark onboarding as complete. Creates team if not exists.

Pre-conditions: resume processed, required questions answered.

### POST `/api/activation/confirm`

Confirm team activation. Creates 7 agent instances.

Response: `{ team, runtime: { runtime_status: "paused" } }`

Note: team starts paused. User must explicitly `Start Team`.

### POST `/api/team/start`

Start team execution.

Pre-conditions: execution readiness gate passes (checked server-side, not trusted from frontend).

Response: `{ team, runtime: { runtime_status: "starting" }, meta: { operation_id } }`

Side effects:
- Creates `RuntimeLedgerEntry` (session_start)
- Wakes orchestration engine for this team
- Agent instances transition to `ready`

### POST `/api/team/pause`

Pause team execution.

Response: `{ team, runtime: { runtime_status: "pausing" }, meta: { operation_id } }`

Side effects:
- Creates `RuntimeLedgerEntry` (session_end with duration)
- All agents transition to `paused`
- Active tasks normalize to re-dispatchable state

### PATCH `/api/settings/preferences`

Partial update of user preferences.

Validation: validates against canonical enums.

Side effects: if `strategy_mode` or `coverage_scope` changed, synchronize to `Team` entity.

### POST `/api/handoffs/:id/takeover`

User begins handling a handoff item.

Request: `{ action: "start_takeover" }`

Transition: `awaiting_takeover → in_user_handling`

### POST `/api/handoffs/:id/waiting-external`

User marks handoff as waiting on employer/external party.

Transition: `in_user_handling → waiting_external`

### POST `/api/handoffs/:id/resolve`

User resolves a handoff item.

Request: `{ resolution_type: "resolved" | "returned_to_team" }`

Transition: `in_user_handling → resolved` or `in_user_handling → returned_to_team` or `waiting_external → resolved`

Side effects:
- If `returned_to_team`: orchestrator re-evaluates opportunity
- If `resolved`: opportunity may transition to `closed` (user decides outside system)

### POST `/api/handoffs/:id/close`

User explicitly closes a handoff item (e.g., opportunity no longer relevant).

Transition: `in_user_handling → closed` or `waiting_external → closed` or `resolved → closed`

Sets: `Handoff.resolution_type = "closed_by_user"`

Side effects: associated opportunity may transition to `closed` with `closure_reason = user_resolved_handoff`.

### POST `/api/opportunities/:id/trigger-takeover`

User manually triggers takeover for an opportunity (forces handoff creation).

Pre-conditions: opportunity must be in an active stage (not already `needs_takeover` or `closed`).

Side effects:
- Creates a new `Handoff` record with `handoff_type = "other_high_risk"` and `state = "awaiting_takeover"`
- Transitions opportunity to `needs_takeover`
- Emits `TimelineEvent`

### POST `/api/opportunities/:id/mark-focus`

Toggle focus/priority on an opportunity.

Request: `{ focused: boolean }`

### POST `/api/platforms/:id/reconnect`

Initiate platform reconnection flow.

Response: `{ platform_connection, reconnect_url? }`

Side effects: updates `PlatformConnection.status` to `pending_login`.

---

## Realtime Streams

### Transport

Primary: Supabase Realtime (Postgres Changes) with RLS-enabled channels.

Each channel uses Supabase Realtime's built-in RLS filtering — only rows the user can access via RLS policies are delivered.

### Stream Envelope

All stream messages delivered to the frontend are wrapped in the `StreamEnvelope` defined in `FRONTEND_INTERFACE_SPEC.md`:

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

### Sequence Generation

The backend maintains a per-team monotonic sequence counter (stored in `team.stream_sequence` or derived from a Postgres sequence). Each realtime event increments the counter. Frontend ignores events with `sequence ≤ last_seen_sequence`.

### GET `/api/stream/home`

Frontend subscribes to this endpoint for the Team Home live feed, runtime state, and handoff count.

Implementation: Supabase Realtime subscription (or SSE wrapper for frontend compatibility).

Supabase Realtime subscription:
- Table: `timeline_event`
- Filter: `team_id=eq.{team_id}` AND `visibility=eq.feed`
- Event: INSERT

Envelope: `{ event_name: "feed_event", delivery_mode: "append", payload: TimelineEvent }`

### Channel: Team Runtime

- Table: `team`
- Filter: `id=eq.{team_id}`
- Event: UPDATE (columns: `runtime_status`)

Envelope: `{ event_name: "runtime_status_changed", delivery_mode: "replace", payload: { runtime_status } }`

### Channel: Handoff Count

- Table: `handoff`
- Filter: `team_id=eq.{team_id}`
- Event: INSERT, UPDATE

Backend computes: `SELECT count(*) FROM handoff WHERE team_id = ? AND state = 'awaiting_takeover'`

Envelope: `{ event_name: "handoff_count_updated", delivery_mode: "replace", payload: { pending_count } }`

### GET `/api/stream/opportunities/:opportunityId`

Frontend subscribes to this endpoint for opportunity-specific timeline events.

Supabase Realtime subscription:
- Table: `timeline_event`
- Filter: `team_id=eq.{team_id}` AND `related_entity_id=eq.{opportunity_id}` AND `visibility IN ('feed', 'opportunity_timeline')`
- Event: INSERT

Envelope: `{ event_name: "opportunity_event", delivery_mode: "append", payload: TimelineEvent }`

Note: `internal` and `audit` visibility events are excluded from this channel.

### Reconnect Rule

- Client retries with exponential backoff (1s, 2s, 4s, 8s, max 30s)
- On reconnect, client sends `last_sequence` — backend replays missed events or client refetches warm state
- Existing visible data preserved during disconnect
- If gap is too large (> 100 events), backend sends `{ delivery_mode: "invalidate" }` instructing client to refetch the full resource

---

## Webhook / Async Operations

### Resume Parse Completion

After resume upload, the parse pipeline runs asynchronously:

1. Upload handler stores file → returns immediately
2. Background worker triggers `resume-parse` skill
3. On completion: updates `ResumeAsset.parse_status`, creates `ProfileBaseline`
4. Frontend detects via polling `OnboardingDraft.resume_upload_status`

### Platform Health Check

`pg_cron` job runs every 10 minutes:

1. For each active `PlatformConnection`, check session validity
2. If expired, update status to `session_expired`
3. Emit `TimelineEvent` if status changed

### Billing Enforcement

`pg_cron` job runs every 1 minute when teams are active:

1. Compute `effective_balance = last_ledger_balance - (now - session_start)` for active teams
2. If depleted, trigger forced pause with `pause_origin = system_entitlement`

---

## Error Handling

### Error Code Registry

All business error codes from `FRONTEND_INTERFACE_SPEC.md` are implemented:

#### Team Runtime

- `TEAM_ALREADY_ACTIVE` — 409
- `TEAM_ALREADY_PAUSED` — 409
- `TEAM_NOT_READY` — 422, includes `blockers[]`
- `TEAM_RUNTIME_BLOCKED` — 503
- `FORBIDDEN_ACTION_WHILE_PAUSED` — 403

#### Onboarding / Activation

- `RESUME_MISSING` — 422
- `ONBOARDING_INCOMPLETE` — 422
- `INVALID_COVERAGE_SCOPE` — 400
- `INVALID_STRATEGY_MODE` — 400
- `REQUIRED_PROFILE_INFO_MISSING` — 422

#### Platform

- `PLATFORM_AUTH_REQUIRED` — 401
- `PLATFORM_RESTRICTED` — 403
- `PLATFORM_UNAVAILABLE` — 503
- `PLATFORM_PLAN_LOCKED` — 403
- `PLATFORM_RECONNECT_REQUIRED` — 401

#### Opportunity

- `OPPORTUNITY_NOT_FOUND` — 404
- `OPPORTUNITY_CLOSED` — 409
- `OPPORTUNITY_ALREADY_FOCUSED` — 409
- `OPPORTUNITY_NOT_TAKEOVER_ELIGIBLE` — 422

#### Handoff

- `HANDOFF_NOT_FOUND` — 404
- `HANDOFF_ALREADY_RESOLVED` — 409
- `HANDOFF_ALREADY_IN_USER_HANDLING` — 409
- `HANDOFF_NOT_ACTIONABLE` — 422

#### Plan / Runtime

- `PLAN_LIMIT_REACHED` — 402
- `RUNTIME_EXHAUSTED` — 402
- `UPGRADE_REQUIRED` — 402
- `BILLING_ACTION_REQUIRED` — 402

#### Settings

- `SETTINGS_CONFLICT` — 409
- `INVALID_PREFERENCE_VALUE` — 400
- `BOUNDARY_CONFIGURATION_INVALID` — 400

### HTTP Status Code Mapping

| Category | HTTP Status |
|---|---|
| Success | 200, 201 |
| Bad input | 400 |
| Auth required | 401 |
| Payment required | 402 |
| Forbidden | 403 |
| Not found | 404 |
| Conflict (state) | 409 |
| Validation (business) | 422 |
| Rate limited | 429 |
| Server error | 500 |
| Service unavailable | 503 |

---

## Security

### Authentication

- All `/api/*` endpoints (except `/api/auth/*` public routes) require a valid Supabase Auth session
- Session token passed via `Authorization: Bearer <token>` header
- Token verification is handled by Supabase Edge Function middleware

### Authorization

- User can only access their own team's data (enforced by RLS + application-layer checks)
- Service role is used for orchestration engine operations (bypasses RLS)
- No admin UI in v1; admin operations are internal-only

### Sensitive Data

- `PlatformConnection.session_token_ref` — encrypted at rest via Supabase Vault
- `ResumeAsset` files — stored in private Supabase Storage bucket, accessed only via signed URLs
- `ConversationMessage.content_text` — may contain PII, encrypted at rest
- API responses never include raw session tokens or internal file paths

### Rate Limiting

| Endpoint Category | Limit |
|---|---|
| UI aggregation (GET) | 100/min |
| Mutations (POST/PATCH) | 30/min |
| Resume upload | 5/min |
| Stream connections | 3 concurrent per user |

---

## Idempotency

### Mutation Idempotency Rule

Important mutations support idempotent behavior:

- `POST /api/team/start` — if team already active, return `TEAM_ALREADY_ACTIVE` (no side effect)
- `POST /api/team/pause` — if team already paused, return `TEAM_ALREADY_PAUSED` (no side effect)
- `POST /api/handoffs/:id/takeover` — if already in user handling, return current state
- `POST /api/handoffs/:id/resolve` — if already resolved, return `HANDOFF_ALREADY_RESOLVED`

### Operation Tracking

Async mutations return `meta.operation_id`. Frontend can correlate optimistic state with eventual completion via realtime channels.

---

## Observability

### Logging

- All API requests logged with: `user_id`, `team_id`, `endpoint`, `method`, `status_code`, `duration_ms`
- All orchestration decisions logged with: `team_id`, `agent_role`, `task_type`, `decision`, `reason`
- All platform actions logged with: `team_id`, `platform_id`, `action_type`, `outcome`

### Metrics

Key metrics to track:

- API latency p50/p95/p99 by endpoint
- Orchestration loop cycle time per team
- Task success/failure rates by type
- Platform action success rates by platform
- Skill execution latency and cost
- Active team count
- Runtime balance distribution

### Health Checks

- `/api/health` — returns 200 if database and auth are reachable
- Internal: orchestration engine heartbeat (logged per team per minute when active)

---

## Module Interaction Summary

```
User Action (frontend)
  → API Gateway (auth + routing)
    → Domain Services (entity CRUD + state transition)
    → Orchestration Engine (task dispatch + loop control)
      → Skill Runtime (LLM execution)
      → Platform Executors (platform actions)
      → Material Pipeline (resume + material generation)
    → Billing Service (runtime tracking)
  → Realtime (Supabase Realtime → frontend)
```

---

## Required Frontend Spec Alignment

The following items in `FRONTEND_INTERFACE_SPEC.md` must be updated to match this backend spec:

1. Add `GET /api/auth/session` and `POST /api/auth/logout` endpoint documentation
2. Add `POST /api/opportunities/:id/trigger-takeover` to mutation endpoints
3. Add `POST /api/handoffs/:id/waiting-external` to mutation endpoints
4. Add `GET /api/submission-profile` and `PATCH /api/submission-profile` to entity endpoints
5. Add `GET /api/ui/readiness` full payload definition (not just `ExecutionReadinessStatus`)
6. Add `POST /api/platforms/:id/reconnect` to mutation endpoints
7. Update `OpportunitySummary.stage` mapping: backend maps `material_ready` → `prioritized` in aggregation layer
8. All enum alignment items listed in `DATA_MODEL_SPEC.md` "Required Frontend Spec Updates" section

---

## What This Spec Does Not Define

- Platform-specific rules, anti-scraping strategies, and session management details → `PLATFORM_RULE_AND_AGENT_SPEC.md`
- Implementation milestones, build order, and verification → `IMPLEMENTATION_AND_GOVERNANCE_SPEC.md`
- Individual skill prompt contracts → `AGENT_SKILL_AND_PROMPT_SPEC.md`
- Visual design and component contracts → `UI_SURFACE_SPEC.md`, `FRONTEND_INTERFACE_SPEC.md`

## Final Architecture Principle

The backend should be simple enough to build on Supabase Edge Functions in v1 while being structured enough to extract into standalone services later.

Every module boundary should be a function boundary today and a potential service boundary tomorrow.

The orchestration engine is the most complex module. It should be built last, tested first, and refactored most aggressively.
