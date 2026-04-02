'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { AnimatedContent } from '@/components/ui/animated-content';

export default function CompletePage() {
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const supabase = createClient();

  const handleComplete = async () => {
    setCompleting(true);
    setError('');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/onboarding-complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const j = await res.json();
      setError(j.error?.message || '创建失败');
      setCompleting(false);
      return;
    }
    router.push('/activation');
  };

  const TEAM = [
    '调度官 · Commander', '履历分析师 · Analyst', '简历顾问 · Advisor', '岗位研究员 · Scout',
    '匹配审核员 · Reviewer', '投递专员 · Executor', '招聘关系经理 · Liaison',
  ];

  return (
    <AnimatedContent>
      <div className="space-y-6">
        <div>
          <p className="text-xs font-label uppercase tracking-widest text-muted-foreground mb-2">第 3 步 / 共 3 步</p>
          <h2 className="text-2xl font-display font-bold">确认并组建团队</h2>
          <p className="text-sm text-muted-foreground mt-1">你的 7 位 AI 专员即将就位</p>
        </div>

        <div className="surface-card p-6 space-y-2">
          {TEAM.map(name => (
            <div key={name} className="flex items-center gap-3 py-2">
              <div className="w-2 h-2 rounded-full bg-secondary" />
              <span className="text-sm">{name}</span>
            </div>
          ))}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <button
          onClick={handleComplete}
          disabled={completing}
          className="w-full py-3.5 bg-foreground text-background rounded-xl text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          {completing ? '正在创建团队...' : '创建我的团队'}
        </button>
      </div>
    </AnimatedContent>
  );
}
