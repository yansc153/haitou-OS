'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatedContent } from '@/components/ui/animated-content';

const PLATFORMS = [
  { name: 'LinkedIn', short: 'Li' },
  { name: 'Boss直聘', short: 'Boss' },
  { name: '智联招聘', short: '智联' },
  { name: '拉勾', short: '拉勾' },
  { name: '猎聘', short: '猎聘' },
];

export default function ExtensionPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleNext = async (skipped: boolean) => {
    setSubmitting(true);
    setError('');
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const { getValidSession } = await import('@/lib/hooks/use-api');
      const supabase = createClient();
      const session = await getValidSession(supabase);
      if (!session) { setError('请先登录'); setSubmitting(false); return; }

      const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/onboarding-draft`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: { extension_step: skipped ? 'skipped' : 'completed', current_step: 3 } }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setError(`保存失败: ${j.error?.message || r.status}`);
        setSubmitting(false);
        return;
      }
      router.push('/activation');
    } catch (e) {
      setError(`请求失败: ${e instanceof Error ? e.message : '未知错误'}`);
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-[800px] mx-auto">
      <AnimatedContent>
        <div className="text-center mb-12">
          <p className="text-xs font-label uppercase tracking-[0.2em] text-secondary font-semibold mb-3">STEP 03</p>
          <h1 className="text-5xl lg:text-[56px] font-display font-extrabold leading-tight tracking-tight">
            安装浏览器插件
          </h1>
          <p className="text-lg text-muted-foreground mt-4 max-w-xl mx-auto">
            插件让团队能安全读取你的平台登录状态，解锁 LinkedIn 和中文招聘平台。
          </p>
        </div>
      </AnimatedContent>

      {/* 3-step guide cards */}
      <AnimatedContent delay={0.05}>
        <div className="grid md:grid-cols-3 gap-5 mb-8">
          {/* Step 1: Download */}
          <div className="bg-card rounded-2xl p-8 shadow-sm flex flex-col">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-surface-low flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </div>
              <span className="text-xs font-bold text-white bg-secondary/80 w-6 h-6 rounded-full flex items-center justify-center">1</span>
            </div>
            <h3 className="text-lg font-display font-bold mb-2">下载插件</h3>
            <p className="text-sm text-muted-foreground mb-6 flex-1">下载核心扩展包到你的设备</p>
            <a
              href="#"
              className="block w-full py-3 bg-foreground text-background rounded-xl text-sm font-bold text-center hover:opacity-90 transition-opacity"
            >
              下载 Chrome 插件
            </a>
          </div>

          {/* Step 2: Install */}
          <div className="bg-card rounded-2xl p-8 shadow-sm flex flex-col">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-surface-low flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v5.5" />
                  <path d="M14 2v6h6" />
                  <path d="M4.5 11a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z" />
                  <path d="M9.5 16a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z" />
                  <path d="M14.5 11a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z" />
                </svg>
              </div>
              <span className="text-xs font-bold text-white bg-secondary/80 w-6 h-6 rounded-full flex items-center justify-center">2</span>
            </div>
            <h3 className="text-lg font-display font-bold mb-2">安装到浏览器</h3>
            <p className="text-sm text-muted-foreground flex-1">
              打开 chrome://extensions，开启开发者模式，加载已解压的扩展
            </p>
          </div>

          {/* Step 3: Connect platforms */}
          <div className="bg-card rounded-2xl p-8 shadow-sm flex flex-col">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-surface-low flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
              </div>
              <span className="text-xs font-bold text-white bg-secondary/80 w-6 h-6 rounded-full flex items-center justify-center">3</span>
            </div>
            <h3 className="text-lg font-display font-bold mb-2">连接平台</h3>
            <p className="text-sm text-muted-foreground mb-4">连接你的招聘平台账号</p>
            <div className="grid grid-cols-3 gap-2">
              {PLATFORMS.map((p) => (
                <div
                  key={p.name}
                  className="bg-surface-low rounded-lg px-2 py-1.5 text-xs font-medium text-center truncate"
                >
                  {p.name}
                </div>
              ))}
            </div>
          </div>
        </div>
      </AnimatedContent>

      {/* Info notes */}
      <AnimatedContent delay={0.1}>
        <div className="space-y-4 mb-10">
          <p className="text-sm text-status-active text-center">
            Greenhouse 和 Lever 已自动连接，无需插件 ✓
          </p>

          <div className="flex items-start gap-3 justify-center text-center max-w-lg mx-auto">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground mt-0.5 shrink-0">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <p className="text-sm text-muted-foreground leading-relaxed">
              我们从不存储你的密码。插件仅用于同步授权的 Cookie 以便 AI 代为投递，全程加密传输。
            </p>
          </div>
        </div>
      </AnimatedContent>

      {/* Error */}
      {error && (
        <p className="text-sm text-destructive bg-destructive/10 px-4 py-3 rounded-xl text-center mb-6">
          {error}
        </p>
      )}

      {/* Bottom buttons */}
      <AnimatedContent delay={0.15}>
        <div className="flex items-center justify-center gap-6">
          <button
            onClick={() => handleNext(true)}
            disabled={submitting}
            className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium disabled:opacity-30"
          >
            跳过此步
          </button>
          <button
            onClick={() => handleNext(false)}
            disabled={submitting}
            className="bg-foreground text-background rounded-xl py-3 px-8 font-bold hover:opacity-90 transition-opacity disabled:opacity-30"
          >
            {submitting ? '保存中...' : '下一步 →'}
          </button>
        </div>
      </AnimatedContent>
    </div>
  );
}
