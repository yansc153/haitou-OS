'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AnimatedContent } from '@/components/ui/animated-content';
import { SpotlightCard } from '@/components/ui/spotlight-card';
import Link from 'next/link';

type ReadinessData = {
  execution_readiness: string;
  platform_tasks: Array<{ platform_id: string; platform_name: string; status: string; action_required: string | null }>;
  blocking_items: string[];
  non_blocking_items: string[];
};

export default function ReadinessPage() {
  const [data, setData] = useState<ReadinessData | null>(null);
  const [starting, setStarting] = useState(false);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/readiness-get`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (json.data) setData(json.data);
    }
    load();
  }, [supabase]);

  if (!data) {
    // Fallback: show skeleton/demo content when API unavailable
    return (
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-display font-extrabold tracking-tight mb-2">就绪检查</h1>
        <p className="text-sm text-muted-foreground mb-8">确保所有条件满足后启动团队</p>
        <div className="surface-card p-6 mb-8 ring-1 ring-status-warning/30">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full bg-status-warning" />
            <span className="text-lg font-display font-bold">请完成以下事项</span>
          </div>
        </div>
        <div className="space-y-2 mb-6">
          {['连接至少一个招聘平台', '补充投递资料（手机、邮箱）'].map((item, i) => (
            <div key={i} className="surface-card p-4 flex items-center gap-3">
              <span className="text-destructive text-sm">✗</span>
              <span className="text-sm">{item}</span>
            </div>
          ))}
        </div>
        <button disabled className="w-full py-4 bg-foreground text-background rounded-2xl text-lg font-display font-bold opacity-30 cursor-not-allowed">
          启动团队
        </button>
        <p className="text-xs text-muted-foreground mt-3 text-center">完成所有必须项后可启动</p>
      </div>
    );
  }

  const isReady = data.blocking_items.length === 0;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-4xl font-display font-extrabold tracking-tight mb-2">就绪检查</h1>
      <p className="text-sm text-muted-foreground mb-8">确保所有条件满足后启动团队</p>

      {/* Status Banner */}
      <AnimatedContent>
        <div className={`surface-card p-6 mb-8 ${isReady ? 'ring-1 ring-status-active/30' : 'ring-1 ring-status-warning/30'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-4 h-4 rounded-full ${isReady ? 'bg-status-active' : 'bg-status-warning'}`} />
            <span className="text-lg font-display font-bold">
              {isReady ? '团队已准备就绪' : '请完成以下事项'}
            </span>
          </div>
        </div>
      </AnimatedContent>

      {/* Blocking */}
      {data.blocking_items.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-bold text-destructive mb-3">必须完成</h2>
          <div className="space-y-2">
            {data.blocking_items.map((item, i) => (
              <AnimatedContent key={i} delay={i * 0.05}>
                <div className="surface-card p-4 flex items-center gap-3">
                  <span className="text-destructive text-sm">✗</span>
                  <span className="text-sm">{item}</span>
                </div>
              </AnimatedContent>
            ))}
          </div>
        </div>
      )}

      {/* Non-blocking */}
      {data.non_blocking_items.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-bold text-status-warning mb-3">建议完善</h2>
          <div className="space-y-2">
            {data.non_blocking_items.map((item, i) => (
              <AnimatedContent key={i} delay={i * 0.05}>
                <div className="surface-card p-4 flex items-center gap-3">
                  <span className="text-status-warning text-sm">△</span>
                  <span className="text-sm text-muted-foreground">{item}</span>
                </div>
              </AnimatedContent>
            ))}
          </div>
        </div>
      )}

      {/* Platform shortcuts */}
      <div className="mb-8">
        <h2 className="text-sm font-bold mb-3">平台连接</h2>
        <div className="grid grid-cols-2 gap-3">
          {data.platform_tasks.slice(0, 4).map(p => (
            <SpotlightCard key={p.platform_id} className="surface-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{p.platform_name}</span>
                {p.action_required ? (
                  <Link href="/platforms" className="px-3 py-1 bg-foreground text-background rounded-lg text-xs font-bold">
                    {p.action_required === 'connect' ? '连接' : '重连'}
                  </Link>
                ) : (
                  <span className="text-xs text-status-active font-semibold">✓ 已连接</span>
                )}
              </div>
            </SpotlightCard>
          ))}
        </div>
      </div>

      {/* Start button */}
      <button
        disabled={!isReady || starting}
        onClick={async () => {
          setStarting(true);
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) { setStarting(false); return; }
          const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/team-start`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
          });
          if (res.ok) {
            router.push('/home');
          } else {
            const json = await res.json();
            alert(json.error?.message || '启动失败');
            setStarting(false);
          }
        }}
        className="w-full py-4 bg-foreground text-background rounded-2xl text-lg font-display font-bold hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
      >
        {starting ? '启动中...' : '启动团队'}
      </button>
      {!isReady && <p className="text-xs text-muted-foreground mt-3 text-center">完成所有必须项后可启动</p>}
    </div>
  );
}
