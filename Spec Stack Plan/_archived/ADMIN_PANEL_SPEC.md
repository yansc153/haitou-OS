# 管理员面板 Spec — 海投 OS Admin Dashboard

## 1. 目标

提供一个只读管理仪表盘，让管理员无需进入 Supabase SQL Editor 即可全局监控系统运行状态。
- 跨用户视角：看到所有用户/团队的数据
- 可视化优先：图表 > 数字 > 表格
- 零额外依赖：用 SVG/CSS 实现图表，不引入 chart 库

## 2. 权限模型

### V1: 环境变量白名单
- 环境变量 `ADMIN_EMAILS` 存储管理员邮箱列表（逗号分隔）
- Edge Function 通过 JWT 获取用户邮箱，与白名单比对
- 前端 middleware 做同样检查，非管理员访问 `/admin` 重定向到 `/home`
- 未来可迁移到 Supabase 自定义 claims / 角色表

### 鉴权流程
```
请求 → getAuthenticatedUser(req) → 获取 user.email
     → 检查 ADMIN_EMAILS 是否包含该邮箱
     → 不包含 → 403 FORBIDDEN
     → 包含 → getServiceClient() 查询全局数据（绕过 RLS）
```

## 3. 后端 API

### `GET /admin-stats`

使用 service role client 绕过 RLS，一次性返回全局数据。

#### Response Schema

```typescript
{
  // ── 概览 KPI ──
  overview: {
    total_users: number              // auth.users 总数
    users_today: number              // 今日新注册
    users_7d: number                 // 7天新注册
    total_teams: number              // team 总数
    teams_by_status: Record<string, number>  // {active: 5, paused: 3, ready: 2, ...}
    active_teams_now: number         // runtime_status = 'active'
  }

  // ── 平台连接 ──
  platforms: {
    connections_by_platform: Array<{
      platform_name: string          // LinkedIn, 智联, etc.
      total: number
      active: number
      expired: number
    }>
    today_actions_by_platform: Array<{
      platform_name: string
      applications: number
      messages: number
    }>
  }

  // ── 机会漏斗 ──
  funnel: {
    by_stage: Record<string, number>  // {discovered: 100, screened: 80, ...}
    today_discovered: number
    today_submitted: number
    submission_outcomes: {
      success: number
      blocked: number
      error: number
    }
  }

  // ── AI 引擎 ──
  engine: {
    tasks_queued: number
    tasks_running: number
    tasks_failed_24h: number
    tasks_completed_24h: number
    tasks_by_type: Record<string, number>   // {screening: 50, submission: 30, ...}
    total_tokens_used: number               // 全局 token 消耗
  }

  // ── 运营 ──
  operations: {
    total_runtime_hours: number             // 所有团队累计运行时长
    materials_generated: number             // 材料总生成数
    handoffs_pending: number                // 待处理 handoff
    handoffs_by_type: Record<string, number>
    resumes_uploaded: number                // 简历上传总数
  }

  // ── 最近活动 ──
  recent_events: Array<{
    id: string
    event_type: string
    summary_text: string
    team_name: string
    occurred_at: string
  }>

  // ── 用户列表 ──
  users: Array<{
    id: string
    email: string
    display_name: string
    created_at: string
    team_status: string
    runtime_status: string
    plan_tier: string
    opportunities_count: number
    submissions_count: number
  }>
}
```

## 4. 前端架构

### 路由
```
app/(admin)/
├── layout.tsx          # 管理员专用布局（独立 header + nav）
└── dashboard/
    └── page.tsx        # 主仪表盘（单页，5 大模块）
```

### Middleware 扩展
在 `middleware.ts` 中添加 `/admin` 路径保护：
- 已登录 + 邮箱在白名单 → 放行
- 已登录 + 非白名单 → 重定向 `/home`
- 未登录 → 重定向 `/login`

### 页面布局设计

