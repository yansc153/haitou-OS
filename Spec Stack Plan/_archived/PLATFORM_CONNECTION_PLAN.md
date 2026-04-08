# 平台连接流程完整修复计划

> 日期: 2026-04-07
> 版本: V1
> 状态: Phase 1/2/3 代码完成，待部署 + 待补充

---

## 一、问题背景

### 用户报告的问题

1. **静默连接**: 点击"连接"不弹登录页，直接显示"已连接"——扩展静默读取浏览器旧 cookie
2. **过期 cookie 无感知**: cookie 过期后 Worker 静默失败，用户完全不知道
3. **扩展行为**: 应每次连接都打开登录页抓取新鲜 cookie，不能只依赖浏览器缓存
4. **缺少预警**: 没有日志、没有预警，cookie 过期了也不提醒用户
5. **VAULT key 不匹配**: Edge Function 加密用一个 key，Worker 解密用另一个，所有 cookie 平台无法工作

### 根因分析

| 根因 | 影响范围 | 严重度 |
|------|---------|--------|
| `connectPlatform()` 先调 `getCookies` 静默抓取 | 前端 | 高 — 用户以为连接了但实际无效 |
| `session_expires_at` 字段存在但从未设置 | Edge Function + Worker | 高 — 无法判断过期 |
| Executor 检测到 auth wall 时 `return []` | Worker 5 个 executor | 高 — 静默失败无反馈 |
| `failure_count`/`failure_reason` 从未更新 | Worker pipeline | 中 — 无失败追踪 |
| VAULT_ENCRYPTION_KEY 三处不一致 | Edge Function + Worker + .env | 致命 — 所有 cookie 解密失败 |
| Worker 256MB 内存跑 Chromium | Fly.io | 高 — OOM kill |

---

## 二、完整生命周期设计

### 正常连接流程

```
用户首次安装 Chrome 扩展（一次性）
    ↓
用户在平台中心点击"连接"
    ↓
前端发送 { action: 'loginAndCapture', platform } 给扩展
    ↓
扩展打开平台登录页（新 tab）
    ↓
用户在平台页面登录
    ↓
扩展检测到 auth cookie 出现 → 抓取全部 cookie → 返回给前端
    ↓
前端显示"上传凭据..."
    ↓
前端 POST /platform-connect → Edge Function 验证 cookie JSON → 加密存储 → 设置 session_expires_at
    ↓
前端显示"验证登录状态..."
    ↓
前端 POST /platform-health-check?connection_id=xxx → 探测平台是否真的能访问
    ↓
探测通过 → 显示"已连接" ✓
探测失败 → 显示"连接失败，请重试" ✗
```

### 运行中监控

```
Worker 每轮 discovery:
    ↓
1. TTL 预检: session_expires_at > now() ?
    YES → 继续使用 cookie 访问平台
    NO  → 标记 session_expired + 插入 team_event + 跳过该平台
    ↓
2. 执行 discovery:
    成功 → 更新 last_successful_action_at, failure_count = 0
    auth wall → throw Error → pipeline 捕获 → 标记 session_expired + 通知用户
    ↓
3. Cookie 即将过期（TTL 剩余 < 20%）:
    → 首页黄色横幅 "Boss直聘登录即将过期（剩余 XX 分钟）"
    → 平台中心卡片变黄
    → 实时动态插入警告事件
```

### 重新连接流程

```
用户看到"已过期" → 点击"重新连接"
    ↓
同正常连接流程（弹出登录页 → 扩展抓 cookie → 上传 → 验证）
    ↓
成功后 Worker 下一轮自动恢复该平台任务
```

### 断开连接

```
用户点击"断开连接"
    ↓
POST /platform-disconnect → 清空 session_token_ref → status = available_unconnected
    ↓
Worker 查 status='active' 自然跳过该平台
```

### 状态机

```
available_unconnected → (点击连接，打开登录页) → [前端本地: pending_login]
[前端本地: pending_login] → (扩展抓到 cookie，上传后端) → [前端本地: verifying]
[前端本地: verifying] → (探测通过) → active [DB]
[前端本地: verifying] → (探测失败) → session_expired [DB]
active → (TTL 剩余 < 20%) → active + 前端预警标记
active → (TTL 过期 / Worker auth wall) → session_expired + 自动暂停
session_expired → (点击重新连接) → [前端本地: pending_login]
active → (点击断开) → available_unconnected
```

---

## 三、场景矩阵

