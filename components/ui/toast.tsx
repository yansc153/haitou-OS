'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

type ToastItem = {
  id: number;
  type: ToastType;
  message: string;
};

type ToastContextValue = {
  toast: (type: ToastType, message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const typeConfig: Record<ToastType, { bar: string; icon: string }> = {
  success: { bar: 'bg-status-active', icon: '✓' },
  error: { bar: 'bg-status-error', icon: '✕' },
  warning: { bar: 'bg-status-warning', icon: '!' },
  info: { bar: 'bg-status-info', icon: 'i' },
};

function Toast({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    // Trigger slide-in on next frame
    requestAnimationFrame(() => setVisible(true));
    timerRef.current = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDismiss(item.id), 200);
    }, 4000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [item.id, onDismiss]);

  const cfg = typeConfig[item.type];

  return (
    <div
      className={`surface-card shadow-lifted rounded-xl p-4 flex items-center gap-3 min-w-[280px] max-w-[400px] transition-all duration-200 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
      }`}
    >
      <div className={`w-1 self-stretch rounded-full ${cfg.bar}`} />
      <span className="text-xs font-semibold w-5 h-5 flex items-center justify-center rounded-full bg-muted">
        {cfg.icon}
      </span>
      <p className="text-sm text-foreground flex-1">{item.message}</p>
      <button
        onClick={() => {
          setVisible(false);
          setTimeout(() => onDismiss(item.id), 200);
        }}
        className="text-muted-foreground hover:text-foreground text-xs ml-2"
      >
        ✕
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const toast = useCallback((type: ToastType, message: string) => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((item) => (
          <Toast key={item.id} item={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast 必须在 ToastProvider 内使用');
  }
  return ctx;
}
