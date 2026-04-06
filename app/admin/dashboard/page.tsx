'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getValidSession } from '@/lib/hooks/use-api';
import { SpotlightCard } from '@/components/ui/spotlight-card';
import { AnimatedContent } from '@/components/ui/animated-content';
import {
  DonutChart,
  FunnelBar,
  PlatformHealthBar,
  KpiCard,
  MiniBarChart,
  ActivityStream,
  UserTable,
  OutcomeBar,
} from '@/components/admin/charts';

type AdminData = {
  overview: {
    total_users: number;
    users_today: number;
    users_7d: number;
    total_teams: number;
    teams_by_status: Record<string, number>;
    active_teams_now: number;
  };
  platforms: {
    connections_by_platform: Array<{ name: string; total: number; active: number; expired: number }>;
    today_actions_by_platform: Array<{ name: string; applications: number; messages: number }>;
  };
  funnel: {
    by_stage: Record<string, number>;
    today_discovered: number;
    today_submitted: number;
    submission_outcomes: { success: number; blocked: number; error: number };
  };
  engine: {
    tasks_queued: number;
    tasks_running: number;
    tasks_failed_24h: number;
    tasks_completed_24h: number;
    tasks_by_type: Record<string, number>;
    total_tokens_used: number;
  };
  operations: {
    total_runtime_hours: number;
    materials_generated: number;
    handoffs_pending: number;
    handoffs_by_type: Record<string, number>;
    resumes_uploaded: number;
  };
  recent_events: Array<{ id: string; event_type: string; summary_text: string; team_name: string; occurred_at: string }>;
  users: Array<{
    id: string;
    email: string;
    display_name: string;
    created_at: string;
    team_status: string;
    runtime_status: string;
    plan_tier: string;
    team_name: string;
  }>;
};

