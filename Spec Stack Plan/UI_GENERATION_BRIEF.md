# UI Generation Brief

## Document Purpose

This document is a high-level UI generation brief for Google Stitch or similar design-generation tools.

It defines:

- the product subject the UI must communicate
- the visual language and emotional tone
- the page architecture for core surfaces
- the motion language and interaction metaphors
- the anti-patterns the generated UI must avoid

This is not a low-level design system and not a pixel-perfect engineering spec.
It is a structured generation brief that should help produce aligned first-pass UI concepts for Haitou OS.

## Product Subject

Haitou OS must never be framed as a normal job board, resume optimizer, or auto-apply utility.

The UI must communicate one core truth:

`The user is not merely using a product. The user is gaining an AI job operations team.`

The product feeling should be:

- not "I opened a dashboard"
- not "I configured an automation"
- but "I now have a complete team operating for me"

Every major page should preserve that subject.

## Primary Experience Goal

The interface should make the user feel:

- I now have a full AI job operations team
- this team keeps working even when I am not actively present
- I am not manually pushing every step myself
- I am operating at team scale rather than individual scale

The UI should also create mild competitive FOMO:

- other people may still be applying alone
- this user now has a team continuously working on their behalf

This FOMO should feel elegant and formal, not loud or salesy.

## Visual Direction

The visual direction should combine two references:

1. `Claude-like atmosphere`
- calm
- modern
- editorial
- premium
- restrained
- high-trust

2. `Kimi Agent Swarm-like role presentation`
- agent roster feeling
- role cards / badges / work tags
- identity-first presentation
- visible team composition

The combined result should be:

`Claude-style layout, spacing, and tonal restraint with Kimi-style badge-card team expression.`

## Color And Surface Language

The overall product line should use a Claude-like warm neutral palette.

Preferred qualities:

- warm off-white backgrounds
- soft gray-beige surfaces
- muted accent colors
- minimal saturation
- premium light-theme bias

Surface behavior:

- large areas should breathe with negative space
- cards should feel soft, quiet, and expensive
- gradients should be subtle and atmospheric
- texture should be minimal, with only a faint paper-like or air-like softness

Avoid:

- overly glossy startup gradients
- neon AI colors
- heavy dark-mode bias
- loud purple-heavy palettes
- high-contrast enterprise dashboards

## Typography And Tone

Typography should feel large, modern, and formal.

Preferred characteristics:

- oversized hero headlines
- restrained supporting copy
- strong editorial hierarchy
- simple, elegant label treatment

Copy tone:

- overall restrained and modern
- key slogans should feel powerful
- wording should imply team ownership, not tool usage
- language should create status and momentum
- occasional competitive FOMO is welcome

The default product language should be Chinese-first.
The navigation may support Chinese / English switching.

## Core UI Metaphor

The core visual metaphor is:

`A visible team of AI job operators presented as real members of a working organization.`

These members should not look like generic feature cards.
They should feel like personnel.

Preferred metaphor:

- work badges
- hanging ID cards
- roster cards
- personnel tags
- role cards with identity and duty

## Agent Card Design

The product should use `agent work badges` as a signature UI object.

Each badge should feel like a physical work card.

### Front Side

The front side should prioritize identity.

The most visible information should be:

1. Chinese role title
For example: `审核官`, `寻访官`, `投递官`

2. English persona name
For example: `Scout | 寻访官`

3. Pixel-style portrait
The portrait style should be inspired by low-resolution Kimi-like persona avatars, but the surrounding UI must remain premium and Claude-like.

4. Lightweight work identity metadata
Possible examples:
- tenure / operating time
- primary responsibility
- brief duty summary

### Back Side

The back side should prioritize operational logic.

It should show:

- current tasks
- workflow summary
- automation responsibilities
- what this agent handles in the system

This side should feel like the operational back of a work badge, not a complex admin panel.

### Flip Interaction

Badge cards should support a light 3D flip interaction.

The motion should be:

- physical but restrained
- elegant, not playful
- slightly tactile
- never exaggerated

## Agent Identity Style

Agent naming should use:

`English persona name + Chinese role title`

Examples:

- `Scout | 寻访官`
- `Filter | 审核官`
- `Tailor | 定制官`

This keeps the system understandable for Chinese-first users while preserving agent identity and international product character.

## Motion Language

Motion should be meaningful and sparse.

The UI should not rely on generic micro-animations everywhere.

The most important motion moments are:

