'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getValidSession } from '@/lib/hooks/use-api';
import { SpotlightCard } from '@/components/ui/spotlight-card';
import { AnimatedContent } from '@/components/ui/animated-content';
import Link from 'next/link';

const PLANS = [
  { name: 'Free', zh: '个人体验版', price: '¥0', period: '/月', runtimeHours: 6, features: ['英文区 3 个平台', '基础简历定制', '自动投递'] },
  { name: 'Pro', zh: '全渠道职航版', price: '¥299', period: '/月', runtimeHours: 8, features: ['开通 7 个主流平台', 'AI 定制简历 + 求职信', '全自动投递 + 跟进'] },
  { name: 'Plus', zh: '极速推进版', price: '¥899', period: '/月', runtimeHours: 24, features: ['全平台覆盖', '多重投递策略', '优先客服'] },
];

const TIER_TO_RUNTIME: Record<string, string> = {
  free: '6 小时/月',
  pro: '8 小时/月',
  plus: '24 小时/月',
};

function formatRuntime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

export default function BillingPage() {
  const supabase = useMemo(() => createClient(), []);
  const [currentTier, setCurrentTier] = useState('free');
  const [balanceSeconds, setBalanceSeconds] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const session = await getValidSession(supabase);
        if (!session) return;
        const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/home-get`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const json = await res.json();
        if (json.data) {
          setCurrentTier(json.data.team?.plan_tier || 'free');
          setBalanceSeconds(json.data.runtime?.effective_balance_seconds || 0);
        }
      } catch (e) { console.error('[billing]', e); }
      setLoading(false);
    }
    load();
  }, [supabase]);

  const currentPlan = PLANS.find(p => p.name.toLowerCase() === currentTier) || PLANS[0];
  const totalSeconds = currentPlan.runtimeHours * 3600;
  const usedPercent = totalSeconds > 0 ? Math.max(0, Math.min(100, Math.round(((totalSeconds - balanceSeconds) / totalSeconds) * 100))) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-sm text-muted-foreground animate-pulse">加载中...</div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-4xl font-display font-extrabold tracking-tight mb-2">套餐方案</h1>
      <p className="text-sm text-muted-foreground mb-10">选择适合你的团队配置</p>

      {/* Current Plan */}
      <AnimatedContent>
        <SpotlightCard className="surface-card p-8 mb-10 max-w-2xl">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-label uppercase tracking-widest text-muted-foreground mb-1">当前方案</p>
              <h2 className="text-2xl font-display font-extrabold">{currentPlan.name}</h2>
              <p className="text-sm text-muted-foreground mt-1">{currentPlan.zh}</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-display font-extrabold">{formatRuntime(balanceSeconds)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                剩余 / {TIER_TO_RUNTIME[currentTier] || `${currentPlan.runtimeHours}h`}
              </p>
            </div>
          </div>
          <div className="mt-6 h-2.5 bg-border/30 rounded-full overflow-hidden">
            <div className="h-full bg-foreground rounded-full transition-all" style={{ width: `${Math.min(usedPercent, 100)}%` }} />
          </div>
          <p className="text-xs text-muted-foreground mt-2">已用 {usedPercent}%</p>
        </SpotlightCard>
      </AnimatedContent>

      {/* Plan Cards */}
      <div className="grid md:grid-cols-3 gap-5 max-w-4xl">
        {PLANS.map((plan, i) => {
          const isCurrent = plan.name.toLowerCase() === currentTier;
          return (
            <AnimatedContent key={plan.name} delay={i * 0.1}>
              <div className={`surface-card p-8 h-full flex flex-col relative ${isCurrent ? 'ring-2 ring-foreground shadow-lifted' : ''}`}>
                {isCurrent && (
                  <div className="absolute -top-4 left-6 px-4 py-1.5 bg-foreground text-background text-[10px] font-bold uppercase tracking-widest rounded-full">
                    当前方案
                  </div>
                )}
                <p className="text-xs text-muted-foreground mb-1">{plan.zh}</p>
                <h3 className="text-lg font-display font-bold">{plan.name}</h3>
                <div className="flex items-baseline gap-0.5 mt-2 mb-2">
                  <span className="text-4xl font-display font-extrabold">{plan.price}</span>
                  <span className="text-sm text-muted-foreground">{plan.period}</span>
                </div>
                <p className="text-sm text-secondary font-semibold mb-6">{plan.runtimeHours} 小时/月</p>
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <span className="text-secondary mt-0.5">→</span>{f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => {
                    if (isCurrent) return;
                    alert(`升级到 ${plan.name} (${plan.zh})\n\n${plan.runtimeHours} 小时/月\n价格: ${plan.price}/月\n\n支付功能即将上线，敬请期待。`);
                  }}
                  className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${
                    isCurrent ? 'bg-foreground text-background cursor-default' : 'bg-surface-low hover:bg-border/40 cursor-pointer'
                  }`}
                >
                  {isCurrent ? '当前方案' : `升级到 ${plan.name}`}
                </button>
              </div>
            </AnimatedContent>
          );
        })}
      </div>
    </div>
  );
}
