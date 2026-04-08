# 海投 OS — 全产品线审计与修复规划

> 审计日期: 2026-04-06
> 目标: 梳理所有产品线，标记每条线路的完成度和问题，制定不返工的修复策略

---

## 一、产品线全景图

```
用户旅程 (左→右)

  AUTH          ONBOARDING           ACTIVATION        READINESS         RUN
  ────          ──────────           ──────────        ─────────         ───
  登录     →   上传简历    →        团队激活      →   就绪检查     →   启动团队
  注册          回答问题             创建 Agent         检查平台          ↓
               完成 Onboarding      分配运行时间       检查简历      Worker 启动
                                                      检查余额          ↓
                                                                   ┌────────┐
                                                                   │ Loop A │
                                                                   │ 发现   │
  PLATFORM      SETTINGS      BILLING                              │ 筛选   │
  ────────      ────────      ───────                              │ 材料   │
  安装插件      保存偏好      查看方案                              │ 投递   │
  连接平台      更新资料      运行计时                              └────────┘
  健康检查                    强制暂停                                  ↓
                                                                   ┌────────┐
  ADMIN         HANDOFF       REVIEW                               │ Loop B │
  ─────         ───────       ──────                               │ 消息   │
  管理面板      交接处理      活动回顾                              │ 跟进   │
  用户列表      用户介入      统计数据                              │ 交接   │
  系统监控                                                         └────────┘
```

---

## 二、12 条产品线详细审计

### 产品线 1: AUTH（登录/注册）
**涉及文件:** `app/(auth)/login/page.tsx`, `app/auth/callback/route.ts`, `middleware.ts`
**涉及 Edge Function:** `auth-session`, `auth-logout`

| 环节 | 状态 | 问题 |
|------|------|------|
| Google 登录 | ✅ 正常 | — |
| Session 持久化 | ✅ 正常 | — |
| 退出登录 | ✅ 正常 | — |
| 未登录重定向 | ✅ 正常 | — |

**结论: ✅ 无需修复**

---

### 产品线 2: ONBOARDING（新手引导）
**涉及文件:** `app/(onboarding)/resume/page.tsx`, `app/(onboarding)/questions/page.tsx`, `app/(onboarding)/complete/page.tsx`
**涉及 Edge Function:** `onboarding-get`, `onboarding-draft`, `onboarding-resume`, `onboarding-complete`

| 环节 | 状态 | 问题 |
|------|------|------|
| 简历上传 | ⚠️ 部分 | P1: 解析失败返回 200，前端不知道失败了 |
| 简历 PDF 解析 | ⚠️ 部分 | P1: LLM 调用无 null 检查，错误被 swallow |
| 回答问题 | ⚠️ 部分 | P1: 无答案值验证（可提交非法值） |
| 完成 Onboarding | ❌ 有重大问题 | P0: 无事务保护，10+ 条记录任一失败导致残缺状态 |
| 状态流转 | ⚠️ | P1: 无 pre-condition 验证，并发可跳步 |

**问题总数: 5 (1×P0, 4×P1)**

---

### 产品线 3: ACTIVATION（团队激活）
**涉及文件:** `app/(app)/activation/page.tsx`
**涉及 Edge Function:** `activation-get`, `activation-confirm`

| 环节 | 状态 | 问题 |
|------|------|------|
| 显示 Agent 阵容 | ✅ 正常 | — |
| 确认激活 | ❌ 有重大问题 | P0: Agent 被创建两次（onboarding-complete + activation-confirm） |
| 分配运行时间 | ❌ 有重大问题 | P0: Runtime ledger 被插入两次，用户获得双倍时间 |
| 创建 Profile | ⚠️ | P1: 3 个 insert 无错误检查；team→baseline 引用缺失 |

**问题总数: 4 (2×P0, 2×P1)**

---

### 产品线 4: READINESS（就绪检查）
**涉及文件:** `app/(app)/readiness/page.tsx`
**涉及 Edge Function:** `readiness-get`

| 环节 | 状态 | 问题 |
|------|------|------|
| 检查简历 | ⚠️ | P2: 只检查记录存在，不验证字段完整性 |
| 检查平台 | ⚠️ | P2: 不检查用户 plan tier 能否访问该平台 |
| 检查余额 | ✅ 正常 | — |
| 显示 Checklist | ✅ 正常 | — |

**问题总数: 2 (2×P2)**

---

