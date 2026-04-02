'use client';

import { useState, useEffect, useCallback } from 'react';

type TypingTextProps = {
  phrases: string[];
  typingSpeed?: number;
  deletingSpeed?: number;
  pauseDuration?: number;
  className?: string;
  cursorClassName?: string;
};

export function TypingText({
  phrases,
  typingSpeed = 80,
  deletingSpeed = 40,
  pauseDuration = 2000,
  className = '',
  cursorClassName = '',
}: TypingTextProps) {
  const [displayText, setDisplayText] = useState('');
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) {
      const timer = setTimeout(() => {
        setIsPaused(false);
        setIsDeleting(true);
      }, pauseDuration);
      return () => clearTimeout(timer);
    }

    const currentPhrase = phrases[phraseIndex];

    if (!isDeleting) {
      if (displayText.length < currentPhrase.length) {
        const timer = setTimeout(() => {
          setDisplayText(currentPhrase.slice(0, displayText.length + 1));
        }, typingSpeed);
        return () => clearTimeout(timer);
      } else {
        if (phraseIndex < phrases.length - 1) {
          setIsPaused(true);
        }
        // Last phrase stays
      }
    } else {
      if (displayText.length > 0) {
        const timer = setTimeout(() => {
          setDisplayText(displayText.slice(0, -1));
        }, deletingSpeed);
        return () => clearTimeout(timer);
      } else {
        setIsDeleting(false);
        setPhraseIndex((prev) => (prev + 1) % phrases.length);
      }
    }
  }, [displayText, isDeleting, isPaused, phraseIndex, phrases, typingSpeed, deletingSpeed, pauseDuration]);

  return (
    <span className={className}>
      {displayText}
      <span className={`inline-block w-[2px] h-[1em] ml-1 align-middle animate-pulse ${cursorClassName || 'bg-foreground'}`} />
    </span>
  );
}
