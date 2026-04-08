'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getValidSession } from '@/lib/hooks/use-api';
import { AnimatedContent } from '@/components/ui/animated-content';
import { SpotlightCard } from '@/components/ui/spotlight-card';
import Link from 'next/link';

// Chrome extension API types (only used for bridge communication)
declare const chrome: {
  runtime?: {
    sendMessage: (extensionId: string, message: unknown, callback: (response: unknown) => void) => void;
    lastError?: { message: string };
  };
} | undefined;

type BridgeResponse = { installed?: boolean; cookies?: string | null; needsLogin?: boolean; error?: string };

function sendBridgeMessage(msg: Record<string, unknown>): Promise<BridgeResponse> {
  return new Promise(resolve => {
    // Evaluate at call time, not module load (avoids SSR evaluation)
    const extId = process.env.NEXT_PUBLIC_BRIDGE_EXTENSION_ID || '';
    if (!extId || typeof chrome === 'undefined' || !chrome?.runtime?.sendMessage) {
      resolve({ error: 'no_extension' });
      return;
    }
    try {
      chrome.runtime.sendMessage(extId, msg, (response) => {
        if (chrome?.runtime?.lastError) {
          resolve({ error: 'not_installed' });
        } else {
          resolve((response as BridgeResponse) || { error: 'empty_response' });
        }
      });
    } catch {
      resolve({ error: 'not_installed' });
    }
  });
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string; dot: string }> = {
  active: { bg: 'bg-status-active/10', text: 'text-status-active', label: '已连接', dot: 'bg-status-active' },
  available_unconnected: { bg: 'bg-muted-foreground/10', text: 'text-muted-foreground', label: '未连接', dot: 'bg-muted-foreground/30' },
  pending_login: { bg: 'bg-status-info/10', text: 'text-status-info', label: '连接中', dot: 'bg-status-info' },
  session_expired: { bg: 'bg-status-warning/10', text: 'text-status-warning', label: '已过期', dot: 'bg-status-warning' },
  plan_locked: { bg: 'bg-accent/15', text: 'text-accent', label: '需升级', dot: 'bg-accent' },
};

/** Platform metadata — user-facing descriptions, features, logos */
const PLATFORM_META: Record<string, {
  logo: string; tagline: string;
  features: string[]; limits: string; needsPlugin: boolean;
}> = {
  greenhouse: {
    logo: '🏢', tagline: '英文 ATS 门户 · 海外科技公司首选',
    features: ['自动搜索岗位', 'AI 定制简历', '自动表单投递'],
    limits: '每日最多 30 次投递', needsPlugin: false,
  },
  lever: {
    logo: '⚡', tagline: '英文 ATS 门户 · 快速增长公司常用',
    features: ['自动搜索岗位', 'AI 定制简历', '自动表单投递'],
    limits: '每日最多 30 次投递', needsPlugin: false,
  },
  linkedin: {
    logo: '💼', tagline: '全球最大职业社交网络',
    features: ['自动搜索岗位', 'AI 定制简历', 'Easy Apply 一键投递', '消息跟进'],
    limits: '每日 15 次投递 · 10 条消息', needsPlugin: true,
  },
  zhaopin: {
    logo: '🔵', tagline: '中国主流招聘平台',
    features: ['自动搜索岗位', '一键批量投递'],
    limits: '每日最多 30 次投递', needsPlugin: true,
  },
  lagou: {
    logo: '🟢', tagline: '互联网行业垂直招聘',
    features: ['自动搜索岗位', '一键批量投递'],
    limits: '每日最多 30 次投递', needsPlugin: true,
  },
  boss_zhipin: {
    logo: '💬', tagline: '移动端直聊招聘 · 中国最活跃平台',
    features: ['自动搜索岗位', '批量投递', '自动打招呼', 'AI 对话跟进', '面试信号检测'],
    limits: '每日 10 次投递 · 10 条消息', needsPlugin: true,
  },
  liepin: {
    logo: '🦁', tagline: '中高端人才招聘',
    features: ['自动搜索岗位', '一键批量投递'],
    limits: '每日最多 20 次投递', needsPlugin: true,
  },
};

type PlatformEntry = {
  platform_id: string; code: string; display_name: string; display_name_zh: string;
  pipeline_mode: string; anti_scraping_level: string; min_plan_tier: string;
  connection_id: string | null; connection_status: string; capability_status: Record<string, string> | null;
  session_expires_at: string | null; session_granted_at: string | null;
  failure_reason: string | null;
};

