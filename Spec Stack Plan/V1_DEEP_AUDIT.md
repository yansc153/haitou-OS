# V1 深度审计报告

> 日期: 2026-04-08
> 范围: Worker (7 executor + pipeline + dispatch) / Backend (31 Edge Functions + 22 tables) / Frontend (全部页面)
> 结论: **架构合理，执行细节不成熟。核心投递能力从未在真实环境验证。**

---

## 一、审计总览

| 层 | 状态 | 说明 |
|---|---|---|
| **Worker 投递** | 🔴 未验证 | e2e test 明确跳过真实提交；selector 通用化；cover letter 可能以 JSON 发送 |
| **Worker Pipeline** | 🟡 有 bug | resume 下载失败不处理；retry_count 从未初始化；Boss 路由缺失 |
| **Backend API** | 🟡 有缺口 | health-check 查不存在的表；handoff 状态机缺 transition；解析失败返回 200 |
| **Frontend** | 🟡 需打磨 | 支付假的；设置不保存；重试按钮坏；缺错误状态 |

---

## 二、CRITICAL — 阻塞 E2E

| # | 问题 | 文件 | 影响 |
|---|------|------|------|
| C1 | `platform-health-check` 查 `team_member` 表 — 不存在 | `platform-health-check/index.ts` | 健康检查直接崩 |
| C2 | Handoff 状态机缺 `awaiting_takeover → waiting_external` | `_shared/handoff-helpers.ts` | waiting_external 操作永远 409 |
| C3 | 简历解析失败返回 200 | `onboarding-resume/index.ts` | 前端无法区分成功/失败 |
| C4 | `pipeline.ts` resume 查找 `teamForUser` 可能 null → crash | `pipeline.ts` runSubmission | 投递时 TypeError |
| C5 | resume 下载失败 → 空路径 → Playwright 报错 | `pipeline.ts` + `storage.ts` | 所有后续投递失败 |
| C6 | `dispatch-loop` retry_count 从未初始化 | `dispatch-loop.ts` sweepStaleTasks | 重试逻辑全部失效 |
| C7 | Settings 工作模式 toggle 不保存 | `settings/page.tsx` | 用户修改无效 |
| C8 | Review 页面重试按钮坏 | `review/page.tsx` | 点了没反应 |

---

## 三、HIGH — 很可能导致失败

| # | 问题 | 文件 | 影响 |
|---|------|------|------|
| H1 | Cover letter 以 JSON 原文发送到表单 | `pipeline.ts` runSubmission | Greenhouse/Lever 表单里出现 `{"full_text":"..."}` |
| H2 | LinkedIn DOM selector 极可能过期 | `linkedin.ts` | discovery 返回 0，静默吞掉 |
| H3 | 所有中文平台 selector 用 hash 混淆类名 | `zhaopin.ts` / `lagou.ts` | webpack rebuild 后全部失效 |
| H4 | Boss greeting 不验证是否真的发出 | `boss-zhipin.ts` sendBossGreeting | 返回 success 但消息未送达 |
| H5 | Cookie 验证只查 name+value 有值 | `platform-connect/index.ts` | 接受无效 cookie |
| H6 | 所有前端页面缺错误状态 | 全部 page.tsx | fetch 失败 → spinner 永转 |
| H7 | Billing 支付按钮是 alert("即将上线") | `billing/page.tsx` | 用户无法升级 |
| H8 | Browser cookie expires 设为 -1 | `browser-pool.ts` | session cookie 可能提前失效 |
| H9 | Boss pollBossMessages 只抓最后一条 | `boss-zhipin.ts` | 漏掉中间消息 |
| H10 | Discovery interval 5min (注释说原来 60min) | `dispatch-loop.ts` | 可能触发平台限流 |

---

## 四、MEDIUM — 应修但不阻塞

