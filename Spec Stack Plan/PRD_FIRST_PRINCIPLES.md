# PRD First Principles

## Product Definition

Haitou OS is not a job application tool. It is an AI job operations team that a user can employ and direct.

Its purpose is to autonomously advance a user's job search across Chinese and global hiring platforms, from opportunity discovery to interview creation.

The product is designed as a black-box, highly automated system. In the default mode, the system continuously works in the background to:

- understand the user's resume, education, work history, and capability boundaries
- build a capability model and target role range
- discover and monitor matching jobs
- prepare and localize application materials
- submit applications
- initiate recruiter outreach
- continue communication and follow-up
- push qualified opportunities toward interviews

The user is not meant to manage the workflow step by step. The system is meant to operate like an always-on execution team.

## Core Promise

This product does not help the user apply better.

It helps the user employ an AI team that continuously searches for jobs, applies on the user's behalf, communicates with employers, and pushes opportunities toward interviews.

The core promise is:

> From job discovery to interview creation, the user is not using a tool. The user is employing an AI job team that works 24/7 to advance job search results.

## Primary Outcome

The most important outcome is to help users get more interviews.

The secondary value is to help users complete the job search with less effort.

This means the product is result-first, not convenience-first:

- primary value: more interviews
- secondary value: less user effort

## North Star Metric

The north star metric is:

`Number of real interview opportunities created for the user`

The system must not optimize for application volume, message volume, or visible activity alone.

A real interview opportunity means the system has successfully advanced an opportunity into a genuine interview stage, rather than only generating replies, interest signals, or light conversation.

## Supporting KPIs

To evaluate system quality and funnel performance, the product should also track leading indicators ahead of real interview creation.

The most important supporting indicators are:

1. `Qualified replies`
Replies that indicate genuine willingness to continue, excluding explicit rejections.

2. `Potential interview opportunities`
Positive progression signals that meaningfully deepen the opportunity and suggest the conversation is moving toward interview formation.

3. `Real interview opportunities`
The opportunity has clearly entered the interview scheduling or interview invitation stage.

The exact operational definition of each KPI may vary by market and platform, and should be finalized in a later metrics or operations spec.

## Target Users

The first version should prioritize globally oriented, cross-market job seekers who are comfortable outsourcing execution and are likely to benefit from bilingual, cross-platform, high-automation job search.

The primary ICP is:

`Professionals pursuing global or cross-market job opportunities who want an AI team to continuously operate the job search for them.`

Representative user groups include:

- digital nomads and remote-first professionals
- technical talent, especially engineers and other structured professional roles
- overseas students and new graduates applying across Chinese and global markets
- international or foreign-company white-collar professionals
- other cross-market professional job seekers who want continuous execution without constant personal involvement

These users often share the following characteristics:

- they value speed and coverage
- they are open to black-box automation
- they are likely to use multiple platforms
- they often have enough English ability for bilingual workflows
- they want outcomes without managing the whole process themselves

## User Truth

Users are not looking for more job-search tasks. They are looking for more interview opportunities without having to personally operate the entire process.

The core reasons they would hand this work to the system are:

1. They do not want to spend energy on repetitive operational work.
Searching, screening, applying, greeting, following up, and chasing responses are repetitive and exhausting.

2. Many users are not good at job-search operations even if they are qualified.
They may have strong ability but weak self-packaging, weak outreach habits, or weak follow-up rhythm.

3. Users cannot monitor the market continuously, but the system can.
Good opportunities appear outside the user's active search window. A continuous system can capture what a human would miss.

## What The User Is Really Hiring

The user is not hiring a single agent and is not buying a software toolchain.

The user is hiring a continuously running AI job team that can be automatically coordinated in the background and can keep producing new job opportunities and interviews over time.

## Core Team Model

The minimum team loop should include the following operating roles:

1. `Profile Intelligence`
Understands the user's background, resume, experience, and capability boundaries.

2. `Resume and Materials`
Prepares resumes, localized versions, translated versions, cover letters, and platform-specific application materials.

3. `Opportunity Discovery`
Continuously finds and monitors relevant roles.

4. `Matching and Filtering`
Evaluates JD fit, role quality, and whether a job is worth advancing.

5. `Platform Execution`
Completes platform-specific actions such as submissions, forms, cold email, and structured outreach.