### 产品线 5: PLATFORM（平台连接）
**涉及文件:** `app/(app)/platforms/page.tsx`, `extension/background.js`, `extension/manifest.json`
**涉及 Edge Function:** `platform-connect`, `platform-disconnect`, `platform-reconnect`, `platform-health-check`, `platforms-list`

| 环节 | 状态 | 问题 |
|------|------|------|
| 平台列表展示 | ✅ 正常 | — |
| 插件安装检测 | ✅ 正常 | — |
| Greenhouse 连接（公开 API） | ✅ 正常 | — |
| LinkedIn 连接（需要 Cookie） | ⚠️ | P1: 插件 5 分钟超时不关 tab，用户误以为成功 |
| Cookie 捕获 | ⚠️ | P1: 捕获失败不通知用户 |
| 健康检查 | ⚠️ | P1: 探测失败不记录错误；暂停期间 TTL 继续计时 |
| 断开连接 | ✅ 正常 | — |
| 非 Chromium 提示 | ❌ 缺失 | P2: 没有浏览器检测和引导（V1 需要） |

**问题总数: 4 (3×P1, 1×P2)**

---

### 产品线 6: TEAM START/PAUSE（启动/暂停）
**涉及 Edge Function:** `team-start`, `team-pause`

| 环节 | 状态 | 问题 |
|------|------|------|
| 启动前置检查 | ❌ 有重大问题 | P0: ledger `.single()` 对新团队可能无记录，balance=0 拒绝启动 |
| 更新团队状态 | ⚠️ | P1: status 和 runtime_status 可漂移不一致 |
| 创建 session_start | ✅ 正常 | — |
| 暂停团队 | ⚠️ | P1: 不通知运行中的 executor 停止 |
| session_end 记录 | ❌ | P0: 用户暂停和系统强制暂停竞态导致重复 ledger |

**问题总数: 4 (2×P0, 2×P1)**

---

### 产品线 7: WORKER — Loop A（发现→筛选→材料→投递）
**涉及文件:** `src/worker/index.ts`, `src/worker/dispatch-loop.ts`, `src/worker/task-executor.ts`, `src/worker/pipeline.ts`, `src/worker/executors/*.ts`

| 环节 | 状态 | 问题 |
|------|------|------|
| Worker 启动 | ✅ 正常 | Fly.io 已部署 |
| Dispatch 循环 | ✅ 正常 | 10s 轮询 |
| **发现 sweep** | ✅ 正常 | 每 60 分钟触发 |
| **发现执行** | ⚠️ | P1: Greenhouse/Lever 硬编码公司；过期连接静默跳过 |
| **筛选 sweep** | ✅ 正常 | 每 30 分钟扫描未筛选机会 |
| **筛选执行** | ✅ 正常 | 3 个 skill 链跑通 |
| **材料生成 sweep** | ❌ 完全缺失 | P0: 无函数扫描 prioritized 机会 |
| **材料生成执行** | ❌ 无 handler | P0: task-executor 无 material_generation case |
| **材料生成逻辑** | ⚠️ | P0: 要求 2/2 成功才推进，1/2 成功直接卡死 |
| **投递 sweep** | ❌ 完全缺失 | P0: 无函数扫描 material_ready 机会 |
| **投递 handler** | ❌ 无 handler | P0: task-executor 无 submission case |
| **投递执行** | ⚠️ | P1: 不检查 token 有效性；用旧 stage 做转换 |
| **预算检查** | ⚠️ | P1: 不检查连接状态 |

**问题总数: 10 (5×P0, 5×P1) — 这是断裂最严重的产品线**

---

### 产品线 8: WORKER — Loop B（消息→跟进→交接）
**涉及文件:** `src/worker/task-executor.ts`, `src/worker/services/handoff-detection.ts`

| 环节 | 状态 | 问题 |
|------|------|------|
| 消息轮询 sweep | ✅ 正常 | 每 15 分钟 |
| 消息读取（LinkedIn） | ✅ 正常 | 有完整实现 |
| LLM 回复分析 | ✅ 正常 | reply-reading skill |
| Handoff 检测 | ✅ 正常 | 双语正则 + LLM |
| **首次联系执行** | ❌ 空壳 | P1: 调 LLM 但不发任何消息 |
| **跟进执行** | ❌ 空壳 | P1: 同上 |
| Follow-up sweep | ✅ 正常 | 3天无回复触发 |

**问题总数: 2 (2×P1)**

