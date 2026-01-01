"use client";

import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  X,
  Cable,
  Zap,
  Save,
  Trash2,
  Wand2,
  GripVertical,
  ArrowRight,
  Check,
} from "lucide-react";
import { FIBER_COLORS, CABLE_CONFIGS, getFiberInfo } from "@/lib/fiberColors";

interface SpliceConnection {
  sourceIndex: number;
  targetIndex: number;
}

interface UnifiedEdgeEditorProps {
  isOpen: boolean;
  onClose: () => void;
  edgeId: string;
  sourceName: string;
  targetName: string;
  initialFiberCount: number;
  initialCableName: string;
  initialLength?: number;
  initialSplices?: SpliceConnection[];
  onSave: (config: {
    fiberCount: number;
    cableName: string;
    length?: number;
    splices: SpliceConnection[];
  }) => void;
}

// Spark animation component
function SparkEffect({ x, y, onComplete }: { x: number; y: number; onComplete: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 600);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      className="absolute pointer-events-none"
      style={{ left: x - 20, top: y - 20 }}
    >
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          className="absolute w-2 h-2 bg-yellow-400 rounded-full animate-spark"
          style={{
            transform: `rotate(${i * 45}deg) translateY(-15px)`,
            animationDelay: `${i * 30}ms`,
          }}
        />
      ))}
      <div className="absolute w-4 h-4 bg-yellow-300 rounded-full animate-ping" />
    </div>
  );
}

// Fiber dot component
function FiberDot({
  fiberIndex,
  fiberCount,
  isSelected,
  isConnected,
  onClick,
  side,
}: {
  fiberIndex: number;
  fiberCount: number;
  isSelected: boolean;
  isConnected: boolean;
  onClick: (e: React.MouseEvent) => void;
  side: "source" | "target";
}) {
  const fiberInfo = getFiberInfo(fiberIndex + 1, fiberCount);
  const color = fiberInfo?.fiberColor.hex || "#888";
  const textColor = fiberInfo?.fiberColor.textColor || "#fff";

  return (
    <button
      onClick={onClick}
      className={`
        relative w-8 h-8 rounded-full border-2 transition-all duration-200
        flex items-center justify-center text-[10px] font-bold
        ${isSelected ? "ring-2 ring-yellow-400 ring-offset-2 scale-110" : ""}
        ${isConnected ? "border-green-500 shadow-lg" : "border-gray-300"}
        hover:scale-105 hover:shadow-md
      `}
      style={{
        backgroundColor: color,
        color: textColor,
      }}
      title={`Fiber ${fiberIndex + 1} - ${fiberInfo?.fiberColor.name || "Unknown"}`}
    >
      {fiberIndex + 1}
      {isConnected && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full flex items-center justify-center">
          <Check className="w-2 h-2 text-white" />
        </div>
      )}
    </button>
  );
}

