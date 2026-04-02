# Haitou OS — UI PRD (Product Requirements Document)

Version: 1.0
Date: 2026-04-02
Target: Google Stitch / Design Team

---

## 1. Product Identity

**Product Name:** 海投助手 (Haitou OS)
**Tagline:** 现在开始，拥有你的 AI 求职运营团队。
**Core Concept:** The user gains a 7-person AI job operations team — not a tool, not a dashboard, but a visible team that works continuously.

**Design North Star:**
> Claude-style layout, spacing, and tonal restraint + Kimi Agent Swarm-style badge-card team expression.

---

## 2. Design System Foundation

### 2.1 Color Palette

| Token | Light Value | Usage |
|---|---|---|
| `--bg-primary` | `#FAFAF8` | Main background — warm off-white, slight cream |
| `--bg-secondary` | `#F5F3EF` | Card backgrounds, surface layers |
| `--bg-elevated` | `#FFFFFF` | Modals, popovers, floating panels |
| `--text-primary` | `#1A1A1A` | Headlines, primary text |
| `--text-secondary` | `#6B6B6B` | Supporting text, labels |
| `--text-tertiary` | `#9CA3AF` | Placeholders, disabled text |
| `--border-default` | `#E8E5E0` | Cards, dividers — warm gray |
| `--border-subtle` | `#F0EDE8` | Lighter borders, inner dividers |
| `--accent-blue` | `#2563EB` | Primary CTA, active state, links |
| `--accent-blue-hover` | `#1D4ED8` | Button hover |
| `--accent-green` | `#16A34A` | Success, healthy, connected |
| `--accent-amber` | `#D97706` | Warning, attention needed, degraded |
| `--accent-red` | `#DC2626` | Error, blocked, destructive |
| `--accent-purple` | `#7C3AED` | Plan/billing accent (Pro tier) |

**Overall feel:** Warm, muted, premium. Like unbleached paper and soft graphite. No neon, no gradients, no glass effects.

### 2.2 Typography

| Element | Font | Size | Weight | Notes |
|---|---|---|---|---|
| Hero headline | Inter / system sans | 48-64px | 700 | Oversized, editorial |
| Section headline | Inter / system sans | 28-36px | 600 | Spacious |
| Page title | Inter / system sans | 22-24px | 600 | — |
| Body text | Inter / system sans | 14-15px | 400 | Comfortable reading |
| Label / caption | Inter / system sans | 12-13px | 500 | Uppercase optional for labels |
| Agent role title (Chinese) | Noto Sans SC / system | 16-18px | 600 | Prominent on badge cards |
| Agent persona name (English) | Inter | 13-14px | 500 | Secondary on badge cards |

**Language:** Chinese-first (zh-CN). All primary copy in Chinese. Navigation and labels bilingual. Agent names use `English Name · 中文角色` format.

### 2.3 Spacing & Layout

- **Max content width:** 1200px (centered)
- **Grid:** 12-column, 24px gutter
- **Section spacing:** 80-120px between landing sections, 32-48px within app pages
- **Card padding:** 20-24px
- **Border radius:** 12px (cards), 8px (buttons), 6px (badges/chips)
- **Elevation:** No heavy shadows. Use `0 1px 3px rgba(0,0,0,0.04)` for subtle lift.

### 2.4 Iconography

- **Style:** Lucide icons (outlined, 1.5px stroke)
- **Size:** 16px inline, 20px in navigation, 24px in feature sections
- **Color:** Always `--text-secondary`, never colored except status indicators

---

## 3. Agent Avatar Design Specification

### 3.1 Style Direction

**Reference:** Kimi 2.5 Agent Swarm avatar style — minimal, illustrative, personality-driven.

**Art style:**
- Black and white ink illustration
- Clean line art, slight hand-drawn warmth
- No color fills (pure B&W with optional 1 accent shade per agent if needed)
- Slightly oversized heads on small bodies (approachable, not chibi)
- Each agent wears a distinct hat/headwear that signals their role
- Mix of male and female presentations
- Expression: focused, professional, slightly serious — not smiling or cartoonish

