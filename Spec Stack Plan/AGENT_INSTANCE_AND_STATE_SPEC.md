# Agent Instance And State Spec

## Document Purpose

This document defines how core agent templates become user-visible, team-bound instances, and how those instances persist, change, and move through lifecycle and runtime states.

It answers:

- when agent instances are created
- how they are bound to user and team
- which identity elements are fixed
- which fields persist over time
- which fields are runtime-only
- how agent state changes
- how pause, resume, handoff, platform issues, and plan limits affect instances
- how tasks are attached to agent instances

This document defines:

`instance generation, persistence, runtime state, lifecycle, and task-state behavior`

It does not define full skill packs or prompt internals.

## Relationship To Earlier Specs

This document builds on:

- `AGENT_TEMPLATE_SPEC.md`
- `PRODUCT_FLOWS.md`
- `UI_SURFACE_SPEC.md`
- `FRONTEND_INTERFACE_SPEC.md`

Those documents define:

- the stable 7 agent templates
- the product lifecycle and handoff model
- the UI surfaces that expose those agents
- the frontend state and interface contracts

This document defines:

`how one stable 7-agent team actually exists and behaves for one real user team`

## User-Team Binding Principle

Current product assumption:

`one user has one team`

Therefore:

- each user owns exactly one active team context in v1
- the 7 core agent instances are created under that team
- because the team is user-owned and 1:1 with the user, the agents are effectively long-lived personal team members for that user

Future versions may allow multiple teams per user, but v1 should model agent instances as:

`team-scoped instances under a user-owned single team`

## Instance Creation Moment

Core agent instances should not be created at raw account signup.

They should be created when:

- onboarding has progressed enough to form a real team
- the user reaches team activation

Recommended creation point:

`create the 7 core agent instances when onboarding is completed and team activation is entered`

This preserves the product meaning:

- signup does not equal team ownership
- activation is the moment the team becomes real

## Execution Readiness Rule

Team activation and execution readiness are not the same thing.

Recommended rule:

- agent instances are created when activation is entered and confirmed
- team may still remain non-operational after activation
- `Execution Readiness` determines whether the team can safely begin live execution

That means:

- activation creates the team
- readiness unlocks live work
- `Start Team` should only succeed when minimum readiness is satisfied

## Persona Permanence Rule

Once an agent instance is generated for a team:

- its persona name is fixed
- its persona presentation is fixed
- its role title is fixed by template
- the user may not rename it
- the user may not change its gender presentation
- the user may not edit its persona identity

This supports long-term continuity and emotional team identity.

## Instance Model Principle

Each agent instance should have:

1. stable identity
2. stable template reference
3. stable team membership
4. changing lifecycle state
5. changing runtime state
6. task-level context
7. auditable state transitions

## Core Instance Object

Recommended conceptual model:

```ts
type AgentInstance = {
  id: string
  team_id: string
  template_role_code: string
  template_version: string
  role_title_zh: string
  persona_name: string
  persona_portrait_ref?: string
  lifecycle_state: AgentLifecycleState
  runtime_state: AgentRuntimeState
  persistent_status: AgentPersistentStatus
  stats: AgentInstanceStats
  capability_flags?: Record<string, boolean>
  entitlement_scope?: Record<string, boolean>
  current_context?: AgentCurrentContext
  health_status?: "healthy" | "degraded" | "unstable"
  created_at: string
  initialized_at?: string
  activated_at?: string
  archived_at?: string
}
```

## Persistent Status Layers

Each agent instance should persist at least the following 9 layers of information.

## 1. Identity Layer

- `id`
- `team_id`
- `template_role_code`
- `role_title_zh`
- `persona_name`
- `persona_portrait_ref`

## 2. Lifecycle Layer

- `created_at`
- `initialized_at`
- `activated_at`
- `archived_at`
- `lifecycle_state`

## 3. Runtime Statistics Layer

- `total_active_runtime_seconds`
- `total_tasks_completed`
- `total_handoffs_triggered`
- `total_blocked_count`

