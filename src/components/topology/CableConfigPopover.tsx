"use client";

import React, { useState, useCallback, useRef, useEffect, memo } from "react";
import {
  X,
  GripVertical,
  Cable,
  Save,
} from "lucide-react";
import { CABLE_CONFIGS } from "@/lib/fiberColors";

interface CableConfig {
  name: string;
  fiberCount: number;
  length?: number;
}

interface CableConfigPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  edgeId: string;
  initialConfig: CableConfig;
  onSave: (edgeId: string, config: CableConfig) => void;
}

// Standard fiber counts from TIA-598
const FIBER_COUNT_OPTIONS = CABLE_CONFIGS.map(c => c.count);

export const CableConfigPopover = memo(function CableConfigPopover({
  isOpen,
  onClose,
  edgeId,
  initialConfig,
  onSave,
}: CableConfigPopoverProps) {
  const [position, setPosition] = useState(() => {
    if (typeof window === "undefined") return { x: 300, y: 200 };
    const saved = localStorage.getItem("netlink:cableConfigPosition");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return { x: 300, y: 200 };
      }
    }
    return { x: 300, y: 200 };
  });
  const [isDragging, setIsDragging] = useState(false);
  const [name, setName] = useState(initialConfig.name);
  const [fiberCount, setFiberCount] = useState(initialConfig.fiberCount);
  const [length, setLength] = useState(initialConfig.length || 0);
  const dragOffset = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  // Track previous config to detect prop changes (React-recommended pattern)
  const [prevConfig, setPrevConfig] = useState(initialConfig);

  // Reset form when config changes (during render, not in effect)
  if (initialConfig !== prevConfig) {
    setPrevConfig(initialConfig);
    setName(initialConfig.name);
    setFiberCount(initialConfig.fiberCount);
    setLength(initialConfig.length || 0);
  }

  // Save position to localStorage
  useEffect(() => {
    localStorage.setItem("netlink:cableConfigPosition", JSON.stringify(position));
  }, [position]);

  // Dragging handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-no-drag]")) return;
    setIsDragging(true);
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  }, [position]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: Math.max(0, e.clientX - dragOffset.current.x),
      y: Math.max(0, e.clientY - dragOffset.current.y),
    });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

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

  // Handle save
  const handleSave = useCallback(() => {
    onSave(edgeId, {
      name: name.trim() || initialConfig.name,
      fiberCount,
      length: length > 0 ? length : undefined,
    });
    onClose();
  }, [edgeId, name, fiberCount, length, initialConfig.name, onSave, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      className={`
        fixed z-50 bg-white rounded-xl shadow-2xl border border-gray-200
        transition-all duration-200 select-none w-[320px]
        ${isDragging ? "cursor-grabbing" : "cursor-grab"}
      `}
      style={{
        left: position.x,
        top: position.y,
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-gradient-to-r from-amber-50 to-orange-50 rounded-t-xl">
        <div className="flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-gray-400" />
          <Cable className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-semibold text-gray-700">Cable Properties</span>
        </div>
        <button
          data-no-drag
          onClick={onClose}
          className="p-1 hover:bg-white/50 rounded transition-colors"
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Form */}
      <div className="p-4 space-y-4" data-no-drag>
        {/* Cable Name */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Cable Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter cable name..."
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          />
        </div>

        {/* Fiber Count */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">
            Fiber Count
          </label>
          <div className="grid grid-cols-3 gap-2">
            {FIBER_COUNT_OPTIONS.map((count) => (
              <button
                key={count}
                onClick={() => setFiberCount(count)}
                className={`
                  px-3 py-2 text-sm font-medium rounded-lg border-2 transition-all
                  ${fiberCount === count
                    ? "border-amber-500 bg-amber-50 text-amber-700"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                  }
                `}
              >
                {count}F
              </button>
            ))}
          </div>
        </div>

        {/* Cable Length */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Length (meters)
          </label>
          <input
            type="number"
            value={length || ""}
            onChange={(e) => setLength(parseInt(e.target.value) || 0)}
            placeholder="Optional"
            min={0}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t bg-gray-50 rounded-b-xl flex justify-end gap-2" data-no-drag>
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="px-4 py-2 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors flex items-center gap-1.5"
        >
          <Save className="w-4 h-4" />
          Save
        </button>
      </div>
    </div>
  );
});

export default CableConfigPopover;
