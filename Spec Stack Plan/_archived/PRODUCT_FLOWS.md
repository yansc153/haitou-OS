# Product Flows

## Document Purpose

This document defines the complete business lifecycle of Haitou OS after the first-principles layers in:

- `PRD_FIRST_PRINCIPLES.md`
- `BUSINESS_REQUIREMENTS_FIRST_PRINCIPLES.md`

Its purpose is to translate product truth into an executable flow model for product, design, engineering, and operations.

This document should define:

- how a user enters and activates the product
- how the team runs after activation
- where the system may act autonomously
- where approval or human takeover is required
- how exceptions are handled
- how the system reviews and improves over time

This document is not a screen-by-screen UI spec and not a low-level engineering state machine.
It is the product flow layer between first principles and implementation.

## Relationship To Earlier Specs

`PRD_FIRST_PRINCIPLES.md` defines what the product fundamentally is:

- an always-on AI job operations team
- not a manual workflow tool
- not a resume optimizer alone
- not a spam engine

`BUSINESS_REQUIREMENTS_FIRST_PRINCIPLES.md` defines:

- business requirements
- automation boundaries
- non-delegable decisions
- commercial constraints

This document extends those principles into operational product flows.

If there is a conflict between a convenient flow and those earlier boundaries, the earlier boundaries should win.

## Flow Design Principles

The flow model should obey the following principles:

1. `Team-first entry`
The user should feel they are creating and activating a team, not configuring a software tool.

2. `Fast activation`
Onboarding should capture only high-value constraints and direction, not reconstruct the entire job search manually.

3. `Always-on operation`
After activation, the team should keep working continuously in the background.

4. `Default automation`
The system should advance low-risk work by default without requiring step-by-step user management.

5. `Low-noise interruption`
The user should only be interrupted when a meaningful update occurs or an action is required.

6. `Trust before activity`
Flows must preserve truthful representation, professionalism, and user trust ahead of raw action volume.

7. `Graceful degradation`
A problem with one opportunity, one platform, or one stage should not stop the whole team unless a full-team pause is explicitly required.

## Lifecycle Overview

The full product lifecycle should be modeled as:

1. `Entry and Team Creation`
2. `Onboarding and Constraint Capture`
3. `Team Formation and Activation Confirmation`
4. `Continuous Team Operation`
5. `Opportunity Progression`
6. `Approval and Handoff`
7. `Exception Handling`
8. `Review and Optimization`

The main user-facing flow is lifecycle-based.

Underneath that lifecycle, the system should run as a persistent operations engine with continuous background loops.

## Flow 1: Entry And Team Creation

## Goal

Move the user from product entry into the feeling of employing a personal AI job team.

## Trigger

The user enters the product for the first time or chooses to create a new team context.

## System Role

The product should frame the experience as:

- create your team
- define your direction
- activate your operators

It should not frame the experience as:

- fill out a long workflow form
- configure every step manually
- build a custom automation

## User Perception

The user should feel:

- I am creating my own AI job team
- this team will work for me after setup
- I do not need to manually drive every next action

## Outputs

The system should establish:

- a team identity
- a team instance tied to the user
- a default plan context
- the visible presence of a fixed core team

## Flow 2: Onboarding And Constraint Capture

## Goal

Collect enough information to let the team operate safely, accurately, and continuously without making onboarding feel heavy.

## Principle

Onboarding should be short, high-signal, and constraint-oriented.

The system should capture only the information that directly affects:

- matching
- targeting
- localization
- automation boundaries
- risk handling

## Core Inputs

The first onboarding pass should capture a small number of high-value inputs, including:

1. `Resume upload`
The user uploads a base resume or equivalent profile material.

2. `Preferred locations`
The user may choose from suggested locations and may also enter custom locations.

3. `Work mode`
Examples include remote, onsite, hybrid, or another specific requirement.

4. `Expected salary`
This may be provided or skipped.

5. `Delivery strategy`
The user selects a strategy mode such as:
- balanced
- broad
- aggressive
- precise

6. `Coverage scope`
The user indicates whether the search should focus on one region or language market or expand across multiple markets.

## Progressive Disclosure

Onboarding should support dynamic follow-up questions based on the user's coverage scope and market choice.

If the user selects broader or cross-market coverage, the system may ask additional constraint questions such as:

- willingness to relocate
- existing work authorization or visa status
- whether sponsorship is needed
- onsite acceptance constraints
- region-specific eligibility constraints