### 3.2 The 7 Agents

| # | Role Code | Chinese Title | English Name | Gender | Hat / Headwear | Visual Personality |
|---|---|---|---|---|---|---|
| 1 | `orchestrator` | 调度官 | Commander | Male | Military-style officer cap with a small star | Authoritative, composed, slightly stern. Standing upright. |
| 2 | `profile_intelligence` | 履历分析师 | Analyst | Female | Round-frame glasses + researcher headband | Studious, meticulous. Holding a magnifying glass or clipboard. |
| 3 | `materials_advisor` | 简历顾问 | Advisor | Female | Beret (French artist style) | Creative but precise. Pen tucked behind ear. |
| 4 | `opportunity_research` | 岗位研究员 | Scout | Male | Explorer/safari hat | Adventurous, always searching. Binoculars or map in hand. |
| 5 | `matching_review` | 匹配审核员 | Reviewer | Male | Judge's square-top cap (四方帽) | Impartial, analytical. Arms crossed or holding a scale. |
| 6 | `application_executor` | 投递专员 | Executor | Female | Postal worker cap / delivery cap | Efficient, action-oriented. Carrying a sealed envelope or folder. |
| 7 | `relationship_manager` | 招聘关系经理 | Liaison | Female | Elegant wide-brim hat (diplomatic style) | Warm but professional. One hand extended in greeting gesture. |

### 3.3 Badge Card Design

Each avatar appears inside a **hanging work badge** — the signature UI element of Haitou OS.

**Badge structure:**

```
┌─────────────────────────────┐
│  ○ ← lanyard hole           │  ← Thin line extends upward
│                             │     simulating a lanyard/clip
│     ┌─────────────┐        │
│     │  [AVATAR]   │        │
│     │  B&W ink    │        │
│     │  illustration│       │
│     └─────────────┘        │
│                             │
│   调度官                     │  ← Chinese role title (prominent)
│   Commander                 │  ← English persona name (secondary)
│                             │
│   ─────────────────         │  ← thin divider
│   团队调度与任务编排           │  ← One-line duty description
│   ● 运行中                   │  ← Status dot + label
│                             │
└─────────────────────────────┘
```

