# 海投 OS — E2E 验证清单

> 日期: 2026-04-06
> 用途: P0-P2 改动实施完成后，用 MCP Playwright 从零到一验证整个产品
> 执行方式: Claude Code + MCP Playwright 浏览器自动化
> 预计耗时: 约 30 分钟（含等待 Worker 执行）

---

## Phase 0: 环境确认

| # | 检查项 | 命令/方式 | 通过标准 |
|---|--------|----------|----------|
| 0.1 | 前端能访问 | 浏览器打开 localhost:3000 | 页面加载无报错 |
| 0.2 | Worker 运行中 | `fly status` | state=started, health=passing |
| 0.3 | Worker 日志正常 | `fly logs --no-tail \| tail -5` | 有 `[dispatch] Starting dispatch loop` |
| 0.4 | 数据库干净 | 查 team 表 | 0 条记录 |
| 0.5 | 种子数据完整 | 查 platform_definition 表 | 7 条记录 |
| 0.6 | Edge Functions 全部部署 | `./deploy.sh edge` | 28/28 成功 |
| 0.7 | TypeScript 编译 | `npx tsc --noEmit` | 无新错误 |

---

## Phase 1: 新用户注册

| # | 操作 | 预期结果 | 截图 |
|---|------|----------|------|
| 1.1 | 打开 localhost:3000 | 重定向到 /login | □ |
| 1.2 | 确认登录页内容 | 看到"拥有你的 AI 求职运营团队" | □ |
| 1.3 | 确认按钮 | Google + GitHub 两个登录按钮存在 | □ |
| 1.4 | 点击 Google 登录 | OAuth 弹窗 → 授权 → 回调 | □ |
| 1.5 | 回调后跳转 | 到达 /resume | □ |

**数据库验证:**
| 表 | 预期 |
|---|------|
| auth.users | 1 条新记录 |
| user | 1 条记录 (email, display_name) |
| onboarding_draft | 1 条 (status=resume_required) |

---

## Phase 2: Onboarding — 简历上传

| # | 操作 | 预期结果 | 截图 |
|---|------|----------|------|
| 2.1 | 确认页面标题 | "配置你的求职运营团队" | □ |
| 2.2 | 确认简历上传区 | 拖拽区域 + "拖拽简历到这里" | □ |
| 2.3 | 上传测试 PDF | 上传开始，显示进度 | □ |
| 2.4 | 等待 AI 解析 | ✅ "简历已就绪" | □ |
| 2.5 | 解析失败场景 | ⚠️ 显示错误信息（不是白屏） | □ |

**数据库验证:**
| 表 | 预期 |
|---|------|
| resume_asset | 1 条 (parse_status=parsed) |
| onboarding_draft.answered_fields._parsed_profile | 有结构化数据 |

---

## Phase 3: Onboarding — 填写配置

| # | 操作 | 预期结果 | 截图 |
|---|------|----------|------|
| 3.1 | 输入目标岗位 | "Backend Engineer, Product Manager" | □ |
| 3.2 | 选择城市 | 上海 + Remote 高亮 | □ |
| 3.3 | 选择策略 | 均衡 卡片高亮 | □ |
| 3.4 | 确认无 coverage_scope 选择 | 不应该看到"英文区/中文区/跨市场" | □ |
| 3.5 | 确认按钮可点击 | "完成配置" 按钮变为可点击（蓝色） | □ |

---

## Phase 4: Onboarding — 一键完成

| # | 操作 | 预期结果 | 截图 |
|---|------|----------|------|
| 4.1 | 点击「完成配置」 | 按钮显示 loading | □ |
| 4.2 | 等待后台完成 | 无报错，跳转到 /home | □ |
| 4.3 | 如果失败 | Toast 显示具体错误信息 | □ |

**数据库验证（最关键）:**
| 表 | 预期 | 检查 |
|---|------|------|
| team | 1 条, status=active, runtime_status=active | □ |
| agent_instance | 7 条 (每个 role 1 条) | □ |
| profile_baseline | 1 条 (有 full_name, experiences 等) | □ |
| submission_profile | 1 条 | □ |
| user_preferences | 1 条 (strategy_mode=balanced) | □ |
| runtime_ledger_entry | 2 条: allocation(21600) + session_start | □ |
| platform_connection | 2 条: greenhouse(active) + lever(active) | □ |

---

