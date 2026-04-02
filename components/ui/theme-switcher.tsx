'use client';

import { useState, useEffect, createContext, useContext } from 'react';

/**
 * 6 Theme Modes inspired by theme-switch.pages.dev
 * Night · Moonlight · Day · Sunny · Rainy · Snowy
 *
 * Each mode sets CSS custom properties on <html> with smooth 400ms transitions.
 */

export type ThemeMode = 'night' | 'moonlight' | 'day' | 'sunny' | 'rainy' | 'snowy';

const THEMES: Record<ThemeMode, {
  label: string;
  dotColor: string;
  vars: Record<string, string>;
}> = {
  night: {
    label: '夜间',
    dotColor: '#555555',
    vars: {
      '--background': '0 0% 3%',
      '--surface-low': '0 0% 7%',
      '--surface-lowest': '0 0% 10%',
      '--foreground': '0 0% 85%',
      '--card': '0 0% 10%',
      '--card-foreground': '0 0% 85%',
      '--primary': '0 0% 85%',
      '--primary-foreground': '0 0% 5%',
      '--secondary': '210 15% 50%',
      '--secondary-foreground': '0 0% 95%',
      '--muted': '0 0% 12%',
      '--muted-foreground': '0 0% 55%',
      '--accent': '37 60% 40%',
      '--accent-foreground': '0 0% 95%',
      '--border': '0 0% 15%',
      '--input': '0 0% 15%',
      '--ring': '210 15% 50%',
      '--status-active': '142 71% 45%',
      '--status-warning': '38 92% 50%',
      '--status-error': '0 84% 60%',
      '--status-info': '221 83% 53%',
    },
  },
  moonlight: {
    label: '月光',
    dotColor: '#7a8fa6',
    vars: {
      '--background': '220 15% 8%',
      '--surface-low': '220 12% 12%',
      '--surface-lowest': '220 10% 16%',
      '--foreground': '220 10% 80%',
      '--card': '220 10% 14%',
      '--card-foreground': '220 10% 80%',
      '--primary': '220 10% 80%',
      '--primary-foreground': '220 15% 8%',
      '--secondary': '210 20% 45%',
      '--secondary-foreground': '0 0% 95%',
      '--muted': '220 10% 16%',
      '--muted-foreground': '220 8% 50%',
      '--accent': '210 25% 55%',
      '--accent-foreground': '0 0% 95%',
      '--border': '220 10% 18%',
      '--input': '220 10% 18%',
      '--ring': '210 20% 45%',
      '--status-active': '142 71% 45%',
      '--status-warning': '38 92% 50%',
      '--status-error': '0 84% 60%',
      '--status-info': '221 83% 53%',
    },
  },
  day: {
    label: '日间',
    dotColor: '#8b7355',
    vars: {
      '--background': '40 33% 98%',
      '--surface-low': '43 20% 95%',
      '--surface-lowest': '0 0% 100%',
      '--foreground': '72 6% 18%',
      '--card': '0 0% 100%',
      '--card-foreground': '72 6% 18%',
      '--primary': '0 2% 37%',
      '--primary-foreground': '0 0% 100%',
      '--secondary': '115 10% 35%',
      '--secondary-foreground': '0 0% 100%',
      '--muted': '43 20% 95%',
      '--muted-foreground': '0 0% 45%',
      '--accent': '37 74% 28%',
      '--accent-foreground': '0 0% 100%',
      '--border': '40 12% 88%',
      '--input': '40 12% 90%',
      '--ring': '115 10% 35%',
      '--status-active': '142 71% 45%',
      '--status-warning': '38 92% 50%',
      '--status-error': '0 84% 60%',
      '--status-info': '221 83% 53%',
    },
  },
  sunny: {
    label: '晴天',
    dotColor: '#5a8a3c',
    vars: {
      '--background': '80 25% 96%',
      '--surface-low': '75 20% 92%',
      '--surface-lowest': '0 0% 100%',
      '--foreground': '80 10% 15%',
      '--card': '0 0% 100%',
      '--card-foreground': '80 10% 15%',
      '--primary': '80 10% 15%',
      '--primary-foreground': '80 25% 96%',
      '--secondary': '115 30% 38%',
      '--secondary-foreground': '0 0% 100%',
      '--muted': '75 15% 92%',
      '--muted-foreground': '80 5% 45%',
      '--accent': '45 70% 45%',
      '--accent-foreground': '0 0% 100%',
      '--border': '75 15% 86%',
      '--input': '75 15% 88%',
      '--ring': '115 30% 38%',
      '--status-active': '142 71% 45%',
      '--status-warning': '38 92% 50%',
      '--status-error': '0 84% 60%',
      '--status-info': '221 83% 53%',
    },
  },
  rainy: {
    label: '雨天',
    dotColor: '#5a6570',
    vars: {
      '--background': '210 10% 32%',
      '--surface-low': '210 8% 36%',
      '--surface-lowest': '210 8% 40%',
      '--foreground': '210 10% 90%',
      '--card': '210 8% 38%',
      '--card-foreground': '210 10% 90%',
      '--primary': '210 10% 90%',
      '--primary-foreground': '210 10% 25%',
      '--secondary': '210 15% 60%',
      '--secondary-foreground': '0 0% 100%',
      '--muted': '210 8% 38%',
      '--muted-foreground': '210 8% 62%',
      '--accent': '210 15% 70%',
      '--accent-foreground': '210 10% 20%',
      '--border': '210 8% 42%',
      '--input': '210 8% 42%',
      '--ring': '210 15% 60%',
      '--status-active': '142 50% 55%',
      '--status-warning': '38 70% 55%',
      '--status-error': '0 65% 60%',
      '--status-info': '210 50% 65%',
    },
  },
  snowy: {
    label: '雪天',
    dotColor: '#a0aec0',
    vars: {
      '--background': '215 25% 88%',
      '--surface-low': '215 20% 84%',
      '--surface-lowest': '215 15% 92%',
      '--foreground': '215 30% 18%',
      '--card': '215 15% 92%',
      '--card-foreground': '215 30% 18%',
      '--primary': '215 30% 18%',
      '--primary-foreground': '215 25% 90%',
      '--secondary': '215 20% 35%',
      '--secondary-foreground': '0 0% 100%',
      '--muted': '215 15% 84%',
      '--muted-foreground': '215 10% 45%',
      '--accent': '215 25% 30%',
      '--accent-foreground': '215 25% 90%',
      '--border': '215 15% 78%',
      '--input': '215 15% 80%',
      '--ring': '215 20% 35%',
      '--status-active': '142 50% 40%',
      '--status-warning': '38 70% 45%',
      '--status-error': '0 65% 55%',
      '--status-info': '215 40% 50%',
    },
  },
};

