'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLogin() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/admin-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push('/admin/dashboard');
    } else {
      setError('密码错误');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="surface-card p-8 rounded-2xl" style={{ boxShadow: 'var(--shadow-lifted)' }}>
          <div className="mb-6">
            <h1 className="text-2xl font-display font-extrabold tracking-tight text-foreground">管理面板</h1>
            <p className="text-sm text-muted-foreground mt-1">请输入管理密码以继续</p>
          </div>

          <form onSubmit={handleSubmit}>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="管理密码"
              autoFocus
              className="w-full px-4 py-3 rounded-xl bg-surface-low border border-border/30 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-secondary/30 transition-all"
            />
            {error && <p className="text-xs text-destructive mt-2 font-semibold">{error}</p>}
            <button
              type="submit"
              disabled={loading || !password}
              className="w-full mt-4 px-4 py-3 rounded-xl bg-foreground text-background text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {loading ? '验证中...' : '进入管理面板'}
            </button>
          </form>
        </div>
        <p className="text-center text-xs text-muted-foreground/40 mt-4">海投 OS · 管理员入口</p>
      </div>
    </div>
  );
}