---

### 产品线 9: BILLING（计费）
**涉及文件:** `src/worker/services/billing.ts`, `app/(app)/billing/page.tsx`

| 环节 | 状态 | 问题 |
|------|------|------|
| Session start 记录 | ✅ 正常 | — |
| Session end 记录 | ❌ | P0: 非幂等，可重复记录 |
| 余额计算 | ✅ 正常 | — |
| **强制暂停** | ❌ 被注释掉 | P0: dispatch-loop:62 注释了 billing 检查 |
| 套餐展示 | ✅ 正常 | — |

**问题总数: 2 (2×P0)**

---

### 产品线 10: SETTINGS（设置）
**涉及文件:** `app/(app)/settings/page.tsx`
**涉及 Edge Function:** `settings-get`, `settings-update`, `submission-profile`

| 环节 | 状态 | 问题 |
|------|------|------|
| 加载用户数据 | ✅ 正常 | — |
| 保存投递资料 | ✅ 正常 | 已加 toast 反馈 |
| 保存求职偏好 | ⚠️ | P2: workMode/scope/strategy 改了 state 但没调后端保存 |

**问题总数: 1 (1×P2)**

---

### 产品线 11: ADMIN（管理面板）
**涉及文件:** `app/admin/`, `supabase/functions/admin-stats/`

| 环节 | 状态 | 问题 |
|------|------|------|
| 管理密码登录 | ✅ 正常 | — |
| 数据加载 | ✅ 正常 | — |
| 6 大模块展示 | ✅ 正常 | — |
| 自动刷新 | ✅ 正常 | 60s 间隔 |

**结论: ✅ 无需修复**

---

### 产品线 12: FRONTEND UI（前端通用）
**涉及文件:** `app/(app)/*.tsx`, `components/**/*.tsx`

| 环节 | 状态 | 问题 |
|------|------|------|
| Nav bar 状态同步 | ✅ 已修 | 2s re-fetch 确认 |
| 主题系统 | ✅ 正常 | — |
| Review 页降级 | ✅ 已修 | 有重试按钮 |
| Review 页"需接管"乱码 | ⚠️ | P2: Unicode 编码问题 |
| Settings toast | ✅ 已修 | — |
| 英文文案 | ✅ 已修 | team-start 已中文化 |

**问题总数: 1 (1×P2)**

---

## 三、问题汇总矩阵

```
产品线          P0   P1   P2   总计   状态
─────────────  ───  ───  ───  ────  ──────
AUTH            0    0    0    0    ✅ 完好
ONBOARDING      1    4    0    5    ⚠️ 需修
ACTIVATION      2    2    0    4    ❌ 需修
READINESS       0    0    2    2    ⚠️ 可暂缓
PLATFORM        0    3    1    4    ⚠️ 需修
TEAM START      2    2    0    4    ❌ 需修
LOOP A          5    5    0   10    ❌ 严重断裂
LOOP B          0    2    0    2    ⚠️ 需补
BILLING         2    0    0    2    ❌ 需修
SETTINGS        0    0    1    1    ⚠️ 可暂缓
ADMIN           0    0    0    0    ✅ 完好
FRONTEND UI     0    0    1    1    ⚠️ 可暂缓
─────────────  ───  ───  ───  ────  ──────
总计           12   18    5   35
```

---

## 四、修复策略 — 三阶段，不返工

### 理念：从下游往上游修

**为什么？** 如果先修上游（onboarding），修完后测试还是到 Loop A 卡住。应该先让下游跑通，再往上游修，这样每修一段都能验证。

### 阶段 1: 打通核心管道（P0 × 12 个）
**目标: 让"启动团队 → 发现 → 筛选 → 材料 → 投递"完整跑一遍**

修复顺序：
```
Step 1.1  修 Billing  (2 P0)
          ├─ session_end 幂等化
          └─ 启用 dispatch-loop 的 billing enforcement

Step 1.2  修 Team Start/Pause  (2 P0)
          ├─ ledger 查询改 .maybeSingle() 容错
          └─ session_end 竞态加唯一约束

Step 1.3  修 Loop A 管道  (5 P0) ← 核心
          ├─ dispatch-loop 加 sweepPrioritizedForMaterials()
          ├─ dispatch-loop 加 sweepMaterialReadyForSubmission()
          ├─ task-executor 加 material_generation handler
          ├─ task-executor 加 submission handler
          └─ 材料生成改为 1/2 也推进（只有简历也能投）

Step 1.4  修 Activation  (2 P0)
          ├─ 去掉 activation-confirm 的重复 agent 创建
          └─ 去掉重复 ledger allocation

Step 1.5  修 Onboarding  (1 P0)
          └─ onboarding-complete 加 error check 和 rollback 逻辑
```

