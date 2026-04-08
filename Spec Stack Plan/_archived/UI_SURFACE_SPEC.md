# UI Surface Spec

## Document Purpose

This document defines the major UI surfaces of Haitou OS and the responsibility of each surface.

Its purpose is to answer:

- which pages should exist in v1
- which pages should exist as light but explicit workspaces
- what each page is responsible for showing
- what user question each page should answer
- how pages differ so they do not collapse into one another

This is not a visual prompt brief and not a component-level design spec.
It is a page-responsibility spec for product, design, and implementation alignment.

## Relationship To Earlier Specs

This document builds on:

- `PRD_FIRST_PRINCIPLES.md`
- `BUSINESS_REQUIREMENTS_FIRST_PRINCIPLES.md`
- `PRODUCT_FLOWS.md`
- `UI_GENERATION_BRIEF.md`

Those earlier documents define:

- what Haitou OS fundamentally is
- the automation boundaries
- the product lifecycle
- the visual and narrative direction

This document defines:

`What pages and workspaces the user actually sees, and what each one must do.`

## Core Principle

Pages must be organized by user meaning, not by internal implementation modules.

The UI should not expose the product as a pile of agent subsystems.
It should expose the product as a coherent team-based service.

That means page structure should follow user-facing questions such as:

- what is this product
- how do I enter
- how do I activate my team
- is my team working
- what opportunities are being advanced
- when do I need to take over
- what platforms are covered
- what plan and runtime resources do I have
- how is the team performing over time

## Surface Planning Rule

For v1, the product should include:

- core entry pages
- core activation pages
- a primary logged-in home
- a small number of explicit workspaces

It should not explode into too many first-level pages.

The page system should feel:

- focused
- team-oriented
- easy to understand
- not over-modularized

## Surface Hierarchy

The UI surface hierarchy should be:

1. Entry surfaces
2. Activation surfaces
3. Primary operating surfaces
4. Supporting workspaces
5. Account and plan surfaces

## V1 Surface List

The recommended v1 and near-v1 page set is:

1. `Landing Page`
2. `Login Entry`
3. `Onboarding`
4. `Team Activation`
5. `Execution Readiness`
6. `Team Home`
7. `Opportunity Workspace`
8. `Handoff Center`
9. `Platform Coverage`
10. `Plan & Billing`
11. `Settings & Preferences`
12. `Review & Summary`

In addition, the product should support light detail surfaces rather than too many extra standalone pages:

- `Opportunity Detail`
- `Agent Detail / Agent Workspace`

## Delivery Priority

Not all listed surfaces need the same delivery priority.

The recommended implementation order is:

### Must-Have For V1

- `Landing Page`
- `Login Entry`
- `Onboarding`
- `Team Activation`
- `Execution Readiness`
- `Team Home`
- `Opportunity Workspace`
- `Handoff Center`
- `Platform Coverage`
- `Plan & Billing`

### Should-Have In V1 If Scope Allows

- `Settings & Preferences`
- `Opportunity Detail`
- `Agent Detail / Agent Workspace`

### Light Or Near-V1

- `Review & Summary`

If implementation pressure rises, the product should protect:

1. team entry and activation
2. Execution Readiness
3. Team Home
4. Opportunity Workspace
5. Handoff Center
6. Platform and plan visibility

## Cross-Surface Control Rule

The product should have one top-level team runtime control:

`Start Team / Pause Team`

This control should:

- apply to the whole team
- live in a consistent top-level location, preferably the logged-in top-right control area
- pause new automated activity without deleting historical state

When paused:

- logs remain visible
- opportunities remain visible
- handoff items remain visible
- previous work remains visible
- the UI clearly indicates paused state

The page should remain readable and navigable while paused.

## Global App Shell

All logged-in pages should inherit from one coherent application shell.

The shell should prevent pages from feeling like separate tools.

### Shell Responsibilities

The global shell should provide:

