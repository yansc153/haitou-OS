# Implementation And Governance Spec

## Document Purpose

This document defines the implementation plan, build order, verification strategy, development governance, AI collaboration boundaries, and environment configuration for Haitou OS v1.

It answers:

- what gets built first and why
- how milestones are defined and verified
- what "done" means for each milestone
- how Claude Code, Codex, and human developers collaborate
- what governance rules prevent drift during implementation
- what environment and secrets setup is required

## Relationship To Earlier Specs

This document is the final spec in the stack. It depends on all previous specs being locked:

1. `PRD_FIRST_PRINCIPLES.md` — product definition
2. `BUSINESS_REQUIREMENTS_FIRST_PRINCIPLES.md` — business constraints
3. `PRODUCT_FLOWS.md` — lifecycle and flow logic
4. `UI_GENERATION_BRIEF.md` — visual direction
5. `AGENT_TEMPLATE_SPEC.md` — 7 role definitions
6. `AGENT_INSTANCE_AND_STATE_SPEC.md` — instance lifecycle
7. `AGENT_SKILL_AND_PROMPT_SPEC.md` — skill system
8. `FRONTEND_INTERFACE_SPEC.md` — frontend contracts
9. `UI_SURFACE_SPEC.md` — page responsibilities
10. `PLATFORM_RULE_AND_AGENT_SPEC.md` — platform integration
11. `BACKEND_API_AND_ARCHITECTURE_SPEC.md` — backend architecture
12. `DATA_MODEL_SPEC.md` — authoritative data model

No implementation should begin until this document is reviewed and accepted.

---

## Implementation Philosophy

### Build What You Can Verify

Every milestone must have a concrete verification method. If you cannot verify it, you cannot ship it.

### Data Model First, UI Last

The database schema is the foundation. API contracts come next. Frontend renders what the API provides. Changing a data model after UI is built is 10x more expensive than getting it right first.

### One Platform End-To-End Before Many Platforms

Prove the full pipeline (discovery → screening → materials → submission → conversation → handoff) on ONE platform before adding more. Greenhouse is the target because it has the highest reliability and a public API.

### Conservative Automation, Aggressive Monitoring

v1 should automate less than the spec allows and monitor more than the spec requires. It is better to ship a system that works reliably on 3 platforms than one that flakes on 10.

---

## Pre-M0: Spec Reconciliation Pass

Before any implementation, a reconciliation pass must update `FRONTEND_INTERFACE_SPEC.md` to align with `DATA_MODEL_SPEC.md` and `BACKEND_API_AND_ARCHITECTURE_SPEC.md`. Specific items listed in those specs' "Required Frontend Spec Updates" sections must be applied. No milestone may begin until enums, types, and endpoint contracts are consistent across all 13 specs.

## V1 Scope Decision

Codex and Claude agreed: the credible v1 scope for a first launch is:

**V1 Launch Platforms:** Greenhouse, Lever, LinkedIn (supervised), 智联招聘, 拉勾
**V1.1 Fast Follow:** Boss直聘 (supervised), 猎聘

Boss直聘 and 猎聘 are NOT required for v1 launch. They are scheduled for V1.1 (2-4 weeks post-launch).
51Job is temporarily removed from the active rollout scope. It remains a research platform until anti-bot handling and supervised execution are better understood.

## Milestone Overview

| # | Milestone | Duration | Depends On | Verification |
|---|---|---|---|---|
| M0 | Environment, Schema & Spec Reconciliation | 4 days | All specs locked | DB runs, RLS passes, specs aligned, seed data valid |
| M1 | Auth & Onboarding | 5 days | M0 | User can sign up, upload resume, complete onboarding, activate team |
| M2 | Platform Auth & Session Infrastructure | 5 days | M0 | Cookie export, Vault storage, consent logging, browser profiles, health checks |
| M3 | Orchestration Engine (Core) + Billing Foundation | 8 days | M0 | Engine dispatches, state machines enforced, ledger tracks runtime, forced pause works |
| M4 | Handoff System (Core) | 4 days | M3 | Handoff creation, detection rules, state machine, basic UI |
| M5 | Greenhouse Pipeline (full_tailored) | 5 days | M3, M4 | Full tailored pipeline: discover → screen → tailor resume + cover letter → submit → detect boundary |
| M6 | Team Home & Opportunity Workspace | 5 days | M1, M5 | Shell, agent cards, live feed, opportunity list, detail panel |
| M7 | Lever Pipeline (full_tailored) | 3 days | M5 | Same full_tailored pipeline on Lever, reusing shared infrastructure |
| M8 | LinkedIn Pipeline (Supervised, full_tailored) | 7 days | M2, M5 | Easy Apply, messaging, session management, supervised mode |
| M9 | 智联招聘 Pipeline (passthrough) | 4 days | M2, M5 | Cookie session, web apply, original resume, passthrough pipeline path, capability health |
| M10 | 拉勾 Pipeline (passthrough) | 4 days | M2, M5 | Keyword search, detail route, browser apply, passthrough pipeline, dedup |
| M11 | Handoff Center & Platform Coverage UI | 4 days | M4, M6, M8 | Full handoff UI, platform coverage page, takeover flow |
| M12 | Billing UI & Plan Enforcement | 3 days | M3, M6 | Plan page, usage display, upgrade path, runtime indicator in shell |
| M13 | Settings, Review & Polish | 4 days | M11, M12 | Settings page, review page, live feed quality, error handling |
| M14 | Launch Readiness | 3 days | M13 | Security audit, load test, monitoring, launch checklist |

