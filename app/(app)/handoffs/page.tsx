'use client';

import { useState } from 'react';
import { AnimatedContent } from '@/components/ui/animated-content';
import { SpotlightCard } from '@/components/ui/spotlight-card';

type Handoff = {
  id: string; type: string; typeLabel: string; urgency: 'critical' | 'high' | 'medium';
  title: string; company: string; reason: string; context: string;
  suggestedAction: string; suggestedReply?: string; time: string;
};

const MOCK_HANDOFFS: Handoff[] = [
  {
    id: '1', type: 'private_contact', typeLabel: '私人联系方式', urgency: 'high',
    title: 'Alexander Vance', company: 'Protocol Engines',
    reason: 'HR 请求交换微信联系方式',
    context: 'Scout 一直在与 Alexander 沟通「产品负责人」岗位。对话进展积极，Alexander 表达了对你背景中「用户增长」和「数据驱动」经验的强烈兴趣。最新一条消息中，Alexander 主动要求添加微信以便后续沟通。',
    suggestedAction: '授权分享微信号',
    suggestedReply: '感谢您的关注，我的微信是 xxxxxx，期待进一步沟通。',
    time: '10 分钟前',
  },
  {
    id: '2', type: 'interview_time', typeLabel: '面试安排', urgency: 'critical',
    title: 'Google Cloud 团队面试', company: 'Google',
    reason: '需要确认面试时间',
    context: '投递专员成功投递了 Google Cloud 的「高级产品经理」岗位。HR 回复确认进入面试环节，提出明天上午 10:00 (CST) 作为建议面试时间。',
    suggestedAction: '确认面试时间',
    time: '30 分钟前',
  },
  {
    id: '3', type: 'salary_confirmation', typeLabel: '薪资确认', urgency: 'medium',
    title: '薪资范围更新', company: 'Steward Inc.',
    reason: '招聘方询问期望薪资',
    context: '招聘关系经理在跟进 Steward 的「技术总监」岗位时，对方要求确认期望薪资范围。当前设定的范围可能偏低，建议根据市场行情调整。',
    suggestedAction: '更新薪资范围',
    time: '2 小时前',
  },
  {
    id: '4', type: 'offer_decision', typeLabel: 'Offer 决策', urgency: 'critical',
    title: '技术组合审计', company: 'Cortex AI',
    reason: '收到技术面试邀请，需确认技术栈',
    context: '收到 Cortex AI 的技术面试邀请。面试内容涵盖系统设计和分布式系统，需要确认你是否准备参加。',
    suggestedAction: '确认参加',
    time: '3 小时前',
  },
];

const URGENCY_STYLES = {
  critical: { dot: 'bg-red-500', text: 'text-red-600' },
  high: { dot: 'bg-status-warning', text: 'text-status-warning' },
  medium: { dot: 'bg-status-info', text: 'text-status-info' },
};