## Phase 5: 首页 — 首次价值展示

| # | 等待 | 预期结果 | 截图 |
|---|------|----------|------|
| 5.1 | 0s | 看到"AI 求职运营团队" + 7 个 Agent | □ |
| 5.2 | 0s | 右上角显示 "运行中" 绿色圆点 | □ |
| 5.3 | 0s | "暂停团队" 按钮可见 | □ |
| 5.4 | 10s | 实时动态出现: "团队已启动运行" | □ |
| 5.5 | 30s | 实时动态出现: "岗位发现" 事件 | □ |
| 5.6 | 2min | 今日运营: 岗位发现 > 0 | □ |
| 5.7 | 3min | 实时动态出现: "AI 筛选" 事件 | □ |
| 5.8 | 5min | 今日运营: AI 筛选 > 0 | □ |
| 5.9 | — | 底部引导横幅: "安装插件解锁更多平台" | □ |

**数据库验证:**
| 表 | 预期 |
|---|------|
| opportunity | 有新记录, stage=discovered/screened/prioritized |
| agent_task | 有 completed 的 discovery + screening 任务 |
| timeline_event | 有 team_started + task_completed 事件 |

---

## Phase 6: 机会中心

| # | 操作 | 预期结果 | 截图 |
|---|------|----------|------|
| 6.1 | 点击导航"机会中心" | 页面加载，显示岗位列表 | □ |
| 6.2 | 确认岗位卡片 | 公司名 + 岗位名 + 阶段标签 | □ |
| 6.3 | 点击一个岗位 | 详情面板展开 | □ |
| 6.4 | 确认 JD 内容 | 不是乱码，可读 | □ |
| 6.5 | 确认匹配度 | fit_posture 显示 | □ |
| 6.6 | 确认推荐结果 | advance/watch/drop 有值 | □ |
| 6.7 | 确认时间线 | 有筛选相关事件 | □ |

---

## Phase 7: 平台中心

| # | 操作 | 预期结果 | 截图 |
|---|------|----------|------|
| 7.1 | 点击导航"平台中心" | 页面加载 | □ |
| 7.2 | 英文平台区域 | Greenhouse ✅已连接, Lever ✅已连接 | □ |
| 7.3 | LinkedIn | 未连接 + "需要插件" 提示 | □ |
| 7.4 | 中文平台区域 | 智联/拉勾 显示 🔒 Pro | □ |
| 7.5 | 功能说明 | 每个卡片有 ✅/❌ 功能列表 | □ |
| 7.6 | 插件引导 | 顶部有安装插件横幅 | □ |
| 7.7 | 断开 Greenhouse | 状态变为"未连接" | □ |
| 7.8 | 重新连接 Greenhouse | 状态恢复"已连接" | □ |

---

## Phase 8: 暂停 / 恢复

| # | 操作 | 预期结果 | 截图 |
|---|------|----------|------|
| 8.1 | 回到首页 | 显示运行中 | □ |
| 8.2 | 点击"暂停团队" | 状态变为"已暂停" | □ |
| 8.3 | 确认不弹报错 | 无 alert/Toast 错误 | □ |
| 8.4 | 点击"启动团队" | 状态恢复"运行中" | □ |

**数据库验证:**
| 检查 | 预期 |
|------|------|
| runtime_ledger_entry | 有 session_end + 新 session_start |
| session_end 不重复 | 每个 session_start 只对应 1 个 session_end |
| balance_after_seconds | > 0 (6h 减已消耗) |

---

## Phase 9: 交接中心

| # | 操作 | 预期结果 | 截图 |
|---|------|----------|------|
| 9.1 | 点击导航"交接中心" | 页面加载无报错 | □ |
| 9.2 | 空状态 | 显示"暂无交接事项"或空列表 | □ |

---

## Phase 10: 设置页

| # | 操作 | 预期结果 | 截图 |
|---|------|----------|------|
| 10.1 | 点击头像 → 设置 | 设置页加载 | □ |
| 10.2 | 确认投递资料 | 显示 email/phone 字段 | □ |
| 10.3 | 修改电话 → 保存 | Toast: "保存成功" | □ |
| 10.4 | 刷新页面 | 电话号码持久化 | □ |

---

## Phase 11: 套餐方案

