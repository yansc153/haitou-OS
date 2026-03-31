# Business Requirements First Principles

## Document Purpose

This document is the business-spec extension of `PRD_FIRST_PRINCIPLES.md`.

Its purpose is not branding, fundraising, or external storytelling.
Its purpose is to serve as the master business spec for product, design, engineering, and operations.

All downstream specs should align to the principles, requirements, boundaries, and constraints defined here.

## Relationship To PRD First Principles

`PRD_FIRST_PRINCIPLES.md` defines what the product fundamentally is.

This document expands that foundation into four execution layers:

1. business requirements
2. user needs
3. automation boundaries
4. commercial constraints

If there is a conflict between convenience and these first-principles business rules, these rules should win.

## Product Business Definition

Haitou OS is an always-on AI job operations team that users employ to continuously run job-search execution on their behalf.

The product is not primarily a resume tool, job board, dashboard, or chatbot.
It is a service-like execution system that takes over repetitive, time-consuming job-search operations and pushes opportunities toward interview formation.

At the business level, the product exists to convert user capability into more job opportunities through continuous automated execution.

## Core Business Problem

The first-stage business problem is:

`Will users pay for an AI job operations team that saves time and increases the probability of getting interview opportunities?`

This problem is grounded in a real job-search pain point:

- job search is not only a qualification problem, but also an operations problem
- the operations chain is long: resume updates, targeting, greetings, submissions, follow-ups, and interview progression
- this chain is especially time-consuming in Chinese recruiting environments
- many users lose opportunities not because they are unqualified, but because they cannot sustain the process with enough speed, frequency, and consistency

The product hypothesis is:

`If Haitou OS can continuously execute this operational chain for the user, a meaningful number of users will be willing to pay for it.`

## Business Goal

The first business goal is to validate paid demand for this service model.

The product is not only trying to prove that automation is technically possible.
It is trying to prove that users will pay for a continuously operating AI team that meaningfully improves job-search progression.

The expected value proposition is:

- save significant user time
- reduce the operational burden of job search
- increase search and application coverage
- increase the probability of reaching meaningful opportunity progression

## North Star Business Outcome

At the business-requirement level, the primary outcome to optimize is:

`Potential Interview Opportunity`

This is the main north-star outcome for the current stage because it captures whether the system is generating meaningful employer interest rather than only visible activity.

`Real Interview Opportunity` should still be tracked as a deeper downstream outcome, but the product is currently centered on reliably generating potential interview opportunities at scale.

## Opportunity Funnel Definition

The opportunity funnel should be split into two layers:

1. `Potential Interview Opportunity`
Any meaningful employer progression signal that indicates real interest and a plausible path toward interview formation.

Typical examples may include:

- continued recruiter conversation after initial outreach
- explicit request for resume or additional materials
- request for salary expectations
- request for earliest start date
- request to move to WeChat, email, phone, or another private channel
- positive reply to cold outreach or application follow-up

2. `Real Interview Opportunity`
A clearer transition into actual interview formation.

Typical examples may include:

- request to choose interview time
- scheduling link
- explicit interview invitation
- direct confirmation that interview coordination is starting

The exact operational thresholds between these two states are still partially market-dependent and should be refined in a later metrics/ops spec.

## Target Users

At the service-boundary level, the product should be able to serve broad job seekers rather than only a narrow niche.

Locked principle:

- all broad categories of job seekers may be served

However, product design still assumes the following reality:

- users must be willing to delegate repetitive execution to an automated team
- users gain the most value when their job search includes frequent searching, applying, communicating, and following up

This means the serviceable market is broad, but the product is strongest where operational burden is high.

## User Needs

The core user need is not "help me write a better resume."

The core user need is:

`Help me continuously run my job search so I have a better chance of getting interview opportunities without spending so much of my own time.`

This expands into the following concrete needs:

1. `Save time`
Users do not want to personally spend large amounts of time on repetitive job-search execution.

2. `Reduce cognitive burden`
Users do not want to constantly remember where to apply, who to follow up with, and which thread is still active.

3. `Maintain continuity`
Users want job search to keep moving even when they are busy, tired, or distracted.

4. `Expand coverage`
Users want more opportunities to be discovered and advanced than they could manually handle.

5. `Increase meaningful responses`
Users care about whether employers actually respond and show interest, not just whether applications were sent.

6. `Receive help with self-packaging`
Many users do not know how to present themselves well. They want truthful but stronger packaging, translation, structuring, and phrasing support.

## User Value Moment

The first user value moment is not "the system submitted one application."

The first user value moment is:

`The system understands me, has started working for me, and is now continuously running my job search.`

The ongoing value moment is:

`I am getting meaningful opportunity signals without having to manually run the full process myself.`

## User Experience Principles

The product should make users feel:

- I do not have to run job search alone anymore.
- A team is continuously working for me.
- My search does not stop when I am busy.
- I have a better chance of getting opportunities because I am covering more ground.
- I only need to step in when a real human decision is required.

## Business Requirements

The system must satisfy the following business requirements:

1. `Always-on team model`
The product must operate like a continuously working team, not a one-time tool.

2. `Default automation`
The system should autonomously execute the repetitive operational parts of job search by default.

3. `Configurable strategy`
Users should be able to choose different strategy modes:
- broad coverage
- balanced
- precise matching

The default mode should be `balanced`.

4. `Truthful user representation`
The system must help users package themselves better without fabricating facts.

5. `Parallel opportunity generation`
The system should keep generating new opportunities even after some existing leads have been handed off to the user.