1. `Hero text retyping motion`
The landing hero includes a restrained blinking cursor effect, followed by a delete-and-retype transition.

Recommended structure:

- first line appears
- cursor blinks
- text deletes
- final line retypes
- animation plays once and then rests on the final message

The emotional tone should feel like a concept being rewritten with authority, not like a flashy typewriter demo.

2. `Team activation drop sequence`
During team activation, the 7 badge cards should drop in from the top one by one.

This should feel like:

- a team assembling
- personnel being assigned
- a system becoming staffed

The cards should not all appear at once.
They should arrive sequentially and land into a coherent formation.

3. `Card flip motion`
Agent badges may flip to reveal task logic.
This motion should stay light and premium.

## Page Scope

This brief should cover the following surfaces:

1. Landing page
2. Lightweight login entry
3. Onboarding and team activation
4. Logged-in home / team operations page

## Landing Page

## Role

The landing page is not a documentation-heavy marketing page.
It is a high-impact entry surface that quickly helps the user understand the product subject and move toward login and team creation.

The landing page should feel:

- modern
- premium
- spacious
- highly visual
- low-noise

## Top Navigation

Keep the top navigation minimal.

It should include only:

- brand
- language switch
- `登录`

Avoid heavy top-level site navigation in v1.

## Hero Section

The hero should use a two-part composition:

1. Left side
- large formal headline
- restrained supporting copy
- primary CTA
- brief numbered or label-like microcopy if useful

2. Right side
- 7-agent badge formation
- light dynamic product-flow preview

The hero must immediately communicate:

- this is a team
- this team works continuously
- this is not a normal job tool

### Hero Copy Guidance

The core headline direction is:

`现在开始，拥有你的 AI 求职运营团队。`

The hero should also support dynamic supporting copy behavior.

Recommended motion sequence:

- show a line close to `拥有属于你的 AI 求职运营团队`
- blinking cursor
- deletion
- retype into:

`从现在开始，一人即是一整个团队`

This should appear elegant, controlled, and premium.

### Hero CTA

The primary CTA should feel formal, high-conviction, and team-oriented.

The top-nav CTA remains:

`登录`

The hero CTA should not sound like a generic SaaS action.
It should imply beginning ownership of a team rather than merely opening a tool.

## Landing Page Structure

The landing page should be composed of a small number of substantial sections.

Recommended order:

1. `Hero Section`
- main statement
- main CTA
- 7-agent formation
- light product preview

2. `Secondary CTA Section A`
- focus: how the team starts working
- include a short supporting video

3. `Statement + Logo Wall`
- one large formal slogan
- grouped platform support logos

4. `Secondary CTA Section B`
- focus: how the team continues applying and following up
- include a short supporting video

5. `Pricing`
- full pricing cards

6. `FAQ`

## Secondary CTA Section A

This section should explain:

`How the team begins working for the user`

It should visually support:

- resume upload
- a few onboarding decisions
- team formation
- activation

The tone should include competitive urgency.
It should suggest that continuing to search alone is strategically weaker than activating a team.

## Statement + Logo Wall

This section should use a large, bold, formal line above grouped platform logos.

Current slogan direction:

`把一个人的求职，升级为整支团队的运作`

This exact line may be refined later, but the meaning should stay:

- individual job search is being upgraded into team-scale operations

### Platform Logo Wall

Platform logos should be grouped by region.

Preferred grouping:

- Chinese-market platforms
- English/global-market platforms

This should communicate cross-market coverage rather than generic integration clutter.

## Secondary CTA Section B

This section should explain:

`How the team keeps applying, following up, and advancing opportunities`

The associated video should show:

- job discovery
- filtering
- application
- low-risk follow-up
- progression toward meaningful opportunity signals

This section should reinforce:

- the team does not stop at one application
- the team continues operating after first contact

## Pricing

Pricing should be presented as full plan cards, not as placeholder text.

Use three tiers:

- `Free`
- `Pro`
- `Plus`

The UI should frame these as levels of team capability and coverage, not merely feature rows.

### Plan Direction

`Free`

- overseas platforms only
- limited AI operating time

`Pro`

- additional Chinese platforms
- longer operating time

`Plus`

- full platform access
- fullest capability and coverage

## FAQ

FAQ should not be generic filler.

It should primarily handle trust and boundary questions.

Priority FAQ themes:

1. whether the system auto-applies
2. whether the system can overstep or speak improperly
3. when the user must take over
4. which platforms and regions are covered
5. how plans differ

