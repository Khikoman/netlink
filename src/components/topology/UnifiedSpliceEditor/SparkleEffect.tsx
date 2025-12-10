"use client";

import { memo, useEffect, useMemo, useState } from "react";

export interface SparkleEffectProps {
  x: number;
  y: number;
  colorA: string;
  colorB: string;
  particleCount?: number;
  duration?: number;
  onComplete?: () => void;
}

interface Particle {
  id: number;
  angle: number;
  distance: number;
  color: string;
  size: number;
  delay: number;
}

// Generate particles deterministically from props
function generateParticles(colorA: string, colorB: string, count: number): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    // Use deterministic values based on index for visual variety
    const randomAngleOffset = ((i * 17) % 30) - 15;
    const randomDistance = 20 + ((i * 23) % 30);
    const randomSize = 3 + ((i * 13) % 4);
    const randomDelay = (i * 7) % 50;

    particles.push({
      id: i,
      angle: (360 / count) * i + randomAngleOffset,
      distance: randomDistance,
      color: i % 2 === 0 ? colorA : colorB,
      size: randomSize,
      delay: randomDelay,
    });
  }
  return particles;
}

export const SparkleEffect = memo(function SparkleEffect({
  x,
  y,
  colorA,
  colorB,
  particleCount = 12,
  duration = 400,
  onComplete,
}: SparkleEffectProps) {
  const [isAnimating, setIsAnimating] = useState(true);

  // Generate particles once using useMemo (not in effect)
  const particles = useMemo(
    () => generateParticles(colorA, colorB, particleCount),
    [colorA, colorB, particleCount]
  );

  useEffect(() => {
    // Clean up after animation
    const timer = setTimeout(() => {
      setIsAnimating(false);
      onComplete?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onComplete]);

  if (!isAnimating) return null;

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: x,
        top: y,
        transform: "translate(-50%, -50%)",
      }}
    >
      {/* Central flash */}
      <div
        className="absolute w-8 h-8 rounded-full -translate-x-1/2 -translate-y-1/2"
        style={{
          background: `radial-gradient(circle, white 0%, ${colorA} 30%, ${colorB} 60%, transparent 80%)`,
          animation: `sparkle-flash ${duration}ms ease-out forwards`,
        }}
      />

      {/* Particles */}
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute rounded-full -translate-x-1/2 -translate-y-1/2"
          style={{
            width: particle.size,
            height: particle.size,
            backgroundColor: particle.color,
            boxShadow: `0 0 ${particle.size * 2}px ${particle.color}`,
            animation: `sparkle-burst ${duration}ms ease-out ${particle.delay}ms forwards`,
            "--angle": `${particle.angle}deg`,
            "--distance": `${particle.distance}px`,
          } as React.CSSProperties}
        />
      ))}

      {/* Inline keyframes for animations */}
      <style jsx>{`
        @keyframes sparkle-flash {
          0% {
            transform: translate(-50%, -50%) scale(0);
            opacity: 1;
          }
          50% {
            transform: translate(-50%, -50%) scale(1.5);
            opacity: 0.8;
          }
          100% {
            transform: translate(-50%, -50%) scale(2);
            opacity: 0;
          }
        }

        @keyframes sparkle-burst {
          0% {
            transform: translate(-50%, -50%) rotate(var(--angle)) translateX(0);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) rotate(var(--angle)) translateX(var(--distance));
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
});

export default SparkleEffect;
