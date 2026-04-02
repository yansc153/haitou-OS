'use client';

import { BlurText } from '@/components/ui/blur-text';
import { TypingText } from '@/components/ui/typing-text';
import { AnimatedContent } from '@/components/ui/animated-content';
import { SpotlightCard } from '@/components/ui/spotlight-card';
import { AgentBadge, type AgentInfo } from '@/components/agents/agent-badge';
import { PIXEL_AVATARS } from '@/components/agents/pixel-avatars';
import { LogoLinkedIn, LogoGreenhouse, LogoLever, LogoIndeed, LogoBoss, LogoZhaopin, LogoLagou, LogoLiepin } from '@/components/ui/platform-logos';
import Link from 'next/link';
import React, { useState } from 'react';

const AGENTS: AgentInfo[] = [
  { id: '1', role_code: 'opportunity_research', title_zh: '岗位研究员', persona_name: 'Scout', status: 'working' },
  { id: '2', role_code: 'matching_review', title_zh: '匹配审核员', persona_name: 'Reviewer', status: 'working' },
  { id: '3', role_code: 'materials_advisor', title_zh: '简历顾问', persona_name: 'Advisor', status: 'ready' },
  { id: '4', role_code: 'orchestrator', title_zh: '调度官', persona_name: 'Commander', status: 'working' },
  { id: '5', role_code: 'profile_intelligence', title_zh: '履历分析师', persona_name: 'Analyst', status: 'ready' },
  { id: '6', role_code: 'application_executor', title_zh: '投递专员', persona_name: 'Executor', status: 'working' },
  { id: '7', role_code: 'relationship_manager', title_zh: '招聘关系经理', persona_name: 'Liaison', status: 'ready' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Top Nav — flush to edges */}
      <nav className="fixed top-0 w-full z-50 bg-background/90 backdrop-blur-md">
        <div className="px-10 h-16 flex items-center justify-between">
          <span className="text-2xl font-display font-extrabold tracking-tight">海投 OS</span>
          <div className="flex items-center gap-6">
            <span className="text-base text-muted-foreground hover:text-foreground cursor-pointer transition-colors">EN / 中</span>
            <Link href="/login" className="px-6 py-2.5 bg-foreground text-background rounded-xl text-base font-semibold hover:opacity-90 transition-opacity">登录</Link>
          </div>
        </div>
      </nav>

      {/* ═══════ HERO: Split Layout — Left 40% / Right 60% ═══════ */}
      <section className="min-h-screen flex">
        {/* Left — Sticky copy */}
        <div className="w-[40%] sticky top-0 h-screen flex flex-col justify-center px-10 lg:px-14">
          {/* H1: 主标题 — 最大，80px+ */}
          <h1 className="text-7xl lg:text-[84px] font-display font-extrabold leading-[0.95] tracking-tight">
            <BlurText text="求职新方式。" delay={100} />
          </h1>

          {/* 副标题 — 明显比 H1 小，但比正文大 */}
          <div className="mt-6 h-12">
            <TypingText
              phrases={[
                '拥有属于你的 AI 求职运营团队',
                '从现在开始，一人即是一整个团队',
              ]}
              typingSpeed={50}
              deletingSpeed={25}
              pauseDuration={3000}
              className="text-xl font-display font-medium text-muted-foreground/70"
            />
          </div>

          {/* 描述文字 — 比副标题小 */}
          <p className="mt-4 text-base text-muted-foreground/60 leading-relaxed max-w-sm">
            7 位 AI 求职专员，覆盖中英双区主流平台。自动投递、跟进、直到面试。
          </p>

          {/* CTA */}
          <div className="mt-8">
            <Link
              href="/login"
              className="inline-flex px-10 py-4 bg-foreground text-background rounded-2xl text-lg font-display font-semibold hover:opacity-90 transition-opacity"
            >
              开始组建团队 →
            </Link>
            <p className="mt-3 text-sm text-muted-foreground/40">免费开始 · 无需绑卡</p>
          </div>

          {/* Social proof: pixel avatars with dark circle bg */}
          <div className="mt-10 flex items-center gap-4">
            <div className="flex -space-x-2.5">
              {AGENTS.slice(0, 5).map((agent) => {
                const Avatar = PIXEL_AVATARS[agent.role_code];
                return (
                  <div key={agent.id} className="w-11 h-11 rounded-full bg-foreground ring-[3px] ring-background overflow-hidden flex items-center justify-center">
                    {Avatar && <Avatar size={36} />}
                  </div>
                );
              })}
            </div>
            <div>
              <span className="text-lg font-display font-bold text-foreground">200+</span>
              <span className="text-sm text-muted-foreground ml-1.5">团队已加入</span>
            </div>
          </div>
        </div>

        {/* Right — 60%, dark bg */}
        <div className="w-[60%] bg-foreground text-background min-h-screen flex flex-col">
          {/* 右侧主标题 — 大，居中，焦虑感 slogan */}
          <div className="px-12 lg:px-16 pt-28 pb-6 text-center">
            <h2 className="text-4xl lg:text-5xl font-display font-extrabold mb-3 leading-tight">
              别人已经有团队了，<br />你还在一个人投简历？
            </h2>
            <p className="text-sm text-background/40 max-w-md mx-auto leading-relaxed">
              现在开始，组建你的 AI 求职运营团队
            </p>
          </div>

          {/* 数据 — 超大数字 */}
          <div className="flex justify-center gap-16 lg:gap-24 py-6">
            {[
              { value: '7+', label: '覆盖平台' },
              { value: '7', label: 'AI 专员' },
              { value: '24/7', label: '持续运行' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-7xl lg:text-8xl xl:text-[96px] font-display font-extrabold leading-none">{stat.value}</div>
                <div className="text-xs text-background/30 mt-3 uppercase tracking-widest">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="mx-12 lg:mx-16 h-px bg-background/10" />

          {/* 团队区 — 更多上方空间 + 更大工牌 */}
          <div className="px-8 lg:px-10 pt-16 pb-16 text-center flex-1">
            <h3 className="text-4xl lg:text-5xl font-display font-extrabold mb-3">你的专属运营团队</h3>
            <p className="text-base text-background/35 mb-12">7 位专员各司其职，全天候待命</p>

            {/* Hanging badge cards — large */}
            <div className="flex flex-wrap justify-center gap-5 lg:gap-6">
              {AGENTS.map((agent, i) => (
                <div
                  key={agent.id}
                  className="animate-[dropIn_0.6s_ease-out_both] flex flex-col items-center"
                  style={{ animationDelay: `${800 + i * 150}ms` }}
                >
                  {/* Lanyard */}
                  <div className="w-px h-10 bg-background/15" />
                  <div className="w-5 h-1.5 rounded-full bg-background/20 mb-3" />

                  {/* Badge — 160px wide */}
                  <div className="w-[155px] bg-background/15 hover:bg-background/22 rounded-2xl p-5 flex flex-col items-center text-center transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl">
                    {(() => {
                      const Avatar = PIXEL_AVATARS[agent.role_code];
                      return Avatar ? <Avatar size={64} /> : null;
                    })()}
                    <div className="mt-3 text-base font-bold">{agent.title_zh}</div>
                    <div className="text-xs text-background/40 font-label mt-1">{agent.persona_name}</div>
                    <div className="mt-3 flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${agent.status === 'working' ? 'bg-green-400 animate-pulse' : 'bg-background/25'}`} />
                      <span className="text-[11px] text-background/35">{agent.status === 'working' ? '运行中' : '待命'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ SECTION 2: Split — Sticky Nav + Scrolling Content ═══════ */}
      <ExploreSection />

      {/* ═══════ SECTION 3: Statement + Platform Logos ═══════ */}
      <section className="py-32 px-8">
        <div className="max-w-[1200px] mx-auto text-center">
          <AnimatedContent>
            <h2 className="text-4xl lg:text-5xl font-display font-extrabold leading-tight">
              把一个人的求职，<br />升级为整支团队的运作
            </h2>
          </AnimatedContent>

          <AnimatedContent delay={0.2}>
            <div className="mt-16 space-y-12">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-[0.25em] font-label mb-6">中文平台</p>
                <div className="flex items-center justify-center gap-12 lg:gap-16 text-muted-foreground/35">
                  <LogoBoss className="text-2xl" />
                  <LogoZhaopin className="text-2xl" />
                  <LogoLagou className="text-2xl" />
                  <LogoLiepin className="text-2xl" />
                </div>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-[0.25em] font-label mb-6">English Platforms</p>
                <div className="flex items-center justify-center gap-12 lg:gap-16 text-muted-foreground/35">
                  <LogoLinkedIn className="h-5 w-auto" />
                  <LogoGreenhouse className="text-2xl" />
                  <LogoLever className="text-2xl" />
                  <LogoIndeed className="text-2xl" />
                </div>
              </div>
            </div>
          </AnimatedContent>
        </div>
      </section>

      {/* ═══════ SECTION 4: Pricing ═══════ */}
      <section className="py-24 px-8 surface-low">
        <div className="max-w-[1000px] mx-auto">
          <AnimatedContent>
            <h2 className="text-4xl font-display font-bold text-center mb-4">团队能力与覆盖规模</h2>
            <p className="text-center text-muted-foreground mb-16">选择适合你的团队配置</p>
          </AnimatedContent>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              { name: 'Free', zh: '个人体验版', price: '¥0', features: ['英文区 3 个平台', '每月 2 小时运行', '基础简历定制'], cta: '免费开始', hl: false },
              { name: 'Pro', zh: '全渠道职航版', price: '¥299', features: ['开通 7 个主流平台', '每月 8 小时运行', 'AI 定制简历 + 求职信', '全自动投递 + 跟进'], cta: '试用 Pro', hl: true },
              { name: 'Plus', zh: '极速推进版', price: '¥899', features: ['全平台覆盖', '每月 24 小时运行', '多重投递策略', '优先客服'], cta: '升级 Plus', hl: false },
            ].map((plan, i) => (
              <AnimatedContent key={plan.name} delay={i * 0.1}>
                <div className={`surface-card p-8 relative h-full flex flex-col ${plan.hl ? 'ring-2 ring-foreground shadow-lifted' : ''}`}>
                  {plan.hl && (
                    <div className="absolute -top-4 left-6 px-4 py-1.5 bg-foreground text-background text-[10px] font-bold uppercase tracking-widest rounded-full">
                      Most Popular
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground mb-1 font-label">{plan.zh}</div>
                  <div className="text-lg font-display font-bold">{plan.name}</div>
                  <div className="text-4xl font-display font-extrabold mt-2 mb-6">{plan.price}<span className="text-sm font-normal text-muted-foreground">/月</span></div>
                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <span className="text-secondary mt-0.5">→</span>{f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/login"
                    className={`block w-full text-center py-3 rounded-xl text-sm font-semibold transition-all ${
                      plan.hl ? 'bg-foreground text-background hover:opacity-90' : 'bg-surface-low text-foreground hover:bg-border/40'
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </div>
              </AnimatedContent>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ SECTION 5: FAQ (SuperHi line style + ⊕) ═══════ */}
      <section className="flex min-h-[80vh]">
        {/* Left — Agent cluster decoration */}
        <div className="hidden lg:flex w-2/5 items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-6">
            <div className="grid grid-cols-3 gap-4">
              {AGENTS.slice(0, 6).map((agent) => {
                const Avatar = PIXEL_AVATARS[agent.role_code];
                return Avatar ? <Avatar key={agent.id} size={72} /> : null;
              })}
            </div>
            <div>
              {(() => { const Avatar = PIXEL_AVATARS[AGENTS[6].role_code]; return Avatar ? <Avatar size={72} /> : null; })()}
            </div>
            <p className="text-xs text-muted-foreground/40 font-label uppercase tracking-widest mt-4">Your Team · 你的团队</p>
          </div>
        </div>

        {/* Right — FAQ */}
        <div className="flex-1 bg-foreground text-background px-12 lg:px-20 py-24 flex flex-col justify-center">
          <h2 className="text-3xl font-display font-bold mb-12">常见问题</h2>

          {[
            { q: '海投助手会自动投递简历吗？', a: '是。在你设定的范围内，团队会自动搜索、筛选、投递。但所有关键节点（薪资确认、面试安排、私人联系方式）都会暂停并提醒你接管。' },
            { q: 'AI 会不会代我发出不当消息？', a: '不会。招聘关系经理只处理低风险沟通。涉及敏感话题时系统立即暂停。所有外发消息基于你的真实简历，绝不编造资质。' },
            { q: '支持哪些平台？', a: '英文区：LinkedIn、Greenhouse、Lever。中文区：智联招聘、拉勾。Boss直聘和猎聘即将上线。' },
            { q: '我的数据安全吗？', a: '所有简历和平台凭证均通过 AES-256 加密存储，遵守 GDPR 规范，绝不对外共享数据。' },
            { q: '免费版和付费版有什么区别？', a: '免费版覆盖英文区 3 个平台，每月 2 小时运行时间。Pro 版解锁中文区平台和 8 小时运行。Plus 版提供 24 小时全天候运行。' },
          ].map((item, i) => (
            <FAQItem key={i} question={item.q} answer={item.a} />
          ))}
        </div>
      </section>

      {/* ═══════ FOOTER ═══════ */}
      <footer className="py-16 px-8 bg-background">
        <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row items-start justify-between gap-8">
          <div>
            <span className="text-sm font-display font-bold">海投 OS</span>
            <p className="text-xs text-muted-foreground mt-1">The Digital Atelier · 专为精英求职者设计</p>
          </div>
          <div className="flex gap-12 text-xs text-muted-foreground">
            <div className="space-y-2">
              <p className="font-semibold text-foreground uppercase tracking-widest text-[10px] font-label">Product</p>
              <a href="#" className="block hover:text-foreground transition-colors">Team Agents</a>
              <a href="#" className="block hover:text-foreground transition-colors">Platforms</a>
              <a href="#" className="block hover:text-foreground transition-colors">Pricing</a>
            </div>
            <div className="space-y-2">
              <p className="font-semibold text-foreground uppercase tracking-widest text-[10px] font-label">Legal</p>
              <a href="#" className="block hover:text-foreground transition-colors">隐私政策</a>
              <a href="#" className="block hover:text-foreground transition-colors">服务条款</a>
            </div>
          </div>
        </div>
        <div className="max-w-[1200px] mx-auto mt-12 pt-8 border-t border-border/20 text-xs text-muted-foreground/50">
          © 2026 Haitou OS. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

const SECTIONS = [
  {
    id: 'apply',
    label: '智能投递',
    en: 'Smart Apply',
    title: '你的投递 + 我们的自动化',
    desc: '英文区：每个岗位获得量身定制的简历和求职信。中文区：原始简历直投，速度优先。投递专员自动完成 Greenhouse、Lever、LinkedIn、智联、拉勾的表单填写和提交。',
    bullets: ['英文区简历逐岗定制', '中文区一键海投', '自动处理筛选题', '投递去重，避免重复'],
  },
  {
    id: 'screen',
    label: '匹配筛选',
    en: 'Fit Screening',
    title: '精准匹配，不浪费每一次投递',
    desc: '匹配审核员评估每个岗位的技能匹配度、资历对齐、地点契合。只有「值得投」的机会才进入投递流程。',
    bullets: ['五维匹配评估', '冲突检测（签证、地点、资历）', '策略模式可调：均衡/广撒网/精准', '人工不可及的覆盖速度'],
  },
  {
    id: 'followup',
    label: '自动跟进',
    en: 'Follow-up',
    title: '投递不是终点，团队替你推进',
    desc: '招聘关系经理自动读取雇主回复，判断意向，发送低风险跟进消息。你不需要每天刷收件箱。遇到薪资谈判、面试安排等关键节点，系统立即暂停，交给你决定。',
    bullets: ['自动读取雇主回复', '低风险跟进消息自动发送', '薪资 / 面试安排自动暂停', '上下文摘要 + 建议回复，你来决定'],
  },
];

function ExploreSection() {
  const [activeIndex, setActiveIndex] = useState(0);

  // Use IntersectionObserver to track which right-side section is in view
  const observerCallback = (id: string) => (entries: IntersectionObserverEntry[]) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const idx = SECTIONS.findIndex((s) => s.id === id);
        if (idx !== -1) setActiveIndex(idx);
      }
    });
  };

  return (
    <section className="flex">
      {/* Left — Scrollable content — 40% light, same side as Hero left */}
      <div className="w-[40%]">
        {SECTIONS.map((section, i) => (
          <ScrollSection key={section.id} id={section.id} onVisible={() => setActiveIndex(i)}>
            <div className={`min-h-screen flex flex-col justify-center px-12 lg:px-16 py-20 ${i % 2 === 0 ? 'bg-surface-low' : 'bg-background'}`}>
              <div className="text-[10px] text-muted-foreground uppercase tracking-[0.25em] font-label mb-4">
                {section.en}
              </div>
              <h3 className="text-4xl lg:text-5xl xl:text-[56px] font-display font-extrabold mb-6 leading-[1.1] tracking-tight">
                {section.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed mb-8 max-w-lg text-sm">
                {section.desc}
              </p>
              <div className="space-y-3 mb-10">
                {section.bullets.map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <span className="text-secondary">→</span>
                    <span className="text-sm">{item}</span>
                  </div>
                ))}
              </div>

              {/* Video placeholder — taller */}
              <div className="rounded-2xl bg-foreground/5 border border-border/20 aspect-[16/12] w-full max-w-xl flex items-center justify-center cursor-pointer hover:bg-foreground/8 transition-colors group">
                <div className="flex flex-col items-center gap-3 text-muted-foreground/30 group-hover:text-muted-foreground/50 transition-colors">
                  <div className="w-14 h-14 rounded-full bg-foreground/8 flex items-center justify-center group-hover:bg-foreground/12 transition-colors">
                    <span className="text-2xl ml-0.5">▶</span>
                  </div>
                  <span className="text-[10px] font-label uppercase tracking-[0.2em]">Watch Demo</span>
                </div>
              </div>
            </div>
          </ScrollSection>
        ))}
      </div>

      {/* Right — Sticky giant nav — 60% dark, same side as Hero right */}
      <div className="w-[60%] bg-foreground text-background sticky top-0 h-screen flex flex-col justify-center px-12 lg:px-20">
        <p className="text-xs text-background/30 uppercase tracking-[0.2em] font-label mb-10">
          Explore Haitou OS
        </p>

        {SECTIONS.map((section, i) => (
          <div
            key={section.id}
            className="py-5 border-t border-background/10 transition-all duration-500 cursor-pointer"
          >
            <div className="flex items-center gap-5">
              <span className={`text-4xl transition-all duration-500 ${activeIndex === i ? 'text-background translate-x-2' : 'text-background/20'}`}>
                →
              </span>
              <span className={`text-5xl lg:text-6xl xl:text-7xl font-display font-extrabold transition-all duration-500 ${
                activeIndex === i ? 'text-background' : 'text-background/20'
              }`}>
                {section.label}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ScrollSection({ id, children, onVisible }: { id: string; children: React.ReactNode; onVisible: () => void }) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) onVisible();
        });
      },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [onVisible]);

  return <div ref={ref} id={id}>{children}</div>;
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-t border-background/10">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-6 text-left"
      >
        <span className="text-lg font-display font-semibold pr-8">{question}</span>
        <span className={`flex-shrink-0 w-8 h-8 rounded-full border border-background/20 flex items-center justify-center text-sm transition-transform ${open ? 'rotate-45' : ''}`}>
          +
        </span>
      </button>
      {open && (
        <div className="pb-6 text-sm text-background/60 leading-relaxed max-w-lg">
          {answer}
        </div>
      )}
    </div>
  );
}
