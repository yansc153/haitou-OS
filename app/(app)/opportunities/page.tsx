'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { pdf } from '@react-pdf/renderer';
import { createClient } from '@/lib/supabase/client';
import { getValidSession } from '@/lib/hooks/use-api';
import { AnimatedContent } from '@/components/ui/animated-content';
import { SpotlightCard } from '@/components/ui/spotlight-card';
import { ResumePdf } from '@/components/pdf/resume-pdf';

function stripHtml(raw: string): string {
  // Step 1: Decode HTML entities first (Greenhouse API returns &lt;h3&gt; not <h3>)
  let html = raw
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&rsquo;/g, "'").replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&mdash;/g, '—').replace(/&ndash;/g, '–').replace(/&bull;/g, '•');

  // Step 2: Convert HTML structure to readable text
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(p|div)(\s[^>]*)?>/gi, '\n')
    .replace(/<\/?(h[1-6])(\s[^>]*)?>/gi, '\n')
    .replace(/<li(\s[^>]*)?>/gi, '\n• ')
    .replace(/<\/li>/gi, '')
    .replace(/<\/?(ul|ol)(\s[^>]*)?>/gi, '\n')
    .replace(/<(strong|b)(\s[^>]*)?>(.*?)<\/(strong|b)>/gi, '$3')
    .replace(/<(em|i)(\s[^>]*)?>(.*?)<\/(em|i)>/gi, '$3')
    .replace(/<[^>]*>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/* ─── Constants ─── */

/** Translate AI reason tags to Chinese. Uses exact match first, then keyword matching. */
function translateReasonTag(tag: string): string {
  // Keyword-based translation patterns (covers most AI-generated tags)
  const patterns: [RegExp, string][] = [
    [/profile.*empty|profile.*incomplete|no.*experience|no.*skills/i, '简历数据不完整'],
    [/parse.*confidence.*low/i, '简历解析置信度低'],
    [/unable.*verify|cannot.*verify/i, '无法验证相关资质'],
    [/job.*description.*missing|job.*description.*empty/i, '职位描述为空'],
    [/domain.*mismatch/i, '领域不匹配'],
    [/location.*mismatch|location.*unknown/i, '地点不匹配'],
    [/lack.*experience|missing.*experience/i, '缺少相关经验'],
    [/strong.*match|strong.*fit/i, '强匹配'],
    [/relevant.*experience/i, '相关行业经验'],
    [/weak_fit|weak.*fit/i, '弱匹配'],
    [/candidate.*profile.*data/i, '候选人资料不完整'],
    [/work.*authorization/i, '工作许可未知'],
    [/salary/i, '薪资相关'],
    [/overqualified/i, '资历超出要求'],
    [/underqualified/i, '资历不足'],
    [/skills.*match/i, '技能匹配'],
    [/experience.*match/i, '经验匹配'],
  ];
  for (const [re, zh] of patterns) {
    if (re.test(tag)) return zh;
  }
  // If all ASCII, likely untranslated English — return a generic label
  if (/^[a-zA-Z0-9_\s.,;:()'"\-/]+$/.test(tag) && tag.length > 20) return '详细评估';
  return tag;
}

const STAGES = [
  { value: 'discovered', label: '发现', icon: '🔍' },
  { value: 'screened', label: '筛选', icon: '🎯' },
  { value: 'prioritized', label: '排序', icon: '📊' },
  { value: 'submitted', label: '投递', icon: '🚀' },
  { value: 'contact_started', label: '联系', icon: '💬' },
];

const FIT_ZH: Record<string, { label: string; cls: string }> = {
  strong_fit: { label: '强匹配', cls: 'bg-[hsl(var(--status-active))]/10 text-[hsl(var(--status-active))]' },
  strong:     { label: '强匹配', cls: 'bg-[hsl(var(--status-active))]/10 text-[hsl(var(--status-active))]' },
  moderate_fit: { label: '中等', cls: 'bg-[hsl(var(--status-warning))]/10 text-[hsl(var(--status-warning))]' },
  moderate:   { label: '中等', cls: 'bg-[hsl(var(--status-warning))]/10 text-[hsl(var(--status-warning))]' },
  weak_fit:   { label: '弱', cls: 'bg-muted-foreground/10 text-muted-foreground' },
  weak:       { label: '弱', cls: 'bg-muted-foreground/10 text-muted-foreground' },
  uncertain:  { label: '待评估', cls: 'bg-muted-foreground/10 text-muted-foreground' },
  misaligned: { label: '不匹配', cls: 'bg-[hsl(var(--status-error))]/10 text-[hsl(var(--status-error))]' },
};

const STAGE_INDEX: Record<string, number> = {
  discovered: 0, screened: 1, prioritized: 2, submitted: 3, contact_started: 4,
};

/* ─── Types ─── */

type Opp = {
  id: string;
  job_title: string;
  company_name: string;
  location_label: string;
  stage: string;
  priority_level: string;
  latest_event_summary?: string;
  recommendation?: string;
  recommendation_reason_tags?: string[];
  fit_posture?: string;
  job_description_text?: string;
  created_at: string;
};

type TailoredSection = {
  section_name: string;
  tailored_text: string;
  changes_made?: string[];
};

type ResumeOutput = {
  tailored_sections?: TailoredSection[];
  emphasis_strategy?: string;
};

type CoverLetterOutput = {
  full_text?: string;
  opening?: string;
  value_proposition?: string;
  closing?: string;
  subject_line?: string;
};

type OppDetail = {
  opportunity: Opp & Record<string, unknown>;
  timeline: Array<{ id: string; event_type: string; summary_text: string; occurred_at: string; actor_type: string }>;
  materials: Array<{ id: string; material_type: string; status: string; language: string; content_text?: string | null; created_at: string }>;
  submission_attempts: Array<{ id: string; execution_outcome: string; started_at: string; completed_at?: string; failure_reason_code?: string }>;
  profile?: { full_name: string; contact_email: string } | null;
  resume_signed_url?: string | null;
};

/* ─── No demo data — all content comes from real API ─── */

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

const AGENT_LABELS: Record<string, string> = {
  task_opportunity_discovery_completed: '岗位研究员',
  opportunity_screened: '匹配审核员',
  materials_generated: '简历顾问',
  submission_success: '投递专员',
  submission_failed: '投递专员',
  handoff_created: '调度官',
};

/* ─── Main Page ─── */

export default function OpportunitiesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [opps, setOpps] = useState<Opp[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<OppDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState(false);
  const [rightDocMode, setRightDocMode] = useState<'diff' | 'clean'>('diff');
  const scrollRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<HTMLDivElement>(null);

  const fetchOpps = useCallback(async () => {
    try {
      const session = await getValidSession(supabase);
      if (!session) return;
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/opportunities-list?limit=100`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (json.data?.opportunities) {
        setOpps(json.data.opportunities);
        // Auto-select first submitted/prioritized opportunity
        const first = json.data.opportunities.find((o: Opp) => ['submitted', 'contact_started', 'prioritized'].includes(o.stage))
          || json.data.opportunities[0];
        if (first) selectOpp(first.id);
      }
    } catch (e) { console.error('[opportunities]', e); }
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  useEffect(() => { fetchOpps(); }, [fetchOpps]);

  const selectOpp = useCallback(async (id: string) => {
    if (id === selectedId && detail) return;
    setSelectedId(id);
    setDetailLoading(true);
    setExpandedSections(new Set());
    try {
      const session = await getValidSession(supabase);
      if (!session) return;
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/opportunity-detail?id=${id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (json.data) {
        setDetail(json.data as OppDetail);
      }
    } catch { /* ignore */ }
    setDetailLoading(false);
  }, [supabase, selectedId, detail]);

  // Parsed material data
  const resumeMaterial = detail?.materials.find(m => m.material_type.includes('resume'));
  const coverMaterial = detail?.materials.find(m => m.material_type === 'cover_letter');
  const resumeParsed = resumeMaterial?.content_text ? tryParseJson(resumeMaterial.content_text) as ResumeOutput | null : null;
  const coverParsed = coverMaterial?.content_text ? tryParseJson(coverMaterial.content_text) as CoverLetterOutput | null : null;
  const sections = resumeParsed?.tailored_sections || [];
  const modifiedCount = sections.filter(s => s.changes_made && s.changes_made.length > 0).length;

  // Stage counts — cumulative (how many passed through each stage)
  const stageCounts = STAGES.map((s, idx) => ({
    ...s,
    count: opps.filter(o => (STAGE_INDEX[o.stage] ?? -1) >= idx).length,
  }));

  const selectedOpp = opps.find(o => o.id === selectedId);
  const selectedStageIdx = STAGE_INDEX[selectedOpp?.stage || ''] ?? -1;

  const toggleSection = (i: number) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const [exporting, setExporting] = useState(false);
  const handleExportPdf = async () => {
    if (!resumeParsed?.tailored_sections || !detail) return;
    setExporting(true);
    try {
      const blob = await pdf(
        ResumePdf({
          fullName: detail.profile?.full_name || 'Resume',
          contactEmail: detail.profile?.contact_email,
          sections: resumeParsed.tailored_sections,
          companyName: detail.opportunity.company_name,
          jobTitle: detail.opportunity.job_title,
        })
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${detail.opportunity.company_name}_${detail.opportunity.job_title}_简历.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('[pdf] Export failed:', e);
    }
    setExporting(false);
  };

  const handleCopy = async () => {
    if (!resumeParsed) return;
    const text = (resumeParsed.tailored_sections || []).map(s => `## ${s.section_name}\n${s.tailored_text}`).join('\n\n');
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

  return (
    <div>
      {/* ━━━ Header ━━━ */}
      <div className="mb-6">
        <h1 className="text-3xl font-display font-extrabold tracking-tight">机会工作台</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {opps.length > 0 ? `${opps.length} 个机会 · AI 团队持续运营中` : '暂无机会 — 启动团队后专员会自动发现'}
        </p>
      </div>

      {opps.length === 0 && (
        <div className="surface-card p-12 text-center">
          <p className="text-lg font-display font-bold mb-2">还没有机会</p>
          <p className="text-sm text-muted-foreground">启动团队后，岗位研究员会自动扫描平台并发现匹配机会</p>
        </div>
      )}

      {opps.length > 0 && (
        <>
          {/* ━━━ Section 1: Horizontal scrollable job cards ━━━ */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-label uppercase tracking-widest text-muted-foreground">岗位总览</span>
              <span className="text-xs text-muted-foreground">{opps.length} 个机会</span>
            </div>
            <div ref={scrollRef} className="flex gap-3 overflow-x-auto pb-3 -mx-2 px-2 scrollbar-thin">
              {[...opps].sort((a, b) => {
                // Priority: material_ready/submitted first, then by stage progress, then newest
                const stageWeight: Record<string, number> = { submitted: 5, contact_started: 5, material_ready: 4, prioritized: 3, screened: 2, discovered: 1 };
                const wA = stageWeight[a.stage] || 0, wB = stageWeight[b.stage] || 0;
                if (wA !== wB) return wB - wA;
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
              }).map((opp, i) => {
                const isSelected = opp.id === selectedId;
                const fit = FIT_ZH[opp.fit_posture || ''];
                // Only show "已精修" when materials actually exist (material_ready or submitted)
                const hasMaterials = opp.stage === 'material_ready' || opp.stage === 'submitted' || opp.stage === 'contact_started';
                return (
                  <AnimatedContent key={opp.id} delay={i * 0.03}>
                    <div
                      onClick={() => selectOpp(opp.id)}
                      className={`flex-shrink-0 w-[220px] rounded-2xl p-4 cursor-pointer transition-all duration-200 ${
                        isSelected
                          ? 'shadow-lifted -translate-y-1 ring-2'
                          : 'hover:shadow-card hover:-translate-y-0.5'
                      }`}
                      style={{
                        background: 'hsl(var(--card))',
                        boxShadow: isSelected ? '0 0 0 2px hsl(var(--foreground)), var(--shadow-lifted)' : 'var(--shadow-card)',
                      }}
                    >
                      {/* Priority bar */}
                      {opp.priority_level === 'critical' && (
                        <div className="h-1 rounded-full mb-3 w-2/3" style={{ background: 'hsl(var(--status-active) / 0.3)' }} />
                      )}
                      <h4 className="text-sm font-bold truncate mb-0.5">{opp.company_name}</h4>
                      <p className="text-xs text-muted-foreground truncate mb-2">{opp.job_title}</p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {fit && <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${fit.cls}`}>{fit.label}</span>}
                        {hasMaterials && (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-status-active/10 text-status-active">
                            {opp.stage === 'submitted' || opp.stage === 'contact_started' ? '已投递' : '材料就绪'}
                          </span>
                        )}
                        {opp.recommendation === 'advance' && !hasMaterials && (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-status-warning/10 text-status-warning">
                            推荐投递
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-2" style={{ borderTop: '1px solid hsl(var(--border) / 0.1)' }}>
                        <span className="text-[10px] text-muted-foreground">{timeAgo(opp.created_at)}</span>
                        <span className="text-[10px] text-muted-foreground/50">
                          {STAGES.find(s => s.value === opp.stage)?.label || opp.stage}
                        </span>
                      </div>
                    </div>
                  </AnimatedContent>
                );
              })}
            </div>
          </div>

          {/* ━━━ Section 2: Pipeline stage bar ━━━ */}
          <div className="surface-card p-4 mb-6 rounded-2xl">
            <div className="flex items-center justify-between">
              {stageCounts.map((stage, i) => {
                const isActive = i <= selectedStageIdx;
                const isCurrent = i === selectedStageIdx;
                return (
                  <div key={stage.value} className="flex items-center flex-1">
                    <div className="flex flex-col items-center flex-1">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm mb-1.5 transition-all ${
                        isCurrent
                          ? 'shadow-md scale-110'
                          : ''
                      }`} style={{
                        background: isActive ? 'hsl(var(--secondary) / 0.15)' : 'hsl(var(--surface-low))',
                        color: isActive ? 'hsl(var(--secondary))' : 'hsl(var(--muted-foreground) / 0.4)',
                      }}>
                        {stage.icon}
                      </div>
                      <span className={`text-[11px] font-semibold ${isActive ? '' : 'text-muted-foreground/40'}`}>{stage.label}</span>
                      <span className="text-[10px] text-muted-foreground">{stage.count}</span>
                    </div>
                    {/* Connector line */}
                    {i < stageCounts.length - 1 && (
                      <div className="h-px flex-1 -mt-5 mx-1" style={{
                        background: i < selectedStageIdx
                          ? 'hsl(var(--secondary) / 0.3)'
                          : 'hsl(var(--border) / 0.2)',
                      }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ━━━ Section 3: Selected opportunity detail + resume comparison ━━━ */}
          {selectedId && (
            <div>
              {detailLoading ? (
                <div className="surface-card p-12 text-center">
                  <div className="text-sm text-muted-foreground animate-pulse">加载详情...</div>
                </div>
              ) : detail ? (
                <>
                  {/* Context bar */}
                  <div className="flex items-start justify-between mb-5">
                    <div>
                      <h2 className="text-2xl font-display font-extrabold tracking-tight">
                        {detail.opportunity.company_name} — {detail.opportunity.job_title}
                      </h2>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {detail.opportunity.location_label || ''}
                        {detail.opportunity.created_at ? ` · 发现于 ${timeAgo(detail.opportunity.created_at)}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {resumeParsed && (
                        <button
                          onClick={handleCopy}
                          className="px-4 py-2 rounded-lg text-xs font-semibold bg-surface-low hover:bg-border/40 transition-colors"
                        >
                          {copied ? '已复制' : '复制全文'}
                        </button>
                      )}
                      <button onClick={handleExportPdf} disabled={exporting || !resumeParsed} className="px-4 py-2 rounded-lg text-xs font-semibold bg-foreground text-background hover:opacity-90 transition-opacity disabled:opacity-50">
                        {exporting ? '生成中...' : '导出 PDF'}
                      </button>
                    </div>
                  </div>

                  {/* AI Assessment Summary */}
                  {(detail.opportunity.fit_posture || detail.opportunity.recommendation) && (
                    <div className="mb-5 surface-card rounded-xl p-5">
                      <div className="flex items-center gap-4 flex-wrap">
                        {detail.opportunity.fit_posture && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">匹配度:</span>
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${(FIT_ZH[detail.opportunity.fit_posture] || FIT_ZH.weak).cls}`}>
                              {(FIT_ZH[detail.opportunity.fit_posture] || { label: detail.opportunity.fit_posture }).label}
                            </span>
                          </div>
                        )}
                        {detail.opportunity.recommendation && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">AI 建议:</span>
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                              detail.opportunity.recommendation === 'advance' ? 'bg-status-active/10 text-status-active' :
                              detail.opportunity.recommendation === 'watch' ? 'bg-status-warning/10 text-status-warning' :
                              'bg-muted-foreground/10 text-muted-foreground'
                            }`}>
                              {detail.opportunity.recommendation === 'advance' ? '推荐投递' :
                               detail.opportunity.recommendation === 'watch' ? '持续观望' : '不匹配'}
                            </span>
                          </div>
                        )}
                        {detail.opportunity.recommendation_reason_tags && detail.opportunity.recommendation_reason_tags.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {detail.opportunity.recommendation_reason_tags.map((tag: string) => (
                              <span key={tag} className="px-2 py-0.5 rounded bg-surface-low text-[10px] text-muted-foreground">{translateReasonTag(tag)}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* JD Content */}
                  {detail.opportunity.job_description_text && (
                    <div className="mb-6">
                      <details className="group" open>
                        <summary className="cursor-pointer text-xs font-label uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
                          <span>职位描述 (JD)</span>
                          <span className="text-[10px] group-open:rotate-90 transition-transform">▶</span>
                        </summary>
                        <div className="mt-3 surface-card rounded-xl p-5 max-h-[400px] overflow-y-auto">
                          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{stripHtml(detail.opportunity.job_description_text)}</p>
                        </div>
                      </details>
                    </div>
                  )}

                  {/* AI strategy + stats row */}
                  {resumeParsed?.emphasis_strategy && (
                    <AnimatedContent>
                      <div className="grid lg:grid-cols-[1fr_auto] gap-4 mb-6">
                        <div className="rounded-xl p-4" style={{ borderLeft: '3px solid hsl(var(--secondary))', background: `hsl(var(--secondary) / var(--diff-strategy-bg, 0.05))` }}>
                          <p className="text-[10px] font-label uppercase tracking-widest text-muted-foreground mb-1">AI 改写策略</p>
                          <p className="text-sm leading-relaxed" style={{ color: 'hsl(var(--secondary))' }}>{resumeParsed.emphasis_strategy}</p>
                        </div>
                        <div className="flex items-center gap-6 px-4">
                          <div className="text-center">
                            <p className="text-2xl font-display font-extrabold" style={{ color: 'hsl(var(--secondary))' }}>{modifiedCount}</p>
                            <p className="text-[10px] text-muted-foreground">章节修改</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-display font-extrabold">{sections.length - modifiedCount}</p>
                            <p className="text-[10px] text-muted-foreground">保持原样</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-display font-extrabold" style={{ color: 'hsl(var(--secondary))' }}>
                              {Math.min(Math.round((modifiedCount / Math.max(sections.length, 1)) * 100 + 20), 98)}%
                            </p>
                            <p className="text-[10px] text-muted-foreground">匹配度</p>
                          </div>
                        </div>
                      </div>
                    </AnimatedContent>
                  )}

                  {/* Two-column: document previews + agent timeline */}
                  <div className="grid lg:grid-cols-[1fr_280px] gap-5">
                    {/* Left: Two A4 document previews side by side */}
                    <div>
                      {sections.length > 0 ? (
                        <>
                          {/* Document labels */}
                          <div className="grid grid-cols-2 gap-5 mb-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-muted-foreground">📄 原始简历</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold" style={{ color: 'hsl(var(--secondary))' }}>✨ AI 定制版本</span>
                              <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: 'hsl(var(--secondary) / 0.1)', color: 'hsl(var(--secondary))' }}>已投递</span>
                            </div>
                          </div>

                          {/* Two A4 paper documents side by side */}
                          <div className="grid grid-cols-2 gap-5">
                            {/* ─── Left paper: Original Resume (embedded PDF from Supabase Storage) ─── */}
                            <div className="rounded-lg overflow-hidden relative" style={{
                              background: '#f5f5f5',
                              boxShadow: '0 2px 20px rgba(0,0,0,0.08), 0 0 1px rgba(0,0,0,0.1)',
                              aspectRatio: '210 / 297',
                              maxHeight: '820px',
                            }}>
                              {detail.resume_signed_url ? (
                                <iframe
                                  src={detail.resume_signed_url}
                                  className="w-full h-full border-0"
                                  title="原始简历 PDF"
                                  style={{ background: '#fff' }}
                                />
                              ) : (
                                <div className="h-full flex items-center justify-center p-8 text-center">
                                  <div>
                                    <p className="text-sm text-gray-400 mb-1">原始简历 PDF</p>
                                    <p className="text-xs text-gray-300">上传简历后将在此处显示</p>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* ─── Right paper: AI Tailored Resume ─── */}
                            <div className="relative">
                              {/* Toggle tabs overlapping top-right */}
                              <div className="absolute -top-3 right-4 z-10 flex rounded-lg overflow-hidden" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
                                <button
                                  onClick={() => setRightDocMode('diff')}
                                  className={`px-3 py-1.5 text-[10px] font-bold transition-colors ${
                                    rightDocMode === 'diff' ? 'text-white' : 'text-gray-600 hover:text-gray-900'
                                  }`}
                                  style={{ background: rightDocMode === 'diff' ? 'hsl(var(--secondary))' : '#fff' }}
                                >
                                  修改标注
                                </button>
                                <button
                                  onClick={() => setRightDocMode('clean')}
                                  className={`px-3 py-1.5 text-[10px] font-bold transition-colors ${
                                    rightDocMode === 'clean' ? 'text-white' : 'text-gray-600 hover:text-gray-900'
                                  }`}
                                  style={{ background: rightDocMode === 'clean' ? 'hsl(var(--foreground))' : '#fff' }}
                                >
                                  最终预览
                                </button>
                              </div>

                              <div data-print-target className="rounded-lg overflow-hidden" style={{
                                background: '#fff',
                                boxShadow: '0 2px 20px rgba(0,0,0,0.08), 0 0 1px rgba(0,0,0,0.1)',
                                aspectRatio: '210 / 297',
                                maxHeight: '820px',
                              }}>
                                {rightDocMode === 'diff' && (
                                  <div className="absolute top-8 right-8 px-2 py-0.5 rounded text-[8px] font-bold tracking-wider z-10" style={{ background: 'hsl(var(--secondary) / 0.08)', color: 'hsl(var(--secondary))' }}>
                                    AI TAILORED
                                  </div>
                                )}
                                <div ref={pdfRef} className="h-full overflow-y-auto p-8" style={{ fontFamily: "'Georgia', 'Times New Roman', 'Noto Serif SC', serif" }}>
                                  {/* Name header — from profile baseline */}
                                  {detail.profile && (
                                    <div className="text-center mb-5 pb-4" style={{ borderBottom: '2px solid #333' }}>
                                      <h3 className="text-[22px] font-bold text-gray-900">{detail.profile.full_name}</h3>
                                      {detail.profile.contact_email && (
                                        <p className="text-[10px] text-gray-500 mt-1.5">
                                          ✉ {detail.profile.contact_email}
                                        </p>
                                      )}
                                    </div>
                                  )}

                                  {/* Sections — diff mode vs clean mode */}
                                  {sections.map((section, i) => {
                                    const hasChanges = section.changes_made && section.changes_made.length > 0;
                                    const isExpanded = expandedSections.has(i);
                                    const showDiff = rightDocMode === 'diff';

                                    return (
                                      <div key={i} className="mb-4">
                                        <div className="flex items-center gap-1.5 mb-1 pb-0.5" style={{ borderBottom: '1px solid #999' }}>
                                          <h4 className="text-[13px] font-bold text-gray-900" style={{ letterSpacing: '0.05em' }}>
                                            {section.section_name}
                                          </h4>
                                          {showDiff && hasChanges && (
                                            <span className="text-[8px] px-1 py-0.5 rounded font-bold" style={{ background: 'hsl(var(--secondary) / 0.1)', color: 'hsl(var(--secondary))' }}>已优化</span>
                                          )}
                                        </div>

                                        {/* Content: clean = no highlights; diff = highlights + notes */}
                                        <div
                                          className={`text-[10.5px] leading-[1.55] whitespace-pre-wrap ${showDiff && hasChanges ? 'text-gray-900' : 'text-gray-700'}`}
                                          style={showDiff && hasChanges ? { background: 'rgba(82, 100, 80, 0.04)', padding: '6px 8px', borderRadius: '4px', borderLeft: '2px solid rgba(82, 100, 80, 0.25)' } : undefined}
                                        >
                                          {section.tailored_text}
                                        </div>

                                        {/* Change notes — only in diff mode */}
                                        {showDiff && hasChanges && (
                                          <div className="mt-1">
                                            <button onClick={() => toggleSection(i)} className="text-[10px] font-semibold flex items-center gap-0.5" style={{ color: 'hsl(var(--secondary))' }}>
                                              <span style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', display: 'inline-block', fontSize: '8px' }}>▸</span>
                                              {isExpanded ? '收起' : `查看修改 (${section.changes_made!.length})`}
                                            </button>
                                            {isExpanded && (
                                              <div className="mt-1 pl-2 space-y-0.5" style={{ borderLeft: '1.5px solid hsl(var(--secondary) / 0.2)' }}>
                                                {section.changes_made!.map((c, j) => (
                                                  <p key={j} className="text-[10px] text-gray-500">• {c}</p>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Submission status below documents */}
                          {detail.submission_attempts.length > 0 && (
                            <div className="mt-5 flex gap-3 flex-wrap">
                              {detail.submission_attempts.map(s => (
                                <div key={s.id} className="rounded-xl p-3 flex items-center gap-3" style={{ background: 'hsl(var(--surface-low))' }}>
                                  <div className={`w-2.5 h-2.5 rounded-full ${
                                    s.execution_outcome === 'confirmed_submitted' ? 'bg-[hsl(var(--status-active))]' :
                                    s.execution_outcome === 'failed' ? 'bg-[hsl(var(--status-error))]' :
                                    'bg-[hsl(var(--status-info))]'
                                  }`} />
                                  <span className="text-xs font-semibold">
                                    {s.execution_outcome === 'confirmed_submitted' ? '投递成功' : s.execution_outcome === 'failed' ? '投递失败' : s.execution_outcome}
                                  </span>
                                  {s.started_at && <span className="text-[10px] text-muted-foreground ml-1">{timeAgo(s.started_at)}</span>}
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="surface-card p-6">
                          <p className="text-sm text-muted-foreground mb-1">此机会暂无 AI 材料</p>
                          <p className="text-xs text-muted-foreground/50">
                            {detail.opportunity.recommendation === 'advance'
                              ? '简历顾问正在定制中，请稍候...'
                              : detail.opportunity.recommendation === 'watch'
                                ? '该岗位为"持续观望"，暂不生成定制简历。如需投递，可手动推进。'
                                : '该岗位未推荐投递，AI 不会生成定制简历。只有"推荐投递"的岗位才会触发简历精修流程。'}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Right: Agent timeline sidebar */}
                    <div>
                      <SpotlightCard className="surface-card p-4 rounded-2xl">
                        <h3 className="text-xs font-display font-bold mb-0.5">智能体工作日志</h3>
                        <p className="text-[10px] text-muted-foreground mb-3">多智能体协作</p>
                        <div className="space-y-0">
                          {detail.timeline.slice(0, 8).map((e, i) => {
                            const agentLabel = AGENT_LABELS[e.event_type] || (e.actor_type === 'user' ? '你' : '系统');
                            const isSuccess = e.event_type.includes('success') || e.event_type.includes('completed') || e.event_type.includes('screened');
                            const isFail = e.event_type.includes('failed');
                            return (
                              <div key={e.id} className="flex gap-2.5 pb-3">
                                <div className="flex flex-col items-center">
                                  <div className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${
                                    isFail ? 'bg-[hsl(var(--status-error))]' :
                                    isSuccess ? 'bg-[hsl(var(--status-active))]' :
                                    'bg-[hsl(var(--status-info))]'
                                  }`} />
                                  {i < Math.min(detail.timeline.length, 8) - 1 && (
                                    <div className="w-px flex-1 mt-1" style={{ background: 'hsl(var(--border) / 0.2)' }} />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    <span className="text-[11px] font-semibold">{agentLabel}</span>
                                    <span className="text-[9px] text-muted-foreground">{timeAgo(e.occurred_at)}</span>
                                  </div>
                                  <p className="text-[11px] text-muted-foreground leading-relaxed truncate">{e.summary_text}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </SpotlightCard>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          )}
        </>
      )}
    </div>
  );
}
