'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AnimatedContent } from '@/components/ui/animated-content';
import { SpotlightCard } from '@/components/ui/spotlight-card';
import Link from 'next/link';

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: 'bg-status-active/10', text: 'text-status-active', label: '已连接' },
  available_unconnected: { bg: 'bg-muted-foreground/10', text: 'text-muted-foreground', label: '未连接' },
  pending_login: { bg: 'bg-status-info/10', text: 'text-status-info', label: '连接中' },
  session_expired: { bg: 'bg-status-warning/10', text: 'text-status-warning', label: '已过期' },
  plan_locked: { bg: 'bg-violet-100', text: 'text-violet-700', label: '需升级' },
};

type PlatformEntry = {
  platform_id: string; code: string; display_name: string; display_name_zh: string;
  pipeline_mode: string; anti_scraping_level: string; min_plan_tier: string;
  connection_id: string | null; connection_status: string; capability_status: Record<string, string> | null;
};

const MOCK_PLATFORMS: { global_english: PlatformEntry[]; china: PlatformEntry[] } = {
  global_english: [
    { platform_id: '1', code: 'linkedin', display_name: 'LinkedIn', display_name_zh: '领英', pipeline_mode: 'full_tailored', anti_scraping_level: 'high', min_plan_tier: 'free', connection_id: null, connection_status: 'available_unconnected', capability_status: null },
    { platform_id: '2', code: 'greenhouse', display_name: 'Greenhouse', display_name_zh: 'Greenhouse', pipeline_mode: 'full_tailored', anti_scraping_level: 'low', min_plan_tier: 'free', connection_id: null, connection_status: 'available_unconnected', capability_status: null },
    { platform_id: '3', code: 'lever', display_name: 'Lever', display_name_zh: 'Lever', pipeline_mode: 'full_tailored', anti_scraping_level: 'low', min_plan_tier: 'free', connection_id: null, connection_status: 'available_unconnected', capability_status: null },
  ],
  china: [
    { platform_id: '4', code: 'zhaopin', display_name: 'Zhaopin', display_name_zh: '智联招聘', pipeline_mode: 'passthrough', anti_scraping_level: 'low', min_plan_tier: 'pro', connection_id: null, connection_status: 'available_unconnected', capability_status: null },
    { platform_id: '5', code: 'lagou', display_name: 'Lagou', display_name_zh: '拉勾', pipeline_mode: 'passthrough', anti_scraping_level: 'medium', min_plan_tier: 'pro', connection_id: null, connection_status: 'available_unconnected', capability_status: null },
    { platform_id: '6', code: 'boss_zhipin', display_name: 'Boss Zhipin', display_name_zh: 'Boss直聘', pipeline_mode: 'passthrough', anti_scraping_level: 'extreme', min_plan_tier: 'pro', connection_id: null, connection_status: 'available_unconnected', capability_status: null },
  ],
};

export default function PlatformsPage() {
  const [groups, setGroups] = useState<{ global_english: PlatformEntry[]; china: PlatformEntry[] }>(MOCK_PLATFORMS);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/platforms-list`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const json = await res.json();
        if (json.data) setGroups(json.data);
      } catch { /* use mock data */ }
    }
    load();
  }, [supabase]);

  return (
    <div>
      <h1 className="text-4xl font-display font-extrabold tracking-tight mb-2">平台中心</h1>
      <p className="text-sm text-muted-foreground mb-10">管理你的招聘平台连接状态和运行健康度</p>

      <div className="space-y-12">
          <PlatformGroup
            title="英文平台"
            subtitle="full_tailored · 简历定制 + 求职信 + 自动投递"
            platforms={groups.global_english}
          />
          <PlatformGroup
            title="中文平台"
            subtitle="passthrough · 原始简历直投 · 速度优先"
            platforms={groups.china}
          />
        </div>
    </div>
  );
}

function PlatformGroup({ title, subtitle, platforms }: { title: string; subtitle: string; platforms: PlatformEntry[] }) {
  const supabase = useMemo(() => createClient(), []);
  return (
    <div>
      <h2 className="text-xl font-display font-bold mb-1">{title}</h2>
      <p className="text-xs text-muted-foreground mb-5">{subtitle}</p>
      <div className="grid md:grid-cols-2 gap-4">
        {platforms.map((p, i) => {
          const status = STATUS_STYLES[p.connection_status] || STATUS_STYLES.available_unconnected;
          return (
            <AnimatedContent key={p.platform_id} delay={i * 0.05}>
              <SpotlightCard className="surface-card p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold">{p.display_name}</h3>
                    {p.display_name_zh !== p.display_name && (
                      <span className="text-xs text-muted-foreground">{p.display_name_zh}</span>
                    )}
                  </div>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${status.bg} ${status.text}`}>
                    {status.label}
                  </span>
                </div>

                {/* Capability dots */}
                {p.capability_status && p.connection_status === 'active' && (
                  <div className="flex gap-2 mb-4">
                    {Object.entries(p.capability_status).map(([cap, st]) => (
                      <span key={cap} className={`px-2 py-0.5 rounded text-[10px] ${
                        st === 'healthy' ? 'bg-status-active/10 text-status-active' :
                        st === 'degraded' ? 'bg-status-warning/10 text-status-warning' :
                        st === 'blocked' ? 'bg-red-100 text-red-600' :
                        'bg-muted-foreground/10 text-muted-foreground/50'
                      }`}>
                        {cap}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex gap-3 text-[10px] text-muted-foreground/50">
                    <span>Anti-bot: {p.anti_scraping_level}</span>
                    <span>{p.pipeline_mode === 'full_tailored' ? '定制投递' : '直投'}</span>
                  </div>
                  {p.connection_status === 'available_unconnected' && (
                    <button
                      onClick={() => alert('请使用浏览器扩展导出 Cookie 来连接此平台。\n\n安装扩展后，登录平台，点击扩展中的 "Export" 按钮。')}
                      className="px-4 py-1.5 bg-foreground text-background rounded-lg text-xs font-bold hover:opacity-90"
                    >
                      连接
                    </button>
                  )}
                  {p.connection_status === 'session_expired' && (
                    <button
                      onClick={async () => {
                        if (!p.connection_id) return;
                        const { data: { session } } = await supabase.auth.getSession();
                        if (!session) return;
                        await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/platform-reconnect`, {
                          method: 'POST',
                          headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
                          body: JSON.stringify({ connection_id: p.connection_id }),
                        });
                        window.location.reload();
                      }}
                      className="px-4 py-1.5 bg-status-warning text-white rounded-lg text-xs font-bold hover:opacity-90"
                    >
                      重新连接
                    </button>
                  )}
                  {p.connection_status === 'active' && p.connection_id && (
                    <button
                      onClick={async () => {
                        const { data: { session } } = await supabase.auth.getSession();
                        if (!session) return;
                        await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/platform-disconnect`, {
                          method: 'POST',
                          headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
                          body: JSON.stringify({ connection_id: p.connection_id }),
                        });
                        window.location.reload();
                      }}
                      className="px-4 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      断开
                    </button>
                  )}
                  {p.connection_status === 'plan_locked' && (
                    <Link href="/billing" className="px-4 py-1.5 bg-violet-100 text-violet-700 rounded-lg text-xs font-bold hover:opacity-90">
                      升级解锁
                    </Link>
                  )}
                </div>
              </SpotlightCard>
            </AnimatedContent>
          );
        })}
      </div>
    </div>
  );
}
