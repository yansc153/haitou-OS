'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AnimatedContent } from '@/components/ui/animated-content';
import { SpotlightCard } from '@/components/ui/spotlight-card';

const STAGES = [
  { value: '', label: '全部' },
  { value: 'discovered', label: '已发现' },
  { value: 'screened', label: '筛选中' },
  { value: 'prioritized', label: '已排序' },
  { value: 'submitted', label: '已投递' },
  { value: 'contact_started', label: '已联系' },
  { value: 'followup_active', label: '跟进中' },
  { value: 'needs_takeover', label: '需接管' },
];

const STAGE_COLORS: Record<string, string> = {
  discovered: 'bg-muted-foreground/20 text-muted-foreground',
  screened: 'bg-blue-100 text-blue-700',
  prioritized: 'bg-amber-100 text-amber-700',
  submitted: 'bg-secondary/20 text-secondary',
  contact_started: 'bg-violet-100 text-violet-700',
  followup_active: 'bg-emerald-100 text-emerald-700',
  needs_takeover: 'bg-red-100 text-red-700',
  closed: 'bg-muted-foreground/10 text-muted-foreground/50',
};

type Opportunity = {
  id: string; company_name: string; job_title: string; location_label?: string;
  stage: string; priority_level: string; recommendation?: string; latest_event_at?: string;
  latest_event_summary?: string;
};

export default function OpportunitiesPage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'pipeline' | 'list'>('pipeline');
  const [selected, setSelected] = useState<Opportunity | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const params = new URLSearchParams();
      if (filter) params.set('stage', filter);
      if (search) params.set('search', search);
      params.set('limit', '50');
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/opportunities-list?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      setOpportunities(json.data?.opportunities || []);
    }
    load();
  }, [supabase, filter, search]);

  const pipelineStages = STAGES.filter(s => s.value).map(s => ({
    ...s,
    items: opportunities.filter(o => o.stage === s.value),
  }));

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-4xl font-display font-extrabold tracking-tight">机会工作台</h1>
          <p className="text-sm text-muted-foreground mt-1">管理所有求职机会的全生命周期</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView('pipeline')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${view === 'pipeline' ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-surface-low'}`}
          >
            Pipeline
          </button>
          <button
            onClick={() => setView('list')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${view === 'list' ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-surface-low'}`}
          >
            列表
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex gap-1 surface-card p-1 rounded-xl">
          {STAGES.map(s => (
            <button
              key={s.value}
              onClick={() => setFilter(s.value)}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${filter === s.value ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-surface-low'}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="搜索公司或岗位..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-4 py-2 text-sm bg-surface-low rounded-xl border-0 focus:outline-none focus:ring-2 focus:ring-ring w-60"
        />
      </div>

      {/* Pipeline View */}
      {view === 'pipeline' && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {pipelineStages.map(stage => (
            <div key={stage.value} className="flex-shrink-0 w-[280px]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold">{stage.label}</h3>
                <span className="text-xs text-muted-foreground surface-card px-2 py-0.5 rounded-full">{stage.items.length}</span>
              </div>
              <div className="space-y-3">
                {stage.items.map((opp, i) => (
                  <AnimatedContent key={opp.id} delay={i * 0.03}>
                    <SpotlightCard
                      className="surface-card p-4 cursor-pointer hover:shadow-lifted transition-shadow"
                      onClick={() => setSelected(opp)}
                    >
                      <h4 className="text-sm font-bold mb-1">{opp.job_title}</h4>
                      <p className="text-xs text-muted-foreground">{opp.company_name}</p>
                      {opp.location_label && <p className="text-xs text-muted-foreground/60 mt-1">{opp.location_label}</p>}
                      {opp.latest_event_summary && (
                        <p className="text-xs text-muted-foreground/50 mt-2 line-clamp-2">{opp.latest_event_summary}</p>
                      )}
                    </SpotlightCard>
                  </AnimatedContent>
                ))}
                {stage.items.length === 0 && (
                  <div className="text-xs text-muted-foreground/30 p-4 text-center">暂无</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* List View */}
      {view === 'list' && (
        <div className="space-y-2">
          {opportunities.map((opp, i) => (
            <AnimatedContent key={opp.id} delay={i * 0.02}>
              <div
                className="surface-card p-5 flex items-center justify-between cursor-pointer hover:shadow-lifted transition-shadow"
                onClick={() => setSelected(opp)}
              >
                <div className="flex items-center gap-4">
                  <div>
                    <h4 className="text-sm font-bold">{opp.job_title}</h4>
                    <p className="text-xs text-muted-foreground">{opp.company_name} {opp.location_label && `· ${opp.location_label}`}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${STAGE_COLORS[opp.stage] || 'bg-muted-foreground/10'}`}>
                    {STAGES.find(s => s.value === opp.stage)?.label || opp.stage}
                  </span>
                  <span className="text-xs text-muted-foreground/50">
                    {opp.latest_event_at ? new Date(opp.latest_event_at).toLocaleDateString('zh-CN') : ''}
                  </span>
                </div>
              </div>
            </AnimatedContent>
          ))}
          {opportunities.length === 0 && (
            <div className="surface-card p-16 text-center text-muted-foreground/50">
              <p className="text-base mb-1">暂无机会</p>
              <p className="text-sm">启动团队后，机会将自动出现在这里</p>
            </div>
          )}
        </div>
      )}

      {/* Detail Side Panel */}
      {selected && (
        <div className="fixed inset-y-0 right-0 w-[480px] bg-background shadow-2xl z-50 overflow-y-auto border-l border-border/20">
          <div className="p-8">
            <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground mb-6 text-sm">← 关闭</button>
            <h2 className="text-2xl font-display font-extrabold mb-1">{selected.job_title}</h2>
            <p className="text-base text-muted-foreground mb-6">{selected.company_name} {selected.location_label && `· ${selected.location_label}`}</p>
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold mb-8 ${STAGE_COLORS[selected.stage] || 'bg-muted-foreground/10'}`}>
              {STAGES.find(s => s.value === selected.stage)?.label || selected.stage}
            </span>

            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold mb-3">时间线</h3>
                <p className="text-sm text-muted-foreground/50">详细时间线在连接后端后显示</p>
              </div>
              <div>
                <h3 className="text-sm font-bold mb-3">生成材料</h3>
                <p className="text-sm text-muted-foreground/50">简历、求职信等材料将在此显示</p>
              </div>
              <div>
                <h3 className="text-sm font-bold mb-3">投递记录</h3>
                <p className="text-sm text-muted-foreground/50">投递尝试和结果将在此显示</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