**Total estimated: ~68 days** (with parallel tracks: M1+M2 parallel, M7+M8+M9+M10 partial parallel, M11+M12 parallel. M9/M10 reduced by ~2 days due to passthrough simplification — no material generation integration needed.)

**V1.1 (post-launch):**

| # | Milestone | Duration | Depends On |
|---|---|---|---|
| M15 | 猎聘 Pipeline | 5 days | M9 |
| M16 | Boss直聘 Pipeline (Supervised) | 7 days | M2, M9 |

---

## Milestone Details

### M0: Environment & Schema

**Goal:** Production-ready database, auth, and infrastructure foundation.

**Tasks:**

1. Create Supabase project (staging + production)
2. Configure Supabase Auth with OAuth providers (Google, GitHub)
3. Run database migrations for all entities from `DATA_MODEL_SPEC.md`:
   - User, Team, OnboardingDraft, ResumeAsset, ProfileBaseline
   - SubmissionProfile, AgentInstance, AgentStateTransition
   - Opportunity, Handoff, Material, SubmissionAttempt
   - ConversationThread, ConversationMessage
   - PlatformDefinition, PlatformConnection, PlatformConsentLog, PlatformDailyUsage
   - RuntimeLedgerEntry, AgentTask, AgentTaskDependency, TimelineEvent
   - UserPreferences
   - Junction tables: SubmissionAttemptMaterial, HandoffMaterial
4. Apply all UNIQUE constraints from `DATA_MODEL_SPEC.md`
5. Apply all RLS policies from `DATA_MODEL_SPEC.md`
6. Create indexes from `DATA_MODEL_SPEC.md`
7. Seed `PlatformDefinition` with Tier 1 platforms
8. Configure Supabase Storage bucket (encrypted, private) for resume files
9. Configure Supabase Vault for session token encryption
10. Set up Fly.io project for orchestration worker
11. Set up pg_cron for scheduled jobs

**Verification:**

- [ ] All migrations run without error on clean database
- [ ] RLS policies verified: user A cannot read user B's data
- [ ] Seed data: 7 PlatformDefinition records present
- [ ] Storage bucket accessible via signed URLs only
- [ ] Vault encryption/decryption roundtrip works
- [ ] Fly.io worker can connect to Supabase DB

**Done Definition:** A developer can connect to the database, create a user, and verify all tables exist with correct constraints.

---

### M1: Auth & Onboarding

**Goal:** User can sign up, upload resume, answer onboarding questions, and activate a team.

**Tasks:**

1. Implement `/api/auth/session` and `/api/auth/logout`
2. Implement `/api/ui/onboarding` (GET)
3. Implement `/api/onboarding/resume` (POST) — file upload + async parse trigger
4. Implement resume parse pipeline (Edge Function → skill runtime → ProfileBaseline creation)
5. Implement `/api/onboarding/draft` (PATCH) — answer questions
6. Implement `/api/onboarding/complete` (POST) — create team + 7 agent instances
7. Implement `/api/ui/activation` (GET)
8. Implement `/api/activation/confirm` (POST)
9. Implement `/api/ui/readiness` (GET) — compute readiness from SubmissionProfile + PlatformConnection
10. Implement `/api/submission-profile` (GET, PATCH)
11. Build frontend: Login → Onboarding → Activation → Readiness flow
12. Build frontend: resume upload UI with progress states

**Verification:**

- [ ] OAuth login works (Google)
- [ ] Resume upload stores file in Storage, creates ResumeAsset
- [ ] Resume parse creates ProfileBaseline with extracted data
- [ ] Onboarding draft persists across page refreshes
- [ ] Team activation creates 7 AgentInstance records with correct role codes
- [ ] Execution readiness correctly reports blockers
- [ ] Post-login routing follows the progression rules from `FRONTEND_INTERFACE_SPEC.md`

**Done Definition:** A new user can sign up, upload a resume, complete onboarding, see their 7-agent team, and reach the readiness page.

