'use client';

import { useState } from 'react';
import { AnimatedContent } from '@/components/ui/animated-content';
import { SpotlightCard } from '@/components/ui/spotlight-card';
import { PIXEL_AVATARS } from '@/components/agents/pixel-avatars';

type Handoff = {
  id: string; type: string; typeLabel: string; urgency: 'critical' | 'high' | 'medium';
  title: string; person: string; personRole: string; company: string;
  reason: string; context: string; quote?: string;
  sentiment: { label: string; value: string; color: string };
  risk: { label: string; color: string };
  agentLogs: Array<{ time: string; event: string }>;
  takeoverReason: string; takeoverDetails: string[];
  suggestedActions: Array<{ icon: string; label: string; desc: string }>;
  assignedAgent: string; assignedAgentRole: string;
  time: string; refId: string;
};

const MOCK_HANDOFFS: Handoff[] = [
  {
    id: '1', type: 'private_contact', typeLabel: '私人联系方式', urgency: 'high',
    title: 'Private Contact Transfer', person: 'Alexander Vance', personRole: 'Principal Eng @ CloudScale', company: 'Protocol Engines',
    reason: '候选人请求加密通道讨论薪资',
    context: 'Scout 已经与 Alexander 沟通了 4 天。对话从技术栈对齐转移到「薪酬和隐私」话题。14:02 UTC，Alexander 拒绝通过平台聊天提供个人电话号码，引用了公司监控顾虑。',
    quote: '"I\'d prefer to discuss the final offer details over Signal or a private call. The current channel feels too formal for these specifics."',
    sentiment: { label: '情绪', value: '高兴趣 (92%)', color: 'bg-status-active/10 text-status-active' },
    risk: { label: '流失风险', color: 'bg-status-warning/10 text-status-warning' },
    agentLogs: [
      { time: '14:02', event: '触发接管' },
      { time: '13:58', event: '薪酬包已分享' },
      { time: '13:45', event: '技术面试通过' },
    ],
    takeoverReason: '系统到达「隐私边界」协议。自动化系统禁止处理平台外联系信息，以维护安全合规。',
    takeoverDetails: ['身份已验证', 'NDA 已签署'],
    suggestedActions: [
      { icon: '🔓', label: '授权访问', desc: '发送一次性安全链接' },
      { icon: '✎', label: '手动处理', desc: '进入消息编辑模式' },
      { icon: '↺', label: '交回团队', desc: '由 AI 专员继续跟进' },
    ],
    assignedAgent: 'opportunity_research', assignedAgentRole: '寻访官',
    time: '2 分钟前', refId: 'HT-9921-X',
  },
  {
    id: '2', type: 'interview_time', typeLabel: '面试安排', urgency: 'critical',
    title: 'Interview Scheduling', person: 'Sarah Chen', personRole: 'HR Director @ Google', company: 'Google',
    reason: '跨 3 个利益相关者日历检测到冲突',
    context: 'Google Cloud 团队的 D 轮负责人面试需要协调 3 位面试官的时间。系统检测到时间冲突，需要人工确认最终时间。',
    quote: '"We have a tight window next week. Can you confirm Tuesday 2pm PST works for all parties?"',
    sentiment: { label: '情绪', value: '积极 (85%)', color: 'bg-status-active/10 text-status-active' },
    risk: { label: '时效紧迫', color: 'bg-status-error/10 text-status-error' },
    agentLogs: [
      { time: '10:30', event: '面试邀请收到' },
      { time: '10:32', event: '日历冲突检测' },
      { time: '10:33', event: '触发接管' },
    ],
    takeoverReason: '面试时间确认需要你的个人日历可用性判断，自动化系统无法代替。',
    takeoverDetails: ['面试类型：技术面', '时长：60 分钟'],
    suggestedActions: [
      { icon: '✓', label: '确认时间', desc: '接受建议的面试时间' },
      { icon: '📅', label: '重新协调', desc: '提出替代时间' },
      { icon: '↺', label: '交回团队', desc: '由排程官继续协调' },
    ],
    assignedAgent: 'orchestrator', assignedAgentRole: '排程官',
    time: '14 分钟前', refId: 'HT-9918-B',
  },
  {
    id: '3', type: 'salary_confirmation', typeLabel: '背景核实', urgency: 'medium',
    title: 'Technical Portfolio Audit', person: 'DevOps Team', personRole: 'Security Review', company: 'Cortex AI',
    reason: '候选人 GitHub 仓库发现外部链接安全警告',
    context: 'Cortex AI 的安全审查团队在审核你的 GitHub 作品集时，发现了一些外部依赖的安全警告。需要确认是否更新或说明。',
    sentiment: { label: '情绪', value: '中性 (60%)', color: 'bg-status-info/10 text-status-info' },
    risk: { label: '需关注', color: 'bg-status-warning/10 text-status-warning' },
    agentLogs: [
      { time: '09:15', event: '安全扫描完成' },
      { time: '09:20', event: '3 个警告标记' },
      { time: '09:22', event: '触发接管' },
    ],
    takeoverReason: '技术作品集涉及个人代码库，需要你亲自决定如何回应安全审查。',
    takeoverDetails: ['警告数量：3', '严重级别：低'],
    suggestedActions: [
      { icon: '🔧', label: '更新依赖', desc: '修复安全警告后回复' },
      { icon: '✎', label: '说明情况', desc: '解释已知风险' },
      { icon: '↺', label: '交回团队', desc: '由审核官处理' },
    ],
    assignedAgent: 'matching_review', assignedAgentRole: '审核官',
    time: '1 小时前', refId: 'HT-9915-C',
  },
];

