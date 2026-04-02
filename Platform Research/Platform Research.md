# Platform Research

## Purpose

This file is the lightweight working log for platform execution research inside Haitou OS.

It exists to track:

- external repos or references worth testing
- what we are trying to validate
- what has been confirmed vs what is still only a hypothesis
- what may later become execution-layer skills

This is not a final spec.
This is not a locked implementation document.

It is a research log.

## Current Research Target

### External Repository

- OpenCRL / `boss-cli`
- GitHub: [https://github.com/jackwener/boss-cli](https://github.com/jackwener/boss-cli)

## Why This Repo Matters

This repository appears to be a concrete reference for:

- BOSS直聘 login/session handling
- cookie-based authenticated access
- job search and retrieval flows
- greeting / recruiter contact flows

If reusable, it may help us:

- validate whether BOSS直聘 can become a practical Chinese-platform executor
- identify what belongs in executor code vs rule pack vs future skill layer
- provide a starting point for comparing other Chinese platforms

## Chinese Platform Validation Order

Current working order:

1. Boss直聘
2. 智联招聘
3. 拉勾
4. 51Job

English platforms will be tested after the Chinese platform path is clearer.

## Automation Assets

Current reusable local helpers:

- [chrome_tab_probe.sh](/Users/oxjames/Downloads/CC_testing/海投助手OS/Platform%20Research/chrome_tab_probe.sh)
- [zhaopin_browser_probe.sh](/Users/oxjames/Downloads/CC_testing/海投助手OS/Platform%20Research/zhaopin_browser_probe.sh)
- [zhaopin_safe_probe.sh](/Users/oxjames/Downloads/CC_testing/海投助手OS/Platform%20Research/zhaopin_safe_probe.sh)

Purpose:

- inspect active Chrome tabs without manually clicking through DevTools
- capture current URL
- capture page-visible cookies
- capture visible action controls
- capture job-detail links and detail-page JD blocks
- run a low-risk passive probe across recommend, detail, and resume pages

These scripts are still research-stage tools, not end-user product features.

## What We Want To Validate

For each platform, we want to verify:

1. login / cookie / session acquisition
2. job search
3. job detail retrieval
4. first contact or equivalent action
5. reply reading
6. resume exchange or attachment path
7. major anti-bot / failure points

## Research Notes

### Status

- `Platform Research` directory created
- repository link recorded
- local clone completed: `Platform Research/boss-cli`
- initial source review completed
- local environment created successfully with `uv`
- CLI boot verified locally
- local unit/auth tests passed

### Verified Local Results

- `boss-cli` cloned successfully
- `.venv` created successfully
- `./.venv/bin/boss --help` runs successfully
- local tests passed:
  - `tests/test_cli.py`
  - `tests/test_auth.py`
  - total: `111 passed`

### Important Note

The repository is locally runnable as a Boss-specific CLI.

This does **not** mean:

- Boss real-session login is already validated on this machine
- greeting / chat / recruiter flows are already validated live
- the same implementation automatically works for 拉勾 / 智联 / 51Job

It only means:

- the codebase is healthy enough to study and reuse
- the local structure is executable
- it is a practical reference implementation for a Boss executor path

## Initial Reuse Assessment: boss-cli

### What Looks Reusable

1. `authenticated CLI / adapter shape`
- the repository already separates:
  - auth
  - client
  - command layer
  - structured output
- this is useful as a reference for a future platform executor layout

2. `cookie/session-first approach`
- the project treats browser cookies as the primary session material
- this is highly relevant for Chinese recruitment platforms

3. `anti-detection request behavior`
- jitter
- retry
- backoff
- response cookie merge
- endpoint-specific headers
- these patterns are useful for executor-layer design

4. `Boss-specific API surface discovery`
- endpoint constants
- auth cookie requirements
- greet / chat / search related request paths
- this can help us evaluate Boss executor feasibility

### What Is Not Directly Reusable

1. `not a multi-platform framework`
- it is a Boss-only CLI
- all base URLs, endpoints, required cookies, and filters are hard-coded for `zhipin.com`

2. `not yet a Haitou OS skill`
- it is closer to a platform-specific executor prototype than a reusable skill contract

3. `platform assumptions do not transfer automatically`
- Boss chat model
- Boss cookie model
- Boss request headers
- Boss anti-bot handling
- these must not be copied directly to 拉勾 / 智联 / 51Job

## Current Next Step

1. inspect the real Boss login / search / greet flow boundaries
2. identify which parts belong to:
   - future execution-layer skill candidates
   - rule pack only
   - executor implementation details
3. compare Boss patterns against 智联 / 拉勾 / 51Job rather than assuming direct portability

## Experiment Log

### Experiment 1: Real Boss status check

Command:

```bash
./.venv/bin/boss status --json
```

Result:

- command executed successfully
- returned:

```json
{"authenticated": false, "credential_present": false}
```

Observed issue:

- cookie extraction failed automatically
- no reusable local Boss credential was found

### Experiment 2: Real Boss login via Chrome cookie path

Command:

```bash
./.venv/bin/boss login --cookie-source chrome
```

Result:

- browser cookie extraction failed
- tool fell back to QR login
- QR login request failed before login could continue

Observed issues:

1. `Chrome cookie extraction did not succeed`
   Possible causes:
   - no active Boss login in local Chrome profile
   - browser cookie access permissions/keychain access issue
   - tool could not find a usable `zhipin.com` session

2. `QR login network request failed`
   Error class:
   - `httpx.ConnectError`

Interpretation:

- Boss local CLI is runnable
- but real Boss login is **not yet proven**
- first live attempt exposed environment/platform access blockers instead of proving platform execution

### Current Repair Direction

We need to distinguish among:

1. no valid Boss browser session exists locally
2. browser cookie extraction is blocked by OS/browser permission constraints
3. direct network access to Boss login endpoints is blocked in the current execution context

### Experiment 3: Retest with higher permissions

Commands:

```bash
./.venv/bin/boss status --json
./.venv/bin/boss login --cookie-source chrome
```

Observed result:

- `boss status --json` still returned:

```json
{"authenticated": false, "credential_present": false}
```

- Chrome cookie extraction still failed
- `boss login --cookie-source chrome` entered QR login fallback and stayed in interactive waiting mode instead of failing immediately

Interpretation:

- this is **not only** a sandbox permission issue
- the machine currently does not expose a directly reusable Boss browser session to the tool
- QR login path appears reachable enough to enter interactive waiting mode
- full Boss authentication still requires human participation (scan / confirm) or manual cookie injection

### Current Confirmed Conclusion

At this stage we have proven:

1. the repository is locally runnable
2. the Boss login flow is partially reachable
3. automatic local Chrome cookie reuse is not currently working on this machine
4. live authenticated Boss execution is **not yet confirmed**

### Experiment 4: QR login completion

Observed result after user scan:

- QR login completed successfully
- credential file was saved to:
  - `~/.config/boss-cli/credential.json`
- saved cookie count: `4`
- missing cookie:
  - `__zp_stoken__`

Tool warning:

- QR login can obtain session cookies
- but `__zp_stoken__` is generated by browser JS and is not available from QR-only login
- some APIs may fail until a browser-backed session is used

### Experiment 5: Auth status after QR login

Command:

```bash
./.venv/bin/boss status --json
```

Result:

```json
{
  "credential_present": true,
  "cookie_count": 4,
  "cookies": ["bst", "wbg", "wt2", "zp_at"],
  "authenticated": false,
  "search_authenticated": false,
  "recommend_authenticated": false,
  "reason": "缺少关键 Cookie: __zp_stoken__"
}
```

Conclusion:

- QR login alone does **not** produce a fully usable Boss execution session

### Experiment 6: Live search after QR login

Command:

```bash
./.venv/bin/boss search 'Python' --city 全国 --json
```

Final result under higher-permission execution:

```json
{
  "ok": false,
  "schema_version": "1",
  "data": null,
  "error": {
    "code": "not_authenticated",
    "message": "环境异常 (__zp_stoken__ 已过期)。请重新登录: boss logout && boss login"
  }
}
```

What this proves:

- the main blocker is **not** only network access
- the decisive blocker is the missing browser-generated `__zp_stoken__`
- for Boss, a truly usable session likely requires:
  - an already logged-in browser session
  - browser cookie extraction that includes `__zp_stoken__`
  - or a manual full-cookie injection path

## Current Working Conclusion

For Boss直聘:

- local codebase works
- QR login works partially
- QR login is insufficient for live authenticated search
- full Boss execution requires a browser-backed complete session model

This is a strong signal that Boss should be treated as:

- high-friction
- browser-dependent
- not a simple cookie-only or QR-only platform path

### Experiment 7: Browser-backed login retry after stable Chrome web session

Commands:

```bash
./.venv/bin/boss login --cookie-source chrome
./.venv/bin/boss search 'Python' --city 全国 --json
```

Observed result:

- `boss login --cookie-source chrome` succeeded
- tool reported:

```text
✅ 登录成功！ (15 cookies)
```

- live search succeeded and returned real Boss search results

Interpretation:

- once Chrome held a stable real Boss web session, browser cookie extraction worked
- this browser-backed path succeeded where QR-only login was insufficient
- the decisive difference was the presence of a fuller browser-generated session

### Important Note About One Earlier Status Check

One `boss status --json` run still showed:

- `authenticated: false`
- missing `__zp_stoken__`

This happened because `status` and `login` were executed in parallel during that round, so the status check completed before the browser-backed login refresh finished.

The successful live search is the stronger proof of actual usability.

## Updated Confirmed Conclusion For Boss直聘

We have now proven:

1. `boss-cli` is locally runnable
2. QR login alone is not enough for full authenticated execution
3. browser-backed login from an already stable Chrome Boss session can produce a usable live session
4. real Boss search can succeed from the extracted browser session

## Reusable Insight From This Experiment

Boss直聘 should be modeled as:

- `browser-session dependent`
- `JS-generated session dependent`
- `not reliably solvable via QR-only login`
- `a platform where executor viability depends on full browser-state extraction`

### Reminder

Only validated behavior should later be promoted into:

- execution-layer spec
- platform-attached skill
- executor contract

## Boss Follow-up Experiments

### Experiment 8: Read-only authenticated profile check

Command:

```bash
./.venv/bin/boss me --json
```

Result:

- command succeeded
- returned real account profile data, including:
  - name
  - age
  - degree
  - masked mobile
  - masked WeChat
  - resumeCount

What this proves:

- at that moment, the Boss session was strong enough to access authenticated profile APIs
- Boss session health is not binary
- some authenticated APIs may still work even when stricter search-related checks later fail

### Experiment 9: Session health re-check after successful browser-backed login

Command:

```bash
./.venv/bin/boss status --json
```

Result:

```json
{
  "credential_present": true,
  "cookie_count": 15,
  "cookies": [
    "HMACCOUNT",
    "Hm_lpvt_194df3105ad7148dcf2b98a91b5e727a",
    "Hm_lvt_194df3105ad7148dcf2b98a91b5e727a",
    "__a",
    "__c",
    "__g",
    "__l",
    "__zp_seo_uuid__",
    "__zp_stoken__",
    "ab_guid",
    "bst",
    "tgw_l7_route",
    "wbg",
    "wt2",
    "zp_at"
  ],
  "authenticated": false,
  "search_authenticated": false,
  "recommend_authenticated": true,
  "reason": "search: 环境异常 (__zp_stoken__ 已过期)。请重新登录: boss logout && boss login"
}
```

Interpretation:

- Boss session health must be modeled per capability, not as a single boolean
- `recommend` may still work while `search` is already considered invalid
- having `__zp_stoken__` present is not enough by itself; freshness also matters
- health checks should distinguish at least:
  - profile readable
  - recommend usable
  - search usable

### Experiment 10: Sending / recruiter-contact capability boundary inspection

Code paths inspected:

- `boss_cli/commands/social.py`
- `boss_cli/client.py`
- `boss_cli/constants.py`

Observed implementation:

- the only explicit send action exposed by this repo is:
  - `boss greet <securityId>`
- underlying client method:
  - `BossClient.add_friend(security_id, lid="")`
- endpoint used:
  - `/wapi/zpgeek/friend/add.json`

Current conclusion:

- this repo supports a Boss-style `打招呼 / 建立沟通关系` action
- this is **not yet proven** by our live account test, because we intentionally did **not** send a real greeting to a real HR during research
- no separate live-tested recruiter messaging send flow has been proven yet

### Experiment 11: Resume sending support inspection

Observed from code:

- no dedicated local-file resume upload command was found in this repo
- no separate endpoint for arbitrary local resume file upload was found in the current CLI surface
- the social/send path is still the same `friend/add` path

Observed from sampled live job details in earlier successful detail checks:

- `oneKeyResumeInfo.canSendResume = false`
- `oneKeyResumeInfo.canSendPhone = false`
- `oneKeyResumeInfo.canSendWechat = false`

Current conclusion:

- this repo does **not** currently prove support for local resume file upload sending
- Boss resume sending appears to be constrained by platform-side state on a per-job basis
- if resume sending exists, it is more likely tied to Boss page/platform state than to arbitrary local file upload from this CLI
- for Haitou OS, resume exchange should currently be modeled as:
  - platform-gated
  - job-specific
  - not yet validated as a stable executor capability

### Experiment 12: Chat list read test

Command:

```bash
./.venv/bin/boss chat --json
```

Result:

```json
{
  "ok": true,
  "schema_version": "1",
  "data": {}
}
```

Interpretation:

- the read-only chat list endpoint is reachable
- current account did not return a useful friend list payload in this run
- this is not enough to prove end-to-end conversational automation

### Experiment 13: Cookie health mechanism inspection

Observed from source:

- saved credential auto-refresh threshold:
  - `7 days`
- auth-health cache TTL:
  - `45 seconds`
- login verification path:
  - validates real authenticated APIs instead of trusting local cookie presence only
- failed browser-backed login behavior:
  - if verification fails, the tool clears the saved credential file

Observed live behavior:

- one successful browser-backed login later degraded into:
  - profile still readable
  - recommend still usable
  - search failing as expired
- a subsequent `boss login --cookie-source chrome` attempt failed verification
- after that failure, local credential file no longer existed

What this means:

- Boss session freshness can degrade faster than a simple "7 day TTL" would suggest
- the `7 days` value is only the tool's saved-cookie refresh threshold, not a guarantee of actual Boss session lifetime
- real platform-side session validity is stricter and more dynamic
- login recovery logic for Haitou OS must be careful, because a failed refresh attempt may erase the previously saved local credential

### Experiment 14: Search frequency / anti-ban testing boundary

What we inspected:

- request jitter
- random long pauses
- burst penalty delay
- exponential cooldown on rate-limit

Observed from source:

- base request delay with Gaussian jitter
- 5% chance of 2-5s pause
- extra burst penalties when recent request density is high
- rate-limit code `9` triggers cooldown escalation:
  - 10s
  - 20s
  - 40s
  - 60s

Important safety decision:

- we did **not** aggressively stress-test live search frequency on the real account
- we did **not** intentionally probe for ban thresholds

Reason:

- this would create unnecessary account/platform risk during research

Current conclusion:

- the repo includes conservative anti-detection behavior worth reusing
- but we do **not** yet have a validated real-world safe request-frequency threshold for Boss

### Experiment 15: Applied / interview read-path probe

Commands:

```bash
./.venv/bin/boss applied --json
./.venv/bin/boss interviews --json
```

Result:

- both commands failed in the current execution environment
- failure shape was network/DNS related, not a Boss business-rule rejection

Observed errors:

```json
{
  "code": "api_error",
  "message": "Request failed after 3 retries: [Errno 8] nodename nor servname provided, or not known"
}
```

Interpretation:

- not every read-only Boss path behaved consistently in the current execution environment
- besides platform auth and anti-bot logic, executor health must also consider:
  - local network context
  - DNS/proxy stability
  - endpoint-specific reachability
- this result does **not** prove Boss `applied` or `interviews` APIs are unusable in general
- it only proves they were not stably reachable in this test environment

### Experiment 16: Controlled single-send greet test

Goal:

- validate whether this CLI can directly initiate first contact to a specific Boss / HR for a specific job

Preparation:

- browser-backed login could not be refreshed at this moment
- we switched to a controlled QR-login session
- QR login succeeded again, but only produced:
  - `bst`
  - `wbg`
  - `wt2`
  - `zp_at`

Command:

```bash
./.venv/bin/boss greet <securityId> --json
```

Live result:

```json
{
  "ok": true,
  "schema_version": "1",
  "data": {
    "showGreeting": true,
    "greeting": "Boss，您好",
    "bossSource": 0,
    "securityId": "...",
    "source": "",
    "encBossId": "..."
  }
}
```

What this proves:

- a controlled single Boss first-contact send **can succeed**
- the CLI can send to a specific job/Boss target via `securityId`
- this worked even under a QR-only partial cookie set

Very important nuance:

- this means `greet/send` capability is looser than `search` capability
- in this repo, a session can be:
  - invalid for search
  - invalid for recommend
  - but still able to perform at least some recruiter-contact actions

### Experiment 17: Post-send readback probe

Commands:

```bash
./.venv/bin/boss chat --json
./.venv/bin/boss status --json
```

Result:

- `boss chat --json` returned:

```json
{
  "ok": true,
  "schema_version": "1",
  "data": {}
}
```

- `boss status --json` returned:

```json
{
  "credential_present": true,
  "cookie_count": 4,
  "cookies": ["bst", "wbg", "wt2", "zp_at"],
  "authenticated": false,
  "search_authenticated": false,
  "recommend_authenticated": false,
  "reason": "缺少关键 Cookie: __zp_stoken__"
}
```

Interpretation:

- after a successful greet, the chat-list read path still did not produce a useful conversation list in this test
- the session still remained "not authenticated" by the repo's health definition
- therefore:
  - successful send does **not** imply healthy search session
  - successful send does **not** imply immediate readable chat state

### Experiment 18: Delayed chat readback after successful greet

Command:

```bash
./.venv/bin/boss chat --json
```

Timing:

- re-checked again after an additional waiting period following the successful greet

Result:

```json
{
  "ok": true,
  "schema_version": "1",
  "data": {}
}
```

Interpretation:

- this does not look like a simple immediate-refresh delay
- at least in this run, `greet` success did **not** translate into a readable chat-list thread within the short follow-up window
- possible explanations include:
  - Boss only exposes the thread after additional platform-side state changes
  - the friend-list endpoint is more restrictive than the greet endpoint
  - the current partial QR session is enough for send, but not enough for chat-list readback
  - the recruiter must interact before the thread becomes visible in this list

## Updated Boss Capability Matrix (Observed)

- `profile read`: works in some partial-session states
- `recommend`: sometimes works in states where search fails
- `search`: requires stricter / fresher browser-backed session
- `single greet/send`: now validated as working
- `chat list readback`: endpoint reachable, but not yet validated as reliably returning the new thread
- `resume send`: still unvalidated
- `local resume upload`: no proof found

### Experiment 19: Additional QR-session capability probes

Commands:

```bash
./.venv/bin/boss recommend --json
./.venv/bin/boss history --json
./.venv/bin/boss detail <securityId> --json
```

Results:

- `recommend` failed with DNS/network retry exhaustion in the current environment
- `history` failed with DNS/network retry exhaustion in the current environment
- `detail` failed with:

```json
{
  "code": "not_authenticated",
  "message": "环境异常 (__zp_stoken__ 已过期)。请重新登录: boss logout && boss login"
}
```

Interpretation:

- current QR-only session is not a general-purpose read session
- `greet` is one of the few actions we have directly validated as still working in this weaker session state
- capability design for Haitou OS must treat:
  - network reachability
  - session strength
  - endpoint-specific auth requirements
  as separate dimensions

### Experiment 20: Current browser-backed session degradation snapshot

Commands:

```bash
./.venv/bin/boss status --json
./.venv/bin/boss search 'Python' --city 全国 --json
./.venv/bin/boss detail <securityId> --json
```

Observed result:

- local credential still existed with `14 cookies`, including `__zp_stoken__`
- but all key read flows had already degraded

Status snapshot:

```json
{
  "credential_present": true,
  "cookie_count": 14,
  "authenticated": false,
  "search_authenticated": false,
  "recommend_authenticated": false,
  "reason": "search: 环境异常 (__zp_stoken__ 已过期)。请重新登录: boss logout && boss login; recommend: 登录态校验失败: 推荐职位: 当前登录状态已失效 (code=7)"
}
```

Search/detail result shape:

```json
{
  "code": "not_authenticated",
  "message": "环境异常 (__zp_stoken__ 已过期)。请重新登录: boss logout && boss login"
}
```

What this proves:

- keeping a larger cookie set is still **not** enough to guarantee a usable session
- Boss will server-side invalidate important capabilities before local cookie presence disappears
- `14 cookies present` does **not** mean:
  - search is usable
  - detail is usable
  - recommend is usable

### Experiment 21: Raw cookie expiry metadata inspection attempt

Goal:

- determine whether local browser cookie timestamps can explain the session failure

Command:

```bash
./.venv/bin/python - <<'PY'
# browser_cookie3 chrome zhipin cookie expiry inspection
PY
```

Result:

- inspection failed with:

```json
{"error": "Unable to get key for cookie decryption"}
```

Interpretation:

- we could not reliably inspect raw Chrome cookie expiry metadata from this execution context
- therefore, we still cannot say whether the failure is:
  - browser cookie physically expired by timestamp
  - or server-side session invalidation happening earlier than local cookie expiry
- however, the live API behavior already proves a stronger product truth:
  - session usability expires earlier than "cookie still exists locally"

## Haitou OS Platform Execution Requirement Checklist

Below is the current requirement set inferred from live Boss research. This is the working checklist we should eventually validate across every platform.

### A. Platform Connection / Authorization

1. connect a platform account from within Haitou OS
2. distinguish product login from platform authorization
3. support browser-session extraction for browser-dependent platforms
4. support QR/session bootstrap where available
5. validate connection after authorization using live APIs, not only stored cookies
6. expose multi-level connection health instead of a single boolean
7. support re-auth / refresh without silently destroying recoverable sessions

### B. Session / Cookie / Credential Management

1. detect required cookie set per platform
2. detect partial sessions vs full sessions
3. detect endpoint-specific auth strength
4. measure freshness decay of important cookies/tokens
5. capture last-known-good credential metadata
6. record refresh source:
   - browser extracted
   - QR session
   - manual injected
7. support safe credential rollback if refresh fails
8. separate tool TTL from real platform session validity

### C. Job Discovery

1. keyword search
2. city / region filter
3. salary filter
4. experience filter
5. degree filter
6. company stage / scale / industry filters
7. pagination
8. recommendation feed reading
9. browsing-history reading
10. exportable normalized search results

### D. Job Detail / Opportunity Qualification

1. fetch full job detail
2. fetch recruiter / company identity fields
3. detect whether direct contact is allowed
4. detect whether resume exchange is allowed
5. detect whether phone / WeChat exchange is allowed
6. detect whether apply is page-button-only or API-like
7. detect whether the opportunity is still open
8. detect duplicate-contact / duplicate-apply state

### E. First Contact / Sending

1. send first greeting to a specific target recruiter
2. know whether send succeeded on the platform
3. capture returned thread / boss identifiers when available
4. prevent duplicate first-contact sends
5. support dry-run / preview mode
6. support send policy per platform:
   - allowed
   - partially allowed
   - blocked

### F. Conversation / Message Lifecycle

1. read thread list
2. read specific thread content
3. detect whether a thread exists before reply
4. detect unread replies
5. reply to recruiter
6. classify recruiter reply intent
7. detect whether human handoff is needed
8. store full conversation audit trail
9. handle the case:
   - send succeeded
   - thread not yet readable

### G. Resume Exchange / Attachment Handling

1. detect whether the platform supports resume exchange at all
2. detect whether exchange is job-specific
3. detect whether exchange requires platform-native button flow
4. detect whether local file upload is possible
5. detect file constraints:
   - format
   - size
   - filename
6. detect whether sending phone / WeChat is an alternative path
7. log when exchange is blocked by platform policy

### H. Post-Apply / Pipeline Tracking

1. read applied jobs
2. read interview invitations
3. read status transitions
4. connect recruiter thread to application record
5. detect whether employer viewed resume
6. detect whether platform exposes rejection / archive state

### I. Anti-bot / Safety / Risk Control

1. request pacing
2. jitter / reading pauses
3. burst detection
4. backoff on rate limit
5. captcha / challenge detection
6. geo / proxy / DNS sensitivity detection
7. detect when the environment is unstable rather than the account being invalid
8. define safe research-mode limits
9. define production-mode per-platform action budgets

### J. Observability / Recovery

1. log each platform action
2. log action input / output envelope
3. log cookies/session source used for that action
4. label failure cause:
   - auth
   - platform rule
   - network
   - rate limit
   - product bug
5. support retry policy per action type
6. support manual recovery prompts
7. support partial-platform degradation reporting

### K. Skill / Executor Boundary

1. separate stable skills from fragile platform-specific implementation
2. keep selector / endpoint / cookie quirks in executor/rule pack
3. keep message drafting / intent classification / reply policy in skill layer
4. only promote validated flows into formal platform-attached skills

## Deeper Business Boundary Map For Haitou OS

This section is the more exact product/execution boundary map that should guide future automation decisions.

### 1. What Boss Is Really Good For

Boss should currently be treated primarily as:

- a discovery platform
- a recruiter-contact platform
- a conversation-initiation platform

Boss should **not yet** be assumed to be:

- a fully automatable ATS-style apply platform
- a reliable local-file resume upload platform
- a stable long-lived unattended executor without session refresh

### 2. Automation Boundary: What Should Be Fully Automated

The following are strong candidates for full automation once validated:

1. session health checking
2. job search scheduling
3. job result normalization
4. job detail extraction
5. recruiter / company metadata extraction
6. opportunity scoring / ranking
7. first-contact draft generation
8. controlled first-contact sending
9. thread polling / reply detection
10. recruiter reply intent classification
11. follow-up recommendation generation
12. action logging and audit trail

### 3. Automation Boundary: What Should Be Human-Handoff By Default

Until proven otherwise, these should default to supervised or manual handoff:

1. formal platform-native job apply / submit actions
2. resume upload from local file
3. phone / WeChat exchange
4. sensitive follow-up messages after complex recruiter replies
5. actions that may violate platform risk thresholds
6. any step that triggers unusual account-security prompts

### 4. Session Boundary

Platform connection must be split into different real states:

1. browser logged in
2. cookie extracted
3. partial session available
4. search-capable session available
5. recruiter-contact-capable session available
6. thread-read-capable session available
7. stale / degraded / risky session

This is critical because Boss has already shown:

- send may work when search fails
- profile read may work when detail fails
- local cookies may exist after server-side invalidation

### 5. Search Boundary

Search automation is not just "can query keyword".

It must answer:

1. can search run successfully right now
2. how many searches per time window remain safe
3. what delay/jitter is required
4. whether a failed search is:
   - auth decay
   - proxy/DNS issue
   - rate limit
   - platform challenge
5. whether detail calls fail sooner than search
6. whether search results still expose enough metadata for send decisions

### 6. Detail Boundary

Job detail is required for:

1. reading the real requirement
2. identifying recruiter/company
3. deciding whether to contact
4. determining whether resume exchange is possible

Therefore detail must be separately tracked as its own capability, not assumed from search.

### 7. Contact Boundary

The send/contact layer must separate:

1. send request accepted by platform
2. conversation thread created
3. conversation thread visible in read APIs
4. recruiter has replied
5. platform now allows more data exchange

Our Boss tests already show:

- `greet success` != `thread readable`

### 8. Resume Boundary

Resume logic must distinguish:

1. platform-held resume already attached to account
2. one-click platform-native resume send
3. local file upload send
4. sending phone / WeChat instead of resume
5. user must manually handoff to platform page

This boundary matters because "resume can be sent" and "a local PDF can be uploaded" are not the same thing.

### 9. Risk / Safety Boundary

Haitou OS must know the difference between:

1. normal automation
2. high-risk automation
3. supervised automation
4. manual-only actions

Boss currently looks like:

- search: medium-to-high sensitivity
- detail: high sensitivity to session freshness
- greet: possible under weaker session states
- chat readback: not yet stable enough to treat as guaranteed

### 10. Data / Memory Boundary

The system should persist:

1. which recruiter was contacted
2. which job triggered that contact
3. what message/greeting was sent
4. which session type was used
5. what capability state existed at send time
6. whether thread became readable later
7. whether user had to manually hand off

Without this, duplicate sends and ambiguous state will become a major failure mode.

### 11. User Experience Boundary

The UI should avoid pretending the platform is "fully connected" when only some capabilities work.

Recommended future UX labels:

1. connected for profile
2. connected for search
3. connected for outreach
4. connected for conversation sync
5. action requires manual handoff

### 12. Compliance / Governance Boundary

Every platform action should be explainable later:

1. what the system tried to do
2. why it tried to do it
3. what platform state allowed it
4. why it failed if it failed
5. whether the user should retry, refresh, or handoff

## Current Data Gaps That Still Require Experiments

These are the most important unresolved boundary questions:

1. how long a browser-backed Boss search session stays healthy
2. whether search degrades faster than detail, or vice versa
3. whether repeated searches trigger code `7`, code `37`, HTTP `429`, or a different challenge
4. whether greet has a duplicate-send threshold
5. whether a recruiter reply is required before chat-list visibility appears
6. whether a browser-backed full session restores chat readback
7. whether any stable resume-send path exists at all

## Current Best Product Positioning For Boss

Until more data is collected, Boss should be positioned in Haitou OS as:

- `search + detail + recruiter discovery`
- `first-contact outreach`
- `conversation monitoring where available`
- `manual/supervised handoff for final submission-sensitive actions`

## Zhaopin Initial Findings

### Experiment Z1: Browser session / subdomain structure

Observed Chrome tabs:

- `https://i.zhaopin.com/`
- `https://www.zhaopin.com/recommend`

Observed page-visible cookies on both active 智联 pages:

- `at=...`
- `rt=...`
- `x-zp-client-id=...`
- `x-zp-device-sn=...`

Interpretation:

- 智联招聘 session state is not tied to a single page only
- both `www.zhaopin.com` and `i.zhaopin.com` appear to participate in the logged-in browser session
- future session models for 智联 should treat:
  - main domain
  - user-center subdomain
  as part of the same platform authorization envelope

### Experiment Z2: Recommend/search-like page inspection

Page inspected:

- `https://www.zhaopin.com/recommend`

What was confirmed from page content:

1. logged-in state is visible
2. recommendation/search-like job cards are visible
3. the page exposes a real browser-visible search box:
   - placeholder: `搜索职位、公司`
   - button text: `搜索`
3. each card exposes:
   - job title
   - salary
   - city / district
   - degree / experience
   - company
   - recruiter
4. visible action controls include:
   - `立即沟通`
   - `立即投递`
5. visible job detail links are real `jobdetail` URLs
6. on the tested sample page, at least `4` visible `jobdetail` links were present in the current result list

Additional observation:

- forcing the search box value to `Python` at the DOM level did not yet produce a clearly different result set
- the visible page still rendered a personalized finance/investment-heavy job stream

Interpretation:

- 智联 browser-side discovery is clearly available
- stable keyword-search automation is not fully validated yet
- at minimum, the platform already supports:
  - reading a result stream
  - extracting visible cards
  - following detail links
- keyword injection / search rerouting still needs one more round of validation

Initial conclusion:

- 智联 already shows enough browser-visible structure for:
  - discovery
  - recruiter/job extraction
  - detail navigation

### Experiment Z3: Detail / JD page inspection

Page inspected:

- `https://www.zhaopin.com/jobdetail/...`

What was confirmed:

1. full JD text is browser-visible
2. publisher / recruiter block is browser-visible
3. visible detail-page action state includes:
   - `立即沟通`
   - `已投递` on the tested sample
4. `我的简历` is available in the logged-in nav

What this proves:

- JD extraction is feasible from browser-visible content
- recruiter identity block is visible
- apply state can be surfaced on detail page
- the detail page carries enough information for:
  - job description parsing
  - recruiter extraction
  - company extraction
  - apply-state detection

### Experiment Z4: Message / resume / attachment boundary (current state)

What we have evidence for:

- `消息` entry exists
- `立即沟通` entry exists on recommend/detail pages
- `我的简历` entry exists in logged-in navigation
- detail page can show apply state such as `已投递`

What we do **not** yet have evidence for:

- whether `立即沟通` opens a readable thread, a popup, or a message composer that can be automated reliably
- whether a first message can be sent without additional interaction constraints
- whether resume sending is implicit via `立即投递` or requires a separate path
- whether local file attachment/upload is supported from the current user flow

Current status:

- `search/recommend page visibility`: validated at browser level
- `detail/JD visibility`: validated at browser level
- `message send`: unvalidated
- `resume/attachment send`: unvalidated

### Experiment Z5: Communication flow behavior after clicking `立即沟通`

Tested page:

- `https://www.zhaopin.com/jobdetail/CCL1520158950J40852039314.htm?...`

What happened after clicking `立即沟通` on the detail page:

1. the page stayed on the same `jobdetail` URL
2. no browser-visible message composer appeared
3. no browser-visible input box for free text sending appeared
4. the page surfaced an inline prompt:
   - `Hi~ 对职位感兴趣吗？快来下载智联APP和我聊聊吧，还能在线视频面试，方便又安心～`

Interpretation:

- current evidence suggests 智联的网页端 `立即沟通` is **not** a direct browser-text-send flow
- the present flow appears to push the user toward:
  - 智联 App
  - app-based chat / conversation continuation

What this means for Haitou OS:

- `沟通入口存在`: validated
- `网页端直接发送文本消息`: not yet validated
- `自动首触达` on 智联 should currently be treated as:
  - `partially_validated`
  - likely app-gated / more constrained than Boss

### Experiment Z6: Resume management and update surface

Page inspected:

- `https://i.zhaopin.com/resume`

What was confirmed from the logged-in resume page:

1. the user has an editable `在线简历`
2. the page exposes structured editable sections:
   - 基本信息
   - 个人优势
   - 求职状态
   - 求职意向
   - 工作／实习经历
   - 教育经历
   - 项目经历
   - 培训经历
   - 语言能力
   - 专业技能
   - 获得证书
   - 附件
3. the page also exposes `附件简历`
4. visible controls include:
   - `添加附件`
   - `上传新附件`
   - `预览简历`
   - `下载简历`
   - `修改`
5. the resume page also shows resume-quality / diagnosis prompts such as:
   - `去补充`
   - `去修改`

Interpretation:

- 智联的简历体系至少有两条路径:
  - structured online resume
  - attachment resume / file-based resume
- this is important for future auto-update design:
  - path A: update structured fields directly
  - path B: regenerate a tailored PDF and upload as new attachment

What this means for Haitou OS:

- `resume management page exists`: validated
- `resume upload entry exists`: validated
- `resume file actually uploaded by automation`: unvalidated
- `structured field-by-field resume update`: partially validated at UI-surface level

### Experiment Z7: Real apply submission from the web detail page

Tested target:

- `综合运营助理+双休+五险一金`
- detail URL:
  - `https://www.zhaopin.com/jobdetail/CC250519510J40835320007.htm?...`

Pre-submit state:

- detail page clearly showed:
  - `立即投递`
  - not `已投递`

Action:

- clicked the real detail-page apply button from the browser page

Observed result:

1. the page remained on the same detail URL
2. no blocking confirmation step appeared in this sample
3. the visible action state changed from:
   - `立即投递`
   to:
   - `已投递`

What this proves:

- 智联网页端投递 is not just an entry-point hypothesis
- at least for this tested sample, a real browser-side apply submission succeeded

Current status upgrade:

- `web apply submission`: validated
- `apply-state readback`: validated
- `message send from web`: still unvalidated

### Current Best Answer For The Four Core Zhaopin Questions

1. Search / testing
   - yes, browser-visible job discovery is working
   - current result stream yielded at least `4` visible job detail links on the tested page
   - free keyword search exists in the UI, but fully reliable keyword-driven rerouting still needs another validation round

2. Job detail / JD
   - yes, JD extraction is clearly possible
   - the detail page exposes:
     - full job description
     - salary
     - city / district
     - recruiter identity
     - company info
     - apply state

3. Communication flow
   - yes, there is a direct `立即沟通` entry on both list/detail surfaces
   - but current browser evidence suggests it redirects the user toward app chat instead of exposing a web-text composer
   - so `入口存在` is validated, `网页端自动发送` is still unvalidated

4. Resume auto-update
   - 智联 appears more promising than Boss for resume management because `我的简历` has explicit editing and upload surfaces
   - the likely future automation design should support both:
     - structured online-resume patching
     - tailored attachment regeneration + re-upload
   - exact upload/submit automation still needs live validation

### Experiment Z8: Safe probe / layered-health inconsistency

Script used:

- [zhaopin_safe_probe.sh](/Users/oxjames/Downloads/CC_testing/海投助手OS/Platform%20Research/zhaopin_safe_probe.sh)

Log produced:

- [zhaopin_safe_probe_20260401_142457.log](/Users/oxjames/Downloads/CC_testing/海投助手OS/Platform%20Research/logs/zhaopin_safe_probe_20260401_142457.log)

What happened in this passive probe:

1. `recommend` unexpectedly rendered a logged-out style page:
   - `登录/注册`
   - `微信扫码快捷登录`
   - `jobCount = 0`
2. `detail` still rendered normally as a logged-in page:
   - JD visible
   - recruiter visible
   - `已投递`
   - `立即沟通`
3. `resume` still rendered normally as a logged-in page:
   - 在线简历 visible
   - attachment controls visible

Interpretation:

- 智联, like Boss, should not be modeled as a single binary `connected / disconnected` platform
- current evidence suggests capability health may also degrade or diverge by surface:
  - recommend/search surface
  - detail surface
  - resume surface

Product implication:

- Haitou OS should track 智联 capability health separately for:
  - discovery / recommend
  - detail extraction
  - resume management
  - communication entry

### Zhaopin Next Automated Checks

The next browser-driven checks should be:

1. locate a stable keyword-search route that produces a clearly query-specific result set
2. verify whether `立即投递` triggers:
   - direct apply
   - resume confirmation
   - attachment selection
   - upload requirement
   - handoff flow
3. verify whether any browser-visible chat thread can be read back from `消息`
4. identify whether a half-hour safe browser-level probe can observe:
   - page availability
   - job list consistency
   - detail-page consistency
   - message-entry stability
5. classify 智联 capability health in the same layered model used for Boss:
   - discovery
   - detail
   - communication entry
   - thread readback
   - resume management

## Platform Standard Test Rule

This is the reusable test rule for any recruitment platform integrated into Haitou OS.

The purpose is:

- avoid ad-hoc testing
- make results comparable across platforms
- reduce repeated exploration cost
- clearly separate:
  - capability exists
  - capability is stable
  - capability is safe enough for automation

### Rule 1: Test In Layers, Not As One Big Flow

Every platform must be tested in the following layers:

1. authorization layer
2. session / health layer
3. search / discovery layer
4. detail / extraction layer
5. contact / send layer
6. conversation / readback layer
7. resume / apply layer
8. recovery / refresh layer
9. anti-bot / frequency layer

### Rule 2: Record Three Statuses For Every Capability

Each capability must be labeled as one of:

1. `validated`
2. `partially_validated`
3. `unvalidated`

And every capability must also record:

1. `required_session_type`
2. `failure_signal`
3. `recovery_method`
4. `risk_level`

### Rule 3: Required Capability Matrix

For each platform, test and log these capability items:

1. login via browser
2. login via QR or other mobile authorization
3. cookie/session extraction
4. health check
5. search
6. detail
7. profile read
8. recommendation read
9. history read
10. single send / greet
11. duplicate-send behavior
12. chat/thread list read
13. reply read
14. resume send
15. local file upload
16. applied list read
17. interview list read
18. refresh/re-auth
19. partial-session degradation behavior
20. network/proxy sensitivity

### Rule 4: Every Test Must Capture Five Things

For each experiment, record:

1. command or action used
2. environment/session state before the test
3. result
4. failure type
5. interpretation

Failure type must be classified as:

1. auth/session
2. platform policy
3. network/DNS/proxy
4. rate limit / anti-bot
5. unclear / needs more evidence

### Rule 5: Test Session Strength Separately

Do not assume all sessions are equal.

Each platform should distinguish at least:

1. QR/mobile-derived session
2. browser-derived full session
3. partial degraded session
4. refreshed session

Each capability must be tested against the session type that produced it.

### Rule 6: Test Time Decay As A Sequence

For any session-dependent platform, run the same checks over time.

Minimum timing plan:

1. `T0`
2. `T+15min`
3. `T+30min`
4. `T+1h`
5. `T+2h`
6. `T+6h`
7. `T+24h`

At every checkpoint, rerun:

1. status
2. search
3. detail
4. profile read
5. chat read

If possible, also log:

1. cookie count
2. changed cookie names
3. failure transition point

### Rule 7: Test Frequency Carefully

Frequency/rate-limit testing must be progressive.

Recommended levels:

1. low frequency
2. medium frequency
3. high frequency

For search-like actions:

1. low frequency: one search every 5-10 minutes
2. medium frequency: one search every 1-2 minutes
3. high frequency: short bursts

Record:

1. when the first failure appears
2. what failure code appears
3. whether the failure is temporary or session-killing

### Rule 8: Separate "Send Success" From "Conversation Readability"

For messaging platforms, do not treat these as the same:

1. send accepted
2. thread created
3. thread visible
4. reply received

Each step must be independently validated.

### Rule 9: Separate "Resume Send" From "Apply"

Do not merge these concepts:

1. platform-native resume send
2. local file upload
3. one-click apply
4. full form-based apply
5. manual user handoff

Each platform may support only some of them.

### Rule 10: Define Automation Eligibility

A capability may only be promoted into executor automation when it is:

1. validated
2. recoverable
3. low enough risk
4. repeatable under the same session type

If any of those is missing, it stays as:

1. supervised automation
2. manual handoff
3. research only

## What We Can Test Right Now On Boss

Based on current progress, the safest and most useful remaining Boss tests are:

### Test Track A: Browser Session Lifespan

Goal:

- determine how long a browser-backed full session keeps:
  - search
  - detail
  - recommend
  - me
  - chat

### Test Track B: Search Frequency Threshold

Goal:

- determine when search begins to fail under repeated use
- identify whether the failure is:
  - code `7`
  - code `37`
  - network/environment
  - anti-bot challenge

### Test Track C: Detail Stability

Goal:

- determine whether `detail` fails earlier than `search`
- distinguish:
  - auth failure
  - DNS/proxy failure
  - platform behavior

### Test Track D: Send-to-Read Transition

Goal:

- determine under what condition a successful greet becomes a readable chat thread

Potential triggers to compare:

1. no reply yet
2. browser full session vs QR-only session
3. longer wait windows

### Test Track E: Resume / Apply Boundary

Goal:

- determine whether Boss exposes any real stable path for:
  - resume send
  - local resume upload
  - apply-like submission

### Test Track F: Refresh / Recovery

Goal:

- determine the best recovery path when:
  - search fails
  - detail fails
  - session partially degrades

Compare:

1. browser re-login
2. browser cookie re-extraction
3. QR re-login

## Boss Immediate Next Test Plan

The next structured Boss tests should run in this order:

1. establish a fresh browser-backed full session
2. record `T0` baseline:
   - status
   - search
   - detail
   - me
   - chat
3. rerun the same set at:
   - `T+15min`
   - `T+30min`
   - `T+1h`
4. after baseline stability is known, start frequency testing
5. only after that, continue deeper message/readback testing

## Experiment 22: 30-minute conservative frequency probe

Log file:

- [boss_probe_20260401_124000.log](/Users/oxjames/Downloads/CC_testing/海投助手OS/Platform%20Research/logs/boss_probe_20260401_124000.log)

Probe shape:

- duration: about 30+ minutes
- cadence:
  - every 3 minutes: `status + search`
  - periodic: `detail`
  - 2 controlled `greet`
  - post-send and periodic `chat`

Observed pattern:

1. all `status` calls returned successfully as commands
2. almost all active business calls failed:
   - `search`
   - `detail`
   - `greet`
   - `chat`
3. the dominant failure mode was:
   - network/DNS resolution failure
   - not Boss anti-bot rejection

Representative failure:

```json
{
  "code": "api_error",
  "message": "Request failed after 3 retries: [Errno 8] nodename nor servname provided, or not known"
}
```

Representative status result during the probe:

```json
{
  "credential_present": true,
  "cookie_count": 15,
  "authenticated": false,
  "search_authenticated": false,
  "recommend_authenticated": false,
  "reason": "search: 登录态校验失败: Request failed after 3 retries: [Errno 8] nodename nor servname provided, or not known; recommend: 登录态校验失败: Request failed after 3 retries: [Errno 8] nodename nor servname provided, or not known"
}
```

What this probe did prove:

- a long-running agent loop can remain alive and keep polling
- the current execution environment can enter a prolonged DNS/network instability window
- during that window, Boss capability health appears degraded even when the saved cookie set still contains `15 cookies` including `__zp_stoken__`

What this probe did **not** prove:

- the true Boss rate-limit threshold
- the true Boss search-frequency threshold
- the true Boss send-frequency threshold
- the true session-lifespan boundary

Why not:

- this run was dominated by infrastructure/network failures before platform-rate-limit behavior could be isolated

Conclusion:

- this 30-minute run is still valuable, but it should be classified as:
  - `environment stability probe`
  - not yet a clean `Boss rate-limit probe`

Implication for future testing:

- before claiming any Boss frequency boundary, we must first ensure:
  - stable network path
  - stable DNS path
  - browser-backed healthy session at `T0`

Only after that can we attribute failures to:

- Boss anti-bot
- Boss session decay
- send/search threshold

## Current Boss Research Summary

### Confirmed

- browser-backed login can work
- QR-only login is insufficient for full search capability
- Boss capability health is layered, not binary
- this repo supports search, detail, profile, and chat-list reading paths
- this repo implements a recruiter-contact action via `friend/add`

### Not Yet Confirmed

- immediate post-send chat thread visibility
- delayed post-send chat thread visibility
- resume sending support as a stable capability
- local resume file upload path
- safe search-frequency threshold without account risk
- true Boss cookie lifetime in production conditions

### Repair / Product Implications

1. Haitou OS should not treat Boss authorization as a simple "scan once and done" flow.
2. Boss health should be tracked per capability:
   - profile
   - recommend
   - search
   - chat
   - contact/send
3. Failed refresh should not blindly destroy the only recoverable session without a recovery UX.
4. Resume exchange must remain a conditional, platform-gated capability until more evidence is collected.

## Current Best Answer On Boss Cookie Boundary

What we can say now:

- one captured Boss cookie/session cannot be assumed to work indefinitely
- one captured Boss cookie/session also cannot be assumed to stay fully usable for even all actions in the same short period
- Boss session validity degrades by capability, not as a single clean cutoff

What we have directly observed:

1. QR-only `4-cookie` sessions:
   - can be enough for `greet`
   - are not enough for reliable `search/detail`

2. fuller browser-backed sessions (`14-15 cookies`):
   - can enable successful live search initially
   - can later degrade into:
     - `search` invalid
     - `detail` invalid
     - `recommend` invalid
   - while local cookies still remain present

What we have **not** proven:

- that a Boss session stays healthy for 7 days
- that a Boss session even stays fully healthy for several hours
- the exact expiry point for `__zp_stoken__`

Most important conclusion:

- `7 days` in this repo is only the tool's refresh threshold for saved credentials
- it is **not** evidence that Boss grants a 7-day stable execution session

## Lagou Initial Findings

### Experiment L1: Browser session / homepage capability surface

Active page inspected:

- `https://www.lagou.com/wn/`

Observed page-visible cookies included:

- `gate_login_token=...`
- `LG_LOGIN_USER_ID=...`
- `LG_HAS_LOGIN=1`
- `login=true`
- `X_HTTP_TOKEN=...`
- `unick=...`

Interpretation:

- 拉勾 browser login state is clearly present
- unlike Boss QR-only behavior, this session already exposes a stronger web-login signature at the page-cookie layer

Visible logged-in navigation / user surfaces:

- `推荐职位`
- `我的简历`
- `投递记录`
- `职位订阅`
- `面试邀约`

### Experiment L2: Real keyword search result page

Search route validated:

- `https://www.lagou.com/wn/zhaopin?kd=金融研究&city=全国`

What was confirmed:

1. the route renders a real keyword-specific result stream
2. the page shows:
   - `职位（500+）`
   - job title
   - salary
   - experience / degree
   - company
   - industry
   - city
3. tested sample results included positions such as:
   - `金融审批专家`
   - `证券研究员/股票研究员/金融研究员`
   - `金融研究员`
   - `供应链金融业务总监`

Interpretation:

- 拉勾 search/discovery is validated at browser level
- unlike 智联's more recommendation-heavy first pass, 拉勾 keyword search responded with a clearly query-specific result set

### Experiment L3: Result-card structure

Observed list-card class:

- `.item__10RTO`

Observed title node inside the first card:

- `a#openWinPostion`

What this means:

- result cards are clearly structured and machine-readable
- but the detail jump is not exposed as a simple static `href`
- current page appears to rely on front-end event binding for opening the detail page

Current status:

- `search result extraction`: validated
- `detail-page route extraction`: partially validated
- `direct DOM click -> detail navigation`: not yet validated

### Experiment L4: Resume / delivery route stability

Observed homepage-visible links included:

- `https://www.lagou.com/resume/myresume.html`

But direct navigation tests to:

- `https://www.lagou.com/resume/myresume.html`
- `https://www.lagou.com/wn/jobs/deliver`

both landed on:

- `https://www.lagou.com/lagouhtml/a4.html`

with visible error:

- `啊哦，出错了，您访问的链接不存在！`

Interpretation:

- 拉勾 has visible logged-in nav entries for resume / delivery features
- but the stable deep-link routes are not yet validated
- we should treat:
  - `resume entry visible`
  - `resume page stable`
  as two different capability states

### Current Lagou Status

- `login/session visible in browser`: validated
- `keyword search`: validated
- `result card extraction`: validated
- `detail page access`: partially validated
- `resume management`: unvalidated beyond visible homepage nav
- `delivery/apply history page`: unvalidated
- `message / communication flow`: unvalidated

### Lagou Next Checks

1. resolve the real detail-page route behind `a#openWinPostion`
2. identify whether result-card data is available through front-end state or hidden data attributes
3. locate the actual current resume center route, if homepage deep-link is stale
4. verify whether 拉勾 supports:
   - web apply
   - web chat
   - resume upload / attachment

### Experiment L5: Real detail route resolution

Key discovery:

- search-result resource requests exposed a batch of `positionIds`, for example:
  - `11597458`
  - `11181689`
  - `11046176`

Route resolution result:

- the real browser detail route template is:
  - `https://www.lagou.com/wn/jobs/<positionId>.html`

Validation:

- `https://www.lagou.com/wn/jobs/11597458.html` returned a real job detail page
- `https://www.lagou.com/jobs/11597458.html` redirects to the `/wn/jobs/...` version

What this proves:

- 拉勾 detail pages are directly addressable once `positionId` is known
- future automation does not need to rely on brittle front-end click simulation if the `positionId` can be extracted

### Experiment L6: Detail page / JD / recruiter surface

Tested detail page:

- `https://www.lagou.com/wn/jobs/11597458.html`

What was confirmed:

1. full JD is browser-visible
2. recruiter block is browser-visible
3. detail page shows:
   - salary
   - city
   - experience
   - degree
   - full-time / internship style
   - company
   - recruiter identity
4. resume-related controls are visible on the same page:
   - `投简历`
   - `在线简历`
   - `上传附件简历`

Interpretation:

- 拉勾 supports browser-side:
  - discovery
  - detail extraction
  - recruiter surface extraction
  - resume-entry selection

### Experiment L7: Real web apply submission

Tested positions:

1. `金融审批专家`
   - detail route: `/wn/jobs/11597458.html`
2. `资产管理总部--研究助理实习生`
   - detail route: `/wn/jobs/11181689.html`

Observed behavior:

1. clicking `投简历` on both tested positions led to a real success state
2. success feedback page showed:
   - `投递成功，请等待反馈`
3. reopening the first detail page after submission changed the visible state from:
   - `投简历`
   to:
   - `已投递`

Interpretation:

- 拉勾网页端投递 is validated
- multi-position repeated delivery is possible
- same-position duplicate delivery is UI-blocked after success, because the detail state becomes `已投递`

### Experiment L8: Communication boundary

What was observed on the detail page:

- recruiter section text included:
  - `对我发布的职位感兴趣？用拉勾APP扫码，直接和我聊聊吧！`

What was tested:

- attempted browser-side inspection of a likely web message route:
  - `https://www.lagou.com/wn/message`

Observed result:

- no readable thread list
- no visible browser-side input box
- no visible send button
- page behaved more like a generic fallback surface than a working web chat center

Interpretation:

- 拉勾 has a communication concept
- but currently the evidence points to:
  - `App-first chat`
  - not stable `web-side direct messaging`

Current status:

- `web chat send`: unvalidated / likely not supported in the same way as Boss
- `chat intent / chat handoff exists`: validated

### Experiment L9: Resume strategy boundary

Observed detail-page controls and prompts included:

- `在线简历`
- `上传附件简历`
- `当前在线简历不完整，上传附件简历可直接投递`
- supported attachment formats mention:
  - `Word`
  - `PDF`
  - `PPT`
  - `TXT`
  - `WPS`
- size hint:
  - less than `10M`

Interpretation:

- for 拉勾, a `千人千面` strategy is more realistic as:
  - generate tailored attachment resume
  - upload attachment
  - then apply
- it is less realistic to model 拉勾 as:
  - chat first
  - then send resume inside a browser chat box

### Current Best Answer For Lagou

1. Search
   - yes, clearly supported on the web
   - keyword-specific search result pages are validated

2. Apply
   - yes, clearly supported on the web
   - real apply submission has been validated across multiple positions

3. Chat / communication
   - not validated as a usable web-side direct-message flow
   - current evidence suggests App-directed chat handoff instead

4. Resume sending
   - yes, in the sense of:
     - online resume selection
     - attachment resume upload
     - attachment-assisted apply
   - no evidence yet that resume can be sent as a message attachment inside a browser chat thread

### Product Implication For Haitou OS

Current Lagou classification should be:

- `search + detail + web apply` platform
- not `web chat-first` platform

Recommended V1 framing:

- use 拉勾 for:
  - keyword search
  - JD extraction
  - browser-side apply
  - tailored attachment-resume upload when needed
- do not make:
  - browser chat with HR
  - browser-side resume-in-chat sending
  part of the V1 promise

## 51Job Initial Findings

### Experiment J1: Logged-in homepage capability surface

What was tested:

- opened the main web homepage after login:
  - `https://www.51job.com/`
- inspected visible page text and top-level navigation

Observed result:

- homepage clearly showed logged-in state:
  - `在线简历`
  - `颜思成`
  - `Hi，颜思成`
  - `我的投递`
- homepage exposed direct product entry points:
  - `https://we.51job.com/pc/search`
  - `https://www.51job.com/resume/center`
  - `https://we.51job.com/pc/my/myjob`
  - `https://i.51job.com/userset/my_apply.php`
- homepage also exposed many real job links under `jobs.51job.com`

Interpretation:

- 51Job web login is valid and materially usable
- unlike Boss, this is not just a shell login; it exposes search, resume, and delivery surfaces from the homepage

### Experiment J2: Search route and real search-result page

What was tested:

- opened a keyword-specific search page:
  - `https://we.51job.com/pc/search?keyword=金融研究&searchType=2&sortType=0&metro=`
- inspected visible result cards and clickable links

Observed result:

- the route resolved to a real query-specific result page:
  - title: `【金融研究,杭州招聘，求职】-前程无忧`
- page showed many genuine search results, not just homepage recommendations
- result list included:
  - salary
  - city
  - company
  - company type
  - response hints like `2分钟前回复`
  - action buttons `去聊聊` and `投递`
- page exposed many concrete detail links under `jobs.51job.com`, for example:
  - `https://jobs.51job.com/hangzhou/73333681.html`
  - `https://jobs.51job.com/hangzhou-gsq/170963284.html`
  - `https://jobs.51job.com/hangzhou-scq/170122612.html`

Interpretation:

- 51Job web-side keyword search is validated
- the search result page is rich enough to support:
  - search
  - candidate job extraction
  - company extraction
  - recruiter-activity hints

### Experiment J3: Resume center and resume-management capabilities

What was tested:

- opened:
  - `https://www.51job.com/resume/center`
- inspected visible sections and controls

Observed result:

- resume center is a fully usable structured resume surface
- visible editable sections included:
  - `基本信息`
  - `个人优势`
  - `求职意向`
  - `技能经验`
  - `工作经历`
  - `项目经历`
  - `教育经历`
  - `语言能力`
  - `个人作品`
  - `专业技能`
- page also exposed attachment-management controls:
  - `附件管理`
  - `附件简历`
  - `上传作品集`
- visible resume-management actions included:
  - `新增简历`
  - `优化简历`
  - `切换为英文简历`
  - `预览`
  - `默认投递`
  - `公开简历`
  - `屏蔽公司`

Interpretation:

- 51Job web resume management is strongly validated
- compared with Boss and Lagou, 51Job offers a much clearer browser-side base for:
  - structured resume patching
  - attachment handling
  - multi-resume strategy

### Experiment J4: Real detail-page access boundary

What was tested:

- opened a concrete detail page directly:
  - `https://jobs.51job.com/hangzhou-bjq/164520384.html`

Observed result:

- page did open
- but the body content was replaced by a verification challenge:
  - `访问验证`
  - `别离开，为了更好的访问体验，请滑动滑块进行验证，通过后即可继续访问网页`
  - `请按住滑块，拖动到最右边`

Interpretation:

- 51Job detail-page access is currently constrained by anti-bot verification
- this means:
  - search is available
  - homepage/resume surfaces are available
  - but direct detail/JD extraction from `jobs.51job.com` is not yet stably automated

### Experiment J5: Delivery-history and resume routes at the HTTP layer

What was tested:

- inspected route reachability with HTTP HEAD requests:
  - `https://i.51job.com/userset/my_apply.php`
  - `https://www.51job.com/resume/center`

Observed result:

- both routes returned `HTTP 200`
- `my_apply.php` set anti-bot / session cookies at the edge:
  - `acw_tc`
  - `guid`
- `resume/center` also returned `HTTP 200`

Interpretation:

- `投递记录` and `简历中心` are real browser-accessible product surfaces
- route reachability is not the blocker on 51Job
- the main blocker is page-level verification / front-end behavior, not raw HTTP availability

### Experiment J6: Search-result action surface

What was tested:

- inspected interactive controls on the search result page
- specifically looked for:
  - `去聊聊`
  - `投递`

Observed result:

- search results contain repeated live action controls:
  - `去聊聊`
  - `投递`
- the `投递` control is rendered as:
  - `BUTTON.btn.apply`
- the `去聊聊` control is rendered as:
  - `DIV.chat`

Interpretation:

- 51Job does expose communication/apply intent directly from the result list
- this is stronger than a pure static listing surface
- however, the existence of the controls is not the same as full execution validation

### Experiment J7: First real chat-action click boundary

What was tested:

- clicked the first visible `去聊聊` action on the search result page
- then inspected whether:
  - URL changed
  - a new tab opened
  - a chat composer appeared

Observed result:

- no new tab opened
- URL stayed on the search page
- a dialog appeared with text:
  - `即将跳转应届生平台 6s立即前往`

Interpretation:

- 51Job communication entry exists
- but at least one concrete sample routes through a special sub-flow rather than an immediate browser chat box
- current status:
  - `chat intent`: validated
  - `stable browser direct messaging`: not validated

### Experiment J8: First real apply-action click boundary

What was tested:

- clicked the first visible `投递` action on the search result page
- then inspected:
  - dialog state
  - page body
  - action-button text

Observed result:

- the click was accepted by the page
- but no clear success state, toast, or button-state change was observed in this first pass
- the page still showed:
  - `投递`
- the page also still had the previously-opened cross-flow dialog visible

Interpretation:

- a browser-side apply control definitely exists on 51Job search results
- but this first pass does **not** yet validate a full successful submission
- current status should be:
  - `apply action entry`: validated
  - `real successful web apply submission`: not yet validated

### Experiment J9: Real click on `去聊聊`

What was tested:

- on the live search-result page, clicked the first visible `去聊聊` control
- then checked:
  - whether the current URL changed
  - whether a new tab opened
  - whether a browser-side chat composer appeared

Observed result:

- the click was accepted
- the current search URL remained unchanged
- no new tab was opened
- after the click, the page contained a visible dialog:
  - `即将跳转应届生平台 6s立即前往`

Interpretation:

- this is a real interaction, not just a static label
- however, the interaction did **not** validate a normal browser chat workflow
- current best reading is:
  - 51Job communication may branch into a special platform flow
  - not a simple in-page browser chat box

### Experiment J10: Real click on `投递`

What was tested:

- on the live search-result page, clicked the first visible `投递` button
- then inspected:
  - button state
  - dialog state
  - visible page text

Observed result:

- the click was accepted by the browser page
- the button stayed visible as `投递`
- no unambiguous success toast or `已投递` state was observed in this first pass
- the page still contained the previously opened special-flow dialog

Interpretation:

- this confirms 51Job apply is wired as a real interactive control on the search page
- but this pass still does **not** prove successful submission
- a next-stage test would need:
  - a cleaner page state
  - or interaction against a validated detail/apply flow after passing anti-bot verification

### Experiment J11: Live click-through from search result to detail

What was tested:

- extracted a real position link directly from the live result page, for example:
  - `https://jobs.51job.com/hangzhou/73333681.html?...`
- triggered a live click from the search-result page rather than only opening a hand-typed detail URL

Observed result:

- the click target was real and position-specific
- however, stable browser-side detail extraction is still blocked by the same `jobs.51job.com` verification boundary already observed on direct detail access

Interpretation:

- the search-result page does expose real detail targets
- but the current blocker is not link discovery
- the blocker is the downstream anti-bot / slider verification on the detail domain

### Current Best Answer For 51Job

1. Search
   - yes, clearly supported on the web
   - keyword-specific result pages are validated

2. Job detail / JD
   - not yet stably validated
   - direct detail-page access currently hits slider verification

3. Apply
   - apply controls clearly exist on the result page
   - real click interaction has been validated
   - but full successful submission is not yet validated

4. Chat / communication
   - communication entry exists as `去聊聊`
   - real click interaction has been validated
   - but current evidence does not yet support a stable browser-side direct-message workflow
   - the tested sample triggered a special jump dialog instead of a normal chat composer

5. Resume strategy
   - strongly validated at the browser level
   - resume center supports:
     - structured online resume editing
     - attachment resume management
     - default-delivery settings
     - multiple resume-management actions

### Product Implication For Haitou OS

Current 51Job classification should be:

- `search + resume-management` platform
- with partial signals for:
  - `apply`
  - `chat`
- and a major current blocker on:
  - direct detail-page automation because of slider verification

Recommended V1 framing:

- use 51Job for:
  - keyword search
  - result-card extraction
  - resume-center management
  - future apply validation after anti-bot handling is better understood
- do not promise yet:
  - stable automated JD extraction from direct detail pages
  - stable browser-side HR chat
  - fully validated one-click web apply

## Review Consolidation

### Temporary Scope Decision

Current platform decision after full review:

- keep in active Chinese-platform scope:
  - `Boss`
  - `智联招聘`
  - `拉勾`
- temporarily remove from active V1 scope:
  - `51Job`

Reason for temporarily removing `51Job`:

- search is usable
- resume-center management is usable
- but the core execution chain required by Haitou OS is not yet solid enough:
  - direct `detail / JD` access is blocked by slider verification
  - `chat` is not validated as stable browser messaging
  - `apply` interaction exists but full successful submission is still unproven

Interpretation:

- 51Job is not being discarded forever
- it is being downgraded from:
  - `active platform integration target`
  to:
  - `future supervised / anti-bot research target`

### Cross-Platform Capability Review

#### Boss

Validated:

- browser-backed login / session extraction
- search
- partial detail path
- greet / first-touch send
- profile read

Partially validated / constrained:

- thread readability after greet
- session lifetime / cookie health over time
- detail and search can degrade before other capabilities

Do not assume:

- QR-only login is enough
- one cookie grant equals fixed 3 / 5 / 7 day stability

Recommended classification:

- `search + conversation` platform

#### 智联招聘

Validated:

- browser login state
- search / recommend flow
- job detail / JD read
- resume center / resume management
- real web apply submission

Partially validated / constrained:

- `立即沟通` entry exists
- direct web-side messaging is not validated
- communication appears more app-gated than Boss

Recommended classification:

- `search + detail + apply` platform

#### 拉勾

Validated:

- browser login state
- keyword search
- detail route resolution
- JD read
- multi-position real web apply
- same-position duplicate apply is UI-blocked after success
- attachment-resume upload path exists

Partially validated / constrained:

- communication intent exists
- browser-side direct chat is not validated
- observed experience strongly points to app-directed chat handoff

Recommended classification:

- `search + detail + apply + attachment-resume` platform

#### 51Job

Validated:

- browser login shell
- keyword search
- resume center / structured resume management

Blocked / not ready:

- detail / JD by slider verification
- stable browser chat
- successful full apply submission

Recommended classification:

- `future supervised research platform`

### Additional Boundaries That Must Be Preserved

These are easy to lose later, so they should stay explicit:

1. `search success` does not imply `detail success`
2. `send success` does not imply `thread readable`
3. `entry exists` does not imply `browser execution is truly available`
4. `resume management exists` does not imply `千人千面` is ready for V1
5. `cookie exists` does not imply `capability is still valid`
6. `HTTP 200` does not imply anti-bot has been cleared

### Missing Experiments Still Worth Running Later

These are not blockers for current scope reduction, but they are the highest-value next experiments:

1. Boss session time-series
   - `T0 / T+15m / T+30m / T+1h / T+2h / T+6h / T+24h`
   - measure:
     - search
     - detail
     - greet
     - chat
     - cookie count

2. Boss frequency envelope
   - safe low-frequency search/send schedule
   - determine practical anti-risk baseline

3. 智联 apply stability
   - repeat web apply across multiple roles
   - confirm whether apply-state readback is consistently reliable

4. 智联 resume variant strategy
   - determine whether structured resume patching can support lightweight role-specific tuning

5. 拉勾 attachment strategy
   - verify whether uploading a new tailored attachment can be done repeatedly and predictably without breaking prior apply flows

6. 拉勾 delivery-history / state-readback
   - confirm whether prior submissions can be read reliably enough for executor-side deduplication

### Current V1 Recommendation

After review, the safest Chinese-platform V1 stack is:

- `Boss`
  - use for:
    - search
    - opportunity discovery
    - first-touch outreach
    - conversation follow-up where available

- `智联招聘`
  - use for:
    - search
    - JD extraction
    - structured resume management
    - real browser-side apply

- `拉勾`
  - use for:
    - keyword search
    - JD extraction
    - browser-side apply
    - tailored attachment-resume workflow

- `51Job`
  - keep out of the first active rollout
  - revisit only after a dedicated anti-bot / supervised-mode pass