---

### M3: Orchestration Engine (Core) + Billing Foundation

**Goal:** The orchestration worker can dispatch tasks, enforce state machines, handle pause/resume, and track runtime billing.

**Tasks:**

1. Deploy orchestration worker on Fly.io
2. Implement pgmq task queue integration
3. Implement dispatch loop: read queue → advisory lock → dispatch → release
4. Implement task idempotency (idempotency_key on AgentTask)
5. Implement state machine enforcement for Opportunity stages
6. Implement state machine enforcement for Handoff states
7. Implement pause normalization (running tasks → queued)
8. Implement resume flow (re-dispatch queued tasks)
9. Implement task retry policy from `BACKEND_API_AND_ARCHITECTURE_SPEC.md`
10. Implement pg_cron sweeps (stale tasks, follow-up timing, billing check)
11. Implement RuntimeLedger session tracking (session_start on team start, session_end on pause)
12. Implement billing enforcement (effective balance check, forced pause on exhaustion)

**Verification:**

- [ ] Worker starts and connects to DB
- [ ] Tasks dispatched via pgmq arrive at worker
- [ ] State machine rejects illegal transitions (e.g., closed → discovered)
- [ ] Pause normalizes running tasks to queued
- [ ] Resume re-dispatches queued tasks
- [ ] Retry policy works: transient failure → retry with backoff
- [ ] RuntimeLedger records session_start and session_end correctly
- [ ] Forced pause triggers when balance reaches 0

**Done Definition:** The orchestration engine can process a task queue, enforce state machines, and handle the full team lifecycle.

---

### M2: Platform Auth & Session Infrastructure

**Goal:** The system can acquire, store, validate, and manage platform session tokens.

**Tasks:**

1. Build browser extension MVP (cookie extraction for LinkedIn, 智联, 拉勾)
2. Implement Vault encryption/decryption for session tokens
3. Implement PlatformConnection create/update with consent logging
4. Implement PlatformConsentLog writes (granted, expired, revoked)
5. Implement session health check cron job
6. Implement browser profile manager on Fly.io worker
7. Implement `/api/platforms/:id/reconnect` endpoint
8. Build Platform Coverage page (basic version)

**Verification:**

- [ ] Cookie extraction works for LinkedIn (manual test)
- [ ] Token stored encrypted in Vault, retrievable only by service role
- [ ] PlatformConsentLog records grant with IP, UA, fingerprint
- [ ] Health check detects expired session and updates status
- [ ] Browser profile persists across worker restarts
- [ ] Platform Coverage page shows connection status per platform

**Done Definition:** A user can connect a LinkedIn or Chinese browser-based platform account via cookie export and the system can validate and use the session.

---

### M4: Handoff System (Core)

**Goal:** The system can detect handoff boundaries, create handoff records, and present them to the user.

**Tasks:**

1. Implement handoff boundary detection rules (private contact, salary, interview time, etc.)
2. Implement Handoff entity creation with correct type classification
3. Implement Handoff state machine enforcement
4. Implement `/api/handoffs/:id/takeover`, `/api/handoffs/:id/resolve`, `/api/handoffs/:id/close`
5. Build basic Handoff notification in Team Home (count + summary)
6. Implement opportunity → needs_takeover stage transition on handoff creation

**Verification:**

- [ ] Handoff created when boundary keyword detected in conversation
- [ ] Handoff state machine rejects illegal transitions
- [ ] Opportunity transitions to needs_takeover when handoff created
- [ ] Takeover/resolve mutations work correctly
- [ ] Team Home shows pending handoff count

**Done Definition:** The system can detect a handoff boundary, create a handoff record, and a user can take over and resolve it.

---

### M5: Greenhouse Pipeline (End-to-End) — Full Tailored Path

**Goal:** Full autonomous pipeline on Greenhouse with handoff safety. This milestone proves the `full_tailored` pipeline path used by all `global_english` platforms.

**Tasks:**

1. Implement Greenhouse Job Board API discovery (opportunity-discovery skill)
2. Implement fit-evaluation skill execution
3. Implement recommendation-generation skill execution
4. Implement cover-letter-generation skill execution
5. Implement Greenhouse browser-based form submission executor
6. Implement SubmissionAttempt recording
7. Implement Material creation for generated documents
8. Wire orchestration: discovery → screening → materials → submission flow (full_tailored path)
9. Implement pipeline_mode routing in orchestrator — verify `full_tailored` path dispatches material skills
10. Wire handoff detection into the pipeline — if boundary detected, trigger handoff from M4
11. Test with real Greenhouse job boards (open-source companies, clearly marked test applications)

**Verification:**