const MODES: ThemeMode[] = ['night', 'moonlight', 'day', 'sunny', 'rainy', 'snowy'];

type ThemeContextType = { mode: ThemeMode; setMode: (m: ThemeMode) => void };
const ThemeContext = createContext<ThemeContextType>({ mode: 'day', setMode: () => {} });
export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children, defaultMode = 'day' }: { children: React.ReactNode; defaultMode?: ThemeMode }) {
  const [mode, setModeState] = useState<ThemeMode>(defaultMode);

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    localStorage.setItem('haitou-theme', m);
    applyTheme(m);
  };

  useEffect(() => {
    const saved = localStorage.getItem('haitou-theme') as ThemeMode | null;
    if (saved && THEMES[saved]) {
      setModeState(saved);
      applyTheme(saved);
    } else {
      applyTheme(defaultMode);
    }
  }, [defaultMode]);

  return (
    <ThemeContext.Provider value={{ mode, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

function applyTheme(mode: ThemeMode) {
  const theme = THEMES[mode];
  if (!theme) return;
  const root = document.documentElement;
  Object.entries(theme.vars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}

/**
 * Theme Switcher — slide-out drawer from right edge
 * Small floating trigger dot on every page → slides out a panel with 6 modes + audio toggle
 */
export function ThemeSwitcher() {
  const { mode, setMode } = useTheme();
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState(false);

  const handleMute = async () => {
    const { setAudioEnabled, playAmbientForMode } = await import('@/lib/ambient-audio');
    const newState = !muted;
    setMuted(newState);
    setAudioEnabled(!newState);
    if (!newState) playAmbientForMode(mode);
  };

  const handleSetMode = async (m: ThemeMode) => {
    setMode(m);
    if (!muted) {
      const { playAmbientForMode } = await import('@/lib/ambient-audio');
      playAmbientForMode(m);
    }
  };

  return (
    <>
      {/* Trigger dot — bottom-right corner, always visible on all pages */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-[200] w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 shadow-lg"
        style={{ background: THEMES[mode].dotColor }}
        title={`主题: ${THEMES[mode].label} — 点击切换`}
      >
        <div className="w-3 h-3 rounded-full bg-white/50" />
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-[300] bg-black/20 backdrop-blur-sm transition-opacity"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Slide-out drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-[320px] z-[400] transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ background: 'hsl(var(--background))' }}
      >
        <div className="h-full flex flex-col p-8 overflow-y-auto border-l" style={{ borderColor: 'hsl(var(--border))' }}>
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-lg font-display font-bold" style={{ color: 'hsl(var(--foreground))' }}>主题模式</h2>
              <p className="text-sm mt-0.5" style={{ color: 'hsl(var(--muted-foreground))' }}>选择界面风格和环境音效</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:opacity-70 transition-opacity text-sm"
              style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--foreground))' }}
            >
              ✕
            </button>
          </div>

          {/* Mode cards */}
          <div className="space-y-3 flex-1">
            {MODES.map((m) => {
              const theme = THEMES[m];
              const isActive = mode === m;
              return (
                <button
                  key={m}
                  onClick={() => handleSetMode(m)}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-all duration-200 ${
                    isActive ? 'shadow-lg scale-[1.02]' : 'hover:scale-[1.01]'
                  }`}
                  style={{
                    background: isActive ? theme.dotColor : 'hsl(var(--muted))',
                    color: isActive ? '#fff' : 'hsl(var(--foreground))',
                  }}
                >
                  {/* Dot */}
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: isActive ? 'rgba(255,255,255,0.25)' : theme.dotColor }}
                  >
                    {isActive && <div className="w-3 h-3 rounded-full bg-white" />}
                  </div>

                  {/* Label */}
                  <div>
                    <div className="text-sm font-bold">{theme.label}</div>
                    <div className="text-xs opacity-70">
                      {m === 'night' && '深色 · 虫鸣'}
                      {m === 'moonlight' && '深蓝 · 静夜'}
                      {m === 'day' && '暖白 · 静音'}
                      {m === 'sunny' && '明亮 · 自然'}
                      {m === 'rainy' && '灰蓝 · 雨声'}
                      {m === 'snowy' && '冷蓝 · 风雪'}
                    </div>
                  </div>

                  {/* Active indicator */}
                  {isActive && (
                    <div className="ml-auto text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full">
                      当前
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Audio control */}
          <div className="mt-6 pt-6" style={{ borderTop: '1px solid hsl(var(--border))' }}>
            <button
              onClick={handleMute}
              className="w-full flex items-center justify-between p-4 rounded-2xl transition-all"
              style={{ background: 'hsl(var(--muted))' }}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">{muted ? '🔇' : '🔊'}</span>
                <div className="text-left">
                  <div className="text-sm font-bold" style={{ color: 'hsl(var(--foreground))' }}>环境音效</div>
                  <div className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
                    {muted ? '已静音' : '已开启 — 切换主题自动播放'}
                  </div>
                </div>
              </div>
              <div className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-colors ${muted ? 'bg-gray-300' : 'bg-green-500'}`}>
                <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${muted ? '' : 'translate-x-4'}`} />
              </div>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