**Badge dimensions:** ~200px wide × ~280px tall (adjustable)
**Background:** `--bg-elevated` (#FFFFFF) with `--border-default` stroke
**Corner radius:** 12px
**Lanyard:** A thin gray line (#D1D5DB) extending from the top center of the card upward, ending at a small oval clip shape. This creates the "hanging from a lanyard" effect.

**Drop animation (activation page):** Cards descend from above the viewport one by one, slight swing motion as they "hang" into place. Staggered 200ms between each card. Total sequence ~1.4s.

### 3.4 Badge Status Indicators

| Status | Dot Color | Label |
|---|---|---|
| Working | `--accent-green` pulsing | 运行中 |
| Ready | `--accent-blue` solid | 待命中 |
| Paused | `--text-tertiary` solid | 已暂停 |
| Blocked | `--accent-amber` solid | 等待中 |
| Attention | `--accent-red` pulsing | 需要关注 |

### 3.5 Badge Flip (Back Side)

On hover or click, the card flips (Y-axis 3D rotation, 400ms, ease-out) to reveal:

```
┌─────────────────────────────┐
│                             │
│   当前任务                   │
│   ─────────────────         │
│   正在为 Stripe 后端工程师    │
│   岗位生成定制简历             │
│                             │
│   最近完成                   │
│   ─────────────────         │
│   • 3 份简历已定制            │
│   • 2 封求职信已生成          │
│   • 1 个岗位待审核            │
│                             │
│   职责范围                   │
│   简历定制 · 求职信 · 翻译    │
│                             │
└─────────────────────────────┘
```

---

## 4. Page Flow Architecture

### 4.1 Complete User Journey

```
Landing Page
  │
  ├── [登录] → Login (Google / GitHub OAuth)
  │
  ├── OAuth Callback → Smart Router:
  │     ├── No user record → Create user + draft → Onboarding
  │     ├── Onboarding incomplete → Resume/Questions/Complete
  │     ├── Team created, not activated → Activation
  │     ├── Team activated, not ready → Readiness
  │     └── Team ready/active → Team Home
  │
  ├── Onboarding Flow (3 steps):
  │     ├── Step 1: Resume Upload
  │     ├── Step 2: Job Search Preferences
  │     └── Step 3: Confirm & Create Team
  │
  ├── Team Activation Page
  │     └── 7 badges drop in → Confirm activation
  │
  ├── Readiness Check Page
  │     └── Platform connection checklist
  │
  └── Main Application (App Shell):
        ├── Team Home (default)
        ├── Opportunity Workspace
        ├── Handoff Center
        ├── Platform Coverage
        ├── Plan & Billing
        ├── Settings
        └── Review & Summary
```

---

## 5. Page Specifications

### 5.1 Landing Page

**Purpose:** Convert visitor → user. Communicate team ownership, not tool usage.

**Sections (top to bottom):**

**A. Top Navigation Bar**
- Left: 海投助手 logo/wordmark
- Right: 语言切换 (EN/中) + `登录` button
- Style: Transparent on hero, white after scroll. Height: 64px.

**B. Hero Section**
- **Layout:** Two-column. Left 55%, Right 45%.
- **Left column:**
  - Headline (48-64px, bold): `现在开始，拥有你的 AI 求职运营团队。`
  - Retyping animation: cursor blinks → text deletes → retypes to `从现在开始，一人即是一整个团队`
  - Subheadline (16px, `--text-secondary`): `7 位 AI 求职专员 · 覆盖中英双区 · 自动投递、跟进、直到面试`
  - CTA button: `开始组建团队` (accent-blue, large, 48px height)
  - Below CTA: `免费开始 · 无需绑卡` (12px tertiary text)
- **Right column:**
  - 7 badge cards in a staggered grid formation (3-4 visible, others partially hidden)
  - Subtle floating animation (slow Y translate, 3-4px, 4s duration)
  - Cards should look like they're "hanging in the air"

**C. Section: How It Works (Secondary CTA A)**
- Headline: `三步组建，立刻上岗`
- 3 numbered cards (horizontal on desktop, vertical on mobile):
  1. `上传简历` — Upload once, team understands your profile
  2. `选择方向` — Set targets, team calibrates
  3. `一键启动` — Team begins operating immediately
- Below cards: embedded demo video placeholder (16:9, rounded corners, play button overlay)

**D. Section: Statement + Platform Logo Wall**
- Large centered statement (36px): `把一个人的求职，升级为整支团队的运作`
- Below: Two rows of platform logos grouped by region
  - Row 1 label: `中文平台` — 智联招聘, 拉勾, Boss直聘, 猎聘
  - Row 2 label: `英文平台` — LinkedIn, Greenhouse, Lever, Indeed
- Logos in grayscale, 40px height, evenly spaced

**E. Section: What Your Team Does (Secondary CTA B)**
- Headline: `投递只是起点，团队替你推进每一步`
- 4 feature blocks (2×2 grid):
  1. `智能筛选` — 匹配审核员评估每个岗位的匹配度
  2. `定制投递` — 简历顾问为每个岗位量身定制简历和求职信 (英文区)
  3. `自动跟进` — 招聘关系经理处理雇主回复和后续沟通
  4. `人机协作` — 遇到薪资谈判、面试安排等关键节点，系统自动提醒你接管
- Below: embedded demo video placeholder

**F. Section: Pricing**
- 3 plan cards side by side:

| | Free | Pro | Plus |
|---|---|---|---|
| Price | ¥0/月 | ¥99/月 | ¥299/月 |
| Runtime | 2 小时/月 | 8 小时/月 | 24 小时/月 |
| English platforms | ✓ | ✓ | ✓ |
| Chinese platforms | — | ✓ | ✓ |
| Resume tailoring | ✓ (English only) | ✓ | ✓ |
| Priority support | — | — | ✓ |
| CTA | `免费开始` | `升级 Pro` | `升级 Plus` |

- Pro card highlighted (subtle border glow or `推荐` badge)
- Cards use `--bg-elevated`, slight shadow, 16px radius

**G. Section: FAQ**
- Accordion-style, 5-6 items:
  1. 海投助手会自动投递简历吗？
  2. 系统会不会代表我发出不当消息？
  3. 什么时候需要我亲自接管？
  4. 支持哪些平台和地区？
  5. 免费版和付费版有什么区别？
  6. 我的简历和账号数据安全吗？

**H. Footer**
- Logo + copyright
- Links: 隐私政策 · 服务条款 · 联系我们
- Minimal, single line

---

### 5.2 Login Page

**Layout:** Centered card on warm background.
- Card width: 400px, padding 32px
- Logo: 海投助手 (centered, above card)
- Subtitle: `登录以组建你的团队`
- Two OAuth buttons (full width, 48px height, icon + text):
  - `Continue with Google` (Google icon)
  - `Continue with GitHub` (GitHub icon)
- Bottom text: `登录即表示同意 服务条款 和 隐私政策` (12px, tertiary)
- No email/password fields in V1.

---

### 5.3 Onboarding Flow

**Layout:** Full-screen, centered content, progress indicator at top.

**Progress indicator:** 3 dots/steps, horizontally centered.
- Step 1: `上传简历` — filled when active
- Step 2: `求职偏好` — filled when active
- Step 3: `确认创建` — filled when active

**Step 1: Resume Upload**
- Headline: `上传你的简历`
- Subheadline: `支持 PDF、DOC、DOCX，最大 10MB`
- Drop zone: Dashed border rectangle, 200px height
  - Icon: Upload cloud
  - Text: `拖拽简历到这里，或 浏览文件`
  - States: idle → uploading (progress bar) → processing → done (green checkmark + filename)
- `下一步` button at bottom (disabled until upload completes)

**Step 2: Job Search Preferences**
- Headline: `告诉团队你的求职方向`
- Subheadline: `这些偏好帮助团队校准搜索和匹配`
- Questions rendered as cards/chips:

| Question | Input Type | Display |
|---|---|---|
| 目标岗位 | Text input + tag chips | `例如：后端工程师, 产品经理` |
| 目标城市 | Text input + tag chips | `例如：上海, Remote, 旧金山` |
| 工作模式 | 4 choice chips | `远程 · 现场 · 混合 · 灵活` |
| 覆盖范围 | 3 choice chips | `中文区 · 英文区 · 跨市场` |
| 策略模式 | 3 choice chips | `均衡 · 广撒网 · 精准` |
| 期望薪资 (optional) | Text input | `选填 — 例如：30-50k/月` |

- Choice chips: Rounded pill, `--border-default`, click to select (fills `--accent-blue`)
- `下一步` button (disabled until required fields filled)

**Step 3: Confirm & Create Team**
- Headline: `确认并组建团队`
- Summary card showing chosen preferences
- Team roster preview: 7 agent names listed vertically (no badges yet — badges appear on activation)
  ```
  调度官 · Commander
  履历分析师 · Analyst
  简历顾问 · Advisor
  岗位研究员 · Scout
  匹配审核员 · Reviewer
  投递专员 · Executor
  招聘关系经理 · Liaison
  ```
- `创建我的团队` CTA button (accent-blue, large)

---

### 5.4 Team Activation Page

**This is the emotional peak of the onboarding flow.**

**Layout:** Full-screen, dark-ish warm background (`#1A1A1A` or very dark warm gray), centered.

**Headline (white text, 36px):** `你的团队已组建完毕`

**Badge drop sequence:**
- 7 badge cards drop in from above the viewport, one by one
- Each card swings slightly as it "hangs" into place
- Stagger: 200ms between cards
- Cards arrange in a 4-3 grid (4 top row, 3 bottom row, centered)
- Cards on dark background should be white (`--bg-elevated`) with strong contrast
- Each card shows: avatar illustration + Chinese title + English name + status dot ("待命中")

**Below the formation:**
- Text: `7 位专员已就位，等待启动。`
- CTA button: `激活团队` (white text on accent-blue, large, 52px height)
- Below CTA: `激活后可前往就绪检查，连接目标平台` (12px, dim white text)

**Post-activation:** Redirect to Readiness page.

---

### 5.5 App Shell (Logged-In Layout)

**Structure:**
```
┌─────────────────────────────────────────────────┐
│ Top Bar (64px)                                  │
│ [Logo]  [Team Name]         [Runtime] [Avatar]  │
├──────────┬──────────────────────────────────────┤
│ Sidebar  │                                      │
│ (220px)  │  Main Content Area                   │
│          │                                      │
│ 团队首页  │                                      │
│ 机会工作台│                                      │
│ 接管中心  │                                      │
│ 平台覆盖  │                                      │
│          │                                      │
│ ──────── │                                      │
│ 套餐方案  │                                      │
│ 设置     │                                      │
│ 周报     │                                      │
└──────────┴──────────────────────────────────────┘
```

**Top bar:**
- Left: Logo + team name
- Center: Runtime status indicator (`● 运行中 · 剩余 1:23:45` or `⏸ 已暂停`)
- Right: Start/Pause toggle button + user avatar dropdown

**Sidebar:**
- Navigation items with icons (Lucide):
  - 🏠 团队首页 (Home)
  - 📋 机会工作台 (Opportunities)
  - 🔔 接管中心 (Handoffs) — with red badge count if pending
  - 🌐 平台覆盖 (Platforms)
  - Divider
  - 💳 套餐方案 (Plan & Billing)
  - ⚙️ 设置 (Settings)
  - 📊 周报 (Review)

- Active item: `--accent-blue` text + light blue background fill
- Collapsed mode on mobile: hamburger menu

---

### 5.6 Team Home Page

**The primary dashboard. User's daily view.**

**Section A: Team Roster Strip**
- Horizontal row of 7 small badge cards (compact: 80px wide × 100px tall)
- Each shows: mini avatar + Chinese title + status dot
- Click → detail popover or flip
- Scrollable on mobile

**Section B: Runtime Control Bar**
- Full-width bar below roster
- Left: `● 运行中` (green dot, status text)
- Center: `已运行 2h 14m · 剩余 5h 46m` (progress bar underneath)
- Right: `暂停团队` button (outline style)
- When paused: green `启动团队` button + pause reason

**Section C: Live Activity Feed**
- Scrollable feed, newest on top
- Each feed item:
  ```
  [Agent Avatar Mini] [Agent Name]  [Timestamp]
  [Summary text — one line]
  ```
- Examples:
  - `岗位研究员 · Scout   2 分钟前`
    `在 Greenhouse 发现 14 个匹配岗位`
  - `匹配审核员 · Reviewer   5 分钟前`
    `推荐投递：Stripe 高级后端工程师 (强匹配)`
  - `投递专员 · Executor   8 分钟前`
    `已向 Lever 投递：Notion 前端工程师`
- Feed background: `--bg-primary`, items separated by subtle borders

**Section D: High-Value Opportunities**
- Title: `重点机会` (with count badge)
- 3-5 opportunity cards in a list:
  ```
  [Company] [Job Title]
  [Platform Badge] [Stage Badge] [Priority Badge]
  [Last activity summary]
  ```
- Click → navigates to Opportunity Workspace detail

**Section E: Handoff Alert**
- Conditional — only shows when pending handoffs exist
- Alert bar: `--accent-amber` background
- Text: `2 个事项需要你接管` + `查看` link
- Click → navigates to Handoff Center

---

### 5.7 Opportunity Workspace Page

**Layout:** Full-width with optional side panel.

**Top bar:**
- Page title: `机会工作台`
- Filter bar: `阶段` dropdown + `平台` dropdown + `优先级` dropdown + search input
- View toggle: List view / Pipeline view (kanban-style columns by stage)

**List View:**
- Table-like rows:
  ```
  [Company]  [Job Title]  [Platform]  [Stage Badge]  [Priority]  [Last Activity]  [→]
  ```
- Rows clickable → opens side detail panel

**Pipeline View (optional for V1):**
- Kanban columns: 已发现 → 筛选中 → 已排序 → 已投递 → 已联系 → 跟进中 → 需接管
- Each column shows count + mini opportunity cards
- Drag not supported in V1 (read-only)

**Side Detail Panel (slides in from right, 480px width):**
- Opportunity header: company, title, location, platform badge, stage badge
- Tabs: `时间线` | `材料` | `投递记录` | `对话`
- Timeline tab: chronological feed of all agent actions on this opportunity
- Materials tab: list of generated resume variants, cover letters
- Submissions tab: list of SubmissionAttempt records with outcomes
- Conversation tab: message thread (if exists)

---

### 5.8 Handoff Center Page

**Layout:** List view with detail panel (same pattern as Opportunity Workspace).

**Top bar:**
- Page title: `接管中心`
- Filter: `状态` (待接管 / 处理中 / 等待回复 / 已完成) + `紧急程度` + `类型`
- Badge showing pending count

**List items:**
```
[Urgency Dot] [Handoff Type Badge]  [Company — Job Title]
[Reason text — one line]
[Created time]                      [接管] button
```

**Urgency coloring:**
- Critical: red dot
- High: amber dot
- Medium: blue dot
- Low: gray dot

**Handoff Type badges:**
- 私人联系方式 (Private Contact)
- 薪资确认 (Salary)
- 面试安排 (Interview)
- Offer 决策 (Offer)

**Detail panel:**
- Context summary (AI-generated, 3-5 sentences)
- Suggested next action
- Suggested reply draft (editable textarea)
- Attached materials list
- Action buttons: `开始处理` | `标记等待` | `已解决` | `关闭`

---

### 5.9 Platform Coverage Page

**Layout:** Grouped by region.

**Two sections:**

**A. English Platforms (full_tailored)**
- Section description: `英文区 · 简历定制 + 求职信 + 自动投递`

**B. Chinese Platforms (passthrough)**
- Section description: `中文区 · 原始简历直投 · 自动投递 + 对话管理`

**Each platform card:**
```
┌─────────────────────────────────────────────┐
│  [Platform Logo]  LinkedIn                  │
│  recruiter_network · Anti-bot: high         │
│                                             │
│  ● 已连接                        [断开连接]  │
│                                             │
│  Capabilities:                              │
│  [search ●] [detail ●] [apply ●] [chat ●]  │
│                                             │
│  Connected: 2026-04-01  Health: 2h ago      │
└─────────────────────────────────────────────┘
```

- Connected: green status, disconnect button
- Expired: amber status, `重新连接` button
- Unconnected: gray status, `连接` button (opens extension instructions)
- Plan-locked: purple lock icon, `升级解锁` link

**Capability dots:** green (healthy), amber (degraded), red (blocked), gray (unknown)

---

### 5.10 Readiness Check Page

**Layout:** Centered checklist, max-width 640px.

**Status banner:**
- Ready: green background — `团队已准备就绪`
- Not ready: amber background — `请完成以下事项`

**Checklist:**
```
[✓] 简历已上传并解析
[✓] 求职偏好已设置
[✓] 团队已激活
[✗] 至少连接一个平台  ← blocking
[△] 补充投递资料（手机、邮箱）  ← recommended
```

- Blocking items: red X, bold
- Completed: green checkmark
- Recommended: amber triangle, lighter text

**Platform connection shortcuts:** Below checklist, show top 3 recommended platforms with quick `连接` buttons.

**CTA:** `启动团队` button (disabled if blocking items exist)

---

### 5.11 Plan & Billing Page

**Layout:** Current plan card + available plans + usage.

**Current plan card:**
```
当前方案：Pro
本月剩余运行时间：5h 46m / 8h
━━━━━━━━━━━━━━━━━━━━━ 72%
下次刷新：2026-05-01
```

**Plan comparison:** Same 3-column layout as landing page pricing section.

**Usage history:** Simple table — date, session duration, balance change.

---

### 5.12 Settings Page

**Layout:** Stacked sections with save buttons.

**Sections:**
1. **个人信息** — Display name, avatar, email (read-only from OAuth)
2. **求职偏好** — Same fields as onboarding Step 2 (editable)
3. **投递资料** — Phone, city, country, work authorization, notice period, etc.
4. **通知设置** — Toggle: enable/disable notifications
5. **安全** — Platform connection list with disconnect buttons

---

### 5.13 Review & Summary Page (Weekly Report)

**Layout:** Summary cards + key metrics.

**Top section:**
- Date range selector: 7天 | 14天 | 30天
- Headline stat: `本周投递 23 份，获得 4 个正面回复`

**Metric cards (2×2):**
- 发现机会数
- 投递数
- 回复数
- 接管事项数

**Stage distribution chart:** Horizontal stacked bar showing opportunities across stages.

**Activity digest:** Top 5 most significant events this period.

---

## 6. Responsive Breakpoints

| Breakpoint | Width | Layout Changes |
|---|---|---|
| Desktop | ≥1024px | Full sidebar + content |
| Tablet | 768-1023px | Collapsed sidebar (icon only) |
| Mobile | <768px | Bottom tab navigation, full-width content, stacked cards |

**Mobile-specific:**
- Badge cards in horizontal scroll strip (not grid)
- Side panels become full-screen overlays
- Pipeline view hidden (list only)
- Hero section becomes single-column

---

## 7. Motion Specification

| Moment | Trigger | Duration | Easing | Description |
|---|---|---|---|---|
| Hero text retype | Page load (once) | 3s total | ease-in-out | Type → pause → delete → retype |
| Badge card drop | Activation page load | 1.4s total | spring(0.6) | 7 cards descend sequentially, slight swing |
| Badge card flip | Hover/click | 400ms | ease-out | Y-axis 3D rotation, front → back |
| Badge float | Landing hero (loop) | 4s | ease-in-out | Subtle Y translate ±3px |
| Feed item appear | New event | 300ms | ease-out | Fade in + slide down 8px |
| Side panel slide | Click opportunity | 300ms | ease-out | Slide in from right |
| Status dot pulse | Active/attention states | 2s loop | ease-in-out | Opacity 0.4 → 1.0 |

---

## 8. Deliverables Checklist

For Google Stitch / Design Team to produce:

- [ ] Landing page — full desktop + mobile
- [ ] Login page
- [ ] Onboarding: 3 step screens
- [ ] Team Activation page (dark background, badge drop)
- [ ] Readiness Check page
- [ ] App Shell (sidebar + top bar)
- [ ] Team Home page
- [ ] Opportunity Workspace (list view + side panel)
- [ ] Handoff Center (list + detail)
- [ ] Platform Coverage page
- [ ] Plan & Billing page
- [ ] Settings page
- [ ] Review/Summary page
- [ ] 7 agent avatar illustrations (B&W ink, per spec)
- [ ] Badge card component (front + back)
- [ ] Design tokens (colors, typography, spacing)

**Total: 13 page designs + 7 avatar illustrations + 1 component system**