6. `Relationship Operations`
Initiates greetings, continues recruiter conversations, sends materials, follows up, and pushes opportunities toward interviews.

In addition, `Relationship Operations` should also be responsible for the handoff step after interview formation, including delivering job context, summary, and interview preparation notes back to the user.

The system is also expected to contain an internal orchestration layer that handles heartbeat, priority, wake-up logic, and loop continuation. This is a system control function, not necessarily a user-facing team member.

## Automation Principle

This product is designed around black-box automation.

By default, the system should decide and execute:

- job discovery
- job filtering
- matching judgment
- materials preparation
- applications
- first-touch communication
- follow-up rhythm
- pre-interview progression

The user should only be brought in when the workflow enters a stage that requires personal human takeover, such as:

- confirming actual interview availability
- responding in a personal email thread when time must be chosen
- taking over after a WeChat handoff or other private channel transfer
- deciding whether to join the interview
- deciding whether to accept an offer

## Non-Delegable Decisions

Even in black-box mode, the system must not make high-risk identity or commitment decisions on the user's behalf.

The system must not:

- exaggerate, invent, or distort the user's experience
- confirm salary expectations or negotiate compensation autonomously
- promise an onboarding date or start date
- accept an interview time that requires the user's personal availability confirmation
- make any high-risk commitment that materially binds the user

If these situations appear, the system should pause progression and notify the user that human takeover is required.

When discussing background or experience, the system may only use truthful information grounded in the user's actual resume, profile, and approved materials.

## Trust Model

Users will trust the system if it behaves with clear boundaries and produces high-value outcomes with low noise.

Trust comes from four core factors:

1. The system does not apply blindly.
It works inside clear preference and role boundaries.

2. The system is based on a real understanding of the user.
It uses a capability model instead of mass spraying.

3. The system only interrupts the user when something valuable happens.
It should not create noise for every intermediate step.

4. The system keeps working consistently over time.
It does not stop because the user is busy, distracted, or temporarily disengaged.

## What This Product Is Not

This product must not become:

- an auto-apply spam tool
- a resume optimizer only
- a job aggregator only
- a generic chatbot
- a workflow dashboard that still requires constant user operation
- a high-activity, low-outcome SaaS console

It is not defined by how many actions it performs.
It is defined by whether it can generate more real interviews for the user.

## Product Red Lines

The system must not:

- apply to obviously mismatched jobs
- misrepresent or misunderstand the user's background
- say inappropriate or low-quality things to employers
- behave like a spam engine
- generate lots of activity without real interview outcomes

Any automation that violates fit, truthfulness, professionalism, or outcome quality is not acceptable.

## English And Chinese Market Principle

The product must work across both Chinese and global hiring environments.

That means it should support:

- Chinese platform greeting and recruiter chat progression
- English-language applications and recruiter communication
- bilingual resume handling
- translated materials where needed
- platform-specific submission logic
- different definitions of positive progression depending on market context

The product should treat these as different execution environments built on top of the same user capability model.

## Service Model

The product should be defined as a continuously running job team, even if most users buy the service for a limited job-search window such as one to three months.

The service experience is persistent:

- the team keeps running in the background
- the user can pause the team
- the team continues to search and push opportunities during the active period

## Monetization Principle

The commercial model should be built around subscription, not raw usage metering.

At the PRD first-principles level, the only locked principle is:

- users are buying a continuously operating service team, not raw token consumption or isolated software actions

Detailed packaging, limits, upgrades, and billing logic should be defined in a separate monetization spec.

## First User Value Moment

When a user first arrives, the most important first outcome is not immediate application.

The system must first:

- understand who the user is
- infer what the user can do
- identify which roles fit the user
- build a capability model
- create a team that can begin autonomous execution

The first value moment is:

`The system understands me and has started running my job team.`

## Experience Principles

The product should make the user feel:

- I no longer need to personally manage job search operations.
- I really have a team working for me.
- My job search keeps moving even when I am busy.
- I am less likely to miss good opportunities.
- I only need to appear when something truly important happens.

## Product Thesis

People do not fail job search only because they lack skill.
They also fail because job search is an operational burden that demands repetition, outreach, timing, persistence, and follow-through.

Haitou OS exists to turn job search from a user-operated process into a continuously executed service.

The product wins if it can reliably convert user capability into more real interview opportunities through autonomous, trustworthy, always-on execution.