- [ ] Discovery finds real jobs from a Greenhouse board
- [ ] Fit evaluation produces structured output with fit_posture
- [ ] Recommendation produces advance/watch/drop/needs_context
- [ ] Cover letter generated and stored as Material
- [ ] Submission succeeds on a test Greenhouse form with tailored resume + cover letter
- [ ] SubmissionAttempt record created with outcome
- [ ] Handoff triggers correctly when boundary detected
- [ ] Full pipeline runs autonomously after team start
- [ ] TimelineEvents created for each step
- [ ] Pipeline mode routing correctly identifies Greenhouse as `full_tailored`

**Done Definition:** System autonomously discovers, evaluates, prepares tailored materials, submits, and detects boundaries on Greenhouse jobs. The `full_tailored` pipeline path is proven.

---

### M6: Team Home & Opportunity Workspace

**Goal:** Full logged-in experience with team dashboard and opportunity management.

**Tasks:**

1. Implement `/api/ui/home` with full HomePayload (real data from pipeline)
2. Implement Supabase Realtime for live feed, runtime status, handoff count
3. Build Opportunity Workspace page (list view, stage pipeline view)
4. Build OpportunityDetailPanel (side panel with timeline)
5. Implement `/api/ui/opportunities` with filtering and pagination
6. Implement `/api/opportunities/:id` with collaboration chain
7. Wire live feed to show agent activity from pipeline execution

**Verification:**

- [ ] Team Home shows real agent activity from Greenhouse pipeline
- [ ] Live feed updates in real time when tasks complete
- [ ] Opportunity Workspace shows real opportunities with correct stages
- [ ] Detail panel shows timeline of agent actions
- [ ] Filtering by stage, platform, priority works

**Done Definition:** User sees their team working and can browse/inspect all opportunities.

---

### M7: Lever Pipeline

**Goal:** Second ATS platform working, validating shared executor infrastructure.

**Tasks:**

1. Implement Lever Postings API discovery
2. Adapt browser form executor for Lever's form structure
3. Test submission on Lever-hosted job boards
4. Verify PlatformDailyUsage tracking

**Verification:**

- [ ] Discovery finds real Lever jobs
- [ ] Submission succeeds on test Lever form
- [ ] SubmissionAttempt recorded correctly
- [ ] Shared infrastructure (skills, materials, handoff) works without platform-specific changes

**Done Definition:** Lever pipeline works end-to-end reusing Greenhouse infrastructure.

---

### M8: LinkedIn Pipeline (Supervised)

**Goal:** LinkedIn Easy Apply and messaging working in supervised mode.

**Tasks:**

1. Implement LinkedIn discovery via authenticated scrape
2. Implement Easy Apply flow executor (multi-step modal, screening questions)
3. Implement LinkedIn messaging executor (first contact, follow-up)
4. Implement reply reading via inbox polling
5. Implement PlatformDailyUsage budget enforcement (15 apps, 10 messages)
6. Wire conversation thread/message recording
7. Test discovery in live-read mode (staging: real jobs, no submissions)
8. Test Easy Apply and messaging in mock mode (CI) with platform mock server
9. Final validation: developer's own account in production environment, supervised, with full human oversight
10. Implement supervised-mode indicators in UI

**Verification:**

- [ ] Mock mode: Easy Apply and messaging pass against mock platform server
- [ ] Live-read mode (staging): discovery finds real LinkedIn jobs without submitting
- [ ] Production validation (human-supervised): Easy Apply submission succeeds on developer's own account
- [ ] Production validation (human-supervised): messaging sends and reads correctly
- [ ] Daily budget enforced — stops at limit
- [ ] Session expiry detected and surfaced in Platform Coverage
- [ ] Handoff triggers on private-channel/salary/interview boundary

**Done Definition:** LinkedIn pipeline works with human oversight. Account safety maintained over 7-day test window.

---

### M9: 智联招聘 Pipeline — Passthrough Path

**Goal:** First Chinese platform working, proving the cookie-session model AND the `passthrough` pipeline path.

This milestone is simpler than M5 because `passthrough` skips all material generation. No resume tailoring, no cover letter, no localization. The user's original resume is submitted directly.

**Tasks:**

1. Implement 智联 job search scraper (with font-obfuscation handling)
2. Implement cookie-session management for 智联
3. Implement form-based submission executor (submits original `ResumeAsset`, no generated Material)
4. Implement `passthrough` pipeline path in orchestrator: `prioritized → submitted` (skip `material_ready`)
5. Implement capability-level health checks (`search`, `detail`, `apply`, `chat`, `resume`)
6. Wire PlatformDailyUsage budget (30 apps)
7. Test discovery in live-read mode (staging: real jobs, no submissions)
8. Final validation: developer's own account in production, supervised apply flow

**Verification:**

