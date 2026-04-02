'use client';

import { useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { AnimatedContent } from '@/components/ui/animated-content';

type UploadState = 'idle' | 'uploading' | 'done' | 'error';

export default function ResumePage() {
  const [state, setState] = useState<UploadState>('idle');
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();
  const supabase = createClient();

  const handleUpload = useCallback(async (file: File) => {
    setFileName(file.name);
    setState('uploading');
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError('未登录'); setState('error'); return; }
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/onboarding-resume`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });
      if (!res.ok) { const j = await res.json(); setError(j.error?.message || '上传失败'); setState('error'); return; }
      setState('done');
      setTimeout(() => router.push('/questions'), 1000);
    } catch { setError('网络错误'); setState('error'); }
  }, [supabase, router]);

  return (
    <AnimatedContent>
      <div className="space-y-6">
        <div>
          <p className="text-xs font-label uppercase tracking-widest text-muted-foreground mb-2">第 1 步 / 共 3 步</p>
          <h2 className="text-2xl font-display font-bold">上传你的简历</h2>
          <p className="text-sm text-muted-foreground mt-1">支持 PDF、DOC、DOCX，最大 10MB</p>
        </div>

        <div
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleUpload(f); }}
          onDragOver={(e) => e.preventDefault()}
          className="surface-card flex flex-col items-center justify-center rounded-2xl p-12 text-center cursor-pointer hover:shadow-lifted transition-shadow"
        >
          {state === 'idle' && (
            <>
              <div className="w-16 h-16 rounded-2xl bg-surface-low flex items-center justify-center text-2xl mb-4">📄</div>
              <p className="text-sm text-muted-foreground mb-3">拖拽简历到这里，或</p>
              <label className="px-6 py-2.5 bg-foreground text-background rounded-xl text-sm font-semibold cursor-pointer hover:opacity-90">
                浏览文件
                <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
              </label>
            </>
          )}
          {state === 'uploading' && (
            <div className="space-y-3">
              <div className="w-48 h-2 bg-surface-low rounded-full overflow-hidden"><div className="h-full w-2/3 bg-secondary rounded-full animate-pulse" /></div>
              <p className="text-sm text-muted-foreground">正在上传 {fileName}...</p>
            </div>
          )}
          {state === 'done' && (
            <div className="space-y-2">
              <div className="text-3xl">✓</div>
              <p className="text-sm font-semibold text-status-active">简历上传成功</p>
              <p className="text-xs text-muted-foreground">{fileName}</p>
            </div>
          )}
          {state === 'error' && (
            <div className="space-y-3">
              <p className="text-sm text-destructive">{error}</p>
              <label className="text-sm text-secondary underline cursor-pointer">
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
