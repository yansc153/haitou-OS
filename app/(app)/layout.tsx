'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { RuntimeContext, type RuntimeState } from '@/lib/hooks/use-runtime';

const NAV_ITEMS = [
  { href: '/home', label: '团队主页' },
  { href: '/opportunities', label: '机会中心' },
  { href: '/handoffs', label: '交接中心' },
  { href: '/platforms', label: '平台中心' },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [runtime, setRuntime] = useState<RuntimeState>({ status: 'paused', loading: false });

  useEffect(() => {
    async function loadRuntime() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/home-get`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (json.data?.runtime) {
        setRuntime({ status: json.data.runtime.runtime_status, loading: false });
      }
    }
    loadRuntime();
  }, [supabase]);

  const toggleRuntime = async () => {
    setRuntime(prev => ({ ...prev, loading: true }));
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setRuntime(prev => ({ ...prev, loading: false })); return; }

    const endpoint = runtime.status === 'active' ? 'team-pause' : 'team-start';
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${endpoint}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      });
      const json = await res.json();
      if (res.ok) {
        setRuntime({ status: json.data?.runtime_status || (endpoint === 'team-pause' ? 'paused' : 'active'), loading: false });
      } else {
        alert(json.error?.message || '操作失败');
        setRuntime(prev => ({ ...prev, loading: false }));
      }
    } catch {
      setRuntime(prev => ({ ...prev, loading: false }));
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const isActive = runtime.status === 'active';

  return (
    <RuntimeContext.Provider value={{ runtime, toggleRuntime }}>
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-md">
          <div className="px-10 h-14 flex items-center justify-between">
            <div className="flex items-center gap-10">
              <Link href="/home" className="text-xl font-display font-extrabold tracking-tight">海投 OS</Link>
              <nav className="hidden md:flex items-center gap-1">
                {NAV_ITEMS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'px-4 py-1.5 text-sm rounded-lg transition-colors',
                      pathname === item.href
                        ? 'text-foreground font-semibold bg-surface-low'
                        : 'text-muted-foreground hover:text-foreground hover:bg-surface-low'
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>

            <div className="flex items-center gap-4">
              <Link href="/billing" className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-surface-low text-xs text-muted-foreground hover:text-foreground transition-colors">
                <span className="uppercase tracking-wider font-label">Plan</span>
              </Link>

              <div className="flex items-center gap-2 text-sm">
                <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-status-active animate-pulse' : 'bg-muted-foreground/30'}`} />
                <span className="text-xs text-muted-foreground font-label">{isActive ? '运行中' : '已暂停'}</span>
              </div>

              <button
                onClick={toggleRuntime}
                disabled={runtime.loading}
                className={cn(
                  'px-5 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-50',
                  isActive ? 'bg-surface-low text-foreground hover:bg-border/40' : 'bg-foreground text-background hover:opacity-90'
                )}
              >
                {runtime.loading ? '处理中...' : isActive ? '暂停团队' : '启动团队'}
              </button>

              {/* User menu */}
              <div className="relative group">
                <button className="w-8 h-8 rounded-full bg-surface-low flex items-center justify-center text-xs font-bold hover:bg-border/40 transition-colors">
                  U
                </button>
                <div className="absolute right-0 top-10 w-40 surface-card shadow-lifted rounded-xl p-2 hidden group-hover:block z-50">
                  <Link href="/settings" className="block px-3 py-2 text-sm rounded-lg hover:bg-surface-low transition-colors">设置</Link>
                  <Link href="/billing" className="block px-3 py-2 text-sm rounded-lg hover:bg-surface-low transition-colors">套餐方案</Link>
                  <button onClick={handleSignOut} className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-surface-low transition-colors text-destructive">
                    退出登录
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="h-px bg-border/20" />
        </header>

        <main className="px-10 py-8 max-w-[1400px] mx-auto">{children}</main>
      </div>
    </RuntimeContext.Provider>
  );
}