| # | 操作 | 预期结果 | 截图 |
|---|------|----------|------|
| 11.1 | 点击 "Plan" | 套餐页加载 | □ |
| 11.2 | 确认三个方案 | Free / Pro / Plus | □ |
| 11.3 | 确认当前方案 | Free 有高亮标记 | □ |
| 11.4 | 确认运行时间显示 | 剩余时间 ≈ 6h 减已消耗 | □ |

---

## Phase 12: 活动回顾

| # | 操作 | 预期结果 | 截图 |
|---|------|----------|------|
| 12.1 | 点击导航"活动回顾" | 页面加载 | □ |
| 12.2 | 确认统计数据 | 发现/筛选/投递数量 | □ |
| 12.3 | 确认建议 | 有中文建议文案 | □ |

---

## Phase 13: 管理后台

| # | 操作 | 预期结果 | 截图 |
|---|------|----------|------|
| 13.1 | 访问 /admin-login | 密码登录页 | □ |
| 13.2 | 输入密码登录 | 跳转到管理面板 | □ |
| 13.3 | 确认 KPI 数据 | 用户数=1, 团队数=1, 机会数>0 | □ |
| 13.4 | 确认用户列表 | 显示测试用户 | □ |
| 13.5 | 确认系统健康 | Worker 心跳时间（如已实现） | □ |

---

## Phase 14: 运维验证

| # | 检查项 | 命令/方式 | 通过标准 |
|---|--------|----------|----------|
| 14.1 | Worker 日志 | `fly logs` | 有 [dispatch] [sweep] [executor] 输出 |
| 14.2 | Billing 正常 | 查 runtime_ledger_entry | 不会误暂停有余额的团队 |
| 14.3 | 心跳（如已实现） | 查 timeline_event type=system_heartbeat | 5 分钟内有记录 |
| 14.4 | 部署脚本 | `./deploy.sh edge` | 28/28 成功 |
| 14.5 | TypeScript | `npx tsc --noEmit` | 无新编译错误 |
| 14.6 | Fly.io 状态 | `fly status` | started + passing |
| 14.7 | Fly.io secrets | `fly secrets list` | 4 个 secret 都在 |

---

## Phase 15: 材料 + 投递管道验证（可选 — 需要 advance 推荐）

> 此 Phase 仅在有岗位被推荐为 advance 时可验证。如果所有岗位都是 drop/watch，此步骤跳过。

| # | 检查项 | 预期 |
|---|--------|------|
| 15.1 | opportunity 有 stage=material_ready | 材料生成成功 |
| 15.2 | material 表有记录 | type=standard_tailored_resume + cover_letter |
| 15.3 | opportunity 有 stage=submitted | 投递成功 |
| 15.4 | submission_attempt 有记录 | outcome=submitted |
| 15.5 | 机会中心详情 | 材料卡片可点击预览 |

如果无法自然触发 advance，可手动插入测试数据:
```sql
-- 插入一条 discovered 的测试机会
INSERT INTO opportunity (team_id, stage, company_name, job_title, 
  job_description_text, source_platform_id, external_ref)
VALUES ('{team_id}', 'discovered', 'Test Company', 'Software Engineer',
  'We are looking for a software engineer...', '{greenhouse_id}', 'test-001');
```

---

## 验证结果汇总

```
Phase 0  环境确认:        ___/7 通过
Phase 1  新用户注册:      ___/5 通过
Phase 2  简历上传:        ___/5 通过
Phase 3  填写配置:        ___/5 通过
Phase 4  一键完成:        ___/3 通过 + ___/7 DB验证
Phase 5  首次价值展示:    ___/9 通过
Phase 6  机会中心:        ___/7 通过
Phase 7  平台中心:        ___/8 通过
Phase 8  暂停/恢复:       ___/4 通过
Phase 9  交接中心:        ___/2 通过
Phase 10 设置页:          ___/4 通过
Phase 11 套餐方案:        ___/4 通过
Phase 12 活动回顾:        ___/3 通过
Phase 13 管理后台:        ___/5 通过
Phase 14 运维验证:        ___/7 通过
Phase 15 材料+投递:       ___/5 通过（可选）

总计: ___/83 通过  |  ___/83 失败  |  ___/83 跳过
```

---

## 失败项记录模板

```
Phase: ___  Step: ___
操作: ___
预期: ___
实际: ___
截图: [文件名]
控制台错误: ___
数据库状态: ___
根因: ___
修复方案: ___
```
