'use client';

const STEPS = [
  { label: '简历上传', path: '/resume' },
  { label: '基本信息', path: '/setup' },
  { label: '安装插件', path: '/extension' },
  { label: '启动团队', path: '/activation' },
] as const;

export function OnboardingProgressBar({ currentStep }: { currentStep: 1 | 2 | 3 | 4 }) {
  return (
    <div className="w-full max-w-2xl mx-auto py-6 px-4">
      <div className="flex items-center justify-between">
        {STEPS.map((step, i) => {
          const stepNum = (i + 1) as 1 | 2 | 3 | 4;
          const isCompleted = currentStep > stepNum;
          const isCurrent = currentStep === stepNum;
          const isFuture = currentStep < stepNum;

          return (
            <div key={step.path} className="flex items-center flex-1 last:flex-none">
              {/* Step circle + label */}
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                    isCompleted
                      ? 'bg-secondary text-white'
                      : isCurrent
                        ? 'bg-foreground text-background ring-2 ring-secondary/40 ring-offset-2 ring-offset-background'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isCompleted ? '✓' : stepNum}
                </div>
                <span
                  className={`text-[10px] font-label uppercase tracking-wider whitespace-nowrap ${
                    isFuture ? 'text-muted-foreground/50' : 'text-foreground'
                  }`}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector line */}
              {i < STEPS.length - 1 && (
                <div className="flex-1 mx-3 mt-[-18px]">
                  <div
                    className={`h-[2px] w-full transition-colors duration-300 ${
                      isCompleted ? 'bg-secondary' : 'bg-border/30'
                    }`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function getStepFromPath(pathname: string): 1 | 2 | 3 | 4 {
  if (pathname.includes('/setup')) return 2;
  if (pathname.includes('/extension')) return 3;
  if (pathname.includes('/activation')) return 4;
  return 1;
}
