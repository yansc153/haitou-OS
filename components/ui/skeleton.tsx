'use client';

type SkeletonVariant = 'text' | 'card' | 'avatar' | 'line';

type SkeletonProps = {
  className?: string;
  variant?: SkeletonVariant;
};

const variantStyles: Record<SkeletonVariant, string> = {
  text: 'h-4 w-3/4 rounded bg-muted animate-pulse',
  card: 'h-[200px] w-full rounded-2xl bg-muted animate-pulse',
  avatar: 'h-12 w-12 rounded-full bg-muted animate-pulse',
  line: 'h-3 w-full rounded bg-muted animate-pulse',
};

export function Skeleton({ className = '', variant = 'text' }: SkeletonProps) {
  return <div className={`${variantStyles[variant]} ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="flex items-start gap-3 p-4">
      <Skeleton variant="avatar" />
      <div className="flex-1 space-y-2">
        <Skeleton variant="line" className="w-2/3" />
        <Skeleton variant="line" className="w-full" />
        <Skeleton variant="line" className="w-1/2" />
      </div>
    </div>
  );
}