function getExpiryWarning(p: PlatformEntry): { expiring: boolean; remainingMinutes: number } {
  if (p.connection_status !== 'active' || !p.session_expires_at || !p.session_granted_at) {
    return { expiring: false, remainingMinutes: 0 };
  }
  const expires = new Date(p.session_expires_at).getTime();
  const granted = new Date(p.session_granted_at).getTime();
  const now = Date.now();
  const totalTTL = expires - granted;
  const remaining = expires - now;
  return {
    expiring: remaining > 0 && remaining < totalTTL * 0.2,
    remainingMinutes: Math.max(0, Math.round(remaining / (1000 * 60))),
  };
}

const EMPTY_PLATFORMS: { global_english: PlatformEntry[]; china: PlatformEntry[] } = {
  global_english: [],
  china: [],
};

// Platforms that don't need cookie auth (use ephemeral browser or public API)
const NO_COOKIE_PLATFORMS = ['greenhouse', 'lever'];

export default function PlatformsPage() {
  const [groups, setGroups] = useState<{ global_english: PlatformEntry[]; china: PlatformEntry[] }>(EMPTY_PLATFORMS);
  const [bridgeInstalled, setBridgeInstalled] = useState<boolean | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [connectingState, setConnectingState] = useState<Record<string, string>>({});
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  const reload = useCallback(async () => {
    try {
      const session = await getValidSession(supabase);
      if (!session) return;
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/platforms-list`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (json.data) setGroups(json.data);
    } catch (e) { console.error('[platforms]', e); }
  }, [supabase]);

  useEffect(() => {
    reload();
    // Check bridge extension
    sendBridgeMessage({ action: 'checkInstalled' }).then(r => {
      setBridgeInstalled(!!r.installed);
    });
  }, [reload]);

  const connectPlatform = useCallback(async (platformCode: string) => {
    setConnecting(platformCode);
    setConnectingState(s => ({ ...s, [platformCode]: '准备中...' }));
    try {
      const { data: { session }, error: sessionErr } = await supabase.auth.refreshSession();
      if (sessionErr || !session) {
        alert('登录已过期，请重新登录');
        return;
      }

      // Greenhouse/Lever don't need cookies — connect directly
      if (NO_COOKIE_PLATFORMS.includes(platformCode)) {
        const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/platform-connect`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ platform_code: platformCode, session_token: 'none', consent_scope: 'apply_only' }),
        });
        if (res.ok) { await reload(); } else {
          const json = await res.json();
          alert(`连接失败: ${json.message || json.error?.message || JSON.stringify(json)}`);
        }
        return;
      }

      // Step 0: Check extension version
      const versionCheck = await sendBridgeMessage({ action: 'checkInstalled' });
      const extVersion = (versionCheck as { bridgeVersion?: string }).bridgeVersion || '未知';

      // Cookie-based platforms:
      // Step 1: Read cookies from browser
      setConnectingState(s => ({ ...s, [platformCode]: '[1/3] 读取浏览器 Cookie...' }));
      const cookieCheck = await sendBridgeMessage({ action: 'getCookies', platform: platformCode });
      const debug = (cookieCheck as { debug?: Record<string, unknown> }).debug;

      let cookies: string | null = null;

      if (cookieCheck.cookies) {
        cookies = cookieCheck.cookies as string;
        const parsed = JSON.parse(cookies);
        setConnectingState(s => ({ ...s, [platformCode]: `[1/3] 找到 ${parsed.length} 个 Cookie ✓` }));
      } else {
        // Build detailed diagnostic message
        const debugStr = debug
          ? `\n\n诊断详情 (插件 v${extVersion}):\n` +
            `各域名 Cookie 数: ${JSON.stringify(debug.domains || {})}\n` +
            `原始总数: ${debug.totalRaw || 0}\n` +
            `过滤后: ${debug.totalAfterFilter || 0}\n` +
            `有效: ${debug.validCount ?? '?'}\n` +
            (debug.missingKeyCookies ? `缺少关键Cookie: ${JSON.stringify(debug.missingKeyCookies)}\n` : '') +
            (debug.allExpired ? '所有Cookie已过期\n' : '') +
            (debug.keyCookiesFound ? `找到的关键Cookie: ${JSON.stringify(debug.keyCookiesFound)}` : '')
          : `\n\n(插件版本: ${extVersion} — 无诊断数据，请重载插件到 v1.1.0)`;

        alert(
          `${platformCode} 连接诊断\n\n` +
          `❌ 步骤1: 读取浏览器 Cookie 失败\n` +
          `原因: ${cookieCheck.needsLogin ? '浏览器中未检测到登录信息' : cookieCheck.error || '未知'}` +
          debugStr +
          `\n\n解决方法:\n` +
          `1. 在本浏览器中打开该平台网站，确认已登录\n` +
          `2. chrome://extensions → 找到海投助手 → 点 🔄 刷新\n` +
          `3. 确认插件版本变为 1.1.0（当前: ${extVersion}）\n` +
          `4. 回到此页面重新点击连接`
        );
        return;
      }

      // Step 2: Upload cookies to backend
      setConnectingState(s => ({ ...s, [platformCode]: '[2/3] 上传凭据...' }));
      console.log(`[connect] ${platformCode}: Step 2 — uploading cookies`);
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/platform-connect`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          platform_code: platformCode,
          session_token: cookies,
          consent_scope: 'apply_and_message',
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        const msg = json.message || json.error?.message || JSON.stringify(json);
        console.error(`[connect] ${platformCode}: upload failed:`, json);
        alert(`${platformCode} 连接诊断\n\n✓ 步骤1: Cookie 读取成功\n❌ 步骤2: 上传失败\n原因: ${msg}`);
        return;
      }

      // Step 3: Done
      const connectJson = await res.json();
      console.log(`[connect] ${platformCode}: Step 3 — success:`, connectJson);
      setConnectingState(s => ({ ...s, [platformCode]: '[3/3] 连接成功 ✓' }));
      await reload();
    } finally {
      setConnecting(null);
      setConnectingState(s => { const n = { ...s }; delete n[platformCode]; return n; });
    }
  }, [supabase, reload]);

  return (
    <div>
      <h1 className="text-4xl font-display font-extrabold tracking-tight mb-2">平台中心</h1>
      <p className="text-sm text-muted-foreground mb-4">管理你的招聘平台连接状态和运行健康度</p>

      {/* Bridge install banner */}
      {bridgeInstalled === false && (
        <div className="rounded-xl border border-secondary/30 bg-secondary/5 p-4 mb-8 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold">安装海投助手浏览器插件</p>
            <p className="text-xs text-muted-foreground mt-0.5">一键连接求职平台，无需手动操作</p>
          </div>
          <button
            onClick={() => setShowInstallGuide(true)}
            className="px-4 py-2 bg-secondary text-white rounded-lg text-xs font-bold hover:opacity-90 shrink-0"
          >
            安装插件
          </button>
        </div>
      )}

      {/* Install guide modal */}
      {showInstallGuide && <InstallGuideModal onClose={() => setShowInstallGuide(false)} />}

      <div className="space-y-12">
        <PlatformGroup
          title="英文平台"
          subtitle="定制投递 · 每个岗位生成专属简历和求职信"
          platforms={groups.global_english}
          onConnect={connectPlatform}
          connecting={connecting}
          bridgeInstalled={bridgeInstalled}
          connectingState={connectingState}
          onShowInstallGuide={() => setShowInstallGuide(true)}
        />
        <PlatformGroup
          title="中文平台"
          subtitle="直投模式 · 原始简历快速覆盖，速度优先"
          platforms={groups.china}
          onConnect={connectPlatform}
          connecting={connecting}
          connectingState={connectingState}
          bridgeInstalled={bridgeInstalled}
          onShowInstallGuide={() => setShowInstallGuide(true)}
        />
      </div>
    </div>
  );
}

function PlatformGroup({ title, subtitle, platforms, onConnect, connecting, connectingState, bridgeInstalled, onShowInstallGuide }: {
  title: string; subtitle: string; platforms: PlatformEntry[];
  onConnect: (code: string) => void; connecting: string | null; connectingState: Record<string, string>; bridgeInstalled: boolean | null;
  onShowInstallGuide: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  return (
    <div>
      <h2 className="text-xl font-display font-bold mb-1">{title}</h2>
      <p className="text-xs text-muted-foreground mb-5">{subtitle}</p>
      <div className="grid md:grid-cols-2 gap-5">
        {platforms.map((p, i) => {
          const expiry = getExpiryWarning(p);
          const status = STATUS_STYLES[p.connection_status] || STATUS_STYLES.available_unconnected;
          const meta = PLATFORM_META[p.code] || { logo: '🌐', tagline: '', features: [], limits: '', needsPlugin: true };
          const isConnected = p.connection_status === 'active';

          return (
            <AnimatedContent key={p.platform_id} delay={i * 0.05}>
              <SpotlightCard className={`surface-card p-0 overflow-hidden ${expiry.expiring ? 'ring-2 ring-status-warning/40' : isConnected ? 'ring-1 ring-status-active/20' : ''}`}>
                {/* Header bar */}
                <div className={`px-6 pt-5 pb-4 ${isConnected ? 'bg-status-active/5' : ''}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-surface-low flex items-center justify-center text-2xl">{meta.logo}</div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-display font-bold">{p.display_name_zh !== p.display_name ? p.display_name_zh : p.display_name}</h3>
                          {p.display_name_zh !== p.display_name && (
                            <span className="text-xs text-muted-foreground">{p.display_name}</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{meta.tagline}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${status.dot}`} />
                      <span className={`text-xs font-bold ${status.text}`}>{status.label}</span>
                    </div>
                  </div>
                </div>

                {/* Features */}
                <div className="px-6 py-4 border-t border-border/10">
                  <div className="space-y-2">
                    {meta.features.map((f) => (
                      <div key={f} className="flex items-center gap-2 text-sm">
                        <span className={isConnected ? 'text-status-active' : 'text-muted-foreground/40'}>✓</span>
                        <span className={isConnected ? '' : 'text-muted-foreground'}>{f}</span>
                      </div>
                    ))}
                  </div>
                  {meta.limits && (
                    <p className="text-[10px] text-muted-foreground/50 mt-3">{meta.limits}</p>
                  )}
                </div>

                {/* Action bar */}
                <div className="px-6 py-3 border-t border-border/10 bg-surface-low/50 flex items-center justify-between">
                  {meta.needsPlugin && !bridgeInstalled && !isConnected && (
                    <span className="text-[10px] text-muted-foreground">需要浏览器插件</span>
                  )}
                  {!meta.needsPlugin && !isConnected && (
                    <span className="text-[10px] text-status-active">无需插件 · 自动连接</span>
                  )}
                  {isConnected && !expiry.expiring && (
                    <span className="text-[10px] text-status-active">运行中</span>
                  )}
                  {isConnected && expiry.expiring && (
                    <span className="text-[10px] text-status-warning font-bold">
                      即将过期 · 剩余 {expiry.remainingMinutes} 分钟
                    </span>
                  )}
                  {p.connection_status === 'plan_locked' && (
                    <span className="text-[10px] text-accent">需要升级套餐</span>
                  )}
                  {(p.connection_status === 'session_expired') && (
                    <div className="text-[10px] text-status-warning space-y-0.5">
                      <span>登录已过期，请重新连接</span>
                      {(p as unknown as { failure_reason?: string }).failure_reason && (
                        <span className="block text-muted-foreground">{(p as unknown as { failure_reason?: string }).failure_reason}</span>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2">
                    {p.connection_status === 'available_unconnected' && (
                      <button
                        onClick={() => (bridgeInstalled || NO_COOKIE_PLATFORMS.includes(p.code)) ? onConnect(p.code) : onShowInstallGuide()}
                        disabled={connecting === p.code}
                        className="px-5 py-2 bg-foreground text-background rounded-lg text-xs font-bold hover:opacity-90 disabled:opacity-50"
                      >
                        {connecting === p.code ? (connectingState[p.code] || '连接中...') : '连接'}
                      </button>
                    )}
                    {p.connection_status === 'session_expired' && (
                      <button
                        onClick={() => (bridgeInstalled || NO_COOKIE_PLATFORMS.includes(p.code)) ? onConnect(p.code) : onShowInstallGuide()}
                        disabled={connecting === p.code}
                        className="px-5 py-2 bg-status-warning text-white rounded-lg text-xs font-bold hover:opacity-90 disabled:opacity-50"
                      >
                        {connecting === p.code ? (connectingState[p.code] || '重连中...') : '重新连接'}
                      </button>
                    )}
                    {isConnected && p.connection_id && (
                      <button
                        onClick={async () => {
                          const session = await getValidSession(supabase);
                          if (!session) return;
                          await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/platform-disconnect`, {
                            method: 'POST',
                            headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ connection_id: p.connection_id }),
                          });
                          window.location.reload();
                        }}
                        className="px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-surface-low"
                      >
                        断开连接
                      </button>
                    )}
                    {p.connection_status === 'plan_locked' && (
                      <Link href="/billing" className="px-5 py-2 bg-accent/15 text-accent rounded-lg text-xs font-bold hover:opacity-90">
                        升级解锁
                      </Link>
                    )}
                  </div>
                </div>
              </SpotlightCard>
            </AnimatedContent>
          );
        })}
      </div>
    </div>
  );
}

