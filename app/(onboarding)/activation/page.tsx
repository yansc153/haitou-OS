'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatedContent } from '@/components/ui/animated-content';
import { PIXEL_AVATARS } from '@/components/agents/pixel-avatars';
import { createClient } from '@/lib/supabase/client';
import { getValidSession } from '@/lib/hooks/use-api';

const AGENTS = [
  { role_code: 'orchestrator', title_zh: '调度官', persona: 'Commander', desc: '统筹全局调度，协调各专员行动' },
  { role_code: 'profile_intelligence', title_zh: '履历分析师', persona: 'Analyst', desc: '深度分析你的履历，提取关键竞争力' },
  { role_code: 'materials_advisor', title_zh: '简历顾问', persona: 'Advisor', desc: '为每个岗位定制简历和求职信' },
  { role_code: 'opportunity_research', title_zh: '岗位研究员', persona: 'Scout', desc: '全平台扫描，发现匹配机会' },
  { role_code: 'matching_review', title_zh: '匹配审核员', persona: 'Reviewer', desc: '多维度评估岗位匹配度' },
  { role_code: 'application_executor', title_zh: '投递专员', persona: 'Executor', desc: '自动填表投递，跟踪进度' },
  { role_code: 'relationship_manager', title_zh: '招聘关系经理', persona: 'Liaison', desc: 'HR 对话管理，面试信号检测' },
];

type DraftSummary = {
  target_locations?: string;
  strategy_mode?: string;
  work_mode?: string;
  resume_filename?: string;
};

const STRATEGY_LABELS: Record<string, string> = {
  broad: '广撒网：全渠道覆盖 & 智能匹配',
  balanced: '均衡：平衡匹配度和投递速度',
  precise: '精准：只投最合适的岗位',
};

const WORK_MODE_LABELS: Record<string, string> = {
  onsite: '现场办公',
  hybrid: '混合办公',
  remote: '完全远程',
};

