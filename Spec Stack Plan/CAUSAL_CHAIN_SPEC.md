# 海投 OS — 因果链完整规格书

> 版本: v2.0
> 日期: 2026-04-09
> 状态: 待 Codex 审阅 → 待用户审阅

---

## 一、总览

用户点击"启动团队"后，系统进入自动运行模式。**调度官**是唯一的决策者，它每 30 秒醒来一次，评估团队状态，决定下一步该唤醒哪个 Agent 做什么事。所有 Agent 之间不直接通信——一切经过调度官调度。

```
调度官 (30s 心跳)
  ├→ 唤醒 履历分析师 → 完成 → 报告给调度官
  ├→ 唤醒 岗位研究员 → 完成 → 报告给调度官
  ├→ 唤醒 匹配审核员 → 完成 → 报告给调度官
  ├→ 唤醒 简历顾问 → 完成 → 报告给调度官
  ├→ 唤醒 投递专员 → 完成 → 报告给调度官
  └→ 唤醒 招聘关系经理 → 完成 → 报告给调度官
```

每次心跳只创建**一个**最高优先级的任务。

---

## 二、简历解析 — MarkItDown

### 问题

当前的 PDF/DOCX 文本提取经常失败（图片型 PDF、加密字体、复杂排版），导致整条链空转。

### 解决方案

