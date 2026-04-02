'use client';

import { motion } from 'motion/react';
import { useEffect, useState } from 'react';

type AnimatedContentProps = {
  children: React.ReactNode;
  direction?: 'up' | 'down' | 'left' | 'right';
  distance?: number;
  delay?: number;
  duration?: number;
  className?: string;
};

export function AnimatedContent({
  children,
  direction = 'up',
  distance = 12,
  delay = 0,
  duration = 0.4,
  className = '',
}: AnimatedContentProps) {
  // Start visible immediately (SSR-safe), animate on mount
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) {
    // SSR / pre-hydration: render children visible, no animation
    return <div className={className}>{children}</div>;
  }

  const directionMap = {
    up: { y: distance },
    down: { y: -distance },
    left: { x: distance },
    right: { x: -distance },
  };

  return (
    <motion.div
      initial={{ opacity: 0.3, ...directionMap[direction] }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
