'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatedContent } from '@/components/ui/animated-content';

type Question = { id: string; label_zh: string; type: string; required: boolean; options?: string[]; placeholder?: string };

const FALLBACK_QUESTIONS: Question[] = [
  { id: 'target_roles', label_zh: '目标岗位', type: 'multi_text', required: true, placeholder: '例如：后端工程师, 产品经理' },
  { id: 'target_locations', label_zh: '目标城市', type: 'multi_text', required: true, placeholder: '例如：上海, Remote, 旧金山' },
  { id: 'work_mode', label_zh: '工作模式', type: 'single_select', required: true, options: ['远程', '现场', '混合', '灵活'] },
  { id: 'coverage_scope', label_zh: '覆盖范围', type: 'single_select', required: true, options: ['中文区', '英文区', '跨市场'] },
  { id: 'strategy_mode', label_zh: '策略模式', type: 'single_select', required: true, options: ['均衡', '广撒网', '精准'] },
  { id: 'salary_expectation', label_zh: '期望薪资', type: 'text', required: false, placeholder: '选填 — 例如：30-50k/月' },
];

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>(FALLBACK_QUESTIONS);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function load() {
      try {
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/onboarding-get`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const json = await res.json();
          if (json.data?.questions) setQuestions(json.data.questions);
          if (json.data?.draft?.answered_fields) setAnswers(json.data.draft.answered_fields);
        }
      } catch { /* Use fallback questions */ }
    }
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/onboarding-draft`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers }),
        });
      }
    } catch { /* Demo mode */ }
    setSaving(false);
    router.push('/complete');
  };

  const allRequired = questions.length > 0 && questions.filter(q => q.required).every(q => answers[q.id] != null && answers[q.id] !== '');

  return (
    <AnimatedContent>
      <div className="space-y-6">
        <div>
          <p className="text-xs font-label uppercase tracking-widest text-muted-foreground mb-2">第 2 步 / 共 3 步</p>
          <h2 className="text-3xl font-display font-extrabold">告诉团队你的求职方向</h2>
          <p className="text-sm text-muted-foreground mt-2">这些偏好帮助团队校准搜索和匹配</p>
        </div>

        <div className="space-y-5">
          {questions.map((q, qi) => (
            <AnimatedContent key={q.id} delay={qi * 0.05}>
              <div>
                <label className="text-sm font-semibold mb-2 block">
                  {q.label_zh} {q.required && <span className="text-destructive">*</span>}
                </label>
                {q.type === 'single_select' && q.options && (
                  <div className="flex flex-wrap gap-2">
                    {q.options.map(opt => (
                      <button
                        key={opt}
                        onClick={() => setAnswers(p => ({ ...p, [q.id]: opt }))}
                        className={`px-5 py-2.5 text-sm rounded-xl transition-all ${
                          answers[q.id] === opt ? 'bg-foreground text-background font-semibold' : 'bg-surface-low hover:bg-border/40'
                        }`}
                      >{opt}</button>
                    ))}
                  </div>
                )}
                {(q.type === 'text' || q.type === 'multi_text') && (
                  <input
                    type="text"
                    placeholder={q.placeholder}
                    value={(answers[q.id] as string) || ''}
                    onChange={(e) => setAnswers(p => ({ ...p, [q.id]: e.target.value }))}
                    className="w-full px-4 py-3 text-sm bg-surface-low rounded-xl border-0 focus:outline-none focus:ring-2 focus:ring-secondary"
                  />
                )}
              </div>
            </AnimatedContent>
          ))}
        </div>

        <button
          onClick={handleSave}
          disabled={!allRequired || saving}
          className="w-full py-3.5 bg-foreground text-background rounded-xl text-base font-bold hover:opacity-90 transition-opacity disabled:opacity-30"
        >
          {saving ? '保存中...' : '继续'}
        </button>
      </div>
    </AnimatedContent>
  );
}