使用 [Microsoft MarkItDown](https://github.com/microsoft/markitdown)（Python CLI）在 Worker 容器中预处理简历。

**工作方式**:
```
用户上传简历 (PDF/DOCX) → 存入 Supabase Storage
Worker Gate 1 触发时:
  → 下载文件到临时目录
  → 调用 markitdown: markitdown resume.pdf -o resume.md
  → 读取 resume.md 作为简历原文
  → 发给 LLM 分析
```

**Dockerfile 改动**:
```dockerfile
# 在 Stage 2 (Production) 中加:
RUN apt-get update && apt-get install -y python3 python3-pip \
    && pip3 install 'markitdown[pdf,docx]' \
    && rm -rf /var/lib/apt/lists/*
```

**优势**:
- PDF（含图片型）→ 结构化 Markdown
- DOCX → 保留表格、列表、标题层级
- 输出专为 LLM 消费设计
- MIT 开源，微软维护

**降级策略**:
- markitdown 失败 → 回退到现有的 extractResumeText（纯文本提取）
- 两者都失败 → 任务标 failed → 通知用户"请上传文本型 PDF 或 DOCX"

---

## 三、调度官决策树（8 个 Gate）

调度官每次醒来执行以下决策树，**从上到下，命中第一个就停**：

### Gate 1: 简历分析

```
条件: profile_baseline.ability_model 不存在
      或 ability_model.core_skills 为空数组
      
动作: 唤醒 履历分析师 → 任务 analyze_resume

事件: "📢 调度官 @履历分析师: 检测到新简历，请分析能力模型"
```

### Gate 2: 关键词生成

```
条件: profile_baseline.search_keywords 不存在
      或 search_keywords.job_directions 为空数组

动作: 唤醒 岗位研究员 → 任务 generate_keywords
      传入: ability_model + strategy_mode

事件: "📢 调度官 @岗位研究员: 能力模型就绪，请根据{策略}生成搜索关键词"
```

### Gate 3: 岗位发现

```
条件: 有关键词 且 上次 discovery 超过阈值
      阈值由策略决定:
        广撒网: 3 分钟
        均衡: 5 分钟
        精准: 10 分钟

动作: 唤醒 岗位研究员 → 任务 opportunity_discovery

事件: "📢 调度官 @岗位研究员: 开始搜索 {N} 个平台"
```

### Gate 4: 岗位筛选

```
条件: 有 stage=discovered 的 opportunity

动作: 唤醒 匹配审核员 → 任务 screening

事件: "📢 调度官 @匹配审核员: {N} 个新岗位待评估"
```

### Gate 5: 简历定制（仅 full_tailored 管道）

```
条件: 有 recommendation=advance
      且 pipeline_mode=full_tailored
      且无 material 的 opportunity

动作: 唤醒 简历顾问 → 任务 material_generation

事件: "📢 调度官 @简历顾问: {公司名}的{岗位}需要定制简历"
```

### Gate 6: 投递

```
条件:
  full_tailored: 有 stage=material_ready 的 opportunity
  passthrough: 有 recommendation=advance 且 stage=prioritized 的 opportunity

动作: 唤醒 投递专员 → 任务 submission

事件: "📢 调度官 @投递专员: {公司名}可投递"
```

### Gate 7: Boss 打招呼

```
条件: 有 recommendation=advance
      且 platform=boss_zhipin
      且 stage=prioritized 的 opportunity

动作: 唤醒 投递专员 → 任务 first_contact

事件: "📢 调度官 @投递专员: Boss直聘 {公司名}，请发送打招呼消息"
```

### Gate 8: 对话跟进

```
条件: 有 stage=contact_started 的 Boss 对话

动作: 唤醒 招聘关系经理 → 任务 reply_processing 或 follow_up (3天无回复)

事件: "📢 调度官 @招聘关系经理: Boss对话需要跟进"
```

### 所有 Gate 都不命中 → IDLE，等下一次心跳

---

## 四、Agent 任务详细规格

### 4.1 履历分析师 — analyze_resume

**输入来源**: 从 resume_asset.storage_path 下载文件 → markitdown 转 Markdown → 作为简历原文

**处理流程**:
```
1. 从 Supabase Storage 下载简历文件到 /tmp/
2. 执行: markitdown /tmp/resume.pdf -o /tmp/resume.md
3. 读取 /tmp/resume.md 作为 resume_markdown
4. 如果 markitdown 失败 → 回退到 extractResumeText()
5. 将 resume_markdown 发给 LLM (analyze-resume skill)
```

**LLM 输入**:
```json
{
  "resume_markdown": "# Pepper Yan\n## Senior Software Engineer\n\n### Experience\n- TechCorp (2022-Present)...",
  "user_name": "Pepper Yan",
  "user_email": "pepper@example.com"
}
```

**LLM 输出**:
```json
{
  "ability_model": {
    "core_skills": ["React", "Node.js", "Solidity", "Python", "AWS"],
    "domain_expertise": ["web3", "fintech", "distributed systems"],
    "experience_highlights": [
      "Led 5-person engineering team at TechCorp",
      "Built real-time pipeline processing 10M events/day",
      "Designed DeFi protocol with $50M TVL"
    ],
    "capability_boundary": {
      "strong": ["blockchain development", "backend systems", "API design"],
      "moderate": ["frontend React", "DevOps"],
      "weak": ["mobile development", "ML/AI"]
    },
    "seniority_assessment": "senior",
    "career_trajectory": "全栈工程师 → 区块链技术负责人"
  }
}
```

**写入**:
- `profile_baseline.ability_model` = 完整 ability_model
- `profile_baseline.skills` = core_skills
- `profile_baseline.primary_domain` = domain_expertise[0]
- `profile_baseline.seniority_level` = seniority_assessment
- `agent_task.output_data` = 完整输出

**完成事件**:
```
💬 履历分析师 → 调度官: 分析完成。核心技能 {N} 项，领域 {domain}，{seniority} 级别
```

**失败处理**:
- markitdown 失败 + 回退提取也失败 → throw → 任务标 failed → 最多重试 3 次
- LLM 返回空 ability_model → throw → 重试
- 3 次都失败 → 通知用户重新上传简历

---

### 4.2 岗位研究员 — generate_keywords

**输入**: ability_model + strategy_mode（从 team 表读取）

**策略指令映射**:
```
broad:    "广撒网模式: 生成 5-7 个岗位方向，包含核心、相邻和可迁移方向"
balanced: "均衡模式: 生成 3-5 个岗位方向，核心方向加少量相邻方向"
precise:  "精准模式: 只生成 2-3 个最核心的岗位方向"
```

**LLM 输入**:
```json
{
  "ability_model": { "core_skills": [...], "domain_expertise": [...], "seniority_assessment": "senior", "career_trajectory": "..." },
  "strategy_mode": "balanced",
  "strategy_instruction": "均衡模式: 生成 3-5 个岗位方向，核心方向加少量相邻方向"
}
```

**LLM 输出**:
```json
{
  "job_directions": [
    { "zh": "区块链工程师", "en": "Blockchain Engineer", "is_core": true },
    { "zh": "Web3后端开发", "en": "Web3 Backend Developer", "is_core": true },
    { "zh": "DeFi协议工程师", "en": "DeFi Protocol Engineer", "is_core": false },
    { "zh": "全栈工程师", "en": "Full Stack Engineer", "is_core": false }
  ],
  "en_keywords": ["blockchain engineer", "web3 backend developer", "defi protocol engineer", "full stack engineer"],
  "zh_keywords": ["区块链工程师", "Web3后端开发", "DeFi协议工程师", "全栈工程师"],
  "primary_domain": "web3",
  "seniority_bracket": "senior",
  "strategy_applied": "balanced",
  "reasoning": "..."
}
```

**关键规则**:
- `en_keywords[i]` 和 `zh_keywords[i]` 是同一个岗位方向的双语版本
- 没有 `target_companies` — 不猜公司
- `job_directions` 里 `is_core=true` 的方向在所有策略下都保留

**质量验证**:
- `job_directions.length >= 1`
- 每个 direction 都有 `zh` 和 `en`

**写入**: `profile_baseline.search_keywords`

**完成事件**:
```
💬 岗位研究员 → 调度官: 关键词生成完成。{N} 个方向，中英各 {N} 个
```

---

### 4.3 岗位研究员 — opportunity_discovery

**输入**: search_keywords + platform_connections + target_locations

**搜索逻辑**:

| 平台 | 关键词 | 搜索方式 | 城市过滤 |
|------|--------|---------|---------|
| Greenhouse | en_keywords | 逐个关键词搜公开岗位板 | 无 |
| Lever | en_keywords | 逐个关键词搜公开岗位板 | 无 |
| LinkedIn | en_keywords | 关键词搜岗位列表 | work_mode=remote 时加过滤 |
| Boss直聘 | zh_keywords | 关键词搜岗位 | target_locations |
| 智联招聘 | zh_keywords | 关键词搜岗位 | target_locations |
| 拉勾 | zh_keywords | 关键词搜岗位 | target_locations |
| 猎聘 | zh_keywords | 关键词搜岗位 | target_locations |

**注意**: Greenhouse/Lever 不再需要 target_companies 列表。直接用关键词搜索公开岗位板，搜到什么公司就是什么公司。

**每次搜索**: 从关键词列表轮换取 2-3 个，每个关键词搜 10 个结果，去重后入库。

**频率** (策略决定):
- 广撒网: 3 分钟
- 均衡: 5 分钟
- 精准: 10 分钟

**写入**: `opportunity` 表 (stage=discovered)

**完成事件**:
```
💬 岗位研究员 → 调度官: 搜索完成。Greenhouse {N}, LinkedIn {N}, Boss直聘 {N}...共 {total} 个
```

---

### 4.4 匹配审核员 — screening

**输入**: opportunity + profile_baseline + strategy_mode

**3 个 LLM Skill 按顺序**:
1. `fit-evaluation` → fit_posture (strong/moderate/weak/misaligned) + dimension_scores
2. `conflict-detection` → conflict_severity (none/minor/meaningful/blocking) + hard_conflicts
3. `recommendation-generation` → recommendation (advance/hold/reject)

**策略影响推荐门槛**:

| 策略 | advance 条件 |
|------|-------------|
| 广撒网 | moderate_fit + 无 hard conflict |
| 均衡 | moderate_fit + 无 blocking conflict |
| 精准 | strong_fit only |

**写入**: opportunity 的 fit/recommendation 字段，stage → screened → prioritized

**完成事件**:
```
💬 匹配审核员 → 调度官: 筛选完成。推荐 {N}, 观望 {N}, 不匹配 {N}
```

---

### 4.5 简历顾问 — material_generation（仅 full_tailored）

**触发条件**: recommendation=advance 且 pipeline_mode=full_tailored

**2 个 LLM Skill**:
1. `truthful-rewrite` → 定制简历（不造假，重组强调）
2. `cover-letter-generation` → 求职信

**passthrough 管道和 conversation 管道不经过此步。**

**写入**: material 表 + opportunity.stage → material_ready

---

### 4.6 投递专员 — submission / first_contact

**submission (Gate 6)**:
- full_tailored: Playwright 填 ATS 表单 + 上传定制 PDF + 求职信
- passthrough: 一键投递（原始简历）

**first_contact (Gate 7 — Boss 专属)**:
- 发打招呼消息（可附简历）
- 创建 conversation_thread

**投递量限制** (策略决定):
- 广撒网: 平台日限 100%
- 均衡: 60%
- 精准: 30%

---

### 4.7 招聘关系经理 — reply_processing / follow_up

**reply_processing**: 轮询 Boss 聊天 → LLM 分析意图 + regex 匹配信号 → 创建 handoff

**6 组信号**: 面试时间(critical) / 微信联系(high) / 薪资讨论(high) / Offer(critical) / 拒绝(low) / 系统卡片(medium)

**follow_up**: 3 天无回复 → 发跟进消息

---

## 五、Timeline 事件格式（群聊模式）

```typescript
{
  team_id: string,
  event_type: 'dispatch_assign' | 'agent_report' | 'agent_online' | ...,
  summary_text: string,        // 中文描述
  actor_type: 'dispatcher' | 'agent' | 'system',
  actor_name: string,          // '调度官' | '履历分析师' | ...
  target_agent: string | null, // 被 @ 的 agent
  visibility: 'feed',
  metadata: jsonb,             // { task_type, task_id, input_summary, output_summary }
}
```

**需要 migration**: timeline_event 加 `actor_name text` + `target_agent text` 列。

---

## 六、策略模式完整对照

| 维度 | ⚡广撒网 | ⚖️均衡 | 🎯精准 |
|------|---------|--------|--------|
| 岗位方向数 | 5-7 | 3-5 | 2-3 |
| 搜索频率 | 3 分钟 | 5 分钟 | 10 分钟 |
| 筛选门槛 | moderate → advance | moderate+无blocking → advance | strong only |
| 日投递量 | 日限 100% | 日限 60% | 日限 30% |

---

## 七、三条管道对照

| | 英文 full_tailored | 中文 passthrough | Boss直聘 conversation |
|---|---|---|---|
| 平台 | Greenhouse, Lever, LinkedIn | 智联, 拉勾, 猎聘 | Boss直聘 |
| 搜索词 | en_keywords | zh_keywords | zh_keywords |
| 城市过滤 | remote 过滤 | target_locations | target_locations |
| 筛选 | 3-skill LLM | 3-skill LLM | 3-skill LLM |
| 简历定制 | truthful-rewrite + cover-letter | 不定制 | 不投简历 |
| 投递方式 | Playwright 填表 | 一键投递 | 打招呼消息（可附简历） |
| 跟进 | 无 | 无 | 轮询 + LLM + regex |
| 交接 | 无 | 无 | 检测信号 → handoff |

---

## 八、错误处理

| 错误类型 | 重试 | 备注 |
|---------|------|------|
| markitdown 失败 | 回退到 extractResumeText | |
| LLM 超时 | 3 次 [30s, 120s, 600s] | |
| LLM 输出不合格 | 2 次 + format hint | |
| Cookie 过期 | 0 次，标 failed | 通知用户重新登录 |
| 反爬 rate_limit | 2 次 [60s, 300s] | |
| 简历完全无法解析 | 0 次 | 通知用户重新上传 |
| 任务超时 (10 分钟) | requeue | sweepStaleTasks 处理 |

---

## 九、原子 Checkout

```sql
UPDATE agent_task SET status = 'running', started_at = now()
WHERE id = $1 AND status = 'queued';
-- 0 行更新 = 被其他 Worker 抢了
```

---

## 十、需要修改的文件

| 文件 | 改动 |
|------|------|
| `src/worker/Dockerfile` | 加 Python3 + markitdown 安装 |
| `src/worker/task-executor.ts` | handleAnalyzeResume 用 markitdown CLI；handleGenerateKeywords 加 strategy_mode + job_directions 结构 |
| `src/worker/dispatch-loop.ts` | Gate 1/2 检查改严；策略影响 discovery 频率；每个 Gate 插入 dispatch_assign 事件 |
| `src/worker/skills/contracts.ts` | analyze-resume prompt 用 Markdown 输入；keyword-generation prompt 加 strategy + job_directions |
| `src/worker/pipeline.ts` | discovery 不用 target_companies；策略影响投递量 |
| `supabase/migrations/` | timeline_event 加 actor_name + target_agent |
| `app/(app)/home/page.tsx` | 群聊模式渲染（后续 UI 任务） |
