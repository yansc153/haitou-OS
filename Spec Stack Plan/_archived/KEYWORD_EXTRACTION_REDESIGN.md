# 关键词提取 + 实时动态重构计划

> 日期: 2026-04-08
> 状态: 已确认
> 版本: V2 — 用户反馈后修订

---

## 一、核心决策

| # | 决策 | 确认 |
|---|------|------|
| 1 | 关键词完全由 AI 生成，删除用户手填 | ✅ |
| 2 | 所有平台（英文+中文）统一用关键词搜索 | ✅ |
| 3 | 关键词在用户点击"启动团队"时生成 | ✅ |
| 4 | 实时动态记录每个智能体的每一步操作 | ✅ |

---

## 二、新的启动团队流程

```
用户点击"启动团队"
    ↓
[调度官上线]
  → 实时动态: "调度官已上线，开始初始化团队"
    ↓
[履历分析师上线 + 分析简历]
  → 实时动态: "履历分析师已上线"
  → 实时动态: "履历分析师开始分析简历..."
  → AI skill: keyword-generation
  → 实时动态: "履历分析师完成分析 — 识别出 15 个目标方向:
     区块链工程师、智能合约开发、DeFi协议... 
     推荐搜索 Coinbase、Binance、ConsenSys..."
    ↓
[调度官分配任务]
  → 实时动态: "调度官将 8 个中文关键词分配给岗位研究员（中文平台）"
  → 实时动态: "调度官将 7 个英文关键词分配给岗位研究员（英文平台）"
    ↓
[岗位研究员上线 + 搜索]
  → 实时动态: "岗位研究员已上线，开始搜索智联招聘..."
  → 实时动态: "岗位研究员在智联招聘搜索「区块链工程师」，发现 10 个岗位"
  → 实时动态: "岗位研究员在智联招聘搜索「智能合约开发」，发现 8 个岗位"
  → 实时动态: "岗位研究员在 LinkedIn 搜索「blockchain engineer」，发现 12 个岗位"
  → ...
    ↓
[匹配审核员上线 + 筛选]
  → 实时动态: "匹配审核员已上线，开始筛选 48 个新岗位"
  → 实时动态: "已筛选 Coinbase 的「Senior Blockchain Engineer」— 强匹配，推荐投递"
  → 实时动态: "已筛选 某公司 的「前端开发」— 弱匹配，持续观望"
  → ...
    ↓
[简历顾问上线 + 精修] (仅英文平台 advance 岗位)
  → 实时动态: "简历顾问已上线，开始为 3 个推荐岗位定制简历"
  → 实时动态: "简历顾问完成 Coinbase「Senior Blockchain Engineer」的简历定制"
  → 实时动态: "简历顾问完成求职信撰写"
    ↓
[投递专员上线 + 投递]
  → 实时动态: "投递专员已上线"
  → 实时动态: "投递专员成功投递 Coinbase「Senior Blockchain Engineer」"
  → 实时动态: "投递专员在智联招聘投递「区块链工程师」岗位"
    ↓
[招聘关系经理] (Boss直聘)
  → 实时动态: "招聘关系经理向 XX公司 发送打招呼消息"
  → 实时动态: "招聘关系经理收到 XX公司 的回复"
  → 实时动态: "⚠️ 检测到面试邀约信号 — 需要你接管"
```

---

## 三、keyword-generation skill

### 输入
```json
{
  "profile_baseline": {
    "experiences": [...],
    "skills": [...],
    "education": [...],
    "primary_domain": "web3",
    "headline_summary": "...",
    "capability_tags": [...]
  }
}
```

### 输出
```json
{
  "en_keywords": [
    "blockchain engineer",
    "smart contract developer", 
    "web3 backend engineer",
    "crypto trading systems engineer",
    "DeFi protocol developer",
    "solidity developer",
    "distributed systems engineer",
    ...
  ],
  "zh_keywords": [
    "区块链工程师",
    "智能合约开发工程师",
    "Web3后端开发",
    "加密货币交易系统",
    "DeFi协议开发",
    "Solidity开发工程师",
    "分布式系统工程师",
    ...
  ],
  "target_companies": [
    "Coinbase", "Binance", "ConsenSys", "Chainalysis",
    "Uniswap", "OpenSea", "Alchemy", "Infura",
    ...
  ],
  "primary_domain": "web3",
  "seniority_bracket": "mid-senior",
  "reasoning": "候选人有3年区块链开发经验，精通Solidity和Rust，曾在DeFi项目中..."
}
```

### Prompt 设计要点
- 基于简历实际经验生成，不编造
- 关键词覆盖：精确方向 + 可迁移的相邻领域
- 英文关键词符合 LinkedIn/Greenhouse 搜索习惯
- 中文关键词符合智联/拉勾/Boss 搜索习惯
- 公司列表只包含确认有公开 job board 的公司
- 每类生成 10-20 个关键词

---

## 四、Discovery 改动

### 英文平台

**旧**: 固定公司列表 (DOMAIN_BOARD_MAP)
**新**: 
- Greenhouse/Lever: 用 AI 生成的 `target_companies` 查各公司 job board
- LinkedIn: 用 `en_keywords` 逐条搜索

### 中文平台

**旧**: onboarding_draft.target_roles (用户手填)
**新**: 用 `zh_keywords` 逐条搜索

### 搜索策略
- 每轮 Discovery 从关键词列表中轮换（不是每次搜全部）
- 每个关键词搜 10 个结果
- 避免重复搜索相同关键词（用 last_searched_at 标记）

---

## 五、实时动态改动

### 当前问题
只有 3 种事件: discovery_completed, opportunity_screened, team_started/paused

### 新增事件类型

