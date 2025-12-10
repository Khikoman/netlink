"use client";

import { useState, useCallback, useMemo, useEffect, useRef, memo } from "react";
import { X, Zap, Link2, Trash2, Save, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { CableCrossSection } from "./CableCrossSection";
import { MetadataPanel, type SpliceMetadata } from "./MetadataPanel";
import { SparkleEffect } from "./SparkleEffect";
import { getFiberInfo } from "@/lib/fiberColors";
import {
  saveSplicesForEdge,
  type SpliceConnection,
  type EdgeSpliceData,
} from "@/lib/db/spliceService";
import { useSplicesByEdge } from "@/lib/db/hooks";

// ============================================
// TYPES
// ============================================

export interface UnifiedSpliceEditorProps {
  isOpen: boolean;
  onClose: () => void;
  edgeId: string;
  trayId: number;
  cableA: { id: number; name: string; fiberCount: number };
  cableB: { id: number; name: string; fiberCount: number };
  initialPosition?: { x: number; y: number };
  onSave?: (connections: SpliceConnection[]) => void;
}

interface LocalConnection {
  id: string;
  fiberA: number;
  fiberB: number;
  colorA: string;
  colorB: string;
  tubeColorA: string;
  tubeColorB: string;
  metadata: SpliceMetadata;
}

interface SparkleData {
  id: string;
  x: number;
  y: number;
  colorA: string;
  colorB: string;
}

// ============================================
// MAIN COMPONENT
// ============================================

export const UnifiedSpliceEditor = memo(function UnifiedSpliceEditor({
  isOpen,
  onClose,
  edgeId,
  trayId,
  cableA,
  cableB,
  initialPosition,
  onSave,
}: UnifiedSpliceEditorProps) {
  // State
  const [connections, setConnections] = useState<LocalConnection[]>([]);
  const [selectedFiberA, setSelectedFiberA] = useState<number | null>(null);
  const [selectedFiberB, setSelectedFiberB] = useState<number | null>(null);
  const [hoveredFiber, setHoveredFiber] = useState<number | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null);
  const [sparkles, setSparkles] = useState<SparkleData[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Panel position for dragging
  const [position, setPosition] = useState(initialPosition ?? { x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; posX: number; posY: number } | null>(null);

  // Load existing splices from database
  const existingSplices = useSplicesByEdge(edgeId);

  // Initialize connections from database
  useEffect(() => {
    if (existingSplices && existingSplices.length > 0) {
      const loaded: LocalConnection[] = existingSplices.map((splice, idx) => ({
        id: `conn-${idx}`,
        fiberA: splice.fiberA,
        fiberB: splice.fiberB,
        colorA: splice.fiberAColor,
        colorB: splice.fiberBColor,
        tubeColorA: splice.tubeAColor,
        tubeColorB: splice.tubeBColor,
        metadata: {
          loss: splice.loss,
          status: splice.status,
          spliceType: splice.spliceType,
          technicianName: splice.technicianName,
          notes: splice.notes,
        },
      }));
      setConnections(loaded);
    }
  }, [existingSplices]);

  // Build connected fibers maps
  const connectedFibersA = useMemo(() => {
    const map = new Map<number, { status: SpliceMetadata["status"]; pairedFiber: number }>();
    connections.forEach(conn => {
      map.set(conn.fiberA, { status: conn.metadata.status, pairedFiber: conn.fiberB });
    });
    return map;
  }, [connections]);

  const connectedFibersB = useMemo(() => {
    const map = new Map<number, { status: SpliceMetadata["status"]; pairedFiber: number }>();
    connections.forEach(conn => {
      map.set(conn.fiberB, { status: conn.metadata.status, pairedFiber: conn.fiberA });
    });
    return map;
  }, [connections]);

  // Get selected connection for metadata panel
  const selectedConnectionData = useMemo(() => {
    if (!selectedConnection) return null;
    return connections.find(c => c.id === selectedConnection) ?? null;
  }, [selectedConnection, connections]);

  // ============================================
  // HANDLERS
  // ============================================

  // Create a new connection
  const createConnection = useCallback((fiberA: number, fiberB: number) => {
    // Get fiber colors
    const infoA = getFiberInfo(fiberA, cableA.fiberCount);
    const infoB = getFiberInfo(fiberB, cableB.fiberCount);
    if (!infoA || !infoB) return;

    const newConnection: LocalConnection = {
      id: `conn-${Date.now()}`,
      fiberA,
      fiberB,
      colorA: infoA.fiberColor.hex,
      colorB: infoB.fiberColor.hex,
      tubeColorA: infoA.tubeColor.hex,
      tubeColorB: infoB.tubeColor.hex,
      metadata: {
        status: "pending",
        spliceType: "fusion",
      },
    };

    setConnections(prev => [...prev, newConnection]);
    setSelectedConnection(newConnection.id);
    setSelectedFiberA(null);
    setSelectedFiberB(null);
    setIsDirty(true);

    // Trigger sparkle effect (center of panel as placeholder)
    const sparkle: SparkleData = {
      id: `sparkle-${Date.now()}`,
      x: position.x + 400,
      y: position.y + 200,
      colorA: infoA.fiberColor.hex,
      colorB: infoB.fiberColor.hex,
    };
    setSparkles(prev => [...prev, sparkle]);
  }, [cableA.fiberCount, cableB.fiberCount, position]);

  // Handle fiber click on cable A
  const handleFiberClickA = useCallback((fiberNumber: number) => {
    // If already connected, select that connection
    const existing = connections.find(c => c.fiberA === fiberNumber);
    if (existing) {
      setSelectedConnection(existing.id);
      setSelectedFiberA(null);
      setSelectedFiberB(null);
      return;
    }

    // If a fiber B is selected, create connection
    if (selectedFiberB !== null) {
      createConnection(fiberNumber, selectedFiberB);
    } else {
      // Select this fiber A
      setSelectedFiberA(fiberNumber);
      setSelectedConnection(null);
    }
  }, [connections, selectedFiberB, createConnection]);

  // Handle fiber click on cable B
  const handleFiberClickB = useCallback((fiberNumber: number) => {
    // If already connected, select that connection
    const existing = connections.find(c => c.fiberB === fiberNumber);
    if (existing) {
      setSelectedConnection(existing.id);
      setSelectedFiberA(null);
      setSelectedFiberB(null);
      return;
    }

    // If a fiber A is selected, create connection
    if (selectedFiberA !== null) {
      createConnection(selectedFiberA, fiberNumber);
    } else {
      // Select this fiber B
      setSelectedFiberB(fiberNumber);
      setSelectedConnection(null);
    }
  }, [connections, selectedFiberA, createConnection]);

  // Update connection metadata
  const handleMetadataChange = useCallback((updates: Partial<SpliceMetadata>) => {
    if (!selectedConnection) return;
    setConnections(prev =>
      prev.map(conn =>
        conn.id === selectedConnection
          ? { ...conn, metadata: { ...conn.metadata, ...updates } }
          : conn
      )
    );
    setIsDirty(true);
  }, [selectedConnection]);

  // Delete selected connection
  const handleDeleteConnection = useCallback(() => {
    if (!selectedConnection) return;
    setConnections(prev => prev.filter(c => c.id !== selectedConnection));
    setSelectedConnection(null);
    setIsDirty(true);
  }, [selectedConnection]);

  // Auto-match 1:1
  const handleAutoMatch = useCallback(() => {
    const matchCount = Math.min(cableA.fiberCount, cableB.fiberCount);
    const newConnections: LocalConnection[] = [];

    for (let i = 1; i <= matchCount; i++) {
      if (connectedFibersA.has(i) || connectedFibersB.has(i)) continue;

      const infoA = getFiberInfo(i, cableA.fiberCount);
      const infoB = getFiberInfo(i, cableB.fiberCount);
      if (!infoA || !infoB) continue;

      newConnections.push({
        id: `conn-auto-${i}-${Date.now()}`,
        fiberA: i,
        fiberB: i,
        colorA: infoA.fiberColor.hex,
        colorB: infoB.fiberColor.hex,
        tubeColorA: infoA.tubeColor.hex,
        tubeColorB: infoB.tubeColor.hex,
        metadata: {
          status: "pending",
          spliceType: "fusion",
        },
      });
    }

    // Staggered sparkle effects
    newConnections.forEach((conn, idx) => {
      setTimeout(() => {
        setSparkles(prev => [
          ...prev,
          {
            id: `sparkle-auto-${idx}-${Date.now()}`,
            x: position.x + 400,
            y: position.y + 100 + (idx % 5) * 40,
            colorA: conn.colorA,
            colorB: conn.colorB,
          },
        ]);
      }, idx * 50);
    });

    setConnections(prev => [...prev, ...newConnections]);
    setIsDirty(true);
  }, [cableA.fiberCount, cableB.fiberCount, connectedFibersA, connectedFibersB, position]);

  // Clear all connections
  const handleClearAll = useCallback(() => {
    setConnections([]);
    setSelectedConnection(null);
    setSelectedFiberA(null);
    setSelectedFiberB(null);
    setIsDirty(true);
  }, []);

  // Save to database
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const spliceConnections: SpliceConnection[] = connections.map(conn => ({
        fiberA: conn.fiberA,
        fiberB: conn.fiberB,
        tubeAColor: conn.tubeColorA,
        tubeBColor: conn.tubeColorB,
        fiberAColor: conn.colorA,
        fiberBColor: conn.colorB,
        loss: conn.metadata.loss,
        status: conn.metadata.status,
        spliceType: conn.metadata.spliceType,
        technicianName: conn.metadata.technicianName,
        notes: conn.metadata.notes,
      }));

      const data: EdgeSpliceData = {
        edgeId,
        cableAId: cableA.id,
        cableAName: cableA.name,
        cableBId: cableB.id,
        cableBName: cableB.name,
        trayId,
        connections: spliceConnections,
      };

      await saveSplicesForEdge(data);
      setIsDirty(false);
      onSave?.(spliceConnections);
    } catch (err) {
      console.error("Failed to save splices:", err);
    } finally {
      setIsSaving(false);
    }
  }, [connections, edgeId, cableA, cableB, trayId, onSave]);

  // Remove sparkle after animation
  const handleSparkleComplete = useCallback((id: string) => {
    setSparkles(prev => prev.filter(s => s.id !== id));
  }, []);

  // ============================================
  // DRAG HANDLERS
  // ============================================

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button, input, select, textarea")) return;
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: position.x,
      posY: position.y,
    };
  }, [position]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setPosition({
        x: dragRef.current.posX + dx,
        y: dragRef.current.posY + dy,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragRef.current = null;
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  // ============================================
  // RENDER
  // ============================================

  if (!isOpen) return null;

  return (
    <>
      {/* Main Panel */}
      <div
        className={cn(
          "fixed bg-slate-900/95 backdrop-blur-sm rounded-xl shadow-2xl border border-slate-700",
          "flex flex-col z-50 overflow-hidden",
          isDragging && "cursor-grabbing select-none"
        )}
        style={{
          left: position.x,
          top: position.y,
          width: 900,
          maxHeight: "80vh",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700 cursor-grab"
          onMouseDown={handleMouseDown}
        >
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            <span className="font-semibold text-white">Splice Editor</span>
            <span className="text-xs text-slate-400">
              {cableA.name} - {cableB.name}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isDirty && (
              <span className="text-xs text-amber-400 px-2 py-1 bg-amber-900/30 rounded">
                Unsaved
              </span>
            )}
            <span className="text-xs text-slate-400 bg-slate-700 px-2 py-1 rounded">
              {connections.length} splices
            </span>
            <button
              onClick={onClose}
              className="p-1 hover:bg-slate-700 rounded transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Cable */}
          <div className="flex-1 p-4 overflow-y-auto border-r border-slate-700">
            <CableCrossSection
              cableName={cableA.name}
              fiberCount={cableA.fiberCount}
              selectedFiber={selectedFiberA ?? undefined}
              connectedFibers={connectedFibersA}
              hoveredFiber={hoveredFiber ?? undefined}
              onFiberClick={handleFiberClickA}
              onFiberHover={setHoveredFiber}
              side="left"
            />
          </div>

          {/* Right Cable */}
          <div className="flex-1 p-4 overflow-y-auto">
            <CableCrossSection
              cableName={cableB.name}
              fiberCount={cableB.fiberCount}
              selectedFiber={selectedFiberB ?? undefined}
              connectedFibers={connectedFibersB}
              hoveredFiber={hoveredFiber ?? undefined}
              onFiberClick={handleFiberClickB}
              onFiberHover={setHoveredFiber}
              side="right"
            />
          </div>

          {/* Metadata Panel */}
          <div className="w-72 border-l border-slate-700 p-4 bg-slate-850 overflow-y-auto">
            {selectedConnectionData ? (
              <>
                <MetadataPanel
                  metadata={selectedConnectionData.metadata}
                  onChange={handleMetadataChange}
                  selectedConnection={{
                    fiberA: selectedConnectionData.fiberA,
                    fiberB: selectedConnectionData.fiberB,
                    colorA: selectedConnectionData.colorA,
                    colorB: selectedConnectionData.colorB,
                  }}
                />
                <button
                  onClick={handleDeleteConnection}
                  className="w-full mt-4 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-600/50 rounded text-red-400 text-sm flex items-center justify-center gap-2 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Connection
                </button>
              </>
            ) : (
              <div className="text-center text-slate-500 py-8">
                <Link2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Click a fiber to select</p>
                <p className="text-xs mt-1">or click a connected fiber to edit</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-t border-slate-700">
          <div className="flex gap-2">
            <button
              onClick={handleAutoMatch}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded text-white text-sm flex items-center gap-2 transition-colors"
            >
              <Zap className="w-4 h-4" />
              Auto-Match 1:1
            </button>
            <button
              onClick={handleClearAll}
              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded text-slate-300 text-sm flex items-center gap-2 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Clear All
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-slate-300 text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !isDirty}
              className={cn(
                "px-4 py-2 rounded text-white text-sm flex items-center gap-2 transition-colors",
                isDirty && !isSaving
                  ? "bg-green-600 hover:bg-green-500"
                  : "bg-slate-600 cursor-not-allowed opacity-50"
              )}
            >
              <Save className="w-4 h-4" />
              {isSaving ? "Saving..." : `Save (${connections.length} splices)`}
            </button>
          </div>
        </div>
      </div>

      {/* Sparkle Effects */}
      {sparkles.map(sparkle => (
        <SparkleEffect
          key={sparkle.id}
          x={sparkle.x}
          y={sparkle.y}
          colorA={sparkle.colorA}
          colorB={sparkle.colorB}
          onComplete={() => handleSparkleComplete(sparkle.id)}
        />
      ))}

      {/* Custom scrollbar styles */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgb(30 41 59);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgb(71 85 105);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgb(100 116 139);
        }

        @keyframes animate-dash {
          to {
            stroke-dashoffset: -12;
          }
        }
        .animate-dash {
          animation: animate-dash 0.5s linear infinite;
        }
      `}</style>
    </>
  );
});

export default UnifiedSpliceEditor;