| # | 场景 | 触发条件 | 系统行为 | 用户看到什么 |
|---|------|---------|---------|------------|
| S1 | 首次连接 | 用户点"连接" | 弹出登录页 → 抓 cookie → 加密存储 → 探测验证 | "请在弹出的页面登录..." → "验证登录状态..." → "已连接" |
| S2 | 浏览器有过期 cookie | 用户点"连接" | **始终弹登录页**，不静默抓取 | 同 S1 |
| S3 | 扩展未安装 | 用户点"连接" | `sendBridgeMessage` 返回 error | "未检测到浏览器插件，请先安装" |
| S4 | 登录超时 (5分钟) | 用户打开登录页但没操作 | 扩展超时 | "连接超时：请在5分钟内完成平台登录" |
| S5 | Cookie 格式无效 | 扩展返回非标准 cookie | Edge Function 验证失败 | "Cookie数据格式无效" |
| S6 | 即时验证失败 | 探测平台返回 401/redirect | health-check 标记 expired | "登录凭据验证失败，请确保在平台上正常登录后再试" |
| S7 | Cookie TTL 过期 | session_expires_at < now | Worker 预检跳过 + 标记 expired | 首页横幅 + 平台中心"已过期" + 实时动态警告 |
| S8 | Cookie 即将过期 | TTL 剩余 < 20% | 前端查询 session_expires_at | 首页黄色横幅 "即将过期（剩余 XX 分钟）" |
| S9 | Worker 遇到 auth wall | 平台登录页/验证码 | executor throw → pipeline 捕获 → 标记 expired | 实时动态 "XX平台登录已失效，已暂停相关任务" |
| S10 | 重新连接 | 用户点"重新连接" | 同 S1 流程 | 同 S1 |
| S11 | 断开连接 | 用户点"断开连接" | 清空 token + 标记 unconnected | "未连接" + "连接"按钮 |
| S12 | VAULT key 不匹配 | Edge Function 和 Worker 用不同 key | 解密失败 | Worker 日志报错（前端无直接反馈 → 需改进） |

---

## 四、平台规则配置

| 平台 | TTL | 预警时机 | 每日限制 | 需要 Cookie | 需要 Chromium |
|------|-----|---------|---------|------------|-------------|
| Boss直聘 | 3h | 剩余 36min | 10次投递/10条消息 | YES | YES |
| LinkedIn | 24h | 剩余 4.8h | 15次投递/10条消息 | YES | YES |
| 智联招聘 | 24h | 剩余 4.8h | 30次投递 | YES | YES |
| 拉勾 | 24h | 剩余 4.8h | 30次投递 | YES | YES |
| 猎聘 | 12h | 剩余 2.4h | 20次投递 | YES | YES |
| Greenhouse | 720h (30天) | — | 30次投递 | NO (公开 API) | NO |
| Lever | 720h (30天) | — | 30次投递 | NO (公开 API) | NO |

---

## 五、改动清单 — 按组件分

### 5.1 Chrome 扩展 (`extension/`)

| 文件 | 改动 | 状态 |
|------|------|------|
| `background.js` | 新增 `validateCookieExpiry()` 函数 | ✅ 完成 |
| `background.js` | `getCookies` 返回值增加 `{ expired, expiryInfo }` | ✅ 完成 |
| `background.js` | 前端改用 `loginAndCapture` 做连接（`getCookies` 保留用于健康检查） | ✅ 完成 |

### 5.2 前端 (`app/`)

| 文件 | 改动 | 状态 |
|------|------|------|
| `app/(app)/platforms/page.tsx` | 重写 `connectPlatform()`: 始终调 `loginAndCapture` | ✅ 完成 |
| `app/(app)/platforms/page.tsx` | 新增 `connectingState` 追踪（"请在弹出的页面登录..."等） | ✅ 完成 |
| `app/(app)/platforms/page.tsx` | 连接后调 `platform-health-check` 即时验证 | ✅ 完成 |
| `app/(app)/platforms/page.tsx` | 中文错误消息映射表 | ✅ 完成 |
| `app/(app)/platforms/page.tsx` | `session_expired` 状态显示 `failure_reason` | ✅ 完成 |
| `app/(app)/platforms/page.tsx` | `expiring_soon` 样式：卡片边框变黄 + 剩余时间 | ❌ 未实现 |
| `app/(app)/home/page.tsx` | 过期预警黄色横幅（查询 session_expires_at） | ✅ 完成 |

### 5.3 Edge Functions (`supabase/functions/`)

