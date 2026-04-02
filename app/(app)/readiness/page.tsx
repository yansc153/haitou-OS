'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatedContent } from '@/components/ui/animated-content';
import { SpotlightCard } from '@/components/ui/spotlight-card';
import { PIXEL_AVATARS } from '@/components/agents/pixel-avatars';

const PLATFORMS = [
  { code: 'boss_zhipin', name: 'Boss 直聘', status: 'connected' as const },
  { code: 'linkedin', name: 'LinkedIn · 领英', status: 'needs_auth' as const },
  { code: 'lagou', name: '拉勾', status: 'disconnected' as const },
  { code: 'zhaopin', name: '智联招聘', status: 'disconnected' as const },
  { code: 'greenhouse', name: 'Greenhouse', status: 'disconnected' as const },
  { code: 'lever', name: 'Lever', status: 'disconnected' as const },
];

export default function ReadinessPage() {
  const [contactEmail, setContactEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [salary, setSalary] = useState('');
  const [starting, setStarting] = useState(false);
  const router = useRouter();
  const ScoutAvatar = PIXEL_AVATARS['opportunity_research'];

  const profileComplete = contactEmail.length > 0 && phone.length > 0;
  const hasConnectedPlatform = PLATFORMS.some(p => p.status === 'connected');
  const canStart = profileComplete && hasConnectedPlatform;

  return (
    <div>
      <div className="mb-10">
        <h1 className="text-4xl font-display font-extrabold tracking-tight">就绪检查</h1>
        <p className="text-base text-muted-foreground mt-2">确认身份档案和平台连接，确保团队拥有开始运营所需的一切。</p>
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-8">
        <div className="space-y-10">
          {/* Step 01 */}
          <AnimatedContent>
            <div>
              <p className="text-xs font-label uppercase tracking-[0.2em] text-muted-foreground mb-4">STEP 01</p>
              <h2 className="text-2xl font-display font-bold mb-6">身份档案</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <SpotlightCard className="surface-card p-6">
                  <h3 className="text-base font-bold mb-1">联系方式</h3>
                  <p className="text-xs text-muted-foreground mb-4">平台通知和面试联系</p>
                  <input type="email" placeholder="your@email.com" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="w-full px-4 py-3 text-sm bg-surface-low rounded-xl border-0 focus:outline-none focus:ring-2 focus:ring-secondary mb-3" />
                  <input type="tel" placeholder="+86 138 0000 0000" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-4 py-3 text-sm bg-surface-low rounded-xl border-0 focus:outline-none focus:ring-2 focus:ring-secondary" />
                </SpotlightCard>
                <SpotlightCard className="surface-card p-6">
                  <h3 className="text-base font-bold mb-1">电子简历</h3>
                  <p className="text-xs text-muted-foreground mb-4">已上传的简历</p>
                  <div className="flex items-center gap-3 p-3 bg-surface-low rounded-xl">
                    <span className="text-lg">📄</span>
                    <div><p className="text-sm font-semibold">Resume_2026.pdf</p><p className="text-xs text-muted-foreground">已就绪</p></div>
                  </div>
                </SpotlightCard>
              </div>
              <SpotlightCard className="surface-card p-6 mt-4">
                <div className="flex items-start justify-between">
                  <div><h3 className="text-base font-bold mb-1">自动填充偏好</h3><p className="text-xs text-muted-foreground">期望薪资、入职时间等</p></div>
                  <a href="/settings" className="text-xs text-secondary font-semibold hover:underline">编辑详情</a>
                </div>
                <input type="text" placeholder="期望薪资（选填）" value={salary} onChange={(e) => setSalary(e.target.value)} className="w-full mt-4 px-4 py-3 text-sm bg-surface-low rounded-xl border-0 focus:outline-none focus:ring-2 focus:ring-secondary" />
              </SpotlightCard>
            </div>
          </AnimatedContent>

          {/* Step 02 */}
          <AnimatedContent delay={0.15}>
            <div>
              <p className="text-xs font-label uppercase tracking-[0.2em] text-muted-foreground mb-4">STEP 02</p>
              <h2 className="text-2xl font-display font-bold mb-6">平台连接</h2>
              <div className="grid md:grid-cols-3 gap-4">
                {PLATFORMS.map(p => (
                  <SpotlightCard key={p.code} className="surface-card p-5">
                    <h4 className="text-sm font-bold mb-3">{p.name}</h4>
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`w-2 h-2 rounded-full ${p.status === 'connected' ? 'bg-status-active' : p.status === 'needs_auth' ? 'bg-status-warning' : 'bg-muted-foreground/30'}`} />
                      <span className={`text-xs font-semibold ${p.status === 'connected' ? 'text-status-active' : p.status === 'needs_auth' ? 'text-status-warning' : 'text-muted-foreground'}`}>
                        {p.status === 'connected' ? '已连接' : p.status === 'needs_auth' ? '需重新认证' : '未连接'}
                      </span>
                    </div>
                    {p.status !== 'connected' && (
                      <button
                        onClick={() => alert('请使用浏览器扩展导出 Cookie 来连接 ' + p.name + '。\n\n安装扩展后，登录平台，点击 Export 按钮。')}
                        className="w-full py-2 text-xs font-semibold rounded-lg bg-surface-low hover:bg-border/40 transition-colors"
                      >
                        {p.status === 'needs_auth' ? '重新认证' : '连接'}
                      </button>
                    )}
                  </SpotlightCard>
                ))}
              </div>
            </div>
          </AnimatedContent>
        </div>

        {/* Right sidebar */}
        <AnimatedContent delay={0.2} direction="right">
          <div className="sticky top-20 space-y-5">
            <div className="surface-card p-6 rounded-2xl">
              <h3 className="text-lg font-display font-bold mb-4">启动协议</h3>
              <div className="space-y-3 mb-6">
                {[
                  { done: true, label: '简历已上传并解析' },
                  { done: profileComplete, label: '联系方式已填写' },
                  { done: true, label: '7 位专员已分配' },
                  { done: hasConnectedPlatform, label: '至少连接一个平台' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${item.done ? 'bg-status-active/10 text-status-active' : 'bg-muted-foreground/10 text-muted-foreground/40'}`}>
                      {item.done ? '✓' : '○'}
                    </div>
                    <span className={`text-sm ${item.done ? 'font-medium' : 'text-muted-foreground'}`}>{item.label}</span>
                  </div>
                ))}
              </div>
              <div className="h-px bg-border/20 mb-4" />
              <p className="text-[10px] font-label uppercase tracking-widest text-muted-foreground mb-1">运营模式</p>
              <p className="text-sm font-semibold mb-6">专业运营 · 全自动执行</p>
              <button
                onClick={() => { setStarting(true); router.push('/home'); }}
                disabled={!canStart || starting}
                className="w-full py-3.5 bg-foreground text-background rounded-xl text-base font-bold hover:opacity-90 transition-opacity disabled:opacity-30"
              >
                {starting ? '启动中...' : '启动团队 | 开始运营'}
              </button>
            </div>
            <div className="surface-card p-5 rounded-2xl">
              <div className="flex items-center gap-3">
                {ScoutAvatar && <ScoutAvatar size={40} />}
                <div><p className="text-sm font-bold">岗位研究员</p><p className="text-xs text-muted-foreground">等待部署</p></div>
              </div>
            </div>
          </div>
        </AnimatedContent>
      </div>
    </div>
  );
}
