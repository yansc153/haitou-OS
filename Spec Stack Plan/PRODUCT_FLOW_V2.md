# 海投 OS — 产品流程设计 V2

> 日期: 2026-04-06
> 状态: 已确认，待实施
> 核心原则: 用户不能多点一个按钮。3 次点击后团队开始工作。

---

## 一、用户旅程总览

```
Phase 1: 注册（1 次点击）
  登录(Google/GitHub) → 创建 user + onboarding_draft

Phase 2: Onboarding（2 次点击：上传简历 + 完成配置）
  上传简历 → AI 解析 → 填目标岗位/城市/策略 → 一键「完成配置」
  → 后台一次性完成:
    a) 创建 team + profile_baseline + submission_profile + user_preferences
    b) 创建 7 个 agent_instance + 分配 6h runtime
    c) 自动连接 Greenhouse + Lever（公开平台，不需要 Cookie）
    d) 自动 team-start → runtime_status = active
  → 跳转 /home

Phase 3: 首次价值展示（0 次点击）
  → Worker 自动发现岗位（Greenhouse/Lever 公开 API）
  → 10 秒后首页出现"岗位发现"动态
  → 2 分钟后出现"AI 筛选完成"
  → 用户看到价值 ✓

Phase 4: 引导升级（用户自主选择）
  → 首页横幅: "安装插件解锁 LinkedIn 和中文平台"
  → 安装插件 → 连接 LinkedIn → 更多岗位
  → 升级 Pro → 解锁中文平台

Phase 5: 持续运营
  → Worker 7×24: 发现 → 筛选 → 材料 → 投递 → 跟进 → 交接
```

---

## 二、逐步骤详解

### Step 1: 登录

| 项目 | 内容 |
|------|------|
| 页面 | `/login` |
| 用户看到 | "拥有你的 AI 求职运营团队" + Google/GitHub 按钮 |
| 用户操作 | 点击 Google 登录（1 次点击） |
| 后端 | OAuth → 创建 auth user + user 表 + onboarding_draft(status=resume_required) |
| 跳转 | → `/resume` |
| 弹窗 | 无 |
| 改动 | **无需改动** |

### Step 2: Onboarding（单页完成）

| 项目 | 内容 |
|------|------|
| 页面 | `/resume` |
| 用户看到 | 简历上传区 + 目标岗位 + 目标城市 + 策略选择 + Agent 预览 |
| 用户操作 | ①上传简历 ②填目标岗位 ③选城市 ④选策略 ⑤点击「完成配置」 |
| 后端一次调用完成 | onboarding-complete（合并激活+启动+自动连接） |
| 跳转 | → `/home`（跳过 /complete、/activation、/readiness） |
| 弹窗 | 无（进度条 inline 显示） |

**后端 onboarding-complete 新逻辑:**

```
POST /functions/v1/onboarding-complete

步骤 1: 创建 team (status=active)
步骤 2: 创建 profile_baseline (从简历解析数据)
步骤 3: 创建 submission_profile
步骤 4: 创建 user_preferences
步骤 5: 创建 7 个 agent_instance
步骤 6: 分配 runtime (free=21600s, pro=28800s, plus=86400s)
步骤 7: 自动连接 Greenhouse + Lever
         → 查 platform_definition WHERE supports_cookie_session = false
         → 插入 platform_connection(status=active, session_token_ref=null)
步骤 8: 记录 session_start (team 自动启动)
步骤 9: 更新 team.runtime_status = active

任何步骤失败 → 回滚已创建数据 → 返回错误
```

**前端改动:**

| 改动 | 说明 |
|------|------|
| 去掉 coverage_scope 三个按钮 | 默认 cross_market，用户不需要选 |
| 「完成配置」按钮一次调用 | 调 onboarding-complete 后直接跳 /home |
| 按钮文案 | "完成配置" → "开始求职" 或保持不变 |

### Step 3: 首次价值展示

| 项目 | 内容 |
|------|------|
| 页面 | `/home` |
| 用户看到 | 7 个 Agent 头像 + 空的实时动态 + 今日运营(全 0) |
| 用户操作 | 无 — 等着看 |
| 10s 后 | Worker 触发 discovery → 实时动态出现"岗位发现" |
| 2min 后 | 筛选完成 → "AI 筛选 — 已完成 N 个岗位评估" |
| 5min 后 | 如有 advance → 材料生成 → "已为 XX 生成投递材料" |
| 8min 后 | 投递完成 → "已投递 XX @ YY" |

