'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getValidSession } from '@/lib/hooks/use-api';
import { AnimatedContent } from '@/components/ui/animated-content';
import { PIXEL_AVATARS } from '@/components/agents/pixel-avatars';
import { useTimelineFeed, useAgentUpdates, useAllTimelineEvents } from '@/lib/hooks/use-realtime';
import Link from 'next/link';

type FeedItem = {
  id: string;
  event_type: string;
  summary_text: string;
  actor_type: string;
  occurred_at: string;
  related_entity_type?: string;
};

type AgentData = {
  id: string;
  template_role_code: string;
  role_title_zh: string;
  persona_name: string;
  lifecycle_state: string;
  runtime_state: string;
  health_status: string;
  total_tasks_completed: number;
  last_active_at: string | null;
  frontend_status: string;
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
  agents: AgentData[];
  live_feed: FeedItem[];
  high_value_opportunities: unknown[];
  handoff_summary: { pending_count: number; items: HandoffItem[] };
  runtime: { effective_balance_seconds: number };
  today_stats?: { discovered: number; screened: number; submitted: number; materials_generated: number; total_llm_calls: number };
};

const AGENT_ENGLISH_SUBTITLE: Record<string, string> = {
  orchestrator: 'Commander',
  profile_intelligence: 'Analyst',
  materials_advisor: 'Advisor',
  opportunity_research: 'Scout',
  matching_review: 'Reviewer',
  application_executor: 'Executor',
  relationship_manager: 'Liaison',
};

const AGENT_ROLE_ZH: Record<string, string> = {
  orchestrator: '调度官',
  profile_intelligence: '履历分析师',
  materials_advisor: '简历顾问',
  opportunity_research: '岗位研究员',
  matching_review: '匹配审核员',
  application_executor: '投递专员',
  relationship_manager: '招聘关系经理',
};

const EVENT_TYPE_ZH: Record<string, string> = {
  team_started: '系统启动',
  team_paused: '系统暂停',
  team_forced_pause: '余额耗尽',
  agent_online: '智能体上线',
  resume_analysis_started: '简历分析中',
  resume_analysis_completed: '简历分析完成',
  keyword_generated: '关键词生成',
  task_assigned: '任务分配',
  dispatch_assign: '任务分配',
  agent_report: '专员报告',
  platform_search_started: '平台搜索中',
  platform_search_completed: '平台搜索完成',
  screening_started: '开始筛选',
  material_started: '材料生成中',
  material_completed: '材料生成完成',
  submission_started: '开始投递',
  reply_detected: '收到回复',
  opportunity_screened: '岗位筛选',
  task_opportunity_discovery_completed: '岗位发现',
  task_screening_completed: '批量筛选',
  task_material_generation_completed: '材料生成',
  task_submission_completed: '投递完成',
  task_reply_processing_completed: '回复处理',
  task_follow_up_completed: '跟进完成',
  task_first_contact_completed: '首次联系',
  task_handoff_takeover_completed: '交接处理',
  task_keyword_generation_completed: '关键词分析完成',
  submission_success: '投递成功',
  submission_failed: '投递失败',
  handoff_created: '交接创建',
  handoff_takeover: '交接处理',
  budget_exhausted: '预算用尽',
  boss_greeting_sent: '打招呼成功',
  boss_greeting_failed: '打招呼失败',
  system_heartbeat: '系统心跳',
};

const EVENT_EMOJI: Record<string, string> = {
  dispatch_assign: '📢',
  agent_report: '💬',
  task_assigned: '📢',
  submission_success: '✅',
  submission_failed: '❌',
  handoff_created: '⚡',
  reply_detected: '💌',
  team_started: '🚀',
  team_paused: '⏸',
  budget_exhausted: '🔴',
};

const HANDOFF_TYPE_ZH: Record<string, string> = {
  private_contact: '私人联系',
  interview_time: '面试安排',
  salary_confirmation: '薪资确认',
  strategy_decision: '策略确认',
  portfolio_audit: '背景核实',
};

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

