"use client";

import { memo } from "react";

export interface ConnectionLineProps {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  colorA: string;
  colorB: string;
  status: "completed" | "pending" | "needs-review" | "failed";
  isHighlighted?: boolean;
  animated?: boolean;
}

const statusStyles = {
  completed: {
    opacity: 0.9,
    strokeWidth: 2,
    dashArray: undefined,
  },
  pending: {
    opacity: 0.7,
    strokeWidth: 2,
    dashArray: "8,4",
  },
  "needs-review": {
    opacity: 0.8,
    strokeWidth: 2.5,
    dashArray: "4,4",
  },
  failed: {
    opacity: 0.6,
    strokeWidth: 2,
    dashArray: "2,4",
  },
};

export const ConnectionLine = memo(function ConnectionLine({
  id,
  x1,
  y1,
  x2,
  y2,
  colorA,
  colorB,
  status,
  isHighlighted = false,
  animated = true,
}: ConnectionLineProps) {
  const gradientId = `gradient-${id}`;
  const style = statusStyles[status];

  // Calculate control points for a smooth bezier curve
  const dx = Math.abs(x2 - x1);
  const controlOffset = Math.min(dx * 0.4, 100);

  const path = `M ${x1} ${y1} C ${x1 + controlOffset} ${y1}, ${x2 - controlOffset} ${y2}, ${x2} ${y2}`;

  return (
    <g className="connection-line">
      {/* Gradient definition */}
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={colorA} />
          <stop offset="100%" stopColor={colorB} />
        </linearGradient>

        {/* Animated flow marker */}
        {animated && status === "completed" && (
          <circle id={`flow-marker-${id}`} r="3" fill="white">
            <animate
              attributeName="opacity"
              values="0.3;1;0.3"
              dur="1.5s"
              repeatCount="indefinite"
            />
          </circle>
        )}
      </defs>

      {/* Glow effect for highlighted */}
      {isHighlighted && (
        <path
          d={path}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={style.strokeWidth + 4}
          strokeLinecap="round"
          opacity={0.3}
          className="blur-sm"
        />
      )}

      {/* Main connection line */}
      <path
        d={path}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={style.strokeWidth}
        strokeLinecap="round"
        strokeDasharray={style.dashArray}
        opacity={style.opacity}
        className={animated && status === "pending" ? "animate-dash" : ""}
      />

      {/* Animated flow dot for completed connections */}
      {animated && status === "completed" && (
        <circle r="2.5" fill="white" opacity={0.8}>
          <animateMotion dur="2s" repeatCount="indefinite" path={path}>
            <mpath xlinkHref={`#${gradientId}`} />
          </animateMotion>
          <animate
            attributeName="opacity"
            values="0.4;1;0.4"
            dur="2s"
            repeatCount="indefinite"
          />
        </circle>
      )}

      {/* Status indicator dots at endpoints */}
      <circle
        cx={x1}
        cy={y1}
        r="4"
        fill={colorA}
        stroke="white"
        strokeWidth="1.5"
        className={isHighlighted ? "animate-pulse" : ""}
      />
      <circle
        cx={x2}
        cy={y2}
        r="4"
        fill={colorB}
        stroke="white"
        strokeWidth="1.5"
        className={isHighlighted ? "animate-pulse" : ""}
      />
    </g>
  );
});

export default ConnectionLine;
