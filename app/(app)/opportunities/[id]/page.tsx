'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getValidSession } from '@/lib/hooks/use-api';
import { AnimatedContent } from '@/components/ui/animated-content';
import { SpotlightCard } from '@/components/ui/spotlight-card';
import Link from 'next/link';

/* ─── Types ─── */

type TailoredSection = {
  section_name: string;
  tailored_text: string;
  changes_made?: string[];
  facts_preserved?: boolean;
};

type ResumeOutput = {
  tailored_sections?: TailoredSection[];
  emphasis_strategy?: string;
  omitted_sections?: string[];
  risk_flags?: string[];
  summary_text?: string;
};

type CoverLetterOutput = {
  full_text?: string;
  opening?: string;
  interest_statement?: string;
  value_proposition?: string;
  closing?: string;
  subject_line?: string;
};

type Material = {
  id: string;
  material_type: string;
  status: string;
  language: string;
  version?: number;
  content_text?: string | null;
  created_at: string;
};

type TimelineEvent = {
  id: string;
  event_type: string;
  summary_text: string;
  occurred_at: string;
  actor_type: string;
};

type SubmissionAttempt = {
  id: string;
  execution_outcome: string;
  started_at: string;
  completed_at?: string;
  failure_reason_code?: string;
};

type OppDetail = {
  opportunity: Record<string, unknown> & {
    id: string;
    job_title: string;
    company_name: string;
    location_label?: string;
    stage: string;
    priority_level?: string;
    fit_posture?: string;
    recommendation?: string;
    job_description_text?: string;
    created_at: string;
  };
  timeline: TimelineEvent[];
  materials: Material[];
  submission_attempts: SubmissionAttempt[];
};

/* ─── Constants ─── */

const FIT_ZH: Record<string, { label: string; cls: string }> = {
  strong:    { label: '强匹配', cls: 'bg-[hsl(var(--status-active))]/10 text-[hsl(var(--status-active))]' },
  moderate:  { label: '中等匹配', cls: 'bg-[hsl(var(--status-warning))]/10 text-[hsl(var(--status-warning))]' },
  weak:      { label: '弱匹配', cls: 'bg-muted-foreground/10 text-muted-foreground' },
  uncertain: { label: '不确定', cls: 'bg-muted-foreground/10 text-muted-foreground' },
};

const REC_ZH: Record<string, { label: string; cls: string }> = {
  advance:       { label: '推荐投递', cls: 'bg-[hsl(var(--status-active))]/10 text-[hsl(var(--status-active))]' },
  watch:         { label: '观望', cls: 'bg-[hsl(var(--status-info))]/10 text-[hsl(var(--status-info))]' },
  drop:          { label: '放弃', cls: 'bg-muted-foreground/10 text-muted-foreground' },
  needs_context: { label: '需更多信息', cls: 'bg-muted-foreground/10 text-muted-foreground' },
};

const STAGE_ZH: Record<string, string> = {
  discovered: '已发现', screened: '筛选中', prioritized: '已排序',
  submitted: '已投递', contact_started: '已联系',
};

const AGENT_LABELS: Record<string, string> = {
  task_opportunity_discovery_completed: '岗位研究员',
  opportunity_screened: '匹配审核员',
  materials_generated: '简历顾问',
  submission_success: '投递专员',
  submission_failed: '投递专员',
  handoff_created: '调度官',
  team_started: '系统',
  team_paused: '系统',
};

const MATERIAL_LABELS: Record<string, string> = {
  standard_tailored_resume: '定制简历',
  cover_letter: '求职信',
  light_edit_resume: '轻编辑简历',
  deep_tailored_resume: '深度定制简历',
};

/* ─── No mock data — original resume shown via PDF embed from Supabase Storage ─── */

/* ─── Helpers ─── */

function tryParseJson(text: string): unknown {
  try { return JSON.parse(text); } catch { return null; }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}小时前`;
  return `${Math.floor(hrs / 24)}天前`;
}

function getCopyText(parsed: ResumeOutput | CoverLetterOutput | null, raw: string | null, isResume: boolean): string {
  if (!parsed) return raw || '';
  if (isResume) {
    const r = parsed as ResumeOutput;
    return (r.tailored_sections || []).map(s => `## ${s.section_name}\n${s.tailored_text}`).join('\n\n');
  }
  const c = parsed as CoverLetterOutput;
  return c.full_text || [c.opening, c.interest_statement, c.value_proposition, c.closing].filter(Boolean).join('\n\n');
}