- [ ] Mock mode: submission and capability-health transitions pass against mock server
- [ ] Live-read mode (staging): discovery finds 智联 jobs (salary/text decoded from custom fonts)
- [ ] Production validation (human-supervised): web submission succeeds on developer's own account using original resume
- [ ] Production validation (human-supervised): detail read succeeds on developer's own account
- [ ] Pipeline mode routing correctly identifies 智联 as `passthrough` — no material generation skills dispatched
- [ ] Opportunity transitions directly from `prioritized` → `submitted` (no `material_ready` stage)
- [ ] Daily budget enforced
- [ ] Session expiry detected within 2 health check cycles

**Done Definition:** 智联 pipeline works end-to-end for `search + detail + apply` using `passthrough` mode. The region pipeline split is proven.

---

### M10: 拉勾 Pipeline — Passthrough Path

**Goal:** Second Chinese platform working, proving keyword-search and apply deduplication. Also uses `passthrough` pipeline.

**Tasks:**

1. Implement 拉勾 keyword search scraper
2. Implement validated detail-route resolution
3. Implement browser-based apply executor (submits original `ResumeAsset`)
4. Implement apply deduplication check via visible `已投递` state
5. Implement capability-level health checks (`search`, `detail`, `apply`, `chat`, `resume`)
6. Final validation: developer's own account in production, supervised

Note: attachment-resume upload path is **deferred**. V1 uses the user's platform-stored resume or online resume for 拉勾. The tailored-attachment path may be revisited in V2 if user demand validates the overhead.

**Verification:**

- [ ] Mock mode: apply and dedup checks pass against mock server
- [ ] Live-read mode (staging): keyword search returns real roles and detail-route resolution works
- [ ] Production validation (human-supervised): browser apply succeeds on developer's own account
- [ ] Production validation (human-supervised): second apply to same role is correctly blocked by dedup logic
- [ ] No material generation skills dispatched (passthrough confirmed)
- [ ] Session expiry detected within 2 health check cycles

**Done Definition:** 拉勾 pipeline works end-to-end for `search + detail + apply` using `passthrough` mode.

---

### M11: Handoff Center & Platform Coverage UI

**Goal:** Full UI for handoff management and platform monitoring.

**Tasks:**

1. Build Handoff Center page (list, detail panel, takeover flow)
2. Implement handoff lifecycle states in UI (awaiting → handling → resolved)
3. Implement suggested reply display and copy
4. Build full Platform Coverage page (all platforms, status, reconnect)
5. Implement `/api/ui/handoffs` with filtering
6. Implement `/api/ui/platforms`

**Verification:**

- [ ] Handoff Center shows all pending items sorted by urgency
- [ ] User can take over, resolve, close handoff items
- [ ] Platform Coverage shows all Tier 1 platforms with correct status
- [ ] Reconnect flow works for expired sessions

**Done Definition:** User can browse, take over, and resolve handoff items; platform coverage is visible and actionable.

---

### M12: Billing UI & Plan Enforcement

**Goal:** Users can see their plan, usage, and the system enforces limits.

**Tasks:**

1. Implement `/api/ui/plan` with live computed balance
2. Build Plan & Billing page (current plan, usage, refresh timing)
3. Implement plan indicator in AppShell
4. Implement upgrade path UI (plan comparison)
5. Verify forced pause on runtime exhaustion works end-to-end with UI feedback

**Verification:**

- [ ] Plan page shows current tier and live runtime balance
- [ ] AppShell shows lightweight usage indicator
- [ ] Forced pause triggers when balance depletes (with correct UI state)
- [ ] Upgrade path is visible

**Done Definition:** User can see plan, usage, and the system enforces runtime limits with correct UI feedback.

---

### M13: Settings, Review & Polish

**Goal:** All remaining UI surfaces and quality polish.

**Tasks:**

1. Build Settings & Preferences page
2. Implement `/api/ui/settings` and `PATCH /api/settings/preferences`
3. Build Review & Summary page (basic version)
4. Live feed quality: ensure all pipeline actions produce readable TimelineEvents
5. Error handling: all business error codes have correct frontend treatment
6. Empty states: all pages handle zero-data gracefully
7. Paused state: all pages render correctly when team is paused

**Verification:**

- [ ] Settings save and sync to Team entity
- [ ] Review page shows activity summary for past 7 days
- [ ] No blank/broken pages in any state (active, paused, empty)
- [ ] All error codes produce correct toast/modal/redirect

**Done Definition:** All UI surfaces work in all states (active, paused, empty); settings persist; review shows meaningful summary.

---

### M14: Launch Readiness

**Goal:** System is production-ready and safe to launch.

**Tasks:**