- product identity
- top-level navigation
- team runtime control
- team runtime state visibility
- lightweight plan or runtime resource visibility
- entry into account and preferences

### Recommended Top Bar Elements

The logged-in top bar should consistently support:

- brand
- primary navigation
- `Start Team / Pause Team`
- current team state
- lightweight plan or runtime indicator
- account entry

### Resource Visibility Rule

The shell may include a lightweight indicator of:

- remaining runtime
- credit or capacity usage
- refresh timing
- approaching limits

Detailed usage remains inside `Plan & Billing`, but the shell should preserve ambient awareness.

### Paused State Rule

When the team is paused, the shell should clearly indicate:

- team paused
- automation is not currently advancing
- historical context is still available

This indicator should be calm but unmistakable.

### Action Bar Rule

Pages may optionally use a lightweight floating or anchored action zone when the page benefits from a focused operating action model.

However, the main runtime control should still remain consistent at shell level rather than moving from page to page.

## 5. Execution Readiness

## Responsibility

This surface is responsible for turning a newly activated team into an actually runnable team.

It should answer:

`What still needs to be completed before my team can safely start working?`

## Page Role

This is a guided readiness surface.
It is not a generic settings page and not a second onboarding.

It should feel like:

- a calm launch checklist
- a setup overlay or guided workspace
- the final preparation layer before `Start Team`

## Must Communicate

- the team has already been created
- execution cannot begin until minimum readiness is satisfied
- missing items are concrete and fixable
- platform connections and submission profile completeness directly affect execution readiness

## Core Modules

- `Submission Profile Readiness`
- `Platform Connection Readiness`
- `Default Materials Readiness`
- `Start Team Eligibility`

## Submission Profile Readiness

This module should help the user complete the minimum structured execution information that is not guaranteed to exist inside the resume itself.

Examples:

- phone
- contact email
- current city or country
- work authorization if relevant
- relocation posture
- compensation preference when needed
- external links if relevant

## Platform Connection Readiness

This module should help the user understand:

- which platforms are currently connected
- which platforms are recommended
- which platforms are unavailable under current plan
- which platforms block automatic execution until connected

## Start Eligibility Rule

`Start Team` should not become the primary way to discover missing execution requirements.

Instead:

- readiness surface should surface blockers in advance
- once minimum readiness is satisfied, `Start Team` becomes available
- non-blocking fields may still be completed later as opportunity-specific needs appear

## UX Shape

Recommended shape:

- step-by-step checklist
- progress cards
- expandable setup tasks
- calm launch framing rather than heavy form framing

## 1. Landing Page

## Responsibility

The landing page is responsible for helping the user understand the product subject and move toward entry.

It should answer:

`What is Haitou OS, and why is it different from a normal job-search tool?`

## Page Role

This is a product-entry and conversion surface.
It is not a feature documentation hub.

## Must Communicate

- this is an AI job operations team
- the user is not acting alone
- the team works continuously
- the product covers team-scale execution, not isolated utilities

## Primary Content

- hero statement
- main CTA
- team visual
- light product demo preview
- secondary narrative sections
- platform logo wall
- pricing preview
- FAQ

## Must Not Become

- a heavy navigation marketing site
- a long technical documentation page
- a generic AI product homepage

## 2. Login Entry

## Responsibility

The login entry is responsible only for getting the user into the product with minimal friction.

It should answer:

`How do I enter my team workspace quickly?`

## Page Role

This is a lightweight access surface.
It is not a major independent product destination.

## Primary Content

- lightweight OAuth entry
- minimal sign-in choices
- clear route into the app

## Must Not Become

- a heavy account hub
- a multi-step identity workflow
- a central brand page

## 3. Onboarding

## Responsibility

Onboarding is responsible for collecting the minimum high-value information needed to let the team operate safely and meaningfully.

It should answer:

`What does the system need to know before my team can begin?`

## Page Role

This is a guided setup surface inside a larger team-formation experience.

## Must Capture

