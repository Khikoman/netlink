"use client";

import { useState, useCallback, useEffect, useRef } from "react";

interface Position {
  x: number;
  y: number;
}

interface UseDraggablePanelOptions {
  storageKey: string;
  defaultPosition?: Position;
}

interface UseDraggablePanelReturn {
  position: Position;
  isDragging: boolean;
  handleMouseDown: (e: React.MouseEvent) => void;
  panelRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Shared hook for draggable floating panels.
 * Handles position persistence, drag logic, and global mouse event listeners.
 *
 * Usage:
 * ```tsx
 * const { position, isDragging, handleMouseDown, panelRef } = useDraggablePanel({
 *   storageKey: "netlink:myPanelPosition",
 *   defaultPosition: { x: 20, y: 100 }
 * });
 *
 * return (
 *   <div
 *     ref={panelRef}
 *     style={{ left: position.x, top: position.y }}
 *     onMouseDown={handleMouseDown}
 *     className={isDragging ? "cursor-grabbing" : "cursor-grab"}
 *   >
 *     <button data-no-drag>Click me</button> // Won't trigger drag
 *   </div>
 * );
 * ```
 */
export function useDraggablePanel({
  storageKey,
  defaultPosition = { x: 20, y: 100 },
}: UseDraggablePanelOptions): UseDraggablePanelReturn {
  // Initialize position from localStorage with lazy initializer
  const [position, setPosition] = useState<Position>(() => {
    if (typeof window === "undefined") return defaultPosition;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return defaultPosition;
      }
    }
    return defaultPosition;
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  // Save position to localStorage
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(position));
  }, [position, storageKey]);

  // Handle panel dragging start
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Don't drag if clicking on elements with data-no-drag attribute
      if ((e.target as HTMLElement).closest("[data-no-drag]")) return;
      setIsDragging(true);
      dragOffset.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      };
    },
    [position]
  );

  // Handle mouse movement during drag
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      const newX = Math.max(0, e.clientX - dragOffset.current.x);
      const newY = Math.max(0, e.clientY - dragOffset.current.y);
      setPosition({ x: newX, y: newY });
    },
    [isDragging]
  );

  // Handle mouse release
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Attach global mouse event listeners during drag
  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return {
    position,
    isDragging,
    handleMouseDown,
    panelRef,
  };
}