export default function AdminDashboard() {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    try {
      const session = await getValidSession(supabase);
      if (!session) { setError('未登录'); setLoading(false); return; }

      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-stats`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message || '无法加载管理数据');
        setLoading(false);
        return;
      }
      setData(json.data);
      setError(null);
      setLastRefresh(new Date());
    } catch {
      setError('网络错误');
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-sm text-muted-foreground animate-pulse">加载管理面板...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="surface-card p-8 text-center rounded-2xl">
          <p className="text-sm text-destructive font-semibold mb-2">{error}</p>
          <button onClick={fetchData} className="text-xs text-secondary hover:underline">重试</button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { overview, platforms, funnel, engine, operations, recent_events, users } = data;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-4xl font-display font-extrabold tracking-tight">管理面板</h1>
          <p className="text-sm text-muted-foreground mt-1">全局系统运营数据一览</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-muted-foreground/50">
            最近刷新: {lastRefresh.toLocaleTimeString('zh-CN')}
          </span>
          <button
            onClick={fetchData}
            className="px-4 py-1.5 text-xs rounded-lg bg-surface-low text-muted-foreground hover:text-foreground transition-colors"
          >
            刷新数据
          </button>
        </div>
      </div>

      {/* ── KPI Row ── */}
      <AnimatedContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <KpiCard value={overview.total_users} label="总用户" sub={`今日 +${overview.users_today}`} />
          <KpiCard value={overview.users_7d} label="7天新增" accent="blue" />
          <KpiCard value={overview.active_teams_now} label="运行中团队" accent="green" />
          <KpiCard value={funnel.today_submitted} label="今日投递" accent="gold" />
          <KpiCard value={operations.handoffs_pending} label="待处理交接" accent={operations.handoffs_pending > 0 ? 'red' : undefined} />
          <KpiCard value={formatTokens(engine.total_tokens_used)} label="Token 消耗" sub="全局累计" />
        </div>
      </AnimatedContent>

      {/* ── Row 2: Charts ── */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <AnimatedContent delay={0.1}>
          <SpotlightCard className="surface-card p-6 rounded-2xl">
            <h2 className="text-sm font-display font-bold mb-4">团队状态分布</h2>
            <DonutChart data={overview.teams_by_status} label="团队总数" />
          </SpotlightCard>
        </AnimatedContent>

        <AnimatedContent delay={0.15}>
          <SpotlightCard className="surface-card p-6 rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-display font-bold">机会漏斗</h2>
              <span className="text-[10px] text-muted-foreground">今日发现 {funnel.today_discovered}</span>
            </div>
            <FunnelBar data={funnel.by_stage} />
          </SpotlightCard>
        </AnimatedContent>
      </div>

      {/* ── Row 3: Platform + Engine ── */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <AnimatedContent delay={0.2}>
          <SpotlightCard className="surface-card p-6 rounded-2xl">
            <h2 className="text-sm font-display font-bold mb-4">平台连接健康</h2>
            <PlatformHealthBar data={platforms.connections_by_platform} />

            {platforms.today_actions_by_platform.length > 0 && (
              <div className="mt-5 pt-4 border-t border-border/15">
                <h3 className="text-[10px] font-label uppercase tracking-widest text-muted-foreground/60 mb-3">今日操作量</h3>
                <div className="grid grid-cols-2 gap-3">
                  {platforms.today_actions_by_platform.map((p) => (
                    <div key={p.name} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{p.name}</span>
                      <span className="font-semibold">{p.applications} 投递 / {p.messages} 消息</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </SpotlightCard>
        </AnimatedContent>

        <AnimatedContent delay={0.25}>
          <SpotlightCard className="surface-card p-6 rounded-2xl">
            <h2 className="text-sm font-display font-bold mb-4">AI 引擎状态</h2>

            <div className="grid grid-cols-4 gap-3 mb-5">
              <div className="text-center">
                <p className="text-xl font-display font-extrabold text-status-warning">{engine.tasks_queued}</p>
                <p className="text-[10px] text-muted-foreground">排队中</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-display font-extrabold text-status-active">{engine.tasks_running}</p>
                <p className="text-[10px] text-muted-foreground">运行中</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-display font-extrabold">{engine.tasks_completed_24h}</p>
                <p className="text-[10px] text-muted-foreground">24h完成</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-display font-extrabold text-status-error">{engine.tasks_failed_24h}</p>
                <p className="text-[10px] text-muted-foreground">24h失败</p>
              </div>
            </div>

            <h3 className="text-[10px] font-label uppercase tracking-widest text-muted-foreground/60 mb-2">24h 任务类型分布</h3>
            <MiniBarChart data={engine.tasks_by_type} />
          </SpotlightCard>
        </AnimatedContent>
      </div>

      {/* ── Row 4: Submission Outcomes + Operations ── */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <AnimatedContent delay={0.3}>
          <SpotlightCard className="surface-card p-6 rounded-2xl">
            <h2 className="text-sm font-display font-bold mb-4">投递结果分布</h2>
            <OutcomeBar data={funnel.submission_outcomes} />

            <div className="mt-5 pt-4 border-t border-border/15">
              <h3 className="text-[10px] font-label uppercase tracking-widest text-muted-foreground/60 mb-3">Handoff 类型分布</h3>
              {Object.keys(operations.handoffs_by_type).length > 0 ? (
                <DonutChart data={operations.handoffs_by_type} label="交接总数" />
              ) : (
                <p className="text-xs text-muted-foreground text-center py-2">暂无交接记录</p>
              )}
            </div>
          </SpotlightCard>
        </AnimatedContent>

        <AnimatedContent delay={0.35}>
          <SpotlightCard className="surface-card p-6 rounded-2xl">
            <h2 className="text-sm font-display font-bold mb-4">运营概览</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-surface-low">
                <p className="text-2xl font-display font-extrabold">{operations.total_runtime_hours}h</p>
                <p className="text-xs text-muted-foreground">累计运行时长</p>
              </div>
              <div className="p-4 rounded-xl bg-surface-low">
                <p className="text-2xl font-display font-extrabold">{operations.materials_generated}</p>
                <p className="text-xs text-muted-foreground">材料生成总数</p>
              </div>
              <div className="p-4 rounded-xl bg-surface-low">
                <p className="text-2xl font-display font-extrabold">{operations.resumes_uploaded}</p>
                <p className="text-xs text-muted-foreground">简历上传数</p>
              </div>
              <div className="p-4 rounded-xl bg-surface-low">
                <p className="text-2xl font-display font-extrabold">{overview.total_teams}</p>
                <p className="text-xs text-muted-foreground">团队总数</p>
              </div>
            </div>
          </SpotlightCard>
        </AnimatedContent>
      </div>

      {/* ── Row 5: Recent Activity ── */}
      <AnimatedContent delay={0.4}>
        <SpotlightCard className="surface-card p-6 rounded-2xl mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-display font-bold">最近系统活动</h2>
            <span className="text-[10px] text-muted-foreground/50">最近 30 条 · 每60秒自动刷新</span>
          </div>
          <ActivityStream events={recent_events} />
        </SpotlightCard>
      </AnimatedContent>

      {/* ── Row 6: User List ── */}
      <AnimatedContent delay={0.45}>
        <SpotlightCard className="surface-card p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-display font-bold">用户列表</h2>
            <span className="text-[10px] text-muted-foreground/50">{users.length} 位用户</span>
          </div>
          <UserTable users={users} />
        </SpotlightCard>
      </AnimatedContent>
    </div>
  );
}

function formatTokens(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}
