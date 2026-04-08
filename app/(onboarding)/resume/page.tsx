'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatedContent } from '@/components/ui/animated-content';
import { SpotlightCard } from '@/components/ui/spotlight-card';
import { PIXEL_AVATARS } from '@/components/agents/pixel-avatars';

const CITIES = ['上海', '北京', '深圳', '杭州', '广州', '新加坡', 'Remote'];
const WORK_MODES = [
  { value: 'onsite', label: '现场办公' },
  { value: 'hybrid', label: '混合办公' },
  { value: 'remote', label: '完全远程' },
];
const STRATEGIES = [
  { value: 'broad', label: '广撒网', icon: '⚡', desc: '高速度高覆盖，优先触达和曝光量' },
  { value: 'balanced', label: '均衡', icon: '⚖️', desc: '平衡匹配度和投递速度' },
  { value: 'precise', label: '精准', icon: '🎯', desc: '精准匹配，只投最合适的岗位' },
];

export default function OnboardingPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<'idle' | 'done'>('idle');
  const [cities, setCities] = useState<string[]>([]);
  const [workMode, setWorkMode] = useState('hybrid');
  const [strategy, setStrategy] = useState('balanced');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setUploadState('done');
  }, []);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const { getValidSession } = await import('@/lib/hooks/use-api');
      const supabase = createClient();
      const session = await getValidSession(supabase);
      if (!session || !file) { setError('请先登录并上传简历'); setSubmitting(false); return; }

      // Upload resume (save only, no parsing)
      const formData = new FormData();
      formData.append('file', file);
      const r1 = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/onboarding-resume`, {
        method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` }, body: formData,
      });
      const j1 = await r1.json().catch(() => ({}));
      if (!r1.ok) {
        setError(`简历上传失败: ${j1.error?.message || r1.status}`); setSubmitting(false); return;
      }

      // Save preferences to draft
      const r2 = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/onboarding-draft`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: { target_locations: cities.join(','), work_mode: workMode, strategy_mode: strategy, coverage_scope: 'cross_market', current_step: 1 } }),
      });
      if (!r2.ok) {
        const j = await r2.json().catch(() => ({}));
        setError(`保存失败: ${j.error?.message || r2.status}`); setSubmitting(false); return;
      }

      router.push('/setup');
    } catch (e) {
      setError(`请求失败: ${e instanceof Error ? e.message : '未知错误'}`);
      setSubmitting(false);
    }
  };

  const ScoutAvatar = PIXEL_AVATARS['opportunity_research'];

  return (
    <div>
      {/* Page header — large, matching Stitch */}
      <AnimatedContent>
        <div className="mb-10">
          <p className="text-xs font-label uppercase tracking-[0.2em] text-secondary font-semibold mb-3">配置流程</p>
          <h1 className="text-5xl lg:text-[56px] font-display font-extrabold leading-tight tracking-tight">配置你的求职运营团队</h1>
          <p className="text-lg text-muted-foreground mt-3 max-w-2xl">上传简历，设定目标，选择策略。团队将据此开始工作。</p>
        </div>
      </AnimatedContent>

      {/* Two-column: Left = forms, Right = agent sidebar */}
      <div className="grid lg:grid-cols-[1fr_340px] gap-10">
        {/* Left column — full content */}
        <div className="space-y-10">

          {/* Section 1: Resume + Professional Identity */}
          <AnimatedContent delay={0.05}>
            <div>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-2xl font-display font-bold">简历上传</h2>
                  <p className="text-sm text-muted-foreground mt-1">拖拽或点击上传你的 PDF 或 DOCX 简历</p>
                </div>
                <span className="text-2xl">📄</span>
              </div>
              <div
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                onDragOver={(e) => e.preventDefault()}
                className="surface-card p-12 text-center rounded-2xl hover:shadow-lifted transition-all cursor-pointer min-h-[180px] flex flex-col items-center justify-center"
              >
                {uploadState === 'idle' ? (
                  <label className="cursor-pointer">
                    <div className="w-16 h-16 rounded-2xl bg-surface-low flex items-center justify-center text-2xl mb-4 mx-auto">📎</div>
                    <p className="text-lg font-semibold mb-1">拖拽简历到这里</p>
                    <p className="text-sm text-muted-foreground">或点击浏览文件 · PDF, DOC, DOCX</p>
                    <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                  </label>
                ) : (
                  <label className="cursor-pointer">
                    <div className="w-14 h-14 rounded-full bg-status-active/10 flex items-center justify-center mx-auto mb-3">
                      <span className="text-2xl text-status-active">✓</span>
                    </div>
                    <p className="text-lg font-bold text-status-active">{file?.name}</p>
                    <p className="text-sm text-muted-foreground mt-1">简历已就绪 · 点击更换</p>
                    <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                  </label>
                )}
              </div>
            </div>
          </AnimatedContent>

          {/* Section 2: Location + Work Mode — side by side */}
          <AnimatedContent delay={0.1}>
            <div className="grid grid-cols-2 gap-8">
              <div>
                <h2 className="text-2xl font-display font-bold mb-2">目标城市</h2>
                <p className="text-sm text-muted-foreground mb-5">选择你的求职目标地区</p>
                <div className="flex flex-wrap gap-2.5">
                  {CITIES.map(c => (
                    <button
                      key={c}
                      onClick={() => setCities(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])}
                      className={`px-5 py-2.5 text-sm rounded-xl transition-all ${
                        cities.includes(c) ? 'bg-foreground text-background font-semibold shadow-card' : 'bg-surface-low hover:bg-border/40'
                      }`}
                    >{c}</button>
                  ))}
                </div>
              </div>
              <div>
                <h2 className="text-2xl font-display font-bold mb-2">工作模式</h2>
                <p className="text-sm text-muted-foreground mb-5">选择你接受的工作方式</p>
                <div className="space-y-2.5">
                  {WORK_MODES.map(m => (
                    <button
                      key={m.value}
                      onClick={() => setWorkMode(m.value)}
                      className={`w-full px-5 py-3.5 text-base text-left rounded-xl transition-all ${
                        workMode === m.value ? 'bg-foreground text-background font-semibold shadow-card' : 'bg-surface-low hover:bg-border/40'
                      }`}
                    >{m.label}</button>
                  ))}
                </div>
              </div>
            </div>
          </AnimatedContent>

          {/* Section 4: Strategy — full-width cards */}
          <AnimatedContent delay={0.15}>
            <div className="surface-low rounded-2xl p-8">
              <h2 className="text-2xl font-display font-bold mb-2">执行策略</h2>
              <p className="text-sm text-muted-foreground mb-6">选择团队的运营节奏和覆盖方式</p>
              <div className="grid grid-cols-3 gap-5">
                {STRATEGIES.map(s => (
                  <SpotlightCard
                    key={s.value}
                    onClick={() => setStrategy(s.value)}
                    className={`bg-background rounded-2xl p-6 text-left cursor-pointer transition-all ${
                      strategy === s.value ? 'ring-2 ring-foreground shadow-lifted -translate-y-0.5' : 'ghost-border hover:shadow-card hover:-translate-y-0.5'
                    }`}
                  >
                    <div className="text-3xl mb-4">{s.icon}</div>
                    <div className="text-lg font-display font-bold mb-2">{s.label}</div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                  </SpotlightCard>
                ))}
              </div>
            </div>
          </AnimatedContent>
        </div>

        {/* Right sidebar — Agent preview + progress */}
        <AnimatedContent delay={0.1} direction="right">
          <div className="sticky top-20 space-y-5">
            {/* Agent card */}
            <div className="surface-card p-6 rounded-2xl">
              <div className="flex items-center gap-3 mb-5">
                {ScoutAvatar && <ScoutAvatar size={48} />}
                <div>
                  <div className="text-base font-bold">岗位研究员</div>
                  <div className="text-sm text-muted-foreground">正在分析你的资料...</div>
                </div>
              </div>
              <div className="h-px bg-border/20 mb-5" />

              {/* Progress stats */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">简历状态</span>
                  <span className={`text-sm ${uploadState === 'done' ? 'text-status-active font-bold' : 'text-muted-foreground/40'}`}>
                    {uploadState === 'done' ? '✓ 已上传' : '等待上传'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">目标城市</span>
                  <span className={`text-sm ${cities.length > 0 ? 'font-bold' : 'text-muted-foreground/40'}`}>
                    {cities.length > 0 ? `${cities.length} 个城市` : '未选择'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">执行策略</span>
                  <span className="text-sm font-bold">{STRATEGIES.find(s => s.value === strategy)?.label}</span>
                </div>
              </div>

              <div className="h-px bg-border/20 my-5" />

              {/* Error */}
              {error && <p className="text-sm text-destructive bg-destructive/10 px-4 py-3 rounded-xl">{error}</p>}

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={uploadState !== 'done' || submitting}
                className="w-full py-3.5 bg-foreground text-background rounded-xl text-base font-bold hover:opacity-90 transition-opacity disabled:opacity-30"
              >
                {submitting ? '正在保存...' : '下一步 →'}
              </button>
            </div>

            {/* Quote */}
            <div className="surface-card p-5 rounded-2xl">
              <p className="text-sm text-muted-foreground leading-relaxed italic">
                "在海投助手，我们不只是帮你投简历。我们用 7 位 AI 专员构建一个完整的求职运营体系。"
              </p>
              <p className="text-[10px] font-label uppercase tracking-widest text-muted-foreground/50 mt-3">— 运营总监</p>
            </div>
          </div>
        </AnimatedContent>
      </div>
    </div>
  );
}