## 4. Current Work Context Summary

- `current_assignment_id`
- `current_assignment_type`
- `last_active_at`
- `last_completed_at`

## 5. Version Layer

- `template_version`
- `skill_bundle_version` if applicable
- `prompt_profile_version` if applicable

## 6. Authorization And Availability Layer

- platform-dependent availability flags
- entitlement-dependent availability flags
- whether required external access exists
- execution readiness status
- submission profile readiness status

## 7. Capability Flag Layer

- enabled or disabled optional abilities
- feature flags tied to plan or rollout

## 8. Recent Error And Block Summary

- `last_block_reason_code`
- `last_blocked_at`
- `last_recovery_at`

## 9. User-Facing Persona Summary Layer

- short public summary
- card tagline
- default role summary for UI

## Lifecycle States

Lifecycle states should describe the long-lived existence stage of an agent instance.

### V1 Main Lifecycle States

- `created`
- `initialized`
- `ready`
- `activated`
- `running`
- `paused`
- `archived`

### Reserved Lifecycle States

- `provisioning`
- `suspended`
- `retired`

## Lifecycle State Definitions

### `created`

The instance record exists but is not yet fully initialized.

### `initialized`

Persona identity and core configuration are assigned.

### `ready`

The instance is fully formed and available to join the team, but runtime may not have started.

### `activated`

The instance belongs to a team that has passed activation confirmation.

### `running`

The team has been started and the instance may participate in live operations.

### `paused`

The team is paused and the instance is not currently participating in automatic execution.

### `archived`

The instance is preserved historically but not used for live operations.

### Reserved Meanings

- `provisioning`: pre-initialized setup work
- `suspended`: system-forced non-user pause state
- `retired`: old instance version no longer in live use

## Lifecycle Versus Runtime Precedence Rule

Lifecycle state and runtime state serve different purposes and must not be treated as interchangeable.

- `lifecycle_state` answers:
  - does this instance exist
  - has it been initialized
  - is it part of an activated team
  - is it historically archived
- `runtime_state` answers:
  - what is this instance doing right now
  - can it currently act
  - is it paused, blocked, active, or waiting

Recommended precedence rule:

- existence, archival, and long-lived eligibility are governed by `lifecycle_state`
- live UI posture, orchestration decisions, and operational rendering are governed by `runtime_state`
- if `lifecycle_state = archived`, runtime should no longer be treated as live regardless of any stale runtime value
- if lifecycle permits live participation, `runtime_state` is the operative state for UI and orchestration

## Runtime States

Runtime states describe the live operating state of the agent instance.

### V1 Main Runtime States

- `sleeping`
- `ready`
- `active`
- `waiting`
- `blocked`
- `paused`
- `handoff`
- `completed`

### Reserved Runtime States

- `initializing`
- `degraded`
- `archived`

## Runtime State Definitions

### `sleeping`

The agent is not currently awakened for active work.

### `ready`

The agent is available to be awakened by orchestration.

### `active`

The agent is currently executing one or more live tasks.

### `waiting`

The agent is waiting for dependency resolution, reply, upstream output, or next instruction.

### `blocked`

The agent cannot continue because of a meaningful blocker.

Examples:

- missing session
- missing material
- missing upstream decision
- platform execution failure

### `paused`

The team is paused, so the agent is paused as a consequence.

### `handoff`

The role has reached a handoff-related state and is no longer continuing representative progression for that case.

### `completed`

The current assignment cycle has completed and the agent can later return to `sleeping` or `ready`.

### Reserved Meanings

- `initializing`: short-lived warm-up state
- `degraded`: still running but with reduced capability
- `archived`: runtime history only, not live execution

## Dominant Runtime State Derivation Rule

Because one agent instance may hold multiple assignments at once, the system should derive one dominant runtime state for the instance.

Recommended precedence:

