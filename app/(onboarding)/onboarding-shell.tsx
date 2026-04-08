'use client';

import { usePathname } from 'next/navigation';
import { OnboardingProgressBar, getStepFromPath } from '@/components/onboarding/progress-bar';

export function OnboardingShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const currentStep = getStepFromPath(pathname);

  return (
    <>
      <OnboardingProgressBar currentStep={currentStep} />
      {children}
    </>
  );
}
