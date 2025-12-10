"use client";

import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  X,
  GripVertical,
  Minimize2,
  Maximize2,
  Save,
  Link2,
  Zap,
  Trash2,
  Check,
} from "lucide-react";
import { getFiberInfo, FIBER_COLORS, TUBE_COLORS } from "@/lib/fiberColors";

interface SpliceConnection {
  fiberA: number;
  fiberB: number;
  tubeA: number;
  tubeB: number;
  colorA: string;
  colorB: string;
  status: "completed" | "pending";
}

interface ExistingConnection {
  fiberA: number;
  fiberB: number;
  colorA?: string;
  colorB?: string;
  status: "completed" | "pending";
}

interface SpliceMatrixPanelProps {
  isOpen: boolean;
  onClose: () => void;
  closureId: number;
  closureName: string;
  trayId: number;
  cableA: { id: number; name: string; fiberCount: number };
  cableB: { id: number; name: string; fiberCount: number };
  existingConnections: ExistingConnection[];
  onSave: (connections: SpliceConnection[]) => void;
}

// FiberDot component - displays a single fiber as a colored circle
const FiberDot: React.FC<{
  fiberNumber: number;
  tubeNumber: number;
  fiberColor: string;
  fiberColorName: string;
  status: "available" | "connected" | "pending";
  isSelected: boolean;
  onClick: () => void;
}> = React.memo(({ fiberNumber, tubeNumber, fiberColor, fiberColorName, status, isSelected, onClick }) => {
  const getRingClass = () => {
    if (isSelected) return "ring-2 ring-blue-500 ring-offset-1 scale-125";
    switch (status) {
      case "connected": return "ring-2 ring-green-500";
      case "pending": return "ring-2 ring-amber-500 animate-pulse";
      default: return "ring-1 ring-gray-300 hover:ring-2 hover:ring-blue-300";
    }
  };

  const isClickable = status === "available" || isSelected;

  return (
    <div className="relative group">
      <button
        onClick={isClickable ? onClick : undefined}
        disabled={!isClickable}
        className={`
          w-5 h-5 rounded-full transition-all duration-200 shadow-sm
          ${getRingClass()}
          ${isClickable ? "cursor-pointer hover:scale-110" : "cursor-not-allowed opacity-70"}
        `}
        style={{ backgroundColor: fiberColor }}
        title={`F${fiberNumber} - ${fiberColorName}`}
      />
      {/* Tooltip */}
      <div className="
        absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1
        bg-gray-900 text-white text-[10px] rounded whitespace-nowrap
        opacity-0 group-hover:opacity-100 pointer-events-none z-50
        transition-opacity duration-200
      ">
        F{fiberNumber} ({fiberColorName})
        <br />
        <span className="text-gray-400">Tube {tubeNumber} • {status}</span>
      </div>
    </div>
  );
});
FiberDot.displayName = "FiberDot";

