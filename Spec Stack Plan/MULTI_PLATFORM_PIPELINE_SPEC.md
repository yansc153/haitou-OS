# Multi-Platform Pipeline Spec — 7 平台 × 3 模式 × 2 Loop

> 日期: 2026-04-06
> 状态: 已确认
> 前置: PLATFORM_RULE_AND_AGENT_SPEC.md, PRODUCT_FLOW_V2.md, PIPELINE_VERIFICATION_PLAN.md
> 目的: 在写代码之前，精确定义每个平台在 Loop 1 (发现→投递) 和 Loop 2 (回复→跟进→交接) 中的行为差异，作为实现合约。

---

## 一、Pipeline Mode 定义

三种模式，决定一个 opportunity 走什么路径：

| Mode | 平台 | 简历处理 | Apply 方式 | Loop 2 |
|------|------|---------|-----------|--------|
| `full_tailored` | Greenhouse, Lever, LinkedIn | AI 定制简历 + Cover Letter | browser_form / easy_apply | **No** |
| `passthrough` | 智联, 拉勾, 猎聘 | 不改简历，用 onboarding 优化版 | browser_form (cookie) | **No** |
| `passthrough_conversation` | Boss直聘 | 不改简历 | chat_initiate (打招呼) | **Yes — V1 唯一** |

**判定规则**: `platform_definition.pipeline_mode` 字段决定。Boss直聘 虽然 DB 里存的是 `passthrough`，但代码中通过 `platform_definition.automation_role = 'search_conversation'` 判断走对话路径。

### V1 回复追踪规则 (硬性约束)

```
┌─────────────────────────────────────────────────────────────┐
│  V1 只有 Boss直聘 有 Loop 2 (回复→跟进→交接)。              │
│  其他所有平台 discover → submit → 结束。                     │
│                                                              │
│  英文平台 (GH/Lever/LinkedIn):                               │
│    回复走 email，我们不接管 email → 不追踪                   │
│    不需要招聘关系经理                                        │
│                                                              │
│  中文平台 (智联/拉勾/猎聘):                                  │
│    回复走站内信/APP → V1 不追踪                              │
│    不需要招聘关系经理                                        │
│                                                              │
│  Boss直聘:                                                   │
│    打招呼 = 投递，聊天 = 回复 → 必须追踪                    │
│    招聘关系经理是主要执行者                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 二、平台 × Agent 职责矩阵

| Agent (template_role_code) | Greenhouse | Lever | LinkedIn | 智联 | 拉勾 | 猎聘 | Boss直聘 |
|---|---|---|---|---|---|---|---|
| 岗位研究员 `opportunity_research` | Discovery | Discovery | Discovery | Discovery | Discovery | Discovery | Discovery |
| 匹配审核员 `matching_review` | Screen | Screen | Screen | Screen | Screen | Screen | Screen |
| 简历顾问 `materials_advisor` | Tailor+CL | Tailor+CL | Tailor+CL | - | - | - | - |
| 投递专员 `application_executor` | Submit | Submit | EasyApply | Submit | Submit | Submit | **不参与** |
| 招聘关系经理 `relationship_manager` | - | - | - | - | - | - | **打招呼+回复+跟进** |
| 交接协调员 `handoff_coordinator` | - | - | - | - | - | - | Handoff |
| 运营主管 `orchestrator` | Fallback | Fallback | Fallback | Fallback | Fallback | Fallback | Fallback |

**Boss直聘 关键规则:**
- `投递专员` 永远不处理 Boss 任务。Boss 没有"投递"按钮。
- `招聘关系经理` 是 Boss 的主要执行者：打招呼 → 回复轮询 → 跟进 → 交接检测。

---

## 三、Opportunity Stage 状态流转 — 按模式

### 3.1 full_tailored (GH / Lever / LinkedIn)

```
discovered ──→ screened ──→ prioritized ──→ material_ready ──→ submitted
                               │ (drop/watch)                      │
                               ▼                                   ▼
                             closed                          (LinkedIn V1.1)
                                                           contact_started → ...
