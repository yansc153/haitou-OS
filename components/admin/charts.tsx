'use client';

// ── Donut Chart ──
// Pure SVG donut for status distributions

type DonutSegment = { label: string; value: number; color: string };

const STATUS_COLORS: Record<string, string> = {
  active: 'hsl(142 71% 45%)',
  paused: 'hsl(38 92% 50%)',
  ready: 'hsl(221 83% 53%)',
  draft: 'hsl(0 0% 70%)',
  onboarding: 'hsl(270 60% 55%)',
  suspended: 'hsl(0 84% 60%)',
  archived: 'hsl(0 0% 50%)',
  // Funnel
  discovered: 'hsl(221 83% 53%)',
  screened: 'hsl(200 70% 50%)',
  prioritized: 'hsl(175 60% 45%)',
  material_ready: 'hsl(142 60% 45%)',
  submitted: 'hsl(142 71% 40%)',
  contact_started: 'hsl(38 70% 50%)',
  followup_active: 'hsl(38 92% 50%)',
  positive_progression: 'hsl(25 90% 50%)',
  needs_takeover: 'hsl(0 84% 60%)',
  closed: 'hsl(0 0% 60%)',
  // Handoff types
  private_contact: 'hsl(270 60% 55%)',
  interview_time: 'hsl(142 71% 45%)',
  salary_confirmation: 'hsl(38 92% 50%)',
  offer_decision: 'hsl(25 90% 50%)',
  work_arrangement: 'hsl(221 83% 53%)',
  visa_eligibility: 'hsl(200 70% 50%)',
  reference_check: 'hsl(175 60% 45%)',
  other_high_risk: 'hsl(0 84% 60%)',
  // Task types
  screening: 'hsl(221 83% 53%)',
  opportunity_discovery: 'hsl(200 70% 50%)',
  submission: 'hsl(142 71% 45%)',
  material_generation: 'hsl(38 92% 50%)',
  first_contact: 'hsl(270 60% 55%)',
  follow_up: 'hsl(25 90% 50%)',
  reply_processing: 'hsl(175 60% 45%)',
};

function getColor(key: string, index: number): string {
  if (STATUS_COLORS[key]) return STATUS_COLORS[key];
  const fallback = ['hsl(221 83% 53%)', 'hsl(142 71% 45%)', 'hsl(38 92% 50%)', 'hsl(0 84% 60%)', 'hsl(270 60% 55%)', 'hsl(200 70% 50%)'];
  return fallback[index % fallback.length];
}

