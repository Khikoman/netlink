"use client";

import { memo, useState, useCallback, useMemo } from "react";
import {
  EdgeProps,
  getBezierPath,
  EdgeLabelRenderer,
  BaseEdge,
} from "reactflow";
import { Cable, ChevronDown, ChevronUp, Zap } from "lucide-react";
import { FIBER_COLORS } from "@/lib/fiberColors";

interface FiberConnection {
  fiberA: number;
  fiberB: number;
  colorA: string;
  colorB: string;
  status?: "completed" | "pending" | "failed";
}

interface FiberEdgeData {
  label?: string;
  fiberCount?: number;
  connections?: FiberConnection[];
  sourceColor?: string;
  targetColor?: string;
  animated?: boolean;
  cable?: {
    name: string;
    fiberCount: number;
    role?: string;
  };
}

// Get hex color from color name
function getColorHex(colorName: string): string {
  const color = FIBER_COLORS.find(
    (c) => c.name.toLowerCase() === colorName.toLowerCase()
  );
  return color?.hex || "#9ca3af";
}

// Gradient ID generator
function getGradientId(sourceColor: string, targetColor: string, id: string): string {
  return `gradient-${id}-${sourceColor.replace("#", "")}-${targetColor.replace("#", "")}`;
}

function FiberEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
  markerEnd,
  selected,
}: EdgeProps<FiberEdgeData>) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Calculate path
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // Get colors for gradient (default if not provided)
  const sourceColor = data?.sourceColor || "#a855f7"; // purple
  const targetColor = data?.targetColor || "#f97316"; // orange
  const gradientId = getGradientId(sourceColor, targetColor, id);

  // Determine if this edge has fiber connection data
  const hasFiberData = data?.connections && data.connections.length > 0;
  const fiberCount = data?.fiberCount || data?.connections?.length || 0;

  // Toggle expansion
  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  }, [isExpanded]);

  // Calculate connection summary
  const connectionStats = useMemo(() => {
    if (!data?.connections) return { completed: 0, pending: 0, failed: 0 };
    return data.connections.reduce(
      (acc, conn) => {
        const status = conn.status || "completed";
        acc[status]++;
        return acc;
      },
      { completed: 0, pending: 0, failed: 0 }
    );
  }, [data?.connections]);

  return (
    <>
      {/* SVG Definitions for gradients and filters */}
      <svg style={{ position: "absolute", width: 0, height: 0 }}>
        <defs>
          {/* Gradient from source to target color */}
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={sourceColor} />
            <stop offset="100%" stopColor={targetColor} />
          </linearGradient>

          {/* Glow filter */}
          <filter id={`glow-${id}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Animated glow filter */}
          <filter id={`glow-animated-${id}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="coloredBlur">
              <animate
                attributeName="stdDeviation"
                values="2;5;2"
                dur="2s"
                repeatCount="indefinite"
              />
            </feGaussianBlur>
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>

      {/* Main edge path with gradient and glow */}
      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        style={{
          ...style,
          stroke: `url(#${gradientId})`,
          strokeWidth: selected ? 4 : 3,
          filter: data?.animated ? `url(#glow-animated-${id})` : `url(#glow-${id})`,
          transition: "stroke-width 0.2s ease",
        }}
        markerEnd={markerEnd}
      />

      {/* Animated flow indicator for active connections */}
      {data?.animated && (
        <circle r="4" fill={sourceColor}>
          <animateMotion dur="2s" repeatCount="indefinite" path={edgePath} />
        </circle>
      )}

      {/* Edge label with fiber info */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "all",
          }}
          className="nodrag nopan"
        >
          {/* Collapsed view - cable summary */}
          {!isExpanded ? (
            <button
              onClick={handleToggle}
              className={`
                flex items-center gap-1.5 px-2 py-1 rounded-full
                bg-white border shadow-md text-xs font-medium
                hover:shadow-lg transition-all
                ${selected ? "ring-2 ring-blue-500" : ""}
              `}
            >
              <Cable className="w-3 h-3 text-gray-500" />
              <span className="text-gray-700">
                {data?.cable?.name || `${fiberCount}F`}
              </span>
              {hasFiberData && (
                <ChevronDown className="w-3 h-3 text-gray-400" />
              )}
            </button>
          ) : (
            /* Expanded view - fiber details */
            <div
              className={`
                bg-white rounded-lg border shadow-xl p-2 min-w-[180px]
                ${selected ? "ring-2 ring-blue-500" : ""}
              `}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-2 pb-2 border-b">
                <div className="flex items-center gap-1.5">
                  <Cable className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-xs font-semibold text-gray-700">
                    {data?.cable?.name || "Cable"}
                  </span>
                </div>
                <button
                  onClick={handleToggle}
                  className="p-0.5 hover:bg-gray-100 rounded"
                >
                  <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
                </button>
              </div>

              {/* Stats row */}
              <div className="flex items-center gap-3 text-[10px] mb-2">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-gray-600">
                    {connectionStats.completed} done
                  </span>
                </div>
                {connectionStats.pending > 0 && (
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-yellow-500" />
                    <span className="text-gray-600">
                      {connectionStats.pending} pending
                    </span>
                  </div>
                )}
              </div>

              {/* Fiber connections list */}
              <div className="space-y-1 max-h-[150px] overflow-y-auto">
                {data?.connections?.slice(0, 12).map((conn, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-1.5 px-1.5 py-1 rounded bg-gray-50 text-[10px]"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-white shadow"
                      style={{ backgroundColor: getColorHex(conn.colorA) }}
                    />
                    <span className="text-gray-400">F{conn.fiberA}</span>
                    <Zap className="w-2.5 h-2.5 text-gray-300" />
                    <span className="text-gray-400">F{conn.fiberB}</span>
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-white shadow"
                      style={{ backgroundColor: getColorHex(conn.colorB) }}
                    />
                    {conn.status === "pending" && (
                      <span className="ml-auto text-yellow-600">pending</span>
                    )}
                  </div>
                ))}
                {data?.connections && data.connections.length > 12 && (
                  <div className="text-[10px] text-gray-400 text-center py-1">
                    +{data.connections.length - 12} more fibers
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const FiberEdge = memo(FiberEdgeComponent);

// Edge types registry
export const fiberEdgeTypes = {
  fiber: FiberEdge,
};