| 文件 | 改动 | 状态 | 部署 |
|------|------|------|------|
| `_shared/platform-rules.ts` | 新建：共享 TTL 配置 + probe URLs | ✅ 完成 | ⏳ 待部署 |
| `platform-connect/index.ts` | Cookie JSON 验证 + `session_expires_at` 计算 | ✅ 完成 | ⏳ 待部署 |
| `platform-connect/index.ts` | import 共享 `PLATFORM_TTL_HOURS` | ✅ 完成 | ⏳ 待部署 |
| `platform-health-check/index.ts` | import 共享配置（去掉本地常量） | ✅ 完成 | ⏳ 待部署 |
| `platform-health-check/index.ts` | 单连接即时验证模式 `{ connection_id }` | ✅ 完成 | ⏳ 待部署 |
| `platform-health-check/index.ts` | 支持用户 JWT 认证（不只是 CRON_SECRET） | ✅ 完成 | ⏳ 待部署 |
| `platforms-list/index.ts` | 返回 `session_expires_at` + `failure_reason` | ✅ 完成 | ⏳ 待部署 |

### 5.4 Worker (`src/worker/`)

| 文件 | 改动 | 状态 | 部署 |
|------|------|------|------|
| `pipeline.ts` | connection 查询增加 `id, failure_count, session_expires_at` | ✅ 完成 | ⏳ 待部署 |
| `pipeline.ts` | TTL 预检：过期直接跳过 + 标记 `session_expired` | ✅ 完成 | ⏳ 待部署 |
| `pipeline.ts` | auth wall 捕获 → 更新 DB + 插入 `team_event` | ✅ 完成 | ⏳ 待部署 |
| `pipeline.ts` | 成功后更新 `last_successful_action_at` + 重置 `failure_count` | ✅ 完成 | ⏳ 待部署 |
| `executors/linkedin.ts` | `isAuthWall → throw` 代替 `return []` | ✅ 完成 | ⏳ 待部署 |
| `executors/zhaopin.ts` | `isLoginPage → throw` 代替 `return []` | ✅ 完成 | ⏳ 待部署 |
| `executors/lagou.ts` | `isLoginPage → throw` 代替 `return []` | ✅ 完成 | ⏳ 待部署 |
| `executors/liepin.ts` | `isLoginPage → throw` 代替 `return []` | ✅ 完成 | ⏳ 待部署 |
| `executors/boss-zhipin.ts` | `isLoginPage/isSecurityChallenge → throw` | ✅ 完成 | ⏳ 待部署 |

### 5.5 数据库

| 改动 | 状态 |
|------|------|
| `session_expires_at` 字段已存在于 schema | ✅ 无需 migration |
| `failure_count`, `failure_reason` 已存在 | ✅ 无需 migration |
| 不新增 `verifying` enum — 用前端本地状态 | ✅ 无需 migration |

### 5.6 基础设施

| 改动 | 状态 |
|------|------|
| VAULT_ENCRYPTION_KEY 统一 (Edge + Worker + .env.worker) | ✅ 完成 |
| Worker 内存 256MB → 1024MB | ✅ 完成 |
| 旧 cookie token 清空 + 用户重新连接 | ✅ 完成 |

---

## 六、未完成项清单

### 优先级 P0 — 阻塞部署

| # | 项目 | 组件 | 状态 |
|---|------|------|------|
| P0-1 | `platform-health-check` 单连接即时验证模式 | Edge Function | ✅ 已完成 |
| P0-2 | `platform-health-check` 支持用户 JWT | Edge Function | ✅ 已完成 |
| P0-3 | 部署 3 个 Edge Functions | CI/CD | ⏳ 待执行 |
| P0-4 | build + deploy Worker | CI/CD | ⏳ 待执行 |

### 优先级 P1 — 下一 session 完成

| # | 项目 | 组件 | 预估 |
|---|------|------|------|
| P1-1 | 平台中心 `expiring_soon` 卡片样式（边框变黄 + 剩余时间） | 前端 | 15 min |
| P1-2 | Worker 即将过期预警 team_event（TTL 剩余 < 20%） | Worker | 15 min |
| P1-3 | Greenhouse 404 修复（board token 配置） | Worker | 调查 |
| P1-4 | Lever discovery 无岗位（需调查） | Worker | 调查 |
| P1-5 | 中文平台 executor 调试日志（Chromium 卡住无输出） | Worker | 20 min |

### 优先级 P2 — 测试