function runtimePercent(seconds: number, planTier: string): number {
  // Free=6h, Pro=24h, Enterprise=unlimited
  const maxMap: Record<string, number> = { free: 6 * 3600, pro: 24 * 3600, enterprise: 72 * 3600 };
  const max = maxMap[planTier?.toLowerCase()] || 6 * 3600;
  return Math.min(100, Math.round((seconds / max) * 100));
}

/** Resolve actor label from feed item */
function resolveActorLabel(item: FeedItem, agents: AgentData[]): { name: string; roleCode: string | null } {
  if (item.actor_type === 'user') return { name: '你', roleCode: null };
  // Try to match agent by event context
  const evtToRole: Record<string, string> = {
    resume_analysis_started: 'profile_intelligence',
    resume_analysis_completed: 'profile_intelligence',
    keyword_generated: 'profile_intelligence',
    task_keyword_generation_completed: 'profile_intelligence',
    platform_search_started: 'opportunity_research',
    platform_search_completed: 'opportunity_research',
    task_opportunity_discovery_completed: 'opportunity_research',
    screening_started: 'matching_review',
    opportunity_screened: 'matching_review',
    task_screening_completed: 'matching_review',
    material_started: 'materials_advisor',
    material_completed: 'materials_advisor',
    task_material_generation_completed: 'materials_advisor',
    submission_started: 'application_executor',
    submission_success: 'application_executor',
    submission_failed: 'application_executor',
    task_submission_completed: 'application_executor',
    boss_greeting_sent: 'application_executor',
    boss_greeting_failed: 'application_executor',
    reply_detected: 'relationship_manager',
    task_reply_processing_completed: 'relationship_manager',
    task_follow_up_completed: 'relationship_manager',
    task_first_contact_completed: 'relationship_manager',
    task_assigned: 'orchestrator',
    dispatch_assign: 'orchestrator',
    team_started: 'orchestrator',
    team_paused: 'orchestrator',
    team_forced_pause: 'orchestrator',
    agent_online: 'orchestrator',
  };
  const roleCode = evtToRole[item.event_type] || 'orchestrator';
  const agent = agents.find(a => a.template_role_code === roleCode);
  return {
    name: agent?.role_title_zh || AGENT_ROLE_ZH[roleCode] || '系统',
    roleCode,
  };
}

function AgentMiniAvatar({ roleCode, size = 24 }: { roleCode: string; size?: number }) {
  const AvatarComponent = PIXEL_AVATARS[roleCode];
  if (AvatarComponent) return <AvatarComponent size={size} />;
  return <div className="rounded bg-muted flex items-center justify-center text-[10px]" style={{ width: size, height: size }}>👤</div>;
}