```

全部 5 个 stage 都经过。

### 3.2 passthrough (智联 / 拉勾 / 猎聘)

```
discovered ──→ screened ──→ prioritized ──────────────────→ submitted
                               │ (drop/watch)
                               ▼
                             closed
```

跳过 `material_ready`。`prioritized → submitted` 是合法转换 (state-machines.ts line 67)。

### 3.3 passthrough_conversation (Boss直聘)

```
discovered ──→ screened ──→ prioritized ──→ contact_started ──→ followup_active
                               │ (drop)                              │
                               ▼                                     ▼
                             closed                        positive_progression
                                                                     │
                                                                     ▼
                                                              needs_takeover
                                                                     │
                                                                     ▼
                                                              closed (resolved)
```

跳过 `material_ready` 和 `submitted`。`prioritized → contact_started` 是合法转换 (state-machines.ts line 68)。

---

## 四、Loop 1 详细行为 — 按平台

### 4.1 Discovery Phase

| 平台 | 函数 | 来源 | Session | 搜索方式 | 日限 |
|------|------|------|---------|---------|------|
| Greenhouse | `discoverGreenhouseJobs()` | Public API | 无需 | board_token → jobs endpoint | 100 searches |
| Lever | `discoverLeverJobs()` | Public API | 无需 | board_token → postings endpoint | 100 searches |
| LinkedIn | `discoverLinkedInJobs()` | Scrape | cookie (li_at) | keyword + location search | 50 searches |
| 智联 | `discoverZhaopinJobs()` | Scrape | cookie | keyword + city search | 100 searches |
| 拉勾 | `discoverLagouJobs()` | Scrape | cookie | keyword + city search | 100 searches |
| **猎聘** | **`discoverLiepinJobs()`** | **Scrape** | **cookie** | **keyword + city search** | **100 searches** |
| **Boss直聘** | **`discoverBossJobs()`** | **Scrape** | **cookie (__zp_stoken__)** | **keyword + city search** | **50 searches** |

**Discovery 通用流程:**
1. 从 `platform_connection` 获取 `session_token_ref` (cookie)
2. 从 `onboarding_draft.answered_fields.target_roles` 获取关键词
3. 调用平台 executor 的 discover 函数
4. 去重 (by `external_ref`)
5. INSERT `opportunity(stage=discovered)`
6. 立即调用 `runScreeningPipeline()`

**Greenhouse/Lever 特殊**: 不用 cookie，用 `getBoardsForDomain()` 获取 board_tokens。

### 4.2 Screening Phase (所有平台相同)

三步 AI skill 调用，platform-agnostic：

1. `fit-evaluation` → `fit_posture`: strong/moderate/weak
2. `conflict-detection` → conflicts array
3. `recommendation-generation` → advance/watch/drop/needs_context

Stage 流转: `discovered → screened → prioritized`

如果 `recommendation = 'advance'`，根据 pipeline_mode 分流：
- `full_tailored` → `runMaterialPipeline()`
- `passthrough` → `runSubmission()`
- `passthrough_conversation` (Boss) → `runFirstContact()`

### 4.3 Material Phase (仅 full_tailored)

1. `truthful-rewrite` skill → tailored resume
2. `cover-letter-generation` skill → cover letter
3. Stage: `prioritized → material_ready`
4. 自动进入 `runSubmission()`

### 4.4 Submission Phase (除 Boss 外所有平台)

| 平台 | 函数 | 方式 | 需要下载简历? |
|------|------|------|-------------|
| Greenhouse | `submitGreenhouseApplication()` | Playwright 填表 | Yes (upload) |
| Lever | `submitLeverApplication()` | Playwright 填表 | Yes (upload) |
| LinkedIn | `submitLinkedInEasyApply()` | Easy Apply modal | Yes (upload) |
| 智联 | `submitZhaopinApplication()` | 点击"立即投递" | No (平台简历) |
| 拉勾 | `submitLagouApplication()` | 点击"投递简历" | No (平台简历) |
| **猎聘** | **`submitLiepinApplication()`** | **点击"立即投递"** | **No (平台简历)** |

**Submission 通用流程:**
1. Budget check: `BudgetService.canPerformAction(connection, team, platform, 'application')`
2. 如果 full_tailored: 下载简历到 temp file
3. 调用 platform executor submit 函数
4. INSERT `submission_attempt`
5. 记录 budget usage
6. Stage: `material_ready → submitted` 或 `prioritized → submitted` (passthrough)
7. Timeline event: "已投递 {company} 的「{title}」"

### 4.5 First Contact Phase (仅 Boss直聘)

**Boss 不走 Submission。Boss 走 First Contact (打招呼)。**

流程:
1. Budget check: `canPerformAction(connection, team, 'boss_zhipin', 'application')` (此处 application 计数 = greetings)
2. 调用 `boss-greeting-compose` skill 生成打招呼消息
3. 调用 `sendBossGreeting(cookies, jobId, greetingText)`
4. INSERT `conversation_thread` + `conversation_message(direction=outbound, message_type='greeting')`
5. Stage: `prioritized → contact_started`
6. Timeline event: "已向 {company} 发送打招呼消息"

---

## 五、Loop 2 详细行为 — 仅 Boss直聘 (V1 唯一有 Loop 2 的平台)

### 5.1 Reply Polling

- 触发: `sweepReplyPolling()` every 15 min
- 条件: 存在 `stage IN (contact_started, followup_active, positive_progression)` 的 opportunity
- 执行: `pollBossMessages(cookies)` → 获取新消息 → INSERT `conversation_message(direction=inbound)`

### 5.2 Reply Analysis

- 触发: 有新的 `direction=inbound` 且 `reply_posture IS NULL` 的消息
- 执行: `reply-reading` skill 分析消息
- 输出:
  - `reply_posture`: positive / neutral / negative / info_request
  - `handoff_recommended`: boolean
  - `contains_interview_scheduling`, `contains_salary_discussion`, `contains_private_channel_request`
- 状态更新:
  - Positive → `contact_started → positive_progression` (如果已经是 contact_started)
  - Handoff → `stage → needs_takeover`

### 5.3 Follow-up

- 触发: `sweepFollowUps()` every 15 min
- 条件: `stage IN (submitted, contact_started)` AND `stage_changed_at < 3 days ago`
- 执行: `follow-up-drafting` skill → `sendBossMessage(cookies, threadId, text)`
- Stage: `contact_started → followup_active`

### 5.4 Handoff

- 触发: Reply Analysis 检测到面试/薪资/私聊信号
- 执行: `HandoffDetectionService.createHandoff()`
- 类型: `interview_time | salary_confirmation | private_contact | general`
- Stage: `any active → needs_takeover`
- 前端: 首页"需要你接管"卡片 + 交接中心

---

## 六、Executor 接口合约

### 6.1 猎聘 Executor (`src/worker/executors/liepin.ts`)

```typescript
// Discovery
export async function discoverLiepinJobs(params: {
  sessionCookies: string;
  keywords: string[];
  city?: string;
  limit?: number;
}): Promise<LiepinJob[]>