// TubeGrid component - displays all tubes and fibers for a cable
const TubeGrid: React.FC<{
  fiberCount: number;
  side: "A" | "B";
  onFiberClick: (fiber: number, tube: number) => void;
  onTubeClick: (tube: number) => void;
  selectedFiber: { fiber: number; tube: number } | null;
  selectedTube: number | null;
  getFiberStatus: (fiber: number) => "available" | "connected" | "pending";
}> = React.memo(({ fiberCount, side, onFiberClick, onTubeClick, selectedFiber, selectedTube, getFiberStatus }) => {
  const fibersPerTube = 12;
  const tubeCount = Math.ceil(fiberCount / fibersPerTube);

  // Generate tubes with fibers
  const tubes = useMemo(() => {
    const result = [];
    for (let tubeIdx = 0; tubeIdx < tubeCount; tubeIdx++) {
      const tubeNumber = tubeIdx + 1;
      const tubeColorIndex = tubeIdx % TUBE_COLORS.length;
      const tubeColor = TUBE_COLORS[tubeColorIndex];

      const fibers = [];
      for (let fiberInTube = 0; fiberInTube < fibersPerTube; fiberInTube++) {
        const fiberNumber = tubeIdx * fibersPerTube + fiberInTube + 1;
        if (fiberNumber > fiberCount) break;

        const fiberColorIndex = fiberInTube % FIBER_COLORS.length;
        const fiberColor = FIBER_COLORS[fiberColorIndex];

        fibers.push({
          fiberNumber,
          fiberColor: fiberColor.hex,
          fiberColorName: fiberColor.name,
          tubeNumber,
        });
      }

      result.push({
        tubeNumber,
        tubeColor,
        fibers,
      });
    }
    return result;
  }, [fiberCount, tubeCount]);

  // Split tubes into rows (3 tubes per row for compact display)
  const tubesPerRow = 3;
  const tubeRows = useMemo(() => {
    const rows = [];
    for (let i = 0; i < tubes.length; i += tubesPerRow) {
      rows.push(tubes.slice(i, i + tubesPerRow));
    }
    return rows;
  }, [tubes]);

  return (
    <div className="space-y-2">
      {tubeRows.map((row, rowIdx) => (
        <div key={rowIdx} className="flex gap-2 justify-center">
          {row.map((tube) => {
            const isTubeSelected = selectedTube === tube.tubeNumber;
            return (
              <div key={tube.tubeNumber} className="relative">
                {/* Tube Label Button */}
                <button
                  onClick={() => onTubeClick(tube.tubeNumber)}
                  className={`
                    w-full text-center mb-1 px-2 py-0.5 rounded text-[10px] font-semibold
                    transition-all duration-200 border
                    ${isTubeSelected
                      ? "bg-blue-500 text-white border-blue-600"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
                    }
                  `}
                  style={{
                    borderColor: isTubeSelected ? undefined : tube.tubeColor.hex,
                  }}
                >
                  T{tube.tubeNumber}
                </button>

                {/* Tube Container */}
                <div
                  className={`
                    rounded-lg p-1.5 border-2 shadow-sm transition-all duration-200
                    ${isTubeSelected ? "ring-2 ring-blue-400 ring-offset-1" : ""}
                  `}
                  style={{
                    backgroundColor: tube.tubeColor.hex + "20",
                    borderColor: tube.tubeColor.hex,
                  }}
                >
                  {/* Fiber Grid (3x4 layout for 12 fibers) */}
                  <div className="grid grid-cols-3 gap-1">
                    {tube.fibers.map((fiber) => {
                      const isSelected = selectedFiber?.fiber === fiber.fiberNumber;
                      const status = getFiberStatus(fiber.fiberNumber);
                      return (
                        <FiberDot
                          key={fiber.fiberNumber}
                          fiberNumber={fiber.fiberNumber}
                          tubeNumber={fiber.tubeNumber}
                          fiberColor={fiber.fiberColor}
                          fiberColorName={fiber.fiberColorName}
                          status={status}
                          isSelected={isSelected}
                          onClick={() => onFiberClick(fiber.fiberNumber, fiber.tubeNumber)}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Tube Color Name */}
                <div className="text-center mt-0.5">
                  <span className="text-[9px] text-gray-500">{tube.tubeColor.name}</span>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
});
TubeGrid.displayName = "TubeGrid";

export const SpliceMatrixPanel = React.memo(function SpliceMatrixPanel({
  isOpen,
  onClose,
  closureName,
  cableA,
  cableB,
  existingConnections,
  onSave,
}: SpliceMatrixPanelProps) {
  // Panel state - use lazy initializer for localStorage
  const [position, setPosition] = useState(() => {
    if (typeof window === "undefined") return { x: 100, y: 100 };
    const saved = localStorage.getItem("netlink:spliceMatrixPosition");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return { x: 100, y: 100 };
      }
    }
    return { x: 100, y: 100 };
  });
  const [isDragging, setIsDragging] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  // Connection state
  const [connections, setConnections] = useState<SpliceConnection[]>([]);
  const [selectedFiberA, setSelectedFiberA] = useState<{ fiber: number; tube: number } | null>(null);
  const [selectedFiberB, setSelectedFiberB] = useState<{ fiber: number; tube: number } | null>(null);
  const [selectedTubeA, setSelectedTubeA] = useState<number | null>(null);
  const [selectedTubeB, setSelectedTubeB] = useState<number | null>(null);
  const [showConnectionList, setShowConnectionList] = useState(false);

  // Track previous props for resetting connections (React-recommended pattern)
  const [prevExistingConnections, setPrevExistingConnections] = useState(existingConnections);
  const [prevCableACount, setPrevCableACount] = useState(cableA.fiberCount);
  const [prevCableBCount, setPrevCableBCount] = useState(cableB.fiberCount);

  // Initialize connections from existing props when they change (during render)
  if (
    existingConnections !== prevExistingConnections ||
    cableA.fiberCount !== prevCableACount ||
    cableB.fiberCount !== prevCableBCount
  ) {
    setPrevExistingConnections(existingConnections);
    setPrevCableACount(cableA.fiberCount);
    setPrevCableBCount(cableB.fiberCount);
    if (existingConnections.length > 0) {
      const initialConnections = existingConnections.map((conn) => {
        const fiberInfoA = getFiberInfo(conn.fiberA, cableA.fiberCount);
        const fiberInfoB = getFiberInfo(conn.fiberB, cableB.fiberCount);
        return {
          fiberA: conn.fiberA,
          fiberB: conn.fiberB,
          tubeA: fiberInfoA?.tubeNumber || 1,
          tubeB: fiberInfoB?.tubeNumber || 1,
          colorA: fiberInfoA?.fiberColor.name || "Unknown",
          colorB: fiberInfoB?.fiberColor.name || "Unknown",
          status: conn.status,
        };
      });
      setConnections(initialConnections);
    }
  }

  // Save position to localStorage
  useEffect(() => {
    localStorage.setItem("netlink:spliceMatrixPosition", JSON.stringify(position));
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

  // Check if fiber is connected
  const isFiberConnected = useCallback((side: "A" | "B", fiber: number): boolean => {
    return connections.some((c) => (side === "A" ? c.fiberA : c.fiberB) === fiber);
  }, [connections]);

  // Get fiber status
  const getFiberStatus = useCallback((side: "A" | "B", fiber: number): "available" | "connected" | "pending" => {
    const conn = connections.find((c) => (side === "A" ? c.fiberA : c.fiberB) === fiber);
    if (!conn) return "available";
    return conn.status === "completed" ? "connected" : "pending";
  }, [connections]);

  // Create connection between two fibers
  const createConnection = useCallback((fiberA: { fiber: number; tube: number }, fiberB: { fiber: number; tube: number }) => {
    const fiberInfoA = getFiberInfo(fiberA.fiber, cableA.fiberCount);
    const fiberInfoB = getFiberInfo(fiberB.fiber, cableB.fiberCount);

    const newConnection: SpliceConnection = {
      fiberA: fiberA.fiber,
      fiberB: fiberB.fiber,
      tubeA: fiberA.tube,
      tubeB: fiberB.tube,
      colorA: fiberInfoA?.fiberColor.name || "Unknown",
      colorB: fiberInfoB?.fiberColor.name || "Unknown",
      status: "pending",
    };

    setConnections((prev) => [...prev, newConnection]);
    setSelectedFiberA(null);
    setSelectedFiberB(null);
  }, [cableA.fiberCount, cableB.fiberCount]);

  // Handle fiber click on side A
  const handleFiberClickA = useCallback((fiber: number, tube: number) => {
    if (isFiberConnected("A", fiber)) return;

    // If same fiber clicked, deselect
    if (selectedFiberA?.fiber === fiber) {
      setSelectedFiberA(null);
      return;
    }

    setSelectedFiberA({ fiber, tube });

    // If fiber B is already selected, create connection
    if (selectedFiberB && !isFiberConnected("B", selectedFiberB.fiber)) {
      createConnection({ fiber, tube }, selectedFiberB);
    }
  }, [isFiberConnected, selectedFiberA, selectedFiberB, createConnection]);

  // Handle fiber click on side B
  const handleFiberClickB = useCallback((fiber: number, tube: number) => {
    if (isFiberConnected("B", fiber)) return;

    // If same fiber clicked, deselect
    if (selectedFiberB?.fiber === fiber) {
      setSelectedFiberB(null);
      return;
    }

    setSelectedFiberB({ fiber, tube });

    // If fiber A is already selected, create connection
    if (selectedFiberA && !isFiberConnected("A", selectedFiberA.fiber)) {
      createConnection(selectedFiberA, { fiber, tube });
    }
  }, [isFiberConnected, selectedFiberA, selectedFiberB, createConnection]);

  // Handle connect button
  const handleConnect = useCallback(() => {
    if (!selectedFiberA || !selectedFiberB) return;
    createConnection(selectedFiberA, selectedFiberB);
  }, [selectedFiberA, selectedFiberB, createConnection]);

  // Auto-match tube - uses functional update to avoid stale closure
  const handleAutoMatchTube = useCallback(() => {
    if (selectedTubeA === null || selectedTubeB === null) return;

    const fibersPerTube = 12;
    const tubeA = selectedTubeA;
    const tubeB = selectedTubeB;

    setConnections((prev) => {
      const newConnections: SpliceConnection[] = [];

      // Helper to check if fiber is already connected in current state
      const isConnectedA = (fiber: number) => prev.some(c => c.fiberA === fiber);
      const isConnectedB = (fiber: number) => prev.some(c => c.fiberB === fiber);

      for (let i = 1; i <= fibersPerTube; i++) {
        const fiberA = (tubeA - 1) * fibersPerTube + i;
        const fiberB = (tubeB - 1) * fibersPerTube + i;

        if (
          fiberA <= cableA.fiberCount &&
          fiberB <= cableB.fiberCount &&
          !isConnectedA(fiberA) &&
          !isConnectedB(fiberB)
        ) {
          const fiberInfoA = getFiberInfo(fiberA, cableA.fiberCount);
          const fiberInfoB = getFiberInfo(fiberB, cableB.fiberCount);

          newConnections.push({
            fiberA,
            fiberB,
            tubeA,
            tubeB,
            colorA: fiberInfoA?.fiberColor.name || "Unknown",
            colorB: fiberInfoB?.fiberColor.name || "Unknown",
            status: "pending",
          });
        }
      }

      return [...prev, ...newConnections];
    });

    setSelectedTubeA(null);
    setSelectedTubeB(null);
  }, [selectedTubeA, selectedTubeB, cableA.fiberCount, cableB.fiberCount]);

  // Auto-match all fibers 1:1 - uses functional update to avoid stale closure
  const handleAutoMatchAll = useCallback(() => {
    const maxFibers = Math.min(cableA.fiberCount, cableB.fiberCount);

    setConnections((prev) => {
      const newConnections: SpliceConnection[] = [];

      // Helper to check if fiber is already connected in current state
      const isConnectedA = (fiber: number) => prev.some(c => c.fiberA === fiber);
      const isConnectedB = (fiber: number) => prev.some(c => c.fiberB === fiber);

      for (let i = 1; i <= maxFibers; i++) {
        if (!isConnectedA(i) && !isConnectedB(i)) {
          const fiberInfoA = getFiberInfo(i, cableA.fiberCount);
          const fiberInfoB = getFiberInfo(i, cableB.fiberCount);

          newConnections.push({
            fiberA: i,
            fiberB: i,
            tubeA: fiberInfoA?.tubeNumber || 1,
            tubeB: fiberInfoB?.tubeNumber || 1,
            colorA: fiberInfoA?.fiberColor.name || "Unknown",
            colorB: fiberInfoB?.fiberColor.name || "Unknown",
            status: "pending",
          });
        }
      }

      return [...prev, ...newConnections];
    });
  }, [cableA.fiberCount, cableB.fiberCount]);

  // Delete a single connection
  const handleDeleteConnection = useCallback((fiberA: number, fiberB: number) => {
    setConnections((prev) => prev.filter((c) => !(c.fiberA === fiberA && c.fiberB === fiberB)));
  }, []);

  // Clear all pending connections
  const handleClearPending = useCallback(() => {
    setConnections((prev) => prev.filter((c) => c.status === "completed"));
    setSelectedFiberA(null);
    setSelectedFiberB(null);
    setSelectedTubeA(null);
    setSelectedTubeB(null);
  }, []);

  // Clear selection
  const handleClearSelection = useCallback(() => {
    setSelectedFiberA(null);
    setSelectedFiberB(null);
  }, []);

  // Save changes
  const handleSave = useCallback(() => {
    onSave(connections);
    onClose();
  }, [connections, onSave, onClose]);

  // Selection text
  const selectionText = useMemo(() => {
    if (selectedFiberA && selectedFiberB) {
      const fiberInfoA = getFiberInfo(selectedFiberA.fiber, cableA.fiberCount);
      const fiberInfoB = getFiberInfo(selectedFiberB.fiber, cableB.fiberCount);
      return `Ready: T${selectedFiberA.tube}-F${selectedFiberA.fiber} (${fiberInfoA?.fiberColor.name}) ↔ T${selectedFiberB.tube}-F${selectedFiberB.fiber} (${fiberInfoB?.fiberColor.name})`;
    }
    if (selectedFiberA) {
      const fiberInfoA = getFiberInfo(selectedFiberA.fiber, cableA.fiberCount);
      return `Selected A: T${selectedFiberA.tube}-F${selectedFiberA.fiber} (${fiberInfoA?.fiberColor.name}) → Click fiber on Cable B`;
    }
    if (selectedFiberB) {
      const fiberInfoB = getFiberInfo(selectedFiberB.fiber, cableB.fiberCount);
      return `Selected B: T${selectedFiberB.tube}-F${selectedFiberB.fiber} (${fiberInfoB?.fiberColor.name}) → Click fiber on Cable A`;
    }
    return "Click a fiber to start connecting";
  }, [selectedFiberA, selectedFiberB, cableA.fiberCount, cableB.fiberCount]);

  // Stats
  const completedCount = connections.filter((c) => c.status === "completed").length;
  const pendingCount = connections.filter((c) => c.status === "pending").length;
  const totalConnections = completedCount + pendingCount;

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      className={`
        fixed z-50 bg-white rounded-xl shadow-2xl border border-gray-200
        transition-all duration-200 select-none
        ${isDragging ? "cursor-grabbing" : "cursor-grab"}
      `}
      style={{
        left: position.x,
        top: position.y,
        width: isMinimized ? 320 : 580,
        maxHeight: "90vh",
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-gradient-to-r from-indigo-50 to-purple-50 rounded-t-xl">
        <div className="flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-gray-400" />
          <Zap className="w-4 h-4 text-indigo-500" />
          <span className="text-sm font-semibold text-gray-700">
            Splice Matrix: {closureName}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            data-no-drag
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 hover:bg-white/50 rounded transition-colors"
          >
            {isMinimized ? <Maximize2 className="w-4 h-4 text-gray-500" /> : <Minimize2 className="w-4 h-4 text-gray-500" />}
          </button>
          <button
            data-no-drag
            onClick={onClose}
            className="p-1 hover:bg-white/50 rounded transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <div className="overflow-y-auto" style={{ maxHeight: "calc(90vh - 48px)" }}>
          {/* Cable Headers */}
          <div className="px-4 py-2 border-b bg-gray-50 flex items-center justify-between">
            <div className="text-center flex-1">
              <div className="text-xs font-bold text-gray-800">{cableA.name}</div>
              <div className="text-[10px] text-gray-500">{cableA.fiberCount}F</div>
            </div>
            <Link2 className="w-4 h-4 text-gray-400 mx-2" />
            <div className="text-center flex-1">
              <div className="text-xs font-bold text-gray-800">{cableB.name}</div>
              <div className="text-[10px] text-gray-500">{cableB.fiberCount}F</div>
            </div>
          </div>

          {/* Tube Grids */}
          <div className="flex gap-4 p-4" data-no-drag>
            <div className="flex-1">
              <TubeGrid
                fiberCount={cableA.fiberCount}
                side="A"
                onFiberClick={handleFiberClickA}
                onTubeClick={setSelectedTubeA}
                selectedFiber={selectedFiberA}
                selectedTube={selectedTubeA}
                getFiberStatus={(fiber) => getFiberStatus("A", fiber)}
              />
            </div>
            <div className="w-px bg-gradient-to-b from-transparent via-gray-300 to-transparent" />
            <div className="flex-1">
              <TubeGrid
                fiberCount={cableB.fiberCount}
                side="B"
                onFiberClick={handleFiberClickB}
                onTubeClick={setSelectedTubeB}
                selectedFiber={selectedFiberB}
                selectedTube={selectedTubeB}
                getFiberStatus={(fiber) => getFiberStatus("B", fiber)}
              />
            </div>
          </div>

          {/* Legend */}
          <div className="px-4 py-2 border-t border-b bg-gray-50 flex items-center gap-4 text-[10px]">
            <span className="font-medium text-gray-600">Legend:</span>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-gray-300 ring-1 ring-gray-300" />
              <span>Available</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-green-500 ring-2 ring-green-500" />
              <span>Connected</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-amber-500 ring-2 ring-amber-500 animate-pulse" />
              <span>Pending</span>
            </div>
          </div>

          {/* Selection Info */}
          <div className="px-4 py-2 border-b bg-blue-50" data-no-drag>
            <div className="flex items-center justify-between">
              <span className="text-xs text-blue-800">{selectionText}</span>
              {(selectedFiberA || selectedFiberB) && (
                <button
                  onClick={handleClearSelection}
                  className="text-[10px] text-blue-600 hover:text-blue-800 underline"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="px-4 py-2 border-b flex flex-wrap items-center gap-2" data-no-drag>
            <button
              onClick={handleConnect}
              disabled={!selectedFiberA || !selectedFiberB}
              className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
            >
              <Check className="w-3 h-3" />
              Connect
            </button>
            <button
              onClick={handleAutoMatchTube}
              disabled={selectedTubeA === null || selectedTubeB === null}
              className="px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Match Tubes
            </button>
            <button
              onClick={handleAutoMatchAll}
              className="px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
            >
              Match All 1:1
            </button>
            <button
              onClick={handleClearPending}
              disabled={pendingCount === 0}
              className="px-3 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors ml-auto"
            >
              Clear Pending
            </button>
          </div>

          {/* Connection List Toggle */}
          <div className="px-4 py-2 border-b bg-gray-50" data-no-drag>
            <button
              onClick={() => setShowConnectionList(!showConnectionList)}
              className="text-xs text-gray-600 hover:text-gray-800 flex items-center gap-1"
            >
              {showConnectionList ? "▼" : "▶"} Connections ({totalConnections})
            </button>
          </div>

          {/* Connection List */}
          {showConnectionList && totalConnections > 0 && (
            <div className="px-4 py-2 max-h-40 overflow-y-auto border-b bg-white" data-no-drag>
              <div className="space-y-1">
                {connections.map((conn) => {
                  const fiberInfoA = getFiberInfo(conn.fiberA, cableA.fiberCount);
                  const fiberInfoB = getFiberInfo(conn.fiberB, cableB.fiberCount);
                  return (
                    <div
                      key={`${conn.fiberA}-${conn.fiberB}`}
                      className={`
                        flex items-center justify-between text-[11px] px-2 py-1 rounded
                        ${conn.status === "pending" ? "bg-amber-50" : "bg-green-50"}
                      `}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: fiberInfoA?.fiberColor.hex }}
                        />
                        <span>T{conn.tubeA}-F{conn.fiberA}</span>
                        <span className="text-gray-400">↔</span>
                        <span>T{conn.tubeB}-F{conn.fiberB}</span>
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: fiberInfoB?.fiberColor.hex }}
                        />
                        <span className={`px-1 rounded text-[9px] ${conn.status === "pending" ? "bg-amber-200 text-amber-800" : "bg-green-200 text-green-800"}`}>
                          {conn.status}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteConnection(conn.fiberA, conn.fiberB)}
                        className="p-1 text-red-500 hover:text-red-700 hover:bg-red-100 rounded transition-colors"
                        title="Delete connection"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="px-4 py-2 bg-gradient-to-r from-green-50 to-amber-50 border-b">
            <div className="flex items-center justify-between text-xs">
              <span>
                <span className="font-semibold text-green-700">{completedCount}</span> completed
              </span>
              <span className="text-gray-400">•</span>
              <span>
                <span className="font-semibold text-amber-700">{pendingCount}</span> pending
              </span>
              <span className="text-gray-400">•</span>
              <span>
                <span className="font-semibold">{totalConnections}</span> / {Math.min(cableA.fiberCount, cableB.fiberCount)}
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 py-3 bg-gray-50 rounded-b-xl flex justify-end gap-2" data-no-drag>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={pendingCount === 0 && completedCount === 0}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40 transition-colors flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              Save ({pendingCount + completedCount})
            </button>
          </div>
        </div>
      )}

      {isMinimized && (
        <div className="px-4 py-2 text-xs text-gray-500">
          {totalConnections} connections ({completedCount} completed, {pendingCount} pending)
        </div>
      )}
    </div>
  );
});

export default SpliceMatrixPanel;
