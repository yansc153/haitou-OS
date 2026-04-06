'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getValidSession } from '@/lib/hooks/use-api';

const API = process.env.NEXT_PUBLIC_SUPABASE_URL!;

type ReviewData = {
  team: { id: string; name: string; status: string; runtime_status: string };
  runtime: { runtime_status: string; balance_seconds: number; started_at: string | null };
  review_window_label: string;
  summary_text: string;
  key_outcomes: Array<{ label: string; value: string }>;
  stage_distribution: Record<string, number>;
  suggestions: string[];
};

const WINDOWS = [
  { value: '7d', label: '7 天' },
  { value: '14d', label: '14 天' },
  { value: '30d', label: '30 天' },
];

export default function ReviewPage() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReviewData | null>(null);
  const [window, setWindow] = useState('7d');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      const session = await getValidSession(supabase);
      if (!session) { setError('未登录'); setLoading(false); return; }

      const res = await fetch(`${API}/functions/v1/review-get?window=${window}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) { setError('加载失败'); setLoading(false); return; }
      const json = await res.json();
      if (!cancelled) {
        setData(json.data);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [supabase, window]);

  const retry = () => setWindow(w => w === '7d' ? '7d' : w); // force re-fetch by toggling

  if (loading) return <div className="p-8 text-center text-muted-foreground animate-pulse">加载中...</div>;
  if (error) return (
    <div className="flex flex-col items-center justify-center min-h-[300px] gap-4">
      <div className="surface-card p-8 rounded-2xl text-center max-w-sm">
        <p className="text-sm text-destructive font-semibold mb-2">加载失败</p>
        <p className="text-xs text-muted-foreground mb-4">活动回顾数据暂时无法获取，可能是团队还未产生运营数据</p>
        <button onClick={() => { setError(''); setLoading(true); setWindow('7d'); }} className="px-4 py-2 text-xs rounded-lg bg-foreground text-background font-semibold hover:opacity-90 transition-opacity">
          重新加载
        </button>
      </div>
    </div>
  );
  if (!data) return (
    <div className="flex flex-col items-center justify-center min-h-[300px]">
      <div className="surface-card p-8 rounded-2xl text-center max-w-sm">
        <p className="text-sm text-muted-foreground">暂无运营数据</p>
        <p className="text-xs text-muted-foreground/60 mt-1">启动团队后，运营活动会显示在此处</p>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">活动回顾</h1>
        <div className="flex gap-2">
          {WINDOWS.map(w => (
            <button
              key={w.value}
              onClick={() => setWindow(w.value)}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                window === w.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="rounded-lg border bg-card p-4">
        <p className="text-sm text-muted-foreground">{data.review_window_label}</p>
        <p className="mt-1 text-base">{data.summary_text}</p>
      </div>

      {/* Key Outcomes Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {data.key_outcomes.map(o => (
          <div key={o.label} className="rounded-lg border bg-card p-4 text-center">
            <div className="text-2xl font-bold">{o.value}</div>
            <div className="mt-1 text-sm text-muted-foreground">{o.label}</div>
          </div>
        ))}
      </div>

      {/* Stage Distribution */}
      {Object.keys(data.stage_distribution).length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h2 className="mb-3 font-semibold">阶段分布</h2>
          <div className="space-y-2">
            {Object.entries(data.stage_distribution).map(([stage, count]) => (
              <div key={stage} className="flex items-center justify-between">
                <span className="text-sm">{stage}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-sm font-medium">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions */}
      {data.suggestions.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
          <h2 className="mb-2 font-semibold text-amber-800 dark:text-amber-200">建议</h2>
          <ul className="space-y-1">
            {data.suggestions.map((s, i) => (
              <li key={i} className="text-sm text-amber-700 dark:text-amber-300">• {s}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
