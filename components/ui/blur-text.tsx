'use client';

import { motion } from 'motion/react';
import { useEffect, useState, useMemo } from 'react';

type BlurTextProps = {
  text: string;
  delay?: number;
  className?: string;
  animateBy?: 'words' | 'letters';
};

export function BlurText({
  text,
  delay = 100,
  className = '',
  animateBy = 'words',
}: BlurTextProps) {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setInView(true), 200);
    return () => clearTimeout(timer);
  }, []);

  const elements = useMemo(() => {
    return animateBy === 'words' ? text.split(' ') : text.split('');
  }, [text, animateBy]);

  return (
    <span className={className}>
      {elements.map((el, i) => (
        <motion.span
          key={`${el}-${i}`}
          initial={{ opacity: 0, filter: 'blur(12px)', y: 8 }}
          animate={inView ? { opacity: 1, filter: 'blur(0px)', y: 0 } : {}}
          transition={{
            duration: 0.5,
            delay: i * (delay / 1000),
            ease: [0.25, 0.1, 0.25, 1],
          }}
          style={{ display: 'inline-block' }}
        >
          {el}
          {animateBy === 'words' && i < elements.length - 1 ? '\u00A0' : ''}
        </motion.span>
      ))}
    </span>
  );
}
