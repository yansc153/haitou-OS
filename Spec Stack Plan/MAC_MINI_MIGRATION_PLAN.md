# 海投 OS — Mac Mini 全栈迁移计划

> 日期: 2026-04-06
> 状态: 计划中
> 目标: 从 Supabase + Fly.io 迁移到 Mac Mini 自托管
> 原则: 迁移不是搬代码，是简化 + 重构 + 搬迁三位一体

---

## 一、为什么迁移

| 现有问题 | 根因 | Mac Mini 如何解决 |
|----------|------|-----------------|
| VAULT 加密 key 不同步 | Deno (Edge) 和 Node (Worker) 两套 runtime | 统一 Node.js，一个 key |
| Supabase Disk IO 打爆 | Worker 每 10s 查 DB，免费实例顶不住 | 本地 PostgreSQL，SSD 无限制 |
| Playwright Docker 缺库 | Fly.io Docker 镜像缺 libXfixes | macOS 原生 Chromium |
| 28 个 Edge Function 部署慢 | 逐个 deploy，每次 2 分钟 | Next.js API Routes，`npm run build` 一次搞定 |
| 跨国延迟 | Worker(新加坡) → DB(美国) ≈ 200ms | 本地 < 1ms |
| 费用 | Fly.io + Supabase Pro 将来要付费 | 电费忽略不计 |

---

## 二、目标架构

```
Mac Mini (M1/M2/M4, macOS)
│
├── PostgreSQL 16 (brew install)
│   └── 所有 25+ 张表，本地存储
│
├── Next.js 15 (一个进程)
│   ├── 前端页面 (SSR + 静态)
│   ├── API Routes (替代 28 个 Edge Functions)
│   │   ├── /api/auth/[...nextauth] (替代 Supabase Auth)
│   │   ├── /api/home-get
│   │   ├── /api/opportunities-list
│   │   ├── /api/opportunity-detail
│   │   ├── /api/platform-connect
│   │   ├── /api/team-start
│   │   ├── /api/team-pause
│   │   └── ... (其余合并/简化后约 15 个)
│   └── WebSocket / SSE (替代 Supabase Realtime)
│
├── Worker (Node 子进程，PM2 管理)
│   ├── dispatch-loop.ts (不变)
│   ├── pipeline.ts (不变)
│   ├── executors/ (不变)
│   └── Playwright (原生 macOS Chromium)
│
├── Caddy (反向代理)
│   └── haitou.app → localhost:3000 (自动 HTTPS)
│
└── Cloudflare Tunnel (cloudflared)
    └── 公网入口，不需要固定 IP
```

---

## 三、迁移前：代码审计 + 简化

### 3.1 必须先修的 Bug

| Bug | 文件 | 描述 |
|-----|------|------|
| 漏斗计数逻辑错误 | opportunities/page.tsx | 显示"当前在该阶段"而非"经过该阶段" |
| 活动回顾乱码 | review 页面 | "需◆◆◆接管" 中文 encoding |
| 套餐页负数 | billing 页面 | "已用 -197%" |
| 英文事件未本地化 | team-pause | "Team paused by user" 应为中文 |
| Agent roster 定义 3 处 | onboarding-complete, activation-confirm, activation/page.tsx | 应该只有一处 |
| 实时动态只有"岗位发现" | home/page.tsx + home-get | 筛选/投递事件的 event_type 不在 EVENT_TYPE_ZH 映射中 |

### 3.2 可以删除的代码

| 文件/功能 | 原因 |
|-----------|------|
| supabase/functions/ (全部 28 个) | 迁移后替换为 API Routes |
| supabase/functions/_shared/ | 同上 |
| src/worker/Dockerfile | 不再需要 Docker |
| fly.toml | 不再用 Fly.io |
| deploy.sh | 重写为 Mac Mini 部署脚本 |
| app/(app)/activation/page.tsx | 已改为 redirect，可删 |
| app/(onboarding)/complete/page.tsx | 同上 |
| supabase/functions/activation-confirm/ | 逻辑已合并到 onboarding-complete |
| supabase/functions/activation-get/ | 同上 |

### 3.3 可以合并/简化的 Edge Functions

**当前 28 个 → 迁移后约 15 个 API Routes：**

