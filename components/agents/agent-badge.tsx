'use client';

import { CardFlip } from '@/components/ui/card-flip';
import { PIXEL_AVATARS } from './pixel-avatars';

export type AgentInfo = {
  id: string;
  role_code: string;
  title_zh: string;
  persona_name: string;
  status: 'working' | 'ready' | 'paused' | 'blocked' | 'idle' | 'waiting';
  current_task?: string;
  stats?: { tasks_completed: number; last_active?: string };
};

const STATUS_CONFIG: Record<string, { color: string; label: string; pulse: boolean }> = {
  working: { color: 'bg-status-active', label: '运行中', pulse: true },
  ready: { color: 'bg-status-info', label: '待命中', pulse: false },
  paused: { color: 'bg-muted-foreground/40', label: '已暂停', pulse: false },
  blocked: { color: 'bg-status-warning', label: '等待中', pulse: false },
  idle: { color: 'bg-muted-foreground/30', label: '休眠', pulse: false },
  waiting: { color: 'bg-status-warning', label: '需关注', pulse: true },
};

function AgentAvatar({ roleCode, size = 48 }: { roleCode: string; size?: number }) {
  const AvatarComponent = PIXEL_AVATARS[roleCode];
  if (AvatarComponent) return <AvatarComponent size={size} />;
  return <div className="bg-surface-low rounded-xl flex items-center justify-center" style={{ width: size, height: size }}>👤</div>;
}

export function AgentBadge({ agent, size = 'normal' }: { agent: AgentInfo; size?: 'normal' | 'compact' }) {
  const config = STATUS_CONFIG[agent.status] || STATUS_CONFIG.idle;

  if (size === 'compact') {
    return (
      <div className="flex flex-col items-center gap-2 p-3">
        <div className="relative">
          <AgentAvatar roleCode={agent.role_code} size={48} />
          <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ${config.color} ring-2 ring-white ${config.pulse ? 'animate-pulse' : ''}`} />
        </div>
        <div className="text-center">
          <div className="text-xs font-semibold font-display">{agent.title_zh}</div>
          <div className="text-[10px] text-muted-foreground">{config.label}</div>
        </div>
      </div>
    );
  }

  const front = (
    <div className="surface-card h-full flex flex-col items-center p-6 cursor-pointer hover:shadow-lifted transition-shadow duration-300">
      {/* Lanyard line */}
      <div className="w-px h-6 bg-border -mt-6 mb-3" />
      <div className="w-6 h-2 rounded-full bg-border/50 mb-4" />

      {/* Avatar */}
      <div className="mb-4">
        <AgentAvatar roleCode={agent.role_code} size={64} />
      </div>

      {/* Identity */}
      <h3 className="text-base font-semibold font-display">{agent.title_zh}</h3>
      <p className="text-sm text-muted-foreground font-label">{agent.persona_name}</p>

      {/* Divider */}
      <div className="w-12 h-px bg-border/30 my-3" />

      {/* Status */}
      <div className="flex items-center gap-1.5">
        <div className={`w-2 h-2 rounded-full ${config.color} ${config.pulse ? 'animate-pulse' : ''}`} />
        <span className="text-xs text-muted-foreground">{config.label}</span>
      </div>
    </div>
  );

  const back = (
    <div className="surface-card h-full flex flex-col p-6 cursor-pointer">
      <h4 className="text-sm font-semibold font-display mb-3">当前任务</h4>
      <div className="text-xs text-muted-foreground mb-4">
        {agent.current_task || '暂无进行中的任务'}
      </div>

      <h4 className="text-sm font-semibold font-display mb-2">工作统计</h4>
      <div className="text-xs text-muted-foreground space-y-1">
        <div>已完成 {agent.stats?.tasks_completed || 0} 个任务</div>
        {agent.stats?.last_active && (
          <div>最近活跃: {new Date(agent.stats.last_active).toLocaleString('zh-CN')}</div>
        )}
      </div>

      <div className="mt-auto pt-4">
        <div className="text-[10px] text-muted-foreground/60 font-label uppercase tracking-wider">
          {agent.role_code.replace(/_/g, ' ')}
        </div>
      </div>
    </div>
  );

  return (
    <CardFlip front={front} back={back} className="w-[180px] h-[280px]" flipOnHover />
  );
}

export function AgentBadgeDropIn({
  agent,
  index,
}: {
  agent: AgentInfo;
  index: number;
}) {
  return (
    <div
      className="animate-[dropIn_0.6s_ease-out_both]"
      style={{ animationDelay: `${index * 200}ms` }}
    >
      <AgentBadge agent={agent} />
    </div>
  );
}
