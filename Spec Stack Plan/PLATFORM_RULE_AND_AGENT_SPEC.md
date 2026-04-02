# Platform Rule And Agent Spec

## Document Purpose

This document defines how Haitou OS connects to, interacts with, and respects the rules of external recruitment platforms.

It answers:

- which platforms are supported and in what priority
- how each platform's session, authentication, and anti-bot measures work
- what rule packs govern per-platform execution behavior
- how platform executors are structured
- what rate limits, safety margins, and degradation rules apply
- how session management, cookie injection, and health monitoring work
- how platform-attached skills extend the core skill system

## Relationship To Earlier Specs

This document builds on:

- `DATA_MODEL_SPEC.md` — `PlatformDefinition`, `PlatformConnection`, `PlatformConsentLog`, `SubmissionAttempt`
- `BACKEND_API_AND_ARCHITECTURE_SPEC.md` — Module 3 (Platform Executors), scheduling, health checks
- `AGENT_TEMPLATE_SPEC.md` — `投递专员` and `招聘关系经理` responsibilities
- `AGENT_SKILL_AND_PROMPT_SPEC.md` — platform-attached skills as a first-class layer

---

## Platform Tiering

### Tier 1: V1 Launch Platforms

These platforms must work at launch. Full rule packs, tested executors, and monitored health.

| Platform | Code | Region | Type | Pipeline | Plan |
|---|---|---|---|---|---|
| LinkedIn | `linkedin` | global_english | recruiter_network | `full_tailored` | free |
| Greenhouse | `greenhouse` | global_english | ats_portal | `full_tailored` | free |
| Lever | `lever` | global_english | ats_portal | `full_tailored` | free |
| 智联招聘 | `zhaopin` | china | job_board | `passthrough` | pro |
| 拉勾 | `lagou` | china | job_board | `passthrough` | pro |

**Pipeline mode rule:** `full_tailored` = resume tailoring + cover letter + localization before each submission. `passthrough` = user's original resume submitted directly, no per-opportunity material generation. Determined by platform region. See `DATA_MODEL_SPEC.md` → `PipelineMode`.

Note: Boss直聘 was previously listed here but moved to Tier 2 based on platform research showing extreme anti-bot measures, short session TTL, and chat-first model incompatibility with V1 apply pipeline. See `IMPLEMENTATION_AND_GOVERNANCE_SPEC.md` V1.1 scope.

### Tier 2: V1.x Expansion

| Platform | Code | Region | Type | Pipeline | Plan |
|---|---|---|---|---|---|
| Boss直聘 | `boss_zhipin` | china | job_board | `passthrough` | pro |
| 猎聘 | `liepin` | china | recruiter_network | `passthrough` | pro |
| Indeed | `indeed` | global_english | job_board | `full_tailored` | free |
| SmartRecruiters | `smartrecruiters` | global_english | ats_portal | `full_tailored` | free |
| Ashby | `ashby` | global_english | ats_portal | `full_tailored` | free |
| Wellfound | `wellfound` | global_english | recruiter_network | `full_tailored` | free |

### Tier 3: V2 / Research Required

| Platform | Code | Region | Notes |
|---|---|---|---|
| Workday | `workday` | global_english | Per-employer tenants, extremely complex multi-step forms — critical for enterprise coverage but requires dedicated executor R&D |
| iCIMS | `icims` | global_english | Major enterprise ATS — similar complexity to Workday |
| SEEK | `seek` | global_english | APAC market — Cloudflare protected |
| JobsDB | `jobsdb` | global_english | APAC — merging with SEEK infrastructure |
| 脉脉 | `maimai` | china | App-first, request signing, very high anti-bot |
| 前程无忧 | `51job` | china | Search and resume center are usable, but detail/JD is blocked by slider verification and web-side apply/chat are not yet validated |
| Glassdoor | `glassdoor` | global_english | Heavy login wall, mostly redirects to ATS |

---

## Research Cross-Reference Status

The following Chinese-platform rows are no longer speculative. They are aligned to the experiments recorded in `Platform Research/Platform Research.md` as of `2026-04-01`.

