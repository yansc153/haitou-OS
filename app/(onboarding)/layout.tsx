export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      {/* Top nav — matches app shell style */}
      <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-md">
        <div className="px-10 h-14 flex items-center justify-between">
          <span className="text-xl font-display font-extrabold tracking-tight">海投 OS</span>
          <div className="flex items-center gap-4">
            <span className="text-xs text-muted-foreground font-label uppercase tracking-wider">配置中</span>
          </div>
        </div>
        <div className="h-px bg-border/20" />
      </header>

      {/* Full-width content */}
      <main className="px-10 py-8 max-w-[1400px] mx-auto">
        {children}
      </main>
    </div>
  );
}
