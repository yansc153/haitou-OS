'use client';

import { useState } from 'react';
import { motion } from 'motion/react';

type CardFlipProps = {
  front: React.ReactNode;
  back: React.ReactNode;
  className?: string;
  flipOnHover?: boolean;
};

export function CardFlip({ front, back, className = '', flipOnHover = false }: CardFlipProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div
      className={`relative [perspective:1200px] ${className}`}
      onClick={() => !flipOnHover && setIsFlipped(!isFlipped)}
      onMouseEnter={() => flipOnHover && setIsFlipped(true)}
      onMouseLeave={() => flipOnHover && setIsFlipped(false)}
    >
      <motion.div
        className="relative w-full h-full [transform-style:preserve-3d]"
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      >
        {/* Front */}
        <div className="absolute inset-0 [backface-visibility:hidden]">
          {front}
        </div>
        {/* Back */}
        <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
          {back}
        </div>
      </motion.div>
    </div>
  );
}