The FAQ should reinforce:

- automation exists
- boundaries are clear
- trust is preserved

## Login Entry

The login experience should be light.

Do not create a heavy standalone login flow in v1.

Preferred approach:

- lightweight OAuth aggregation
- simple third-party sign-in options
- minimal friction

Avoid in v1:

- QR-first login flows
- SMS verification-heavy patterns
- overly elaborate account management surfaces

Login is only the entry point into the team.
It should not become a major visual or engineering focus in the first pass.

## Onboarding And Team Activation

## Role

Onboarding should feel like forming and activating a team, not filling out a long settings form.

The page should preserve a large theatrical scene while still guiding the user through concise steps.

Recommended interaction model:

- one coherent visual scene
- step-by-step progression within that scene
- choice cards first
- input fields only where necessary

## Input Style

Prefer:

- selection cards
- toggle cards
- chips
- concise text input when necessary

Avoid:

- long heavy forms
- spreadsheet-like settings blocks
- chat-style onboarding

## Activation Moment

The key emotional peak is team assembly.

When the user completes the onboarding questions:

- 7 badge cards should descend from above one by one
- each card lands into formation
- the full team becomes visible
- the user feels the team is now staffed and ready

This is one of the most important moments in the entire product.

## Logged-In Home

## Role

The logged-in home should communicate:

- your team is present
- your team is active
- your team is producing real work

The page should not feel like a generic analytics console.

## Layout Priority

The home page should use this information order:

1. visible team presence near the top
2. below that, ongoing operational activity and progress

The user should first feel the team.
Then the user should see evidence of work.

## Team Presentation

After login, the strong hanging metaphor should soften.

The home page should use:

- cleaner card formations
- roster-like arrangement
- more restrained structure

This preserves usability for a long-running operations page while keeping the team subject intact.

## Live Feed

The live feed should be located below the team area.

It should show:

- who did what
- what business result it produced
- only meaningful updates by default

The feed should use:

`agent-led language with explicit business outcomes`

Examples of the intended tone:

- `Scout 正在扫描 Greenhouse，已锁定 14 个高匹配机会。`
- `Filter 已排除 5 个与目标地区冲突的岗位。`
- `Tailor 正在为目标职位生成定制化简历版本。`

The feed should not default to noisy low-level system logs.
Detailed logs can exist as a lower-level drill-down state, but the main view should prioritize high-value progress.

## Design Rules

The generated UI should follow these principles:

1. `Team-first`
Always show people-like operators before abstract system functions.

2. `Identity before mechanism`
Users should understand who is working before seeing detailed process internals.

3. `High trust`
Everything should feel truthful, boundary-aware, and premium.

4. `Low noise`
Do not crowd the page with too many charts, labels, or system states.

5. `Formal but forceful`
The product should feel calm, but the best slogans should still have momentum and pressure.

6. `Chinese-first clarity`
The interface should read naturally for Chinese users while preserving room for bilingual structure where needed.

## Anti-Patterns

The generated UI must avoid the following:

1. `Generic SaaS dashboard look`
Do not produce a standard sidebar-plus-widgets admin shell as the core concept.

2. `Chatbot-first product framing`
This is not primarily a chat assistant screen.

3. `Auto-apply spam aesthetics`
Avoid anything that looks like mass-blast automation, growth hacking, or low-trust scraping software.

4. `Overly enterprise visual density`
Avoid excessive tables, metrics blocks, status chips, and control-center clutter.

5. `Overly playful agent UI`
Avoid gaming aesthetics, mascot overload, loud avatars, or toy-like swarm visuals.

6. `Cold functional forms`
Do not let onboarding look like a bureaucratic setup form.

7. `Loud AI branding clichés`
Avoid glowing gradients, futuristic blue neon, floating wireframes, hologram effects, and generic "AI startup" motifs.

8. `Heavy login investment`
Do not spend too much page weight on a login-only experience in v1.

## Output Expectation For Design Tools

When generating UI concepts, prioritize:

- landing page concepts first
- onboarding / team activation concepts second
- logged-in home concepts third

The design tool should generate layouts that make the user feel they are stepping into ownership of a continuously operating AI job operations team.

If tradeoffs are necessary, protect these first:

1. the team-first subject
2. the premium Claude-like visual restraint
3. the badge-card agent metaphor
4. the activation and motion moments
5. the sense that one person now operates with team-scale execution
