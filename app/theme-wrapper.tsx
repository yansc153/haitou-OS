'use client';

import { ThemeProvider, ThemeSwitcher } from '@/components/ui/theme-switcher';

export function ThemeWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider defaultMode="day">
      <ThemeSwitcher />
      {children}
    </ThemeProvider>
  );
}
