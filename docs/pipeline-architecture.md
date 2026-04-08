# 海投 OS — 三条管道架构图

```
                              ┌─────────────────────────────┐
                              │      profile_baseline       │
                              │  skills, experiences, domain │
                              └─────────────┬───────────────┘
                                            │
                                            ▼
                              ┌─────────────────────────────┐
                              │   履历分析师 (Analyst)       │
                              │   keyword-generation skill   │
                              └─────────────┬───────────────┘
                                            │
                         ┌──────────────────┼──────────────────┐
                         ▼                  ▼                  ▼
                   en_keywords        zh_keywords        target_companies
                   + companies                           (coinbase, etc.)
                         │                  │                  │
         ┌───────────────┘                  └────────┬─────────┘
         ▼                                           ▼
┌─────────────────────┐                  ┌──────────────────────┐
│  英文 full_tailored │                  │     中文平台          │
│  GH / Lever / LI    │                  │                      │
└────────┬────────────┘                  │  ┌────────────────┐  │
         │                               │  │  passthrough   │  │
         │                               │  │ 智联/拉勾/猎聘 │  │
         │                               │  └───────┬────────┘  │
         │                               │          │           │
         │                               │  ┌───────┴────────┐  │
         │                               │  │  conversation  │  │
         │                               │  │   Boss直聘     │  │
         │                               │  └───────┬────────┘  │
         │                               └──────────┼───────────┘
         │                                          │
         ▼                                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     岗位研究员 (Scout)                                │
│                                                                      │
│  Greenhouse: 用 target_companies 拼 boards.greenhouse.io/{slug}/jobs │
│  Lever:      用 target_companies 拼 jobs.lever.co/{slug}             │
│  LinkedIn:   用 en_keywords 搜索 Easy Apply 岗位                     │
│  Boss直聘:   用 zh_keywords 搜索岗位列表                              │
│  智联招聘:   用 zh_keywords 搜索岗位列表                              │
│  拉勾:       用 zh_keywords 搜索岗位列表                              │
│  猎聘:       用 zh_keywords 搜索岗位列表                              │
│                                                                      │
│  输出: opportunity 表 (stage=discovered)                              │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    匹配审核员 (Reviewer)                              │
│                    ── 所有平台共用 ──                                 │
│                                                                      │
│  Skill 1: fit-assessment      技能匹配度 (strong/moderate/weak)      │
│  Skill 2: conflict-detection  冲突检测 (签证/地点/资历)              │
│  Skill 3: recommendation      最终建议 (advance/hold/reject)         │
│                                                                      │
│  输出: opportunity.stage → screened                                   │
│        match_level + recommendation + reason_tags                    │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
     recommendation=      recommendation=   recommendation=
       advance              hold              reject
              │                │                │
              │                │                └──→ stage=closed
              │                └──→ stage=screened (等待)
              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                   按管道类型分流                                      │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  full_tailored (Greenhouse / Lever / LinkedIn)                  │ │
│  │                                                                 │ │
│  │  简历顾问 (Advisor):                                            │ │
│  │    → truthful-rewrite: 针对 JD 定制简历 (不造假，重组+强调)     │ │
│  │    → cover-letter: 生成求职信                                   │ │
│  │                                                                 │ │
│  │  投递专员 (Executor):                                           │ │
│  │    → Playwright 打开 ATS 表单                                   │ │
│  │    → 逐字段填写 (姓名/邮箱/电话/学历/...)                       │ │
│  │    → 上传定制简历 PDF + 求职信                                  │ │
│  │    → 点击提交                                                   │ │
│  │                                                                 │ │
│  │  结束。无跟进。                                                  │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  passthrough (智联 / 拉勾 / 猎聘)                               │ │
│  │                                                                 │ │
│  │  无简历定制 — 用原始简历                                         │ │
│  │                                                                 │ │
│  │  投递专员 (Executor):                                           │ │
│  │    → 平台一键投递接口                                           │ │
│  │    → 批量提交                                                   │ │
│  │                                                                 │ │
│  │  结束。无跟进。                                                  │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  conversation (Boss直聘)                                        │ │
│  │                                                                 │ │
│  │  无简历投递 — Boss 的模式是先打招呼                               │ │
│  │                                                                 │ │
│  │  招聘关系经理 (Liaison):                                        │ │
│  │    → 发打招呼消息                                               │ │
│  │    → opportunity.stage → contact_started                        │ │
│  │                                                                 │ │
│  │  轮询跟进 (Loop 2):                                             │ │
│  │    → Playwright 读 Boss 聊天页面                                │ │
│  │    → 发现 HR 回复 → 存入 conversation_message                   │ │
│  │    → 双重检测:                                                  │ │
│  │       ┌──────────────────────────────────────────┐              │ │
│  │       │  Qwen LLM reply-reading                  │              │ │
│  │       │  分析回复意图:                            │              │ │
│  │       │    positive / neutral / handoff_trigger   │              │ │
│  │       ├──────────────────────────────────────────┤              │ │
│  │       │  Regex boundary scan (6 组双语模式)       │              │ │
│  │       │    面试时间 → interview_time (critical)   │              │ │
│  │       │    微信/手机 → private_contact (high)     │              │ │
│  │       │    薪资讨论 → salary_confirmation (high)  │              │ │
│  │       │    Offer → offer_decision (critical)      │              │ │
│  │       │    拒绝 → rejection_signal (low)          │              │ │
│  │       │    系统卡片 → system_card (medium)        │              │ │
│  │       └──────────────────────────────────────────┘              │ │
│  │                                                                 │ │
│  │    检测到信号 → 创建 handoff                                     │ │
│  │    → opportunity.stage → needs_takeover                         │ │
│  │    → 用户在交接中心看到并接管                                    │ │
│  │                                                                 │ │
│  │  3 天无回复 → 自动发跟进消息                                     │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘


══════════════════════════════════════════════════════════════════════
                        Opportunity 状态机
══════════════════════════════════════════════════════════════════════

  discovered → screened → prioritized → materials_ready → submitted
       │                                                      │
       │         (passthrough: skip materials_ready)           │
       │                                                      ▼
       │                                              contact_started
       │                                                      │
       └──→ closed                                    needs_takeover
                                                              │
                                                       用户接管处理
                                                              │
                                                     resolved / closed


══════════════════════════════════════════════════════════════════════
                        Worker 调度循环 (30s)
══════════════════════════════════════════════════════════════════════

  ┌─────────────────────────────────────────────────────────┐
  │                    每 30 秒一轮                          │
  │                                                         │
  │  1. sweepKeywordGeneration                              │
  │     search_keywords == null? → 创建 keyword_gen 任务    │
  │                                                         │
  │  2. sweepDiscovery (每 5 分钟)                          │
  │     keywords 有内容? → 创建 discovery 任务              │
  │                                                         │
  │  3. sweepScreening                                      │
  │     有 discovered 状态的 opportunity? → 创建 screening  │
  │                                                         │
  │  4. sweepMaterialGeneration                             │
  │     有 advance + full_tailored? → 创建 material 任务    │
  │                                                         │
  │  5. sweepSubmission                                     │
  │     有 materials_ready? → 创建 submission 任务          │
  │                                                         │
  │  6. sweepBossFollowUp                                   │
  │     有 contact_started + Boss? → 轮询聊天 + 检测        │
  │                                                         │
  │  7. sweepBilling                                        │
  │     扣减 runtime → 余额 = 0 → 暂停团队                 │
  └─────────────────────────────────────────────────────────┘


══════════════════════════════════════════════════════════════════════
                        7 位 Agent 职责
══════════════════════════════════════════════════════════════════════

  调度官 (Commander)     ── 统筹调度，分配任务，监控全局
  履历分析师 (Analyst)   ── 解析简历，生成搜索关键词
  岗位研究员 (Scout)     ── 搜索各平台，发现岗位
  匹配审核员 (Reviewer)  ── 3-skill LLM 评估匹配度
  简历顾问 (Advisor)     ── 定制简历 + 求职信 (仅英文平台)
  投递专员 (Executor)    ── Playwright 填表投递 / 一键投递
  招聘关系经理 (Liaison) ── Boss 打招呼 + 对话跟进 + 交接检测
```
