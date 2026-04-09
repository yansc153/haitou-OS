# 海投 OS — 因果链最终规格书

> 版本: v3.1 FINAL
> 日期: 2026-04-09
> 状态: ✅ 已确认，可实施
> 审阅: Claude 起草 → Codex 审阅 (12 issues found) → Codex 重写 → Claude review → 用户确认

---

## 一、总览

调度官每 30 秒醒来一次，评估团队状态，创建一个最高优先级任务。所有 Agent 之间不直接通信，一切经调度官。

---

## 二、简历解析 — MarkItDown

Worker 容器中使用 [Microsoft MarkItDown](https://github.com/microsoft/markitdown) 预处理简历。

```
下载简历 → markitdown resume.pdf → resume.md → 发给 LLM
```

Dockerfile 加: `python3 + pip install 'markitdown[pdf,docx]'`

fallback: Node.js 库 (pdf-parse / mammoth)，不用 Deno 版。

两者都失败 → 任务 failed → 通知用户重新上传。

---

## 三、调度官决策树

### Gate 1: analyze_resume (履历分析师)
- 条件: ability_model 不存在或 core_skills 为空
- 输入: 从 Storage 下载简历 → markitdown → Markdown 文本
- 输出: ability_model (core_skills, domain_expertise, experience_highlights, capability_boundary, seniority, career_trajectory)
- 写入: profile_baseline.ability_model + skills + primary_domain + seniority_level

### Gate 2: generate_keywords (岗位研究员)
- 条件: search_keywords 不存在或 job_directions 为空
- 输入: ability_model + team.strategy_mode
- 输出:
  ```json
  {
    "job_directions": [
      { "zh": "区块链工程师", "en": "Blockchain Engineer", "is_core": true }
    ],
    "en_keywords": ["blockchain engineer", ...],
    "zh_keywords": ["区块链工程师", ...],
    "primary_domain": "web3",
    "seniority_bracket": "senior",
    "strategy_applied": "balanced"
  }
  ```
- **没有 target_companies** — 所有平台统一用关键词搜索，搜到什么公司就是什么公司
- **en/zh_keywords**: 同一组岗位方向的双语版本，不是独立生成
- 策略影响方向数: broad 5-7 / balanced 3-5 / precise 2-3
- 写入: profile_baseline.search_keywords

### Gate 3: opportunity_discovery (岗位研究员)
- 条件: 有关键词 且 超过 discovery 间隔 且 无 active 任务
- 间隔: broad 3min / balanced 5min / precise 10min
- 平台搜索输入:

| 平台 | 搜索输入 | 搜索方式 | 城市过滤 |
|------|---------|---------|---------|
| Greenhouse | en_keywords | Google site:boards.greenhouse.io "{keyword}" | 无 |
| Lever | en_keywords | Google site:jobs.lever.co "{keyword}" | 无 |
| LinkedIn | en_keywords | 平台搜索 | work_mode 过滤 |
| Boss直聘 | zh_keywords | 平台搜索 | preferred_locations |
| 智联/拉勾/猎聘 | zh_keywords | 平台搜索 | preferred_locations |

- **Greenhouse/Lever**: 不用 board-slug API，改用 Google site search。Playwright 搜 `site:boards.greenhouse.io "blockchain engineer"`，解析搜索结果提取岗位链接。搜到什么公司就是什么公司。

- **preferred_locations 流转**: onboarding target_locations → user_preferences.preferred_locations → discovery 输入
- 去重: external_ref 或 company_name + job_title
- **zero-result backoff**: 1 次空 → 2x 间隔，2 次 → 4x，3 次 → 8x，4+ → cap 24h。任何新结果/设置变更 reset。
- 写入: opportunity (stage=discovered)

### Gate 4: screening (匹配审核员)
- 条件: 有 stage=discovered 的 opportunity
- 3 个 LLM skill: fit-evaluation → conflict-detection → recommendation-generation
- 推荐值: **advance / watch / drop / needs_context**（不是 hold/reject）
- 策略影响门槛:
  - broad: strong or moderate fit + 无 blocking → advance
  - balanced: strong or moderate + conflict 可控 → advance
  - precise: strong fit only → advance
- 写入: opportunity.recommendation + stage → screened → prioritized

### Gate 5: material_generation (简历顾问) — 仅 full_tailored
- 条件: advance + full_tailored + 无 ready tailored resume
- 2 个 skill: truthful-rewrite + cover-letter-generation
- 输出存 material 表 (material_type=standard_tailored_resume, status=ready)
- stage: prioritized → material_ready（需有 ready tailored resume）
- passthrough 和 conversation 管道不经过此步

### Gate 6: submission (投递专员)
- full_tailored 条件: stage=material_ready
- passthrough 条件: stage=prioritized + advance + 非 Boss
- **简历来源**:
  - full_tailored: **从 material 表读定制简历**（不是原始简历）
  - passthrough: 原始简历
- cover letter: 如果有且平台支持 → 一起提交
- 投递量: broad 100% / balanced 60% / precise 30% of 平台日限
- budget check: canPerformAction → recordAction
- 写入: submission_attempt + opportunity.stage → submitted

### Gate 7: first_contact (投递专员) — Boss 专属
- 条件: advance + boss_zhipin + stage=prioritized
- **路由: pipeline.runFirstContact()**，不是 executeSkill()
- 流程: budget check → boss-greeting-compose → sendBossGreeting → 创建 conversation_thread
- **V1: 打招呼附带简历**
- stage: prioritized → contact_started

### Gate 8: reply_processing / follow_up (招聘关系经理)
- reply_processing: 轮询 Boss 聊天 → LLM reply-reading → regex 6 组信号 → 创建 handoff
- **follow_up: 自动发送**（LLM 根据对话上下文判断语气和内容）
- 3 天无回复 → 自动发跟进消息
- 信号: 面试(critical) / 微信(high) / 薪资(high) / Offer(critical) / 拒绝(low) / 系统卡片(medium)

---

## 四、策略模式

| 维度 | ⚡broad | ⚖️balanced | 🎯precise |
|------|--------|-----------|---------|
| 方向数 | 5-7 | 3-5 | 2-3 |
| 搜索间隔 | 3min | 5min | 10min |
| 筛选门槛 | moderate → advance | moderate+可控 → advance | strong only |
| 投递量 | 日限 100% | 日限 60% | 日限 30% |
| budget multiplier | 1.0 | 0.6 | 0.3 |

budget service 读 team.strategy_mode（单一来源），不读 user_preferences。

---

## 五、三条管道

| | full_tailored | passthrough | conversation |
|---|---|---|---|
| 平台 | GH/Lever/LinkedIn | 智联/拉勾/猎聘 | Boss直聘 |
| 搜索 | en_keywords (GH/Lever 用 Google site search) | zh_keywords + locations | zh_keywords + locations |
| 筛选 | 3-skill LLM | 3-skill LLM | 3-skill LLM |
| 材料 | 定制简历+求职信 | 不定制 | 不投简历 |
| 投递 | Playwright 填表（定制简历） | 一键投递（原始简历） | 打招呼消息（附简历） |
| 跟进 | 无 | 无 | 自动轮询+自动发送跟进 |
| 交接 | 无 | 无 | LLM+regex → handoff |

---

## 六、状态机

```
full_tailored:  discovered → screened → prioritized → material_ready → submitted
passthrough:    discovered → screened → prioritized → submitted
conversation:   discovered → screened → prioritized → contact_started → [followup] → [handoff]
```

---

## 七、Timeline 事件（群聊模式）

每个 Gate 触发时插入 dispatch_assign 事件（调度官 @agent）。
每个任务完成时插入 agent_report 事件（agent → 调度官）。

需要 migration: timeline_event 加 `target_agent text` 列。

---

## 八、错误处理

| 错误 | 处理 |
|------|------|
| markitdown 失败 | Node.js fallback (pdf-parse/mammoth) |
| 两者都失败 | fail + 通知用户 |
| LLM 超时 | 3 次重试 [30s, 120s, 600s] |
| Cookie 过期 | 0 重试，标 session_expired |
| zero-result discovery | backoff 2x→4x→8x→24h cap |
| 定制简历缺失 | 阻塞投递，不用原始简历替代 |
| Boss 发送失败 | 不进 contact_started |

---

## 九、需改文件

| 文件 | 改动 |
|------|------|
| `src/worker/Dockerfile` | +python3 +markitdown |
| `src/worker/task-executor.ts` | analyze_resume 用 markitdown；generate_keywords 加 strategy + target_companies；first_contact 走 pipeline.runFirstContact()；follow_up 自动发送 |
| `src/worker/dispatch-loop.ts` | Gate 条件改严；策略动态间隔；zero-result backoff；dispatch_assign 事件 |
| `src/worker/skills/contracts.ts` | analyze-resume 用 Markdown 输入；keyword-generation 加 strategy + target_companies + job_directions |
| `src/worker/pipeline.ts` | GH/Lever 保持 board-slug 模式；submission 用 material 表定制简历；discovery 传 preferred_locations |
| `src/worker/services/budget.ts` | 读 team.strategy_mode 算 effective cap |
| `supabase/functions/onboarding-complete` | 把 target_locations 写入 user_preferences.preferred_locations |
| `supabase/migrations/` | timeline_event +target_agent；discovery_state 表（backoff 计数器） |

---

## 十、最终因果链

```
简历上传 → 存 Storage
Onboarding 完成 → team + baseline + preferred_locations 持久化

Gate 1: 调度官 @履历分析师 → markitdown 解析简历 → ability_model
Gate 2: 调度官 @岗位研究员 → 根据能力+策略 → job_directions + keywords + company seeds
Gate 3: 调度官 @岗位研究员 → 用 keywords/companies 搜 7 平台 → opportunities
Gate 4: 调度官 @匹配审核员 → 3-skill 筛选 → advance/watch/drop

advance + full_tailored:
  Gate 5: 调度官 @简历顾问 → 定制简历+求职信
  Gate 6: 调度官 @投递专员 → 提交（用定制简历）

advance + passthrough:
  Gate 6: 调度官 @投递专员 → 一键投递（原始简历）

advance + Boss:
  Gate 7: 调度官 @投递专员 → 打招呼（附简历）
  Gate 8: 调度官 @招聘关系经理 → 轮询对话 → 自动跟进 → 检测信号 → 交接
```