const INSTALL_STEPS = [
  {
    num: '01',
    title: '下载插件包',
    desc: '点击下方按钮下载「海投助手 Browser Bridge」插件压缩包，解压到电脑上任意位置（记住这个文件夹路径）。',
    tip: '仅支持 Chrome 和 Edge 浏览器（Chromium 内核）',
    hasDownload: true,
  },
  {
    num: '02',
    title: '打开 Chrome 扩展管理页',
    desc: '在 Chrome 地址栏输入 chrome://extensions 并回车，然后打开右上角的「开发者模式」开关。',
    visual: '┌──────────────────────────────────────┐\n│  chrome://extensions                  │\n│                                       │\n│              开发者模式 [■ ON]  ← 打开 │\n│                                       │\n│  ┌────────────────────┐               │\n│  │ 加载已解压的扩展程序 │  ← 下一步点这 │\n│  └────────────────────┘               │\n└──────────────────────────────────────┘',
  },
  {
    num: '03',
    title: '加载插件文件夹',
    desc: '点击「加载已解压的扩展程序」，选择刚才解压的 extension 文件夹。看到「海投助手 Browser Bridge」卡片出现即安装成功。',
    visual: '┌──────────────────────────────────────┐\n│  🧩 海投助手 Browser Bridge   v1.0.0  │\n│     一键连接求职平台                   │\n│     ID: abcdef1234567890              │\n│                                ✅ 已启用│\n└──────────────────────────────────────┘',
  },
  {
    num: '04',
    title: '回到海投助手，连接平台',
    desc: '安装完成后，回到本页面点击「刷新页面」。插件横幅会消失，你可以直接点击 LinkedIn、智联等平台的「连接」按钮。',
    tip: '连接前请确保你已经在浏览器中登录了对应的招聘平台',
  },
];

function InstallGuideModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-background rounded-2xl shadow-lifted max-w-lg w-full max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 bg-background rounded-t-2xl border-b border-border/20 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-display font-bold">安装浏览器插件</h2>
            <p className="text-xs text-muted-foreground mt-0.5">连接 LinkedIn 和中文招聘平台</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-surface-low flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">✕</button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {INSTALL_STEPS.map((step) => (
            <div key={step.num} className="flex gap-4">
              <div className="shrink-0 w-8 h-8 rounded-full bg-secondary/15 text-secondary flex items-center justify-center text-xs font-bold">{step.num}</div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold mb-1">{step.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
                {step.visual && (
                  <pre className="mt-2 p-3 bg-surface-low rounded-lg text-[10px] text-muted-foreground overflow-x-auto font-mono leading-snug">{step.visual}</pre>
                )}
                {step.tip && (
                  <div className="mt-2 flex items-center gap-1 text-[10px] text-secondary">
                    <span>💡</span>
                    <span>{step.tip}</span>
                  </div>
                )}
                {step.hasDownload && (
                  <a
                    href="/haitou-bridge-extension.zip"
                    download
                    className="inline-block mt-3 px-4 py-2 bg-secondary text-white rounded-lg text-xs font-bold hover:opacity-90"
                  >
                    下载插件包 (.zip)
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="sticky bottom-0 bg-background rounded-b-2xl border-t border-border/20 px-6 py-4 flex items-center justify-between">
          <div className="text-[10px] text-muted-foreground">
            安装遇到问题？联系 support@haitou.ai
          </div>
          <button
            onClick={() => { onClose(); window.location.reload(); }}
            className="px-4 py-2 bg-foreground text-background rounded-lg text-xs font-bold hover:opacity-90"
          >
            我已安装，刷新页面
          </button>
        </div>
      </div>
    </div>
  );
}