```
┌─────────────────────────────────────────────────────────┐
│  海投 OS · 管理面板                    [返回用户端] [退出] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐     │
│  │总用户│ │今日  │ │运行中│ │今日  │ │待处理│ │Token │     │
│  │  42  │ │新增  │ │团队  │ │投递  │ │交接  │ │消耗  │     │
│  │      │ │ +3   │ │  5   │ │ 28   │ │  2   │ │ 15K  │     │
│  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘     │
│                                                         │
│  ┌──────────────────┐  ┌──────────────────┐            │
│  │  团队状态分布      │  │  机会漏斗         │            │
│  │  [环形图]          │  │  [漏斗条形图]      │            │
│  │  active: 5        │  │  discovered: 120  │            │
│  │  paused: 3        │  │  screened: 85     │            │
│  │  ready: 8         │  │  submitted: 42    │            │
│  │  draft: 12        │  │  closed: 15       │            │
│  └──────────────────┘  └──────────────────┘            │
│                                                         │
│  ┌──────────────────┐  ┌──────────────────┐            │
│  │  平台连接状况      │  │  AI 任务队列       │            │
│  │  LinkedIn   12/8  │  │  queued: 5        │            │
│  │  智联        8/6   │  │  running: 3       │            │
│  │  Greenhouse  5/5  │  │  failed(24h): 2   │            │
│  │  [横向堆叠柱状图]  │  │  completed: 156   │            │
│  │                    │  │  [按类型柱状图]     │            │
│  └──────────────────┘  └──────────────────┘            │
│                                                         │
│  ┌──────────────────────────────────────────┐          │
│  │  最近系统活动                              │          │
│  │  3分钟前  [张三团队] 岗位发现 — 发现 8 个岗位│          │
│  │  5分钟前  [李四团队] 投递专员 — LinkedIn投递 │          │
│  │  12分钟前 [张三团队] 匹配筛选 — 筛选 10 个  │          │
│  └──────────────────────────────────────────┘          │
│                                                         │
│  ┌──────────────────────────────────────────┐          │
│  │  用户列表                                  │          │
│  │  邮箱 | 团队状态 | 套餐 | 机会数 | 投递数   │          │
│  │  ─────────────────────────────────────    │          │
│  │  zhang@... | active | Pro | 45 | 12       │          │
│  │  li@...    | paused | Free | 23 | 8       │          │
│  └──────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────┘
```

## 5. 可视化组件

### 5.1 KPI 卡片
- 大数字 + 小标签
- 趋势指示（今日 vs 昨日，用箭头 ↑/↓）
- 使用 SpotlightCard 交互效果

### 5.2 环形图（DonutChart）
- 纯 SVG `<circle>` + `stroke-dasharray`
- 用于团队状态分布、Handoff 类型分布
- 中间显示总数

### 5.3 漏斗柱状图（FunnelBar）
- 水平条形图，宽度按比例
- 每行：标签 | 数字 | 条形
- 用于机会 stage 漏斗

### 5.4 堆叠柱状图（StackedBar）
- 每个平台一行：active（绿）+ expired（红）
- 用于平台连接健康度

### 5.5 活动流（ActivityStream）
- 时间线列表，最新在上
- 团队名 + 事件类型 + 摘要 + 相对时间
- 复用现有 feed 样式

## 6. 设计规范

- 完全复用 Digital Atelier 设计系统
- 色彩：surface-card, surface-low, sage green (secondary), gold (accent)
- 字体：Manrope 标题, Plus Jakarta Sans 正文, Inter 标签
- 卡片：surface-card + shadow-card + radius-xl
- 状态色：--status-active(绿), --status-warning(橙), --status-error(红), --status-info(蓝)
- 中文优先，技术术语英文

## 7. 实现步骤

1. **Edge Function `admin-stats`**：service role 查询，管理员邮箱白名单鉴权
2. **Middleware 扩展**：`/admin` 路径保护
3. **Layout**：`app/(admin)/layout.tsx` — 管理员专用 header
4. **SVG 图表组件**：DonutChart, FunnelBar, StackedBar
5. **Dashboard 页面**：`app/(admin)/dashboard/page.tsx` — 组装所有模块
6. **部署验证**