1. `paused`
2. `blocked`
3. `active`
4. `handoff`
5. `waiting`
6. `ready`
7. `sleeping`
8. `completed`

Interpretation rule:

- `paused` always wins when the team is paused
- `blocked` wins over `active` only when the blocker prevents meaningful forward execution across the instance's dominant work posture
- `active` should be used when at least one materially progressing assignment is executing
- `handoff` should only become the dominant runtime state when the instance's current primary representative task has reached handoff and no higher-priority active execution remains
- `completed` should usually be transitional and should not dominate over live work

## Runtime State Machine Rule

The document should define a lightweight state machine:

1. state meaning
2. legal transitions
3. trigger source
4. global team rules

It should not attempt to become a full workflow engine spec.

## Runtime Readiness Gate Rule

An instance may exist and remain valid while still being gated from live execution by team readiness.

Recommended rule:

- before readiness is satisfied, instances may remain `sleeping`
- `Start Team` should not promote instances into live-ready execution posture until readiness blockers are cleared
- readiness is a team-level gate, not an instance recreation event

## Recommended Legal Runtime Transitions

Typical allowed transitions include:

- `sleeping -> ready`
- `ready -> active`
- `active -> waiting`
- `active -> blocked`
- `active -> handoff`
- `active -> completed`
- `waiting -> active`
- `waiting -> blocked`
- `blocked -> ready`
- `completed -> sleeping`
- `completed -> ready`
- `any live state -> paused`
- `paused -> ready`

## Illegal Or Discouraged Transitions

Examples:

- `sleeping -> blocked` without a triggered task
- `paused -> active` without orchestration restart
- `handoff -> active` for the same representative task without re-dispatch

## Runtime Trigger Sources

Runtime state changes may be triggered by:

- `调度官`
- user action
- platform event
- upstream role completion
- downstream dependency request
- system protection or entitlement event

## Pause Rule

When the user clicks `Pause Team`:

- all agent instances enter runtime state `paused`
- no new automated progression work should start
- current online billable runtime stops accumulating
- historical live feed remains visible
- handoff records remain visible
- opportunity records remain visible

This is a runtime stop, not a history deletion event.

## Pause Origin Rule

The system should distinguish why a pause happened, even if the runtime effect is similar.

Recommended field:

`pause_origin: "user" | "system_entitlement" | "system_safety" | "system_admin"`

Recommended interpretation:

- `user`: user explicitly clicked `Pause Team`
- `system_entitlement`: runtime or plan allocation exhaustion, expired required entitlement
- `system_safety`: system-protection stop caused by abnormal or unsafe conditions
- `system_admin`: internal operator or controlled recovery action

All of the above may result in runtime state `paused`, but the origin should remain auditable and user-visible where relevant.

## Pause Accounting Rule

Team pause must stop runtime billing accumulation.

That means:

- paused time is not counted as active online team runtime
- resumed time starts accumulating again only after the team is restarted

## Resume Rule

When the team resumes from paused state:

- agent instances do not blindly continue from partially active execution states
- unfinished work returns to a re-dispatchable condition
- agents return to re-routable readiness rather than forced half-state continuation
- `调度官` re-evaluates pending tasks and decides what to resume, retry, defer, or drop
- completed work remains completed
- handoff records remain handoff records and do not automatically revert into active representation

## Resume Task Normalization Rule

When the team resumes, unfinished tasks should first normalize into re-dispatchable task states before orchestration decides the next step.

Recommended defaults:

- previously `active` tasks -> `queued`
- previously `waiting_dependency` tasks -> remain `waiting_dependency`
- previously `blocked` tasks -> remain `blocked` until the blocker is cleared
- previously `completed` tasks -> remain `completed`
- previously `failed` tasks -> remain `failed` unless an explicit retry path is chosen
- handoff-related tasks -> remain handoff-bound business records and do not auto-convert back into representative execution

This ensures that resume is a controlled restart, not a blind continuation.

## Forced Pause Rule

The system may also trigger a team-wide pause when required.

