'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getValidSession } from '@/lib/hooks/use-api';

const WORK_MODES = [
  { value: 'remote', label: '远程' },
  { value: 'onsite', label: '现场' },
  { value: 'hybrid', label: '混合' },
  { value: 'flexible', label: '灵活' },
];
const SCOPES = [
  { value: 'china', label: '中文区' },
  { value: 'global_english', label: '英文区' },
  { value: 'cross_market', label: '跨市场' },
];
const STRATEGIES = [
  { value: 'balanced', label: '均衡' },
  { value: 'broad', label: '广撒网' },
  { value: 'precise', label: '精准' },
];

const API = process.env.NEXT_PUBLIC_SUPABASE_URL!;

async function apiFetch(path: string, token: string, opts?: RequestInit) {
  return fetch(`${API}/functions/v1/${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...opts?.headers },
  });
}

export default function SettingsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // User info
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');

  // Preferences (read-only display from team — saving requires new function)
  const [workMode, setWorkMode] = useState('flexible');
  const [scope, setScope] = useState('global_english');
  const [strategy, setStrategy] = useState('balanced');

  // Submission profile (read + write via existing submission-profile API)
  const [phone, setPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [currentCity, setCurrentCity] = useState('');
  const [currentCountry, setCurrentCountry] = useState('');
  const [noticePeriod, setNoticePeriod] = useState('');
  const [compensation, setCompensation] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const session = await getValidSession(supabase);
        if (!session) return;
        const token = session.access_token;

        // Parallel: home-get (user + team prefs) + submission-profile (contact info)
        const [homeRes, profileRes] = await Promise.all([
          apiFetch('home-get', token),
          apiFetch('submission-profile', token),
        ]);

        const homeJson = await homeRes.json();
        const profileJson = await profileRes.json();

        if (homeJson.data) {
          const { user, team } = homeJson.data;
          setDisplayName(user?.display_name || '');
          setEmail(user?.email || '');
          setStrategy(team?.strategy_mode || 'balanced');
          setScope(team?.coverage_scope || 'global_english');
        }

        if (profileJson.data) {
          const p = profileJson.data;
          setPhone(p.phone || '');
          setContactEmail(p.contact_email || '');
          setCurrentCity(p.current_city || '');
          setCurrentCountry(p.current_country || '');
          setNoticePeriod(p.notice_period || '');
          setCompensation(p.compensation_preference || '');
        }
      } catch (e) { console.error('[settings]', e); }
      setLoading(false);
    }
    load();
  }, [supabase]);

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg('');
    try {
      const session = await getValidSession(supabase);
      if (!session) return;
      const token = session.access_token;

      // Save preferences + submission profile via settings-update
      const res = await apiFetch('settings-update', token, {
        method: 'POST',
        body: JSON.stringify({
          preferences: { strategy_mode: strategy, coverage_scope: scope },
          submission_profile: {
            phone,
            contact_email: contactEmail,
            current_city: currentCity,
            current_country: currentCountry,
            notice_period: noticePeriod,
            compensation_preference: compensation,
          },
        }),
      });

      if (res.ok) {
        setSaveMsg('已保存');
        setTimeout(() => setSaveMsg(''), 2000);
      } else {
        const json = await res.json();
        setSaveMsg(json.error?.message || '保存失败');
      }
    } catch {
      setSaveMsg('网络错误');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-sm text-muted-foreground animate-pulse">加载中...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-4xl font-display font-extrabold tracking-tight mb-2">设置</h1>
      <p className="text-sm text-muted-foreground mb-10">管理你的个人信息和求职偏好</p>

      {/* Personal Info */}
      <section className="mb-10">
        <h2 className="text-lg font-display font-bold mb-5">个人信息</h2>
        <div className="space-y-4">
          <Field label="显示名称" value={displayName} placeholder="你的名字" disabled />
          <Field label="账户邮箱" value={email} placeholder="" disabled />
        </div>
      </section>

      {/* Job Preferences — read from team, display only for now */}
      <section className="mb-10">
        <h2 className="text-lg font-display font-bold mb-5">求职偏好</h2>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-semibold mb-2 block">工作模式</label>
            <div className="flex gap-2">
              {WORK_MODES.map(m => (
                <button key={m.value} onClick={() => setWorkMode(m.value)} className={`px-4 py-2 text-sm rounded-xl transition-all ${workMode === m.value ? 'bg-foreground text-background font-semibold' : 'bg-surface-low hover:bg-border/40'}`}>{m.label}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-semibold mb-2 block">覆盖范围</label>
            <div className="flex gap-2">
              {SCOPES.map(s => (
                <button key={s.value} onClick={() => setScope(s.value)} className={`px-4 py-2 text-sm rounded-xl transition-all ${scope === s.value ? 'bg-foreground text-background font-semibold' : 'bg-surface-low hover:bg-border/40'}`}>{s.label}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-semibold mb-2 block">策略模式</label>
            <div className="flex gap-2">
              {STRATEGIES.map(s => (
                <button key={s.value} onClick={() => setStrategy(s.value)} className={`px-4 py-2 text-sm rounded-xl transition-all ${strategy === s.value ? 'bg-foreground text-background font-semibold' : 'bg-surface-low hover:bg-border/40'}`}>{s.label}</button>
              ))}
            </div>
          </div>
          <Field label="期望薪资" value={compensation} onChange={setCompensation} placeholder="选填 — 例如：30-50k/月" />
        </div>
      </section>

      {/* Submission Profile */}
      <section className="mb-10">
        <h2 className="text-lg font-display font-bold mb-5">投递资料</h2>
        <div className="space-y-4">
          <Field label="手机号" value={phone} onChange={setPhone} placeholder="+86 138 0000 0000" />
          <Field label="联系邮箱" value={contactEmail} onChange={setContactEmail} placeholder="you@example.com" />
          <Field label="当前城市" value={currentCity} onChange={setCurrentCity} placeholder="上海" />
          <Field label="当前国家" value={currentCountry} onChange={setCurrentCountry} placeholder="中国" />
          <Field label="入职通知期" value={noticePeriod} onChange={setNoticePeriod} placeholder="例如：1 个月" />
        </div>
      </section>

      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-8 py-3 bg-foreground text-background rounded-xl text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? '保存中...' : '保存设置'}
        </button>
      </div>

      {/* Toast notification */}
      {saveMsg && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl text-sm font-semibold shadow-lifted animate-feed-in ${
          saveMsg === '已保存'
            ? 'bg-status-active/15 text-status-active border border-status-active/20'
            : 'bg-status-error/15 text-status-error border border-status-error/20'
        }`}>
          {saveMsg === '已保存' ? '设置已保存' : saveMsg}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, disabled }: {
  label: string; value?: string; onChange?: (v: string) => void; placeholder: string; disabled?: boolean;
}) {
  return (
    <div>
      <label className="text-sm font-semibold mb-2 block">{label}</label>
      <input
        type="text"
        value={value || ''}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-4 py-3 text-sm bg-surface-low rounded-xl border-0 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
      />
    </div>
  );
}
