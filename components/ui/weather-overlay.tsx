'use client';

import { useTheme } from './theme-switcher';
import { useMemo } from 'react';

export function WeatherOverlay() {
  const { mode } = useTheme();
  return (
    <div className="fixed inset-0 pointer-events-none z-[50]" aria-hidden="true">
      {mode === 'rainy' && <RainOverlay />}
      {mode === 'snowy' && <SnowOverlay />}
      {mode === 'moonlight' && <StarsOverlay />}
      {mode === 'night' && <DustOverlay />}
    </div>
  );
}

function RainOverlay() {
  const particles = useMemo(() =>
    Array.from({ length: 100 }).map((_, i) => ({
      id: i, left: Math.random() * 100, top: -10 - Math.random() * 20,
      width: 1 + Math.random() * 1.2, height: 14 + Math.random() * 24,
      duration: 0.35 + Math.random() * 0.35, delay: Math.random() * 2,
    })), []);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {particles.map(p => (
        <div key={p.id} className="absolute rounded-full" style={{
          left: `${p.left}%`, top: `${p.top}%`, width: `${p.width}px`, height: `${p.height}px`,
          background: 'rgba(180, 210, 240, 0.45)',
          animation: `rainDrop ${p.duration}s linear infinite`, animationDelay: `${p.delay}s`,
        }} />
      ))}
      <style>{`@keyframes rainDrop { 0% { transform: translateY(-30px); opacity: 0; } 8% { opacity: 0.7; } 85% { opacity: 0.5; } 100% { transform: translateY(110vh); opacity: 0; } }`}</style>
    </div>
  );
}

function SnowOverlay() {
  const particles = useMemo(() =>
    Array.from({ length: 70 }).map((_, i) => ({
      id: i, left: Math.random() * 100, size: 3 + Math.random() * 7,
      duration: 5 + Math.random() * 7, delay: Math.random() * 6,
      drift: (Math.random() - 0.5) * 80,
      // P3-05 fix: darker flakes visible on light snowy bg
      color: (3 + Math.random() * 7) > 6 ? 'rgba(160, 185, 215, 0.75)' : 'rgba(100, 120, 150, 0.4)',
    })), []);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {particles.map(p => (
        <div key={p.id} className="absolute rounded-full" style={{
          left: `${p.left}%`, top: '-3%', width: `${p.size}px`, height: `${p.size}px`,
          background: p.color,
          boxShadow: p.size > 6 ? '0 0 4px rgba(180,200,220,0.3)' : 'none',
          // P1-04 fix: shared keyframe with per-particle drift via CSS custom property
          animation: `snowFall ${p.duration}s linear infinite`, animationDelay: `${p.delay}s`,
          // @ts-ignore
          '--drift': `${p.drift}px`, '--drift-mid': `${p.drift * 0.6}px`,
        } as React.CSSProperties} />
      ))}
      <style>{`@keyframes snowFall { 0% { transform: translateY(-10px) translateX(0); opacity: 0; } 10% { opacity: 1; } 50% { transform: translateY(50vh) translateX(var(--drift-mid, 20px)); } 85% { opacity: 0.7; } 100% { transform: translateY(110vh) translateX(var(--drift, 40px)); opacity: 0; } }`}</style>
    </div>
  );
}

function StarsOverlay() {
  // P1-03 fix: all random values computed inside useMemo, not in render
  const stars = useMemo(() =>
    Array.from({ length: 60 }).map((_, i) => {
      const warm = Math.random() > 0.5;
      return {
        id: i, left: Math.random() * 100, top: Math.random() * 100,
        size: 1 + Math.random() * 2.5, duration: 2 + Math.random() * 4,
        delay: Math.random() * 4, warm,
        opacity: warm ? 0.5 + Math.random() * 0.4 : 0.4 + Math.random() * 0.4,
      };
    }), []);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {stars.map(s => (
        <div key={s.id} className="absolute rounded-full" style={{
          left: `${s.left}%`, top: `${s.top}%`, width: `${s.size}px`, height: `${s.size}px`,
          background: s.warm ? `rgba(255, 240, 200, ${s.opacity})` : `rgba(200, 220, 255, ${s.opacity})`,
          boxShadow: s.size > 2 ? `0 0 ${s.size * 2}px rgba(255,250,220,0.3)` : 'none',
          animation: `starTwinkle ${s.duration}s ease-in-out infinite`, animationDelay: `${s.delay}s`,
        }} />
      ))}
      <style>{`@keyframes starTwinkle { 0%, 100% { opacity: 0.15; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.2); } }`}</style>
    </div>
  );
}

function DustOverlay() {
  const particles = useMemo(() =>
    Array.from({ length: 25 }).map((_, i) => ({
      id: i, left: Math.random() * 100, top: Math.random() * 100,
      size: 1 + Math.random() * 1.5, duration: 8 + Math.random() * 12, delay: Math.random() * 8,
    })), []);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {particles.map(p => (
        <div key={p.id} className="absolute rounded-full" style={{
          left: `${p.left}%`, top: `${p.top}%`, width: `${p.size}px`, height: `${p.size}px`,
          background: 'rgba(255, 255, 255, 0.15)',
          animation: `dustFloat ${p.duration}s ease-in-out infinite`, animationDelay: `${p.delay}s`,
        }} />
      ))}
      <style>{`@keyframes dustFloat { 0%, 100% { transform: translateY(0) translateX(0); opacity: 0.1; } 25% { transform: translateY(-20px) translateX(10px); opacity: 0.25; } 50% { transform: translateY(-10px) translateX(-15px); opacity: 0.15; } 75% { transform: translateY(-30px) translateX(5px); opacity: 0.2; } }`}</style>
    </div>
  );
}
