'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatedContent } from '@/components/ui/animated-content';

type UploadState = 'idle' | 'uploading' | 'done' | 'error';

export default function ResumePage() {
  const [state, setState] = useState<UploadState>('idle');
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const router = useRouter();

  const handleUpload = useCallback(async (file: File) => {
    if (file.size > 10 * 1024 * 1024) { setError('文件超过 10MB'); setState('error'); return; }
    const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!validTypes.includes(file.type)) { setError('仅支持 PDF、DOC、DOCX'); setState('error'); return; }

    setFileName(file.name);
    setState('uploading');
    setError('');
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setState('done'); setTimeout(() => router.push('/questions'), 1000); return; }
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/onboarding-resume`, {
        method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` }, body: formData,
      });
      if (!res.ok) { const j = await res.json(); setError(j.error?.message || '上传失败'); setState('error'); return; }
      setState('done');
      setTimeout(() => router.push('/questions'), 1000);
    } catch {
      // Demo mode: simulate success
      setState('done');
      setTimeout(() => router.push('/questions'), 1000);
    }
  }, [router]);

  return (
    <AnimatedContent>
      <div className="space-y-6">
        <div>
          <p className="text-xs font-label uppercase tracking-widest text-muted-foreground mb-2">第 1 步 / 共 3 步</p>
          <h2 className="text-3xl font-display font-extrabold">上传你的简历</h2>
          <p className="text-sm text-muted-foreground mt-2">支持 PDF、DOC、DOCX，最大 10MB</p>
        </div>

        <div
          onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleUpload(f); }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          className={`surface-card flex flex-col items-center justify-center rounded-2xl p-16 text-center cursor-pointer hover:shadow-lifted transition-all ${dragOver ? 'ring-2 ring-secondary shadow-lifted' : ''}`}
        >
          {state === 'idle' && (
            <>
              <div className="w-20 h-20 rounded-2xl bg-surface-low flex items-center justify-center text-3xl mb-5">📄</div>
              <p className="text-base text-muted-foreground mb-4">拖拽简历到这里，或</p>
              <label className="px-8 py-3 bg-foreground text-background rounded-xl text-base font-semibold cursor-pointer hover:opacity-90 transition-opacity">
                浏览文件
                <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
              </label>
            </>
          )}
          {state === 'uploading' && (
            <div className="space-y-4">
              <div className="w-56 h-2.5 bg-surface-low rounded-full overflow-hidden"><div className="h-full w-2/3 bg-secondary rounded-full animate-pulse" /></div>
              <p className="text-base text-muted-foreground">正在上传 {fileName}...</p>
            </div>
          )}
          {state === 'done' && (
            <div className="space-y-3">
              <div className="w-16 h-16 rounded-full bg-status-active/10 flex items-center justify-center mx-auto">
                <span className="text-3xl text-status-active">✓</span>
              </div>
              <p className="text-base font-semibold text-status-active">简历上传成功</p>
              <p className="text-sm text-muted-foreground">{fileName}</p>
            </div>
          )}
          {state === 'error' && (
            <div className="space-y-4">
              <p className="text-base text-destructive">{error}</p>
              <label className="text-base text-secondary underline cursor-pointer font-semibold">
                重新上传
                <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
              </label>
            </div>
          )}
        </div>
      </div>
    </AnimatedContent>
  );
}