| Platform | Search | Detail / JD | First Touch | Thread Readback | Web Apply | Resume Management | Current V1 Role |
|---|---|---|---|---|---|---|---|
| Boss直聘 | Validated | Partial | Validated (`greet`) | Partial / delayed | N/A (chat-first) | Partial (chat-side resume sharing not yet a V1 dependency) | Search + conversation |
| 智联招聘 | Validated | Validated | Entry exists, web chat not validated | Unvalidated | Validated | Validated | Search + detail + apply |
| 拉勾 | Validated | Validated | App-directed handoff only | Unvalidated | Validated | Validated (online + attachment) | Search + detail + apply |
| 51Job | Validated | Blocked by slider | Entry exists but special-flow branch observed | Unvalidated | Entry exists, success not yet validated | Validated | Out of active V1 scope |

Rule-writing guidance:

- `validated` means a real browser-side action or read path was exercised successfully
- `partial` means at least one part of the chain works, but the full end-to-end capability is not yet stable enough to promise
- `entry exists` means UI affordance is present, but browser-side execution was not proven
- `blocked` means the platform's anti-bot or environment gate prevented the capability from being treated as usable

---

## Agent Execution Cross-Reference

This section exists for implementers. A coder building `投递专员` or `招聘关系经理` should not need to infer role behavior from mixed platform prose.

### Core Rule

- `投递专员` owns:
  - search-derived apply preparation
  - resume selection
  - browser-side apply execution
  - apply-state readback
- `招聘关系经理` owns:
  - first touch
  - reply reading
  - follow-up
  - conversation progression
- if a platform does not support a capability at browser level, the role must not simulate that capability by assumption

### Chinese Platform Role Matrix

| Platform | 投递专员 | 招聘关系经理 | Notes |
|---|---|---|---|
| Boss直聘 | Does **not** own classic apply; supports opportunity handoff into greeting-first flow | Primary owner | Boss is chat-first; `greet` is the primary external action |
| 智联招聘 | Primary owner | Limited / mostly inactive in V1 | Web apply is validated; browser messaging is not a V1 promise |
| 拉勾 | Primary owner | Inactive in V1 | Apply is validated; communication is app-directed handoff |
| 51Job | Out of active V1 scope | Out of active V1 scope | Search/resume useful, but core execution chain is not yet reliable |

### Required Implementer Decisions

The executor layer must encode these platform truths directly:

1. Boss直聘
   - `投递专员` must never assume a normal `apply` button exists
   - `招聘关系经理` may perform:
     - `greet`
     - reply polling where available
     - limited follow-up
   - `search` and `chat` health must be tracked separately

2. 智联招聘
   - `投递专员` may perform:
     - search
     - detail read
     - resume selection
     - web apply
   - `招聘关系经理` must **not** assume browser-side chat send is available
   - `立即沟通` should currently be treated as:
     - `entry exists`
     - not `validated send path`

3. 拉勾
   - `投递专员` may perform:
     - keyword search
     - detail read
     - attachment preparation / upload
     - web apply
   - `招聘关系经理` should currently remain inactive on web
   - app-directed chat prompt is a handoff signal, not an automation target

### Mandatory Non-Goals For V1

The following must be explicit so engineers do not overbuild:

- do **not** build `招聘关系经理` around 智联网页聊天
- do **not** build `招聘关系经理` around 拉勾网页聊天
- do **not** build `投递专员` around Boss传统投递表单
- do **not** treat 51Job as an active executor target in V1
- do **not** model any Chinese platform as a single binary `connected / not connected` state

### Capability Status Contract

Every Chinese-platform executor should expose capability-level status to the orchestrator:

```ts
type PlatformCapabilityStatus = {
  search: "healthy" | "degraded" | "blocked" | "unknown"
  detail: "healthy" | "degraded" | "blocked" | "unknown"
  apply: "healthy" | "degraded" | "blocked" | "unknown"
  chat: "healthy" | "degraded" | "blocked" | "unknown"
  resume: "healthy" | "degraded" | "blocked" | "unknown"
}
```

The orchestrator should route work based on capability status, not only on platform connection status.

---

## Platform Capability Matrix

| Platform | Direct Apply | Messaging | First Contact | Reply Reading | Follow-up | Screening Qs | Attachment Upload | Cookie Session |
|---|---|---|---|---|---|---|---|---|
| LinkedIn | Easy Apply | Yes | Yes (InMail limited) | Yes | Yes | Yes | Yes | Yes (li_at) |
| Greenhouse | Browser Form | No | No | No | No | Yes | Yes | No (ephemeral browser) |
| Lever | Browser Form | No | No | No | No | Yes | Yes | No (ephemeral browser) |
| Boss直聘 | Chat-first | Yes (WebSocket) | Yes (打招呼) | Partial | Partial | No | Partial (not a V1 dependency) | Yes (browser-backed) |
| 猎聘 | Form Submit | Yes (inbox) | Headhunter-initiated | Yes | Limited | Some | Yes | Yes |
| 智联招聘 | Form Submit | App-gated / partial | Limited | Partial | Limited | Some | Yes | Yes |
| Indeed | Indeed Apply | Limited | No | Limited | No | Yes | Yes | Yes |
| 拉勾 | Form Submit | App-directed handoff | Limited | No (web not validated) | Limited | Some | Yes | Yes |
| 51Job | Form Submit | Special-flow / unvalidated | Limited | Unvalidated | Unvalidated | Some | Yes | Yes |