export function DonutChart({ data, label }: { data: Record<string, number>; label?: string }) {
  const entries = Object.entries(data).filter(([, v]) => v > 0);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">暂无数据</div>
    );
  }

  const segments: DonutSegment[] = entries.map(([k, v], i) => ({
    label: k,
    value: v,
    color: getColor(k, i),
  }));

  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 100 100" className="w-32 h-32 flex-shrink-0">
        {segments.map((seg) => {
          const dashLength = (seg.value / total) * circumference;
          const currentOffset = offset;
          offset += dashLength;
          return (
            <circle
              key={seg.label}
              cx="50" cy="50" r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth="12"
              strokeDasharray={`${dashLength} ${circumference - dashLength}`}
              strokeDashoffset={-currentOffset}
              strokeLinecap="butt"
              transform="rotate(-90 50 50)"
            />
          );
        })}
        <text x="50" y="46" textAnchor="middle" className="fill-foreground" style={{ fontSize: '16px', fontWeight: 800, fontFamily: 'Manrope' }}>
          {total}
        </text>
        {label && (
          <text x="50" y="60" textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: '8px', fontFamily: 'Inter' }}>
            {label}
          </text>
        )}
      </svg>
      <div className="flex flex-col gap-1.5 min-w-0">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: seg.color }} />
            <span className="text-muted-foreground truncate">{LABEL_ZH[seg.label] || seg.label}</span>
            <span className="font-semibold ml-auto">{seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Funnel Bar Chart ──
// Horizontal bars showing opportunity pipeline stages

const FUNNEL_ORDER = ['discovered', 'screened', 'prioritized', 'material_ready', 'submitted', 'contact_started', 'followup_active', 'positive_progression', 'needs_takeover', 'closed'];

export function FunnelBar({ data }: { data: Record<string, number> }) {
  const stages = FUNNEL_ORDER.filter(s => data[s] !== undefined && data[s] > 0);
  if (stages.length === 0) {
    return <div className="text-sm text-muted-foreground text-center py-4">暂无机会数据</div>;
  }
  const maxVal = Math.max(...stages.map(s => data[s]));

  return (
    <div className="space-y-2.5">
      {stages.map((stage, i) => {
        const val = data[stage];
        const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;
        return (
          <div key={stage} className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-20 text-right truncate">{LABEL_ZH[stage] || stage}</span>
            <div className="flex-1 h-6 rounded-lg bg-surface-low overflow-hidden">
              <div
                className="h-full rounded-lg transition-all duration-500"
                style={{
                  width: `${Math.max(pct, 2)}%`,
                  backgroundColor: getColor(stage, i),
                  opacity: 0.85,
                }}
              />
            </div>
            <span className="text-xs font-semibold w-8 text-right">{val}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Stacked Bar (Platform Health) ──

type PlatformConn = { name: string; total: number; active: number; expired: number };

export function PlatformHealthBar({ data }: { data: PlatformConn[] }) {
  if (data.length === 0) {
    return <div className="text-sm text-muted-foreground text-center py-4">暂无平台连接</div>;
  }
  const maxTotal = Math.max(...data.map(d => d.total), 1);

  return (
    <div className="space-y-3">
      {data.map((p) => {
        const activePct = (p.active / maxTotal) * 100;
        const expiredPct = (p.expired / maxTotal) * 100;
        return (
          <div key={p.name}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold">{p.name}</span>
              <span className="text-xs text-muted-foreground">{p.active}/{p.total}</span>
            </div>
            <div className="h-4 rounded-full bg-surface-low overflow-hidden flex">
              {p.active > 0 && (
                <div className="h-full bg-status-active/80 transition-all" style={{ width: `${Math.max(activePct, 3)}%` }} />
              )}
              {p.expired > 0 && (
                <div className="h-full bg-status-error/60 transition-all" style={{ width: `${Math.max(expiredPct, 3)}%` }} />
              )}
            </div>
          </div>
        );
      })}
      <div className="flex items-center gap-4 text-[10px] text-muted-foreground pt-1">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-status-active/80" />活跃</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-status-error/60" />已过期</span>
      </div>
    </div>
  );
}

// ── KPI Card ──

export function KpiCard({ value, label, sub, accent }: { value: string | number; label: string; sub?: string; accent?: 'green' | 'gold' | 'red' | 'blue' }) {
  const accentMap = {
    green: 'text-status-active',
    gold: 'text-accent',
    red: 'text-status-error',
    blue: 'text-status-info',
  };
  return (
    <div className="surface-card p-5 rounded-2xl">
      <p className={`text-3xl font-display font-extrabold tracking-tight ${accent ? accentMap[accent] : ''}`}>
        {value}
      </p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
      {sub && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Mini Bar Chart (for task types) ──

export function MiniBarChart({ data, maxItems }: { data: Record<string, number>; maxItems?: number }) {
  const sorted = Object.entries(data).sort(([, a], [, b]) => b - a).slice(0, maxItems || 8);
  if (sorted.length === 0) {
    return <div className="text-sm text-muted-foreground text-center py-4">暂无任务数据</div>;
  }
  const maxVal = Math.max(...sorted.map(([, v]) => v));

  return (
    <div className="space-y-2">
      {sorted.map(([key, val], i) => {
        const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;
        return (
          <div key={key} className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-24 text-right truncate">{LABEL_ZH[key] || key}</span>
            <div className="flex-1 h-4 rounded bg-surface-low overflow-hidden">
              <div
                className="h-full rounded transition-all duration-300"
                style={{ width: `${Math.max(pct, 3)}%`, backgroundColor: getColor(key, i) }}
              />
            </div>
            <span className="text-[10px] font-semibold w-6 text-right">{val}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Activity Stream ──

export function ActivityStream({ events }: { events: Array<{ id: string; event_type: string; summary_text: string; team_name: string; occurred_at: string }> }) {
  if (events.length === 0) {
    return <div className="text-sm text-muted-foreground text-center py-6">暂无系统活动</div>;
  }

  return (
    <div className="space-y-1">
      {events.map((e) => (
        <div key={e.id} className="flex items-start gap-3 py-2.5 border-b border-border/10 last:border-0">
          <div className="w-1.5 h-1.5 rounded-full bg-secondary mt-1.5 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-label uppercase tracking-wider text-secondary font-semibold">{e.team_name}</span>
              <span className="text-[10px] text-muted-foreground/50">{LABEL_ZH[e.event_type] || e.event_type}</span>
            </div>
            <p className="text-xs text-muted-foreground truncate">{e.summary_text}</p>
          </div>
          <span className="text-[10px] text-muted-foreground/40 flex-shrink-0 mt-0.5">{timeAgo(e.occurred_at)}</span>
        </div>
      ))}
    </div>
  );
}

// ── User Table ──

type UserRow = {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
  team_status: string;
  runtime_status: string;
  plan_tier: string;
  team_name: string;
};

const PLAN_BADGE: Record<string, string> = {
  free: 'bg-surface-low text-muted-foreground',
  pro: 'bg-secondary/10 text-secondary',
  plus: 'bg-accent/10 text-accent',
};

export function UserTable({ users }: { users: UserRow[] }) {
  if (users.length === 0) {
    return <div className="text-sm text-muted-foreground text-center py-6">暂无用户</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border/20">
            <th className="text-left py-2.5 px-3 font-label uppercase tracking-wider text-muted-foreground/60 text-[10px]">用户</th>
            <th className="text-left py-2.5 px-3 font-label uppercase tracking-wider text-muted-foreground/60 text-[10px]">团队</th>
            <th className="text-left py-2.5 px-3 font-label uppercase tracking-wider text-muted-foreground/60 text-[10px]">状态</th>
            <th className="text-left py-2.5 px-3 font-label uppercase tracking-wider text-muted-foreground/60 text-[10px]">运行</th>
            <th className="text-left py-2.5 px-3 font-label uppercase tracking-wider text-muted-foreground/60 text-[10px]">套餐</th>
            <th className="text-left py-2.5 px-3 font-label uppercase tracking-wider text-muted-foreground/60 text-[10px]">注册时间</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-border/10 hover:bg-surface-low/50 transition-colors">
              <td className="py-2.5 px-3">
                <div className="font-semibold truncate max-w-[180px]">{u.display_name || u.email}</div>
                {u.display_name && <div className="text-[10px] text-muted-foreground/50 truncate max-w-[180px]">{u.email}</div>}
              </td>
              <td className="py-2.5 px-3 text-muted-foreground">{u.team_name || '-'}</td>
              <td className="py-2.5 px-3">
                <span className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${u.team_status === 'active' ? 'bg-status-active' : u.team_status === 'paused' ? 'bg-status-warning' : 'bg-muted-foreground/30'}`} />
                  {LABEL_ZH[u.team_status] || u.team_status}
                </span>
              </td>
              <td className="py-2.5 px-3">
                <span className={`w-1.5 h-1.5 rounded-full inline-block mr-1 ${u.runtime_status === 'active' ? 'bg-status-active animate-pulse' : 'bg-muted-foreground/20'}`} />
                {LABEL_ZH[u.runtime_status] || u.runtime_status || '-'}
              </td>
              <td className="py-2.5 px-3">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${PLAN_BADGE[u.plan_tier] || PLAN_BADGE.free}`}>
                  {u.plan_tier}
                </span>
              </td>
              <td className="py-2.5 px-3 text-muted-foreground">{u.created_at ? new Date(u.created_at).toLocaleDateString('zh-CN') : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Submission Outcome Bars ──

export function OutcomeBar({ data }: { data: { success: number; blocked: number; error: number } }) {
  const total = data.success + data.blocked + data.error;
  if (total === 0) {
    return <div className="text-sm text-muted-foreground text-center py-2">暂无投递记录</div>;
  }

  return (
    <div>
      <div className="h-5 rounded-full overflow-hidden flex bg-surface-low">
        {data.success > 0 && (
          <div className="h-full bg-status-active/80" style={{ width: `${(data.success / total) * 100}%` }} />
        )}
        {data.blocked > 0 && (
          <div className="h-full bg-status-warning/70" style={{ width: `${(data.blocked / total) * 100}%` }} />
        )}
        {data.error > 0 && (
          <div className="h-full bg-status-error/70" style={{ width: `${(data.error / total) * 100}%` }} />
        )}
      </div>
      <div className="flex items-center gap-4 text-[10px] text-muted-foreground mt-2">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-status-active/80" />成功 {data.success}</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-status-warning/70" />已拦截 {data.blocked}</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-status-error/70" />失败 {data.error}</span>
      </div>
    </div>
  );
}

// ── Shared helpers ──

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}小时前`;
  return `${Math.floor(hrs / 24)}天前`;
}

const LABEL_ZH: Record<string, string> = {
  // Team status
  active: '运行中',
  paused: '已暂停',
  ready: '就绪',
  draft: '草稿',
  onboarding: '初始化',
  suspended: '已冻结',
  archived: '已归档',
  activation_pending: '待激活',
  // Opportunity stages
  discovered: '已发现',
  screened: '已筛选',
  prioritized: '已优选',
  material_ready: '材料就绪',
  submitted: '已投递',
  contact_started: '已联系',
  followup_active: '跟进中',
  positive_progression: '进展积极',
  needs_takeover: '需接管',
  closed: '已关闭',
  // Task types
  screening: '筛选评估',
  opportunity_discovery: '岗位发现',
  submission: '投递执行',
  material_generation: '材料生成',
  first_contact: '首次联系',
  follow_up: '跟进消息',
  reply_processing: '回复处理',
  // Handoff types
  private_contact: '私人联系',
  interview_time: '面试安排',
  salary_confirmation: '薪资确认',
  offer_decision: 'Offer 决策',
  work_arrangement: '工作安排',
  visa_eligibility: '签证事项',
  reference_check: '背景核查',
  other_high_risk: '其他高风险',
  // Runtime
  idle: '空闲',
  starting: '启动中',
  pausing: '暂停中',
  attention_required: '需关注',
  // Events
  team_started: '系统启动',
  team_paused: '系统暂停',
  team_forced_pause: '强制暂停',
  opportunity_screened: '岗位筛选',
  task_opportunity_discovery_completed: '岗位发现',
  submission_success: '投递成功',
  submission_failed: '投递失败',
  handoff_takeover: '交接处理',
  budget_exhausted: '预算用尽',
};
