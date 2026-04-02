'use client';

import { useState } from 'react';

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

export default function SettingsPage() {
  const [saving, setSaving] = useState(false);
  const [workMode, setWorkMode] = useState('flexible');
  const [scope, setScope] = useState('global_english');
  const [strategy, setStrategy] = useState('balanced');

  return (
    <div className="max-w-2xl">
      <h1 className="text-4xl font-display font-extrabold tracking-tight mb-2">设置</h1>
      <p className="text-sm text-muted-foreground mb-10">管理你的个人信息和求职偏好</p>

      {/* Personal Info */}
      <section className="mb-10">
        <h2 className="text-lg font-display font-bold mb-5">个人信息</h2>
        <div className="space-y-4">
          <Field label="显示名称" placeholder="你的名字" />
          <Field label="邮箱" placeholder="you@example.com" disabled />
        </div>
      </section>

      {/* Job Preferences */}
      <section className="mb-10">
        <h2 className="text-lg font-display font-bold mb-5">求职偏好</h2>
        <div className="space-y-4">
          <Field label="目标岗位" placeholder="后端工程师, 产品经理" />
          <Field label="目标城市" placeholder="上海, Remote, 旧金山" />
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
          <Field label="期望薪资" placeholder="选填 — 例如：30-50k/月" />
        </div>
      </section>

      {/* Submission Profile */}
      <section className="mb-10">
        <h2 className="text-lg font-display font-bold mb-5">投递资料</h2>
        <div className="space-y-4">
          <Field label="手机号" placeholder="+86 138 0000 0000" />
          <Field label="联系邮箱" placeholder="you@example.com" />
          <Field label="当前城市" placeholder="上海" />
          <Field label="当前国家" placeholder="中国" />
          <Field label="入职通知期" placeholder="例如：1 个月" />
        </div>
      </section>

      <button
        onClick={() => { setSaving(true); setTimeout(() => setSaving(false), 1500); }}
        className="px-8 py-3 bg-foreground text-background rounded-xl text-sm font-bold hover:opacity-90 transition-opacity"
      >
        {saving ? '保存中...' : '保存设置'}
      </button>
    </div>
  );
}

function Field({ label, placeholder, disabled }: { label: string; placeholder: string; disabled?: boolean }) {
  return (
    <div>
      <label className="text-sm font-semibold mb-2 block">{label}</label>
      <input
        type="text"
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-4 py-3 text-sm bg-surface-low rounded-xl border-0 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
      />
    </div>
  );
}
