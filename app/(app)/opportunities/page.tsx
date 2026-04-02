'use client';

import { useState } from 'react';
import { AnimatedContent } from '@/components/ui/animated-content';
import { SpotlightCard } from '@/components/ui/spotlight-card';
import { AgentBadge, type AgentInfo } from '@/components/agents/agent-badge';

const STAGES = [
  { value: 'discovered', label: '已发现' },
  { value: 'screened', label: '筛选中' },
  { value: 'prioritized', label: '已排序' },
  { value: 'submitted', label: '已投递' },
  { value: 'contact_started', label: '已联系' },
];

const STAGE_COLORS: Record<string, string> = {
  discovered: 'bg-muted-foreground/20 text-muted-foreground',
  screened: 'bg-blue-100 text-blue-700',
  prioritized: 'bg-amber-100 text-amber-700',
  submitted: 'bg-secondary/20 text-secondary',
  contact_started: 'bg-violet-100 text-violet-700',
};

type Opp = { id: string; title: string; company: string; location: string; stage: string; agent: string; match?: string };

const MOCK_OPPS: Opp[] = [
  { id: '1', title: '产品架构师', company: 'Tinder Dynamics', location: '远程', stage: 'discovered', agent: '岗位研究员' },
  { id: '2', title: '前端工程师', company: 'Luminary.li', location: '上海', stage: 'discovered', agent: '岗位研究员' },
  { id: '3', title: '创意总监', company: 'Aeden Design', location: '远程', stage: 'screened', agent: '匹配审核员' },
  { id: '4', title: 'AI 产品负责人', company: 'Nexus Core', location: '旧金山', stage: 'prioritized', agent: '匹配审核员', match: '96%' },
  { id: '5', title: '技术副总裁', company: 'Quant Systems', location: '新加坡', stage: 'submitted', agent: '投递专员' },
  { id: '6', title: '高级后端工程师', company: 'Stripe', location: '远程', stage: 'submitted', agent: '投递专员' },
  { id: '7', title: '设计总监', company: 'LVMH Digital', location: '远程', stage: 'contact_started', agent: '招聘关系经理' },
  { id: '8', title: '产品经理', company: '字节跳动', location: '北京', stage: 'submitted', agent: '投递专员' },
  { id: '9', title: '数据科学家', company: '蚂蚁集团', location: '杭州', stage: 'screened', agent: '匹配审核员' },
  { id: '10', title: '全栈工程师', company: 'DJI', location: '深圳', stage: 'discovered', agent: '岗位研究员' },
];

const MOCK_AGENTS_BOTTOM: AgentInfo[] = [
  { id: '1', role_code: 'opportunity_research', title_zh: '岗位研究员', persona_name: 'Scout', status: 'working' },
  { id: '2', role_code: 'materials_advisor', title_zh: '简历顾问', persona_name: 'Advisor', status: 'working' },
  { id: '3', role_code: 'application_executor', title_zh: '投递专员', persona_name: 'Executor', status: 'working' },
  { id: '4', role_code: 'matching_review', title_zh: '匹配审核员', persona_name: 'Reviewer', status: 'ready' },
  { id: '5', role_code: 'relationship_manager', title_zh: '招聘关系经理', persona_name: 'Liaison', status: 'ready' },
  { id: '6', role_code: 'orchestrator', title_zh: '调度官', persona_name: 'Commander', status: 'working' },
  { id: '7', role_code: 'profile_intelligence', title_zh: '履历分析师', persona_name: 'Analyst', status: 'ready' },
];