The system should not ask these questions unless they materially affect execution or commitment boundaries.

## Resume And Profile Handling

The resume pipeline should follow these rules:

1. `Minimum viable understanding`
The system should reliably identify:
- work experience
- basic identity and contact structure
- education background

2. `Optional sections`
Sections such as summary may improve quality but are not mandatory for activation.

3. `Localization support`
If the user applies cross-market, the system may translate or localize materials.

4. `Structure preservation`
Localization should preserve the resume's structure and presentation as much as possible.
Translation should not produce a completely different-looking document without need.

## Preference Conflicts

If user goals and inferred profile reality appear misaligned, the system should not hard-block the user by default.

For example:

- a user may want overseas opportunities despite a weaker overseas profile fit
- a user may prefer a narrow location that currently has weak demand

In these cases, the system should:

- surface guidance or risk notes
- suggest better-performing alternatives where appropriate
- still preserve the user's decision authority

## Outputs

The onboarding flow should produce:

- a usable profile baseline
- target constraints
- market scope
- strategy mode
- localization requirements
- boundary-aware operating instructions for the team

## Flow 3: Team Formation And Activation Confirmation

## Goal

Turn onboarding into a credible team activation moment.

## Team Model

The product launches with a fixed `7-member core team`.

This core team is the default operating unit for every user team.

Each member should be visible as a distinct persona with:

- a display name
- a role identity
- a badge or card-like presentation
- a clear responsibility

The names and persona details may vary by team instance, but the structural responsibilities should remain stable.

## Core Team Principle

The core team should remain fixed across plans.

Future versions may introduce `specialist agents`, but those should extend the core team rather than replace it.

## Plan Principle

Different plans may affect:

- accessible platform coverage
- available specialist agents
- total team operating duration

These plan differences should not change the existence of the core team itself.

## Activation Experience

After onboarding inputs are collected and the user creates the team:

- the full 7-member core team should appear as present
- the user should feel the team has been assembled
- the product should move into a short activation confirmation step

## Confirmation Step

Before full activation, the system should present a brief confirmation view that includes:

1. `What the team understands`
- target regions or markets
- work mode preferences
- salary constraints if provided
- strategy mode

2. `How the team will begin`
- initial market coverage
- likely starting platform cluster
- first operating emphasis

3. `What the user should expect`
- what the system will handle automatically
- when the user will be interrupted
- which boundaries require personal takeover

4. `A light initial direction read`
- likely role directions
- likely first market focus
- lightweight rationale

This step should be brief.
It should build trust, not create another heavy approval workflow.

## Activation Output

Once the user confirms activation, the system should:

- mark the team as activated
- create the core agent instances
- enter `Execution Readiness`
- delay live background operations until minimum readiness and explicit `Start Team`

## Flow 4: Continuous Team Operation

## Goal

Run the product as an always-on operating team rather than a one-time pipeline.

## Core Operating Principle

After activation, the team should not behave as one linear sequence that fully stops after each opportunity.

Instead, the team should run through two continuous loops in parallel.

## Loop A: New Opportunity Generation

This loop exists to keep the pipeline full.

The system should continuously:

- discover roles
- monitor active markets and platforms
- deduplicate opportunities
- evaluate fit
- prioritize targets
- prepare tailored materials
- execute submissions and first-touch actions

The purpose of this loop is:

- keep creating new surface area for interview formation
- prevent opportunity drought
- make job search continuity independent from the user's daily effort

## Loop B: Existing Opportunity Progression

This loop exists to deepen and advance active leads.

The system should continuously:

- monitor replies and thread activity
- continue low-risk recruiter communication
- follow up where appropriate
- classify progression signals
- decide whether an opportunity is becoming promising
- determine whether the opportunity should remain automated or be handed off

The purpose of this loop is:

- convert early signals into stronger opportunities
- push opportunities toward interview formation
- maintain continuity after the initial application step

## Parallel Principle

These two loops should continue in parallel.

The broader team should keep generating and advancing new opportunities even when:

- one opportunity has already moved into handoff
- one platform is blocked
- one strategy direction is underperforming

Unless the user explicitly pauses the team, the whole system should keep operating.

## Flow 5: Opportunity Progression

## Goal

Define how a single opportunity moves from discovery to either automation continuation, handoff, or exit.

## Default Progression Path

A typical opportunity should move through stages such as:

1. discovered
2. screened
3. prioritized
4. submitted or contact_started
5. followup_active
6. positive_progression
7. needs_takeover or closed

