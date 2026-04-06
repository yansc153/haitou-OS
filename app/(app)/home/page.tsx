'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getValidSession } from '@/lib/hooks/use-api';
import { AgentBadge, type AgentInfo } from '@/components/agents/agent-badge';
import { AnimatedContent } from '@/components/ui/animated-content';
import { SpotlightCard } from '@/components/ui/spotlight-card';
import { useTimelineFeed } from '@/lib/hooks/use-realtime';
import Link from 'next/link';

type FeedItem = {
  id: string;
  event_type: string;
  summary_text: string;
  actor_type: string;
  occurred_at: string;
  related_entity_type?: string;
};

type HighValueOpp = {
  id: string;
  job_title: string;
  company_name: string;
  stage: string;
  priority_level: string;
  latest_event_summary?: string;
};

type HandoffItem = {
  id: string;
  handoff_type: string;
  urgency: string;
  handoff_reason: string;
  opportunity?: { job_title: string; company_name: string };
};

type HomeData = {
  team: { id: string; plan_tier: string; runtime_status: string; strategy_mode: string };
  agents: AgentInfo[];
  live_feed: FeedItem[];
  high_value_opportunities: HighValueOpp[];
  handoff_summary: { pending_count: number; items: HandoffItem[] };
  runtime: { effective_balance_seconds: number };
  today_stats?: { discovered: number; screened: number; submitted: number; materials_generated: number; total_llm_calls: number };
};

const HANDOFF_TYPE_ZH: Record<string, string> = {
  private_contact: '私人联系',
  interview_time: '面试安排',
  salary_confirmation: '薪资确认',
  strategy_decision: '策略确认',
  portfolio_audit: '背景核实',
};

const EVENT_TYPE_ZH: Record<string, string> = {
  team_started: '系统启动',
  team_paused: '系统暂停',
  team_forced_pause: '余额耗尽',
  opportunity_screened: '岗位筛选',
  task_opportunity_discovery_completed: '岗位发现',
  task_screening_completed: '批量筛选',
  task_material_generation_completed: '材料生成',
  task_submission_completed: '投递完成',
  task_reply_processing_completed: '回复处理',
  task_follow_up_completed: '跟进完成',
  task_first_contact_completed: '首次联系',
  task_handoff_takeover_completed: '交接处理',
  submission_success: '投递成功',
  submission_failed: '投递失败',
  handoff_created: '交接创建',
  handoff_takeover: '交接处理',
  budget_exhausted: '预算用尽',
};