---

## Anti-Scraping Profile Per Platform

### LinkedIn

**Level: Very High**

- Device fingerprinting (canvas, WebGL, fonts)
- Behavioral analysis (scroll patterns, click intervals, dwell time)
- Account restriction for automated patterns (temporary → permanent ban)
- CAPTCHA on suspicious activity
- Undocumented rate limits that vary by account age, trust score, and activity history
- Headless browser detection (checks for `navigator.webdriver`, Chrome DevTools protocol)

**Mitigation Strategy:**

- Persistent browser profile with user-provided cookie (`li_at` token)
- Playwright in headed mode with stealth plugins
- Randomized delays: 3-8s page loads, 1-3s clicks (tunable per rule pack version)
- Human-like navigation patterns (variable scroll speed, occasional pauses)
- Starting daily action budget: 15 Easy Apply, 10 messages (conservative — adjusted based on observed behavior)
- Budget resets at UTC midnight (LinkedIn's observed reset window)
- Session health check every 30 minutes
- Immediately stop on CAPTCHA/security challenge → mark `PlatformConnection.verification_state = captcha_required`

**Important:** All numerical limits are initial conservative estimates based on observed behavior, not documented platform rules. They must be validated empirically during development and adjusted per rule pack version.

### Boss直聘

**Level: Extreme**

- Encrypted cookie (`__zp_stoken__`) generated by obfuscated client-side JS
- WebSocket-based chat with proprietary protocol
- Device fingerprinting (canvas, WebGL, screen, fonts)
- Behavioral analysis (mouse movement, scroll, click patterns)
- Slider CAPTCHA triggered frequently
- IP + account rate limiting
- Session tied to device fingerprint

**Mitigation Strategy:**

- Use real browser session via browser-backed login extraction after a stable web login
- Playwright in headed mode — no headless
- QR-only login is insufficient for reliable search/detail; browser-generated `__zp_stoken__` is required
- Treat session health as layered, not binary:
  - `me/profile`
  - `greet`
  - `search`
  - `detail`
  - `chat`
- Cookie rotation cadence must be empirically monitored; `2-4 hours` is only an initial conservative observation, not a guarantee
- Action budget: 10 greetings/day, 5 resume shares/day (extremely conservative)
- WebSocket connection maintained for chat — must use the same session context
- On slider CAPTCHA: immediately pause execution → mark `verification_state = captcha_required`
- Consider Puppeteer-extra-stealth for fingerprint evasion
- This is the highest-risk platform. Expect 20-30% failure rate on any given day.

### Greenhouse

**Level: Low**

- Public Job Board API available (no auth required for reading)
- Standard HTML forms for application submission
- Minimal CAPTCHA (some employers add Google reCAPTCHA)
- No aggressive bot detection
- Rate limits: ~60 requests/minute on API, ~30 applications/hour

**Mitigation Strategy:**

- Use Job Board API (`https://boards-api.greenhouse.io/v1/boards/{board}/jobs`) for discovery
- **Browser-based form submission** (not raw HTTP POST) — executor navigates to application page in ephemeral Playwright context, fills fields, handles CSRF/honeypot/reCAPTCHA, and submits
- Standard delays: 2-5 seconds between applications
- File upload via browser file input handler
- Highest reliability platform — target 95%+ success rate

### Lever

**Level: Low**

- Public Postings API (`https://api.lever.co/v0/postings/{company}`)
- Standard HTML forms
- Minimal anti-bot
- Rate limits: similar to Greenhouse

**Mitigation Strategy:**

- Same as Greenhouse: API-first discovery, browser-based form submission
- Postings API: `https://api.lever.co/v0/postings/{company}`
- Target 95%+ success rate

### 猎聘

**Level: Moderate**

- Slider CAPTCHA on suspicious activity
- IP rate limiting (moderate)
- CSS-based salary obfuscation (custom font rendering)
- Standard cookie session

**Mitigation Strategy:**

- User-provided cookie session
- Playwright with stealth
- Delays: 5-10 seconds between actions
- Action budget: 20 applications/day, 10 messages/day
- Font decoding for salary/data display
- Session health check every 1 hour

### 智联招聘

**Level: Low-Moderate**

- Font-based text obfuscation (custom web fonts map characters differently)
- Basic image CAPTCHA on repeated login
- IP rate limiting (less aggressive)
- Older architecture, some server-rendered pages

**Mitigation Strategy:**

- User-provided cookie session
- Browser-backed session should include both `www.zhaopin.com` and `i.zhaopin.com` domain context
- Direct HTTP requests may work for some endpoints, but browser-side validation is the source of truth for V1
- Font file download + character mapping for obfuscated fields
- Real web apply has been validated
- Do not assume stable browser-side direct messaging; treat `立即沟通` as app-gated / partial until proven otherwise
- Action budget: 30 applications/day (conservative starting point, not a product promise)
- Delays: 2-5 seconds
- Session health check every 2 hours

### 拉勾

**Level: Moderate**

- Browser login state is required
- Keyword search pages are stable and query-specific
- Detail routes are stable once position IDs are known
- Web-side apply is supported
- Browser-side messaging appears app-directed rather than directly operable

**Mitigation Strategy:**

- Use browser-backed login session
- Prefer direct keyword search routes for discovery
- Use validated detail-route template for JD reads
- Use web apply as the primary action path
- Treat communication as app handoff, not a V1 web-chat promise
- Support both online resume and attachment resume
- Preserve apply deduplication by checking for `已投递` state before repeated submission

### Indeed

**Level: High**

- Cloudflare protection
- hCaptcha triggered on heavy activity
- JavaScript-rendered content
- Bot detection via behavioral analysis
- Dynamic CSS class names

**Mitigation Strategy:**

- Persistent browser profile with user-provided session cookies
- Playwright in headed mode — must pass Cloudflare challenge within user's browser session
- Slow, human-like navigation with longer delays than other platforms
- Starting action budget: 10 Indeed Apply/day (conservative)
- Session health check every 1 hour
- High CAPTCHA interruption rate expected — may not be a reliable autonomous platform in v1
- Consider Indeed as "assistive" tier (user supervision recommended) rather than fully autonomous

---

## Platform Rule Pack Architecture

### What Is A Rule Pack

A rule pack is a versioned configuration bundle that tells a platform executor how to behave on a specific platform. It encodes platform-specific knowledge that cannot be expressed in generic skill definitions.

### Rule Pack Contents

```ts
type PlatformRulePack = {
  platform_code: string
  version: string

  // session
  session_type: "cookie" | "api_key" | "oauth" | "ephemeral_browser" | "stateless"
  session_extraction_method: "manual_export" | "browser_extension" | "oauth_flow"
  session_ttl_hours: number
  session_refresh_strategy: "manual" | "auto_refresh" | "none"

  // rate limits
  max_daily_applications: number
  max_daily_messages: number
  max_daily_searches: number
  min_delay_between_actions_ms: number
  max_delay_between_actions_ms: number
  burst_limit?: number               // max actions in 5-minute window

  // anti-bot
  anti_scraping_level: AntiScrapingLevel
  captcha_type?: "slider" | "image" | "hcaptcha" | "recaptcha" | "none"
  captcha_frequency: CaptchaFrequency
  fingerprint_evasion_required: boolean
  headless_allowed: boolean

  // execution
  apply_method: "browser_form" | "api_submit" | "chat_initiate" | "easy_apply" | "redirect_only"
  supports_bulk_apply: boolean
  requires_screening_answers: boolean
  attachment_method: "multipart_upload" | "url_reference" | "in_chat" | "not_supported"
  max_resume_size_mb: number
  accepted_resume_formats: string[]   // e.g. ["pdf", "docx"]

  // messaging
  messaging_protocol: "http_inbox" | "websocket_chat" | "email" | "none"
  first_contact_method: "greeting_action" | "inmail" | "direct_message" | "not_supported"
  reply_reading_method: "polling" | "websocket" | "email_parse" | "not_supported"
  reply_poll_interval_seconds?: number

  // safety
  budget_reset_timezone: string       // e.g. "UTC", "Asia/Shanghai"
  daily_action_budget: PlatformActionBudget
  health_check_interval_minutes: number
  capability_health_model?: string[]  // e.g. ["search", "detail", "apply", "chat", "resume"]
  on_captcha_action: "pause_and_notify" | "auto_solve" | "skip_action"
  on_rate_limit_action: "backoff" | "pause_platform" | "skip_action"
  on_session_expired_action: "notify_user" | "auto_refresh"

  // platform-specific metadata
  custom_fields?: Record<string, unknown>
}

type PlatformActionBudget = {
  applications: number
  messages: number
  searches: number
  profile_views: number
  total_actions: number
}
```

### V1 Rule Packs

| Platform | Session Type | Apply Method | Messaging | Headless | CAPTCHA | Daily Apps | Burst (5min) |
|---|---|---|---|---|---|---|---|
| `linkedin` | cookie | easy_apply | http_inbox | No | rare | 15 | 3 |
| `greenhouse` | ephemeral_browser | browser_form | none | Yes | rare | 30 | 5 |
| `lever` | ephemeral_browser | browser_form | none | Yes | none | 30 | 5 |
| `boss_zhipin` | cookie | chat_initiate | websocket_chat | No | frequent | 10 | 2 |
| `liepin` | cookie | browser_form | http_inbox | No | rare | 20 | 3 |
| `zhaopin` | cookie | browser_form | http_inbox | Yes | rare | 30 | 4 |
| `lagou` | cookie | browser_form | none | Yes | rare | 30 | 4 |

Note: All values use canonical enum values from `DATA_MODEL_SPEC.md`. `CaptchaFrequency` values are `none | rare | frequent | always`.

---

## Platform Executor Architecture

### Executor Design

Each platform has a dedicated executor module that:

1. Accepts an `AgentTask` from the orchestrator
2. Loads the platform's rule pack
3. Validates `PlatformConnection` session
4. Executes the platform-specific action
5. Records results in `SubmissionAttempt`, `ConversationMessage`, or `TimelineEvent`
6. Updates `PlatformConnection` health state

```
┌─────────────────────────────────────┐
│        Platform Executor            │
│                                     │
│  ┌─────────────┐  ┌──────────────┐  │
│  │ Rule Pack   │  │ Session      │  │
│  │ Loader      │  │ Validator    │  │
│  └─────────────┘  └──────────────┘  │
│                                     │
│  ┌─────────────┐  ┌──────────────┐  │
│  │ Action      │  │ Result       │  │
│  │ Runner      │  │ Recorder     │  │
│  └─────────────┘  └──────────────┘  │
│                                     │
│  ┌─────────────┐  ┌──────────────┐  │
│  │ Rate Limit  │  │ Health       │  │
│  │ Guard       │  │ Monitor      │  │
│  └─────────────┘  └──────────────┘  │
└─────────────────────────────────────┘
```

### Action Types Per Platform

| Action | LinkedIn | Greenhouse | Lever | Boss直聘 | 猎聘 | 智联 | 拉勾 |
|---|---|---|---|---|---|---|---|
| Search/Discover | API + scrape | API | API | Scrape | Scrape | Scrape | Search page |
| Apply | Easy Apply flow | Browser form | Browser form | Send greeting | Browser form | Browser form | Browser form |
| Upload Resume | In Easy Apply | Multipart | Multipart | Partial / not core V1 path | Multipart | Multipart | Multipart / attachment |
| Send Message | Messaging API | N/A | N/A | WebSocket | HTTP inbox | App-gated / partial | App-directed handoff |
| Read Reply | Poll inbox | N/A | N/A | WebSocket / partial | Poll inbox | Partial | Not validated |
| Follow Up | Send message | N/A | N/A | Send message / partial | Send message | Limited | Not validated |

### Supporting Infrastructure

The executor system requires the following infrastructure components:

1. **Browser Profile Manager**: manages persistent Playwright browser contexts per user per platform, stored encrypted on the orchestration worker
2. **Session Broker**: validates sessions before action, handles expiry detection, coordinates token refresh
3. **Rate Limit Guard**: enforces per-platform daily budgets and burst limits using `PlatformDailyUsage` records
4. **CAPTCHA Handoff Service**: detects CAPTCHA challenges, pauses automation, notifies user, resumes after manual resolution
5. **Form Checkpoint System**: for multi-step forms (Workday, some Greenhouse forms), saves progress so a failure mid-form doesn't require full restart
6. **DOM Drift Canary**: lightweight periodic checks that verify key page selectors still work — detects platform UI changes early before they cause silent failures
7. **Token Kill Switch**: emergency invalidation of all stored sessions for a user or platform — triggered by admin or automated security heuristics

These components are deployed alongside the orchestration worker on Fly.io.

### Executor Isolation

Each platform executor runs independently:

- Separate rate limit counters per platform
- Separate session validation
- Separate error handling
- A failure on LinkedIn does not block execution on Greenhouse
- Each executor uses its own browser context (if browser-based) or HTTP client (if API-based)

---

## Session Management

### Security Model

Session material is the highest-sensitivity data in the system. A compromised session token gives full account access.

**Principles:**

1. Session tokens are encrypted at rest via Supabase Vault — never stored in plaintext
2. Session tokens are never returned in any API response
3. Session tokens are never logged — only fingerprints (hashes) appear in audit logs
4. Emergency purge: admin can invalidate all stored sessions for a user in one operation
5. Session material is scoped to the orchestration worker — frontend never sees or handles tokens
6. Each stored session includes: token fingerprint, grant timestamp, user-agent at grant time, and IP at grant time

### Session Acquisition Flow

```
User authorizes platform via browser extension
  → Extension sends session material over HTTPS to backend
  → Backend encrypts via Supabase Vault
  → PlatformConnection.session_token_ref set (encrypted reference)
  → PlatformConnection.session_granted_at recorded
  → PlatformConnection.session_grant_scope recorded
  → PlatformConsentLog entry: action = "granted", with IP, UA, token fingerprint
  → Health check validates session works
  → PlatformConnection.status → "active"
```

### Session Types

| Type | Platforms | Acquisition | Storage | Refresh |
|---|---|---|---|---|
| Cookie injection | LinkedIn, Boss直聘, 猎聘, 智联, Indeed | Browser extension export | Encrypted in Vault | Manual re-export |
| Public API | Greenhouse, Lever (discovery) | No auth needed | Not stored | N/A |
| Browser automation | Greenhouse, Lever (submission) | Real browser session managed by executor | Ephemeral (not persisted) | Per-action |

**Important:** Greenhouse/Lever submission is NOT a simple stateless POST. The executor must:
- Navigate to the application page in a real browser context
- Handle CSRF tokens, honeypot fields, and occasional reCAPTCHA
- Fill multi-step forms with proper field detection
- Upload files via the browser's file input handler

### Cookie Extraction Methods

**V1: Browser extension**

1. User installs Haitou OS browser extension
2. User logs into the platform normally in their browser
3. Extension detects login completion and extracts relevant cookies
4. Extension sends cookies to backend over TLS with a one-time authorization code
5. Backend validates the code, encrypts cookies, stores reference
6. Extension confirms success; user sees "platform connected"

**Security constraints:**
- Extension must request minimum permissions (only cookies for specific domains)
- One-time auth codes expire in 5 minutes
- Backend validates origin and timestamp
- Extension does not store cookies locally after transmission

### Browser Profile Management

For platforms requiring browser-based execution (LinkedIn, Boss直聘, Indeed, and Chinese platforms):

- Each `PlatformConnection` has an associated **persistent browser profile** stored on the orchestration worker
- Browser profiles include: cookie jar, local storage, device fingerprint markers
- Profiles are isolated per user per platform — no sharing between users
- Profiles are stored encrypted on the worker's filesystem
- On worker restart, profiles are re-hydrated from encrypted storage

This addresses Boss直聘's device-binding requirement — the same browser fingerprint is presented consistently.

### Session Health Monitoring

| Platform | Check Interval | Check Method | TTL (approximate) |
|---|---|---|---|
| LinkedIn | 30 min | Lightweight authenticated page fetch | ~24h |
| Boss直聘 | 15 min | Authenticated API probe | ~2-4h |
| Greenhouse | N/A | Per-action (ephemeral browser) | N/A |
| Lever | N/A | Per-action (ephemeral browser) | N/A |
| Indeed | 60 min | Authenticated page fetch | ~12h |
| 猎聘 | 60 min | Authenticated page fetch | ~12h |
| 智联 | 120 min | Authenticated page fetch | ~24h |
| 拉勾 | 120 min | Authenticated page fetch + apply-state check | ~24h |

**Note:** TTL values are approximate and empirically observed. They are not guaranteed by platforms and may change. The health monitoring system treats these as initial estimates and adjusts based on actual expiry patterns.

**Important Chinese-platform correction:** session health must be tracked per capability, not just as one binary `connected / expired` state. At minimum, the executor should separately model:

- `search`
- `detail`
- `apply`
- `chat`
- `resume`

This is required because real testing showed:

- Boss can keep `greet` or `me` alive after `search` degrades
- 智联 can keep `detail` / `resume` reachable even when `recommend` weakens
- 拉勾 can keep `search` and `apply` healthy while browser chat remains unavailable by design

### Session Expiry Handling

1. `PlatformConnection.status` → `session_expired`
2. `PlatformConsentLog` entry: action = "expired"
3. `TimelineEvent` created (visibility: "feed")
4. All pending tasks for this platform → `blocked`
5. User notified via platform coverage page
6. User must re-authorize via browser extension

### Emergency Session Purge

If a security concern arises:

1. Admin or user triggers purge for a specific platform or all platforms
2. All `session_token_ref` values for the affected connections are deleted from Vault
3. All browser profiles for those connections are wiped
4. `PlatformConsentLog` entry: action = "revoked"
5. All connections → `available_unconnected`

---

## Safety And Risk Management

### Platform Ban Prevention

The system must prevent account bans at all costs. A banned account is catastrophic for the user.

Rules:

1. **Conservative budgets**: always stay well below observed rate limits
2. **Human-like behavior**: randomized delays, variable patterns, natural navigation
3. **Immediate halt on warning signs**: CAPTCHA, unusual redirects, error spikes
4. **No parallel sessions**: only one active automation session per platform per user
5. **Graceful degradation**: if a platform becomes unstable, pause that platform, not the whole team

### Action Budget Enforcement

Each platform executor tracks daily action counts using the `PlatformDailyUsage` entity defined in `DATA_MODEL_SPEC.md`.

When daily budget is exhausted:
- Platform executor stops accepting new tasks for that platform
- Orchestrator routes work to other available platforms
- Budget resets per platform's observed reset window (specified in each rule pack; LinkedIn uses UTC midnight, Chinese platforms use CST midnight)

### CAPTCHA Response Protocol

When a CAPTCHA is detected:

1. Executor immediately stops current action
2. `PlatformConnection.verification_state` → appropriate CAPTCHA type
3. `PlatformConnection.requires_user_action` → `true`
4. All pending tasks for this platform → `blocked`
5. `TimelineEvent` created (visibility: "feed") — "Boss直聘 需要手动验证"
6. User resolves CAPTCHA manually
7. After resolution: `verification_state → none`, tasks unblocked

### Graduated Backoff Strategy

| Consecutive Failures | Action |
|---|---|
| 1-2 | Retry with increased delay |
| 3-5 | Pause platform for 15 minutes |
| 6-10 | Pause platform for 1 hour |
| 11+ | Pause platform indefinitely → require user intervention |

---

## Platform-Attached Skills

### Purpose

Platform-attached skills adapt generic agent skills to platform-specific contexts. They do not replace core skills; they extend them.

### Examples

| Skill | Platform | What It Does |
|---|---|---|
| `linkedin-easy-apply` | LinkedIn | Fills Easy Apply modal, handles screening questions |
| `greenhouse-form-submit` | Greenhouse | Maps fields to Greenhouse form structure |
| `lever-form-submit` | Lever | Maps fields to Lever form structure |
| `boss-greeting-compose` | Boss直聘 | Composes platform-appropriate greeting message |
| `boss-chat-reply` | Boss直聘 | Reads and responds to WebSocket chat messages |
| `zhaopin-web-apply` | 智联 | Executes validated browser-side apply flow |
| `lagou-attachment-resume` | 拉勾 | Prepares and uploads tailored attachment resume before apply |
| `linkedin-inmail-draft` | LinkedIn | Drafts InMail messages within character/tone limits |

### Skill Override Rules

Platform-attached skills may NOT:

- Override role authority boundaries
- Bypass truthfulness policy
- Skip private-channel handoff rules
- Exceed the platform's action budget

Platform-attached skills may:

- Adapt message tone to platform conventions
- Adjust form field mapping per platform
- Use platform-specific APIs or endpoints
- Apply platform-specific formatting rules

---

## Platform Discovery Integration

### How Platforms Feed Opportunity Discovery

| Platform | Discovery Method | Data Quality | Freshness |
|---|---|---|---|
| LinkedIn | Search API (scrape) + job alerts | High | Real-time |
| Greenhouse | Public Job Board API | High | Near real-time |
| Lever | Public Postings API | High | Near real-time |
| Boss直聘 | Search scrape | Medium (obfuscated) | Real-time |
| 猎聘 | Search scrape | Medium | Daily |
| 智联 | Search scrape | Medium (font obfuscation) | Daily |
| 拉勾 | Keyword search scrape | Medium-High | Daily |

### Cross-Platform Deduplication

The same job may appear on multiple platforms. The `Opportunity.canonical_group_id` field groups these.

Dedup signals:

- Same company name + similar job title + same location
- URL patterns pointing to the same ATS job ID
- JD text similarity above threshold

Dedup should be **conservative** — prefer keeping both entries over incorrectly collapsing them.

---

## Legal And Compliance Notes

### Terms of Service

Automating actions on these platforms may violate their Terms of Service. The product operates on the user's behalf with their explicit consent and their own credentials.

### Risk Mitigation

1. User explicitly authorizes the system to act on their behalf — consent is recorded with timestamp, scope, and audit trail
2. The system stores session material (cookies/tokens) encrypted at rest — this is session delegation, not credential storage (the system never sees passwords)
3. Actions are performed at human-like pace within conservative budgets
4. All automated actions are auditable; note that external actions (submissions, messages sent) are NOT reversible once executed — this is why conservative budgets and quality gates are critical
5. Users can revoke platform authorization and purge stored sessions at any time
6. The system does not bypass authentication — it uses the user's existing authenticated session
7. Platform conversation data and resume files are encrypted at rest and never shared externally

### Data Privacy

- Platform conversation data may contain PII — encrypted at rest
- Resume files stored in encrypted storage — never exposed publicly
- Session tokens encrypted via Supabase Vault — never returned in API responses
- `PlatformConsentLog` maintains full audit trail of authorization grants

---

## What This Spec Does Not Define

- Individual platform executor implementation code
- Browser extension specification for cookie extraction
- Detailed WebSocket protocol reverse-engineering for Boss直聘
- Platform-specific CSS/font obfuscation decoding logic
- Dynamic CAPTCHA solving strategies (v1 relies on manual user resolution)

These are implementation-level concerns that should be handled during development.

## Platform Reliability Tiers

Not all platforms can achieve the same level of autonomous operation. The system should set honest expectations:

| Platform | Autonomy Level | Expected Reliability | Notes |
|---|---|---|---|
| Greenhouse | Fully autonomous | 95%+ | API-based discovery, browser-based submission |
| Lever | Fully autonomous | 95%+ | API-based discovery, browser-based submission |
| 智联招聘 | Fully autonomous | 85%+ | Cookie-based, lower anti-bot |
| 拉勾 | Mostly autonomous | 80%+ | Search/detail/apply strong, browser chat not a V1 path |
| 猎聘 | Mostly autonomous | 80%+ | Occasional CAPTCHA interruption |
| LinkedIn | Supervised autonomous | 70%+ | Account restriction risk, frequent detection |
| Boss直聘 | Supervised autonomous | 60%+ | Aggressive anti-bot, short session TTL |
| Indeed | Assistive only | 50%+ | Cloudflare protection, high CAPTCHA rate |
| 51Job | Assistive only | 40%+ | Search/resume workable, but detail/apply/chat blocked or unvalidated |

"Supervised autonomous" means the system operates automatically but the user should expect periodic interruptions requiring manual intervention (CAPTCHA, session refresh).

"Assistive only" means the system helps with preparation and form-filling but the user must be actively involved.

## Final Platform Principle

Platform integration is the highest-risk technical area of Haitou OS.

The system should:

1. **Start with ATS platforms** (Greenhouse, Lever) to prove the end-to-end pipeline with high reliability
2. **Add LinkedIn** as the first challenging platform — supervised mode from the start
3. **Add Chinese platforms** using validated order and role separation:
   - 智联 first (`search + detail + apply`)
   - 拉勾 second (`search + detail + apply + attachment`)
   - Boss直聘 third (`search + conversation`, supervised from the start)
   - 51Job deferred until anti-bot / supervised-mode work is mature
4. **Always prioritize account safety** over action volume — one ban is worse than 100 missed applications
5. **Treat every platform as independently degradable** — failures on one platform never stop the team
6. **Be honest with users** about expected reliability per platform — do not promise full autonomy where it cannot be delivered
7. **Invest in DOM drift canaries** — platform UI changes are the #1 cause of silent failures
8. **Respect the region pipeline split** — Chinese platforms use `passthrough` (original resume, no tailoring), English platforms use `full_tailored` (resume + cover letter + localization per application). This is a product decision driven by platform constraints, not a temporary shortcut. It reduces anti-bot exposure on Chinese platforms and eliminates impractical per-application resume upload cycles.

If a platform becomes unreliable, the team continues operating on other platforms. The user's job search never stops because one platform is down.
