'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatedContent } from '@/components/ui/animated-content';
import { PIXEL_AVATARS } from '@/components/agents/pixel-avatars';

/**
 * Single-page onboarding — matches Stitch "Configure Your Digital Atelier" design
 * Combines: resume upload + location/work mode + strategy selection
 */

const CITIES = ['上海', '北京', '深圳', '杭州', '广州', 'Remote'];
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
  const router = useRouter();

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setUploadState('done');
  }, []);

  const handleSubmit = async () => {
    setSubmitting(true);
    // In production: upload file + save preferences via API
    // Demo mode: just navigate
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session && file) {
        const formData = new FormData();
        formData.append('file', file);
        await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/onboarding-resume`, {
          method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` }, body: formData,
        });
        await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/onboarding-draft`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers: { target_locations: cities.join(','), work_mode: workMode, strategy_mode: strategy } }),
        });
        await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/onboarding-complete`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        });
      }
    } catch { /* demo mode */ }
    setSubmitting(false);
    router.push('/activation');
  };

  const ScoutAvatar = PIXEL_AVATARS['opportunity_research'];

  return (
    <div className="space-y-10">
      {/* Page header */}
      <AnimatedContent>
        <div>
          <p className="text-xs font-label uppercase tracking-[0.2em] text-muted-foreground mb-3">配置流程</p>
          <h2 className="text-4xl font-display font-extrabold leading-tight">配置你的求职运营团队</h2>
          <p className="text-base text-muted-foreground mt-2">上传简历，设定目标，选择策略。团队将据此开始工作。</p>
        </div>
      </AnimatedContent>

      {/* Two-column: Left = resume + preferences, Right = agent preview */}
      <div className="grid lg:grid-cols-[1fr_280px] gap-8">
        {/* Left column */}
        <div className="space-y-8">
          {/* Resume upload */}
          <AnimatedContent delay={0.1}>
            <div>
              <h3 className="text-lg font-display font-bold mb-1">简历上传</h3>
              <p className="text-sm text-muted-foreground mb-4">拖拽或点击上传你的 PDF 或 DOCX 简历</p>
              <div
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                onDragOver={(e) => e.preventDefault()}
                className="surface-card p-8 text-center rounded-2xl hover:shadow-lifted transition-shadow cursor-pointer"
              >
                {uploadState === 'idle' ? (
                  <label className="cursor-pointer">
                    <div className="text-3xl mb-3">📄</div>
                    <p className="text-base font-semibold mb-1">拖拽简历到这里</p>
                    <p className="text-sm text-muted-foreground">或点击浏览文件</p>
                    <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                  </label>
                ) : (
                  <div>
                    <div className="w-12 h-12 rounded-full bg-status-active/10 flex items-center justify-center mx-auto mb-3">
                      <span className="text-xl text-status-active">✓</span>
                    </div>
                    <p className="text-base font-semibold text-status-active">{file?.name}</p>
                    <p className="text-sm text-muted-foreground mt-1">简历已就绪</p>
                  </div>
                )}
              </div>
            </div>
          </AnimatedContent>

          {/* Location + Work Mode */}
          <AnimatedContent delay={0.2}>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-display font-bold mb-1">目标城市</h3>
                <p className="text-sm text-muted-foreground mb-3">选择你的求职目标城市</p>
                <div className="flex flex-wrap gap-2">
                  {CITIES.map(c => (
                    <button
                      key={c}
                      onClick={() => setCities(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])}
                      className={`px-4 py-2 text-sm rounded-xl transition-all ${
                        cities.includes(c) ? 'bg-foreground text-background font-semibold' : 'bg-surface-low hover:bg-border/40'
                      }`}
                    >{c}</button>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-lg font-display font-bold mb-1">工作模式</h3>
                <p className="text-sm text-muted-foreground mb-3">选择你接受的工作方式</p>
                <div className="space-y-2">
                  {WORK_MODES.map(m => (
                    <button
                      key={m.value}
                      onClick={() => setWorkMode(m.value)}
                      className={`w-full px-4 py-3 text-sm text-left rounded-xl transition-all ${
                        workMode === m.value ? 'bg-foreground text-background font-semibold' : 'bg-surface-low hover:bg-border/40'
                      }`}
                    >{m.label}</button>
                  ))}
                </div>
              </div>
            </div>
          </AnimatedContent>

          {/* Strategy */}
          <AnimatedContent delay={0.3}>
            <div>
              <h3 className="text-lg font-display font-bold mb-1">执行策略</h3>
              <p className="text-sm text-muted-foreground mb-4">选择团队的运营节奏</p>
              <div className="grid grid-cols-3 gap-4">
                {STRATEGIES.map(s => (
                  <button
                    key={s.value}
                    onClick={() => setStrategy(s.value)}
                    className={`surface-card p-5 text-left rounded-2xl transition-all ${
                      strategy === s.value ? 'ring-2 ring-foreground shadow-lifted' : 'hover:shadow-card'
                    }`}
                  >
                    <div className="text-2xl mb-3">{s.icon}</div>
                    <div className="text-base font-bold mb-1">{s.label}</div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </AnimatedContent>
        </div>

        {/* Right column — Agent preview (matches Stitch right sidebar) */}
        <AnimatedContent delay={0.2} direction="right">
          <div className="surface-card p-6 rounded-2xl sticky top-24 h-fit">
            <div className="flex items-center gap-3 mb-4">
              {ScoutAvatar && <ScoutAvatar size={48} />}
              <div>
                <div className="text-sm font-bold">岗位研究员</div>
                <div className="text-xs text-muted-foreground">正在分析你的资料...</div>
              </div>
            </div>
            <div className="h-px bg-border/20 my-4" />
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">简历状态</span>
                <span className={uploadState === 'done' ? 'text-status-active font-semibold' : 'text-muted-foreground/40'}>
                  {uploadState === 'done' ? '已上传' : '等待上传'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">目标城市</span>
                <span className={cities.length > 0 ? 'font-semibold' : 'text-muted-foreground/40'}>
                  {cities.length > 0 ? `${cities.length} 个城市` : '未选择'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">执行策略</span>
                <span className="font-semibold">{STRATEGIES.find(s => s.value === strategy)?.label}</span>
              </div>
            </div>
            <div className="h-px bg-border/20 my-4" />
            <button
              onClick={handleSubmit}
              disabled={uploadState !== 'done' || submitting}
              className="w-full py-3 bg-foreground text-background rounded-xl text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-30"
            >
              {submitting ? '正在配置...' : '完成配置 →'}
            </button>
          </div>
        </AnimatedContent>
      </div>
    </div>
  );
}
