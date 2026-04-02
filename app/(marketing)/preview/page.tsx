'use client';

import Link from 'next/link';
import { AnimatedContent } from '@/components/ui/animated-content';

const PAGES = [
  {
    group: '营销页面',
    items: [
      { href: '/landing', label: 'Landing Page', desc: 'Hero + Explore + Pricing + FAQ' },
      { href: '/login', label: '登录页', desc: 'Google / GitHub OAuth' },
    ],
  },
  {
    group: 'Onboarding 流程',
    items: [
      { href: '/resume', label: 'Step 1: 上传简历', desc: '拖拽上传 + 进度状态' },
      { href: '/questions', label: 'Step 2: 求职偏好', desc: '目标岗位、城市、策略模式' },
      { href: '/complete', label: 'Step 3: 确认创建', desc: '团队阵容预览 + 创建' },
    ],
  },
  {
    group: '激活 & 就绪',
    items: [
      { href: '/activation', label: '团队激活', desc: '7 工牌掉落动画 + 激活按钮' },
      { href: '/readiness', label: '就绪检查', desc: 'Checklist + 平台连接快捷入口' },
    ],
  },
  {
    group: '核心工作区 (App)',
    items: [
      { href: '/home', label: '团队主页', desc: 'Agent roster + Live feed + 重点机会 + 接管提醒' },
      { href: '/opportunities', label: '机会工作台', desc: 'Pipeline kanban + 列表视图 + 侧面板详情' },
      { href: '/handoffs', label: '交接中心', desc: 'Urgency 列表 + 上下文摘要 + 建议回复' },
      { href: '/platforms', label: '平台中心', desc: '中英文分区 + Capability 健康度 + 连接管理' },
      { href: '/billing', label: '套餐方案', desc: '当前方案 + 用量进度条 + 三级定价' },
      { href: '/settings', label: '设置', desc: '个人信息 + 求职偏好 + 投递资料' },
    ],
  },
];

export default function PreviewPage() {
  return (
    <div className="min-h-screen bg-background px-10 py-16">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-5xl font-display font-extrabold tracking-tight mb-3">页面预览</h1>
        <p className="text-base text-muted-foreground mb-12">
          所有页面的入口。点击直接预览，无需登录。
        </p>

        <div className="space-y-12">
          {PAGES.map((group, gi) => (
            <AnimatedContent key={group.group} delay={gi * 0.1}>
              <div>
                <h2 className="text-xs font-label uppercase tracking-[0.2em] text-muted-foreground mb-4">{group.group}</h2>
                <div className="grid md:grid-cols-2 gap-4">
                  {group.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="surface-card p-6 hover:shadow-lifted transition-all duration-300 group"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-base font-bold group-hover:text-secondary transition-colors">{item.label}</h3>
                          <p className="text-sm text-muted-foreground mt-1">{item.desc}</p>
                        </div>
                        <span className="text-muted-foreground/30 group-hover:text-foreground group-hover:translate-x-1 transition-all text-lg">→</span>
                      </div>
                      <p className="text-xs text-muted-foreground/40 mt-3 font-mono">{item.href}</p>
                    </Link>
                  ))}
                </div>
              </div>
            </AnimatedContent>
          ))}
        </div>

        <div className="mt-16 pt-8 border-t border-border/20 text-xs text-muted-foreground/40">
          海投 OS · Preview Dashboard · {PAGES.reduce((a, g) => a + g.items.length, 0)} pages
        </div>
      </div>
    </div>
  );
}
