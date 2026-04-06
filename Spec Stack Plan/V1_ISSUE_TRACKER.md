# V1 Issue Tracker — Pipeline + 前端完整性

> 日期: 2026-04-06
> 状态: **12/12 已修复** — 待运行时 E2E 验证
> 原则: 前端看不到 = 不存在。先看前端，再查后端，修完回前端验证。
> 数据已清零，24h runtime 已分配，准备从头跑 pipeline。

---

## 一、Spec 文件状态审计

| Spec 文件 | 状态 | 说明 |
|-----------|------|------|
| PIPELINE_VERIFICATION_PLAN.md | **当前核心** | Loop 1/2 验证计划，48 项检查 |
| PLATFORM_RULE_AND_AGENT_SPEC.md | **当前核心** | 7 平台规则 + 3 种投递模式 |
| PRODUCT_FLOW_V2.md | **当前核心** | 产品流程 V2 |
| DATA_MODEL_SPEC.md | **当前核心** | 数据模型，未过时 |
| PROMPT_CONTRACT_SPEC.md | **当前核心** | AI prompt 合约 |
| ADMIN_PANEL_SPEC.md | 有效 | Admin 面板 |
| E2E_VERIFICATION_CHECKLIST.md | 有效 | 83 项验证清单 |
| FULL_PRODUCT_LINE_AUDIT.md | 有效 | 全量审计结果 |
| MAC_MINI_MIGRATION_PLAN.md | **已废弃** | 决定不迁移 Mac Mini |
| UI_GENERATION_BRIEF.md | 参考 | UI 生成指导，初期文件 |
| UI_PRD.md | 参考 | UI PRD，部分过时 |
| UI_SURFACE_SPEC.md | 参考 | UI 表面规范 |
| FRONTEND_INTERFACE_SPEC.md | 参考 | 前端接口，部分过时 |
| PRD_FIRST_PRINCIPLES.md | 参考 | 第一性原理，不变 |
| BUSINESS_REQUIREMENTS_FIRST_PRINCIPLES.md | 参考 | 业务需求，不变 |
| IMPLEMENTATION_AND_GOVERNANCE_SPEC.md | 参考 | 实施治理，部分过时 |
| PRODUCT_FLOWS.md | **被 V2 替代** | 旧版产品流程 |

---

## 二、P0 Issues — Pipeline 不通

### Issue #1: Boss直聘 + 猎聘 discovery 未实现 ✅ RESOLVED
- **现象**: 平台中心显示"已连接"，但机会中心 0 中文岗位
- **根因**: `src/worker/pipeline.ts:170` switch 语句缺少 `boss_zhipin` 和 `liepin` case
- **修复**:
  - 创建 `src/worker/executors/liepin.ts` (discover + submit + health)
  - 创建 `src/worker/executors/boss-zhipin.ts` (discover + greeting + polling + reply)
  - pipeline.ts: 添加 liepin switch case + runChinaPlatformDiscovery 扩展
  - pipeline.ts: 添加 boss_zhipin switch case + runBossDiscovery + runFirstContact 方法
  - task-executor.ts: 添加 Boss 消息轮询
  - budget.ts: 添加 liepin budget entry
  - 新增 Spec: MULTI_PLATFORM_PIPELINE_SPEC.md (7 平台 × 3 模式 × 2 Loop)
- **测试**: 64 unit tests passing (pipeline-routing + executor-contracts + budget + pipeline-logic)
- **验证**: 启动团队 → 等 5 分钟 → 机会中心出现 Boss/猎聘岗位

### Issue #2: LinkedIn discovery 实际不工作 ✅ RESOLVED
- **现象**: 机会中心没有 LinkedIn 岗位
- **排查结果**: 代码完整 (discovery + Easy Apply + pipeline routing 全有)，不是框架空壳
- **代码问题**: discovery 没有抓取 JD 文本 (`job_description_text` 始终为空)
- **修复**: 添加 JD 抓取逻辑 — 点进 top 5 结果获取详情页 JD (linkedin.ts)
- **运行时前提**: 用户需要安装插件 + 连接 LinkedIn cookie，否则 discovery 返回空
- **验证**: 确认 LinkedIn 已连接 → 启动团队 → 等 5 分钟 → 机会中心出现 LinkedIn 岗位