**首页底部引导横幅（新增）:**

```
┌──────────────────────────────────────────────────────┐
│  🔌 解锁更多平台                                     │
│                                                       │
│  当前仅在 Greenhouse / Lever 上搜索                    │
│  安装浏览器插件，连接 LinkedIn 和中文招聘平台           │
│                                                       │
│  [安装插件]  [了解更多平台 →]                          │
└──────────────────────────────────────────────────────┘

显示条件: 用户只连接了不需要 Cookie 的平台（Greenhouse/Lever）
隐藏条件: 用户已连接任何需要 Cookie 的平台（LinkedIn/智联等）
```

### Step 4: 插件安装与平台连接

| 触发点 | 位置 |
|--------|------|
| 首页横幅 | "安装插件" 按钮 |
| 平台中心顶部 | 插件安装引导条 |
| Readiness 页 | Step 01 安装引导（保留但非必经） |

**连接流程:**

```
用户点击「安装插件」
  → 打开 Chrome Web Store
  → 用户安装扩展
  → 回到页面 → 前端检测到插件
  → 横幅变为: "插件已安装 ✓ 前往连接 LinkedIn →"

用户点击 LinkedIn「连接」
  → 插件读取 Cookie
  → POST platform-connect(cookies)
  → LinkedIn 状态 → ✅ 已连接
  → Toast: "LinkedIn 已连接 ✓"
  → Worker 下一轮开始扫 LinkedIn

连接失败:
  → Toast: "连接失败: 请先登录 LinkedIn 后重试"
```

### Step 5: 平台中心功能说明

每个平台卡片展示:

```
┌──────────────────────────────────┐
│  Greenhouse          ✅ 已连接   │
│  英文 ATS 门户                   │
│                                   │
│  ✅ 自动搜索岗位                  │
│  ✅ AI 简历定制                   │
│  ✅ 自动表单投递                  │
│  ❌ 消息/对话                     │
│                                   │
│  反爬: 🟢低  |  日限: 30 申请     │
│  [已连接 · 断开]                  │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│  LinkedIn             未连接     │
│  全球招聘网络                    │
│                                   │
│  ✅ 自动搜索岗位                  │
│  ✅ AI 简历定制                   │
│  ✅ Easy Apply 自动投递           │
│  ✅ 消息跟进 + 回复分析           │
│  ✅ 交接检测                      │
│                                   │
│  反爬: 🟡高  |  日限: 15申/10消   │
│  ⚠️ 需要浏览器插件               │
│  [安装插件后连接]                 │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│  智联招聘           🔒 Pro       │
│  中文招聘平台                    │
│                                   │
│  ✅ 自动搜索岗位                  │
│  ✅ 一键投递                      │
│  ✅ 自动打招呼                    │
│  ❌ AI 简历定制（用优化版直投）    │
│                                   │
│  反爬: 🟢低  |  日限: 30 申请     │
│  ⚠️ 需要插件 + Pro 套餐          │
│  [升级解锁]                       │
└──────────────────────────────────┘
```

---

## 三、后端管道联动

### 用户选择 → Worker 行为映射

```
用户 target_roles = ["后端工程师", "产品经理"]
  → profile_baseline.inferred_role_directions
  → pipeline discovery 搜索关键词

用户 target_locations = ["上海", "Remote"]
  → user_preferences.preferred_locations
  → pipeline discovery 地点过滤

用户 strategy_mode = "broad"
  → team.strategy_mode
  → recommendation-generation skill 更倾向 advance

用户连接的平台 (platform_connection.status=active)
  → pipeline 对每个 active connection 跑对应 executor
  → 不需要 coverage_scope — 扫什么由连了什么平台决定
```

### Greenhouse/Lever 公司列表来源

```
当前: 硬编码 ["coinbase", "consensys"]
改为: 从 profile_baseline 推断

逻辑:
1. 读 profile_baseline.primary_domain (如 "fintech", "ai", "web3")
2. 读 profile_baseline.inferred_role_directions (如 ["Backend Engineer"])
3. 匹配预设行业→公司映射表:
   fintech → [stripe, square, coinbase, revolut, wise, ...]
   ai → [openai, anthropic, huggingface, cohere, ...]
   web3 → [coinbase, consensys, uniswap, ...]
   general → [notion, figma, vercel, supabase, ...]
4. 合并为 board_tokens 列表
5. 每轮 discovery 从列表中取 5-10 个公司扫描
```

