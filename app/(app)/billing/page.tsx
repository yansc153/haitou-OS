'use client';

import { SpotlightCard } from '@/components/ui/spotlight-card';
import { AnimatedContent } from '@/components/ui/animated-content';
import Link from 'next/link';

const PLANS = [
  { name: 'Free', zh: '个人体验版', price: '¥0', period: '/月', runtime: '2 小时/月', features: ['英文区 3 个平台', '基础简历定制', '自动投递'], hl: false },
  { name: 'Pro', zh: '全渠道职航版', price: '¥299', period: '/月', runtime: '8 小时/月', features: ['开通 7 个主流平台', 'AI 定制简历 + 求职信', '全自动投递 + 跟进'], hl: true },
  { name: 'Plus', zh: '极速推进版', price: '¥899', period: '/月', runtime: '24 小时/月', features: ['全平台覆盖', '多重投递策略', '优先客服'], hl: false },
];

export default function BillingPage() {
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
              <h2 className="text-2xl font-display font-extrabold">Pro</h2>
              <p className="text-sm text-muted-foreground mt-1">全渠道职航版</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-display font-extrabold">5h 46m</p>
              <p className="text-xs text-muted-foreground mt-1">本月剩余 / 8h</p>
            </div>
          </div>
          <div className="mt-6 h-2.5 bg-border/30 rounded-full overflow-hidden">
            <div className="h-full bg-foreground rounded-full" style={{ width: '72%' }} />
          </div>
          <p className="text-xs text-muted-foreground mt-2">下次刷新：2026-05-01</p>
        </SpotlightCard>
      </AnimatedContent>

      {/* Plan Cards */}
      <div className="grid md:grid-cols-3 gap-5 max-w-4xl">
        {PLANS.map((plan, i) => (
          <AnimatedContent key={plan.name} delay={i * 0.1}>
            <div className={`surface-card p-8 h-full flex flex-col relative ${plan.hl ? 'ring-2 ring-foreground shadow-lifted' : ''}`}>
              {plan.hl && (
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
              <p className="text-sm text-secondary font-semibold mb-6">{plan.runtime}</p>
              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <span className="text-secondary mt-0.5">→</span>{f}
                  </li>
                ))}
              </ul>
              <button className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${
                plan.hl ? 'bg-foreground text-background hover:opacity-90' : 'bg-surface-low hover:bg-border/40'
              }`}>
                {plan.hl ? '当前方案' : `升级到 ${plan.name}`}
              </button>
            </div>
          </AnimatedContent>
        ))}
      </div>
    </div>
  );
}