export default function HandoffsPage() {
  const [selected, setSelected] = useState<Handoff | null>(MOCK_HANDOFFS[0]);
  const [filter, setFilter] = useState('');

  const filtered = filter ? MOCK_HANDOFFS.filter(h => h.type === filter) : MOCK_HANDOFFS;

  return (
    <div>
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-4xl font-display font-extrabold tracking-tight">交接中心</h1>
          <p className="text-sm text-muted-foreground mt-1">需要你亲自决定的关键事项</p>
        </div>
        <div className="px-4 py-2 rounded-full bg-status-warning/10 text-status-warning text-sm font-bold">
          {MOCK_HANDOFFS.length} 待处理
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-1 surface-card p-1 rounded-xl mb-6 w-fit">
        {[
          { value: '', label: '全部' },
          { value: 'private_contact', label: '联系方式' },
          { value: 'interview_time', label: '面试' },
          { value: 'salary_confirmation', label: '薪资' },
          { value: 'offer_decision', label: 'Offer' },
        ].map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${filter === f.value ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-surface-low'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* List + Detail */}
      <div className="grid lg:grid-cols-[1fr_480px] gap-6">
        {/* Left: List */}
        <div className="space-y-3">
          {filtered.map((h, i) => {
            const urg = URGENCY_STYLES[h.urgency];
            return (
              <AnimatedContent key={h.id} delay={i * 0.04}>
                <SpotlightCard
                  className={`surface-card p-5 cursor-pointer hover:shadow-lifted transition-all duration-200 ${selected?.id === h.id ? 'ring-2 ring-foreground shadow-lifted -translate-y-0.5' : 'hover:-translate-y-0.5'}`}
                  onClick={() => setSelected(h)}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-3 h-3 rounded-full mt-1.5 flex-shrink-0 ${urg.dot}`} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-low font-bold uppercase">{h.typeLabel}</span>
                      </div>
                      <h3 className="text-sm font-bold">{h.title}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{h.company} · {h.reason}</p>
                      <p className="text-[10px] text-muted-foreground/40 mt-2">{h.time}</p>
                    </div>
                  </div>
                </SpotlightCard>
              </AnimatedContent>
            );
          })}
        </div>

        {/* Right: Detail */}
        {selected && (
          <div className="surface-card p-8 sticky top-20 h-fit rounded-2xl">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-[10px] px-2.5 py-1 rounded-full bg-surface-low font-bold uppercase">{selected.typeLabel}</span>
              <span className="text-xs text-muted-foreground">{selected.time}</span>
            </div>

            <h2 className="text-2xl font-display font-extrabold mb-1">{selected.title}</h2>
            <p className="text-base text-muted-foreground mb-8">{selected.company}</p>

            <div className="space-y-6">
              <div>
                <h3 className="text-xs font-label uppercase tracking-widest text-muted-foreground mb-2">上下文摘要</h3>
                <p className="text-sm leading-relaxed">{selected.context}</p>
              </div>

              <div>
                <h3 className="text-xs font-label uppercase tracking-widest text-muted-foreground mb-2">接管原因</h3>
                <p className="text-sm text-muted-foreground">{selected.reason}</p>
              </div>

              {selected.suggestedReply && (
                <div>
                  <h3 className="text-xs font-label uppercase tracking-widest text-muted-foreground mb-2">建议回复</h3>
                  <div className="surface-low rounded-xl p-4 text-sm leading-relaxed">{selected.suggestedReply}</div>
                </div>
              )}

              <div>
                <h3 className="text-xs font-label uppercase tracking-widest text-muted-foreground mb-3">建议操作</h3>
                <div className="grid grid-cols-3 gap-3">
                  <button className="p-4 surface-card rounded-xl text-center hover:shadow-lifted hover:-translate-y-0.5 transition-all duration-200 group">
                    <div className="w-10 h-10 rounded-xl bg-status-active/10 flex items-center justify-center mx-auto mb-2 group-hover:bg-status-active/20 transition-colors">
                      <span className="text-status-active text-sm font-bold">✓</span>
                    </div>
                    <p className="text-xs font-bold">{selected.suggestedAction}</p>
                  </button>
                  <button className="p-4 surface-card rounded-xl text-center hover:shadow-lifted hover:-translate-y-0.5 transition-all duration-200 group">
                    <div className="w-10 h-10 rounded-xl bg-status-warning/10 flex items-center justify-center mx-auto mb-2 group-hover:bg-status-warning/20 transition-colors">
                      <span className="text-status-warning text-sm font-bold">✎</span>
                    </div>
                    <p className="text-xs font-bold">手动处理</p>
                  </button>
                  <button className="p-4 surface-card rounded-xl text-center hover:shadow-lifted hover:-translate-y-0.5 transition-all duration-200 group">
                    <div className="w-10 h-10 rounded-xl bg-status-info/10 flex items-center justify-center mx-auto mb-2 group-hover:bg-status-info/20 transition-colors">
                      <span className="text-status-info text-sm font-bold">↺</span>
                    </div>
                    <p className="text-xs font-bold">交回团队</p>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button className="flex-1 py-3.5 bg-foreground text-background rounded-xl text-sm font-bold hover:opacity-90 transition-opacity">
                执行接管
              </button>
              <button
                onClick={() => {
                  const currentIdx = filtered.findIndex(h => h.id === selected.id);
                  const next = filtered[(currentIdx + 1) % filtered.length];
                  setSelected(next);
                }}
                className="px-6 py-3.5 rounded-xl text-sm font-medium bg-surface-low hover:bg-border/40 transition-colors"
              >
                下一个 →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