export default function OpportunitiesPage() {
  const [view, setView] = useState<'pipeline' | 'list'>('pipeline');
  const [selected, setSelected] = useState<Opp | null>(null);

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-4xl font-display font-extrabold tracking-tight">机会工作台</h1>
          <p className="text-sm text-muted-foreground mt-1">管理 7 位 AI 专员正在推进的所有机会</p>
        </div>
        <div className="flex items-center gap-2">
          {['pipeline', 'list'].map(v => (
            <button
              key={v}
              onClick={() => setView(v as 'pipeline' | 'list')}
              className={`px-4 py-2 text-sm rounded-xl transition-colors ${view === v ? 'bg-foreground text-background font-semibold' : 'text-muted-foreground hover:bg-surface-low'}`}
            >
              {v === 'pipeline' ? 'Pipeline' : '列表'}
            </button>
          ))}
        </div>
      </div>

      {/* Pipeline View */}
      {view === 'pipeline' && (
        <div className="flex gap-4 overflow-x-auto pb-6" style={{ minHeight: '500px' }}>
          {STAGES.map(stage => {
            const items = MOCK_OPPS.filter(o => o.stage === stage.value);
            return (
              <div key={stage.value} className="flex-shrink-0 w-[260px] bg-surface-low/50 rounded-2xl p-3">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold">{stage.label}</h3>
                  <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-surface-low">{items.length}</span>
                </div>
                <div className="space-y-3">
                  {items.map((opp, i) => (
                    <AnimatedContent key={opp.id} delay={i * 0.04}>
                      <SpotlightCard
                        className="bg-white rounded-2xl p-5 cursor-pointer hover:shadow-lifted hover:-translate-y-0.5 transition-all duration-200 ghost-border"
                        onClick={() => setSelected(opp)}
                      >
                        {/* Match color bar at top */}
                        {opp.match && <div className="h-1 bg-status-active/30 rounded-full mb-3 w-2/3" />}
                        <h4 className="text-sm font-bold mb-1">{opp.title}</h4>
                        <p className="text-xs text-muted-foreground">{opp.company}</p>
                        <p className="text-xs text-muted-foreground/50 mt-0.5">{opp.location}</p>
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/10">
                          <span className="text-[10px] text-secondary font-semibold">{opp.agent}</span>
                          {opp.match && (
                            <span className="px-2 py-0.5 rounded-full bg-status-active/10 text-status-active text-[9px] font-bold">
                              {opp.match}
                            </span>
                          )}
                        </div>
                      </SpotlightCard>
                    </AnimatedContent>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List View */}
      {view === 'list' && (
        <div className="space-y-2">
          {MOCK_OPPS.map((opp, i) => (
            <AnimatedContent key={opp.id} delay={i * 0.03}>
              <div
                className="surface-card p-5 flex items-center justify-between cursor-pointer hover:shadow-lifted transition-shadow"
                onClick={() => setSelected(opp)}
              >
                <div>
                  <h4 className="text-sm font-bold">{opp.title}</h4>
                  <p className="text-xs text-muted-foreground">{opp.company} · {opp.location}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${STAGE_COLORS[opp.stage]}`}>
                    {STAGES.find(s => s.value === opp.stage)?.label}
                  </span>
                  {opp.match && <span className="text-xs text-status-active font-bold">{opp.match}</span>}
                </div>
              </div>
            </AnimatedContent>
          ))}
        </div>
      )}

      {/* Agent Force (bottom) — matches Stitch design */}
      <div className="mt-12 pt-8 border-t border-border/20">
        <h2 className="text-lg font-display font-bold mb-4">团队阵容</h2>
        <div className="flex items-start gap-6 overflow-x-auto pb-2">
          {MOCK_AGENTS_BOTTOM.map(a => (
            <AgentBadge key={a.id} agent={a} size="compact" />
          ))}
        </div>
      </div>

      {/* Rich Detail Panel */}
      {selected && (
        <div className="fixed inset-y-0 right-0 w-[560px] bg-background shadow-2xl z-50 overflow-y-auto border-l border-border/20">
          <div className="p-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-1">← 返回列表</button>
              <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${STAGE_COLORS[selected.stage]}`}>
                {STAGES.find(s => s.value === selected.stage)?.label}
              </span>
            </div>

            <h2 className="text-3xl font-display font-extrabold mb-1">{selected.title}</h2>
            <p className="text-lg text-muted-foreground mb-1">{selected.company}</p>
            <p className="text-sm text-muted-foreground/60 mb-6">{selected.location}</p>

            {/* Match + Agent badges */}
            <div className="flex items-center gap-3 mb-8">
              {selected.match && (
                <span className="px-3 py-1.5 rounded-full bg-status-active/10 text-status-active text-sm font-bold">{selected.match} 匹配</span>
              )}
              <span className="px-3 py-1.5 rounded-full bg-surface-low text-sm">{selected.agent}</span>
            </div>

            {/* Tabs-like sections */}
            <div className="space-y-8">
              {/* Timeline */}
              <div>
                <h3 className="text-base font-bold mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded bg-foreground/10 flex items-center justify-center text-xs">📋</span>
                  操作时间线
                </h3>
                <div className="surface-low rounded-2xl p-5 space-y-4">
                  {[
                    { time: '14:30', agent: '岗位研究员', event: '在 Greenhouse 发现此机会', status: 'done' },
                    { time: '14:32', agent: '匹配审核员', event: '五维评估：强匹配（技能 95%，资历 90%，地点 100%）', status: 'done' },
                    { time: '14:35', agent: '简历顾问', event: '开始为此岗位定制简历和求职信', status: 'done' },
                    { time: '14:42', agent: '简历顾问', event: '简历定制完成，关键词：分布式系统、高可用架构', status: 'done' },
                    { time: '14:45', agent: '投递专员', event: '通过 Greenhouse 表单提交投递', status: selected.stage === 'submitted' || selected.stage === 'contact_started' ? 'done' : 'pending' },
                  ].map((e, i) => (
                    <div key={i} className="flex items-start gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`w-3 h-3 rounded-full ${e.status === 'done' ? 'bg-status-active' : 'bg-muted-foreground/20'}`} />
                        {i < 4 && <div className="w-px h-6 bg-border/30 mt-1" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-mono text-muted-foreground/50">{e.time}</span>
                          <span className="text-xs text-secondary font-semibold">{e.agent}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{e.event}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Generated Materials */}
              <div>
                <h3 className="text-base font-bold mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded bg-foreground/10 flex items-center justify-center text-xs">📄</span>
                  生成材料
                </h3>
                <div className="space-y-3">
                  <div className="surface-card p-4 rounded-xl flex items-center justify-between ghost-border">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center text-sm">📝</div>
                      <div>
                        <p className="text-sm font-semibold">定制简历 — {selected.company}</p>
                        <p className="text-xs text-muted-foreground">已优化关键词 · 英文版</p>
                      </div>
                    </div>
                    <button className="text-xs text-secondary font-semibold hover:underline">预览</button>
                  </div>
                  <div className="surface-card p-4 rounded-xl flex items-center justify-between ghost-border">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-sm">✉️</div>
                      <div>
                        <p className="text-sm font-semibold">求职信 — {selected.company}</p>
                        <p className="text-xs text-muted-foreground">已生成 · 300 词</p>
                      </div>
                    </div>
                    <button className="text-xs text-secondary font-semibold hover:underline">预览</button>
                  </div>
                </div>
              </div>

              {/* Submission Record */}
              <div>
                <h3 className="text-base font-bold mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded bg-foreground/10 flex items-center justify-center text-xs">🚀</span>
                  投递记录
                </h3>
                {(selected.stage === 'submitted' || selected.stage === 'contact_started') ? (
                  <div className="surface-low rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold">Greenhouse 表单投递</span>
                      <span className="px-2 py-0.5 rounded-full bg-status-active/10 text-status-active text-[10px] font-bold">成功</span>
                    </div>
                    <p className="text-xs text-muted-foreground">投递时间：今天 14:45 · 确认信号：页面显示 "Application received"</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground/50 p-4">尚未投递 — 当前阶段：{STAGES.find(s => s.value === selected.stage)?.label}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
