"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import { FiberDot } from "./FiberDot";
import type { FiberLookupResult } from "@/lib/fiberColors";

export interface TubeRowProps {
  tubeNumber: number;
  tubeColor: string;
  tubeTextColor?: string;
  fibers: FiberLookupResult[];
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

export const TubeRow = memo(function TubeRow({
  tubeNumber,
  tubeColor,
  tubeTextColor = "#FFFFFF",
  fibers,
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
}: TubeRowProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 p-2 rounded-lg",
        "bg-slate-800/50 border border-slate-700/50",
        className
      )}
    >
      {/* Tube color indicator */}
      <div
        className={cn(
          "flex-shrink-0 w-16 h-8 rounded flex items-center justify-center",
          "text-xs font-semibold shadow-inner",
          side === "right" && "order-last"
        )}
        style={{
          backgroundColor: tubeColor,
          color: tubeTextColor,
        }}
      >
        Tube {tubeNumber}
      </div>

      {/* Fibers */}
      <div
        className={cn(
          "flex gap-1 flex-wrap",
          side === "right" && "justify-end"
        )}
      >
        {fibers.map((fiber) => {
          const connection = connectedFibers.get(fiber.fiberNumber);
          return (
            <FiberDot
              key={fiber.fiberNumber}
              fiberNumber={fiber.fiberPosition}
              color={fiber.fiberColor.hex}
              textColor={fiber.fiberColor.textColor}
              isSelected={selectedFiber === fiber.fiberNumber}
              isConnected={!!connection}
              connectionStatus={connection?.status}
              isHovered={hoveredFiber === fiber.fiberNumber}
              size={fiberSize}
              onClick={() => onFiberClick?.(fiber.fiberNumber)}
              onMouseEnter={() => onFiberHover?.(fiber.fiberNumber)}
              onMouseLeave={() => onFiberHover?.(null)}
              onDragStart={(_, e) => onFiberDragStart?.(fiber.fiberNumber, e)}
              onDragEnd={onFiberDragEnd}
            />
          );
        })}
      </div>
    </div>
  );
});

export default TubeRow;