### Issue #3: Lever discovery 实际不工作 ✅ RESOLVED
- **现象**: 机会中心没有 Lever 岗位（只有 Greenhouse）
- **根因**: DOMAIN_BOARD_MAP 中 Lever slug 大部分是 404 (figma/wise/linear/retool/cohere/huggingface/anchorage-digital 全不存在)。且 `discoverLeverJobs` 在 404 时 throw Error 导致整个公司被跳过。
- **修复**:
  1. 验证了 8 个可用 Lever slug: netflix, plaid, spotify, lever, palantir, toptal, wealthsimple, color
  2. 替换 DOMAIN_BOARD_MAP 中所有 Lever 条目为已验证 slug
  3. `discoverLeverJobs` 改为 404 时 return [] (不 throw)
- **验证**: 启动团队 → 等 5 分钟 → 机会中心出现 Netflix/Spotify/Toptal 等 Lever 岗位

### Issue #4: 精修简历对比视图消失 ✅ RESOLVED (代码正确，等数据)
- **排查**: 对比视图代码完整 (SectionComparison + JdMatchPanel + CoverLetterView)
- **原因**: 数据清零后 material 表为空 → 显示 "暂无简历对比数据"（符合预期）
- **逻辑**: 只有 full_tailored 平台 (GH/Lever/LinkedIn) 的 advance 岗位才生成 material
- **passthrough 平台 (中文) 不会有对比视图** — 这是设计意图
- **验证**: pipeline 跑 GH/Lever 岗位 → advance → material 生成 → 岗位详情页出现对比

### Issue #5: 实时动态没有流式输出 ✅ RESOLVED (代码正确，运行时验证)
- **现象**: 启动团队后，需要手动刷新页面才能看到新事件
- **排查结果**: 代码完全正确 —
  - `useTimelineFeed` 正确订阅 `postgres_changes` INSERT on `timeline_event`
  - `supabase_realtime` publication 已包含 `timeline_event` (migration 00012)
  - RLS policy 正确 (`team_id` scope via `auth.uid()`)
  - `createBrowserClient` 自动携带用户 JWT → RLS 通过
  - 回调正确 prepend 新事件到 feed
- **小修复**: 添加 Boss 新事件类型中文标签 (boss_greeting_sent/failed) 到 EVENT_TYPE_ZH
- **运行时前提**: Worker 必须在运行 + team active + 有 active platform_connection
- **验证**: 启动团队 → 不刷新 → 30 秒内看到新事件自动出现

---

## 三、P1 Issues — 前端/UX 问题

### Issue #6: "查看全部日志" 链接目标错误 ✅ RESOLVED
- **修复**: `home/page.tsx` href `/review` → `/opportunities`

### Issue #7: AI 调用次数永远是 0 ✅ RESOLVED
- **根因**: `team` 表缺少 `total_llm_calls` / `total_input_tokens` / `total_output_tokens` 列。`increment_token_usage` RPC 也不存在。pipeline 的 `recordTokenUsage` 静默失败。
- **修复**:
  1. 新建 migration `00013_token_usage_columns.sql`: 添加 3 列 + 创建 `increment_token_usage` RPC
  2. `home-get` 改为从今日完成的 AI 任务估算调用次数 (screening=3, material=2, 其他=1)
- **验证**: 部署 migration → pipeline 跑一轮 → AI 调用次数 > 0

### Issue #8: "余额耗尽" 消息是英文 ✅ RESOLVED
- **排查**: `forcePause` timeline event 已经是中文。还找到 3 处英文:
  - `billing.ts` ledger reason → 改为中文
  - `handoff-detection.ts` summary → "需要接管: {reason}"
  - `pipeline.ts` budget_exhausted → "今日投递次数已用完 ({platform})"