| event_type | 智能体 | 示例文本 |
|-----------|--------|---------|
| agent_online | 各智能体 | "调度官已上线" |
| resume_analysis_started | 履历分析师 | "履历分析师开始分析简历" |
| resume_analysis_completed | 履历分析师 | "履历分析师完成分析 — 识别出15个目标方向" |
| keyword_generated | 履历分析师 | "生成搜索关键词: 区块链工程师、智能合约..." |
| task_assigned | 调度官 | "调度官将8个中文关键词分配给岗位研究员" |
| platform_search_started | 岗位研究员 | "岗位研究员开始搜索智联招聘" |
| platform_search_completed | 岗位研究员 | "在智联搜索「区块链工程师」发现10个岗位" |
| screening_started | 匹配审核员 | "匹配审核员开始筛选48个新岗位" |
| opportunity_screened | 匹配审核员 | "已筛选 Coinbase「Senior BE」— 强匹配" |
| material_started | 简历顾问 | "简历顾问开始为3个岗位定制简历" |
| material_completed | 简历顾问 | "完成 Coinbase 简历定制" |
| submission_started | 投递专员 | "投递专员开始投递" |
| submission_success | 投递专员 | "成功投递 Coinbase「Senior BE」" |
| boss_greeting_sent | 招聘关系经理 | "向XX公司发送打招呼消息" |
| reply_detected | 招聘关系经理 | "收到XX公司的回复" |
| handoff_created | 招聘关系经理 | "⚠️ 检测到面试邀约 — 需要你接管" |

### 前端 EVENT_TYPE_ZH 映射（home/page.tsx）
需要同步更新，每个新事件类型都有对应的中文标签和智能体图标。

---

## 六、改动文件清单

| 文件 | 改动 |
|------|------|
| `src/worker/skills/contracts.ts` | 新增 keyword-generation skill |
| `src/worker/pipeline.ts` | team-start 时调 keyword-generation |
| `src/worker/pipeline.ts` | Discovery 改用 profile_baseline.search_keywords |
| `src/worker/pipeline.ts` | 删除 DOMAIN_BOARD_MAP 硬编码 |
| `src/worker/pipeline.ts` | 每步操作插入详细 timeline_event |
| `src/worker/dispatch-loop.ts` | team activate 时插入 agent_online 事件 |
| `supabase/functions/team-start/index.ts` | 触发 keyword generation task |
| `app/(app)/home/page.tsx` | EVENT_TYPE_ZH 新增全部事件类型 |
| `app/(app)/resume/page.tsx` | 删除"目标岗位"手填框 |
| DB migration | profile_baseline 加 search_keywords JSONB |

---

## 七、智能体因果链（核心运行逻辑）

> 不是固定检查点，是一条因果链条。每一步的输出是下一步的输入。
> 调度官是链条的枢纽——它判断下一步需要什么，然后唤醒对应的智能体。

```
用户点击"启动团队"
  ↓
调度官被唤醒
  → 检查 profile_baseline.search_keywords 是否存在
  → 如果为空 → 唤醒履历分析师
  ↓
履历分析师上线
  → 读取 profile_baseline（experiences, skills, education...）
  → 调用 keyword-generation skill（AI 分析）
  → 产出: en_keywords[], zh_keywords[], target_companies[]
  → 写入 profile_baseline.search_keywords
  ↓
调度官拿到关键词（上一步的输出）
  → 判断需要搜索
  → 唤醒岗位研究员，传递关键词
  ↓
岗位研究员上线
  → 拿到 en_keywords → 在 LinkedIn/Greenhouse/Lever 搜索
  → 拿到 zh_keywords → 在智联/拉勾/猎聘/Boss 搜索
  → 每个关键词搜索 → 产出岗位列表
  ↓
调度官看到新岗位（上一步的输出）
  → 唤醒匹配审核员
  ↓
匹配审核员上线
  → 用 profile_baseline 评估每个岗位
  → 产出: advance / watch / drop
  ↓
对于 advance 岗位:
  ├─ 英文平台 (full_tailored):
  │    调度官唤醒简历顾问
  │    → 简历顾问读取 profile_baseline + JD
  │    → 产出: 定制简历 + 求职信
  │    → 调度官唤醒投递专员
  │    → 投递专员用定制简历投递
  │
  ├─ 中文平台 (passthrough):
  │    调度官直接唤醒投递专员
  │    → 投递专员用原始简历投递
  │
  └─ Boss直聘 (conversation):
       调度官唤醒招聘关系经理
       → 招聘关系经理发送打招呼消息
       → 每15分钟轮询回复
       → 检测到面试信号 → 创建交接
       → 用户接管

每一步都写入实时动态（timeline_event），记录:
  - 谁（哪个智能体）
  - 干了什么（具体操作）
  - 产出了什么（关键词/岗位数/匹配结果/...）
```

---

## 八、执行顺序

```
1. DB migration: 加 search_keywords 字段
2. keyword-generation skill 定义 + 实现
3. team-start 流程加入 keyword generation
4. pipeline.ts Discovery 改用新关键词
5. 每步操作加 timeline_event 插入
6. 前端 EVENT_TYPE_ZH 更新
7. 删除"目标岗位"文本框
8. 部署 + 验证
```

## 九、验证方法

验证的核心是**因果链条是否按逻辑推演**，不是检查固定文案。

**MCP Playwright 验证步骤：**
1. 打开首页，启动团队
2. 监听实时动态，验证事件按因果链顺序出现
3. 验证关键词内容与简历相关（不是无关的默认值）
4. 打开机会中心，验证新岗位来自多个平台且与简历相关
5. 验证匹配度评估使用了真实简历数据
6. 验证英文 advance 岗位有定制简历 + 求职信
7. 验证中文 passthrough 岗位直接投递
8. 验证 Boss 岗位走打招呼流程