Implementation note:

- `tailored` is an internal materials milestone, not a canonical top-level opportunity stage
- `needs_takeover` is the canonical handoff-prepared stage before a user resolves the next step
- downstream specs should reuse these canonical stage names unless a separate internal task status is explicitly required

## System Actions By Stage

The system should generally handle:

- role discovery
- initial qualification
- strategy-based prioritization
- material tailoring
- localization where needed
- submission
- low-risk early communication
- low-risk follow-up

## User Actions By Stage

The user should not be required to manually drive each stage.

The user should mainly appear when:

- a meaningful update is worth seeing
- a high-risk boundary is reached
- a direct commitment is required
- a takeover is needed

## Strategy Effect

Strategy mode should influence progression behavior.

Canonical strategy mode enum for downstream specs:

- `broad`
- `balanced`
- `aggressive`
- `precise`

For example, it may influence:

- search breadth
- tolerance for imperfect fit
- application aggressiveness
- follow-up intensity
- escalation threshold for user review

The default should still preserve trust and professionalism.

## Platform Expansion Flow

Platform coverage should be modeled as an expandable execution surface.

The core team remains constant.
Platforms may be added over time as new execution channels.

When the user expands platform coverage:

- the team should gain new operating territory
- the core team should remain unchanged
- plan eligibility may determine whether a platform can be activated

Platforms should not be treated as replacements for the core team.

## Future Specialist Agent Flow

Future versions may introduce specialist agents to enhance specific parts of the workflow.

Examples could include:

- interview support
- market intelligence
- cross-market localization
- application quality assurance
- offer decision support

These specialist agents should:

- extend specific capabilities
- activate by plan or workflow need
- leave the core 7-member team structure intact

## Flow 6: Approval And Handoff

## Goal

Define exactly when the system may proceed on behalf of the user and when it must stop and request user action.

## Default Automation Rule

By default, the system should autonomously execute low-risk operational work.

This includes:

- discovering jobs
- screening and prioritizing jobs
- tailoring materials
- translating and localizing materials
- submitting applications
- initiating low-risk first contact
- performing low-risk follow-up

The system should not require per-application approval by default.

## User-Controlled Conservatism

The user may choose a more conservative strategy mode.

A more conservative mode may narrow:

- what gets advanced
- how aggressively follow-up is handled
- when the system pauses for confirmation

However, the default product model is still auto-advance rather than manual approval for every action.

## Approval-Required Zones

The system should pause and request user action when an opportunity reaches a boundary involving personal commitment or elevated risk.

Examples include:

- interview time confirmation
- salary expectation confirmation
- start date or onboarding commitment
- onsite or relocation commitment
- visa or sponsorship commitment
- work arrangement commitment that materially binds the user

## Hard Handoff Boundary

Private-channel contact should be treated as a hard handoff boundary.

Examples include:

- WeChat
- personal email thread
- direct phone contact
- calendar scheduling link
- other private-contact transfer

Once an opportunity enters private-channel takeover:

- the system must stop speaking on behalf of the user for that opportunity
- the opportunity becomes user-led
- the system may remain assistive but not representative

## Post-Handoff Support

After handoff, the system may still provide lightweight support such as:

- job summary
- conversation summary
- suggested replies
- interview context card
- preparation notes
- risk reminders

The system should not continue active representation inside the private thread.

## Principle

The product should behave like a trusted operator with clear limits.
It should help the user get to valuable moments, but it should not cross into making personal commitments on the user's behalf.

## Flow 7: Exception Handling

## Goal

Keep the system resilient without creating unnecessary full-team interruptions.

## Exception Handling Principle

Exceptions should degrade gracefully at the opportunity or platform level before escalating to a full-team interruption.

The system should:

- auto-recover when safe
- request user help when recovery requires user participation
- hand off immediately when a high-risk boundary is involved
- keep unaffected parts of the team running in parallel

## Exception Type 1: Profile And Input Exceptions

Examples include:

- unsupported or poorly parsed resume format
- missing work experience detail
- missing education or basic profile structure
- profile inputs that are too incomplete to operate safely
- preference conflicts or ambiguous targeting
- material inconsistency across language versions

System behavior should be:

1. attempt best-effort extraction and normalization
2. identify what is missing or unclear
3. proceed where safe
4. request focused user clarification where needed

The system should not reject the user merely because the profile is imperfect if a safe baseline can still be formed.

## Exception Type 2: Platform And Access Exceptions

Examples include:

- login expired
- cookie or session invalidation
- verification challenge
- platform structure change
- platform action failure
- anti-bot or restriction risk

System behavior should be:

1. attempt safe automated recovery when possible
2. request user cooperation for login, verification, or authorization when required
3. pause risky execution when platform trust or account safety is uncertain

High-risk platform recovery actions should not be executed silently if they increase account or restriction risk.

## Exception Type 3: Strategy And Performance Exceptions

Examples include:

- reply rate remains too low
- match quality is weak
- target direction is too narrow
- target region lacks sufficient opportunities
- one platform materially underperforms

These are not technical failures.
They are operating-quality exceptions.

System behavior should be:

- surface performance signals
- explain what seems to be underperforming
- recommend changes in targeting, strategy, or coverage
- continue broader operations where reasonable

## Exception Type 4: Boundary And Risk Exceptions

Examples include:

- salary is directly requested
- start-date commitment is requested
- relocation or onsite commitment is requested
- visa or work-eligibility commitment is requested
- private contact transfer appears
- employer location conflicts with user constraints

System behavior should be:

- stop autonomous representation for that opportunity
- notify the user
- transfer control for direct handling

These are not situations for silent repair.
They are takeover conditions.

## Full-Team Pause Versus Local Pause

Most exceptions should not stop the full team.

The system should prefer:

- opportunity-level pause
- platform-level pause
- strategy-level adjustment

A full-team pause should happen only when:

- the user explicitly pauses the team
- billing or entitlement blocks all further operation
- core trust or profile truthfulness can no longer be maintained safely

## Flow 8: Review And Optimization

## Goal

Ensure the product does not only act continuously, but also learns continuously.

## Review Principle

Review should not be a passive activity log.
It should be an operating feedback loop.

The point of review is:

- understand what is working
- understand what is not working
- recommend what should change next

## Review Inputs

The system should periodically review:

- opportunity volume
- qualified replies
- potential interview opportunities
- real interview opportunities
- performance by market
- performance by platform
- performance by strategy mode
- reasons for failure or stagnation

## Review Outputs

The review layer should produce three kinds of output:

1. `Performance snapshot`
What happened during the review window.

2. `Insight diagnosis`
What appears to be working or underperforming.

3. `Next-cycle recommendation`
What the team should change in the next operating cycle.

## Typical Recommendation Types

The system may recommend:

- widen or narrow targeting
- shift market emphasis
- activate or deactivate a platform
- change strategy mode
- improve or localize materials
- request missing profile detail
- reallocate effort away from low-performing channels

## Continuity Principle

Review should improve the next cycle without forcing the user to rebuild the whole team configuration from scratch.

The team should feel persistent, but capable of learning.

## Cross-Cutting Flow: Notification And Interruption Model

## Goal

Make the user feel the team is alive and working without creating constant noise.

## Notification Layers

The product should use three layers of user-facing interruption:

1. `Silent background execution`
The system acts without notifying the user in real time.

2. `Informational progress update`
The system informs the user of meaningful progress, but no action is required.

3. `Action-required interruption`
The system needs the user to do something now or soon.

## Default Rule

The default should be `silent background execution`.

The system should use `informational progress updates` when the user would benefit from feeling visible progress, such as:

- a new batch of worthwhile opportunities found
- a platform newly activated
- an opportunity meaningfully progressed
- a strategy insight emerged

The system should use `action-required interruption` only when:

- handoff is required
- approval is required
- login or authorization help is required
- missing information blocks safe progression

## Tone

The overall notification style should be moderate.

The user should clearly feel:

- the team is alive
- the team is working
- the team is making progress

But the user should not feel:

- constantly interrupted
- forced into micro-management
- overloaded by activity noise

## Cross-Cutting Flow: Commercial Entitlement Effects

## Goal

Reflect how plan structure changes operating surface without redefining the core product model.

## Plan Effects

Plans may affect:

- which markets or platforms are available
- how much team operating time is included
- which specialist agents may be enabled

## Principle

Plan gating should change the scope of operations, not the existence of the team itself.

The user should still understand the product as:

- my team exists
- my plan determines how broadly and how long it can operate

## Final Flow Principle

Haitou OS should be experienced as a persistent AI job team that the user activates once and then relies on continuously.

The user journey should not feel like:

- building a workflow
- approving every task
- manually running a dashboard

It should feel like:

- creating a team
- setting direction and boundaries
- letting that team work continuously
- stepping in only when real human judgment or commitment is required