// Submission
export async function submitLiepinApplication(params: {
  sessionCookies: string;
  jobUrl: string;
}): Promise<{
  outcome: 'success' | 'soft_failure' | 'hard_failure';
  confirmationSignal?: string;
  errorMessage?: string;
}>

// Health check
export async function checkLiepinCapabilityHealth(params: {
  sessionCookies: string;
}): Promise<Record<string, 'healthy' | 'degraded' | 'blocked' | 'unknown'>>
```

**实现参考**: 同 zhaopin.ts / lagou.ts 模式。
- Search URL: `https://www.liepin.com/zhaopin/?key={keyword}&dq={city}`
- Card selector: `.job-list-item, .job-card`
- Apply button: `button:has-text("立即投递"), button:has-text("投递简历")`
- Login detect: URL contains `/login` or `/acountLogin`
- Daily budget: 20 applications

### 6.2 Boss直聘 Executor (`src/worker/executors/boss-zhipin.ts`)

```typescript
// Discovery
export async function discoverBossJobs(params: {
  sessionCookies: string;
  keywords: string[];
  city?: string;
  limit?: number;
}): Promise<BossJob[]>

// Greeting (替代 submit)
export async function sendBossGreeting(params: {
  sessionCookies: string;
  jobDetailUrl: string;
  greetingText: string;
}): Promise<{
  outcome: 'success' | 'soft_failure' | 'hard_failure';
  confirmationSignal?: string;
  errorMessage?: string;
}>

// Message polling (Loop 2)
export async function pollBossMessages(params: {
  sessionCookies: string;
}): Promise<Array<{
  threadId: string;
  senderName: string;
  messageText: string;
  receivedAt: string;
}>>

// Send reply (Loop 2 follow-up)
export async function sendBossReply(params: {
  sessionCookies: string;
  threadUrl: string;
  messageText: string;
}): Promise<{
  outcome: 'success' | 'soft_failure' | 'hard_failure';
  errorMessage?: string;
}>

// Health check
export async function checkBossCapabilityHealth(params: {
  sessionCookies: string;
}): Promise<Record<string, 'healthy' | 'degraded' | 'blocked' | 'unknown'>>
```

