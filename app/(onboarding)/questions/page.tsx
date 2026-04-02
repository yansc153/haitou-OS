'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { AnimatedContent } from '@/components/ui/animated-content';

type Question = { id: string; label_zh: string; type: string; required: boolean; options?: string[]; placeholder?: string };

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/onboarding-get`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (json.data) { setQuestions(json.data.questions); setAnswers(json.data.draft.answered_fields || {}); }
    }
    load();
  }, [supabase]);

  const handleSave = async () => {
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/onboarding-draft`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers }),
    });
    setSaving(false);
    router.push('/complete');
  };

  const allRequired = questions.length > 0 && questions.filter(q => q.required).every(q => answers[q.id] != null && answers[q.id] !== '');

  return (
    <AnimatedContent>
      <div className="space-y-6">
        <div>
          <p className="text-xs font-label uppercase tracking-widest text-muted-foreground mb-2">第 2 步 / 共 3 步</p>
          <h2 className="text-2xl font-display font-bold">告诉团队你的求职方向</h2>
          <p className="text-sm text-muted-foreground mt-1">这些偏好帮助团队校准搜索和匹配</p>
        </div>

        <div className="space-y-5">
          {questions.map(q => (
            <div key={q.id}>
              <label className="text-sm font-semibold mb-2 block">
                {q.label_zh} {q.required && <span className="text-destructive">*</span>}
              </label>
              {q.type === 'single_select' && q.options && (
                <div className="flex flex-wrap gap-2">
                  {q.options.map(opt => (
                    <button
                      key={opt}
                      onClick={() => setAnswers(p => ({ ...p, [q.id]: opt }))}
                      className={`px-4 py-2 text-sm rounded-xl transition-colors ${
                        answers[q.id] === opt ? 'bg-foreground text-background' : 'bg-surface-low hover:bg-border/40'
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
                  className="w-full px-4 py-3 text-sm bg-surface-low rounded-xl border-0 focus:outline-none focus:ring-2 focus:ring-ring"
                />
              )}
            </div>
          ))}
        </div>

        <button
          onClick={handleSave}
          disabled={!allRequired || saving}
          className="w-full py-3.5 bg-foreground text-background rounded-xl text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          {saving ? '保存中...' : '继续'}
        </button>
      </div>
    </AnimatedContent>
  );
}
