'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getValidSession } from '@/lib/hooks/use-api';
import { AnimatedContent } from '@/components/ui/animated-content';
import { SpotlightCard } from '@/components/ui/spotlight-card';

type Handoff = {
  id: string;
  handoff_type: string;
  urgency: string;
  state: string;
  handoff_reason: string;
  context_summary?: string;
  suggested_next_action?: string;
  created_at: string;
  opportunity?: { id: string; job_title: string; company_name: string };
};

const URGENCY_STYLES: Record<string, { dot: string; label: string }> = {
  critical: { dot: 'bg-status-error', label: '紧急' },
  high: { dot: 'bg-status-warning', label: '重要' },
  medium: { dot: 'bg-status-info', label: '待审' },
  low: { dot: 'bg-muted-foreground/30', label: '低优先' },
};

const HANDOFF_TYPE_ZH: Record<string, string> = {
  private_contact: '私人联系方式',
  interview_scheduling: '面试安排',
  salary_negotiation: '薪资谈判',
  strategy_decision: '策略决策',
  identity_verification: '身份验证',
  document_signing: '文件签署',
  platform_auth: '平台授权',
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

export default function HandoffsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [handoffs, setHandoffs] = useState<Handoff[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Handoff | null>(null);
  const [taking, setTaking] = useState(false);

  const fetchHandoffs = useCallback(async () => {
    try {
      const session = await getValidSession(supabase);
      if (!session) return;
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/handoffs-list?state=awaiting_takeover`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (json.data?.handoffs) {
        setHandoffs(json.data.handoffs);
        // Auto-select first item only on initial load
        if (json.data.handoffs.length > 0) {
          setSelected(prev => prev || json.data.handoffs[0]);
        }
      }
    } catch (e) { console.error('[handoffs]', e); }
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchHandoffs(); }, [fetchHandoffs]);

  const handleTakeover = async () => {
    if (!selected) return;
    setTaking(true);
    try {
      const session = await getValidSession(supabase);
      if (!session) return;
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/handoff-takeover`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ handoff_id: selected.id }),
      });
      const json = await res.json();
      if (res.ok) {
        // Remove from list and select next
        const remaining = handoffs.filter(h => h.id !== selected.id);
        setHandoffs(remaining);
        setSelected(remaining[0] || null);
      } else {
        alert(json.error?.message || '接管失败');
      }
    } catch {
      alert('网络错误');
    }
    setTaking(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-sm text-muted-foreground animate-pulse">加载中...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-4xl font-display font-extrabold tracking-tight">等待交接</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {handoffs.length > 0 ? `${handoffs.length} 个事项需要人工介入` : '暂无需要介入的事项'}
          </p>
        </div>
      </div>

      {handoffs.length === 0 ? (
        <div className="surface-card p-12 text-center">
          <p className="text-lg font-display font-bold mb-2">一切顺利</p>
          <p className="text-sm text-muted-foreground">当前没有需要你处理的交接事项，AI 专员正在自主运行</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[320px_1fr] gap-6">
          {/* Left: List */}
          <div className="space-y-3">
            {handoffs.map((h) => {
              const urg = URGENCY_STYLES[h.urgency] || URGENCY_STYLES.medium;
              return (
                <AnimatedContent key={h.id}>
                  <div
                    className={`surface-card p-5 cursor-pointer transition-all duration-200 rounded-2xl ${
                      selected?.id === h.id ? 'ring-2 ring-foreground shadow-lifted -translate-y-0.5' : 'hover:shadow-card hover:-translate-y-0.5'
                    }`}
                    onClick={() => setSelected(h)}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`w-2 h-2 rounded-full ${urg.dot}`} />
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-surface-low font-bold uppercase tracking-wider">{urg.label}</span>
                      <span className="text-xs text-muted-foreground">{timeAgo(h.created_at)}</span>
                    </div>
                    <h3 className="text-sm font-bold mb-0.5">
                      {h.opportunity?.job_title || HANDOFF_TYPE_ZH[h.handoff_type] || h.handoff_type}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-2">{h.handoff_reason}</p>
                    {h.opportunity?.company_name && (
                      <p className="text-[10px] text-muted-foreground/50 mt-2">{h.opportunity.company_name}</p>
                    )}
                  </div>
                </AnimatedContent>
              );
            })}
          </div>

          {/* Right: Detail */}
          {selected && (
            <div className="surface-card rounded-2xl overflow-hidden">
              <div className="p-8 pb-6">
                <div className="flex items-center justify-between mb-6">
                  <span className="px-3 py-1 rounded-full bg-status-warning/10 text-status-warning text-[10px] font-bold uppercase tracking-wider">
                    需人工干预
                  </span>
                  <span className="text-xs text-muted-foreground">{timeAgo(selected.created_at)}</span>
                </div>

                <h2 className="text-3xl lg:text-4xl font-display font-extrabold mb-3">
                  {selected.opportunity?.job_title || HANDOFF_TYPE_ZH[selected.handoff_type] || selected.handoff_type}
                </h2>
                {selected.opportunity && (
                  <p className="text-lg text-muted-foreground mb-1">{selected.opportunity.company_name}</p>
                )}
                <p className="text-sm text-muted-foreground/60 mb-6">
                  {HANDOFF_TYPE_ZH[selected.handoff_type] || selected.handoff_type}
                </p>
              </div>

              <div className="px-8 pb-8">
                <div className="grid lg:grid-cols-[1fr_260px] gap-6">
                  {/* Left: Context */}
                  <div className="space-y-6">
                    <div className="surface-low rounded-2xl p-6">
                      <h3 className="text-base font-bold mb-3 flex items-center gap-2">
                        <span className="w-6 h-6 rounded bg-foreground/10 flex items-center justify-center text-xs">📋</span>
                        交接原因
                      </h3>
                      <p className="text-sm leading-relaxed text-muted-foreground">{selected.handoff_reason}</p>
                      {selected.context_summary && (
                        <div className="mt-4 pl-4 border-l-2 border-border/40">
                          <p className="text-sm text-muted-foreground/70 leading-relaxed">{selected.context_summary}</p>
                        </div>
                      )}
                    </div>

                    {/* Urgency + State cards */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className={`rounded-2xl p-5 ${
                        selected.urgency === 'critical' ? 'bg-status-error/10 text-status-error' :
                        selected.urgency === 'high' ? 'bg-status-warning/10 text-status-warning' :
                        'bg-status-info/10 text-status-info'
                      }`}>
                        <p className="text-[10px] font-label uppercase tracking-widest mb-1 opacity-60">紧急度</p>
                        <p className="text-lg font-display font-bold">
                          {URGENCY_STYLES[selected.urgency]?.label || selected.urgency}
                        </p>
                      </div>
                      <div className="rounded-2xl p-5 bg-surface-low">
                        <p className="text-[10px] font-label uppercase tracking-widest mb-1 text-muted-foreground/60">状态</p>
                        <p className="text-lg font-display font-bold">{selected.state === 'awaiting_takeover' ? '等待接管' : selected.state}</p>
                      </div>
                    </div>
                  </div>

                  {/* Right sidebar */}
                  <div className="space-y-4">
                    {selected.suggested_next_action && (
                      <div className="bg-foreground text-background rounded-2xl p-5">
                        <h4 className="text-sm font-bold mb-3">建议操作</h4>
                        <p className="text-xs text-background/70 leading-relaxed">{selected.suggested_next_action}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom actions */}
                <div className="flex items-center justify-between mt-8 pt-6 border-t border-border/20">
                  <p className="text-xs text-muted-foreground">接管后系统将暂停自动处理此事项</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        const idx = handoffs.findIndex(h => h.id === selected.id);
                        if (handoffs.length > 1) setSelected(handoffs[(idx + 1) % handoffs.length]);
                      }}
                      className="px-6 py-3 rounded-xl text-sm font-medium bg-surface-low hover:bg-border/40 transition-colors"
                    >
                      跳过此项
                    </button>
                    <button
                      onClick={handleTakeover}
                      disabled={taking}
                      className="px-8 py-3 bg-foreground text-background rounded-xl text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {taking ? '处理中...' : '执行接管'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