**验证方式：** 每个 Step 修完后：
- 重新部署 Edge Function
- 本地启动 Worker
- MCP 浏览器走一遍对应流程
- 确认 DB 数据正确

### 阶段 2: 补全功能（P1 × 18 个）
**目标: 所有功能正常工作，无静默失败**

```
Step 2.1  简历解析失败正确返回错误码
Step 2.2  平台连接插件超时处理
Step 2.3  发现硬编码改为动态（用户偏好匹配）
Step 2.4  投递前验证 token + 连接状态
Step 2.5  Budget 检查连接状态
Step 2.6  first_contact / follow_up 实际发消息
Step 2.7  status/runtime_status 统一
Step 2.8  暂停时通知 executor
Step 2.9  各种 insert 加 error check
Step 2.10 Onboarding 答案验证
```

### 阶段 3: 加固质量（P2 × 5 个）
**目标: 生产级可靠性**

```
Step 3.1  Readiness 字段完整性验证
Step 3.2  Settings 偏好保存到后端
Step 3.3  Review 页乱码修复
Step 3.4  非 Chromium 浏览器提示
Step 3.5  健康检查暂停期 TTL 逻辑
```

---

## 五、修复验证矩阵

每修完一个 Step，用以下 checklist 验证：

| 测试项 | 验证方式 | 通过标准 |
|--------|----------|----------|
| 新用户注册 | MCP 浏览器 | 登录成功，进入 onboarding |
| 上传简历 | MCP 上传 PDF | 解析成功，profile_baseline 有数据 |
| 完成 Onboarding | MCP 点击 | team + 7 agents + ledger 各 1 条（不重复） |
| 激活团队 | MCP 点击 | 状态 → ready，无重复记录 |
| 连接 Greenhouse | MCP 点击 | platform_connection 状态 active |
| 启动团队 | MCP 点击 | runtime_status = active，Worker 日志有输出 |
| 发现岗位 | 等 Worker | opportunity 表有新记录，stage=discovered |
| 筛选岗位 | 等 Worker | stage 推进到 screened → prioritized |
| 材料生成 | 等 Worker | material 表有记录，stage → material_ready |
| 投递 | 等 Worker | submission_attempt 有记录，stage → submitted |
| 暂停团队 | MCP 点击 | runtime_status = paused，ledger 有 session_end |
| 余额耗尽 | 等 billing | 自动暂停，timeline 有事件 |
| 管理面板 | MCP 浏览 | 所有数据模块有数据 |

---

## 六、工作量估计

| 阶段 | 问题数 | 涉及文件 | 预估 |
|------|--------|----------|------|
| 阶段 1 | 12 P0 | 6 个 Edge Function + 3 个 Worker 文件 | 重 |
| 阶段 2 | 18 P1 | 8 个 Edge Function + 5 个 Worker 文件 + 1 个插件 | 重 |
| 阶段 3 | 5 P2 | 4 个前端文件 + 1 个 Edge Function | 轻 |

---

## 七、已确认的产品决策 (2026-04-06)

| 决策项 | 确认结果 |
|--------|----------|
| Free 用户运行时间 | **6 小时**，到时间自动暂停团队 |
| AI 扫描频率 | **2 小时一轮**（一天约 3 次） |
| dispatch cycle | **60 秒**（原 10 秒太频繁） |
| 材料生成失败 | **1/2 也投递**（只有简历没 Cover Letter → 直接投） |
| 英文平台简历 | **每岗精修** + 中→英翻译 + Cover Letter |
| 中文平台简历 | **一次性 AI 大修**（onboarding 时优化一次，后续批量用） |
| 跨市场用户 | 中文简历 → 英文平台翻译+精修，中文平台用优化版 |
| 公司列表 | 从 onboarding target_companies 读取 |
| first_contact / follow_up | V1 不实现消息发送 |
| Boss 直聘 | V1.1 scope（Pro plan） |
| 浏览器插件 | V1 仅 Chrome，V2 做桌面端 exe |
| 本地测试/管理员 | 不受 free plan 限制 |