### 两条管道路径

```
英文平台 (full_tailored):
  discover → screen (fit + conflict + recommendation)
  → tailor resume (truthful-rewrite)
  → cover letter (cover-letter-generation)
  → submit (Playwright 填表)

中文平台 (passthrough):
  discover → screen (fit + conflict + recommendation)
  → submit directly (用 onboarding 时 AI 优化的简历)
  → 打招呼消息
```

---

## 四、计费模型

| 方案 | 价格 | 运行时间 | 平台 |
|------|------|----------|------|
| Free | ¥0/月 | 6 小时 | Greenhouse + Lever（自动连接） |
| Pro | ¥299/月 | 8 小时 | + LinkedIn + 智联 + 拉勾 + 猎聘 |
| Plus | ¥899/月 | 24 小时 | + Boss直聘 + 所有平台 |

- 中英文平台一起跑、一起计时
- 余额耗尽 → 自动暂停团队
- 本地开发/管理员不受 free plan 限制

---

## 五、弹窗/提示规则

| 场景 | 类型 | 内容 |
|------|------|------|
| 简历上传成功 | Inline ✅ | "简历已就绪" |
| 简历解析失败 | Inline ⚠️ | "解析失败: 请上传 DOCX 格式" |
| 完成配置成功 | 无弹窗 | 直接跳转 /home |
| 完成配置失败 | Toast 红色 | "创建团队失败: {原因}" |
| 平台连接成功 | Toast 绿色 | "LinkedIn 已连接 ✓" |
| 平台连接失败 | Toast 红色 | "连接失败: 请先登录 LinkedIn" |
| 启动团队成功 | 无弹窗 | 状态栏变绿 |
| 启动团队失败 | Toast 红色 | "启动失败 [422]: {blockers}" |
| 暂停团队成功 | 无弹窗 | 状态栏变灰 |
| 余额耗尽自动暂停 | 首页事件 | "余额耗尽 — 团队已暂停" |
| 设置保存成功 | Toast 绿色 | "保存成功 ✓" |
| Cookie 过期 | 平台卡片 ⚠️ | "登录已过期，请重新连接" |

---

## 六、页面路由简化

### 当前路由（7 步）
```
/login → /resume → /complete → /activation → /readiness → /home
```

### 新路由（3 步）
```
/login → /resume → /home
```

### Root Router 逻辑 (`app/page.tsx`)

```
if (!authenticated) → /login
if (!onboarding_draft || draft.status !== 'completed') → /resume
→ /home
```

### 保留但非必经的页面
- `/readiness` — 用户可以从导航进入，查看平台连接状态
- `/activation` — 重定向到 /home
- `/complete` — 重定向到 /home

---

## 七、改动列表（按优先级）

### P0 — 必须做（阻塞 E2E 测试）

| # | 类别 | 改动 | 文件 |
|---|------|------|------|
| 1 | 后端 | onboarding-complete 合并激活+自动连接+自动启动 | `onboarding-complete/index.ts` |
| 2 | 后端 | 从简历推断搜索关键词，替代硬编码 | `pipeline.ts` |
| 3 | 前端 | 去掉 coverage_scope 选择 | `resume/page.tsx` |
| 4 | 前端 | 简化路由（/complete, /activation → /home） | `page.tsx` |
| 5 | 后端 | Worker 心跳机制 | `dispatch-loop.ts` |
| 6 | 脚本 | deploy.sh 增强（验证+tag） | `deploy.sh` |

### P1 — 重要（影响用户体验）

| # | 类别 | 改动 | 文件 |
|---|------|------|------|
| 7 | 前端 | 首页"解锁更多平台"引导横幅 | `home/page.tsx` |
| 8 | 前端 | 平台中心功能说明 | `platforms/page.tsx` |
| 9 | 后端 | Admin 面板"系统健康"模块 | `admin-stats/index.ts` |
| 10 | 后端 | Edge Function 错误写入 audit 事件 | `_shared/response.ts` |
| 11 | 前端 | alert() 全部改为 Toast | 多个文件 |

### P2 — 加固（生产级可靠性）

| # | 类别 | 改动 | 文件 |
|---|------|------|------|
| 12 | 前端 | Readiness 页降级为可选 | `readiness/page.tsx` |
| 13 | 后端 | 简历解析失败正确返回错误码 | `onboarding-resume/index.ts` |
| 14 | 后端 | 投递前验证 token + 连接状态 | `pipeline.ts` |