| 合并方案 | 原 Edge Functions | 新 API Route |
|----------|------------------|-------------|
| Onboarding | onboarding-get, onboarding-draft, onboarding-resume, onboarding-complete | /api/onboarding (GET/PATCH/POST) |
| Team | team-start, team-pause | /api/team/[action] |
| Home | home-get | /api/home |
| Opportunities | opportunities-list, opportunity-detail, opportunity-trigger-takeover | /api/opportunities (GET) + /api/opportunities/[id] |
| Platforms | platforms-list, platform-connect, platform-disconnect, platform-reconnect, platform-health-check | /api/platforms (GET) + /api/platforms/[action] |
| Handoffs | handoffs-list, handoff-close, handoff-resolve, handoff-takeover, handoff-waiting-external | /api/handoffs (GET) + /api/handoffs/[id]/[action] |
| Settings | settings-get, settings-update, submission-profile | /api/settings (GET/PATCH) |
| Review | review-get | /api/review |
| Admin | admin-stats | /api/admin/stats |
| Readiness | readiness-get | /api/readiness |
| Auth | (新) | /api/auth/[...nextauth] |

### 3.4 重复代码统一

| 重复 | 位置 | 统一方案 |
|------|------|---------|
| vault.ts (Deno + Node 两个版本) | _shared/vault.ts + src/worker/utils/vault.ts | 只保留 Node 版本 |
| AGENT_ROSTER 定义 3 处 | onboarding-complete, activation-confirm, activation/page | 提取到 src/shared/constants.ts |
| CORS 处理 | _shared/cors.ts (每个 EF 都调) | API Routes 不需要 CORS（同源） |
| Auth 获取用户 | _shared/auth.ts (每个 EF 调 getAuthenticatedUser) | NextAuth session middleware，一行代码 |
| response 格式 | _shared/response.ts (ok/err 包装) | Next.js NextResponse 原生够用 |

---

## 四、迁移步骤（按顺序执行）

### Phase 0: Mac Mini 环境准备 (30 min)

```bash
# 1. 安装依赖
brew install postgresql@16 node@20 caddy cloudflared

# 2. 启动 PostgreSQL
brew services start postgresql@16

# 3. 创建数据库
createdb haitou_os

# 4. 运行 migrations
psql haitou_os < supabase/migrations/00001_enums.sql
psql haitou_os < supabase/migrations/00002_core_entities.sql
# ... 所有 migration 文件按顺序

# 5. 导入种子数据
psql haitou_os < supabase/migrations/00010_seed_platforms.sql

# 6. 安装 Playwright
npx playwright install chromium
```

### Phase 1: 数据库迁移 (1 hour)

1. **导出 Supabase 数据**
```bash
supabase db dump --linked --data-only > data_dump.sql
```

2. **导入到本地 PostgreSQL**
```bash
psql haitou_os < data_dump.sql
```

3. **配置连接**
```env
# .env.local
DATABASE_URL=postgresql://localhost:5432/haitou_os
```

4. **添加数据库访问层**
```
新建 src/lib/db.ts — 使用 pg 或 drizzle-orm 直连 PostgreSQL
替代 Supabase client 的所有 .from('table').select() 调用
```

### Phase 2: Auth 迁移 — Supabase Auth → NextAuth.js (2 hours)

1. **安装 NextAuth**
```bash
npm install next-auth @auth/pg-adapter
```

2. **配置 providers**
```typescript
// app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import GitHub from 'next-auth/providers/github';

export const { handlers, auth } = NextAuth({
  providers: [Google, GitHub],
  adapter: PostgresAdapter(pool),
});
```

3. **迁移用户数据**
- Supabase auth.users → NextAuth users 表
- 保留 user_id 关联

4. **替换前端 auth 调用**
- `supabase.auth.getSession()` → `auth()` (NextAuth)
- `supabase.auth.getUser()` → `auth()` 
- Login 页面用 `signIn('google')` 替代

### Phase 3: Edge Functions → API Routes (3 hours)

**逐个迁移，每个步骤：**
1. 读 Edge Function 代码
2. 创建对应 API Route
3. 把 `supabase.from('table')` 替换为直接 SQL 查询
4. 去掉 CORS 处理（同源不需要）
5. 去掉 `getAuthenticatedUser()` → 用 NextAuth `auth()` middleware

**示例迁移（home-get）：**

```typescript
// 之前: supabase/functions/home-get/index.ts (Deno)
serve(async (req) => {
  const { user, error, supabase } = await getAuthenticatedUser(req);
  const { data: team } = await supabase.from('team').select('*').eq('user_id', user.id).single();
  // ...
});

// 之后: app/api/home/route.ts (Next.js)
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  
  const team = await db.query('SELECT * FROM team WHERE user_id = $1', [session.user.id]);
  // ...
}
```

### Phase 4: Worker 本地化 (1 hour)

1. **去掉 Docker**
- 删除 src/worker/Dockerfile
- 删除 fly.toml

2. **直连本地 PostgreSQL**
```typescript
// src/worker/index.ts
// 之前: createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
// 之后: new Pool({ connectionString: DATABASE_URL })
```

