'use client';

import { useTheme, type ThemeMode } from './theme-switcher';
import { useEffect, useRef } from 'react';

/**
 * Weather visual overlays — CSS + Canvas based
 * Rain drops, snow flakes, stars — rendered as fixed full-screen overlay
 */
export function WeatherOverlay() {
  const { mode } = useTheme();

  return (
    <div className="fixed inset-0 pointer-events-none z-[50]" aria-hidden>
      {mode === 'rainy' && <RainOverlay />}
      {mode === 'snowy' && <SnowOverlay />}
      {mode === 'moonlight' && <StarsOverlay />}
    </div>
  );
}

/** Rain — CSS animated vertical lines */
function RainOverlay() {
  return (
    <div className="absolute inset-0 overflow-hidden opacity-30">
      {Array.from({ length: 80 }).map((_, i) => (
        <div
          key={i}
          className="absolute bg-white/40 rounded-full"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${-10 - Math.random() * 20}%`,
            width: `${1 + Math.random() * 1.5}px`,
            height: `${12 + Math.random() * 20}px`,
            animation: `rainDrop ${0.4 + Math.random() * 0.4}s linear infinite`,
            animationDelay: `${Math.random() * 2}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes rainDrop {
          0% { transform: translateY(-20px); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(110vh); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

/** Snow — CSS animated circles floating down */
function SnowOverlay() {
  return (
    <div className="absolute inset-0 overflow-hidden opacity-50">
      {Array.from({ length: 60 }).map((_, i) => {
        const size = 2 + Math.random() * 6;
        return (
          <div
            key={i}
            className="absolute rounded-full bg-white/60"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${-5 - Math.random() * 10}%`,
              width: `${size}px`,
              height: `${size}px`,
              animation: `snowFall ${4 + Math.random() * 6}s linear infinite`,
              animationDelay: `${Math.random() * 5}s`,
            }}
          />
        );
      })}
      <style>{`
        @keyframes snowFall {
          0% { transform: translateY(-10px) translateX(0px); opacity: 0; }
          10% { opacity: 1; }
          50% { transform: translateY(50vh) translateX(${Math.random() > 0.5 ? '' : '-'}30px); }
          90% { opacity: 0.6; }
          100% { transform: translateY(110vh) translateX(${Math.random() > 0.5 ? '' : '-'}50px); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

/** Stars — CSS twinkling dots */
function StarsOverlay() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {Array.from({ length: 50 }).map((_, i) => {
        const size = 1 + Math.random() * 2;
        return (
          <div
            key={i}
            className="absolute rounded-full bg-white/70"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: `${size}px`,
              height: `${size}px`,
              animation: `starTwinkle ${2 + Math.random() * 3}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 3}s`,
            }}
          />
        );
      })}
      <style>{`
        @keyframes starTwinkle {
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}
