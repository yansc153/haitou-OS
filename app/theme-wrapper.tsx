'use client';

import { ThemeProvider, ThemeSwitcher } from '@/components/ui/theme-switcher';
import { WeatherOverlay } from '@/components/ui/weather-overlay';

export function ThemeWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider defaultMode="day">
      <WeatherOverlay />
      <ThemeSwitcher />
      {children}
    </ThemeProvider>
  );
}
