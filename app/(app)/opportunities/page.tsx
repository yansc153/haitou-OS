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
                        className="surface-card p-5 cursor-pointer hover:shadow-lifted transition-shadow"
                        onClick={() => setSelected(opp)}
                      >
                        <h4 className="text-sm font-bold mb-1">{opp.title}</h4>
                        <p className="text-xs text-muted-foreground">{opp.company}</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">{opp.location}</p>
                        <div className="flex items-center justify-between mt-3">
                          <span className="text-[10px] text-muted-foreground/50">{opp.agent}</span>
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

      {/* Side Panel */}
      {selected && (
        <div className="fixed inset-y-0 right-0 w-[480px] bg-background shadow-2xl z-50 overflow-y-auto border-l border-border/20">
          <div className="p-8">
            <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground mb-6 text-sm">← 关闭</button>
            <h2 className="text-2xl font-display font-extrabold mb-1">{selected.title}</h2>
            <p className="text-base text-muted-foreground mb-2">{selected.company} · {selected.location}</p>
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold mb-8 ${STAGE_COLORS[selected.stage]}`}>
              {STAGES.find(s => s.value === selected.stage)?.label}
            </span>

            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold mb-3">时间线</h3>
                <div className="space-y-3">
                  {[
                    { time: '今天 14:30', text: `${selected.agent} 发现了这个机会` },
                    { time: '今天 14:32', text: '匹配审核员评估匹配度为「强匹配」' },
                    { time: '今天 14:35', text: '简历顾问开始定制简历' },
                  ].map((e, i) => (
                    <div key={i} className="flex gap-3">
                      <span className="text-xs text-muted-foreground/50 w-20 flex-shrink-0">{e.time}</span>
                      <p className="text-sm text-muted-foreground">{e.text}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-bold mb-3">生成材料</h3>
                <div className="surface-card p-4 flex items-center gap-3">
                  <span>📄</span>
                  <div>
                    <p className="text-sm font-semibold">定制简历 - {selected.company}</p>
                    <p className="text-xs text-muted-foreground">已生成</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
