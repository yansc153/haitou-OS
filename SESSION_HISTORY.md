# 海投助手 OS — Session History

## Session 2026-04-03: Supabase 部署 + 前后端打通

### 完成事项

#### 1. Supabase 项目复用
- 从 V1 项目（千人千面投简历）复用 Supabase 实例 `rlpipofmnqveughopxud`
- DROP 掉所有 V1 表（12 个）
- 通过 SQL Editor 分 3 批执行 11 个 migration 文件（CLI db connect 因 VPN 超时）
- 25 个表 + 56 个 enum + RLS policies 全部创建成功
- 创建 Storage bucket `resumes`

#### 2. Supabase CLI + Edge Functions
- 安装 Supabase CLI v2.84.2
- `supabase link --project-ref rlpipofmnqveughopxud` 成功
- 修复 `config.toml`：移除过时的 `[project]` section，升级 `major_version` 到 17
- 部署 24 个 Edge Functions（`auth-session` 和 `auth-logout` 不需要，Supabase Auth 自带）

#### 3. GitHub OAuth
- 创建新的 GitHub OAuth App "Haitou OS"
- Callback URL: `https://rlpipofmnqveughopxud.supabase.co/auth/v1/callback`
- 在 Supabase Dashboard Auth Providers 配置 Client ID + Secret
- Google OAuth 未配置（仅 GitHub 可用）

#### 4. 前端改动
- `.env.local` 更新为真实 Supabase URL + anon key
- `middleware.ts` 移除 dev bypass paths（只保留 login/callback/landing/preview/legal）
- `resume/page.tsx` 新增 2 个字段：目标岗位 (target_roles) + 覆盖范围 (coverage_scope)
- `resume/page.tsx` + `activation/page.tsx` 添加错误显示（替代静默 catch）

#### 5. CORS 修复
- `_shared/cors.ts` 添加 `Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS`
- 重新部署全部 24 个 Edge Functions

#### 6. 端到端验证
- GitHub 登录 → auth callback 创建 user + onboarding_draft ✅
- 简历上传到 Supabase Storage ✅
- Onboarding draft 保存 5 个必填字段 ✅
- Onboarding complete 创建 Team + ProfileBaseline + SubmissionProfile + UserPreferences ✅
- Activation confirm 创建 7 个 AgentInstance + 种子 runtime balance ✅
- Readiness 页面显示真实数据 ✅

### 未完成

#### Phase 2 剩余（前后端打通）
- Home / Opportunities / Handoffs / Billing / Settings 页面仍用 mock 数据
- Platforms 页面"连接"按钮是 stub

#### Phase 3（Worker + 平台执行器）
- Fly.io Worker 部署
- 平台 Executor 真实实现
- Claude API 简历解析
- Supabase Realtime

#### Phase 4（上线准备）
- Vercel 前端部署
- Mobile 导航
- Billing 强制执行
- 5 个 Codex P1 后端 Bug 修复

### 关键配置信息
- Supabase project ref: `rlpipofmnqveughopxud`
- Supabase URL: `https://rlpipofmnqveughopxud.supabase.co`
- GitHub OAuth App: "Haitou OS"（在 github.com/settings/developers）
- Auth redirect URL: `https://rlpipofmnqveughopxud.supabase.co/auth/v1/callback`
- Site URL (Supabase Auth): 包含 `http://localhost:3000`

### 注意事项
- Supabase CLI 无法直连数据库（VPN/proxy 阻断 5432 端口），所有 DB 操作通过 SQL Editor
- Edge Functions 用 `--no-verify-jwt` 部署
- `onboarding-resume` 使用 service role key 上传到 Storage（绕过 RLS）
- `onboarding-complete` 要求 `resume_upload_status === 'processed'` AND `status === 'ready_for_activation'`