1. Security audit: RLS verification across all tables, secrets audit, session handling review
2. Load test: simulate 100 concurrent teams with 10 active executions per minute
3. Set up monitoring dashboards (Grafana/Sentry): API latency, error rates, orchestration health, platform failure rates
4. Configure alerting: forced pause events, platform failure spikes, billing exhaustion, error rate threshold
5. Test backup and recovery (Supabase point-in-time recovery)
6. Implement feature flags for per-platform enable/disable
7. Implement system-wide kill switch (emergency full pause)
8. Finalize privacy policy, terms of service, cookie consent
9. Write incident runbook for top 5 scenarios
10. Define on-call rotation

**Verification:**

- [ ] RLS audit passes: user A cannot see user B's data across all 20+ tables
- [ ] Load test completes without errors
- [ ] Monitoring dashboards showing real data
- [ ] Alerts fire correctly on simulated incidents
- [ ] Backup restore tested successfully
- [ ] Feature flags toggle platforms on/off without deploy
- [ ] Kill switch pauses all active teams within 30 seconds

**Done Definition:** System passes security audit, survives load test, has monitoring, and has operational runbooks.

---

## Dependency Graph

Exact match to milestone table dependencies:

```
M0
├──→ M1 (auth/onboarding)
│     └──→ M6 (Team Home + Opp Workspace, also needs M5)
│
├──→ M2 (platform auth)
│     ├──→ M8 (LinkedIn, also needs M5)
│     ├──→ M9 (智联, also needs M5)
│     └──→ M10 (拉勾, also needs M5)
│
└──→ M3 (orchestration + billing core)
      └──→ M4 (handoff core)
            └──→ M5 (Greenhouse pipeline)
                  ├──→ M6 (also needs M1)
                  ├──→ M7 (Lever)
                  ├──→ M8 (also needs M2)
                  ├──→ M9 (also needs M2)
                  └──→ M10 (also needs M2)

M4 + M6 + M8 ──→ M11 (handoff/platform UI)
M3 + M6 ──→ M12 (billing UI)
M11 + M12 ──→ M13 (settings/polish)
M13 ──→ M14 (launch)
```

**Critical path:** M0 → M3 → M4 → M5 → M8 → M11 → M13 → M14

**Parallel tracks:**
- Track A (Frontend): M0 → M1 (can start immediately alongside M2/M3)
- Track B (Backend): M0 → M3 → M4 → M5
- Track C (Platform): M0 → M2 (parallel to M3)
- After M5: M7, M8, M9, M10 can run in parallel
- After M6 is ready: M11, M12 can run in parallel

---

## Development Governance

### Spec Compliance Rule

All implementation must conform to the locked specs. If a spec is wrong or incomplete, the spec must be updated FIRST before implementation diverges.

Process:
1. Developer identifies spec issue
2. Spec is updated with the fix
3. Cross-spec impacts are checked
4. Implementation proceeds per updated spec

### State Machine Enforcement

Every state transition in the system must be validated against the state machines in `DATA_MODEL_SPEC.md`. No ad-hoc state changes.

Implementation:
- Create a shared `validateTransition(entity, currentState, targetState)` function
- All state update operations must call this function
- Invalid transitions throw a typed error, never silently succeed

### Enum Discipline

All enums used in code must be imported from a single source-of-truth module that mirrors `DATA_MODEL_SPEC.md` canonical enumerations. No inline string literals for enum values in business logic.

### API Contract Compliance

Every API endpoint must return the exact shapes defined in `BACKEND_API_AND_ARCHITECTURE_SPEC.md`. Frontend must consume the exact shapes defined in `FRONTEND_INTERFACE_SPEC.md`.

Testing: each endpoint has a contract test that validates response shape against the TypeScript type.

### RLS Verification

Every new table or policy change must be verified with a test that:
1. Creates data as User A
2. Attempts to read as User B
3. Verifies User B cannot access User A's data

### Timeline Event Discipline

Every meaningful state change must produce a `TimelineEvent`. The live feed is how the user knows the team is working. Silently changing state without events breaks the product promise.

---

## AI Collaboration Boundaries

### Claude Code Role

Claude Code is the primary implementation agent. It:

- Writes all production code
- Writes all tests
- Reads and follows specs
- Creates migrations
- Builds frontend components
- Implements API endpoints

### Codex Role

Codex provides independent review. It:

- Reviews code changes for bugs, security issues, and spec compliance
- Challenges architectural decisions
- Catches what Claude Code might miss

### Collaboration Protocol

For each milestone:

1. **Claude writes** the implementation
2. **Codex reviews** the implementation (focus: bugs, security, spec compliance)
3. **Claude fixes** based on Codex feedback
4. **Codex re-reviews** (verify fixes, find new issues)
5. **Human reviews** the final result and approves

For critical modules (orchestration engine, platform executors, billing):

- 3 rounds of Claude-Codex review (same as spec writing process)
- Human approval required before merge