- resume or equivalent profile input
- target locations
- work mode
- salary preference if available
- strategy mode
- coverage scope
- additional follow-up constraints when cross-market logic requires them

## Interaction Model

- one coherent visual scene
- step-by-step progression
- choice cards first
- input fields when needed

## Must Not Become

- a long settings form
- a chat-only setup flow
- a bureaucratic intake process

## 4. Team Activation

## Responsibility

Team activation is responsible for turning onboarding into a credible "team is now staffed and ready" moment.

It should answer:

`Has my team been formed, and what is it about to do?`

## Page Role

This is a ceremonial but functional transition surface.
It should create confidence and readiness.

## Must Show

- the 7-member team assembling
- what the system understood
- what the team will focus on first
- what the product will do automatically
- when the user will be interrupted

## Activation Output

After activation, the user should feel:

- the team exists
- the team has a direction
- the team is ready to start operating

## Must Not Become

- another long approval stage
- a technical summary screen
- a permissions center

## 5. Team Home

## Responsibility

Team Home is the primary logged-in workspace.

It is responsible for showing the user that the team is present, active, and continuously working.

It should answer:

`Is my team working right now, and what is it doing for me?`

## Page Role

This is the team-centered command view.
It is not the full opportunity management view.

## Page Priority

The top priority of this page is:

`My team is working.`

Everything else is subordinate to that.

## Primary Structure

The page should have four main regions:

1. `Team Presence`
- visible agent formation
- current runtime state
- clear sense of staffed presence

2. `Live Feed`
- structured action timeline
- who did what
- when it happened
- what result it produced
- light indication of which agent handed work to the next

3. `High-Value Opportunities`
- summary view of key opportunities currently being advanced

4. `Needs Your Takeover`
- summary of items that require user action

## Live Feed Rule

The live feed should not be a raw log.

It should be a:

`Structured action timeline with readable agent-led updates.`

Each entry should ideally include:

- agent identity
- time
- action summary
- result
- optional handoff cue to the next agent

## Notification Mapping

Team Home should also act as the default surface for non-blocking progress visibility.

The product's three notification layers should map to surfaces as follows:

1. `Silent background execution`
- not shown as interruptive UI
- may later influence summaries or counts

2. `Informational progress update`
- appears in `Live Feed`
- may appear in summary modules
- does not force user action

3. `Action-required interruption`
- appears in `Needs Your Takeover`
- may raise top-level shell state
- resolves in `Handoff Center`

This rule prevents `Live Feed` from becoming either too noisy or too alarm-oriented.

## Team Home Must Not Do

Team Home must not take on the full responsibility of pipeline management.

It may show opportunity summaries, but it should not become the full opportunity workspace.

## 6. Opportunity Workspace

## Responsibility

Opportunity Workspace is responsible for showing how opportunities are progressing across stages and what the team has done for each one.

It should answer:

`Which opportunities are active, where are they in the process, and how is the team advancing them?`

## Page Role

This is the opportunity-centered operating surface.

It is not the same as Team Home.

## Key Distinction From Team Home

`Team Home` is team-centered.

`Opportunity Workspace` is opportunity-centered.

That distinction must remain clear.

Team Home shows:

- the team at work
- summary of activity
- summary of opportunities

Opportunity Workspace shows:

- the opportunity system itself
- stage progression
- per-opportunity detail
- structured execution context

## Core View Model

This page should use:

`Pipeline logic with hybrid viewing modes`

The recommended default is:

- list-oriented readability
- ability to switch into stage-oriented pipeline view

## What The Pipeline Means

The visible pipeline should represent:

`Opportunity progression stages`

Examples:

- discovered
- screened
- prioritized
- submitted or contacted
- follow-up active
- positive progression
- needs takeover
- closed

This visible pipeline should not expose every internal execution sub-process by default.

## Internal Logic Rule

The product may have deeper internal sub-flows such as:

- platform-specific submission processes
- messaging processes
- agent-to-agent execution chains

But those should not become the default top-level visual model.

The user should see:

1. the main opportunity progression layer first
2. deeper execution detail only when opening an opportunity

## Primary Content

- opportunity list
- stage view or pipeline view
- latest movement
- ownership / agent involvement
- risk or boundary status
- takeover state if relevant

## User Actions

Opportunity Workspace should support meaningful user actions, not only passive reading.

Recommended v1 actions include:

- filter opportunities
- search opportunities
- switch between list and stage-oriented views
- open opportunity detail
- identify high-priority opportunities
- identify takeover-required opportunities
- inspect why an opportunity was closed or deprioritized

If scope allows, it may also support:

- mark as focus or priority
- manually trigger takeover
- jump to related handoff context
- jump to related platform context

## Action Rule

This page should remain primarily an operating and understanding surface.

It should not require the user to manually drive every opportunity.
The UI should preserve the feeling that the team is running the process unless a real boundary is reached.

## Must Not Become

- a pure raw-log explorer
- a technical process graph
- a duplicated version of Team Home

## 7. Opportunity Detail

## Responsibility

Opportunity Detail is responsible for showing the deeper operating story of one opportunity.

It should answer:

`Why was this opportunity chosen, what has the team done, and what happens next?`

## Surface Model

Recommended model:

- default as a right-side detail panel
- expandable into a full standalone page when necessary

v1 should prioritize the side detail panel model.

## Must Show

- core job and company context
- why it was selected
- current stage
- recent actions
- agent collaboration trace
- structured action timeline
- current risk or boundary status
- whether user takeover is needed
- next-step expectation

## Timeline Rule

The opportunity detail timeline should not be raw logs by default.

It should be:

`Structured, readable operating records`

Each event should explain:

- who acted
- what they did
- why it mattered
- what happened next

## Detail Actions

Opportunity Detail may support lightweight user actions such as:

- view deeper context
- move to handoff when needed
- inspect agent participation
- understand closure reason

It should not behave like a raw ATS administration panel.

## 8. Handoff Center

## Responsibility

Handoff Center is responsible for collecting all user-takeover-required situations into one clear workspace.

It should answer:

`What now requires my direct action, and why has the team handed it to me?`

## Page Role

This is not a red alert center and not a bug inbox.

It is a:

`Takeover workspace`

The emotional message should be:

- the team has brought something to a meaningful stage
- the system has organized the context
- the user now needs to handle the human-only step

## Relationship To Team Home

Team Home should contain a handoff summary module.

Handoff Center is the full-page version used when the user wants to work through all takeover items.

## Primary Structure

Recommended structure:

1. `Summary Header`
- total items awaiting takeover
- highest-priority items
- recent additions

2. `Takeover Card List`
- one card per takeover item

3. `Takeover Detail Panel`
- explanation
- context
- suggested next action
- optional draft or summary support

## Default Sorting

The default sort should prioritize urgency.
The page should also support filtering by takeover type.

Examples:

- private contact transfer
- salary confirmation
- interview time confirmation
- work arrangement commitment
- visa or eligibility issue

## Card Requirements

Each takeover card should ideally include:

- company and role
- takeover type
- urgency
- time sensitivity
- agent handoff source
- short summary of why takeover is needed
- direct action entry

## Lifecycle States

Handoff items must support a full lifecycle rather than existing only as open tasks.

Recommended states include:

- `Awaiting takeover`
- `In user handling`
- `Waiting on employer or external party`
- `Resolved`
- `Returned to team`
- `Closed`

## State Rule

When a user handles a takeover item, the system should preserve:

- what was handed off
- when the user engaged
- whether the item is now user-led or has returned to team-led flow

This prevents Handoff Center from degenerating into a one-way notification bucket.

## Must Not Become

- a generic notification inbox
- a raw chat archive
- a red panic board

## 9. Platform Coverage

## Responsibility

Platform Coverage is responsible for showing where the team can operate and what platform capacity is currently available.

It should answer:

`Which platforms can the team use, what markets do they cover, and what is currently available or blocked?`

## Page Role