export default function TeamHomePage() {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liveFeedItems, setLiveFeedItems] = useState<FeedItem[]>([]);
  const [expiringPlatforms, setExpiringPlatforms] = useState<Array<{ name: string; minutesLeft: number }>>([]);
  // Per-agent terminal logs: roleCode → last N events
  const [agentLogs, setAgentLogs] = useState<Record<string, Array<{ time: string; text: string }>>>({});
  // Real-time agent status overrides
  const [agentOverrides, setAgentOverrides] = useState<Record<string, Partial<AgentData>>>({});

  useEffect(() => {
    async function load() {
      try {
        const session = await getValidSession(supabase);
        if (!session) return;
        const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/home-get`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const json = await res.json();
        if (json.data) {
          setData(json.data);
          // Seed agent terminal logs from initial feed
          const evtToRole: Record<string, string> = {
            resume_analysis_started: 'profile_intelligence', resume_analysis_completed: 'profile_intelligence',
            keyword_generated: 'profile_intelligence', task_keyword_generation_completed: 'profile_intelligence',
            platform_search_started: 'opportunity_research', platform_search_completed: 'opportunity_research',
            task_opportunity_discovery_completed: 'opportunity_research',
            screening_started: 'matching_review', opportunity_screened: 'matching_review', task_screening_completed: 'matching_review',
            material_started: 'materials_advisor', material_completed: 'materials_advisor', task_material_generation_completed: 'materials_advisor',
            submission_started: 'application_executor', submission_success: 'application_executor', submission_failed: 'application_executor',
            task_submission_completed: 'application_executor', boss_greeting_sent: 'application_executor', boss_greeting_failed: 'application_executor',
            reply_detected: 'relationship_manager', task_reply_processing_completed: 'relationship_manager',
            task_assigned: 'orchestrator', dispatch_assign: 'orchestrator', team_started: 'orchestrator',
            team_paused: 'orchestrator', agent_online: 'orchestrator', agent_report: 'orchestrator',
          };
          const seedLogs: Record<string, Array<{ time: string; text: string }>> = {};
          for (const item of (json.data.live_feed || []).slice(0, 30)) {
            if (item.event_type === 'system_heartbeat') continue;
            const role = evtToRole[item.event_type] || 'orchestrator';
            if (!seedLogs[role]) seedLogs[role] = [];
            if (seedLogs[role].length >= 6) continue;
            const ts = new Date(item.occurred_at);
            seedLogs[role].push({
              time: `${String(ts.getHours()).padStart(2, '0')}:${String(ts.getMinutes()).padStart(2, '0')}`,
              text: item.summary_text || EVENT_TYPE_ZH[item.event_type] || item.event_type,
            });
          }
          setAgentLogs(seedLogs);
        }

        // Check for expiring platform sessions
        const platformsRes = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/platforms-list`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const platformsJson = await platformsRes.json();
        if (platformsJson.data) {
          const allPlatforms = [...(platformsJson.data.global_english || []), ...(platformsJson.data.china || [])];
          const TTL_MAP: Record<string, number> = { boss_zhipin: 3, linkedin: 24, zhaopin: 24, lagou: 24, liepin: 12 };
          const expiring: Array<{ name: string; minutesLeft: number }> = [];
          for (const p of allPlatforms) {
            const plat = p as unknown as { code: string; connection_status: string; session_expires_at?: string; display_name_zh?: string; display_name: string };
            if (plat.connection_status !== 'active' || !plat.session_expires_at) continue;
            const msLeft = new Date(plat.session_expires_at).getTime() - Date.now();
            const ttlMs = (TTL_MAP[plat.code] || 24) * 60 * 60 * 1000;
            if (msLeft > 0 && msLeft < ttlMs * 0.2) {
              expiring.push({ name: plat.display_name_zh || plat.display_name, minutesLeft: Math.round(msLeft / 60000) });
            }
          }
          setExpiringPlatforms(expiring);
        }
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

  // Realtime: agent_instance status updates → refresh cards without reload
  const handleAgentChange = useCallback((row: Record<string, unknown>) => {
    const id = row.id as string;
    setAgentOverrides(prev => ({
      ...prev,
      [id]: {
        frontend_status: (row.frontend_status as string) || prev[id]?.frontend_status || '',
        runtime_state: (row.runtime_state as string) || prev[id]?.runtime_state || '',
        total_tasks_completed: (row.total_tasks_completed as number) ?? prev[id]?.total_tasks_completed ?? 0,
        last_active_at: (row.last_active_at as string) || prev[id]?.last_active_at || null,
      },
    }));
  }, []);
  useAgentUpdates(teamId, handleAgentChange);

  // Realtime: ALL timeline events → agent terminal logs
  const EVT_TO_ROLE: Record<string, string> = useMemo(() => ({
    resume_analysis_started: 'profile_intelligence',
    resume_analysis_completed: 'profile_intelligence',
    keyword_generated: 'profile_intelligence',
    task_keyword_generation_completed: 'profile_intelligence',
    platform_search_started: 'opportunity_research',
    platform_search_completed: 'opportunity_research',
    task_opportunity_discovery_completed: 'opportunity_research',
    screening_started: 'matching_review',
    opportunity_screened: 'matching_review',
    task_screening_completed: 'matching_review',
    material_started: 'materials_advisor',
    material_completed: 'materials_advisor',
    task_material_generation_completed: 'materials_advisor',
    submission_started: 'application_executor',
    submission_success: 'application_executor',
    submission_failed: 'application_executor',
    task_submission_completed: 'application_executor',
    boss_greeting_sent: 'application_executor',
    boss_greeting_failed: 'application_executor',
    reply_detected: 'relationship_manager',
    task_reply_processing_completed: 'relationship_manager',
    task_follow_up_completed: 'relationship_manager',
    task_first_contact_completed: 'relationship_manager',
    task_assigned: 'orchestrator',
    dispatch_assign: 'orchestrator',
    team_started: 'orchestrator',
    team_paused: 'orchestrator',
    agent_online: 'orchestrator',
    agent_report: 'orchestrator',
  }), []);

  const handleAllEvent = useCallback((row: Record<string, unknown>) => {
    const evtType = row.event_type as string;
    if (evtType === 'system_heartbeat') return;
    const roleCode = EVT_TO_ROLE[evtType] || 'orchestrator';
    const ts = new Date(row.occurred_at as string || Date.now());
    const timeStr = `${String(ts.getHours()).padStart(2, '0')}:${String(ts.getMinutes()).padStart(2, '0')}`;
    const label = EVENT_TYPE_ZH[evtType] || evtType;
    const text = (row.summary_text as string) || label;

    setAgentLogs(prev => {
      const existing = prev[roleCode] || [];
      return {
        ...prev,
        [roleCode]: [{ time: timeStr, text }, ...existing].slice(0, 6),
      };
    });
  }, [EVT_TO_ROLE]);
  useAllTimelineEvents(teamId, handleAllEvent);

  const isTeamActive = data?.team?.runtime_status === 'active';
  const agents: AgentData[] = data?.agents || [];

  // Track which agents are "typing" — had an event in the last 90 seconds
  const [typingAgents, setTypingAgents] = useState<Record<string, number>>({});
  // When a new event comes in, mark that agent as typing
  useEffect(() => {
    if (liveFeedItems.length === 0) return;
    const latest = liveFeedItems[0];
    if (!latest) return;
    const evtToRole: Record<string, string> = {
      resume_analysis_started: 'profile_intelligence', resume_analysis_completed: 'profile_intelligence',
      keyword_generated: 'profile_intelligence', task_keyword_generation_completed: 'profile_intelligence',
      platform_search_started: 'opportunity_research', platform_search_completed: 'opportunity_research',
      task_opportunity_discovery_completed: 'opportunity_research',
      screening_started: 'matching_review', opportunity_screened: 'matching_review', task_screening_completed: 'matching_review',
      material_started: 'materials_advisor', material_completed: 'materials_advisor', task_material_generation_completed: 'materials_advisor',
      submission_started: 'application_executor', submission_success: 'application_executor', submission_failed: 'application_executor',
      task_submission_completed: 'application_executor', boss_greeting_sent: 'application_executor',
      reply_detected: 'relationship_manager', task_reply_processing_completed: 'relationship_manager',
      dispatch_assign: 'orchestrator', task_assigned: 'orchestrator', team_started: 'orchestrator',
    };
    const role = evtToRole[latest.event_type] || null;
    if (!role) return;
    setTypingAgents(prev => ({ ...prev, [role]: Date.now() }));
  }, [liveFeedItems]);

  // Clear stale typing indicators every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setTypingAgents(prev => {
        const now = Date.now();
        const next: Record<string, number> = {};
        for (const [role, ts] of Object.entries(prev)) {
          if (now - ts < 90_000) next[role] = ts;
        }
        return Object.keys(next).length === Object.keys(prev).length ? prev : next;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Merge realtime items with initial feed, dedup by id, filter out heartbeats
  const initialFeed = data?.live_feed || [];
  const seenIds = new Set(liveFeedItems.map(i => i.id));
  const mergedFeed = [...liveFeedItems, ...initialFeed.filter(i => !seenIds.has(i.id))]
    .filter(i => i.event_type !== 'system_heartbeat');
  const feed = mergedFeed;
  const handoffs = data?.handoff_summary?.items || [];
  const stats = data?.today_stats;

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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-display font-extrabold tracking-tight">Mission Control</h1>
          <p className="text-sm text-muted-foreground mt-1">全天候精英运营 · {agents.length} 位专员协同工作</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full surface-card">
          <div className={`w-2.5 h-2.5 rounded-full ${isTeamActive ? 'bg-status-active animate-pulse' : 'bg-muted-foreground/30'}`} />
          <span className="text-xs font-label uppercase tracking-wider">
            {isTeamActive ? '全系统运行中' : '系统已暂停'}
          </span>
        </div>
      </div>

      {/* Platform expiry warnings */}
      {expiringPlatforms.length > 0 && (
        <div className="space-y-2">
          {expiringPlatforms.map(p => (
            <Link key={p.name} href="/platforms" className="block rounded-xl border border-status-warning/30 bg-status-warning/5 px-4 py-3 hover:bg-status-warning/10 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-status-warning text-sm">⚠</span>
                  <span className="text-sm font-bold">{p.name}登录即将过期</span>
                  <span className="text-xs text-muted-foreground">（剩余 {p.minutesLeft} 分钟）</span>
                </div>
                <span className="text-xs text-status-warning font-bold">点击刷新 →</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* ===== SECTION 1: Agent Cards — Horizontal Scroll ===== */}
      {agents.length > 0 && (
        <section>
          <div className="flex items-end justify-between px-1 mb-4">
            <h2 className="text-xs font-label uppercase tracking-widest text-muted-foreground">Active Operations Team</h2>
            <span className="text-xs text-muted-foreground/50">Horizontal Scroll →</span>
          </div>
          <div className="flex gap-5 overflow-x-auto pb-4 snap-x hide-scrollbar">
            {agents.map((agent, i) => {
              // Merge realtime overrides
              const ov = agentOverrides[agent.id];
              const status = ov?.frontend_status || agent.frontend_status;
              const runtimeState = ov?.runtime_state || agent.runtime_state;
              const tasksCompleted = ov?.total_tasks_completed ?? agent.total_tasks_completed;
              const lastActive = ov?.last_active_at || agent.last_active_at;
              const isActive = status === 'working' || runtimeState === 'active' || (isTeamActive && runtimeState !== 'sleeping');
              const AvatarComponent = PIXEL_AVATARS[agent.template_role_code];
              return (
                <AnimatedContent key={agent.id} delay={i * 0.06}>
                  <div className={`flex-none w-[280px] snap-start surface-card rounded-2xl p-5 flex flex-col h-[360px] border transition-all duration-300 ${
                    isActive
                      ? 'border-status-active/20 ring-2 ring-status-active/10 shadow-md'
                      : 'border-border/30 opacity-60'
                  }`}>
                    {/* Top: Avatar + Status */}
                    <div className="flex justify-between items-start">
                      <div className="w-14 h-14 rounded-xl bg-surface-low flex items-center justify-center border border-border/20">
                        {AvatarComponent ? <AvatarComponent size={44} /> : <span className="text-2xl">👤</span>}
                      </div>
                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                        isActive
                          ? 'bg-status-active/10 text-status-active'
                          : 'bg-muted/50 text-muted-foreground'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-status-active animate-pulse' : 'bg-muted-foreground/40'}`} />
                        {isActive ? '运行中' : '待命'}
                      </div>
                    </div>

                    {/* Name */}
                    <div className="mt-3">
                      <h4 className="text-base font-display font-extrabold leading-tight">
                        {agent.role_title_zh}
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {AGENT_ENGLISH_SUBTITLE[agent.template_role_code] || agent.persona_name}
                      </p>
                    </div>

                    {/* Current task pill */}
                    <div className="mt-2">
                      <span className={`inline-block text-[10px] px-3 py-1 rounded-full font-label tracking-tight ${
                        isActive
                          ? 'bg-foreground text-background'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {isActive ? (runtimeState === 'active' ? '执行任务中' : '等待调度') : '空闲'}
                      </span>
                    </div>

                    {/* Terminal output area — real-time agent logs */}
                    <div className="mt-3 flex-1 overflow-hidden bg-foreground/[0.03] rounded-lg p-2.5 font-mono text-[10px] text-muted-foreground/70 leading-relaxed overflow-y-auto">
                      {(() => {
                        const logs = agentLogs[agent.template_role_code];
                        if (logs && logs.length > 0) {
                          return logs.map((log, li) => (
                            <div key={li} className="truncate">
                              <span className="text-muted-foreground/40">[{log.time}]</span>{' '}
                              <span className={li === 0 ? 'text-foreground/70' : ''}>{log.text}</span>
                            </div>
                          ));
                        }
                        if (isActive) {
                          return <span className="text-muted-foreground/40">等待任务分配...</span>;
                        }
                        return <span className="text-muted-foreground/30">// 暂无活跃进程</span>;
                      })()}
                    </div>

                    {/* Bottom stats */}
                    <div className="mt-3 pt-3 border-t border-border/10 flex justify-between items-center text-[10px] font-label text-muted-foreground">
                      <span>Tasks: {tasksCompleted || 0} completed</span>
                      <span>{lastActive ? timeAgo(lastActive) : '—'}</span>
                    </div>
                  </div>
                </AnimatedContent>
              );
            })}
          </div>
        </section>
      )}

      {/* ===== SECTION 2: KPI Bar ===== */}
      {stats && (
        <AnimatedContent delay={0.1}>
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: '岗位发现', value: stats.discovered, key: 'discovered' },
              { label: 'AI 筛选', value: stats.screened, key: 'screened' },
              { label: '材料生成', value: stats.materials_generated, key: 'materials' },
              { label: '已投递', value: stats.submitted, key: 'submitted' },
            ].map((kpi) => (
              <div key={kpi.key} className="surface-card rounded-2xl p-5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-label uppercase tracking-widest text-muted-foreground">{kpi.label}</p>
                  <p className="text-3xl font-display font-extrabold mt-1">{kpi.value}</p>
                </div>
                <div className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                  kpi.value > 0 ? 'bg-status-active/10 text-status-active' : 'bg-muted/50 text-muted-foreground'
                }`}>
                  +{kpi.value} 今日
                </div>
              </div>
            ))}
          </section>
        </AnimatedContent>
      )}

      {/* ===== SECTION 3: Two-Column — Feed + Sidebar ===== */}
      <section className="grid lg:grid-cols-[3fr_2fr] gap-6">
        {/* Left: Agency Chat Feed */}
        <div className="surface-card rounded-2xl flex flex-col h-[520px]">
          {/* Chat header */}
          <div className="px-5 py-4 border-b border-border/10 flex justify-between items-center">
            <h3 className="text-sm font-display font-bold">团队协作动态</h3>
            <Link href="/opportunities" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              查看全部 →
            </Link>
          </div>

          {/* Typing indicator */}
          {(() => {
            const now = Date.now();
            const active = Object.entries(typingAgents)
              .filter(([, ts]) => now - ts < 90_000)
              .map(([role]) => AGENT_ROLE_ZH[role] || role);
            if (active.length === 0 || !isTeamActive) return null;
            return (
              <div className="px-5 py-2.5 border-b border-border/5 flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-status-active animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-status-active animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-status-active animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-xs text-muted-foreground">
                  <span className="font-bold text-foreground/70">{active.join('、')}</span> 正在工作中...
                </span>
              </div>
            );
          })()}

          {/* Chat body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {feed.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-muted-foreground">暂无动态 — 启动团队后，专员活动将显示在此处</p>
              </div>
            ) : (
              feed.slice(0, 15).map((item, i) => {
                const actor = resolveActorLabel(item, agents);
                const emoji = EVENT_EMOJI[item.event_type] || '💬';
                const isDispatch = item.event_type === 'dispatch_assign' || item.event_type === 'task_assigned';

                return (
                  <AnimatedContent key={item.id} delay={i * 0.04}>
                    <div className="flex gap-3">
                      {/* Agent mini avatar */}
                      <div className="flex-none mt-0.5">
                        {actor.roleCode ? (
                          <AgentMiniAvatar roleCode={actor.roleCode} size={28} />
                        ) : (
                          <div className="w-7 h-7 rounded bg-muted flex items-center justify-center text-xs">👤</div>
                        )}
                      </div>
                      {/* Message */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold">{actor.name}</span>
                          <span className="text-[10px] text-muted-foreground/60">{timeAgo(item.occurred_at)}</span>
                        </div>
                        <div className={`mt-1 rounded-r-xl rounded-bl-xl p-3 text-sm leading-relaxed max-w-[90%] ${
                          isDispatch
                            ? 'bg-surface-low shadow-sm'
                            : 'bg-status-active/[0.04] border border-status-active/10'
                        }`}>
                          <span className="mr-1">{emoji}</span>
                          {isDispatch && item.summary_text.includes('@') ? (
                            <span>
                              {item.summary_text.split(/(@\S+)/).map((part, pi) =>
                                part.startsWith('@') ? (
                                  <span key={pi} className="text-status-active font-bold">{part}</span>
                                ) : (
                                  <span key={pi}>{part}</span>
                                )
                              )}
                            </span>
                          ) : (
                            <span>{item.summary_text}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </AnimatedContent>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Stacked Cards */}
        <div className="space-y-5">
          {/* Card 1: Runtime Status */}
          <AnimatedContent delay={0.15}>
            <div className="surface-card rounded-2xl p-6 bg-foreground text-background">
              <h3 className="text-xs font-label uppercase tracking-widest text-background/60 mb-4">运行状态</h3>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-sm font-bold text-background/80">{data?.team?.plan_tier || 'Free'} 方案</span>
              </div>
              <p className="text-2xl font-display font-extrabold mb-3">
                {formatRuntime(data?.runtime?.effective_balance_seconds || 0)}
              </p>
              {/* Progress bar */}
              <div className="w-full h-1.5 rounded-full bg-background/10 mb-4">
                <div
                  className="h-full rounded-full bg-status-active transition-all duration-700"
                  style={{ width: `${runtimePercent(data?.runtime?.effective_balance_seconds || 0, data?.team?.plan_tier || 'free')}%` }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-background/10">
                <div>
                  <p className="text-[10px] text-background/40 font-label uppercase">Agent 调用</p>
                  <p className="text-lg font-display font-bold">{stats?.total_llm_calls || 0}</p>
                </div>
                <div>
                  <p className="text-[10px] text-background/40 font-label uppercase">专员在线</p>
                  <p className="text-lg font-display font-bold">
                    {agents.filter(a => a.frontend_status === 'working' || a.runtime_state === 'active').length}/{agents.length}
                  </p>
                </div>
              </div>
              <Link href="/settings" className="mt-4 inline-block text-xs text-background/60 hover:text-background/90 transition-colors">
                管理套餐 →
              </Link>
            </div>
          </AnimatedContent>

          {/* Card 2: Handoff / All Clear */}
          <AnimatedContent delay={0.2}>
            <div className={`surface-card rounded-2xl p-6 ${
              handoffs.length > 0 ? 'ring-1 ring-status-warning/20' : ''
            }`}>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">{handoffs.length > 0 ? '⚡' : '✅'}</span>
                <h3 className="text-sm font-display font-bold">需要你接管</h3>
              </div>

              {handoffs.length > 0 ? (
                <div className="space-y-4">
                  <p className="text-xs text-muted-foreground">
                    {handoffs.length} 项待处理
                  </p>
                  {handoffs.slice(0, 3).map((h) => (
                    <div key={h.id} className="p-3 rounded-xl bg-status-warning/5 border border-status-warning/10">
                      <p className="text-[10px] font-label uppercase tracking-widest text-muted-foreground mb-1">
                        {HANDOFF_TYPE_ZH[h.handoff_type] || h.handoff_type}
                      </p>
                      <p className="text-sm font-semibold">
                        {h.opportunity?.job_title || h.handoff_reason}
                      </p>
                      {h.opportunity?.company_name && (
                        <p className="text-xs text-muted-foreground mt-0.5">{h.opportunity.company_name}</p>
                      )}
                    </div>
                  ))}
                  <Link href="/review" className="block px-4 py-2.5 text-xs font-semibold rounded-xl bg-foreground text-background text-center hover:opacity-90 transition-opacity">
                    查看全部接管项
                  </Link>
                </div>
              ) : (
                <div className="py-4">
                  <p className="text-sm text-muted-foreground">
                    一切顺利 — AI 专员自主运行中
                  </p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    当需要人工决策时，会在此处提醒你
                  </p>
                </div>
              )}
            </div>
          </AnimatedContent>
        </div>
      </section>
    </div>
  );
}