export function UnifiedEdgeEditor({
  isOpen,
  onClose,
  edgeId,
  sourceName,
  targetName,
  initialFiberCount,
  initialCableName,
  initialLength,
  initialSplices = [],
  onSave,
}: UnifiedEdgeEditorProps) {
  // Panel state
  const [position, setPosition] = useState(() => {
    if (typeof window === "undefined") return { x: 100, y: 100 };
    return {
      x: Math.max(50, (window.innerWidth - 500) / 2),
      y: Math.max(50, (window.innerHeight - 600) / 2),
    };
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Form state
  const [fiberCount, setFiberCount] = useState(initialFiberCount);
  const [cableName, setCableName] = useState(initialCableName);
  const [length, setLength] = useState(initialLength || 0);
  const [splices, setSplices] = useState<SpliceConnection[]>(initialSplices);

  // Splice UI state
  const [selectedSource, setSelectedSource] = useState<number | null>(null);
  const [sparks, setSparks] = useState<{ id: number; x: number; y: number }[]>([]);
  const sparkIdRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset when props change
  useEffect(() => {
    if (isOpen) {
      setFiberCount(initialFiberCount);
      setCableName(initialCableName);
      setLength(initialLength || 0);
      setSplices(initialSplices);
      setSelectedSource(null);
    }
  }, [isOpen, initialFiberCount, initialCableName, initialLength, initialSplices]);

  // Fiber count options - popular counts plus all standard
  const popularFiberCounts = [2, 4, 6, 8, 12, 24, 48, 72, 96, 144, 288];
  const allFiberCounts = CABLE_CONFIGS.map(c => c.count);
  const [customFiberInput, setCustomFiberInput] = useState("");
  const [showCustomFiber, setShowCustomFiber] = useState(false);

  // Get connected fibers
  const connectedSources = useMemo(() => new Set(splices.map(s => s.sourceIndex)), [splices]);
  const connectedTargets = useMemo(() => new Set(splices.map(s => s.targetIndex)), [splices]);

  // Get connection for a target
  const getSourceForTarget = useCallback((targetIndex: number) => {
    const splice = splices.find(s => s.targetIndex === targetIndex);
    return splice?.sourceIndex ?? null;
  }, [splices]);

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

  // Add spark animation
  const addSpark = useCallback((x: number, y: number) => {
    const id = sparkIdRef.current++;
    setSparks(prev => [...prev, { id, x, y }]);
  }, []);

  const removeSpark = useCallback((id: number) => {
    setSparks(prev => prev.filter(s => s.id !== id));
  }, []);

  // Handle fiber click
  const handleSourceClick = useCallback((index: number) => {
    if (connectedSources.has(index)) {
      // Remove existing connection
      setSplices(prev => prev.filter(s => s.sourceIndex !== index));
      setSelectedSource(null);
    } else {
      setSelectedSource(index);
    }
  }, [connectedSources]);

  const handleTargetClick = useCallback((index: number, e: React.MouseEvent) => {
    if (selectedSource === null) return;

    // Remove existing connection to this target
    const newSplices = splices.filter(s => s.targetIndex !== index);

    // Add new connection
    newSplices.push({ sourceIndex: selectedSource, targetIndex: index });
    setSplices(newSplices);

    // Add spark effect
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (containerRect) {
      addSpark(rect.left - containerRect.left + rect.width / 2, rect.top - containerRect.top + rect.height / 2);
    }

    setSelectedSource(null);
  }, [selectedSource, splices, addSpark]);

  // Auto-match 1:1
  const handleAutoMatch = useCallback(() => {
    const newSplices: SpliceConnection[] = [];
    const count = Math.min(fiberCount, 48); // Limit for performance

    for (let i = 0; i < count; i++) {
      newSplices.push({ sourceIndex: i, targetIndex: i });
    }

    setSplices(newSplices);

    // Add multiple sparks with delay
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (containerRect) {
      newSplices.slice(0, 12).forEach((_, idx) => {
        setTimeout(() => {
          addSpark(350 + Math.random() * 50, 80 + idx * 35 + Math.random() * 10);
        }, idx * 50);
      });
    }
  }, [fiberCount, addSpark]);

  // Clear all splices
  const handleClear = useCallback(() => {
    setSplices([]);
    setSelectedSource(null);
  }, []);

  // Save handler
  const handleSave = useCallback(() => {
    onSave({
      fiberCount,
      cableName: cableName.trim() || initialCableName,
      length: length > 0 ? length : undefined,
      splices,
    });
    onClose();
  }, [fiberCount, cableName, initialCableName, length, splices, onSave, onClose]);

  // Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Show first 24 fibers max for UI (can scroll for more)
  const displayFibers = Math.min(fiberCount, 24);

  return (
    <div
      ref={containerRef}
      className={`
        fixed z-50 bg-white rounded-2xl shadow-2xl border border-gray-200
        transition-shadow duration-200 select-none
        ${isDragging ? "cursor-grabbing shadow-3xl" : "cursor-grab"}
      `}
      style={{
        left: position.x,
        top: position.y,
        width: 500,
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Spark animations */}
      {sparks.map(spark => (
        <SparkEffect
          key={spark.id}
          x={spark.x}
          y={spark.y}
          onComplete={() => removeSpark(spark.id)}
        />
      ))}

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-amber-50 to-orange-50 rounded-t-2xl">
        <div className="flex items-center gap-3">
          <GripVertical className="w-4 h-4 text-gray-400" />
          <Cable className="w-5 h-5 text-amber-500" />
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <span>{sourceName}</span>
            <ArrowRight className="w-4 h-4 text-gray-400" />
            <span>{targetName}</span>
          </div>
        </div>
        <button
          data-no-drag
          onClick={onClose}
          className="p-1.5 hover:bg-white/50 rounded-full transition-colors"
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Cable Properties */}
      <div className="p-4 border-b bg-gray-50" data-no-drag>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Cable Properties
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Fibers</label>
            {!showCustomFiber ? (
              <div className="flex gap-1">
                <select
                  value={popularFiberCounts.includes(fiberCount) ? fiberCount : "custom"}
                  onChange={(e) => {
                    if (e.target.value === "custom") {
                      setShowCustomFiber(true);
                      setCustomFiberInput(String(fiberCount));
                    } else {
                      setFiberCount(Number(e.target.value));
                      setSplices([]); // Reset splices when fiber count changes
                    }
                  }}
                  className="flex-1 px-2 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {popularFiberCounts.map(count => (
                    <option key={count} value={count}>{count}F</option>
                  ))}
                  <option value="custom">Custom...</option>
                </select>
              </div>
            ) : (
              <div className="flex gap-1">
                <input
                  type="number"
                  value={customFiberInput}
                  onChange={(e) => {
                    setCustomFiberInput(e.target.value);
                    const num = parseInt(e.target.value);
                    if (num > 0) {
                      setFiberCount(num);
                      setSplices([]); // Reset splices
                    }
                  }}
                  placeholder="Count"
                  min={1}
                  className="flex-1 px-2 py-2 text-sm border border-amber-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-amber-50"
                />
                <button
                  onClick={() => setShowCustomFiber(false)}
                  className="px-2 text-xs text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
            <input
              type="text"
              value={cableName}
              onChange={(e) => setCableName(e.target.value)}
              placeholder="Cable name..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Length (m)</label>
            <input
              type="number"
              value={length || ""}
              onChange={(e) => setLength(parseInt(e.target.value) || 0)}
              placeholder="Optional"
              min={0}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>
      </div>

      {/* Splice Section */}
      <div className="p-4" data-no-drag>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-500" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Fiber Splices
            </span>
            <span className="text-xs text-gray-400">
              ({splices.length}/{fiberCount} connected)
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAutoMatch}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors"
            >
              <Wand2 className="w-3.5 h-3.5" />
              Auto 1:1
            </button>
            <button
              onClick={handleClear}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </button>
          </div>
        </div>

        {/* Help text */}
        <div className="text-xs text-gray-400 mb-4">
          {selectedSource !== null ? (
            <span className="text-amber-600 font-medium">
              Click a target fiber to connect F{selectedSource + 1}
            </span>
          ) : (
            "Click a source fiber, then click a target fiber to connect"
          )}
        </div>

        {/* Fiber matrix */}
        <div className="flex gap-6">
          {/* Source fibers */}
          <div className="flex-1">
            <div className="text-xs font-medium text-gray-500 mb-2 text-center">
              {sourceName}
            </div>
            <div className="grid grid-cols-6 gap-2">
              {Array.from({ length: displayFibers }, (_, i) => (
                <FiberDot
                  key={`source-${i}`}
                  fiberIndex={i}
                  fiberCount={fiberCount}
                  isSelected={selectedSource === i}
                  isConnected={connectedSources.has(i)}
                  onClick={() => handleSourceClick(i)}
                  side="source"
                />
              ))}
            </div>
            {fiberCount > displayFibers && (
              <div className="text-xs text-gray-400 text-center mt-2">
                +{fiberCount - displayFibers} more fibers
              </div>
            )}
          </div>

          {/* Target fibers */}
          <div className="flex-1">
            <div className="text-xs font-medium text-gray-500 mb-2 text-center">
              {targetName}
            </div>
            <div className="grid grid-cols-6 gap-2">
              {Array.from({ length: displayFibers }, (_, i) => (
                <FiberDot
                  key={`target-${i}`}
                  fiberIndex={i}
                  fiberCount={fiberCount}
                  isSelected={false}
                  isConnected={connectedTargets.has(i)}
                  onClick={(e: React.MouseEvent) => handleTargetClick(i, e)}
                  side="target"
                />
              ))}
            </div>
            {fiberCount > displayFibers && (
              <div className="text-xs text-gray-400 text-center mt-2">
                +{fiberCount - displayFibers} more fibers
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t bg-gray-50 rounded-b-2xl flex justify-end gap-2" data-no-drag>
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

      {/* CSS for spark animation */}
      <style jsx>{`
        @keyframes spark {
          0% {
            opacity: 1;
            transform: rotate(var(--rotation)) translateY(0px) scale(1);
          }
          100% {
            opacity: 0;
            transform: rotate(var(--rotation)) translateY(-30px) scale(0);
          }
        }
        .animate-spark {
          animation: spark 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
}

export default UnifiedEdgeEditor;