For standard modules (CRUD endpoints, UI components):

- 1-2 rounds of Claude-Codex review
- Human approval on sample basis

### What AI Must Not Do

1. **Never bypass spec constraints** — if a spec seems wrong, flag it, don't work around it
2. **Never store secrets in code** — use environment variables and Vault
3. **Never commit with failing tests** — fix the test or fix the code
4. **Never create database migrations that drop columns or tables without explicit human approval**
5. **Never make destructive git operations** (force push, hard reset) without explicit human approval
6. **Never submit applications that could reach a real hiring manager in development.** ATS testing (Greenhouse/Lever) may use clearly-marked test submissions to open-source company boards where the application is identifiable as a test. LinkedIn/Chinese platform testing in development must use mock mode only — live-read mode (discovery without submission) is allowed in staging.
7. **Never store real user credentials in development databases**
8. **Never access production database directly** — use staging for testing
9. **Never include decrypted session tokens, raw PII, or Vault secrets in LLM prompts or logs**
10. **Never send real messages on LinkedIn/Boss直聘/etc. during development** unless an explicit human-supervised platform research pass is being run on the operator's own account and the action is intentionally recorded as a live experiment

### What AI Should Proactively Do

1. **Flag spec inconsistencies** when discovered during implementation
2. **Write tests** for every new function, endpoint, and state transition
3. **Add TimelineEvents** for every meaningful state change
4. **Validate state transitions** against state machines
5. **Check RLS** on every new query
6. **Log decisions** when making non-obvious implementation choices

---

## Verification Strategy

### Test Pyramid

| Layer | What | Framework | Coverage Target |
|---|---|---|---|
| Unit | State machines, transformations, business logic | Vitest | 90%+ |
| Integration | API endpoints, DB operations, RLS | Vitest + Supabase local | 80%+ |
| E2E | Critical user flows (onboarding, pipeline, handoff) | Playwright | Key flows |
| Contract | API response shapes match TypeScript types | Vitest | 100% of endpoints |
| Platform | Platform executor smoke tests against real platforms | Custom | Per-platform |

### Critical Test Scenarios

1. **Onboarding flow**: signup → resume upload → parse → questions → activation → readiness
2. **Pipeline flow**: team start → discover → screen → materials → submit → record
3. **Handoff flow**: boundary detected → handoff created → user takes over → resolution
4. **Pause/resume**: team pause → tasks normalize → resume → tasks re-dispatch
5. **Billing enforcement**: runtime depletes → forced pause → allocation → resume
6. **RLS isolation**: user A data invisible to user B across all tables
7. **State machine enforcement**: illegal transitions rejected with correct error codes

### Platform Testing

Each platform executor must have:

1. **Mock mode** (CI): executor operates against a local mock server that simulates platform responses. All CI tests use mock mode.
2. **Live-read mode** (staging): executor can discover/read real job listings but does NOT submit applications or send messages. Used for validating discovery and form detection.
3. **Live mode** (production): full execution against real platforms with real user session.

Chinese-platform clarification:

- `live-read mode` is sufficient for:
  - search verification
  - detail-route discovery
  - resume-center verification
- `human-supervised live mode` is required for:
  - real apply confirmation
  - real first-touch confirmation
  - any message-send experiment
- platform validation should be recorded per capability, not as a binary platform pass/fail

Note: Most platforms (LinkedIn, Boss直聘, 猎聘, 智联) do not provide sandbox/staging environments. "Sandbox mode" is not available. Mock mode must faithfully simulate platform behavior including CAPTCHA triggers, rate limits, and session expiry. Live-read mode provides a safe middle ground for integration testing without side effects.

For ATS platforms (Greenhouse, Lever): test submissions can target open-source company boards with throwaway test applications (clearly marked as test in cover letter).

---

## Environment Configuration

### Environment Variables

| Variable | Description | Required | Scope |
|---|---|---|---|
| `SUPABASE_URL` | Supabase project URL | Yes | All |
| `SUPABASE_ANON_KEY` | Supabase anon key (frontend) | Yes | Frontend |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (backend) | Yes | Backend + Worker |
| `DATABASE_URL` | Direct Postgres connection string | Yes | Worker |
| `ANTHROPIC_API_KEY` | Claude API key for skill execution | Yes | Backend only |
| `FLY_API_TOKEN` | Fly.io deployment token | Yes | CI/CD |
| `EXTENSION_AUTH_SECRET` | Shared secret for browser extension → backend communication | Yes | Backend + Extension |
| `BROWSER_PROFILE_ENCRYPTION_KEY` | Key for encrypting persistent browser profiles on worker disk | Yes | Worker only |
| `SENTRY_DSN` | Error monitoring endpoint | Yes | All |
| `GRAFANA_API_KEY` | Monitoring dashboard access | Optional | Ops |