| # | 项目 | 预估 |
|---|------|------|
| P2-1 | `tests/platform-connection.test.ts` — pipeline TTL 预检 | 10 min |
| P2-2 | `tests/platform-connection.test.ts` — auth wall 捕获 | 10 min |
| P2-3 | `tests/platform-connection.test.ts` — cookie JSON 验证 | 10 min |
| P2-4 | `tests/platform-connection.test.ts` — session_expires_at 计算 | 5 min |
| P2-5 | `tests/platform-connection.test.ts` — 成功更新 last_successful_action_at | 5 min |

### 优先级 P3 — 验收回归

| # | 项目 | 方式 |
|---|------|------|
| P3-1 | 重跑 PIPELINE_VERIFICATION_PLAN 52 项测试 | MCP Playwright |
| P3-2 | 修复之前发现的 bug: D7 主题弹窗 | 前端 |
| P3-3 | 修复之前发现的 bug: D2/F1 AI 调用次数 = 0 | Worker + 前端 |
| P3-4 | 修复之前发现的 bug: A1.1 首页无 discovery 事件 | Worker |
| P3-5 | 修复之前发现的 bug: D3 英文泄漏 | 前端 |

---

## 七、部署清单

### Edge Functions

```bash
supabase functions deploy platform-connect --no-verify-jwt
supabase functions deploy platform-health-check --no-verify-jwt
supabase functions deploy platforms-list --no-verify-jwt
```

### Worker

```bash
# 1. Build
npm run build:worker  # 或 tsc

# 2. Deploy
fly deploy -a haitou-os-worker --local-only
```

### 部署后验证

```bash
# 1. 确认 Edge Function 部署成功
supabase functions list | grep platform

# 2. 确认 Worker 启动正常
fly logs -a haitou-os-worker --no-tail | tail -5

# 3. 确认 VAULT key 一致（两边 digest 应相同）
fly secrets list -a haitou-os-worker | grep VAULT
supabase secrets list | grep VAULT
```

---

## 八、之前 Pipeline 验收中发现的 Bug（待修复）

来源: PIPELINE_VERIFICATION_PLAN.md 52 项验收

| Bug ID | 描述 | 严重度 | 修复位置 |
|--------|------|--------|---------|
| D7 | 刷新首页自动弹出主题模式弹窗 | 高 | 前端 theme modal |
| A1.1 | 首页实时动态无"岗位发现"事件 | 高 | Worker event 插入 |
| D2/F1 | AI 调用次数始终 = 0 | 高 | Worker llm_calls 计数 |
| D3 | AI 评估理由英文泄漏 + 活动回顾阶段名英文 | 中 | 前端 i18n |
| C2 | Lever 无岗位发现 | 中 | Worker Lever executor |
| — | Greenhouse 404 (board token) | 中 | Worker GH executor 配置 |
| — | 重复岗位（Datadog - vs –） | 低 | Worker 去重逻辑 |

---

## 九、下一 Session 执行顺序

```
1. 完成 P0（health-check 改动 + 部署）
2. 完成 P1（前端预警样式 + Worker 预警事件 + 调试日志）
3. 部署 + 用户重新连接平台
4. 跑 P2 测试
5. 跑 P3 验收回归（52 项）
6. 修复回归中发现的 bug
7. /design-review 视觉审查
```

---

## 十、Eng Review 发现 (2026-04-07)

### Issue 1: P0 依赖缺失 (已解决)
前端代码已写了 `platform-health-check` 即时验证调用，但 Edge Function 还没改成支持单连接模式 + 用户 JWT。
**决定:** P0-1/P0-2 必须在部署前完成。

### Issue 2: 测试优先级提升 (已解决)
原计划测试在 P2（延后），但 executor 从 `return []` 改成 `throw Error(...)` 是行为变更，存在回归风险。
**决定:** 测试提升到 P0 同级，部署前必须写完。特别是 executor throw → pipeline 捕获的回归测试。

### 回归风险
5 个 executor 文件改了 auth wall 处理方式：`return []` → `throw Error('session_expired:...')`。pipeline.ts 的 catch 块已更新处理。需要回归测试验证。

### 修正后的执行顺序

```
1. 实现 P0-1/P0-2 (health-check 单连接模式 + 用户 JWT)
2. 写测试 (P2 提升到 P0 — 特别是 executor throw 回归测试)
3. 实现 P1 (前端预警样式 + Worker 预警事件 + 调试日志)
4. 部署 Edge Functions + Worker
5. 用户重新连接平台
6. 跑 P3 验收回归 (52 项)
7. 修复回归中发现的 bug
8. /design-review 视觉审查
```

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 2 | CLEAR | 2 issues, 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |

**VERDICT:** ENG CLEARED — 2 issues found and resolved (P0 dependency + test priority uplift)