| # | 问题 | 文件 |
|---|------|------|
| M1 | GH/Lever resume upload 不验证是否成功 | `greenhouse.ts` / `lever.ts` |
| M2 | LinkedIn Easy Apply 硬编码 max 8 步 | `linkedin.ts` |
| M3 | `platform_daily_usage` 从未写入 | 全局 |
| M4 | `team.current_profile_baseline_id` 从未同步 | `onboarding-complete/index.ts` |
| M5 | PDF 字体从 CDN 加载 (不稳定) | `resume-pdf.tsx` |
| M6 | Landing 页面混有英文 ("Most Popular", "Watch Demo") | `landing/page.tsx` |
| M7 | `opportunities-list` stage mapping 单向 (material_ready→prioritized) | `opportunities-list/index.ts` |
| M8 | Platform bridge 消息无超时 | `platforms/page.tsx` |
| M9 | GH 表单 `input[name*="first"]` 过于宽泛 | `greenhouse.ts` |
| M10 | 单 browser 实例共享崩溃风险 | `browser-pool.ts` |

---

## 五、各平台 Selector 脆弱性评估

| 平台 | 反爬等级 | Selector 类型 | 脆弱性 | 真实验证 |
|------|---------|-------------|--------|---------|
| Greenhouse | Low | 标准 HTML ID/name | 中 (各公司定制不同) | ❌ 从未 |
| Lever | Low | 标准 HTML name | 中 | ❌ 从未 |
| LinkedIn | Very High | BEM class + aria-label | 极高 (频繁改版) | ❌ 从未 |
| Boss直聘 | Extreme | 混合 class + 系统卡片 | 极高 (加密 cookie) | ❌ 从未 |
| 智联 | Low-Mid | BEM class | 中高 | ❌ 从未 |
| 拉勾 | Moderate | Hash 混淆 (.item__10RTO) | 极高 (webpack 变) | ❌ 从未 |
| 猎聘 | Moderate | BEM + CSS 混淆 | 高 | ❌ 从未 |

---

## 六、本次修复范围

### 已修复 (阻塞 E2E) — 2026-04-08

```
✅ C1. platform-health-check: team_member → team 查询
✅ C2. handoff-helpers: 加 awaiting_takeover → waiting_external
✅ C3. onboarding-resume: parse 失败改 422
✅ C4. pipeline.ts: null check for teamForUser
✅ C5. pipeline.ts: resume 下载失败提前返回
✅ C6. dispatch-loop: 初始化 retry_count
✅ C7. settings/page.tsx: workMode 加入 save payload
✅ C8. review/page.tsx: 修重试按钮
✅ H1. pipeline.ts: cover letter JSON 解析出 full_text
```

### Codex Review 发现 — 已修复

```
✅ CX1. [P1] dedupe key company+title → external_ref (migration 重写)
✅ CX2. [P1] no-cookie 平台免除 session-expiry 检查 (GH/Lever)
✅ CX3. [P2] pagination cursor 对齐 sort field
✅ CX4. [P2] zh_keywords fallback 不再复制英文 → 留空让中文平台跳过
✅ CX5. [critical] onboarding target_roles 从 required 移除
✅ CX6. [high] cookie 平台无 token 时拒绝 → 不写 active
✅ CX7. [high] task executor 失败不再标 completed → 标 failed
```

### 待修 (提高成功率)

```
H6. 全部页面加 error state (fetch 失败 → 显示错误 + 重试)
H7. billing 支付按钮改为 "联系我们" 或隐藏
H8. browser-pool: cookie expires 不设 -1
H10. dispatch-loop: discovery interval 改回合理值
```

---

## 七、E2E 验收前置条件

在跑 E2E 之前，以上 C1-C8 + H1 必须全部修完。否则：
- C1: 平台健康检查崩 → 平台中心报错
- C2: 交接操作失败 → 交接验收不通过
- C4/C5: 投递崩 → 投递验收不通过
- C7: 设置不保存 → 设置验收不通过
- H1: 求职信乱码 → Greenhouse 表单提交异常