const URGENCY_STYLES = {
  critical: { dot: 'bg-red-500', label: '紧急' },
  high: { dot: 'bg-status-warning', label: '重要' },
  medium: { dot: 'bg-status-info', label: '待审' },
};

export default function HandoffsPage() {
  const [selected, setSelected] = useState<Handoff>(MOCK_HANDOFFS[0]);
  const [filter, setFilter] = useState('');
  const filtered = filter ? MOCK_HANDOFFS.filter(h => h.type === filter) : MOCK_HANDOFFS;

  const AgentAvatar = PIXEL_AVATARS[selected.assignedAgent];

  return (
    <div>
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-4xl font-display font-extrabold tracking-tight">等待交接</h1>
          <p className="text-sm text-muted-foreground mt-1">需要人工介入的关键决策事项</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-[320px_1fr] gap-6">
        {/* Left: List */}
        <div className="space-y-3">
          {filtered.map((h) => {
            const urg = URGENCY_STYLES[h.urgency];
            return (
              <AnimatedContent key={h.id}>
                <div
                  className={`surface-card p-5 cursor-pointer transition-all duration-200 rounded-2xl ${
                    selected.id === h.id ? 'ring-2 ring-foreground shadow-lifted -translate-y-0.5' : 'hover:shadow-card hover:-translate-y-0.5'
                  }`}
                  onClick={() => setSelected(h)}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-surface-low font-bold uppercase tracking-wider">{urg.label}</span>
                    <span className="text-xs text-muted-foreground">{h.time}</span>
                  </div>
                  <h3 className="text-sm font-bold mb-0.5">{h.title}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2">{h.reason}</p>
                  <div className="flex items-center gap-2 mt-3">
                    <div className="w-5 h-5 rounded-full bg-surface-low" />
                    <span className="text-[10px] text-muted-foreground">Assigned to {h.assignedAgentRole}</span>
                  </div>
                </div>
              </AnimatedContent>
            );
          })}
        </div>

        {/* Right: Full Detail — Stitch design */}
        <div className="surface-card rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="p-8 pb-6">
            <div className="flex items-center justify-between mb-6">
              <span className="px-3 py-1 rounded-full bg-status-warning/10 text-status-warning text-[10px] font-bold uppercase tracking-wider">
                需人工干预
              </span>
              <span className="text-xs text-muted-foreground">Ref ID: {selected.refId}</span>
            </div>

            <h2 className="text-3xl lg:text-4xl font-display font-extrabold mb-3">{selected.title}</h2>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-surface-low flex items-center justify-center text-lg">👤</div>
              <div>
                <p className="text-base font-semibold">{selected.person}</p>
                <p className="text-sm text-muted-foreground">{selected.personRole}</p>
              </div>
            </div>
          </div>

          {/* Content grid: Context + Sidebar */}
          <div className="px-8 pb-8">
            <div className="grid lg:grid-cols-[1fr_260px] gap-6">
              {/* Left: Context */}
              <div className="space-y-6">
                {/* Context Summary */}
                <div className="surface-low rounded-2xl p-6">
                  <h3 className="text-base font-bold mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 rounded bg-foreground/10 flex items-center justify-center text-xs">📋</span>
                    背景摘要
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{selected.context}</p>

                  {selected.quote && (
                    <div className="mt-4 pl-4 border-l-2 border-border/40">
                      <p className="text-sm italic text-muted-foreground/70 leading-relaxed">{selected.quote}</p>
                    </div>
                  )}
                </div>

                {/* Sentiment + Risk cards */}
                <div className="grid grid-cols-2 gap-4">
                  <div className={`rounded-2xl p-5 ${selected.sentiment.color}`}>
                    <p className="text-[10px] font-label uppercase tracking-widest mb-1 opacity-60">{selected.sentiment.label}</p>
                    <p className="text-lg font-display font-bold">{selected.sentiment.value}</p>
                  </div>
                  <div className={`rounded-2xl p-5 ${selected.risk.color}`}>
                    <p className="text-[10px] font-label uppercase tracking-widest mb-1 opacity-60">风险</p>
                    <p className="text-lg font-display font-bold">{selected.risk.label}</p>
                  </div>
                </div>
              </div>

              {/* Right sidebar: Takeover Reason + Agent Logs */}
              <div className="space-y-4">
                {/* Takeover Reason */}
                <div className="bg-foreground text-background rounded-2xl p-5">
                  <h4 className="text-sm font-bold mb-3">接管原因</h4>
                  <p className="text-xs text-background/70 leading-relaxed mb-4">{selected.takeoverReason}</p>
                  <div className="space-y-2">
                    {selected.takeoverDetails.map((d, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-status-active/20 flex items-center justify-center text-[8px] text-status-active">✓</span>
                        <span className="text-xs text-background/80">{d}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Agent Logs */}
                <div className="surface-low rounded-2xl p-5">
                  <h4 className="text-sm font-bold mb-3">Agent 日志</h4>
                  <div className="space-y-3">
                    {selected.agentLogs.map((log, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <span className="text-xs text-muted-foreground/50 w-10 flex-shrink-0 font-mono">{log.time}</span>
                        <p className="text-xs text-muted-foreground">{log.event}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Suggested Actions */}
            <div className="mt-8">
              <h3 className="text-base font-bold mb-4">建议后续操作</h3>
              <div className="grid grid-cols-3 gap-4">
                {selected.suggestedActions.map((action, i) => (
                  <SpotlightCard
                    key={i}
                    className="bg-white rounded-2xl p-5 cursor-pointer ghost-border hover:shadow-lifted hover:-translate-y-0.5 transition-all duration-200"
                  >
                    <div className="w-10 h-10 rounded-xl bg-surface-low flex items-center justify-center text-lg mb-3">
                      {action.icon}
                    </div>
                    <h4 className="text-sm font-bold mb-1">{action.label}</h4>
                    <p className="text-xs text-muted-foreground">{action.desc}</p>
                  </SpotlightCard>
                ))}
              </div>
            </div>

            {/* Bottom actions */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-border/20">
              <p className="text-xs text-muted-foreground">此操作涉及此接管项的所有后续流程</p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    const idx = filtered.findIndex(h => h.id === selected.id);
                    setSelected(filtered[(idx + 1) % filtered.length]);
                  }}
                  className="px-6 py-3 rounded-xl text-sm font-medium bg-surface-low hover:bg-border/40 transition-colors"
                >
                  跳过此项
                </button>
                <button
                  onClick={() => {
                    alert('已接管: ' + selected.title + '\n\n系统将暂停自动化处理此事项，等待你的操作。');
                  }}
                  className="px-8 py-3 bg-foreground text-background rounded-xl text-sm font-bold hover:opacity-90 transition-opacity"
                >
                  执行接管
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
