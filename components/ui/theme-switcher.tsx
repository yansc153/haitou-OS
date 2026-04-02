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
 * Floating theme switcher — 6 dots in a vertical pill
 */
export function ThemeSwitcher() {
  const { mode, setMode } = useTheme();
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState(false);

  const handleMute = async () => {
    const { setAudioEnabled, isAudioEnabled, playAmbientForMode } = await import('@/lib/ambient-audio');
    const newState = !muted;
    setMuted(newState);
    setAudioEnabled(!newState);
    if (!newState) playAmbientForMode(mode);
  };

  const handleSetMode = async (m: ThemeMode) => {
    setMode(m);
    setOpen(false);
    if (!muted) {
      const { playAmbientForMode } = await import('@/lib/ambient-audio');
      playAmbientForMode(m);
    }
  };

  return (
    <div className="fixed left-5 top-1/2 -translate-y-1/2 z-[100] flex flex-col items-center gap-3">
      {/* Main toggle */}
      <button
        onClick={() => setOpen(!open)}
        className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 shadow-lg"
        style={{ background: THEMES[mode].dotColor }}
        title={`当前主题: ${THEMES[mode].label}`}
      >
        <div className="w-3 h-3 rounded-full bg-white/50" />
      </button>

      {/* Expanded dots */}
      {open && (
        <div className="flex flex-col gap-2.5 p-2.5 rounded-2xl backdrop-blur-xl shadow-xl border border-white/10"
          style={{ background: 'rgba(128,128,128,0.15)' }}
        >
          {MODES.map((m) => (
            <button
              key={m}
              onClick={() => handleSetMode(m)}
              className={`group relative w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-125 ${
                mode === m ? 'ring-2 ring-white/60 scale-110' : ''
              }`}
              style={{ background: THEMES[m].dotColor }}
              title={THEMES[m].label}
            >
              {mode === m && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
              <span className="absolute left-11 px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg"
                style={{ background: THEMES[m].dotColor, color: '#fff' }}
              >
                {THEMES[m].label}
              </span>
            </button>
          ))}

          {/* Mute toggle */}
          <button
            onClick={handleMute}
            className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all duration-200 hover:scale-110 text-xs ${
              muted ? 'border-white/10 opacity-40' : 'border-white/20'
            }`}
            title={muted ? '开启声音' : '静音'}
          >
            {muted ? '🔇' : '♫'}
          </button>
        </div>
      )}
    </div>
  );
}
