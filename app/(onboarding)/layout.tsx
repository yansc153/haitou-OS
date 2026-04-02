export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-xl">
        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="text-2xl font-display font-extrabold tracking-tight">海投 OS</h1>
          <p className="mt-1 text-sm text-muted-foreground">组建你的 AI 求职运营团队</p>
        </div>
        {children}
      </div>
    </div>
  );
}