Examples:

- runtime or plan allocation exhausted
- critical system safety issue
- required entitlement expired

This should behave similarly to user pause in operational effect, even if the trigger source differs.

In addition:

- forced pause should persist the relevant `pause_origin`
- the frontend should be able to distinguish user pause from entitlement or safety pause
- resume eligibility may differ by origin:
  - user pause may be resumed directly by user action
  - entitlement pause may require additional runtime or plan availability
  - safety pause may require system recovery before resume is allowed

## Team Abandonment Rule

If the user does not return or resume use for a sufficiently long period, the team may be considered dormant or abandoned.

In such cases:

- the team should not be hard-deleted
- agent instances should remain historically preserved
- the team may move into a dormant or archived operational condition

The exact dormancy threshold may be defined later.

Recommended modeling rule:

- `dormant` should be treated as a team-level operational condition, not a new agent runtime state in v1
- if long-term inactivity becomes final historical preservation, agent instances should eventually move to lifecycle state `archived`

## Task Context Model

Agent instances should not only have state.
They should have task context.

Recommended conceptual model:

```ts
type AgentCurrentContext = {
  primary_task_id?: string
  primary_task_type?: string
  task_loop?: "opportunity_generation" | "opportunity_progression"
  related_entity_type?: "opportunity" | "handoff" | "platform" | "material" | "team"
  related_entity_id?: string
  trigger_source?: "orchestrator" | "platform_event" | "user_action" | "timer" | "upstream_completion"
  priority?: "low" | "medium" | "high" | "critical"
  status?: "queued" | "running" | "waiting_dependency" | "blocked" | "completed" | "failed" | "cancelled"
  input_summary?: string
  output_summary?: string
  dependency_summary?: string[]
  boundary_flags?: string[]
  retry_count?: number
  last_retry_at?: string
  fallback_used?: boolean
  queued_at?: string
  started_at?: string
  blocked_at?: string
  completed_at?: string
}
```

## Task Context Layers

At minimum, task context should support these 12 dimensions:

1. current task
2. task input summary
3. task output summary
4. current loop
5. related entity
6. trigger source
7. priority
8. task status
9. dependency summary
10. retry and recovery info
11. boundary flags
12. observable timestamps

## Multi-Task Principle

An agent instance may be associated with more than one live task or opportunity.

This is especially likely for:

- `岗位研究员`
- `投递专员`
- `招聘关系经理`

Therefore:

- one agent should have one primary runtime state
- but may also have multiple active or queued assignments

The primary runtime state should reflect dominant current operating posture, not the full cardinality of every subtask.

## Parallelism Principle

Different roles may support different degrees of parallel work.

Examples:

- `岗位研究员`: high parallelism
- `招聘关系经理`: moderate to high parallelism
- `投递专员`: moderate parallelism
- `简历顾问`: lower parallelism
- `履历分析师`: lower parallelism

This document only defines the principle.
Detailed concurrency limits may be refined later.

## Task Recovery Principle

When work is interrupted, paused, or blocked:

- unfinished tasks should not be silently discarded
- tasks should be either:
  - re-queued
  - left waiting
  - blocked with reason
  - cancelled explicitly

The system should prefer auditable recovery rather than implicit disappearance.

## Handoff Scope Rule

`handoff` is primarily an assignment-level condition and should only become an instance-level dominant runtime state in narrow cases.

Recommended rule:

- handoff should always exist at the business record and assignment level
- an agent instance may surface runtime state `handoff` only when its current primary representative task has entered handoff and there is no higher-priority active work dominating the instance
- this is most likely for `招聘关系经理`
- other roles should rarely use instance-level `handoff` as a dominant posture

## State Transition Audit Rule

Every meaningful agent state transition should be auditable.

At minimum, transition records should capture:

- instance_id
- previous lifecycle state if changed
- previous runtime state if changed
- new state
- trigger source
- related entity if relevant
- reason code if relevant
- timestamp

Recommended conceptual model:

