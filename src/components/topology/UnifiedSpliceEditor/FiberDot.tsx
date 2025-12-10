"use client";

import { memo, forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface FiberDotProps {
  fiberNumber: number;
  color: string;
  textColor?: string;
  isSelected?: boolean;
  isConnected?: boolean;
  isHovered?: boolean;
  connectionStatus?: "completed" | "pending" | "needs-review" | "failed";
  size?: "sm" | "md" | "lg";
  onClick?: (fiberNumber: number) => void;
  onMouseEnter?: (fiberNumber: number) => void;
  onMouseLeave?: () => void;
  onDragStart?: (fiberNumber: number, e: React.DragEvent) => void;
  onDragEnd?: () => void;
  draggable?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: "w-5 h-5 text-[10px]",
  md: "w-6 h-6 text-xs",
  lg: "w-8 h-8 text-sm",
};

const statusRingColors = {
  completed: "ring-green-500",
  pending: "ring-amber-500",
  "needs-review": "ring-blue-500",
  failed: "ring-red-500",
};

export const FiberDot = memo(
  forwardRef<HTMLButtonElement, FiberDotProps>(
    (
      {
        fiberNumber,
        color,
        textColor = "#FFFFFF",
        isSelected = false,
        isConnected = false,
        isHovered = false,
        connectionStatus,
        size = "md",
        onClick,
        onMouseEnter,
        onMouseLeave,
        onDragStart,
        onDragEnd,
        draggable = true,
        className,
      },
      ref
    ) => {
      const handleClick = () => onClick?.(fiberNumber);
      const handleMouseEnter = () => onMouseEnter?.(fiberNumber);
      const handleDragStart = (e: React.DragEvent) => onDragStart?.(fiberNumber, e);

      return (
        <button
          ref={ref}
          type="button"
          className={cn(
            // Base styles
            "rounded-full font-semibold transition-all duration-150",
            "flex items-center justify-center cursor-pointer select-none",
            "border-2 border-white/30 shadow-sm",
            sizeClasses[size],
            // Selection/hover states
            isSelected && "ring-2 ring-offset-1 ring-yellow-400 scale-110 z-10",
            isHovered && !isSelected && "scale-105 brightness-110",
            // Connected state with status ring
            isConnected && connectionStatus && [
              "ring-2 ring-offset-1",
              statusRingColors[connectionStatus],
            ],
            // Pulse animation for pending
            connectionStatus === "pending" && "animate-pulse",
            // Draggable styling
            draggable && "active:scale-95 hover:shadow-md",
            className
          )}
          style={{
            backgroundColor: color,
            color: textColor,
          }}
          onClick={handleClick}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={onMouseLeave}
          draggable={draggable}
          onDragStart={handleDragStart}
          onDragEnd={onDragEnd}
          title={`Fiber ${fiberNumber}`}
        >
          {fiberNumber}
        </button>
      );
    }
  )
);

FiberDot.displayName = "FiberDot";

export default FiberDot;
