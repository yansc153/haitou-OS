'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getValidSession } from '@/lib/hooks/use-api';
import { cn } from '@/lib/utils';
import { RuntimeContext, type RuntimeState } from '@/lib/hooks/use-runtime';
import { useTeamStatus } from '@/lib/hooks/use-realtime';
import { ToastProvider } from '@/components/ui/toast';

const NAV_ITEMS = [
  { href: '/home', label: '团队主页' },
  { href: '/opportunities', label: '机会中心' },
  { href: '/handoffs', label: '交接中心' },
  { href: '/platforms', label: '平台中心' },
  { href: '/review', label: '活动回顾' },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [runtime, setRuntime] = useState<RuntimeState>({ status: 'paused', loading: false });
  const [teamId, setTeamId] = useState<string | undefined>();

  useEffect(() => {
    async function loadRuntime() {
      const session = await getValidSession(supabase);
      if (!session) return;
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/home-get`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (json.data?.runtime) {
        setRuntime({ status: json.data.runtime.runtime_status, loading: false });
      }
      if (json.data?.team?.id) {
        setTeamId(json.data.team.id);
      }
    }
    loadRuntime();
  }, [supabase]);

  // Realtime: sync runtime status changes from DB
  const handleStatusChange = useCallback((newStatus: string) => {
    setRuntime(prev => ({ ...prev, status: newStatus }));
  }, []);
  useTeamStatus(teamId, handleStatusChange);

  const toggleRuntime = async () => {
    setRuntime(prev => ({ ...prev, loading: true }));
    const session = await getValidSession(supabase);
    if (!session) { setRuntime(prev => ({ ...prev, loading: false })); return; }

    const endpoint = runtime.status === 'active' ? 'team-pause' : 'team-start';
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${endpoint}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      });
      const json = await res.json();
      if (res.ok) {
        const newStatus = json.data?.runtime_status || (endpoint === 'team-pause' ? 'paused' : 'active');
        setRuntime({ status: newStatus, loading: false });
        // Re-confirm status after 2s to catch any sync issues
        setTimeout(async () => {
          try {
            const s2 = await getValidSession(supabase);
            if (!s2) return;
            const r2 = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/home-get`, {
              headers: { Authorization: `Bearer ${s2.access_token}` },
            });
            const j2 = await r2.json();
            if (j2.data?.runtime?.runtime_status) {
              setRuntime(prev => ({ ...prev, status: j2.data.runtime.runtime_status }));
            }
          } catch { /* ignore */ }
        }, 2000);
      } else {
        alert(`操作失败 [${res.status}]: ${json.error?.message || json.msg || JSON.stringify(json).slice(0, 200)}`);
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
    <ToastProvider>
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

              {/* User menu — click toggle */}
              <UserMenu onSignOut={handleSignOut} />
            </div>
          </div>
          <div className="h-px bg-border/20" />
        </header>

        <main className="px-4 sm:px-6 lg:px-10 py-8 max-w-[1400px] mx-auto">{children}</main>
      </div>
    </ToastProvider>
    </RuntimeContext.Provider>
  );
}

function UserMenu({ onSignOut }: { onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="w-8 h-8 rounded-full bg-surface-low flex items-center justify-center text-xs font-bold hover:bg-border/40 transition-colors"
      >
        U
      </button>
      {open && (
        <div className="absolute right-0 top-10 w-40 surface-card shadow-lifted rounded-xl p-2 z-50">
          <Link href="/settings" onClick={() => setOpen(false)} className="block px-3 py-2 text-sm rounded-lg hover:bg-surface-low transition-colors">设置</Link>
          <Link href="/billing" onClick={() => setOpen(false)} className="block px-3 py-2 text-sm rounded-lg hover:bg-surface-low transition-colors">套餐方案</Link>
          <Link href="/admin/dashboard" onClick={() => setOpen(false)} className="block px-3 py-2 text-sm rounded-lg hover:bg-surface-low transition-colors text-secondary">管理面板</Link>
          <button onClick={() => { setOpen(false); onSignOut(); }} className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-surface-low transition-colors text-destructive">
            退出登录
          </button>
        </div>
      )}
    </div>
  );
}
