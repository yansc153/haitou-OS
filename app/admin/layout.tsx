'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-md">
        <div className="px-10 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/admin/dashboard" className="text-xl font-display font-extrabold tracking-tight">
              海投 OS <span className="text-xs font-label uppercase tracking-widest text-secondary ml-2">Admin</span>
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/home"
              className="px-4 py-1.5 text-xs rounded-lg bg-surface-low text-muted-foreground hover:text-foreground transition-colors"
            >
              返回用户端
            </Link>
            <button
              onClick={handleSignOut}
              className="px-4 py-1.5 text-xs rounded-lg text-muted-foreground hover:text-destructive transition-colors"
            >
              退出
            </button>
          </div>
        </div>
        <div className="h-px bg-border/20" />
      </header>

      <main className="px-10 py-8 max-w-[1400px] mx-auto">{children}</main>
    </div>
  );
}