```ts
type AgentStateTransitionRecord = {
  id: string
  agent_instance_id: string
  previous_lifecycle_state?: string
  previous_runtime_state?: string
  new_lifecycle_state?: string
  new_runtime_state?: string
  trigger_source: string
  related_entity_type?: string
  related_entity_id?: string
  reason_code?: string
  created_at: string
}
```

## Statistics Windows

Agent statistics should support at least three windows:

1. `lifetime`
2. `current_run_window`
3. `recent_window`

Examples:

- last 24 hours
- last 7 days

This enables:

- UI metrics
- review summaries
- future performance analysis

## Billing Source Of Truth Rule

Runtime billing must not be derived by summing per-agent runtime counters.

Recommended rule:

- billing source of truth is the `team runtime ledger`
- agent-level runtime stats are for UI, analysis, and review
- if agent-level counters and billing totals ever differ, billing must follow the team runtime ledger

## Agent Stats Model

Recommended conceptual model:

```ts
type AgentInstanceStats = {
  lifetime: AgentStatsWindow
  current_run_window?: AgentStatsWindow
  recent_24h?: AgentStatsWindow
  recent_7d?: AgentStatsWindow
}

type AgentStatsWindow = {
  active_runtime_seconds?: number
  tasks_completed?: number
  handoffs_triggered?: number
  blocked_count?: number
  output_count?: number
}
```

## Version And Entitlement Rule

Agent instances should not drift arbitrarily one by one in v1.

Recommended rule:

- core team instances remain aligned to a consistent team-level version profile
- user plan upgrades may expand entitlement scope
- expanded entitlements may unlock more platforms, longer runtime, or additional capability flags
- but should not replace the core role identities

## Upgrade Effect Rule

If the user upgrades plan:

- the same core 7 agent instances remain
- their entitlement scope may expand
- their available platforms may expand
- their runtime duration may expand

The team becomes more capable, not replaced.

## Reset Rule

The system may support rare internal reset behavior for recovery purposes.

This means:

- clear current broken runtime context
- preserve persona identity
- preserve history
- preserve long-term stats unless explicitly re-derived

This should not be user-facing in v1.

Trigger boundary:

- internal reset may only be triggered by controlled system recovery logic or authorized internal operations
- normal orchestration should not repeatedly use reset as a substitute for task recovery
- reset should be auditable with reason code and operator or system source

## Archive Rule

Agent instances should be archived rather than hard-deleted whenever possible.

This preserves:

- audit history
- lifecycle history
- runtime history
- review integrity

## Health Placeholder

Future versions may support a lightweight health concept such as:

- `healthy`
- `degraded`
- `unstable`

This is not required for v1 behavior, but the field may be reserved.

## Instance Generation Flow

Recommended high-level flow:

1. user completes onboarding questions
2. team activation begins
3. team record exists or is finalized
4. 7 core agent instances are created
5. persona identities are generated and fixed
6. instances move through:
   - `created`
   - `initialized`
   - `ready`
   - `activated`
7. team enters `Execution Readiness`
8. runtime remains non-operating until readiness minimum is satisfied and user explicitly clicks `Start Team`

## Runtime Start Flow

1. user clicks `Start Team`
2. system verifies team-level readiness and submission readiness
3. if readiness fails, runtime does not start
4. if readiness passes, team runtime becomes active
5. lifecycle state may reflect `running`
6. instances move into `ready`
7. `调度官` begins waking specific roles as needed

## Runtime Pause Flow

1. user clicks `Pause Team`
2. team runtime stops
3. all agents move to runtime state `paused`
4. active runtime billing stops
5. history and handoffs remain visible

## Final Instance Principle

An agent instance is not just a UI card.
It is a persistent member of the user’s team with:

- fixed identity
- stable role template
- long-lived history
- changing operational state
- auditable task context

The system should preserve that continuity so the team feels like a real, ongoing operating unit rather than a fresh set of stateless helpers on every page load.