This is a capability-and-availability workspace.
It is not just a technical integrations page.

## Must Show

- platform list
- region grouping
- Chinese-market and English/global-market coverage
- login or availability state
- restricted / unavailable / pending states
- plan-dependent access where relevant

## Primary States

Platforms may show states such as:

- active
- available but not connected
- pending login
- restricted
- unavailable
- plan-locked

## Must Not Become

- a low-level platform debugging console
- a cluttered integrations gallery
- a replacement for team identity

## 10. Plan & Billing

## Responsibility

Plan & Billing is responsible for showing the commercial tier, current runtime resources, and refresh logic of the user's team.

It should answer:

- what plan do I have
- what team capacity do I currently have left
- when do limits or balances refresh
- what happens if I upgrade

## Page Role

This page is not only a pricing explanation page.
It is also a runtime-capacity page.

## Must Show

- current plan
- plan comparison
- team operating resources
- usage or remaining balance
- refresh timing
- upgrade path

## UI Direction

The page may reference the feeling of:

- Claude usage-limit presentation
- calm rate-limit or balance displays
- modern desktop tooling usage indicators

The surface should feel:

- clean
- calm
- precise
- premium

It should not feel like a noisy fintech ledger.

## Plan Layers

Recommended plan framing:

- `Free`
- `Pro`
- `Plus`

## Must Not Become

- only a receipt history page
- only a comparison table
- a pricing-only marketing page disconnected from runtime reality

## 11. Settings & Preferences

## Responsibility

Settings & Preferences is responsible for maintaining the user's durable constraints and product-level preferences.

It should answer:

`What stable preferences and boundaries should my team operate within?`

## Recommended Scope For v1

v1 should include:

- language
- notifications
- preferred locations
- work mode
- salary preferences
- strategy mode
- coverage scope
- light boundary preferences
- light platform-level preferences where appropriate

## Preference Layering Rule

The product must distinguish between:

1. `Activation-critical inputs`
These are collected during onboarding because the team cannot safely begin without them.

Examples:

- resume baseline
- target locations
- work mode
- strategy mode
- coverage scope

2. `Durable editable preferences`
These live in `Settings & Preferences` and may be revised later without rebuilding the whole onboarding experience.

Examples:

- language
- notifications
- revised salary preference
- adjusted targeting scope
- updated strategy mode
- updated boundary preferences

This prevents onboarding and settings from collapsing into the same page concept.

## Scope Boundary

v1 settings may expose business-understandable controls, but should not expose a broad field of low-level system tuning.

Advanced automation parameters should remain out of the main user settings surface in v1.

## Scope Rule

v1 should not expose too many low-level automation parameters.

The product should avoid becoming a complex automation control console.

Future versions may expand into more advanced controls, but v1 should remain focused on user-comprehensible business preferences.

## Must Not Become

- a system tuning lab
- an internal operations panel
- a wall of agent thresholds and hidden parameters

## 12. Agent Detail / Agent Workspace

## Responsibility

Agent Detail is responsible for showing who an agent is, what they are responsible for, and what they are currently working on.

It should answer:

`Who is this team member, and what are they doing for me?`

## Surface Model

For v1, this should be:

- a lightweight detail panel
- optionally launched from card clicks on Team Home or Opportunity Detail

It should not yet become seven fully independent first-level products.

## Must Show

- persona identity
- role title
- responsibility summary
- current active tasks
- recent actions
- what this agent does in the broader system

## 13. Review & Summary

## Responsibility

Review & Summary is responsible for helping the user understand how the team has performed over a recent window and what should change next.

It should answer:

- what happened recently
- which directions are working
- which directions are weak
- what the team recommends adjusting

## Page Role

This is a light strategic review surface.
It is not yet a deep analytics suite in v1.

## v1 Scope

The first version may be light, but it should still exist as a distinct concept.

It should include:

- summary of recent activity
- high-level performance observations
- possible strategy suggestions
- notable opportunities created

## Navigation Model

