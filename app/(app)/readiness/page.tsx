'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getValidSession } from '@/lib/hooks/use-api';
import { useRouter } from 'next/navigation';
import { AnimatedContent } from '@/components/ui/animated-content';
import { SpotlightCard } from '@/components/ui/spotlight-card';
import { PIXEL_AVATARS } from '@/components/agents/pixel-avatars';

type PlatformEntry = {
  platform_id: string; code: string; display_name: string; display_name_zh: string;
  connection_status: string;
};

export default function ReadinessPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const ScoutAvatar = PIXEL_AVATARS['opportunity_research'];

  const [profile, setProfile] = useState<{ contact_email: string; phone: string; completion_band: string }>({ contact_email: '', phone: '', completion_band: 'missing' });
  const [platforms, setPlatforms] = useState<PlatformEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [extensionInstalled, setExtensionInstalled] = useState<boolean | null>(null);

  const reload = useCallback(async () => {
    const session = await getValidSession(supabase);
    if (!session) return;

    // Load submission profile
    const settingsRes = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/settings-get`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const settingsJson = await settingsRes.json();
    if (settingsJson.data?.submission_profile) {
      const sp = settingsJson.data.submission_profile;
      setProfile({ contact_email: sp.contact_email || '', phone: sp.phone || '', completion_band: sp.completion_band || 'missing' });
    }

    // Load platforms
    const platRes = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/platforms-list`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const platJson = await platRes.json();
    if (platJson.data) {
      const all = [...(platJson.data.global_english || []), ...(platJson.data.china || [])];
      setPlatforms(all);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => { reload(); }, [reload]);

  // Check extension
  useEffect(() => {
    const extId = process.env.NEXT_PUBLIC_BRIDGE_EXTENSION_ID || '';
    if (!extId || typeof window === 'undefined') { setExtensionInstalled(false); return; }
    try {
      const c = (window as unknown as Record<string, unknown>).chrome as { runtime?: { sendMessage: (id: string, msg: unknown, cb: (r: unknown) => void) => void } } | undefined;
      if (c?.runtime?.sendMessage) {
        c.runtime.sendMessage(extId, { action: 'checkInstalled' }, (r: unknown) => {
          setExtensionInstalled(!!(r as Record<string, unknown>)?.installed);
        });
      } else {
        setExtensionInstalled(false);
      }
    } catch { setExtensionInstalled(false); }
  }, []);

  const connectedCount = platforms.filter(p => p.connection_status === 'active').length;
  const profileReady = profile.contact_email && profile.phone;
  const canStart = connectedCount > 0;

  const handleStart = async () => {
    setStarting(true);
    setError('');
    const session = await getValidSession(supabase);
    if (!session) { setError('请先登录'); setStarting(false); return; }

    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/team-start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    });

    if (res.ok) {
      router.push('/home');
    } else {
      const j = await res.json().catch(() => ({}));
      setError(j.error?.message || j.msg || '启动失败');
      setStarting(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]"><div className="text-sm text-muted-foreground animate-pulse">加载中...</div></div>;
  }

  return (
    <div>
      <div className="mb-10">
        <h1 className="text-4xl font-display font-extrabold tracking-tight">就绪检查</h1>
        <p className="text-base text-muted-foreground mt-2">确认平台连接和身份信息，确保团队拥有开始运营所需的一切。</p>
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-8">
        <div className="space-y-10">
          {/* Step 01: Extension */}
          <AnimatedContent>
            <div>
              <p className="text-xs font-label uppercase tracking-[0.2em] text-muted-foreground mb-4">STEP 01</p>
              <h2 className="text-2xl font-display font-bold mb-4">安装浏览器插件</h2>
              <p className="text-sm text-muted-foreground mb-4">海投助手插件用于安全连接你的求职平台账号（LinkedIn、Boss直聘等需要登录的平台）。Greenhouse/Lever 等公开平台无需插件。</p>
              <SpotlightCard className="surface-card p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${extensionInstalled ? 'bg-status-active/10' : 'bg-surface-low'}`}>
                      {extensionInstalled ? '✅' : '🧩'}
                    </div>
                    <div>
                      <p className="text-sm font-bold">{extensionInstalled ? '插件已安装' : '海投助手 Chrome 插件'}</p>
                      <p className="text-xs text-muted-foreground">{extensionInstalled ? '一键导入平台 Cookie' : '安装后可一键连接需要登录的平台'}</p>
                    </div>
                  </div>
                  {!extensionInstalled && (
                    <a
                      href="https://chrome.google.com/webstore/detail/placeholder"
                      target="_blank" rel="noopener noreferrer"
                      className="px-5 py-2.5 bg-foreground text-background rounded-xl text-xs font-bold hover:opacity-90 shrink-0"
                    >
                      安装插件
                    </a>
                  )}
                </div>
              </SpotlightCard>
              <p className="text-xs text-muted-foreground mt-3">
                跳过此步骤？没问题 — Greenhouse 和 Lever 平台不需要插件，可以直接连接。
              </p>
            </div>
          </AnimatedContent>

          {/* Step 02: Platforms */}
          <AnimatedContent delay={0.1}>
            <div>
              <p className="text-xs font-label uppercase tracking-[0.2em] text-muted-foreground mb-4">STEP 02</p>
              <h2 className="text-2xl font-display font-bold mb-6">连接平台</h2>
              {platforms.length === 0 ? (
                <p className="text-sm text-muted-foreground">加载中...</p>
              ) : (
                <div className="grid md:grid-cols-3 gap-4">
                  {platforms.map(p => {
                    const connected = p.connection_status === 'active';
                    return (
                      <SpotlightCard key={p.platform_id} className="surface-card p-5">
                        <h4 className="text-sm font-bold mb-1">{p.display_name}</h4>
                        {p.display_name_zh !== p.display_name && (
                          <p className="text-xs text-muted-foreground mb-3">{p.display_name_zh}</p>
                        )}
                        <div className="flex items-center gap-2 mb-3">
                          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-status-active' : 'bg-muted-foreground/30'}`} />
                          <span className={`text-xs font-semibold ${connected ? 'text-status-active' : 'text-muted-foreground'}`}>
                            {connected ? '已连接' : '未连接'}
                          </span>
                        </div>
                        {!connected && (
                          <button
                            onClick={() => router.push('/platforms')}
                            className="w-full py-2 text-xs font-semibold rounded-lg bg-surface-low hover:bg-border/40 transition-colors"
                          >
                            前往连接
                          </button>
                        )}
                      </SpotlightCard>
                    );
                  })}
                </div>
              )}
            </div>
          </AnimatedContent>

          {/* Step 03: Profile */}
          <AnimatedContent delay={0.2}>
            <div>
              <p className="text-xs font-label uppercase tracking-[0.2em] text-muted-foreground mb-4">STEP 03</p>
              <h2 className="text-2xl font-display font-bold mb-6">身份档案</h2>
              <SpotlightCard className="surface-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold">联系方式</h3>
                    <p className="text-xs text-muted-foreground">投递表单和面试联络使用</p>
                  </div>
                  <button onClick={() => router.push('/settings')} className="text-xs text-secondary font-semibold hover:underline">
                    编辑
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs">{profile.contact_email ? '✅' : '⚠️'}</span>
                    <span className="text-sm">{profile.contact_email || '未填写邮箱'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs">{profile.phone ? '✅' : '⚠️'}</span>
                    <span className="text-sm">{profile.phone || '未填写电话（选填）'}</span>
                  </div>
                </div>
              </SpotlightCard>
            </div>
          </AnimatedContent>
        </div>

        {/* Right sidebar: checklist + start */}
        <AnimatedContent delay={0.2} direction="right">
          <div className="sticky top-20 space-y-5">
            <div className="surface-card p-6 rounded-2xl">
              <h3 className="text-lg font-display font-bold mb-4">启动清单</h3>
              <div className="space-y-3 mb-6">
                {[
                  { done: true, label: '简历已上传并解析' },
                  { done: true, label: '7 位专员已分配' },
                  { done: connectedCount > 0, label: `平台已连接（${connectedCount} 个）` },
                  { done: !!profileReady, label: '联系方式已填写', optional: true },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${item.done ? 'bg-status-active/10 text-status-active' : 'bg-muted-foreground/10 text-muted-foreground/40'}`}>
                      {item.done ? '✓' : '○'}
                    </div>
                    <span className={`text-sm ${item.done ? 'font-medium' : 'text-muted-foreground'}`}>
                      {item.label}{item.optional && !item.done ? '（选填）' : ''}
                    </span>
                  </div>
                ))}
              </div>

              {error && <p className="text-sm text-red-500 bg-red-500/10 px-3 py-2 rounded-lg mb-4">{error}</p>}

              <button
                onClick={handleStart}
                disabled={!canStart || starting}
                className="w-full py-3.5 bg-foreground text-background rounded-xl text-base font-bold hover:opacity-90 transition-opacity disabled:opacity-30"
              >
                {starting ? '启动中...' : '启动团队'}
              </button>
              {!canStart && <p className="text-xs text-muted-foreground mt-2 text-center">至少连接一个平台后才能启动</p>}
            </div>

            <div className="surface-card p-5 rounded-2xl">
              <div className="flex items-center gap-3">
                {ScoutAvatar && <ScoutAvatar size={40} />}
                <div><p className="text-sm font-bold">岗位研究员</p><p className="text-xs text-muted-foreground">等待部署</p></div>
              </div>
            </div>
          </div>
        </AnimatedContent>
      </div>
    </div>
  );
}
