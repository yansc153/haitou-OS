'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatedContent } from '@/components/ui/animated-content';
import { checkExtensionInstalled, getCookiesForPlatform, onExtensionReady, requestExtensionCheck } from '@/lib/bridge';
import { PLATFORM_META, PLATFORM_ORDER, NO_COOKIE_PLATFORMS, STATUS_STYLES, type PlatformEntry } from '@/lib/platform-meta';

export default function ExtensionPage() {
  const router = useRouter();

  // Section 1: Download
  const [downloaded, setDownloaded] = useState(false);

  // Section 2: Install
  const [extensionInstalled, setExtensionInstalled] = useState(false);
  const [extensionVersion, setExtensionVersion] = useState('');
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState(false);

  // Section 3: Connect
  const [platforms, setPlatforms] = useState<PlatformEntry[]>([]);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [connectStatus, setConnectStatus] = useState<Record<string, string>>({});

  // Navigation
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Detect extension via content script event + polling fallback
  useEffect(() => {
    if (extensionInstalled) return;

    // Listen for content script broadcast (instant detection)
    const cleanup = onExtensionReady((extId) => {
      setExtensionInstalled(true);
      setExtensionVersion(extId ? '' : '');
    });

    // Also poll as fallback
    const poll = async () => {
      requestExtensionCheck();
      const { installed, version } = await checkExtensionInstalled();
      if (installed) {
        setExtensionInstalled(true);
        if (version) setExtensionVersion(version);
      }
    };
    poll();
    const interval = setInterval(poll, 2000);

    return () => { cleanup(); clearInterval(interval); };
  }, [extensionInstalled]);

  // Load platform statuses
  const loadPlatforms = useCallback(async () => {
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const { getValidSession } = await import('@/lib/hooks/use-api');
      const supabase = createClient();
      const session = await getValidSession(supabase);
      if (!session) return;

      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/platforms-list`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (json.data) {
        const all = [...(json.data.global_english || []), ...(json.data.china || [])];
        setPlatforms(all as PlatformEntry[]);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadPlatforms(); }, [loadPlatforms]);

  // Copy chrome://extensions to clipboard
  const handleCopy = () => {
    navigator.clipboard.writeText('chrome://extensions').then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Check extension manually
  const handleCheckExtension = async () => {
    setChecking(true);
    const { installed, version } = await checkExtensionInstalled();
    setExtensionInstalled(installed);
    if (version) setExtensionVersion(version);
    setChecking(false);
  };

  // Connect a platform
  const handleConnect = async (platformCode: string) => {
    setConnecting(platformCode);
    setConnectStatus(s => ({ ...s, [platformCode]: '读取 Cookie...' }));
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const { getValidSession } = await import('@/lib/hooks/use-api');
      const supabase = createClient();
      const session = await getValidSession(supabase);
      if (!session) { setConnecting(null); return; }

      // Step 1: Get cookies from extension
      const cookieRes = await getCookiesForPlatform(platformCode);
      if (cookieRes.error || cookieRes.needsLogin) {
        const msg = cookieRes.needsLogin
          ? `请先在浏览器中登录 ${PLATFORM_META[platformCode]?.displayName || platformCode}`
          : `读取 Cookie 失败: ${cookieRes.error}`;
        setConnectStatus(s => ({ ...s, [platformCode]: msg }));
        setConnecting(null);
        return;
      }

      // Step 2: Send to platform-connect API
      setConnectStatus(s => ({ ...s, [platformCode]: '连接中...' }));
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/platform-connect`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform_code: platformCode,
          session_token: cookieRes.cookies,
          consent_scope: 'apply_and_message',
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setConnectStatus(s => ({ ...s, [platformCode]: `连接失败: ${json.error?.message || res.status}` }));
      } else {
        setConnectStatus(s => ({ ...s, [platformCode]: '已连接 ✓' }));
        await loadPlatforms(); // Refresh all statuses
      }
    } catch (e) {
      setConnectStatus(s => ({ ...s, [platformCode]: `错误: ${(e as Error).message}` }));
    }
    setConnecting(null);
  };

  // Navigate to next step
  const handleNext = async (skipped: boolean) => {
    setSubmitting(true);
    setError('');
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const { getValidSession } = await import('@/lib/hooks/use-api');
      const supabase = createClient();
      const session = await getValidSession(supabase);
      if (!session) { setError('请先登录'); setSubmitting(false); return; }

      await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/onboarding-draft`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: {
            extension_step: skipped ? 'skipped' : 'completed',
            extension_installed: extensionInstalled,
            current_step: 3,
          },
        }),
      });
      router.push('/activation');
    } catch (e) {
      setError(`请求失败: ${(e as Error).message}`);
      setSubmitting(false);
    }
  };

  const connectedCount = platforms.filter(p => p.connection_status === 'active').length;

  return (
    <div className="max-w-[900px] mx-auto">
      <AnimatedContent>
        <div className="text-center mb-10">
          <p className="text-xs font-label uppercase tracking-[0.2em] text-secondary font-semibold mb-3">STEP 03 / 04</p>
          <h1 className="text-4xl lg:text-5xl font-display font-extrabold leading-tight tracking-tight">
            安装浏览器插件
          </h1>
          <p className="text-base text-muted-foreground mt-3 max-w-xl mx-auto">
            插件让团队能安全读取你的平台登录状态，解锁 LinkedIn 和中文招聘平台。
          </p>
        </div>
      </AnimatedContent>

      {/* ── Section 1: 下载插件 ── */}
      <AnimatedContent delay={0.05}>
        <div className="bg-card rounded-2xl p-8 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded-full bg-foreground text-background flex items-center justify-center text-sm font-bold">1</div>
            <div>
              <h2 className="text-lg font-display font-bold">下载插件</h2>
              <p className="text-sm text-muted-foreground">下载海投 OS 浏览器扩展包</p>
            </div>
            {downloaded && <span className="ml-auto text-status-active font-bold text-sm">已下载 ✓</span>}
          </div>
          <a
            href="/haitou-extension.zip"
            download="haitou-extension.zip"
            onClick={() => setDownloaded(true)}
            className="inline-flex items-center gap-2 bg-foreground text-background rounded-xl py-3 px-6 font-bold text-sm hover:opacity-90 transition-opacity"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            下载 Chrome 插件
          </a>
        </div>
      </AnimatedContent>

      {/* ── Section 2: 安装到浏览器 ── */}
      <AnimatedContent delay={0.1}>
        <div className="bg-card rounded-2xl p-8 mb-6">
          <div className="flex items-center gap-4 mb-6">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${extensionInstalled ? 'bg-status-active text-white' : 'bg-foreground text-background'}`}>
              {extensionInstalled ? '✓' : '2'}
            </div>
            <div>
              <h2 className="text-lg font-display font-bold">安装到浏览器</h2>
              <p className="text-sm text-muted-foreground">
                {extensionInstalled ? `已检测到插件${extensionVersion ? ` v${extensionVersion}` : ''}` : '按以下步骤安装扩展'}
              </p>
            </div>
            {extensionInstalled && <span className="ml-auto text-status-active font-bold text-sm">已安装 ✓</span>}
          </div>

          {!extensionInstalled && (
            <div className="space-y-4 mb-6">
              {/* Sub-step A */}
              <div className="flex items-start gap-4 bg-surface-low rounded-xl p-4">
                <span className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">A</span>
                <div>
                  <p className="text-sm font-medium">复制以下地址，粘贴到 Chrome 地址栏打开</p>
                  <div className="flex items-center gap-2 mt-2">
                    <code className="bg-muted px-3 py-1.5 rounded-lg text-sm font-mono">chrome://extensions</code>
                    <button onClick={handleCopy} className="text-xs bg-foreground text-background px-3 py-1.5 rounded-lg font-bold hover:opacity-90">
                      {copied ? '已复制 ✓' : '复制'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Sub-step B */}
              <div className="flex items-start gap-4 bg-surface-low rounded-xl p-4">
                <span className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">B</span>
                <div>
                  <p className="text-sm font-medium">打开右上角 <strong>「开发者模式」</strong> 开关</p>
                  <p className="text-xs text-muted-foreground mt-1">页面右上角的 toggle 开关</p>
                </div>
              </div>

              {/* Sub-step C */}
              <div className="flex items-start gap-4 bg-surface-low rounded-xl p-4">
                <span className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">C</span>
                <div>
                  <p className="text-sm font-medium">点击 <strong>「加载已解压的扩展程序」</strong></p>
                  <p className="text-xs text-muted-foreground mt-1">选择下载并解压后的 extension 文件夹</p>
                </div>
              </div>
            </div>
          )}

          {!extensionInstalled && (
            <button
              onClick={handleCheckExtension}
              disabled={checking}
              className="text-sm font-medium text-secondary hover:text-foreground transition-colors disabled:opacity-50"
            >
              {checking ? '检测中...' : '🔄 手动检测插件'}
            </button>
          )}
        </div>
      </AnimatedContent>

      {/* ── Section 3: 连接平台 ── */}
      <AnimatedContent delay={0.15}>
        <div className="bg-card rounded-2xl p-8 mb-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-10 h-10 rounded-full bg-foreground text-background flex items-center justify-center text-sm font-bold">3</div>
            <div>
              <h2 className="text-lg font-display font-bold">连接平台</h2>
              <p className="text-sm text-muted-foreground">已连接 {connectedCount} / {PLATFORM_ORDER.length} 个平台</p>
            </div>
          </div>

          {/* Platform grid */}
          <div className="grid md:grid-cols-2 gap-3">
            {PLATFORM_ORDER.map(code => {
              const meta = PLATFORM_META[code];
              const platform = platforms.find(p => p.code === code);
              const isConnected = platform?.connection_status === 'active';
              const isNoCookie = NO_COOKIE_PLATFORMS.includes(code);
              const isConnecting = connecting === code;
              const statusMsg = connectStatus[code];
              const style = STATUS_STYLES[platform?.connection_status || 'available_unconnected'] || STATUS_STYLES.available_unconnected;

              return (
                <div key={code} className={`flex items-center gap-4 p-4 rounded-xl transition-colors ${isConnected ? 'bg-status-active/5' : 'bg-surface-low'}`}>
                  {/* Logo */}
                  <span className="text-2xl w-10 text-center shrink-0">{meta.logo}</span>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">{meta.displayName}</span>
                      <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                      <span className={`text-xs ${style.text}`}>{style.label}</span>
                    </div>
                    {statusMsg && !isConnected && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{statusMsg}</p>
                    )}
                    {isNoCookie && !isConnected && (
                      <p className="text-xs text-muted-foreground mt-0.5">无需插件 · 自动连接</p>
                    )}
                  </div>

                  {/* Action */}
                  {isConnected ? (
                    <span className="text-xs font-bold text-status-active shrink-0">✓</span>
                  ) : isNoCookie ? (
                    <span className="text-xs text-muted-foreground shrink-0">自动</span>
                  ) : (
                    <button
                      onClick={() => handleConnect(code)}
                      disabled={!extensionInstalled || isConnecting || !!connecting}
                      className="text-xs bg-foreground text-background px-4 py-2 rounded-lg font-bold hover:opacity-90 disabled:opacity-30 transition-opacity shrink-0"
                    >
                      {isConnecting ? '连接中...' : '连接'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {!extensionInstalled && (
            <p className="text-xs text-muted-foreground mt-4 text-center">
              💡 安装插件后才能连接需要 Cookie 的平台（LinkedIn、Boss直聘等）
            </p>
          )}
        </div>
      </AnimatedContent>

      {/* Security note */}
      <AnimatedContent delay={0.2}>
        <div className="flex items-center gap-3 justify-center text-center max-w-lg mx-auto mb-8">
          <span className="text-muted-foreground">🔒</span>
          <p className="text-xs text-muted-foreground leading-relaxed">
            我们从不存储你的密码。插件仅用于同步授权的 Cookie 以便 AI 代为投递，全程加密传输。
          </p>
        </div>
      </AnimatedContent>

      {/* Error */}
      {error && (
        <p className="text-sm text-destructive bg-destructive/10 px-4 py-3 rounded-xl text-center mb-6">{error}</p>
      )}

      {/* Navigation */}
      <AnimatedContent delay={0.25}>
        <div className="flex items-center justify-center gap-6 pb-10">
          <button
            onClick={() => handleNext(true)}
            disabled={submitting}
            className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium disabled:opacity-30"
          >
            跳过此步
          </button>
          <button
            onClick={() => handleNext(false)}
            disabled={submitting}
            className="bg-foreground text-background rounded-xl py-3 px-8 font-bold hover:opacity-90 transition-opacity disabled:opacity-30"
          >
            {submitting ? '保存中...' : '下一步 →'}
          </button>
        </div>
      </AnimatedContent>
    </div>
  );
}
