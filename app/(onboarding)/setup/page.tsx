'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatedContent } from '@/components/ui/animated-content';
import { createClient } from '@/lib/supabase/client';
import { getValidSession } from '@/lib/hooks/use-api';
import { PIXEL_AVATARS } from '@/components/agents/pixel-avatars';

const NOTICE_OPTIONS = ['随时到岗', '2周内', '1个月', '2-3个月'];
const VISA_OPTIONS = ['无需签证', '有工签', '需要担保'];

export default function SetupPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const ScoutAvatar = PIXEL_AVATARS['opportunity_research'];

  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [currentCity, setCurrentCity] = useState('');
  const [currentCountry, setCurrentCountry] = useState('');
  const [salaryExpectation, setSalaryExpectation] = useState('');
  const [noticePeriod, setNoticePeriod] = useState('');
  const [visaStatus, setVisaStatus] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Pre-fill email from session on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) setContactEmail(session.user.email);
    });
  }, [supabase]);

  const filledCount = [contactPhone, contactEmail, currentCity, currentCountry, salaryExpectation, noticePeriod, visaStatus].filter(Boolean).length;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const session = await getValidSession(supabase);
      if (!session) { setError('请先登录'); setSubmitting(false); return; }

      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/onboarding-draft`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: {
            contact_phone: contactPhone,
            contact_email: contactEmail,
            current_city: currentCity,
            current_country: currentCountry,
            salary_expectation: salaryExpectation,
            notice_period: noticePeriod,
            visa_status: visaStatus,
            current_step: 2,
          },
        }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(`保存失败: ${j.error?.message || res.status}`);
        setSubmitting(false);
        return;
      }

      // Create team in draft mode so platform connections work in Step 3
      await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/onboarding-complete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'create_team' }),
      });

      router.push('/extension');
    } catch (e) {
      setError(`请求失败: ${e instanceof Error ? e.message : '未知错误'}`);
      setSubmitting(false);
    }
  };

  return (
    <div>
      <AnimatedContent>
        <div className="mb-10">
          <p className="text-xs font-label uppercase tracking-[0.2em] text-secondary font-semibold mb-3">STEP 02 / 04</p>
          <h1 className="text-5xl lg:text-[56px] font-display font-extrabold leading-tight tracking-tight">完善投递资料</h1>
          <p className="text-lg text-muted-foreground mt-3 max-w-2xl">这些信息将用于自动填写求职表单，AI 不会修改你的原始简历。</p>
        </div>
      </AnimatedContent>

      <div className="grid lg:grid-cols-[1fr_340px] gap-10">
        {/* Left — Form */}
        <AnimatedContent delay={0.05}>
          <div className="space-y-8">
            {/* Phone + Email row */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-semibold mb-2 block">手机号 <span className="text-muted-foreground font-normal uppercase text-xs ml-1">PHONE</span></label>
                <input
                  type="text"
                  value={contactPhone}
                  onChange={e => setContactPhone(e.target.value)}
                  placeholder="+86 138 0000 0000"
                  className="w-full bg-muted rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>
              <div>
                <label className="text-sm font-semibold mb-2 block">联系邮箱 <span className="text-muted-foreground font-normal uppercase text-xs ml-1">EMAIL</span></label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={e => setContactEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-muted rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>
            </div>

            {/* City + Country row */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-semibold mb-2 block">当前城市 <span className="text-muted-foreground font-normal uppercase text-xs ml-1">CURRENT CITY</span></label>
                <input
                  type="text"
                  value={currentCity}
                  onChange={e => setCurrentCity(e.target.value)}
                  placeholder="上海"
                  className="w-full bg-muted rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>
              <div>
                <label className="text-sm font-semibold mb-2 block">当前国家 <span className="text-muted-foreground font-normal uppercase text-xs ml-1">COUNTRY</span></label>
                <input
                  type="text"
                  value={currentCountry}
                  onChange={e => setCurrentCountry(e.target.value)}
                  placeholder="中国"
                  className="w-full bg-muted rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>
            </div>

            {/* Salary + Notice row */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-semibold mb-2 block">期望薪资 <span className="text-muted-foreground font-normal uppercase text-xs ml-1">EXPECTED SALARY</span></label>
                <input
                  type="text"
                  value={salaryExpectation}
                  onChange={e => setSalaryExpectation(e.target.value)}
                  placeholder="选填 — 例如：30-50k/月"
                  className="w-full bg-muted rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>
              <div>
                <label className="text-sm font-semibold mb-2 block">入职通知期 <span className="text-muted-foreground font-normal uppercase text-xs ml-1">NOTICE PERIOD</span></label>
                <div className="flex flex-wrap gap-2">
                  {NOTICE_OPTIONS.map(opt => (
                    <button
                      key={opt}
                      onClick={() => setNoticePeriod(noticePeriod === opt ? '' : opt)}
                      className={`px-4 py-2.5 text-sm rounded-xl transition-all ${
                        noticePeriod === opt
                          ? 'bg-foreground text-background font-semibold shadow-card'
                          : 'bg-muted hover:bg-border/40'
                      }`}
                    >{opt}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Visa */}
            <div>
              <label className="text-sm font-semibold mb-2 block">签证/工作许可 <span className="text-muted-foreground font-normal uppercase text-xs ml-1">VISA/WORK PERMIT</span></label>
              <div className="flex flex-wrap gap-2">
                {VISA_OPTIONS.map(opt => (
                  <button
                    key={opt}
                    onClick={() => setVisaStatus(visaStatus === opt ? '' : opt)}
                    className={`px-5 py-2.5 text-sm rounded-xl transition-all ${
                      visaStatus === opt
                        ? 'bg-foreground text-background font-semibold shadow-card'
                        : 'bg-muted hover:bg-border/40'
                    }`}
                  >{opt}</button>
                ))}
              </div>
            </div>
          </div>
        </AnimatedContent>

        {/* Right — Sidebar */}
        <AnimatedContent delay={0.1} direction="right">
          <div className="sticky top-20 space-y-5">
            <div className="surface-card p-6 rounded-2xl">
              <div className="flex items-center gap-3 mb-5">
                {ScoutAvatar && <ScoutAvatar size={48} />}
                <div>
                  <div className="text-base font-bold">Scout | 寻访官</div>
                  <div className="text-sm text-muted-foreground">Assistant Status: Active</div>
                </div>
              </div>
              <div className="h-px bg-border/20 mb-5" />

              {/* Progress */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-muted-foreground">填写进度</span>
                <span className="text-sm font-bold">{filledCount}/7 项</span>
              </div>
              <div className="flex gap-1 mb-5">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-2 flex-1 rounded-full transition-all ${
                      i < filledCount ? 'bg-foreground' : 'bg-muted'
                    }`}
                  />
                ))}
              </div>

              <div className="h-px bg-border/20 mb-5" />

              {/* Hint */}
              <div className="text-sm text-muted-foreground leading-relaxed mb-5">
                <span className="inline-block w-2 h-2 rounded-full bg-status-active mr-2 align-middle" />
                寻访官提示：完整填写基本信息有助于 AI 为你筛选出匹配度更高的职位等级。建议参考当前市场的中位数水平。
              </div>

              {error && <p className="text-sm text-destructive bg-destructive/10 px-4 py-3 rounded-xl mb-4">{error}</p>}

              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full bg-foreground text-background rounded-xl py-3 px-8 font-bold hover:opacity-90 transition-opacity disabled:opacity-30"
              >
                {submitting ? '保存中...' : '下一步 →'}
              </button>
            </div>
          </div>
        </AnimatedContent>
      </div>
    </div>
  );
}