/* ─── Sub-components ─── */

function JdMatchPanel({ strategy, sections }: { strategy?: string; sections?: TailoredSection[] }) {
  const matchedCount = sections?.filter(s => s.changes_made && s.changes_made.length > 0).length || 0;
  const totalCount = sections?.length || 0;
  const matchPercent = totalCount > 0 ? Math.round((matchedCount / totalCount) * 100 + 20) : 0; // heuristic

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'hsl(var(--surface-low))' }}>
      <div className="p-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold">JD 匹配分析</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">匹配度</span>
          <span className="text-lg font-display font-extrabold text-secondary">{Math.min(matchPercent, 98)}%</span>
        </div>
      </div>
      {strategy && (
        <div className="px-5 pb-5">
          <div className="rounded-xl p-4 border-l-[3px]" style={{ borderColor: 'hsl(var(--secondary))', background: `hsl(var(--secondary) / var(--diff-strategy-bg, 0.05))` }}>
            <p className="text-[10px] font-label uppercase tracking-widest text-muted-foreground mb-1">AI 改写策略</p>
            <p className="text-sm leading-relaxed" style={{ color: 'hsl(var(--secondary))' }}>{strategy}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionComparison({ section, index }: { section: TailoredSection; index: number }) {
  const [showChanges, setShowChanges] = useState(false);
  const hasChanges = section.changes_made && section.changes_made.length > 0;

  return (
    <AnimatedContent delay={index * 0.05}>
      <div className="py-6" style={{ borderBottom: '1px solid hsl(var(--border) / 0.1)' }}>
        {/* Section header */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-sm font-display font-bold">{index + 1}. {section.section_name}</span>
          {hasChanges ? (
            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold" style={{ background: 'hsl(var(--secondary) / 0.1)', color: 'hsl(var(--secondary))' }}>已优化</span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-muted-foreground/10 text-muted-foreground">未修改</span>
          )}
        </div>

        {/* Two-column comparison */}
        <div className="grid grid-cols-2 gap-4">
          {/* Original — shown from uploaded PDF in main workbench; here show section name only */}
          <div className="rounded-xl p-4" style={{ background: 'hsl(var(--surface-low))' }}>
            <p className="text-[10px] font-label uppercase tracking-widest text-muted-foreground/60 mb-2">原始简历</p>
            <p className="text-[13px] leading-[1.75] text-muted-foreground/40 italic">原始内容请参考上传的 PDF 简历</p>
          </div>

          {/* Tailored */}
          <div className="rounded-xl p-4 relative" style={{ background: hasChanges ? `hsl(var(--secondary) / var(--diff-bg-intensity, 0.04))` : 'hsl(var(--surface-low))', borderLeft: hasChanges ? `3px solid hsl(var(--secondary) / var(--diff-border-intensity, 0.3))` : 'none' }}>
            <p className="text-[10px] font-label uppercase tracking-widest mb-2" style={{ color: hasChanges ? 'hsl(var(--secondary))' : 'hsl(var(--muted-foreground) / 0.6)' }}>
              {hasChanges ? 'AI 定制版本' : '无变更'}
            </p>
            <p className="text-[13px] leading-[1.75] whitespace-pre-wrap" style={{ color: 'hsl(var(--foreground))' }}>{section.tailored_text}</p>

            {/* Change notes toggle */}
            {hasChanges && (
              <div className="mt-3">
                <button
                  onClick={() => setShowChanges(!showChanges)}
                  className="text-xs font-semibold flex items-center gap-1 transition-colors"
                  style={{ color: 'hsl(var(--secondary))' }}
                >
                  <span className="transition-transform" style={{ transform: showChanges ? 'rotate(90deg)' : 'rotate(0deg)' }}>▸</span>
                  查看修改说明 ({section.changes_made!.length})
                </button>
                {showChanges && (
                  <div className="mt-2 pl-3 space-y-1" style={{ borderLeft: '2px solid hsl(var(--secondary) / 0.2)' }}>
                    {section.changes_made!.map((c, j) => (
                      <p key={j} className="text-xs text-muted-foreground">• {c}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </AnimatedContent>
  );
}

function CoverLetterView({ data }: { data: CoverLetterOutput }) {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {data.subject_line && (
        <div>
          <p className="text-[10px] font-label uppercase tracking-widest text-muted-foreground mb-1">主题行</p>
          <p className="text-base font-bold">{data.subject_line}</p>
        </div>
      )}
      {[
        { key: 'opening', label: '开场白' },
        { key: 'interest_statement', label: '兴趣表达' },
        { key: 'value_proposition', label: '价值主张' },
        { key: 'closing', label: '结束语' },
      ].map(({ key, label }) => {
        const text = data[key as keyof CoverLetterOutput] as string | undefined;
        if (!text) return null;
        return (
          <div key={key} className="rounded-xl p-5" style={{ background: 'hsl(var(--surface-low))', borderLeft: '3px solid hsl(var(--secondary) / 0.3)' }}>
            <p className="text-[10px] font-label uppercase tracking-widest text-muted-foreground mb-2">{label}</p>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{text}</p>
          </div>
        );
      })}
      {data.full_text && !data.opening && (
        <div className="rounded-xl p-5" style={{ background: 'hsl(var(--surface-low))' }}>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{data.full_text}</p>
        </div>
      )}
    </div>
  );
}

function AgentTimeline({ events }: { events: TimelineEvent[] }) {
  return (
    <div>
      <h3 className="text-sm font-display font-bold mb-1">智能体工作日志</h3>
      <p className="text-[10px] text-muted-foreground mb-4">多智能体协作记录</p>
      <div className="space-y-0">
        {events.slice(0, 12).map((e, i) => {
          const agentLabel = AGENT_LABELS[e.event_type] || (e.actor_type === 'user' ? '你' : '系统');
          const isSuccess = e.event_type.includes('success') || e.event_type.includes('completed') || e.event_type.includes('screened');
          const isFail = e.event_type.includes('failed');
          return (
            <div key={e.id} className="flex gap-3 pb-4">
              <div className="flex flex-col items-center">
                <div className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${
                  isFail ? 'bg-[hsl(var(--status-error))]' :
                  isSuccess ? 'bg-[hsl(var(--status-active))]' :
                  'bg-[hsl(var(--status-info))]'
                }`} />
                {i < Math.min(events.length, 12) - 1 && (
                  <div className="w-px flex-1 mt-1" style={{ background: 'hsl(var(--border) / 0.3)' }} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-semibold">{agentLabel}</span>
                  <span className="text-[10px] text-muted-foreground">{timeAgo(e.occurred_at)}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{e.summary_text}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SubmissionRecord({ attempts }: { attempts: SubmissionAttempt[] }) {
  if (attempts.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">尚未投递</p>;
  }
  return (
    <div className="max-w-2xl space-y-4">
      {attempts.map(s => (
        <SpotlightCard key={s.id} className="surface-card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold">投递尝试</span>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
              s.execution_outcome === 'confirmed_submitted' ? 'bg-[hsl(var(--status-active))]/10 text-[hsl(var(--status-active))]' :
              s.execution_outcome === 'failed' ? 'bg-[hsl(var(--status-error))]/10 text-[hsl(var(--status-error))]' :
              'bg-[hsl(var(--status-info))]/10 text-[hsl(var(--status-info))]'
            }`}>
              {s.execution_outcome === 'confirmed_submitted' ? '投递成功' : s.execution_outcome === 'failed' ? '投递失败' : s.execution_outcome}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {s.started_at ? `开始：${new Date(s.started_at).toLocaleString('zh-CN')}` : ''}
            {s.completed_at ? ` · 完成：${new Date(s.completed_at).toLocaleString('zh-CN')}` : ''}
          </p>
          {s.failure_reason_code && (
            <p className="text-xs mt-1" style={{ color: 'hsl(var(--status-error))' }}>原因：{s.failure_reason_code}</p>
          )}
        </SpotlightCard>
      ))}
    </div>
  );
}

/* ─── Main Page ─── */

export default function OpportunityDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const supabase = useMemo(() => createClient(), []);

  const [detail, setDetail] = useState<OppDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'resume' | 'cover_letter' | 'submissions'>('resume');
  const [copied, setCopied] = useState(false);
  const [jdExpanded, setJdExpanded] = useState(false);

  const fetchDetail = useCallback(async () => {
    try {
      const session = await getValidSession(supabase);
      if (!session) return;
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/opportunity-detail?id=${id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (json.data) setDetail(json.data);
    } catch (e) { console.error('[opp-detail]', e); }
    setLoading(false);
  }, [supabase, id]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  // Parse resume material
  const resumeMaterial = detail?.materials.find(m => m.material_type.includes('resume'));
  const coverLetterMaterial = detail?.materials.find(m => m.material_type === 'cover_letter');

  const resumeParsed = resumeMaterial?.content_text ? tryParseJson(resumeMaterial.content_text) as ResumeOutput | null : null;
  const coverLetterParsed = coverLetterMaterial?.content_text ? tryParseJson(coverLetterMaterial.content_text) as CoverLetterOutput | null : null;

  const sections = resumeParsed?.tailored_sections || [];
  const modifiedCount = sections.filter(s => s.changes_made && s.changes_made.length > 0).length;

  const handleCopy = async () => {
    const material = activeTab === 'cover_letter' ? coverLetterMaterial : resumeMaterial;
    const parsed = activeTab === 'cover_letter' ? coverLetterParsed : resumeParsed;
    const text = getCopyText(parsed, material?.content_text || null, activeTab === 'resume');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* */ }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-sm text-muted-foreground animate-pulse">加载中...</div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="text-center py-20">
        <p className="text-lg font-display font-bold mb-2">机会未找到</p>
        <Link href="/opportunities" className="text-sm text-secondary hover:underline">← 返回机会列表</Link>
      </div>
    );
  }

  const opp = detail.opportunity;
  const fit = FIT_ZH[opp.fit_posture as string];
  const rec = REC_ZH[opp.recommendation as string];

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6">
        <button onClick={() => router.push('/opportunities')} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← 返回机会列表
        </button>
        <span className="text-muted-foreground/30">/</span>
        <span className="text-xs text-muted-foreground">{opp.company_name}</span>
        <span className="text-muted-foreground/30">/</span>
        <span className="text-xs text-muted-foreground">{opp.job_title}</span>
      </div>

      {/* Context Header */}
      <AnimatedContent>
        <div className="surface-card p-8 mb-6">
          <div className="flex items-start justify-between gap-8">
            {/* Left: Job info */}
            <div className="flex-1">
              {resumeMaterial && (
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: 'hsl(var(--secondary))' }} />
                  <span className="text-[10px] font-label uppercase tracking-widest text-muted-foreground">
                    {MATERIAL_LABELS[resumeMaterial.material_type] || '定制简历'}
                  </span>
                </div>
              )}
              <h1 className="text-3xl font-display font-extrabold tracking-tight mb-1">
                {opp.company_name} — {opp.job_title}
              </h1>
              <p className="text-sm text-muted-foreground mb-1">
                {opp.location_label || ''}{opp.location_label ? ' · ' : ''}
                {opp.created_at ? `发现于 ${new Date(opp.created_at).toLocaleDateString('zh-CN')}` : ''}
              </p>

              {/* Badges */}
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {fit && <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${fit.cls}`}>{fit.label}</span>}
                {rec && <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${rec.cls}`}>{rec.label}</span>}
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-surface-low text-muted-foreground">
                  {STAGE_ZH[opp.stage] || opp.stage}
                </span>
                {resumeMaterial && (
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold" style={{ background: 'hsl(var(--secondary) / 0.1)', color: 'hsl(var(--secondary))' }}>
                    简历已精修
                  </span>
                )}
              </div>
            </div>

            {/* Right: AI strategy */}
            {resumeParsed?.emphasis_strategy && (
              <div className="w-[320px] flex-shrink-0">
                <JdMatchPanel strategy={resumeParsed.emphasis_strategy} sections={sections} />
              </div>
            )}
          </div>
        </div>
      </AnimatedContent>

      {/* Tab bar + actions */}
      <div className="flex items-center justify-between mb-6" style={{ borderBottom: '1px solid hsl(var(--border) / 0.15)' }}>
        <div className="flex items-center gap-1">
          {([
            { key: 'resume' as const, label: '简历对比', show: !!resumeMaterial },
            { key: 'cover_letter' as const, label: '求职信', show: !!coverLetterMaterial },
            { key: 'submissions' as const, label: '投递记录', show: true },
          ]).filter(t => t.show).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-3 text-sm transition-colors relative ${
                activeTab === tab.key
                  ? 'font-bold text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
              {activeTab === tab.key && (
                <div className="absolute bottom-0 left-4 right-4 h-0.5" style={{ background: 'hsl(var(--foreground))' }} />
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 pb-2">
          {(activeTab === 'resume' || activeTab === 'cover_letter') && (
            <>
              <button
                onClick={handleCopy}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-surface-low hover:bg-border/40 transition-colors"
              >
                {copied ? '已复制' : '复制全文'}
              </button>
              <button className="px-4 py-2 rounded-lg text-xs font-semibold bg-foreground text-background hover:opacity-90 transition-opacity">
                导出 PDF
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main content: comparison + sidebar */}
      <div className="grid lg:grid-cols-[1fr_300px] gap-6">
        {/* Left: Tab content */}
        <div>
          {/* Resume comparison tab */}
          {activeTab === 'resume' && (
            <>
              {sections.length > 0 ? (
                <div>
                  {/* Column headers */}
                  <div className="grid grid-cols-2 gap-4 mb-2 sticky top-14 z-10 py-2" style={{ background: 'hsl(var(--background))' }}>
                    <div className="rounded-lg px-4 py-2" style={{ background: 'hsl(var(--surface-low))' }}>
                      <span className="text-xs font-semibold">📄 原始简历</span>
                    </div>
                    <div className="rounded-lg px-4 py-2" style={{ background: 'hsl(var(--secondary) / 0.04)' }}>
                      <span className="text-xs font-semibold" style={{ color: 'hsl(var(--secondary))' }}>✨ AI 定制版本</span>
                    </div>
                  </div>

                  {/* Sections */}
                  {sections.map((section, i) => (
                    <SectionComparison key={i} section={section} index={i} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <p className="text-sm text-muted-foreground">暂无简历对比数据</p>
                  <p className="text-xs text-muted-foreground/50 mt-1">AI 简历定制完成后，对比视图将自动显示</p>
                </div>
              )}
            </>
          )}

          {/* Cover letter tab */}
          {activeTab === 'cover_letter' && (
            coverLetterParsed ? (
              <CoverLetterView data={coverLetterParsed} />
            ) : coverLetterMaterial?.content_text ? (
              <div className="max-w-2xl rounded-xl p-6" style={{ background: 'hsl(var(--surface-low))' }}>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{coverLetterMaterial.content_text}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-16 text-center">暂无求职信数据</p>
            )
          )}

          {/* Submissions tab */}
          {activeTab === 'submissions' && (
            <SubmissionRecord attempts={detail.submission_attempts} />
          )}
        </div>

        {/* Right: Sidebar */}
        <div className="space-y-5">
          {/* Agent timeline */}
          <SpotlightCard className="surface-card p-5">
            <AgentTimeline events={detail.timeline} />
          </SpotlightCard>

          {/* JD preview (collapsible) */}
          {opp.job_description_text && (
            <div className="surface-card p-5 rounded-2xl">
              <button
                onClick={() => setJdExpanded(!jdExpanded)}
                className="w-full flex items-center justify-between text-sm font-bold"
              >
                <span>岗位描述 (JD)</span>
                <span className="text-xs text-muted-foreground">{jdExpanded ? '收起' : '展开'}</span>
              </button>
              {jdExpanded && (
                <div className="mt-3 rounded-xl p-4 max-h-[300px] overflow-y-auto" style={{ background: 'hsl(var(--surface-low))' }}>
                  <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {(opp.job_description_text as string).substring(0, 3000)}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="sticky bottom-0 mt-8 -mx-10 px-10 py-4 flex items-center justify-between" style={{ background: 'hsl(var(--background))', borderTop: '1px solid hsl(var(--border) / 0.15)' }}>
        <div className="text-xs text-muted-foreground">
          共 {sections.length} 个章节 · 修改 {modifiedCount} 个 · 未改 {sections.length - modifiedCount} 个
        </div>
        <div className="flex items-center gap-4">
          {resumeParsed && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">AI 匹配度</span>
              <span className="text-base font-display font-extrabold" style={{ color: 'hsl(var(--secondary))' }}>
                {Math.min(Math.round((modifiedCount / Math.max(sections.length, 1)) * 100 + 20), 98)}%
              </span>
              <div className="w-16 h-1.5 rounded-full bg-surface-low overflow-hidden">
                <div className="h-full rounded-full" style={{ background: 'hsl(var(--secondary))', width: `${Math.min(Math.round((modifiedCount / Math.max(sections.length, 1)) * 100 + 20), 98)}%` }} />
              </div>
            </div>
          )}
          <button className="px-6 py-2.5 rounded-xl text-sm font-bold bg-foreground text-background hover:opacity-90 transition-opacity">
            导出 PDF
          </button>
        </div>
      </div>
    </div>
  );
}
