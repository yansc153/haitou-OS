'use client';

import { useState } from 'react';
import { AnimatedContent } from '@/components/ui/animated-content';

export default function LoginPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleOAuth = async (provider: 'google' | 'github') => {
    setLoading(provider);
    setError('');
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
    } catch {
      setError('登录服务暂不可用，请稍后重试');
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top nav */}
      <div className="px-10 py-6 flex items-center justify-between">
        <span className="text-xl font-display font-extrabold">海投 OS</span>
      </div>

      {/* Centered login */}
      <div className="flex-1 flex items-center justify-center px-6">
        <AnimatedContent>
          <div className="w-full max-w-xl text-center">
            {/* Title — one line, very large */}
            <h1 className="text-5xl lg:text-[56px] font-display font-extrabold leading-none mb-4 whitespace-nowrap">
              拥有你的 AI 求职运营团队
            </h1>
            <p className="text-lg text-muted-foreground mb-14">
              登录以组建你的专属运营团队
            </p>

            {/* OAuth card */}
            <div className="surface-card p-10 space-y-5 max-w-md mx-auto">
              <button
                onClick={() => handleOAuth('google')}
                disabled={loading !== null}
                className="flex w-full items-center justify-center gap-3 rounded-xl bg-surface-low px-5 py-4 text-base font-medium hover:bg-border/30 transition-colors disabled:opacity-50"
              >
                {loading === 'google' ? '跳转中...' : (
                  <>
                    <GoogleIcon />
                    使用 Google 登录
                  </>
                )}
              </button>

              <button
                onClick={() => handleOAuth('github')}
                disabled={loading !== null}
                className="flex w-full items-center justify-center gap-3 rounded-xl bg-surface-low px-5 py-4 text-base font-medium hover:bg-border/30 transition-colors disabled:opacity-50"
              >
                {loading === 'github' ? '跳转中...' : (
                  <>
                    <GithubIcon />
                    使用 GitHub 登录
                  </>
                )}
              </button>

              {error && <p className="text-base text-destructive">{error}</p>}

              <div className="flex items-center gap-3 pt-4">
                <div className="h-px flex-1 bg-border/30" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-label">安全登录</span>
                <div className="h-px flex-1 bg-border/30" />
              </div>

              <p className="text-sm text-muted-foreground">
                登录即表示同意
                <a href="/legal/terms" className="underline hover:text-foreground ml-1">服务条款</a>
                {' '}和{' '}
                <a href="/legal/privacy" className="underline hover:text-foreground">隐私政策</a>
              </p>
            </div>
          </div>
        </AnimatedContent>
      </div>

      {/* Bottom status */}
      <div className="px-10 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60 uppercase tracking-[0.2em] font-label">
          <div className="h-px w-8 bg-border/40" />
          THE DIGITAL ATELIER | 2026
          <div className="h-px w-8 bg-border/40" />
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60 uppercase tracking-widest font-label">
          <span>SYSTEM STATUS</span>
          <div className="w-2 h-2 rounded-full bg-status-active" />
          <span>全部在线</span>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}