6. `Low-noise interruption model`
The user should not be interrupted for every intermediate action.
Interruptions should happen only when a real decision, handoff, or risk event occurs.

7. `Outcome-oriented system behavior`
The product should optimize for meaningful progression signals, not empty activity volume.

## Automation Scope

By default, the system should be allowed to do the following:

- discover jobs
- monitor roles
- screen roles
- choose whether to advance opportunities based on selected strategy mode
- tailor materials to job descriptions
- translate and localize materials
- submit applications
- send greetings and first-touch outreach
- perform follow-up communication
- continue low-risk recruiter conversation
- push opportunities toward potential interview formation

The system should remain continuously active unless the user explicitly pauses the team.

## Automation Boundary

The system is not allowed to automate every part of the hiring process.

The handoff principle is:

`Once a conversation enters a stage that requires personal commitment, private-channel takeover, or a materially binding human decision, the system must stop acting on the user's behalf for that opportunity.`

## Non-Delegable Decisions

The system must not make the following decisions on behalf of the user:

- confirm interview time
- confirm salary expectations
- negotiate compensation
- promise onboarding date or start date
- accept an offer
- make any legal, financial, or employment commitment

The system must also not:

- fabricate work experience
- exaggerate outcomes beyond factual support
- invent projects, responsibilities, or metrics
- distort identity-critical facts

## Additional High-Risk Boundaries

Beyond the already-locked non-delegable decisions, the system should also treat the following as high-risk boundary zones:

- private contact exchange such as WeChat, private email, phone, calendar links, or similar channels
- relocation, onsite, travel, or work-arrangement commitments
- visa, sponsorship, work authorization, or eligibility commitments
- reference checks, background checks, tests, or formal assessment acceptance
- disclosure of confidential employer, client, project, or personal information

When any of these conditions appear, the system should pause active representation for that opportunity and hand the thread back to the user.

## Post-Handoff Product Role

After a lead moves into WeChat, email, phone, calendar scheduling, or another private-contact stage:

- the system must not continue sending messages on behalf of the user for that opportunity
- the system may provide a simple job summary
- the system may provide a chat summary
- the system may provide reply suggestions
- the system may prepare a lightweight support card for the user

After this support is delivered, active assistance on that opportunity can stop.
The broader job-search team should continue running on other opportunities in parallel unless the user pauses the team.

## Packaging Boundary

The system is allowed to:

- rewrite
- polish
- translate
- restructure
- summarize
- strengthen phrasing

The system is not allowed to:

- add fictional achievements
- inflate measurable impact without evidence
- claim unowned experience
- create fake employment facts

The principle is:

`AI may improve expression, but may not alter the truth.`

## Failure Modes To Avoid

The following outcomes should be treated as business failures even if activity appears high:

- repeated harassment of employers or recruiters
- platform ban or platform restriction risk
- users feeling they were randomly or carelessly submitted

These are not acceptable tradeoffs for higher visible activity.

## Positive Signals Vs Empty Activity

The system may produce large activity volume, including many messages, many applications, and many replies.

High activity is not automatically a problem.
However, activity is only considered healthy when it does not create the failure modes above and still reflects coherent strategy, user fit, and professional communication quality.

## Strategy Modes

The product should support four canonical strategy modes.

Canonical enum values:

- `broad`
- `balanced`
- `aggressive`
- `precise`

1. `Broad`
Favors wider search and faster expansion of opportunity volume.

2. `Balanced`
Balances coverage and relevance.
This is the default mode.

3. `Aggressive`
Favors faster execution and a more assertive push through acceptable opportunities and follow-up windows.

4. `Precise`
Favors tighter fit and narrower selection.

These modes should influence job filtering, application aggressiveness, and follow-up behavior.

## Commercial Model

The product should be sold as a subscription service.

The unit being sold is:

`AI team online working time`

The commercial model should not be framed primarily as:

- number of tokens
- number of messages
- number of applications
- number of automation actions

Users should feel they are paying for a continuously operating execution team, not a bucket of technical usage.

## Commercial Constraints

The following commercial constraints are currently locked:

1. `Subscription-first`
The product should be sold primarily through recurring subscription.

2. `Time-based service framing`
Plans should be framed around team online working time.

3. `Tiered service model`
Different subscription levels may expand available team time and overall service capacity.

4. `Free entry path`
A free tier may exist with limited monthly time and limited system resources for trial and acquisition.

Detailed packaging, time allocation, and entitlement logic should be defined in a later monetization spec.

## Growth Principle

The current growth posture is:

`Prefer faster user growth if the product is solving a real user problem and generating revenue growth.`

This means the business is currently more willing to pursue broad adoption than to over-optimize for narrow user curation.

However, fast growth does not override platform safety, trust, truthfulness, or handoff boundaries.

## Business Red Lines

The business must not become:

- a fake-resume generator
- a blind spam machine
- a platform-ban engine
- a noisy system that makes users feel randomly represented
- a token-metering product disguised as a service team

## Open Definitions To Refine Later

The following areas are directionally defined but still need tighter follow-up specs:

- exact threshold between `Potential Interview Opportunity` and `Real Interview Opportunity`
- how each strategy mode changes filtering thresholds and action volume
- exact time packaging and subscription tiers
- which platform events should trigger user interruption
- which employer signals count as high-confidence progression by market

## Final Principle

Haitou OS should be built as a broad-service, high-automation, continuously running AI job operations team.

Its business success depends on whether users believe and experience the following:

`This team meaningfully saves me time and increases my probability of getting interview opportunities, while staying truthful, professional, and within clear human decision boundaries.`
