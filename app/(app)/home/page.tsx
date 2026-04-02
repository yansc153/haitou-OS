'use client';

import { useState, useEffect } from 'react';
import { AgentBadge, type AgentInfo } from '@/components/agents/agent-badge';
import { AnimatedContent } from '@/components/ui/animated-content';
import { SpotlightCard } from '@/components/ui/spotlight-card';
import Link from 'next/link';

// Mock data — matches Stitch team_home_dashboard design
const MOCK_AGENTS: AgentInfo[] = [
  { id: '1', role_code: 'opportunity_research', title_zh: '岗位研究员', persona_name: 'Scout', status: 'working', current_task: '正在扫描 Greenhouse...' },
  { id: '2', role_code: 'profile_intelligence', title_zh: '履历分析师', persona_name: 'Analyst', status: 'ready' },
  { id: '3', role_code: 'materials_advisor', title_zh: '简历顾问', persona_name: 'Advisor', status: 'working', current_task: '定制简历中...' },
  { id: '4', role_code: 'application_executor', title_zh: '投递专员', persona_name: 'Executor', status: 'working', current_task: '正在投递 3 个岗位' },
  { id: '5', role_code: 'matching_review', title_zh: '匹配审核员', persona_name: 'Reviewer', status: 'ready' },
  { id: '6', role_code: 'relationship_manager', title_zh: '招聘关系经理', persona_name: 'Liaison', status: 'ready' },
  { id: '7', role_code: 'orchestrator', title_zh: '调度官', persona_name: 'Commander', status: 'working', current_task: '协调任务分配' },
];

const MOCK_FEED = [
  { id: '1', actor: '岗位研究员', time: '2 分钟前', text: '基于你的「产品设计」偏好，Scout 在深圳和新加坡发现了 14 个高匹配机会。', actions: ['查看批次'] },
  { id: '2', actor: '简历顾问', time: '45 分钟前', text: '为「腾讯高级产品负责人」岗位优化了简历，关键词调整为「系统可扩展性」「设计伦理」「利益相关者管理」。', actions: ['查看修改', '批准并发送'] },
  { id: '3', actor: '投递专员', time: '1 小时前', text: '成功投递 3 份简历：字节跳动、蚂蚁集团、DJI 的招聘门户。', actions: [] },
  { id: '4', actor: '匹配审核员', time: '2 小时前', text: '已排除 5 个与目标地区冲突的岗位（要求 onsite 北京，你偏好远程/深圳）。', actions: [] },
];

const MOCK_HANDOFFS = [
  { type: '面试安排', title: '确认与 Google Cloud 团队的面试', desc: '建议时间：明天 10:00 AM (CST)', action: '确认时间' },
  { type: '策略确认', title: 'Steward 需要薪资范围更新', desc: '当前范围偏低，建议调整', action: '更新' },
];

const MOCK_OPPORTUNITIES = [
  { title: '设计总监', company: 'LVMH Digital · 全球远程', salary: '¥180k+', type: '全职', match: '95%' },
  { title: 'AI 产品负责人', company: 'ScaleAI · 旧金山', salary: 'Equity + $220k', type: '', match: '96%' },
];

export default function TeamHomePage() {
  const [agents] = useState<AgentInfo[]>(MOCK_AGENTS);

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-4xl font-display font-extrabold tracking-tight">AI 求职运营团队</h1>
          <p className="text-sm text-muted-foreground mt-1">全天候精英运营 · 7 位专员协同工作</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full surface-card">
          <div className="w-2.5 h-2.5 rounded-full bg-status-active animate-pulse" />
          <span className="text-xs font-label uppercase tracking-wider">全系统运行中</span>
        </div>
      </div>

      {/* Agent Roster */}
      <div className="flex items-start gap-6 overflow-x-auto pb-4 mb-8">
        {agents.map((agent, i) => (
          <AnimatedContent key={agent.id} delay={i * 0.05}>
            <AgentBadge agent={agent} size="compact" />
          </AnimatedContent>
        ))}
      </div>

      {/* Main Grid: Feed + Sidebar */}
      <div className="grid lg:grid-cols-[1fr_400px] gap-6">
        {/* Left: Live Feed */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-display font-bold">实时动态</h2>
            <button className="text-xs text-muted-foreground hover:text-foreground transition-colors font-label uppercase tracking-wider">
              查看全部日志 →
            </button>
          </div>

          <div className="space-y-3">
            {MOCK_FEED.map((item, i) => (
              <AnimatedContent key={item.id} delay={i * 0.06}>
                <div className="surface-card p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold">{item.actor}</span>
                    <span className="text-xs text-muted-foreground">{item.time}</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.text}</p>
                  {item.actions.length > 0 && (
                    <div className="flex gap-2 mt-3">
                      {item.actions.map(a => (
                        <button key={a} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-surface-low hover:bg-border/40 transition-colors">
                          {a}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </AnimatedContent>
            ))}
          </div>
        </div>

        {/* Right: Sidebar */}
        <div className="space-y-5">
          {/* Handoff Alert */}
          <AnimatedContent>
            <SpotlightCard className="surface-card p-6 ring-1 ring-status-warning/20" spotlightColor="rgba(217, 119, 6, 0.06)">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">⚡</span>
                <h3 className="text-base font-display font-bold">需要你接管</h3>
              </div>
              <div className="space-y-4">
                {MOCK_HANDOFFS.map((h, i) => (
                  <div key={i}>
                    <p className="text-[10px] font-label uppercase tracking-widest text-muted-foreground mb-1">{h.type}</p>
                    <p className="text-sm font-semibold mb-0.5">{h.title}</p>
                    <p className="text-xs text-muted-foreground mb-2">{h.desc}</p>
                    <button className="px-4 py-2 text-xs font-semibold rounded-lg bg-surface-low hover:bg-border/40 transition-colors w-full">
                      {h.action}
                    </button>
                  </div>
                ))}
              </div>
            </SpotlightCard>
          </AnimatedContent>

          {/* High-Value Gems */}
          <div>
            <h3 className="text-base font-display font-bold mb-3">重点机会</h3>
            <div className="space-y-3">
              {MOCK_OPPORTUNITIES.map((opp, i) => (
                <SpotlightCard key={i} className="surface-card p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-bold">{opp.title}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">{opp.company}</p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <span>● {opp.salary}</span>
                        {opp.type && <span>{opp.type}</span>}
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-status-active/10 text-status-active text-[10px] font-bold uppercase">
                      {opp.match} 匹配
                    </span>
                  </div>
                </SpotlightCard>
              ))}
            </div>
          </div>

          {/* Runtime card */}
          <SpotlightCard className="surface-card p-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base">⭐</span>
              <h3 className="text-xs font-label uppercase tracking-widest text-muted-foreground">运行状态</h3>
            </div>
            <p className="text-sm font-semibold mb-1">当前使用 Pro 方案</p>
            <p className="text-xs text-muted-foreground mb-4">你的专员正以 1.5 倍速度运营，优先投递通道已启用。</p>
            <Link href="/billing" className="text-sm text-secondary font-semibold hover:underline">
              管理套餐 →
            </Link>
          </SpotlightCard>
        </div>
      </div>
    </div>
  );
}