3. **去掉 vault 加密**（同一台机器不需要加密 cookies）
```typescript
// session_token_ref 直接明文存储（本地 DB，不经网络）
// 或保留加密但统一一个 vault.ts
```

4. **PM2 进程管理**
```bash
npm install -g pm2
pm2 start dist/worker/index.js --name haitou-worker
pm2 start npm --name haitou-web -- run start
pm2 save
pm2 startup
```

### Phase 5: Realtime 替代 (1 hour)

替换 Supabase Realtime 订阅：

**方案 A: Server-Sent Events (SSE) — 最简单**
```typescript
// app/api/events/route.ts
export async function GET() {
  const stream = new ReadableStream({
    start(controller) {
      // 监听 PostgreSQL NOTIFY
      // 推送到客户端
    }
  });
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream' }
  });
}
```

**方案 B: 轮询 — 最最简单（V1 够用）**
```typescript
// 前端每 10s 调 /api/home 刷新数据
// 零额外代码
```

### Phase 6: Cloudflare Tunnel + Caddy (30 min)

```bash
# 1. Caddy 配置
cat > /etc/caddy/Caddyfile << 'EOF'
haitou.app {
  reverse_proxy localhost:3000
}
EOF
brew services start caddy

# 2. Cloudflare Tunnel
cloudflared tunnel create haitou
cloudflared tunnel route dns haitou haitou.app
cloudflared tunnel run haitou
```

### Phase 7: 前端更新 (1 hour)

1. **替换所有 Supabase 客户端调用**
```typescript
// 之前
const res = await fetch(`${SUPABASE_URL}/functions/v1/home-get`, {
  headers: { Authorization: `Bearer ${session.access_token}` }
});

// 之后
const res = await fetch('/api/home');
// NextAuth 自动带 cookie，不需要手动传 token
```

2. **替换 Realtime hook**
```typescript
// 之前: useTimelineFeed() — Supabase channel subscription
// 之后: useEffect + setInterval 轮询 /api/home（V1 够用）
```

3. **删除 Supabase 客户端依赖**
```bash
npm uninstall @supabase/supabase-js @supabase/ssr
```

---

## 五、迁移后删除的文件

```
删除:
├── supabase/functions/          (28 个 Edge Functions)
├── supabase/config.toml         (Supabase 本地配置)
├── src/worker/Dockerfile
├── fly.toml
├── deploy.sh                    (重写)
├── lib/supabase/                (client.ts, server.ts, middleware.ts)
├── .env.worker                  (合并到 .env.local)

保留/改造:
├── supabase/migrations/         (SQL schema，继续用)
├── src/worker/                  (逻辑不变，改 DB 连接方式)
├── src/shared/                  (enums, types, state-machines)
├── app/                         (前端页面，改 API 调用)
├── components/                  (UI 组件，不变)
```

---

## 六、验证清单（迁移完成后）

用 MCP Playwright 在浏览器验证每一项：

| # | 验证项 | 方法 |
|---|--------|------|
| 1 | 首页加载 | 打开 haitou.app → 看到登录页 |
| 2 | Google 登录 | 点击 Google → OAuth → 回到 /resume |
| 3 | 上传简历 → 完成配置 | 走完 onboarding |
| 4 | 首页显示 7 Agent | /home 加载正常 |
| 5 | Worker 发现岗位 | 等 60s → 首页出现"岗位发现"事件 |
| 6 | 机会中心有岗位 | /opportunities 有数据 |
| 7 | 岗位详情有 JD | 点击岗位 → 看到职位描述 |
| 8 | 平台中心连接正常 | 7 个平台都可以连接 |
| 9 | 暂停/恢复团队 | 点击暂停 → 恢复 → 无报错 |
| 10 | 管理后台 | /admin-login → 看到数据 |

---

## 七、时间估计

| Phase | 内容 | 时间 |
|-------|------|------|
| 0 | Mac Mini 环境准备 | 30 min |
| 1 | 数据库迁移 | 1 hour |
| 2 | Auth 迁移 (NextAuth) | 2 hours |
| 3 | 28 EF → API Routes | 3 hours |
| 4 | Worker 本地化 | 1 hour |
| 5 | Realtime 替代 | 1 hour |
| 6 | Tunnel + Caddy | 30 min |
| 7 | 前端更新 | 1 hour |
| **总计** | | **~10 hours** |

---

## 八、回退方案

迁移期间 Supabase + Fly.io 不关停。如果 Mac Mini 出问题：
1. DNS 切回 Supabase/Vercel
2. Worker 在 Fly.io 重启
3. 数据双写期间两边都有

确认 Mac Mini 稳定运行 7 天后，关闭 Supabase 和 Fly.io。