export default function ActivationPage() {
  const router = useRouter();
  const [launching, setLaunching] = useState(false);
  const [status, setStatus] = useState('');
  const [activatedIndexes, setActivatedIndexes] = useState<number[]>([]);
  const [draft, setDraft] = useState<DraftSummary | null>(null);
  const [connectedPlatforms, setConnectedPlatforms] = useState<string[]>([]);

  // Fetch draft summary on mount
  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const session = await getValidSession(supabase);
        if (!session) return;
        const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/onboarding-draft`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const json = await res.json();
          const d = json.data || {};
          const answers = d.answered_fields || {};
          setDraft({
            target_locations: answers.target_locations,
            strategy_mode: answers.strategy_mode,
            work_mode: answers.work_mode,
            resume_filename: d.resume_asset_id ? '已上传' : undefined,
          });

          // Fetch connected platforms
          const pRes = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/platforms-list`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          if (pRes.ok) {
            const pJson = await pRes.json();
            const all = [...(pJson.data?.global_english || []), ...(pJson.data?.china || [])];
            const connected = all
              .filter((p: { connection_status: string }) => p.connection_status === 'active')
              .map((p: { display_name_zh: string; display_name: string }) => p.display_name_zh || p.display_name);
            setConnectedPlatforms(connected);
          }
        }
      } catch {
        // Non-blocking — summary is optional
      }
    })();
  }, []);

  // Wave activation animation during launch
  useEffect(() => {
    if (!launching) {
      setActivatedIndexes([]);
      return;
    }
    const timers: NodeJS.Timeout[] = [];
    AGENTS.forEach((_, i) => {
      timers.push(setTimeout(() => {
        setActivatedIndexes(prev => [...prev, i]);
      }, 300 + i * 250));
    });
    return () => timers.forEach(clearTimeout);
  }, [launching]);

  async function handleLaunch() {
    setLaunching(true);
    setStatus('正在解析简历...');
    const supabase = createClient();
    const session = await getValidSession(supabase);

    if (!session) {
      setStatus('启动失败: 请先登录');
      setLaunching(false);
      return;
    }

    setStatus('正在创建团队...');
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/onboarding-complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    });
    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      setStatus(`启动失败: ${json.error?.message || res.status}`);
      setLaunching(false);
      return;
    }

    setStatus('团队已就绪！正在跳转...');
    await new Promise(r => setTimeout(r, 1500));
    router.push('/home');
  }

  return (
    <div>
      {/* Section 1: Agent cards */}
      <AnimatedContent>
        <div className="text-center mb-10">
          <h1 className="text-5xl lg:text-[56px] font-display font-extrabold leading-tight tracking-tight">
            你的 AI 求职运营团队
          </h1>
          <p className="text-lg text-muted-foreground mt-3">
            7 位专员即将开始为你工作
          </p>
        </div>
      </AnimatedContent>

      <AnimatedContent delay={0.05}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 max-w-[900px] mx-auto">
          {AGENTS.slice(0, 4).map((agent, i) => {
            const Avatar = PIXEL_AVATARS[agent.role_code];
            const isActivating = activatedIndexes.includes(i);
            return (
              <div key={agent.role_code} className="bg-card rounded-2xl p-6 text-center shadow-sm">
                {Avatar && <div className="flex justify-center"><Avatar size={64} /></div>}
                <div className="mt-3 font-bold">{agent.title_zh}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">{agent.persona}</div>
                <p className="text-xs text-muted-foreground mt-2">{agent.desc}</p>
                <div className="flex items-center justify-center gap-1.5 mt-3 text-xs">
                  {launching && isActivating ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                      <span className="text-muted-foreground">正在启动...</span>
                    </>
                  ) : launching && !isActivating ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                      <span className="text-muted-foreground">等待中</span>
                    </>
                  ) : (
                    <>
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="text-muted-foreground">就绪</span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </AnimatedContent>

      <AnimatedContent delay={0.1}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-5 max-w-[680px] mx-auto mt-5">
          {AGENTS.slice(4).map((agent, i) => {
            const Avatar = PIXEL_AVATARS[agent.role_code];
            const globalIdx = i + 4;
            const isActivating = activatedIndexes.includes(globalIdx);
            return (
              <div key={agent.role_code} className="bg-card rounded-2xl p-6 text-center shadow-sm">
                {Avatar && <div className="flex justify-center"><Avatar size={64} /></div>}
                <div className="mt-3 font-bold">{agent.title_zh}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">{agent.persona}</div>
                <p className="text-xs text-muted-foreground mt-2">{agent.desc}</p>
                <div className="flex items-center justify-center gap-1.5 mt-3 text-xs">
                  {launching && isActivating ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                      <span className="text-muted-foreground">正在启动...</span>
                    </>
                  ) : launching && !isActivating ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                      <span className="text-muted-foreground">等待中</span>
                    </>
                  ) : (
                    <>
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="text-muted-foreground">就绪</span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </AnimatedContent>

      {/* Section 2: Config summary */}
      <AnimatedContent delay={0.15}>
        <div className="bg-surface-low rounded-2xl p-8 max-w-[900px] mx-auto mt-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-display font-bold">团队配置摘要</h2>
            <span className="text-xs font-label uppercase tracking-wider text-muted-foreground">Ready to Deploy</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">目标城市</div>
              <div className="text-sm font-semibold">
                {draft?.target_locations?.split(',').map((c: string) => c.trim()).join('、') || '---'}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">执行策略</div>
              <div className="text-sm font-semibold">
                {draft?.strategy_mode ? (STRATEGY_LABELS[draft.strategy_mode] || draft.strategy_mode) : '---'}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">已连接平台</div>
              <div className="text-sm font-semibold">
                {connectedPlatforms.length > 0 ? connectedPlatforms.map(p => `${p} ✓`).join('、') : '---'}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">简历</div>
              <div className="text-sm font-semibold">
                {draft?.resume_filename || '---'}
              </div>
            </div>
          </div>
        </div>
      </AnimatedContent>

      {/* Section 3: Launch button */}
      <AnimatedContent delay={0.2}>
        <div className="text-center mt-12 mb-8">
          {status && (
            <p className={`text-sm mb-4 ${status.startsWith('启动失败') ? 'text-destructive' : 'text-muted-foreground'}`}>
              {status}
            </p>
          )}
          <button
            onClick={handleLaunch}
            disabled={launching}
            className="bg-foreground text-background rounded-xl py-4 px-12 text-lg font-bold hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {launching ? '正在启动...' : '启动团队 →'}
          </button>
          <p className="text-sm text-muted-foreground mt-3">
            团队将立即开始搜索和投递
          </p>
        </div>
      </AnimatedContent>
    </div>
  );
}
