"use client";

import { memo, useMemo } from "react";
import { cn } from "@/lib/utils";
import { TubeRow } from "./TubeRow";
import { getTubeInfo, getFibersInTube } from "@/lib/fiberColors";

export interface CableCrossSectionProps {
  cableName: string;
  fiberCount: number;
  selectedFiber?: number;
  connectedFibers?: Map<number, {
    status: "completed" | "pending" | "needs-review" | "failed";
    pairedFiber?: number;
  }>;
  hoveredFiber?: number;
  onFiberClick?: (fiberNumber: number) => void;
  onFiberHover?: (fiberNumber: number | null) => void;
  onFiberDragStart?: (fiberNumber: number, e: React.DragEvent) => void;
  onFiberDragEnd?: () => void;
  side: "left" | "right";
  fiberSize?: "sm" | "md" | "lg";
  className?: string;
}

export const CableCrossSection = memo(function CableCrossSection({
  cableName,
  fiberCount,
  selectedFiber,
  connectedFibers = new Map(),
  hoveredFiber,
  onFiberClick,
  onFiberHover,
  onFiberDragStart,
  onFiberDragEnd,
  side,
  fiberSize = "md",
  className,
}: CableCrossSectionProps) {
  const tubes = useMemo(() => getTubeInfo(fiberCount), [fiberCount]);

  const tubeData = useMemo(() => {
    return tubes.map(tube => ({
      ...tube,
      fibers: getFibersInTube(tube.tubeNumber, fiberCount),
    }));
  }, [tubes, fiberCount]);

  return (
    <div
      className={cn(
        "flex flex-col gap-2",
        side === "right" && "items-end",
        className
      )}
    >
      {/* Cable header */}
      <div
        className={cn(
          "px-4 py-2 rounded-lg bg-slate-700 border border-slate-600",
          "flex items-center gap-2",
          side === "right" && "flex-row-reverse"
        )}
      >
        <div className="w-3 h-3 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 shadow-inner" />
        <span className="text-sm font-semibold text-slate-200">{cableName}</span>
        <span className="text-xs text-slate-400">({fiberCount}F)</span>
      </div>

      {/* Tube rows */}
      <div className="flex flex-col gap-1 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
        {tubeData.map(tube => (
          <TubeRow
            key={tube.tubeNumber}
            tubeNumber={tube.tubeNumber}
            tubeColor={tube.tubeColor.hex}
            tubeTextColor={tube.tubeColor.textColor}
            fibers={tube.fibers}
            selectedFiber={selectedFiber}
            connectedFibers={connectedFibers}
            hoveredFiber={hoveredFiber}
            onFiberClick={onFiberClick}
            onFiberHover={onFiberHover}
            onFiberDragStart={onFiberDragStart}
            onFiberDragEnd={onFiberDragEnd}
            side={side}
            fiberSize={fiberSize}
          />
        ))}
      </div>
    </div>
  );
});

export default CableCrossSection;
