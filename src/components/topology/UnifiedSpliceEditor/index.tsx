"use client";

import { useState, useCallback, useMemo, useEffect, useRef, memo } from "react";
import { X, Zap, Link2, Trash2, Save, RotateCcw, ChevronDown, ArrowRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CableCrossSection } from "./CableCrossSection";
import { MetadataPanel, type SpliceMetadata } from "./MetadataPanel";
import { SparkleEffect } from "./SparkleEffect";
import { getFiberInfo } from "@/lib/fiberColors";
import { db } from "@/lib/db";

// ============================================
// TYPES
// ============================================

interface CableInfo {
  id: number;
  name: string;
  fiberCount: number;
  edgeId: string;
}

export interface UnifiedSpliceEditorProps {
  isOpen: boolean;
  onClose: () => void;
  nodeId: string;
  nodeName: string;
  trayId: number;
  incomingCables: CableInfo[];
  outgoingCables: CableInfo[];
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

// Helper to calculate line positions for connections
interface ConnectionLineData {
  id: string;
  fiberA: number;
  fiberB: number;
  colorA: string;
  colorB: string;
  status: SpliceMetadata["status"];
  isSelected: boolean;
}

// ============================================
// MAIN COMPONENT
// ============================================

export const UnifiedSpliceEditor = memo(function UnifiedSpliceEditor({
  isOpen,
  onClose,
  nodeId,
  nodeName,
  trayId,
  incomingCables,
  outgoingCables,
}: UnifiedSpliceEditorProps) {
  // Selected cables (dropdown state)
  const [selectedIncomingIdx, setSelectedIncomingIdx] = useState(0);
  const [selectedOutgoingIdx, setSelectedOutgoingIdx] = useState(0);

  // Get selected cables
  const cableA = incomingCables[selectedIncomingIdx] ?? null;
  const cableB = outgoingCables[selectedOutgoingIdx] ?? null;

  // State
  const [connections, setConnections] = useState<LocalConnection[]>([]);
  const [selectedFiberA, setSelectedFiberA] = useState<number | null>(null);
  const [selectedFiberB, setSelectedFiberB] = useState<number | null>(null);
  const [hoveredFiberA, setHoveredFiberA] = useState<number | null>(null);
  const [hoveredFiberB, setHoveredFiberB] = useState<number | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null);
  const [sparkles, setSparkles] = useState<SparkleData[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Refs for connection line positioning
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Panel position for dragging
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; posX: number; posY: number } | null>(null);

  // Load existing splices when cables change
  useEffect(() => {
    async function loadSplices() {
      if (!cableA || !cableB) {
        setConnections([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        // Load splices for this node and cable combination
        const splices = await db.splices
          .where("trayId")
          .equals(trayId)
          .filter(s => s.cableAId === cableA.id && s.cableBId === cableB.id)
          .toArray();

        const loaded: LocalConnection[] = splices.map((splice, idx) => ({
          id: `conn-${idx}`,
          fiberA: splice.fiberA,
          fiberB: splice.fiberB,
          colorA: splice.fiberAColor,
          colorB: splice.fiberBColor,
          tubeColorA: splice.tubeAColor || "#374151",
          tubeColorB: splice.tubeBColor || "#374151",
          metadata: {
            loss: splice.loss,
            status: splice.status,
            spliceType: splice.spliceType,
            technicianName: splice.technicianName,
            notes: splice.notes,
          },
        }));
        setConnections(loaded);
        setIsDirty(false);
      } catch (err) {
        console.error("Failed to load splices:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadSplices();
  }, [cableA, cableB, trayId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to close
      if (e.key === "Escape") {
        onClose();
        return;
      }

      // Ctrl+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (isDirty && !isSaving) {
          handleSave();
        }
        return;
      }

      // Delete to remove selected connection
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedConnection && !(e.target instanceof HTMLInputElement)) {
          e.preventDefault();
          handleDeleteConnection();
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // Note: handleSave and handleDeleteConnection are intentionally excluded from deps
    // to avoid creating new event listeners on every connection change. The effect
    // re-runs when isDirty, isSaving, or selectedConnection changes, which is sufficient.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, isDirty, isSaving, selectedConnection]);

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

  // Build connection lines data for SVG rendering
  const connectionLines: ConnectionLineData[] = useMemo(() => {
    return connections.map(conn => ({
      id: conn.id,
      fiberA: conn.fiberA,
      fiberB: conn.fiberB,
      colorA: conn.colorA,
      colorB: conn.colorB,
      status: conn.metadata.status,
      isSelected: conn.id === selectedConnection,
    }));
  }, [connections, selectedConnection]);

  // Calculate Y positions for connection lines based on fiber numbers
  // This creates a visual lane for each connection
  const getConnectionY = useCallback((fiberA: number, fiberB: number) => {
    // Calculate approximate positions based on fiber numbers
    // Fibers are grouped in tubes of 12, so we account for tube grouping
    const tubeA = Math.ceil(fiberA / 12);
    const tubeB = Math.ceil(fiberB / 12);
    const posInTubeA = ((fiberA - 1) % 12);
    const posInTubeB = ((fiberB - 1) % 12);

    // Row height approximation in viewBox units (0-500)
    const rowHeight = 48;

    const y1 = (tubeA - 1) * rowHeight + 60 + posInTubeA * 3;
    const y2 = (tubeB - 1) * rowHeight + 60 + posInTubeB * 3;

    return { y1, y2 };
  }, []);

  // ============================================
  // HANDLERS
  // ============================================

  // Create a new connection
  const createConnection = useCallback((fiberA: number, fiberB: number) => {
    if (!cableA || !cableB) return;

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

    // Trigger sparkle effect
    const sparkle: SparkleData = {
      id: `sparkle-${Date.now()}`,
      x: position.x + 450,
      y: position.y + 200,
      colorA: infoA.fiberColor.hex,
      colorB: infoB.fiberColor.hex,
    };
    setSparkles(prev => [...prev, sparkle]);
  }, [cableA, cableB, position]);

  // Handle fiber click on cable A (incoming)
  const handleFiberClickA = useCallback((fiberNumber: number) => {
    const existing = connections.find(c => c.fiberA === fiberNumber);
    if (existing) {
      setSelectedConnection(existing.id);
      setSelectedFiberA(null);
      setSelectedFiberB(null);
      return;
    }

    if (selectedFiberB !== null) {
      createConnection(fiberNumber, selectedFiberB);
    } else {
      setSelectedFiberA(fiberNumber);
      setSelectedConnection(null);
    }
  }, [connections, selectedFiberB, createConnection]);

  // Handle fiber click on cable B (outgoing)
  const handleFiberClickB = useCallback((fiberNumber: number) => {
    const existing = connections.find(c => c.fiberB === fiberNumber);
    if (existing) {
      setSelectedConnection(existing.id);
      setSelectedFiberA(null);
      setSelectedFiberB(null);
      return;
    }

    if (selectedFiberA !== null) {
      createConnection(selectedFiberA, fiberNumber);
    } else {
      setSelectedFiberB(fiberNumber);
      setSelectedConnection(null);
    }
  }, [connections, selectedFiberA, createConnection]);

  // Handle fiber hover on cable A
  const handleFiberHoverA = useCallback((fiberNumber: number | null) => {
    setHoveredFiberA(fiberNumber);
  }, []);

  // Handle fiber hover on cable B
  const handleFiberHoverB = useCallback((fiberNumber: number | null) => {
    setHoveredFiberB(fiberNumber);
  }, []);

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
    if (!cableA || !cableB) return;

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

    // Sparkle effects
    newConnections.forEach((conn, idx) => {
      setTimeout(() => {
        setSparkles(prev => [
          ...prev,
          {
            id: `sparkle-auto-${idx}-${Date.now()}`,
            x: position.x + 450,
            y: position.y + 100 + (idx % 5) * 40,
            colorA: conn.colorA,
            colorB: conn.colorB,
          },
        ]);
      }, idx * 50);
    });

    setConnections(prev => [...prev, ...newConnections]);
    setIsDirty(true);
  }, [cableA, cableB, connectedFibersA, connectedFibersB, position]);

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
    if (!cableA || !cableB) return;

    setIsSaving(true);
    try {
      // Delete existing splices for this cable pair in this tray
      const existing = await db.splices
        .where("trayId")
        .equals(trayId)
        .filter(s => s.cableAId === cableA.id && s.cableBId === cableB.id)
        .toArray();

      for (const splice of existing) {
        if (splice.id) await db.splices.delete(splice.id);
      }

      // Save new splices
      for (const conn of connections) {
        await db.splices.add({
          trayId,
          nodeId,
          cableAId: cableA.id,
          cableAName: cableA.name,
          cableBId: cableB.id,
          cableBName: cableB.name,
          fiberA: conn.fiberA,
          fiberB: conn.fiberB,
          fiberAColor: conn.colorA,
          fiberBColor: conn.colorB,
          tubeAColor: conn.tubeColorA,
          tubeBColor: conn.tubeColorB,
          loss: conn.metadata.loss,
          status: conn.metadata.status,
          spliceType: conn.metadata.spliceType || "fusion",
          technicianName: conn.metadata.technicianName,
          notes: conn.metadata.notes,
          timestamp: new Date(),
        });
      }

      setIsDirty(false);
    } catch (err) {
      console.error("Failed to save splices:", err);
    } finally {
      setIsSaving(false);
    }
  }, [cableA, cableB, connections, trayId, nodeId]);

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

  // No cables available
  if (incomingCables.length === 0 && outgoingCables.length === 0) {
    return (
      <div
        className="fixed bg-slate-900/95 backdrop-blur-sm rounded-xl shadow-2xl border border-slate-700 z-50 p-6"
        style={{ left: position.x, top: position.y, width: 400 }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            <span className="font-semibold text-white">{nodeName} Splices</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        <div className="text-center text-slate-400 py-8">
          <Link2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No cables connected to this node</p>
          <p className="text-xs mt-2 text-slate-500">Connect cables to start splicing</p>
        </div>
      </div>
    );
  }

  // Compute which fiber should be highlighted on B side when A is selected/hovered
  const previewFiberB = selectedFiberA ?? hoveredFiberA;
  // And vice versa
  const previewFiberA = selectedFiberB ?? hoveredFiberB;

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
          maxHeight: "85vh",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700 cursor-grab"
          onMouseDown={handleMouseDown}
        >
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            <span className="font-semibold text-white">{nodeName}</span>
            <span className="text-xs text-slate-400">Splice Editor</span>
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
              title="Close (Esc)"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Cable Selectors */}
        <div className="flex items-center gap-4 px-4 py-3 bg-slate-800/50 border-b border-slate-700">
          {/* Incoming Cable */}
          <div className="flex-1">
            <label className="block text-xs text-slate-400 mb-1">Incoming Cable</label>
            {incomingCables.length > 0 ? (
              <div className="relative">
                <select
                  value={selectedIncomingIdx}
                  onChange={(e) => setSelectedIncomingIdx(parseInt(e.target.value))}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white appearance-none cursor-pointer hover:bg-slate-600 transition-colors"
                >
                  {incomingCables.map((cable, idx) => (
                    <option key={cable.id} value={idx}>
                      {cable.name} ({cable.fiberCount}F)
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            ) : (
              <div className="px-3 py-2 bg-slate-700/50 rounded text-sm text-slate-500">
                No incoming cables
              </div>
            )}
          </div>

          <ArrowRight className="w-5 h-5 text-slate-500 mt-5" />

          {/* Outgoing Cable */}
          <div className="flex-1">
            <label className="block text-xs text-slate-400 mb-1">Outgoing Cable</label>
            {outgoingCables.length > 0 ? (
              <div className="relative">
                <select
                  value={selectedOutgoingIdx}
                  onChange={(e) => setSelectedOutgoingIdx(parseInt(e.target.value))}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white appearance-none cursor-pointer hover:bg-slate-600 transition-colors"
                >
                  {outgoingCables.map((cable, idx) => (
                    <option key={cable.id} value={idx}>
                      {cable.name} ({cable.fiberCount}F)
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            ) : (
              <div className="px-3 py-2 bg-slate-700/50 rounded text-sm text-slate-500">
                No outgoing cables
              </div>
            )}
          </div>
        </div>

        {/* Content - Fiber connection area */}
        {cableA && cableB ? (
          <div ref={contentRef} className="flex flex-1 overflow-hidden relative">
            {/* Loading overlay */}
            {isLoading && (
              <div className="absolute inset-0 bg-slate-900/80 z-10 flex items-center justify-center">
                <div className="flex items-center gap-3 text-slate-300">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>Loading splices...</span>
                </div>
              </div>
            )}

            {/* Left Cable (Incoming) */}
            <div ref={leftPanelRef} className="flex-1 p-4 overflow-y-auto border-r border-slate-700">
              <div className="text-xs text-slate-400 mb-2 text-center">
                INCOMING: {cableA.name}
              </div>
              <CableCrossSection
                cableName={cableA.name}
                fiberCount={cableA.fiberCount}
                selectedFiber={selectedFiberA ?? undefined}
                connectedFibers={connectedFibersA}
                hoveredFiber={previewFiberA && !connectedFibersA.has(previewFiberA) ? previewFiberA : undefined}
                onFiberClick={handleFiberClickA}
                onFiberHover={handleFiberHoverA}
                side="left"
              />
            </div>

            {/* SVG Connection Lines Overlay */}
            <svg
              ref={svgRef}
              className="absolute inset-0 pointer-events-none z-10"
              viewBox="0 0 100 500"
              preserveAspectRatio="none"
              style={{ width: "100%", height: "100%" }}
            >
              <defs>
                {/* Gradients for each connection */}
                {connectionLines.map((line) => (
                  <linearGradient
                    key={`gradient-${line.id}`}
                    id={`conn-gradient-${line.id}`}
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="0%"
                  >
                    <stop offset="0%" stopColor={line.colorA} />
                    <stop offset="100%" stopColor={line.colorB} />
                  </linearGradient>
                ))}
                {/* Glow filter */}
                <filter id="conn-glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="0.5" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                {/* Selected glow filter */}
                <filter id="conn-glow-selected" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="1" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Render connection lines */}
              {connectionLines.map((line) => {
                const { y1, y2 } = getConnectionY(line.fiberA, line.fiberB);
                // X positions in viewBox coordinates (0-100)
                const xStart = 30;
                const xEnd = 70;
                const xMid = 50;

                return (
                  <g
                    key={line.id}
                    className="pointer-events-auto cursor-pointer"
                    onClick={() => setSelectedConnection(line.id)}
                  >
                    {/* Background glow for selected */}
                    {line.isSelected && (
                      <path
                        d={`M ${xStart} ${y1} C ${xMid} ${y1}, ${xMid} ${y2}, ${xEnd} ${y2}`}
                        fill="none"
                        stroke="#fbbf24"
                        strokeWidth="2"
                        opacity="0.4"
                        filter="url(#conn-glow-selected)"
                      />
                    )}

                    {/* Main connection line */}
                    <path
                      d={`M ${xStart} ${y1} C ${xMid} ${y1}, ${xMid} ${y2}, ${xEnd} ${y2}`}
                      fill="none"
                      stroke={`url(#conn-gradient-${line.id})`}
                      strokeWidth={line.isSelected ? 1 : 0.6}
                      strokeLinecap="round"
                      strokeDasharray={line.status === "pending" ? "2,1" : undefined}
                      filter="url(#conn-glow)"
                      opacity={line.status === "pending" ? 0.7 : 0.9}
                      className={cn(
                        "transition-all duration-150",
                        !line.isSelected && "hover:stroke-[1] hover:opacity-100"
                      )}
                    />

                    {/* Animated flow dot for completed connections */}
                    {line.status === "completed" && (
                      <circle r="0.8" fill="white" opacity="0.8">
                        <animateMotion
                          dur="2.5s"
                          repeatCount="indefinite"
                          path={`M ${xStart} ${y1} C ${xMid} ${y1}, ${xMid} ${y2}, ${xEnd} ${y2}`}
                        />
                      </circle>
                    )}

                    {/* End dots */}
                    <circle cx={xStart} cy={y1} r="1.5" fill={line.colorA} stroke="white" strokeWidth="0.3" />
                    <circle cx={xEnd} cy={y2} r="1.5" fill={line.colorB} stroke="white" strokeWidth="0.3" />

                    {/* Fiber labels */}
                    <text
                      x={xStart - 3}
                      y={y1}
                      fill="#94a3b8"
                      fontSize="3"
                      textAnchor="end"
                      dominantBaseline="middle"
                    >
                      F{line.fiberA}
                    </text>
                    <text
                      x={xEnd + 3}
                      y={y2}
                      fill="#94a3b8"
                      fontSize="3"
                      textAnchor="start"
                      dominantBaseline="middle"
                    >
                      F{line.fiberB}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Connection count indicator in center */}
            <div className="absolute left-1/2 top-4 -translate-x-1/2 pointer-events-none z-20">
              {connections.length > 0 && (
                <div className="text-xs text-slate-400 bg-slate-800/90 px-3 py-1.5 rounded-full border border-slate-600 shadow-lg">
                  {connections.length} splice{connections.length !== 1 ? "s" : ""}
                </div>
              )}
            </div>

            {/* Guidance indicator when selecting */}
            {(selectedFiberA || selectedFiberB) && !selectedConnection && (
              <div className="absolute left-1/2 bottom-4 -translate-x-1/2 pointer-events-none z-20">
                <div className="text-xs text-blue-400 bg-blue-900/80 px-3 py-1.5 rounded-full border border-blue-600 animate-pulse shadow-lg">
                  Click fiber on {selectedFiberA ? "right" : "left"} side to connect
                </div>
              </div>
            )}

            {/* Right Cable (Outgoing) */}
            <div ref={rightPanelRef} className="flex-1 p-4 overflow-y-auto">
              <div className="text-xs text-slate-400 mb-2 text-center">
                OUTGOING: {cableB.name}
              </div>
              <CableCrossSection
                cableName={cableB.name}
                fiberCount={cableB.fiberCount}
                selectedFiber={selectedFiberB ?? undefined}
                connectedFibers={connectedFibersB}
                hoveredFiber={previewFiberB && !connectedFibersB.has(previewFiberB) ? previewFiberB : undefined}
                onFiberClick={handleFiberClickB}
                onFiberHover={handleFiberHoverB}
                side="right"
              />
            </div>

            {/* Metadata Panel */}
            <div className="w-64 border-l border-slate-700 p-4 bg-slate-800/50 overflow-y-auto">
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
                    className="w-full mt-4 px-3 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-600/50 rounded text-red-400 text-xs flex items-center justify-center gap-2 transition-colors"
                    title="Delete (Del)"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </button>
                </>
              ) : (
                <div className="text-center text-slate-500 py-8">
                  <Link2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-xs">Click fibers to connect</p>
                  <p className="text-[10px] mt-1 text-slate-600">or click a splice to edit</p>
                  <div className="mt-4 pt-4 border-t border-slate-700 text-[10px] text-slate-600">
                    <p><kbd className="bg-slate-700 px-1 rounded">Esc</kbd> Close</p>
                    <p className="mt-1"><kbd className="bg-slate-700 px-1 rounded">Ctrl+S</kbd> Save</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-8 text-slate-500">
            <div className="text-center">
              <Link2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">
                {!cableA && !cableB ? "Select cables to start splicing" :
                 !cableA ? "Select an incoming cable" : "Select an outgoing cable"}
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-t border-slate-700">
          <div className="flex gap-2">
            <button
              onClick={handleAutoMatch}
              disabled={!cableA || !cableB || isLoading}
              className={cn(
                "px-3 py-2 rounded text-sm flex items-center gap-2 transition-colors",
                cableA && cableB && !isLoading
                  ? "bg-blue-600 hover:bg-blue-500 text-white"
                  : "bg-slate-700 text-slate-500 cursor-not-allowed"
              )}
              title="Auto-match fibers 1:1"
            >
              <Zap className="w-4 h-4" />
              Auto-Match 1:1
            </button>
            <button
              onClick={handleClearAll}
              disabled={connections.length === 0}
              className={cn(
                "px-3 py-2 rounded text-sm flex items-center gap-2 transition-colors",
                connections.length > 0
                  ? "bg-slate-700 hover:bg-slate-600 text-slate-300"
                  : "bg-slate-700/50 text-slate-600 cursor-not-allowed"
              )}
            >
              <RotateCcw className="w-4 h-4" />
              Clear
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-slate-300 text-sm transition-colors"
            >
              Close
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
              title="Save (Ctrl+S)"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {isSaving ? "Saving..." : `Save (${connections.length})`}
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
    </>
  );
});

export default UnifiedSpliceEditor;
