# 海投 OS — V1 完整 E2E 验收清单

> 版本: v3.0 (2026-04-08)
> 前置条件: 全部已部署
> 前端: https://haitou-os.vercel.app
> Edge Functions: https://rlpipofmnqveughopxud.supabase.co/functions/v1
> Worker: haitou-os-worker.fly.dev
> 变量: `$API` = `https://rlpipofmnqveughopxud.supabase.co/functions/v1`
> 验证方式: **全部通过 MCP Playwright**，不查 DB
>
> ## 验收原则
> 按能力验证，不按用户旅程：
> 1. **能不能投？** — 英文平台投递 + 中文平台投递 + Boss 打招呼
> 2. **对话智能** — Boss 系统卡片 + 自然语言意图 + 交接创建
> 3. **前端展示** — 每个页面渲染正确 + 实时更新
>
> ## 本次修复内容 (23 项)
> - 4 个原始 Issue (#14 超时, #16 PDF, Boss 卡片, prompt 增强)
> - 9 个深度审计 Critical (C1-C8 + H1)
> - 7 个 Codex Review (CX1-CX7: dedupe, session-expiry, pagination, target_roles, etc.)
> - 3 个新功能 (simulate_boss_reply, reset_full, CI/CD)

---

## Phase 0: 数据全量清零

### 0.1 执行 reset_full

```bash
curl -X POST $API/admin-cleanup \
  -H "Content-Type: application/json" \
  -d '{"action":"reset_full"}'
```

**预期返回**:
```json
{"data":{"message":"Full reset complete. Auth + platform_definition preserved. Ready for onboarding."}}
```

**FAIL 判定**: 返回包含 error 或任何 FK violation

### 0.2 验证清零结果

```bash
curl -X POST $API/admin-cleanup \
  -H "Content-Type: application/json" \
  -d '{"action":"check_keywords"}'
```

**预期返回**: `baseline: null` (profile_baseline 已清空)

### 0.3 验证 auth 保留

- 打开 `haitou-os.vercel.app` → 应该跳转到 `/landing`（因为 team 已清空）
- 如果已有 cookie → 可能跳到 `/resume`（说明 auth 保留成功）

### 0.4 验证 platform_definition 保留

```bash
curl $API/admin-stats
```

**检查**: platforms 相关数字 = 7（Greenhouse, Lever, LinkedIn, Boss, 智联, 拉勾, 猎聘）

---

## Phase 1: Landing 页面 & OAuth 登录

### 1.1 访问根路径（未登录状态）

- **操作**: 清除浏览器 cookie → 访问 `haitou-os.vercel.app/`
- **预期**: 自动跳转到 `haitou-os.vercel.app/landing`
- **FAIL**: 停留在 `/`，白屏，或跳到其他页面

### 1.2 Landing 页面完整性

在 `/landing` 页面检查以下元素：

| 区域 | 预期内容 | FAIL 条件 |
|------|---------|-----------|
| 左上角 | "海投 OS" logo 文字 | 缺失或乱码 |
| 左侧 H1 | "求职新方式。" (BlurText 动画) | 文字未出现或动画卡死 |
| 左侧副标题 | 打字机效果循环两句话 | 静止不动 |
| 左侧 CTA | "开始组建团队 →" 按钮 | 按钮不可见 |
| 左侧 social proof | 5 个像素头像 + "200+ 团队已加入" | 头像为空白方块 |
| 右侧深色区域 | "别人已经有团队了，你还在一个人投简历？" | 右侧空白 |
| 右侧数据 | "7+" / "7" / "24/7" 三组大数字 | 数字未渲染 |
| 右上角 | "登录" 按钮 | 按钮不可见 |

### 1.3 点击登录

- **操作**: 点击右上角 "登录" 或左侧 CTA
- **预期**: 跳转到 `/login` 页面，显示 OAuth 按钮 (Google / GitHub)
- **FAIL**: 404, 白屏, 或 URL 未变化

### 1.4 OAuth 登录成功

- **操作**: 点击 Google 或 GitHub OAuth 登录
- **预期**: OAuth 完成后跳转到 `/resume`（因为 onboarding_draft 已清空/不存在）
- **FAIL**: 停留在 `/login`, 跳到错误页, 或跳到 `/home`（说明 reset 不完整）

### 1.5 验证重定向逻辑

- **操作**: 手动访问 `haitou-os.vercel.app/`（已登录状态）
- **预期**: 跳转到 `/resume`（无 onboarding）
- **FAIL**: 跳到 `/landing` 或 `/home`

---

## Phase 2: Onboarding 完整流程

### 2.1 简历上传页面渲染

- **URL**: `/resume`
- **检查**:

| 元素 | 预期 |
|------|------|
| 页面标题 | "配置你的求职运营团队" |
| 副标题 | "上传简历，设定目标，选择策略。团队将据此开始工作。" |
| 上传区域 | 大灰色虚线框，显示 "拖拽简历到这里" + "或点击浏览文件 · PDF, DOC, DOCX" |
| 目标城市 | 7 个城市按钮: 上海/北京/深圳/杭州/广州/新加坡/Remote |
| 工作模式 | 3 个选项: 现场办公/混合办公/完全远程 |
| 执行策略 | 3 个卡片: ⚡广撒网 / ⚖️均衡 / 🎯精准 |
| 右侧 sidebar | 岗位研究员头像 + "正在分析你的资料..." |
| 完成按钮 | "完成配置 →" (disabled 状态，因为未上传简历) |

### 2.2 上传简历

- **操作**: 点击上传区域 → 选择一份真实 PDF 简历
- **预期**:
  - 文件名显示，带绿色 ✓
  - 文字变为 "简历已就绪 · 点击更换"
  - 右侧 sidebar "简历状态" 变为 "✓ 已上传"
  - "完成配置 →" 按钮变为可点击状态
- **FAIL**: 文件选择后无反应，或按钮仍然 disabled

### 2.3 设置偏好

- **操作**:
  1. 点击 "上海" + "北京" 城市按钮 → 高亮
  2. 点击 "混合办公" → 高亮
  3. 点击 "⚖️均衡" 策略卡片 → 高亮 + ring 效果
- **预期**: 右侧 sidebar 实时更新:
  - 目标城市: "2 个城市"
  - 执行策略: "均衡"

### 2.4 提交 Onboarding

- **操作**: 点击 "完成配置 →"
- **预期**:
  1. 按钮文字变为 "正在配置..."
  2. **控制台** 依次输出:
     - `[onboarding] Step 1 resume: 200 {...}`
     - `[onboarding] Step 3 complete: 200 {...}`
  3. 页面自动跳转到 `/home`
- **FAIL**:
  - 按钮显示红色错误信息（记录具体错误文本）
  - 控制台 Step 1 返回非 200（简历解析失败 → 检查 PDF 是否为扫描版）
  - 控制台 Step 3 返回非 200（团队创建失败）
  - 超过 30 秒无响应

### 2.5 验证数据库状态

打开 Supabase Dashboard → Table Editor，逐表检查:

| 表 | 检查 | 预期 |
|----|------|------|
| `team` | 新记录 | status='active', user_id 匹配, strategy_mode='balanced' |
| `agent_instance` | 行数 | 恰好 7 行, role_code 各不相同 |
| `onboarding_draft` | status | status='completed', resume_upload_status='uploaded' |
| `resume_asset` | 新记录 | is_primary=true, parse_status='completed', storage_path 有值 |
| `profile_baseline` | 新记录 | full_name 非空, skills 数组有内容, search_keywords = null (待生成) |

**关键**: 如果 `profile_baseline.search_keywords` 为 null，pipeline 启动后会由调度官→履历分析师自动生成。

---

## Phase 3: 首页初始状态验证

### 3.1 页面结构

- **URL**: `/home`
- **逐区域检查**:

| 区域 | 预期内容 | FAIL 条件 |
|------|---------|-----------|
| Header 左侧 | "海投 OS" + 5 个导航: 团队主页/机会中心/交接中心/平台中心/活动回顾 | 导航缺失或中文乱码 |
| Header 右侧 | 灰色圆点 + "已暂停" + "启动团队" 按钮 | 显示 "运行中"（不应该） |
| 运行时间 | 0h 或 0 秒 | 有非零数字 |
| Agent 工牌区 | 7 张工牌卡片，每张有: 像素头像 + 中文职称 + 英文名 | 少于 7 张或头像为空 |
| 今日统计 | 发现=0, 筛选=0, 投递=0, AI调用=0 | 任何数字非 0 |
| 实时动态 | 空 或 仅 "团队已创建" | 有大量历史事件（说明 reset 不干净） |
| 高价值机会 | 空 | 有旧数据 |
| 交接摘要 | pending_count=0 | 有旧交接 |

### 3.2 Agent 工牌验证

逐个确认 7 个 agent 的中文名 + 角色:

| # | 中文名 | Persona | role_code |
|---|--------|---------|-----------|
| 1 | 岗位研究员 | Scout | opportunity_research |
| 2 | 匹配审核员 | Reviewer | matching_review |
| 3 | 简历顾问 | Advisor | materials_advisor |
| 4 | 调度官 | Commander | orchestrator |
| 5 | 履历分析师 | Analyst | profile_intelligence |
| 6 | 投递专员 | Executor | application_executor |
| 7 | 招聘关系经理 | Liaison | relationship_manager |

### 3.3 Header 导航测试

依次点击 5 个导航链接:

| 点击 | 预期 URL | 预期页面标题 |
|------|---------|-------------|
| 团队主页 | /home | （当前页面高亮） |
| 机会中心 | /opportunities | "机会工作台" |
| 交接中心 | /handoffs | "等待交接" |
| 平台中心 | /platforms | 7 个平台卡片 |
| 活动回顾 | /review | 7天/14天/30天 切换 |

每个页面: 无白屏, 无 404, 无控制台报错

---

## Phase 4: 添加运行时间 & 启动团队

### 4.1 添加 runtime

```bash
curl -X POST $API/admin-cleanup \
  -H "Content-Type: application/json" \
  -d '{"action":"add_runtime","hours":9999}'
```

**预期返回**: `"message":"Added 9999h, team force-activated"`

### 4.2 刷新首页

- **操作**: F5 刷新 `/home`
- **预期**:
  - Header: 绿色圆点 + "运行中"
  - 按钮文字变为 "暂停团队"
  - 实时动态出现 "团队已启动运行"
  - 运行时间显示 9999h (或 "99+ 天")

### 4.3 暂停/恢复测试

- **操作**: 点击 "暂停团队"
- **预期**: 圆点变灰, 文字 "已暂停", 按钮变 "启动团队", 动态出现 "系统暂停"
- **操作**: 再次点击 "启动团队"
- **预期**: 圆点变绿, 文字 "运行中", 按钮变 "暂停团队"

### 4.4 用户菜单测试

- **操作**: 点击右上角 "U" 头像
- **预期**: 下拉菜单显示 4 项: 设置 / 套餐方案 / 管理面板 / 退出登录
- **操作**: 点击菜单外区域
- **预期**: 菜单关闭
- **不要点 "退出登录"**

---

## Phase 5: 平台连接

### 5.1 平台中心页面

- **URL**: `/platforms`
- **检查**: 7 个平台卡片显示:

| 平台 | Logo | 类型 | 连接方式 |
|------|------|------|---------|
| Greenhouse | 绿色 logo | 英文 | 公开 API (无需连接) |
| Lever | 蓝色 logo | 英文 | 公开 API (无需连接) |
| LinkedIn | 蓝色 logo | 英文 | Chrome 插件 Cookie |
| Boss直聘 | 蓝色 logo | 中文 | Chrome 插件 Cookie |
| 智联招聘 | 蓝色 logo | 中文 | Chrome 插件 Cookie |
| 拉勾网 | 绿色 logo | 中文 | Chrome 插件 Cookie |
| 猎聘 | 橙色 logo | 中文 | Chrome 插件 Cookie |

### 5.2 安装 Chrome 插件

- **操作**: 打开 `chrome://extensions` → 开发者模式 → 加载已解压的扩展程序 → 选择 `extension/` 目录
- **预期**: 插件出现在扩展列表，图标显示在工具栏
- **检查**: `extension/manifest.json` 中 `externally_connectable.matches` 包含 `haitou-os.vercel.app`
- **FAIL**: 加载报错（检查 manifest.json 语法）

### 5.3 连接 LinkedIn (如有账号)

- **操作**: 在平台中心点击 LinkedIn 的 "连接" 按钮
- **预期顺序**:
  1. 新标签页打开 LinkedIn 登录页面
  2. 手动登录 LinkedIn
  3. 回到平台中心，状态变为 "已连接" + 绿色标识
  4. `platform_connection` 表新增一行: platform='linkedin', status='active'
- **FAIL**: 点击无反应（检查 extension ID 环境变量）, 登录后状态未更新

### 5.4 连接 Boss直聘 (如有账号)

- **操作**: 同上流程，但打开 Boss直聘登录页
- **预期**: 状态变为 "已连接"
- **注意**: Boss直聘 cookie 有效期较短 (约 24h)，需留意过期

### 5.5 验证连接状态

```bash
curl $API/platforms-list \
  -H "Authorization: Bearer $TOKEN"
```

**检查返回**:
- Greenhouse/Lever: 即使无 connection 也应标为可用
- LinkedIn/Boss: 如已连接 → status='active', session_token_ref 有值

---

## Phase 6: Pipeline — 发现阶段

> **等待时间**: 团队启动后 3-5 分钟
> **前提**: 团队状态 = active, Fly.io worker 在运行

### 6.1 观察实时动态 (不刷新)

- **操作**: 停留在 `/home` 页面，**不要刷新**
- **预期**: 在 1-5 分钟内，实时动态区域自动出现新事件:
  - "调度官 — 开始搜索关键词生成" 或类似
  - "履历分析师 — 生成搜索关键词"
  - "岗位研究员 — 发现了 N 个新岗位 (Greenhouse)"
  - "岗位研究员 — 发现了 N 个新岗位 (Lever)"
- **FAIL**: 5 分钟后仍无事件
  - 检查 1: Worker 是否在运行 (`fly logs -a haitou-worker`)
  - 检查 2: team.runtime_status 是否为 'active'
  - 检查 3: profile_baseline.search_keywords 是否已生成 (如为 null，关键词生成可能失败)

### 6.2 检查关键词生成

```bash
curl -X POST $API/admin-cleanup \
  -H "Content-Type: application/json" \
  -d '{"action":"check_keywords"}'
```

**预期**: `search_keywords` 非 null，包含 `en_keywords` + `zh_keywords` + `target_companies`
**FAIL**: search_keywords = null → 手动注入:

```bash
curl -X POST $API/admin-cleanup \
  -H "Content-Type: application/json" \
  -d '{"action":"inject_keywords"}'
```

### 6.3 机会中心检查

- **操作**: 点击 "机会中心" (或访问 `/opportunities`)
- **预期**:
  - 横向滚动卡片区出现岗位卡片
  - 每个卡片: 公司名 + 职位名 + 匹配度标签 + 时间
  - Pipeline 漏斗: "发现" 阶段数字 > 0
  - 下方 "岗位总览" 显示 "N 个机会"
- **FAIL**: "暂无机会 — 启动团队后专员会自动发现"
  - 等待更长时间 (最多 10 分钟)
  - 检查 worker 日志

### 6.4 首页统计更新

- **操作**: 回到 `/home`
- **预期**: "今日发现" 数字 > 0
- **FAIL**: 仍为 0 → 检查 pipeline 是否触发了 timeline_event

### 6.5 多平台来源验证

在 `/opportunities` 中滚动查看:

| 来源 | 预期 | 条件 |
|------|------|------|
| Greenhouse | 有岗位 | 始终（公开 API） |
| Lever | 有岗位 | 始终（公开 API） |
| LinkedIn | 有岗位 | 仅当已连接 |
| Boss直聘 | 有岗位 | 仅当已连接 |
| 智联/拉勾/猎聘 | 有岗位 | 仅当已连接 |

---

## Phase 7: Pipeline — 筛选 & 排序

> **等待时间**: discovery 后 2-5 分钟

### 7.1 实时动态观察

- **预期新事件**:
  - "匹配审核员 — 完成了 N 个岗位的匹配评估"
  - "调度官 — 将 N 个岗位标记为高优先"
- **FAIL**: 10 分钟后仍无筛选事件

### 7.2 漏斗阶段变化

- **操作**: 在 `/opportunities` 查看 pipeline 漏斗条
- **预期**:
  - "筛选" 阶段数字 > 0
  - "排序" 阶段数字 > 0 (部分岗位 advance)
  - 漏斗条的进度指示器高亮到对应阶段

### 7.3 匹配度标签验证

- **操作**: 查看任意岗位卡片
- **预期**: 出现匹配度标签，值为以下之一:
  - 🟢 "强匹配" (strong_fit)
  - 🟡 "中等" (moderate_fit)
  - ⚪ "弱" (weak_fit)
  - 🔴 "不匹配" (misaligned)
- **FAIL**: 标签为英文 (说明翻译映射缺失)

### 7.4 点击已筛选岗位查看详情

- **操作**: 点击一个有匹配度标签的岗位
- **预期**: 详情区域出现:
  - 公司名 + 职位名 (大标题)
  - 匹配度 badge
  - AI 建议: "推荐投递" / "持续观望" / "不匹配"
  - reason tags (中文)
- **FAIL**: reason tags 显示为英文长文本 → 检查 `translateReasonTag` 映射

### 7.5 首页统计

- **预期**: "今日筛选" > 0, "AI 调用" > 0

---

## Phase 8: Pipeline — 材料生成 (EN 平台)

> **等待时间**: 排序后 3-5 分钟
> **仅限**: Greenhouse / Lever / LinkedIn 的 advance (推荐投递) 岗位

### 8.1 材料生成触发

- **实时动态预期事件**:
  - "简历顾问 — 为 [公司名] 定制简历"
  - "简历顾问 — 为 [公司名] 生成求职信"
- **FAIL**: 有 advance 岗位但无材料事件 → 检查 pipeline material generation 逻辑

### 8.2 机会详情 — 材料出现

- **操作**: 在 `/opportunities` 点击一个已生成材料的岗位 (卡片上有 "已精修" badge)
- **预期**:
  - 右侧 "AI 定制版本" 区域出现 tailored sections
  - 每个 section 有标题 (如 "Professional Summary", "Work Experience")
  - section 内容为修改后的文本
  - 可以展开查看 "修改内容" (changes_made 列表)
- **FAIL**: 右侧为空或显示 "暂无简历对比数据"

### 8.3 中文平台不生成材料

- **操作**: 检查 Boss/智联/拉勾/猎聘 的岗位详情
- **预期**: 无 tailored resume — 显示为空 (passthrough 模式，设计意图)
- **FAIL**: 中文平台岗位出现了 AI 定制简历 (不应该)

---

## Phase 9: Pipeline — 投递 (重点验证 #14 修复)

> **等待时间**: 材料生成后 1-3 分钟

### 9.1 投递不超时 (Issue #14 验证)

- **实时动态预期事件**:
  - "投递专员 — 向 [公司名] 提交了申请" (success)
  - 或 "投递专员 — 投递 [公司名] 失败: [原因]" (soft_failure)
- **关键**: 事件应在 30 秒内出现，**而不是 30 秒超时后**
- **FAIL**: 
  - 事件包含 "timeout" 或 "net::" → #14 修复未生效（检查是否部署了最新代码）
  - 所有投递都 soft_failure → 检查 form 填充逻辑

### 9.2 投递结果

- **操作**: 在 Supabase Dashboard → `submission_attempt` 表
- **预期**:
  - 至少 1 行 `execution_outcome = 'success'` 或 `'soft_failure'`
  - **不应该全部是** `failure_reason_code = 'timeout'`
- **FAIL**: 全部 timeout → 未部署 domcontentloaded 修复

### 9.3 漏斗 "投递" 阶段

- **操作**: `/opportunities` 漏斗条
- **预期**: "投递" 阶段数字 > 0
- **FAIL**: 仍为 0

### 9.4 首页统计

- **预期**: "今日投递" > 0

---

## Phase 10: 机会详情页 (重点验证 #16 修复)

### 10.1 选择有材料的岗位

- **操作**: `/opportunities` → 点击一个有 "已精修" badge 的 Greenhouse/Lever 岗位
- **预期**: 详情加载完成 (无 "加载详情..." 卡住)

### 10.2 原始 PDF 显示 (Issue #16 验证)

- **检查左侧区域**:
  - 标签: "📄 原始简历"
  - **iframe 内渲染原始 PDF**: 能看到原始简历的字体、布局、样式
  - PDF 可滚动查看
- **FAIL**:
  - 显示 "原始简历 PDF / 上传简历后将在此处显示" → signed URL 失败
  - iframe 空白但无 fallback 文字 → PDF URL 加载失败（检查 CORS/Content-Type）
  - PDF 只显示第一页 → 正常（iframe 限制）

### 10.3 AI 定制版本

- **检查右侧区域**:
  - 标签: "✨ AI 定制版本"
  - tailored sections 按条显示
  - 每个 section: 标题 + 正文
  - 可切换 Diff / Clean 模式
- **FAIL**: 右侧空白

### 10.4 导出功能

- **操作**: 点击 "导出 PDF"
- **预期**: 浏览器下载一个 PDF 文件, 文件名格式: `{公司名}_{职位}_{简历}.pdf`
- **打开下载的 PDF**: 中文正常渲染（使用 Noto Sans SC 字体）
- **FAIL**: 按钮无反应, 或 PDF 中文显示为方块

- **操作**: 点击 "复制全文"
- **预期**: 按钮文字短暂变为 "已复制", 粘贴到任意编辑器验证内容

### 10.5 时间线 (因果链验证)

- **检查时间线区域**: 事件按时间倒序排列
- **预期完整因果链**:

```
🔍 岗位研究员 — 发现岗位
🎯 匹配审核员 — 完成匹配评估
📊 调度官 — 标记为高优先
✨ 简历顾问 — 定制简历
🚀 投递专员 — 提交申请
```

- **FAIL**: 事件缺失 (因果链断裂), 事件顺序错乱, actor 显示为英文

### 10.6 AI 评估摘要

- **位置**: 详情区域顶部
- **预期**:
  - 匹配度 badge (中文: 强匹配/中等/弱/不匹配)
  - AI 建议 badge (推荐投递/持续观望/不匹配)
  - Reason tags: 全部中文
- **FAIL**: 英文 reason tags 出现 (如 "relevant_experience" 而非 "相关行业经验")

---

## Phase 11: 交接中心 — Boss Loop 2 模拟验证

> **原理**: Boss直聘 Loop 2 需要真人 HR 回复，E2E 无法控制外部 HR。
> 
> **解决方案**: `simulate_boss_reply` 在 DB 层注入一条 HR 消息 (模拟 pollBossMessages 的抓取结果)，
> 然后运行 **真实的检测链**: Qwen LLM reply-reading → regex boundary scan → handoff 创建。
> 不是假数据塞表，是真实的双重检测逻辑在跑。
>
> **覆盖链路**: 消息注入 → LLM 分析 → regex 匹配 → handoff 表写入 → opportunity 状态机转换 → timeline 事件 → 前端渲染
> **唯一跳过**: Playwright 抓取 Boss 聊天页 (需要真实 cookie)

### 11.1 场景一：面试邀约 (interview_time, urgency=critical)

**前提**: Phase 6-7 已完成，至少有 1 个 opportunity 存在

```bash
curl -X POST $API/admin-cleanup \
  -H "Content-Type: application/json" \
  -d '{"action":"simulate_boss_reply","scenario":"interview"}'
```

**注入的 HR 消息**: "你好，看了你的简历，我们团队很感兴趣。方便这周四下午2点来公司面试吗？地址是xxx科技园B座15楼。"

**预期返回** (检查每一层):

```json
{
  "data": {
    "message": "Boss reply simulated → handoff created via REAL detection chain",
    "scenario": "interview",
    "detection": {
      "llm_recommended": true,           // ← Qwen 判定需要交接
      "llm_analysis": {
        "reply_posture": "positive",
        "contains_interview_scheduling": true,
        "handoff_recommended": true,
        "handoff_reason": "...(中文)..."
      },
      "regex_triggered": true,            // ← regex 命中 /面试/ 模式
      "regex_type": "interview_time",
      "final_type": "interview_time",     // ← regex 优先 (更精确)
      "final_urgency": "critical"
    },
    "handoff_id": "uuid",
    "chain": [
      "✅ 消息注入 (模拟 pollBossMessages 抓取)",
      "✅ LLM reply-reading (真实 Qwen 调用)",
      "✅ Regex boundary scan (6 组双语模式)",
      "✅ Handoff 创建 (真实状态机转换)",
      "✅ Timeline 事件 (greeting → reply → handoff)",
      "✅ Opportunity stage: contact_started → needs_takeover"
    ]
  }
}
```

**验证要点**:

| 检查项 | 预期 | FAIL 含义 |
|--------|------|-----------|
| `llm_recommended` = true | Qwen 正确识别面试信号 | reply-reading prompt 或模型出错 |
| `regex_triggered` = true | /面试/ 命中 | regex 模式缺失 |
| `final_type` = "interview_time" | 双重检测一致 | 类型推断逻辑错误 |
| `final_urgency` = "critical" | 面试 = 最高优先 | urgency 映射错误 |
| `handoff_id` 有值 | DB 写入成功 | FK 或 enum 约束失败 |

**FAIL**: 
- 返回 "NO handoff detected" → LLM 和 regex 都没触发，检查 Qwen API key + prompt
- `NO_OPP` → 等 pipeline 发现岗位后再试
- `llm_error` → DASHSCOPE_API_KEY 未配置

### 11.2 场景二：微信联系方式 (private_contact, urgency=high)

```bash
curl -X POST $API/admin-cleanup \
  -H "Content-Type: application/json" \
  -d '{"action":"simulate_boss_reply","scenario":"wechat"}'
```

**注入的 HR 消息**: "你好，简历收到了，我觉得蛮匹配的。方便加个微信详聊吗？我的微信号是 hr_zhang_2026"

**检查返回**:
- `regex_type` = "private_contact" (命中 /微信/ + /加/)
- `llm_analysis.contains_private_channel_request` = true
- `llm_analysis.private_channel_type` = "wechat"
- `final_urgency` = "high"

### 11.3 场景三：薪资讨论 (salary_confirmation, urgency=high)

```bash
curl -X POST $API/admin-cleanup \
  -H "Content-Type: application/json" \
  -d '{"action":"simulate_boss_reply","scenario":"salary"}'
```

**注入的 HR 消息**: "你好，我们对你的背景很认可。想先了解一下你的期望薪资是多少？方便的话说一下目前的薪资结构。"

**检查返回**:
- `regex_type` = "salary_confirmation" (命中 /薪资/ + /期望薪/)
- `llm_analysis.contains_salary_discussion` = true
- `final_urgency` = "high"

### 11.4 场景四：Offer 通知 (offer_decision, urgency=critical)

```bash
curl -X POST $API/admin-cleanup \
  -H "Content-Type: application/json" \
  -d '{"action":"simulate_boss_reply","scenario":"offer"}'
```

**检查返回**:
- `regex_type` = "offer_decision" (命中 /offer/ + /录用/)
- `final_urgency` = "critical"

### 11.5 交接中心 UI 验证

> 以下基于 11.1 (面试邀约) 的结果。其他场景 UI 结构相同，类型和紧急度不同。

- **操作**: 点击导航 "交接中心" (或访问 `/handoffs`)
- **预期**:
  - 页面标题: "等待交接"
  - 副标题: "N 个事项需要人工介入"
  - 左侧列表出现交接卡片

**卡片内容检查**:

| 元素 | 面试场景预期 | FAIL 条件 |
|------|-------------|-----------|
| 紧急度 | 红色圆点 + "紧急" (critical) | 显示 "待审" 或缺失 |
| 标题 | 岗位职位名 | 空或 "undefined" |
| 原因 | AI 生成的中文原因 (非硬编码) | 英文或 "[E2E 测试]" 前缀 |
| 公司名 | 对应 opportunity 的公司 | 空 |
| 时间 | "刚刚" | 时间格式异常 |

### 11.6 交接详情面板

- **操作**: 点击卡片
- **检查右侧**:

| 区域 | 预期 | FAIL 条件 |
|------|------|-----------|
| 顶部 badge | "需人工干预" (橙色) | 缺失 |
| 大标题 | 岗位职位名 | 空 |
| 类型 | "面试安排" | 显示 enum 值而非中文 |
| 交接原因 | Qwen 生成的分析 (自然语言，非模板) | 硬编码文本 |
| 上下文 | Qwen 的 summary_text (自然语言) | 空 |
| 紧急度 | "紧急" (红色) | 颜色错误 |
| 状态 | "等待接管" | 其他状态 |
| 底部 | "稍后处理" + "接管此事项" 按钮 | 按钮缺失 |

### 11.7 接管操作

- **操作**: 点击 "接管此事项"
- **预期**:
  - 卡片从列表移除
  - 如果是最后一个 → 空状态: "一切顺利 / 当前没有需要你处理的交接事项，AI 专员正在自主运行"
- **FAIL**: 报错 "接管失败"
- **DB 验证**: `handoff.state` = 'in_user_handling', `takeover_started_at` 有值

### 11.8 实时动态验证

- **操作**: 回到 `/home`
- **预期**: 实时动态包含完整的 Boss Loop 2 事件链:
  1. "招聘关系经理向 xxx 发送了打招呼消息" (boss_greeting_sent)
  2. "xxx 的 HR 回复了消息" (boss_reply_received)
  3. "需要接管: xxx — 面试邀约" (handoff_created)
- **FAIL**: 事件缺失或顺序不对

### 11.9 首页交接摘要联动

- **操作**: 运行另一个场景 (如 wechat) 生成第二个 handoff → 刷新 `/home`
- **预期**: 交接摘要区域显示 "N 个待处理交接"
- **操作**: 点击交接摘要 → 跳转到 `/handoffs`

---

## Phase 12: 活动回顾

### 12.1 回顾页面

- **URL**: `/review`
- **预期**:
  - 标题区域 + 时间窗口切换 (7天 / 14天 / 30天)
  - 摘要文本 (AI 生成的回顾)
  - 关键成果 (key_outcomes): 发现/筛选/投递数量
  - 阶段分布: 各 stage 数量
  - 建议 (suggestions): AI 生成的下一步建议

### 12.2 时间窗口切换

- **操作**: 依次点击 7天 → 14天 → 30天
- **预期**: 每次切换数据重新加载，数字可能不同
- **FAIL**: 切换后白屏或报错

---

## Phase 13: 实时性验证

### 13.1 首页实时动态 (不刷新)

- **操作**: 停留在 `/home`，等待 pipeline 执行新操作
- **预期**: 新事件自动出现在动态列表顶部，无需手动刷新
- **检查**: 事件包含正确的 agent 中文名 + 操作描述
- **FAIL**: 事件不自动出现 → 检查 Supabase Realtime 订阅

### 13.2 Header 状态实时同步

- **操作**: 在 Supabase Dashboard 手动修改 team.runtime_status
- **预期**: 前端 header 状态圆点在几秒内自动变化
- **FAIL**: 需要手动刷新 → Realtime 订阅未工作

---

## Phase 14: Bug 修复验证 (深度审计 + Codex)

> 验证本次 session 修复的 23 个 bug 是否真的修好了

### 14.1 [CX5] Onboarding 不需要 target_roles

- **操作**: Phase 2 中完成 onboarding（只填城市+模式+策略，不填 target_roles）
- **预期**: 能成功创建团队，跳转到 `/home`
- **FAIL**: 卡在 "All required questions must be answered" → target_roles 还在 required 里

### 14.2 [CX6] 空 token 连接被拒

- **操作**: 用 MCP 或 curl 调用 platform-connect，platform_code=linkedin，不传 session_token
- **预期**: 返回 400 "需要登录凭据才能连接"
- **FAIL**: 返回 200 且创建了 active 连线

### 14.3 [C7] Settings 工作模式保存

- **操作**: `/settings` → 切换工作模式 → 点保存 → 刷新页面
- **预期**: 工作模式保持修改后的值
- **FAIL**: 刷新后恢复原值

### 14.4 [C8] Review 重试按钮

- **操作**: `/review` → 如果加载失败 → 点击"重新加载"
- **预期**: 页面重新加载数据
- **FAIL**: 点了没反应

### 14.5 [CX2] Greenhouse/Lever 不被 session-expiry 误杀

- **操作**: 检查 Greenhouse 平台状态
- **预期**: 状态始终为"可用"，不会变成 session_expired
- **FAIL**: 显示"登录凭据已超过有效期"

### 14.6 [C2] Handoff waiting_external 操作

- **操作**: 在交接中心，如果有交接 → 验证状态流转支持 awaiting_takeover → waiting_external
- **预期**: 操作不报 409
- **FAIL**: 报 "Illegal handoff transition"

---

## Phase 15: 边界场景

### 14.1 退出登录 & 重新登录

- **操作**: 用户菜单 → "退出登录"
- **预期**: 跳转到 `/login`
- **操作**: 重新 OAuth 登录
- **预期**: 跳转到 `/home` (已有 team，跳过 onboarding)
- **FAIL**: 跳到 `/resume` (onboarding 状态丢失)

### 14.2 直接 URL 访问保护

| URL | 未登录预期 | 已登录预期 |
|-----|----------|-----------|
| `/home` | → `/login` | 正常显示 |
| `/opportunities` | → `/login` | 正常显示 |
| `/landing` | 正常显示 | 正常显示 (公开页面) |
| `/settings` | → `/login` | 正常显示 |

### 14.3 空状态处理

| 页面 | 空状态文案 |
|------|-----------|
| `/opportunities` (无数据) | "还没有机会 / 启动团队后，岗位研究员会自动扫描平台并发现匹配机会" |
| `/handoffs` (无交接) | "一切顺利 / 当前没有需要你处理的交接事项，AI 专员正在自主运行" |

---

## 验收汇总表

| Phase | 名称 | 检查项数 | 通过 | 失败 | 备注 |
|-------|------|---------|------|------|------|
| 0 | 数据清零 | 4 | | | |
| 1 | Landing & 登录 | 5 | | | |
| 2 | Onboarding (含 CX5 验证) | 9 | | | |
| 3 | 首页初始状态 | 10 | | | |
| 4 | 启动团队 | 4 | | | |
| 5 | 平台连接 | 5 | | | |
| 6 | Pipeline 发现 | 5 | | | |
| 7 | Pipeline 筛选排序 | 5 | | | |
| 8 | 材料生成 | 3 | | | |
| 9 | 投递 (#14) | 4 | | | |
| 10 | 机会详情 (#16) | 6 | | | |
| 11 | 交接中心 (4场景×真实检测) | 9 | | | |
| 12 | 活动回顾 | 2 | | | |
| 13 | 实时性 | 2 | | | |
| 14 | 边界场景 | 3 | | | |
| 14 | Bug 修复验证 (审计+Codex) | 6 | | | |
| 15 | 边界场景 | 3 | | | |
| **合计** | | **85** | | | |

---

## 依赖链 & 阻塞关系

```
Phase 0 ──→ Phase 1 ──→ Phase 2 ──→ Phase 3
                                        │
                                        ▼
                                    Phase 4 ──→ Phase 5
                                                  │
                                                  ▼
                                    Phase 6 ──→ Phase 7 ──→ Phase 8 ──→ Phase 9
                                        │                                  │
                                        ▼                                  ▼
                                    Phase 11                           Phase 10
                                    (simulate_boss_reply            (需要 materials)
                                     需要 opp, 跑真实检测)
                                    
Phase 12, 13, 14: 可在 Phase 7+ 后任意时间执行
```

## 已知限制 (不影响验收通过)

| 限制 | 说明 | 计划 |
|------|------|------|
| 简历格式破坏 | AI 输出纯文本，非原始 PDF 格式 | V2: pdf-lib 原地编辑 |
| Boss Loop 2 Playwright 抓取 | pollBossMessages 需要真实 Boss cookie | simulate_boss_reply 在 DB 层注入消息，跑真实 LLM+regex 检测 |
| 中文平台连接 | 需要真实账号 + Cookie 注入 | 手动测试 |
| Landing 路由冲突 | 未复现，路由隔离正确 | 如复现提供截图 |
