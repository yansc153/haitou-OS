'use client';

import { useState } from 'react';

type Material = {
  id: string;
  material_type: string;
  status: string;
  language: string;
  content_text?: string | null;
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
  interest_statement?: string;
  value_proposition?: string;
  closing?: string;
  subject_line?: string;
};

const TYPE_LABELS: Record<string, string> = {
  standard_tailored_resume: '定制简历',
  cover_letter: '求职信',
  light_edit_resume: '轻编辑简历',
  deep_tailored_resume: '深度定制简历',
  first_contact_draft: '初次联系草稿',
  follow_up_draft: '跟进草稿',
};

function tryParseJson(text: string): unknown {
  try { return JSON.parse(text); } catch { return null; }
}

function ResumePreview({ data }: { data: ResumeOutput }) {
  return (
    <div className="space-y-6">
      {data.emphasis_strategy && (
        <div className="rounded-xl bg-secondary/5 p-4 text-sm text-secondary">
          <span className="font-bold">改写策略：</span>{data.emphasis_strategy}
        </div>
      )}
      {data.tailored_sections?.map((section, i) => (
        <div key={i} className="space-y-2">
          <h4 className="text-sm font-bold text-foreground">{section.section_name}</h4>
          <div className="rounded-xl bg-surface-low p-4">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{section.tailored_text}</p>
          </div>
          {section.changes_made && section.changes_made.length > 0 && (
            <div className="pl-4 border-l-2 border-secondary/20 space-y-1">
              {section.changes_made.map((c, j) => (
                <p key={j} className="text-xs text-muted-foreground">• {c}</p>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function CoverLetterPreview({ data }: { data: CoverLetterOutput }) {
  if (data.full_text) {
    return <p className="text-sm leading-relaxed whitespace-pre-wrap">{data.full_text}</p>;
  }
  return (
    <div className="space-y-4">
      {data.subject_line && <p className="text-sm font-bold">主题：{data.subject_line}</p>}
      {data.opening && <p className="text-sm leading-relaxed">{data.opening}</p>}
      {data.interest_statement && <p className="text-sm leading-relaxed">{data.interest_statement}</p>}
      {data.value_proposition && <p className="text-sm leading-relaxed">{data.value_proposition}</p>}
      {data.closing && <p className="text-sm leading-relaxed">{data.closing}</p>}
    </div>
  );
}

export function MaterialPreviewDrawer({ material, onClose }: { material: Material; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const typeLabel = TYPE_LABELS[material.material_type] || material.material_type;

  // Parse content
  const parsed = material.content_text ? tryParseJson(material.content_text) : null;
  const isResume = material.material_type.includes('resume');
  const isCoverLetter = material.material_type === 'cover_letter';

  // Build copyable text
  const getCopyText = (): string => {
    if (!parsed) return material.content_text || '';
    if (isResume) {
      const r = parsed as ResumeOutput;
      return (r.tailored_sections || []).map(s => `## ${s.section_name}\n${s.tailored_text}`).join('\n\n');
    }
    if (isCoverLetter) {
      const c = parsed as CoverLetterOutput;
      return c.full_text || [c.opening, c.interest_statement, c.value_proposition, c.closing].filter(Boolean).join('\n\n');
    }
    return material.content_text || '';
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(getCopyText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable (unfocused window, insecure context)
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-[560px] bg-background shadow-2xl z-[60] flex flex-col border-l border-border/20">
      {/* Header */}
      <div className="flex items-center justify-between p-6 pb-4 border-b border-border/10">
        <div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm mb-2 flex items-center gap-1">← 返回详情</button>
          <h3 className="text-lg font-bold">{typeLabel}</h3>
          <p className="text-xs text-muted-foreground">{material.language} · {material.status} · {new Date(material.created_at).toLocaleDateString('zh-CN')}</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {!material.content_text ? (
          <div className="text-center py-12 text-muted-foreground text-sm">材料内容暂不可用</div>
        ) : !parsed ? (
          // Raw text fallback
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{material.content_text}</p>
        ) : isResume ? (
          <ResumePreview data={parsed as ResumeOutput} />
        ) : isCoverLetter ? (
          <CoverLetterPreview data={parsed as CoverLetterOutput} />
        ) : (
          <pre className="text-sm leading-relaxed whitespace-pre-wrap">{JSON.stringify(parsed, null, 2)}</pre>
        )}
      </div>

      {/* Footer */}
      {material.content_text && (
        <div className="p-4 border-t border-border/10">
          <button
            onClick={handleCopy}
            className="w-full py-2.5 rounded-xl text-sm font-semibold transition-colors bg-foreground text-background hover:bg-foreground/90"
          >
            {copied ? '已复制' : '复制全文'}
          </button>
        </div>
      )}
    </div>
  );
}
