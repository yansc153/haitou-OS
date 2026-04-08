import { OnboardingShell } from './onboarding-shell';

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-md">
        <div className="px-10 h-14 flex items-center justify-between">
          <span className="text-xl font-display font-extrabold tracking-tight">海投 OS</span>
          <div className="flex items-center gap-4">
            <span className="text-xs text-muted-foreground font-label uppercase tracking-wider">配置中</span>
          </div>
        </div>
      </header>

      <OnboardingShell>
        <main className="px-10 py-4 max-w-[1400px] mx-auto">
          {children}
        </main>
      </OnboardingShell>
    </div>
  );
}