**实现要点**:
- Search URL: `https://www.zhipin.com/web/geek/job?query={keyword}&city={cityCode}`
- Anti-scraping: EXTREME。`__zp_stoken__` 加密 cookie。Frequent CAPTCHA。
- Greeting: 找到"立即沟通"按钮 → 弹出对话框 → 输入消息 → 发送
- NO "投递" 按钮 — `sendBossGreeting` 替代 `submitApplication`
- Message polling: 访问 `https://www.zhipin.com/web/geek/chat` → 读取消息列表
- Session TTL: ~2-4h，需要 15 min 健康检查
- Daily budget: 10 greetings, 5 messages

**Mandatory non-goals**:
- 不实现 WebSocket 实时聊天 (V2)
- 不尝试绕过 CAPTCHA (手动解决)
- 不实现简历分享 (不是 V1 path)

---

## 七、Pipeline 路由变更

### 7.1 Discovery switch (`pipeline.ts:170`)

现有:
```typescript
switch (platform.code) {
  case 'greenhouse': ...
  case 'lever': ...
  case 'linkedin': ...
  case 'zhaopin': ...
  case 'lagou': ...
}
```

改为:
```typescript
switch (platform.code) {
  case 'greenhouse': ...
  case 'lever': ...
  case 'linkedin': ...
  case 'zhaopin':
  case 'lagou':
  case 'liepin':                    // NEW
    await this.runChinaPlatformDiscovery(teamId, platform, pipelineMode, platform.code);
    break;
  case 'boss_zhipin':               // NEW — 单独路径
    await this.runBossDiscovery(teamId, platform, pipelineMode);
    break;
}
```

### 7.2 Submission switch (`pipeline.ts:752`)

添加:
```typescript
case 'liepin':
  result = await submitLiepinApplication({
    jobUrl: ...,
    sessionCookies: connection.session_token_ref || '',
  });
  break;

// boss_zhipin: 不进入 runSubmission，在 runBossDiscovery 中走 runFirstContact
```

### 7.3 新增方法

```typescript
// Boss 专用 discovery → screen → greeting 管道
private async runBossDiscovery(teamId, platform, pipelineMode): Promise<void>

// Boss 打招呼 (替代 runSubmission)
private async runFirstContact(teamId, opportunityId, opportunity): Promise<void>
```

### 7.4 runChinaPlatformDiscovery 扩展

在现有的 `if (platformCode === 'zhaopin')` / `else if (platformCode === 'lagou')` 后添加:
```typescript
else if (platformCode === 'liepin') {
  jobs = await discoverLiepinJobs({ sessionCookies, keywords: keywordList, limit: 10 });
}
```

### 7.5 task-executor fetchPlatformMessages 扩展

在 `if (platformDef.code === 'linkedin')` 后添加:
```typescript
else if (platformDef.code === 'boss_zhipin') {
  // Boss 消息轮询逻辑
}
```

---

## 八、Budget 变更

`src/worker/services/budget.ts` PLATFORM_BUDGETS:

```typescript
// 新增:
liepin: { applications: 20, messages: 0, searches: 100 },

// 已有 (确认):
boss_zhipin: { applications: 10, messages: 5, searches: 50 },
```

Boss 的 `applications` 在此上下文中 = greetings (打招呼次数)。
Boss 的 `messages` = follow-up/reply messages。

---

## 九、CI/CD 要求

### 9.1 GitHub Actions CI (`ci.yml`)

现有 CI 只跑 `tsc --noEmit` + `npm run build`。需要添加:

```yaml
- name: Unit tests
  run: npm test -- --reporter=verbose
```

这确保新增文件的 import 和类型正确。

### 9.2 Build 验证

新增的 2 个 executor 文件必须:
- 被 `pipeline.ts` 正确 import
- `npx tsc --noEmit` 零错误
- `npm run build` 通过 (Next.js 不 tree-shake worker 代码，但 TypeScript check 覆盖)

### 9.3 Deploy 兼容性

- Edge Functions: 不受影响 (executor 只在 Worker 端运行)
- Fly.io Worker: 需要重新部署才能包含新 executor
- 前端: 不需要改动 (pipeline 变更不影响 UI)

---

## 十、测试计划

### 10.1 Unit Tests (`tests/pipeline-routing.test.ts`) — NEW

```
describe('Pipeline Discovery Routing')
  it('routes greenhouse to discoverGreenhouseJobs')
  it('routes lever to discoverLeverJobs')
  it('routes linkedin to discoverLinkedInJobs')
  it('routes zhaopin to runChinaPlatformDiscovery')
  it('routes lagou to runChinaPlatformDiscovery')
  it('routes liepin to runChinaPlatformDiscovery')     ← NEW
  it('routes boss_zhipin to runBossDiscovery')          ← NEW
  it('does not route unknown platform code')

describe('Pipeline Submission Routing')
  it('routes greenhouse/lever/linkedin to submit executors')
  it('routes zhaopin/lagou/liepin to passthrough submit')  ← NEW
  it('boss_zhipin never enters runSubmission')              ← NEW

describe('Boss Pipeline Path')
  it('advance recommendation → runFirstContact, not runSubmission')
  it('first contact creates conversation_thread')
  it('first contact sets stage to contact_started')
```

### 10.2 Budget Tests (`tests/budget.test.ts`) — EXTEND

```
describe('Budget: liepin')
  it('liepin has budget entry with applications:20, messages:0')
  it('liepin budget exhaustion follows same rules as zhaopin')

describe('Budget: boss_zhipin messages')
  it('boss messages:5 exhausts correctly')
  it('boss applications:10 (greetings) exhausts correctly')
```

### 10.3 State Machine Tests (`tests/state-machines.test.ts`) — EXTEND

```
describe('Boss stage transitions')
  it('allows prioritized → contact_started')
  it('allows contact_started → followup_active')
  it('allows followup_active → positive_progression')
  it('allows positive_progression → needs_takeover')
  it('rejects prioritized → submitted for boss path')  // 逻辑上，不是 state machine 限制
```

### 10.4 Smoke Test (`tests/smoke.test.ts`) — EXTEND

```
describe('Platform definitions include all 7 platforms')
  it('platform_definition has boss_zhipin and liepin entries')
  it('all 7 platform codes exist: greenhouse, lever, linkedin, zhaopin, lagou, boss_zhipin, liepin')
```

### 10.5 Executor Smoke Tests (`tests/executor-contracts.test.ts`) — NEW

```
describe('Executor module exports')
  it('liepin exports discoverLiepinJobs, submitLiepinApplication, checkLiepinCapabilityHealth')
  it('boss-zhipin exports discoverBossJobs, sendBossGreeting, pollBossMessages, sendBossReply, checkBossCapabilityHealth')
  it('boss-zhipin does NOT export any submit function')
```

---

## 十一、不在本 Spec 范围内的内容

- WebSocket 实时聊天 (Boss V2)
- LinkedIn Loop 2 (V1.1)
- 51Job executor (out of V1 scope)
- CAPTCHA 自动解决 (V1 手动)
- 浏览器指纹持久化 (Worker 端实现细节)
- DOM drift canary 自动化检测
