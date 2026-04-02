'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AgentBadge, type AgentInfo } from '@/components/agents/agent-badge';
import { AnimatedContent } from '@/components/ui/animated-content';
import { SpotlightCard } from '@/components/ui/spotlight-card';
import { PIXEL_AVATARS } from '@/components/agents/pixel-avatars';
import Link from 'next/link';

type FeedItem = { id: string; event_type: string; summary_text: string; actor_name?: string; actor_role_title?: string; occurred_at: string };
type HighValueOpp = { id: string; company_name: string; job_title: string; stage: string; priority_level: string };

export default function TeamHomePage() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [opportunities, setOpportunities] = useState<HighValueOpp[]>([]);
  const [runtime, setRuntime] = useState({ status: 'paused', balance: 0 });
  const [handoffCount, setHandoffCount] = useState(0);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/home-get`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (!json.data) return;
      setAgents((json.data.agents || []).map((a: Record<string, unknown>) => ({
        id: a.id as string, role_code: a.template_role_code as string,
        title_zh: a.role_title_zh as string, persona_name: a.persona_name as string,
        status: (a.frontend_status as string) || 'idle',
        stats: { tasks_completed: a.total_tasks_completed as number, last_active: a.last_active_at as string },
      })));
      setFeed(json.data.live_feed || []);
      setOpportunities(json.data.high_value_opportunities || []);
      setRuntime({ status: json.data.runtime?.runtime_status || 'paused', balance: json.data.runtime?.effective_balance_seconds || 0 });
      setHandoffCount(json.data.handoff_summary?.pending_count || 0);
    }
    load();
  }, [supabase]);

  const formatTime = (s: number) => `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-10">
        <div>
          <h1 className="text-4xl font-display font-extrabold tracking-tight">AI 求职运营团队</h1>
          <p className="text-sm text-muted-foreground mt-1">全天候精英运营 · 7 位专员协同工作</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full surface-card">
          <div className={`w-2.5 h-2.5 rounded-full ${runtime.status === 'active' ? 'bg-status-active animate-pulse' : 'bg-muted-foreground/30'}`} />
          <span className="text-xs font-label uppercase tracking-wider">
            {runtime.status === 'active' ? '全系统运行中' : '已暂停'}
          </span>
        </div>
      </div>

      {/* Agent Roster */}
      <div className="surface-card p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-display font-bold">团队阵容</h2>
          <span className="text-xs text-muted-foreground">Hover to inspect</span>
        </div>
        <div className="flex items-start justify-between gap-4 overflow-x-auto pb-2">
          {agents.length > 0 ? agents.map((agent) => (
            <AgentBadge key={agent.id} agent={agent} size="compact" />
          )) : (
            // Placeholder when no data
            Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2 p-3 animate-pulse">
                <div className="w-12 h-12 rounded-xl bg-surface-low" />
                <div className="w-14 h-3 rounded bg-surface-low" />
                <div className="w-10 h-2 rounded bg-surface-low" />
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Grid: Feed + Sidebar */}
      <div className="grid lg:grid-cols-[1fr_400px] gap-6">
        {/* Left: Live Feed */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-display font-bold">实时动态</h2>
            <button className="text-xs text-muted-foreground hover:text-foreground transition-colors font-label uppercase tracking-wider">
              查看全部日志 →
            </button>
          </div>

          <div className="space-y-3">
            {feed.length > 0 ? feed.slice(0, 8).map((item, i) => (
              <AnimatedContent key={item.id} delay={i * 0.04}>
                <div className="surface-card p-5 flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-surface-low flex items-center justify-center text-lg flex-shrink-0">
                    {getEventIcon(item.event_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {item.actor_role_title && <span className="text-sm font-semibold">{item.actor_role_title}</span>}
                      <span className="text-xs text-muted-foreground">
                        {new Date(item.occurred_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.summary_text}</p>
                  </div>
                </div>
              </AnimatedContent>
            )) : (
              <div className="surface-card p-16 text-center">
                <p className="text-base text-muted-foreground/60 mb-2">启动团队后，实时活动将显示在这里</p>
                <p className="text-sm text-muted-foreground/40">Start your team to see live agent activity</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Sidebar */}
        <div className="space-y-5">
          {/* Handoff Alert */}
          {handoffCount > 0 && (
            <AnimatedContent>
              <SpotlightCard className="surface-card p-6 ring-1 ring-status-warning/20" spotlightColor="rgba(217, 119, 6, 0.06)">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">⚡</span>
                  <h3 className="text-base font-display font-bold">需要你接管</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">{handoffCount} 个事项需要你的决定</p>
                <Link href="/handoffs" className="text-sm text-secondary font-semibold hover:underline">
                  查看全部 →
                </Link>
              </SpotlightCard>
            </AnimatedContent>
          )}

          {/* High-Value Opportunities */}
          <div>
            <h3 className="text-base font-display font-bold mb-3">重点机会</h3>
            <div className="space-y-3">
              {opportunities.length > 0 ? opportunities.slice(0, 4).map((opp) => (
                <SpotlightCard key={opp.id} className="surface-card p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-bold">{opp.job_title}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">{opp.company_name}</p>
                    </div>
                    {opp.priority_level === 'critical' && (
                      <span className="px-2 py-0.5 rounded-full bg-status-active/10 text-status-active text-[10px] font-bold uppercase">95% 匹配</span>
                    )}
                  </div>
                </SpotlightCard>
              )) : (
                <div className="text-sm text-muted-foreground/50 p-4">团队启动后将显示高价值机会</div>
              )}
            </div>
          </div>

          {/* Runtime Balance */}
          <SpotlightCard className="surface-card p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">⭐</span>
              <h3 className="text-xs font-label uppercase tracking-widest text-muted-foreground">运行时间</h3>
            </div>
            <p className="text-2xl font-display font-extrabold mb-1">{formatTime(runtime.balance)}</p>
            <p className="text-sm text-muted-foreground mb-4">本月剩余运行时间</p>
            <Link href="/billing" className="text-sm text-secondary font-semibold hover:underline">
              管理套餐 →
            </Link>
          </SpotlightCard>
        </div>
      </div>
    </div>
  );
}

function getEventIcon(t: string): string {
  if (t.includes('discovery') || t.includes('found')) return '🧭';
  if (t.includes('submission') || t.includes('applied')) return '📮';
  if (t.includes('screen') || t.includes('review')) return '⚖️';
  if (t.includes('material') || t.includes('resume')) return '🎨';
  if (t.includes('handoff') || t.includes('takeover')) return '⚡';
  if (t.includes('contact') || t.includes('message')) return '🤝';
  return '📋';
}
