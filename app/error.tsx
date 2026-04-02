'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <h1 className="text-4xl font-display font-extrabold mb-4">出错了</h1>
        <p className="text-base text-muted-foreground mb-6">
          页面加载时发生错误。请尝试刷新页面。
        </p>
        <p className="text-xs text-muted-foreground/40 mb-8 font-mono">
          {error.message}
        </p>
        <button
          onClick={reset}
          className="px-8 py-3 bg-foreground text-background rounded-xl text-sm font-bold hover:opacity-90 transition-opacity"
        >
          重试
        </button>
      </div>
    </div>
  );
}
