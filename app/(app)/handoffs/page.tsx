'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AnimatedContent } from '@/components/ui/animated-content';
import { SpotlightCard } from '@/components/ui/spotlight-card';

const URGENCY_STYLES: Record<string, { dot: string; label: string }> = {
  critical: { dot: 'bg-red-500', label: '紧急' },
  high: { dot: 'bg-status-warning', label: '重要' },
  medium: { dot: 'bg-status-info', label: '一般' },
  low: { dot: 'bg-muted-foreground/30', label: '低' },
};

const TYPE_LABELS: Record<string, string> = {
  private_contact: '私人联系方式',
  salary_confirmation: '薪资确认',
  interview_time: '面试安排',
  work_arrangement: '工作安排',
  visa_eligibility: '签证资格',
  offer_decision: 'Offer 决策',
  other_high_risk: '高风险事项',
};

const STATE_FILTERS = [
  { value: '', label: '全部' },
  { value: 'awaiting_takeover', label: '待接管' },
  { value: 'in_user_handling', label: '处理中' },
  { value: 'waiting_external', label: '等待回复' },
  { value: 'resolved', label: '已完成' },
];

type Handoff = {
  id: string; handoff_type: string; urgency: string; state: string;
  handoff_reason: string; context_summary: string; suggested_next_action?: string;
  suggested_reply_text?: string; created_at: string;
  opportunity?: { job_title: string; company_name: string };
};

export default function HandoffsPage() {
  const [handoffs, setHandoffs] = useState<Handoff[]>([]);
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<Handoff | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const params = new URLSearchParams();
      if (filter) params.set('state', filter);
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/handoffs-list?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      setHandoffs(json.data?.handoffs || []);
      setPendingCount(json.data?.pending_count || 0);
    }
    load();
  }, [supabase, filter]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-4xl font-display font-extrabold tracking-tight">交接中心</h1>
          <p className="text-sm text-muted-foreground mt-1">需要你亲自决定的关键事项</p>
        </div>
        {pendingCount > 0 && (
          <div className="px-4 py-2 rounded-full bg-status-warning/10 text-status-warning text-sm font-bold">
            {pendingCount} 待处理
          </div>
        )}
      </div>

      {/* Filter */}
      <div className="flex gap-1 surface-card p-1 rounded-xl mb-6 w-fit">
        {STATE_FILTERS.map(s => (
          <button
            key={s.value}
            onClick={() => setFilter(s.value)}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${filter === s.value ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-surface-low'}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* List + Detail */}
      <div className="grid lg:grid-cols-[1fr_480px] gap-6">
        {/* List */}
        <div className="space-y-3">
          {handoffs.length > 0 ? handoffs.map((h, i) => {
            const urgency = URGENCY_STYLES[h.urgency] || URGENCY_STYLES.medium;
            return (
              <AnimatedContent key={h.id} delay={i * 0.03}>
                <SpotlightCard
                  className={`surface-card p-5 cursor-pointer hover:shadow-lifted transition-shadow ${selected?.id === h.id ? 'ring-2 ring-foreground/20' : ''}`}
                  onClick={() => setSelected(h)}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-3 h-3 rounded-full mt-1.5 flex-shrink-0 ${urgency.dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-low font-bold uppercase">
                          {TYPE_LABELS[h.handoff_type] || h.handoff_type}
                        </span>
                        <span className="text-xs text-muted-foreground">{urgency.label}</span>
                      </div>
                      <h3 className="text-sm font-bold">
                        {h.opportunity?.company_name} — {h.opportunity?.job_title}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{h.handoff_reason}</p>
                      <p className="text-[10px] text-muted-foreground/40 mt-2">
                        {new Date(h.created_at).toLocaleString('zh-CN')}
                      </p>
                    </div>
                  </div>
                </SpotlightCard>
              </AnimatedContent>
            );
          }) : (
            <div className="surface-card p-16 text-center text-muted-foreground/50">
              <p className="text-xl mb-2">🎉</p>
              <p className="text-base mb-1">暂无需要接管的事项</p>
              <p className="text-sm">当遇到薪资、面试等关键节点时，系统会在这里通知你</p>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selected && (
          <div className="surface-card p-8 sticky top-20 h-fit">
            <div className="flex items-center gap-2 mb-4">
              <div className={`w-3 h-3 rounded-full ${(URGENCY_STYLES[selected.urgency] || URGENCY_STYLES.medium).dot}`} />
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-low font-bold uppercase">
                {TYPE_LABELS[selected.handoff_type] || selected.handoff_type}
              </span>
            </div>

            <h2 className="text-xl font-display font-extrabold mb-1">
              {selected.opportunity?.job_title}
            </h2>
            <p className="text-sm text-muted-foreground mb-6">{selected.opportunity?.company_name}</p>

            <div className="space-y-5">
              <div>
                <h3 className="text-xs font-label uppercase tracking-widest text-muted-foreground mb-2">上下文摘要</h3>
                <p className="text-sm leading-relaxed">{selected.context_summary}</p>
              </div>

              <div>
                <h3 className="text-xs font-label uppercase tracking-widest text-muted-foreground mb-2">接管原因</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{selected.handoff_reason}</p>
              </div>

              {selected.suggested_next_action && (
                <div>
                  <h3 className="text-xs font-label uppercase tracking-widest text-muted-foreground mb-2">建议操作</h3>
                  <p className="text-sm leading-relaxed">{selected.suggested_next_action}</p>
                </div>
              )}

              {selected.suggested_reply_text && (
                <div>
                  <h3 className="text-xs font-label uppercase tracking-widest text-muted-foreground mb-2">建议回复</h3>
                  <div className="surface-low rounded-xl p-4 text-sm leading-relaxed">
                    {selected.suggested_reply_text}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-8">
              <button
                onClick={async () => {
                  const { data: { session } } = await supabase.auth.getSession();
                  if (!session) return;
                  await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/handoff-takeover`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ handoff_id: selected.id }),
                  });
                  setSelected(null);
                  setFilter(filter); // trigger reload
                }}
                className="flex-1 py-3 bg-foreground text-background rounded-xl text-sm font-bold hover:opacity-90 transition-opacity"
              >
                开始处理
              </button>
              <button
                onClick={() => setSelected(null)}
                className="px-4 py-3 rounded-xl text-sm font-medium border border-border/30 hover:bg-surface-low transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