function eventTypeLabel(eventType: string): string {
  return EVENT_TYPE_ZH[eventType] || eventType;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} 小时前`;
  return `${Math.floor(hrs / 24)} 天前`;
}

function formatRuntime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

export default function TeamHomePage() {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liveFeedItems, setLiveFeedItems] = useState<FeedItem[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const session = await getValidSession(supabase);
        if (!session) return;
        const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/home-get`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const json = await res.json();
        if (json.data) setData(json.data);
      } catch (e) { setError(e instanceof Error ? e.message : '加载失败'); }
      setLoading(false);
    }
    load();
  }, [supabase]);

  // Realtime: auto-append new timeline events to feed
  const teamId = data?.team?.id;
  const handleNewEvent = useCallback((event: Record<string, unknown>) => {
    const newItem: FeedItem = {
      id: event.id as string,
      event_type: event.event_type as string,
      summary_text: event.summary_text as string,
      actor_type: event.actor_type as string,
      occurred_at: event.occurred_at as string || new Date().toISOString(),
    };
    setLiveFeedItems(prev => [newItem, ...prev].slice(0, 50));
  }, []);
  useTimelineFeed(teamId, handleNewEvent);

  const isTeamActive = data?.team?.runtime_status === 'active';
  const agents: AgentInfo[] = (data?.agents || []).map((a: Record<string, unknown>) => ({
    id: a.id as string,
    role_code: a.template_role_code as string,
    title_zh: a.role_title_zh as string,
    persona_name: a.persona_name as string,
    status: (isTeamActive ? 'working' : 'ready') as AgentInfo['status'],
    current_task: isTeamActive ? '运行中' : undefined,
  }));

  // Merge realtime items (prepended) with initial feed, dedup by id, filter out heartbeats
  const initialFeed = data?.live_feed || [];
  const seenIds = new Set(liveFeedItems.map(i => i.id));
  const mergedFeed = [...liveFeedItems, ...initialFeed.filter(i => !seenIds.has(i.id))]
    .filter(i => i.event_type !== 'system_heartbeat');
  const feed = mergedFeed;
  const handoffs = data?.handoff_summary?.items || [];
  const opportunities = data?.high_value_opportunities || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-sm text-muted-foreground animate-pulse">加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-sm text-red-500 mb-2">加载失败: {error}</p>
          <button onClick={() => window.location.reload()} className="text-xs text-muted-foreground hover:text-foreground underline">重试</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-4xl font-display font-extrabold tracking-tight">AI 求职运营团队</h1>
          <p className="text-sm text-muted-foreground mt-1">全天候精英运营 · {agents.length} 位专员协同工作</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full surface-card">
          <div className={`w-2.5 h-2.5 rounded-full ${data?.team?.runtime_status === 'active' ? 'bg-status-active animate-pulse' : 'bg-muted-foreground/30'}`} />
          <span className="text-xs font-label uppercase tracking-wider">
            {data?.team?.runtime_status === 'active' ? '全系统运行中' : '系统已暂停'}
          </span>
        </div>
      </div>

      {/* Agent Roster */}
      {agents.length > 0 && (
        <div className="surface-card p-6 mb-8 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-display font-bold">团队阵容</h2>
            <span className="text-xs text-muted-foreground/50">Hover to inspect</span>
          </div>
          <div className="flex items-start gap-6 overflow-x-auto pb-2">
            {agents.map((agent, i) => (
              <AnimatedContent key={agent.id} delay={i * 0.05}>
                <AgentBadge agent={agent} size="compact" />
              </AnimatedContent>
            ))}
          </div>
        </div>
      )}

      {/* Main Grid: Feed + Sidebar */}
      <div className="grid lg:grid-cols-[1fr_400px] gap-6">
        {/* Left: Live Feed */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-display font-bold">实时动态</h2>
            <Link href="/review" className="text-xs text-muted-foreground hover:text-foreground transition-colors font-label uppercase tracking-wider">
              查看全部日志 →
            </Link>
          </div>

          {feed.length === 0 ? (
            <div className="surface-card p-8 text-center">
              <p className="text-sm text-muted-foreground">暂无动态 — 启动团队后，专员活动将显示在此处</p>
            </div>
          ) : (
            <div className="space-y-3">
              {feed.slice(0, 20).map((item, i) => (
                <AnimatedContent key={item.id} delay={i * 0.06}>
                  <div className="surface-card p-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold">{item.actor_type === 'user' ? '你' : eventTypeLabel(item.event_type)}</span>
                      <span className="text-xs text-muted-foreground">{timeAgo(item.occurred_at)}</span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.summary_text}</p>
                  </div>
                </AnimatedContent>
              ))}
            </div>
          )}
        </div>

        {/* Right: Sidebar */}
        <div className="space-y-5">
          {/* Handoff Alert */}
          {handoffs.length > 0 && (
            <AnimatedContent>
              <SpotlightCard className="surface-card p-6 ring-1 ring-status-warning/20" spotlightColor="rgba(217, 119, 6, 0.06)">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-lg">⚡</span>
                  <h3 className="text-base font-display font-bold">需要你接管</h3>
                </div>
                <div className="space-y-4">
                  {handoffs.map((h) => (
                    <div key={h.id}>
                      <p className="text-[10px] font-label uppercase tracking-widest text-muted-foreground mb-1">
                        {HANDOFF_TYPE_ZH[h.handoff_type] || h.handoff_type}
                      </p>
                      <p className="text-sm font-semibold mb-0.5">
                        {h.opportunity?.job_title || h.handoff_reason}
                      </p>
                      <p className="text-xs text-muted-foreground mb-2">
                        {h.opportunity?.company_name || ''}
                      </p>
                      <Link href="/handoffs" className="block px-4 py-2 text-xs font-semibold rounded-lg bg-surface-low hover:bg-border/40 transition-colors w-full text-center">
                        查看详情
                      </Link>
                    </div>
                  ))}
                </div>
              </SpotlightCard>
            </AnimatedContent>
          )}

          {/* High-Value Opportunities */}
          {opportunities.length > 0 && (
            <div>
              <h3 className="text-base font-display font-bold mb-3">重点机会</h3>
              <div className="space-y-3">
                {opportunities.slice(0, 5).map((opp) => (
                  <SpotlightCard key={opp.id} className="surface-card p-5 cursor-pointer" onClick={() => window.location.href = '/opportunities'}>
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-sm font-bold">{opp.job_title}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">{opp.company_name}</p>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-status-active/10 text-status-active text-[10px] font-bold uppercase">
                        {opp.priority_level}
                      </span>
                    </div>
                  </SpotlightCard>
                ))}
              </div>
            </div>
          )}

          {/* Today Stats card */}
          {data?.today_stats && (
            <SpotlightCard className="surface-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-base">📊</span>
                <h3 className="text-xs font-label uppercase tracking-widest text-muted-foreground">今日运营</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-2xl font-display font-extrabold">{data.today_stats.discovered}</p>
                  <p className="text-xs text-muted-foreground">岗位发现</p>
                </div>
                <div>
                  <p className="text-2xl font-display font-extrabold">{data.today_stats.screened}</p>
                  <p className="text-xs text-muted-foreground">AI 筛选</p>
                </div>
                <div>
                  <p className="text-2xl font-display font-extrabold">{data.today_stats.materials_generated}</p>
                  <p className="text-xs text-muted-foreground">材料生成</p>
                </div>
                <div>
                  <p className="text-2xl font-display font-extrabold">{data.today_stats.submitted}</p>
                  <p className="text-xs text-muted-foreground">已投递</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-border/20">
                <p className="text-xs text-muted-foreground">AI 调用次数：{data.today_stats.total_llm_calls}</p>
              </div>
            </SpotlightCard>
          )}

          {/* Runtime card */}
          <SpotlightCard className="surface-card p-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base">⭐</span>
              <h3 className="text-xs font-label uppercase tracking-widest text-muted-foreground">运行状态</h3>
            </div>
            <p className="text-sm font-semibold mb-1">
              当前使用 {data?.team?.plan_tier || 'Free'} 方案
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              剩余运行时间：{formatRuntime(data?.runtime?.effective_balance_seconds || 0)}
            </p>
            <Link href="/billing" className="text-sm text-secondary font-semibold hover:underline">
              管理套餐 →
            </Link>
          </SpotlightCard>
        </div>
      </div>
    </div>
  );
}