### Issue #9: 主题选择弹窗每次刷新都出现 ✅ RESOLVED (已在之前修复)
- **排查**: ThemeSwitcher 以 `open=false` 初始化，不会自动弹出。主题已通过 localStorage 持久化。

---

## 四、P1 Issues — Loop 1/2 执行逻辑

### Issue #10: Loop 1 (发现→投递) 只走了 Greenhouse ✅ RESOLVED (代码修复完成)
- **根因**: #1 Boss/猎聘 未实现, #2 LinkedIn 缺 JD, #3 Lever slug 全 404
- **修复**: 全部在 #1/#2/#3 中修复。现在 7 个平台 switch 全覆盖:
  - Greenhouse ✅ | Lever ✅ (slug 已验证) | LinkedIn ✅ (JD 已加)
  - 智联 ✅ | 拉勾 ✅ | 猎聘 ✅ (新建 executor)
  - Boss直聘 ✅ (新建 executor, 独立 pipeline 路径)
- **运行时验证**: 启动团队 → 各平台都出现岗位

### Issue #11: Loop 2 (回复→跟进→交接) ✅ RESOLVED (代码实现完成)
- **实现**: 在 Issue #1 中完成:
  - `boss-zhipin.ts`: sendBossGreeting + pollBossMessages + sendBossReply
  - `pipeline.ts`: runBossDiscovery → runFirstContact (prioritized → contact_started)
  - `task-executor.ts`: fetchPlatformMessages 支持 boss_zhipin
  - dispatch-loop.ts: sweepReplyPolling + sweepFollowUps 已就绪 (检查 contact_started stage)
- **V1 规则**: 只有 Boss直聘 有 Loop 2。其他平台 submit → 结束。
- **运行时验证**: Boss 打招呼 → 等回复 → 检测面试信号 → 交接中心出现

### Issue #12: 中文平台 passthrough 模式未验证 ✅ RESOLVED (代码正确，运行时验证)
- **排查结果**: 代码路径完整 —
  - `runChinaPlatformDiscovery` 正确调用 zhaopin/lagou/liepin discover 函数
  - screening → advance → `runSubmission` (跳过材料)
  - submission switch 覆盖 zhaopin/lagou/liepin
  - DB seed: 3 个中文平台都是 `pipeline_mode = 'passthrough'`
  - Cookie 从 `platform_connection.session_token_ref` 获取
- **运行时前提**: 用户需安装插件 + 连接平台 (cookie injection)
- **验证**: 连接智联/拉勾/猎聘 → 启动团队 → 等 5 分钟 → 机会中心出现中文岗位

---

## 五、修复优先级

```
Round 1: 让 pipeline 能跑通（后端）
  ├── #1  Boss直聘 + 猎聘 discovery 实现
  ├── #2  LinkedIn discovery 验证/修复
  ├── #3  Lever discovery 验证/修复
  ├── #12 中文平台 passthrough 验证/修复
  └── #5  实时动态流式输出

Round 2: 前端展示完整（前端）
  ├── #4  精修简历对比视图恢复
  ├── #6  "查看全部日志" 链接修复
  ├── #7  AI 调用次数统计修复
  ├── #8  英文消息本地化
  └── #9  主题弹窗只显示一次

Round 3: Loop 2 验证
  └── #11 回复→跟进→交接 全链路
```

---

## 六、验证方法

每个 Issue 修完后，必须：
1. **前端验证**: MCP Playwright 打开对应页面 → 截图 → 确认视觉正确
2. **不刷新验证**: 对于实时功能，停留在页面上等待更新出现
3. **跨页面验证**: 首页数字和机会中心漏斗数字一致
4. **build 验证**: `npm run build` + `npx tsc --noEmit` 通过

---

## 七、当前环境状态

```
数据库: 已清零（保留 user/team/agents/platforms/profile）
运行时间: 24h 已分配
团队状态: 已暂停
Worker: Fly.io 运行中，等待 team active
前端: localhost:3001 运行中
CI: GitHub Actions 已配置
最后 push: v1.0.0 tag on GitHub
```