The logged-in navigation should remain small and understandable.

The likely top-level destinations should be:

- Team Home
- Opportunities
- Handoffs
- Platforms
- Plan
- Settings

`Review` may appear either as a first-level destination or as a lighter reporting entry depending on navigation constraints.

## Cross-Surface State Matrix

Each major surface should react consistently to shared operating states.

### Team Active

- `Team Home`: team visibly running, feed updating, summaries active
- `Opportunity Workspace`: normal progression visibility
- `Handoff Center`: normal intake and processing
- `Platform Coverage`: normal availability view
- `Plan & Billing`: usage accumulation and refresh information visible

### Team Paused

- `Team Home`: clear paused state, historical feed remains readable
- `Opportunity Workspace`: opportunity history remains visible, no new automation progress implied
- `Handoff Center`: existing handoff items remain actionable
- `Platform Coverage`: status remains inspectable and reconnectable
- `Plan & Billing`: usage and balance remain visible
- `Settings`: still editable

### Takeover Pending

- `Team Home`: summary module and shell state should indicate pending takeover
- `Opportunity Workspace`: affected opportunities show takeover state
- `Handoff Center`: full actionable list

### Platform Limitation Present

- `Team Home`: summary or shell awareness only when meaningful
- `Opportunity Workspace`: affected opportunities may show limited progression
- `Platform Coverage`: this is the primary resolution surface

### Plan Or Runtime Limit Approaching

- `Team Home`: lightweight awareness only
- `Plan & Billing`: primary detail and upgrade guidance
- shell: optional ambient warning state

## Cross-Surface Action Ownership Matrix

To keep page roles clean, each surface should have a clear action model.

### Primarily Read-And-Orient

- `Landing Page`
- `Review & Summary`

### Read, Understand, And Navigate Deeper

- `Team Home`
- `Platform Coverage`
- `Agent Detail`

### Read And Perform Focused User Decisions

- `Handoff Center`
- `Opportunity Detail`
- `Plan & Billing`
- `Settings & Preferences`

### Read, Manage, And Triage

- `Opportunity Workspace`

This matrix should help prevent accidental page overlap.

## Surface Boundary Rules

To avoid page collision, the following boundaries must be preserved:

1. `Team Home` is about team presence and live activity.
It is not the full opportunity manager.

2. `Opportunity Workspace` is about opportunity progression.
It is not the general team dashboard.

3. `Handoff Center` is about user takeover work.
It is not the same as general notifications.

4. `Platform Coverage` is about capability and availability.
It is not just technical connection status.

5. `Plan & Billing` is about both commercial tier and runtime resources.
It is not only marketing pricing.

6. `Settings` is about durable preferences.
It is not an advanced automation control lab.

## State Requirements Across Surfaces

The UI should support at least the following cross-page states:

1. `Team active`
The team is currently running.

2. `Team paused`
The team is paused, but historical context remains readable.

3. `Takeover pending`
One or more items require user action.

4. `Platform limitation present`
One or more platforms require login, re-auth, or are restricted.

5. `Plan or runtime limit approaching`
The team is nearing usage or runtime constraints.

These states should be surfaced clearly but calmly.

## Anti-Patterns

The page system must avoid the following:

1. Creating one top-level page per internal agent implementation by default
2. Making Team Home and Opportunity Workspace redundant
3. Making Handoff Center feel like a bug tracker
4. Turning Settings into a low-level automation cockpit
5. Making Platform Coverage look like an engineering console
6. Making Billing feel disconnected from actual team runtime
7. Letting every page compete equally for visual importance

## Final Surface Principle

The UI surface model should make the product feel coherent:

- the user enters through a high-conviction team narrative
- the user activates a team
- the user lands in a team-centered working home
- the user can drill into opportunity operations
- the user can take over only when required
- the user can inspect platform reach, plan capacity, and preferences without losing the team-first model

If a page does not clearly answer a different user question than the page next to it, it should probably not exist as a separate first-level surface.