Note: Supabase Vault handles session token encryption internally — no separate `ENCRYPTION_KEY` env var needed. Vault is configured via Supabase dashboard, not environment variables.

### Environment Separation

| Environment | Purpose | Data | Platform Mode |
|---|---|---|---|
| `local` | Developer machine | Mock data, local Supabase | Mock only |
| `staging` | Pre-production testing | Synthetic test data, staging Supabase | Live-read (discovery only, no submissions) |
| `production` | Live users | Real data, production Supabase | Full live execution |

### Secrets Rules

1. **Never commit secrets to git** — use `.env.local` (gitignored) for local development
2. **Production secrets** stored in Fly.io secrets and Supabase dashboard
3. **API keys** rotate quarterly at minimum
4. **Session encryption keys** stored in Supabase Vault, never in environment variables directly
5. **Platform session tokens** encrypted at rest in Vault — never in application logs
6. **Database connection strings** never exposed to frontend

### Sensitive Data Checklist

| Data Type | Storage | Encryption | API Exposure |
|---|---|---|---|
| User passwords | Never (OAuth only) | N/A | Never |
| Platform session tokens | Supabase Vault | AES-256 | Never |
| Resume files | Supabase Storage (private bucket) | At rest | Signed URLs only |
| Conversation messages | PostgreSQL | At rest | Via RLS-scoped API |
| API keys (Anthropic, etc.) | Fly.io secrets / Supabase secrets | At rest | Never |
| User email/phone | PostgreSQL | At rest | Via RLS-scoped API |

---

## Completion Definition

### What "V1 Complete" Means

V1 is complete when:

1. A user can sign up, upload a resume, and activate a team
2. The team autonomously discovers, screens, and submits applications on at least Greenhouse and Lever using the `full_tailored` pipeline (resume tailoring + cover letter + submission)
3. LinkedIn Easy Apply works in supervised mode with the `full_tailored` pipeline
4. At least two Chinese platforms work using the `passthrough` pipeline (original resume, no tailoring):
   - 智联招聘 in `search + detail + apply`
   - 拉勾 in `search + detail + apply`
5. The region pipeline split is correctly enforced: `global_english` → `full_tailored`, `china` → `passthrough`
6. The handoff system correctly detects boundaries and creates takeover items
7. The billing system tracks runtime and enforces plan limits
8. All API endpoints return spec-compliant responses
9. RLS prevents cross-user data access
10. The live feed shows meaningful agent activity
11. The system degrades gracefully when a platform is unavailable

### What "V1 Complete" Does NOT Mean

- All Tier 1 platforms are production-stable (LinkedIn may require periodic manual intervention; Chinese platforms may have variable session reliability)
- Chinese platforms support per-application resume tailoring (V1 uses `passthrough` — original resume only. Tailored attachment upload for Chinese platforms is a potential V2 feature)
- The review page is fully built (may be minimal)
- Specialist agents exist (v2 feature)
- WeChat login works (v1 uses Google/GitHub only)
- The browser extension for cookie export is polished (may be manual/MVP in v1)
- Email outreach works (v2 feature)
- Boss直聘 works autonomously (V1.1 at best, supervised mode)
- 51Job is in the active rollout (it is intentionally deferred)

---

## Launch Checklist

### Pre-Launch

- [ ] All M0-M13 milestones verified
- [ ] Security audit completed (RLS, secrets, session handling)
- [ ] Load test: 100 concurrent teams, 10 active per minute
- [ ] Monitoring dashboards operational (API latency, error rates, orchestration health)
- [ ] Alerting configured (forced pause events, platform failure spikes, billing exhaustion)
- [ ] Backup and recovery tested (database point-in-time recovery)
- [ ] Privacy policy and terms of service reviewed
- [ ] Cookie consent and data handling disclosure in place
- [ ] Platform rate limits validated against real platforms (not just estimates)

### Day-1 Operations

- [ ] On-call rotation defined
- [ ] Runbook for common incidents (platform auth failure, orchestration stall, billing error)
- [ ] User support channel operational
- [ ] Feature flags for per-platform enable/disable
- [ ] Kill switch for emergency full-system pause

---

## What This Spec Does Not Define

- Detailed per-platform executor implementation steps (handled during M4-M9)
- Specific UI component styling (handled by design system during implementation)
- Marketing, pricing page content, or acquisition strategy
- Mobile app or native client (v1 is web-only)
- Advanced analytics or ML-based optimization

## Final Governance Principle

Speed matters, but trust matters more.

A system that sends one wrong message to an employer or exposes one user's data to another user destroys more value than a week of delayed features.

When in doubt: slow down, verify, and ship less with higher confidence.
