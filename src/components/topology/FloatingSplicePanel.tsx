"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  X,
  GripVertical,
  Plus,
  Trash2,
  Save,
  Check,
  AlertCircle,
  Minimize2,
  Maximize2,
  Link2,
} from "lucide-react";
import { FIBER_COLORS, getFiberInfo } from "@/lib/fiberColors";

interface FiberConnection {
  id?: number;
  fiberA: number;
  fiberB: number;
  colorA: string;
  colorB: string;
  tubeA?: number;
  tubeB?: number;
  status: "completed" | "pending" | "failed";
  loss?: number;
}

interface FloatingSplicePanelProps {
  isOpen: boolean;
  onClose: () => void;
  edgeId: string;
  cableAName: string;
  cableBName: string;
  fiberCountA: number;
  fiberCountB: number;
  connections: FiberConnection[];
  onSave: (connections: FiberConnection[]) => void;
}

export function FloatingSplicePanel({
  isOpen,
  onClose,
  edgeId,
  cableAName,
  cableBName,
  fiberCountA,
  fiberCountB,
  connections: initialConnections,
  onSave,
}: FloatingSplicePanelProps) {
  const [position, setPosition] = useState({ x: 200, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [connections, setConnections] = useState<FiberConnection[]>(initialConnections);
  const [selectedFiberA, setSelectedFiberA] = useState<number | null>(null);
  const [selectedFiberB, setSelectedFiberB] = useState<number | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  // Update connections when props change
  useEffect(() => {
    setConnections(initialConnections);
  }, [initialConnections]);

  // Load position from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("netlink:splicePanelPosition");
    if (saved) {
      try {
        setPosition(JSON.parse(saved));
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  // Save position to localStorage
  useEffect(() => {
    localStorage.setItem("netlink:splicePanelPosition", JSON.stringify(position));
  }, [position]);

  // Handle panel dragging
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest("[data-no-drag]")) return;
      setIsDragging(true);
      dragOffset.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      };
    },
    [position]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      const newX = Math.max(0, e.clientX - dragOffset.current.x);
      const newY = Math.max(0, e.clientY - dragOffset.current.y);
      setPosition({ x: newX, y: newY });
    },
    [isDragging]
  );

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

  // Get fiber color using getFiberInfo
  const getFiberColorDisplay = (fiberNumber: number): { color: string; name: string } => {
    const fiberInfo = getFiberInfo(fiberNumber, 96); // Assume 96 fiber cable
    if (fiberInfo) {
      return { color: fiberInfo.fiberColor.hex, name: fiberInfo.fiberColor.name };
    }
    // Fallback - use fiber colors directly
    const fiberInTube = ((fiberNumber - 1) % 12);
    const colorInfo = FIBER_COLORS[fiberInTube] || FIBER_COLORS[0];
    return { color: colorInfo.hex, name: colorInfo.name };
  };

  // Check if fiber is already connected
  const isFiberConnected = (side: "A" | "B", fiberNumber: number): boolean => {
    return connections.some(
      (c) => (side === "A" ? c.fiberA : c.fiberB) === fiberNumber
    );
  };

  // Add new connection
  const handleAddConnection = () => {
    if (selectedFiberA === null || selectedFiberB === null) return;
    if (isFiberConnected("A", selectedFiberA) || isFiberConnected("B", selectedFiberB)) return;

    const colorA = getFiberColorDisplay(selectedFiberA);
    const colorB = getFiberColorDisplay(selectedFiberB);

    const newConnection: FiberConnection = {
      fiberA: selectedFiberA,
      fiberB: selectedFiberB,
      colorA: colorA.name,
      colorB: colorB.name,
      tubeA: Math.ceil(selectedFiberA / 12),
      tubeB: Math.ceil(selectedFiberB / 12),
      status: "pending",
    };

    setConnections([...connections, newConnection]);
    setSelectedFiberA(null);
    setSelectedFiberB(null);
  };

  // Remove connection
  const handleRemoveConnection = (index: number) => {
    setConnections(connections.filter((_, i) => i !== index));
  };

  // Toggle connection status
  const handleToggleStatus = (index: number) => {
    setConnections(
      connections.map((c, i) =>
        i === index
          ? { ...c, status: c.status === "completed" ? "pending" : "completed" }
          : c
      )
    );
  };

  // Auto-match fibers (1-to-1 mapping)
  const handleAutoMatch = () => {
    const newConnections: FiberConnection[] = [];
    const maxFibers = Math.min(fiberCountA, fiberCountB);

    for (let i = 1; i <= maxFibers; i++) {
      if (!isFiberConnected("A", i) && !isFiberConnected("B", i)) {
        const colorA = getFiberColorDisplay(i);
        const colorB = getFiberColorDisplay(i);
        newConnections.push({
          fiberA: i,
          fiberB: i,
          colorA: colorA.name,
          colorB: colorB.name,
          tubeA: Math.ceil(i / 12),
          tubeB: Math.ceil(i / 12),
          status: "pending",
        });
      }
    }
    setConnections([...connections, ...newConnections]);
  };

  // Save and close
  const handleSave = () => {
    onSave(connections);
    onClose();
  };

  if (!isOpen) return null;

  const completedCount = connections.filter((c) => c.status === "completed").length;
  const pendingCount = connections.filter((c) => c.status === "pending").length;

  return (
    <div
      ref={panelRef}
      className={`
        fixed z-50 bg-white rounded-xl shadow-2xl border border-gray-200
        transition-all duration-200 select-none
        ${isDragging ? "cursor-grabbing shadow-3xl" : "cursor-grab"}
      `}
      style={{
        left: position.x,
        top: position.y,
        width: isMinimized ? 280 : 480,
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-gradient-to-r from-purple-50 to-blue-50 rounded-t-xl">
        <div className="flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-gray-400" />
          <Link2 className="w-4 h-4 text-purple-500" />
          <span className="text-sm font-semibold text-gray-700">Splice Editor</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            data-no-drag
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 hover:bg-white/50 rounded transition-colors"
          >
            {isMinimized ? (
              <Maximize2 className="w-4 h-4 text-gray-500" />
            ) : (
              <Minimize2 className="w-4 h-4 text-gray-500" />
            )}
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
        <>
          {/* Cable Info */}
          <div className="px-4 py-3 border-b bg-gray-50">
            <div className="flex justify-between items-center text-xs">
              <div className="text-center flex-1">
                <div className="font-medium text-gray-800">{cableAName}</div>
                <div className="text-gray-500">{fiberCountA} fibers</div>
              </div>
              <div className="px-4 text-gray-400">↔</div>
              <div className="text-center flex-1">
                <div className="font-medium text-gray-800">{cableBName}</div>
                <div className="text-gray-500">{fiberCountB} fibers</div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="px-4 py-2 flex items-center justify-between text-xs border-b">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-green-600">
                <Check className="w-3 h-3" />
                {completedCount} completed
              </span>
              <span className="flex items-center gap-1 text-amber-600">
                <AlertCircle className="w-3 h-3" />
                {pendingCount} pending
              </span>
            </div>
            <button
              data-no-drag
              onClick={handleAutoMatch}
              className="px-2 py-1 text-xs bg-purple-100 text-purple-600 rounded hover:bg-purple-200 transition-colors"
            >
              Auto-Match
            </button>
          </div>

          {/* Fiber Selection */}
          <div className="p-3 border-b" data-no-drag>
            <div className="text-xs font-medium text-gray-500 mb-2">Add Connection</div>
            <div className="flex items-center gap-2">
              {/* Fiber A selector */}
              <select
                value={selectedFiberA ?? ""}
                onChange={(e) => setSelectedFiberA(e.target.value ? parseInt(e.target.value) : null)}
                className="flex-1 text-xs border rounded px-2 py-1.5 bg-white"
              >
                <option value="">Select Fiber A</option>
                {Array.from({ length: fiberCountA }, (_, i) => i + 1).map((f) => {
                  const color = getFiberColorDisplay(f);
                  const isConnected = isFiberConnected("A", f);
                  return (
                    <option key={f} value={f} disabled={isConnected}>
                      F{f} ({color.name}){isConnected ? " ✓" : ""}
                    </option>
                  );
                })}
              </select>

              <span className="text-gray-400">↔</span>

              {/* Fiber B selector */}
              <select
                value={selectedFiberB ?? ""}
                onChange={(e) => setSelectedFiberB(e.target.value ? parseInt(e.target.value) : null)}
                className="flex-1 text-xs border rounded px-2 py-1.5 bg-white"
              >
                <option value="">Select Fiber B</option>
                {Array.from({ length: fiberCountB }, (_, i) => i + 1).map((f) => {
                  const color = getFiberColorDisplay(f);
                  const isConnected = isFiberConnected("B", f);
                  return (
                    <option key={f} value={f} disabled={isConnected}>
                      F{f} ({color.name}){isConnected ? " ✓" : ""}
                    </option>
                  );
                })}
              </select>

              <button
                onClick={handleAddConnection}
                disabled={selectedFiberA === null || selectedFiberB === null}
                className="p-1.5 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Connections List */}
          <div className="max-h-[300px] overflow-y-auto" data-no-drag>
            {connections.length === 0 ? (
              <div className="p-4 text-center text-gray-400 text-sm">
                No connections yet. Select fibers above or use Auto-Match.
              </div>
            ) : (
              <div className="divide-y">
                {connections.map((conn, idx) => {
                  const colorA = getFiberColorDisplay(conn.fiberA);
                  const colorB = getFiberColorDisplay(conn.fiberB);
                  return (
                    <div
                      key={idx}
                      className={`
                        px-4 py-2 flex items-center gap-3 hover:bg-gray-50
                        ${conn.status === "completed" ? "bg-green-50/50" : ""}
                      `}
                    >
                      {/* Fiber A */}
                      <div className="flex items-center gap-1.5 min-w-[80px]">
                        <span
                          className="w-3 h-3 rounded-full border border-white shadow"
                          style={{ backgroundColor: colorA.color }}
                        />
                        <span className="text-xs text-gray-700">F{conn.fiberA}</span>
                      </div>

                      <span className="text-gray-300">↔</span>

                      {/* Fiber B */}
                      <div className="flex items-center gap-1.5 min-w-[80px]">
                        <span
                          className="w-3 h-3 rounded-full border border-white shadow"
                          style={{ backgroundColor: colorB.color }}
                        />
                        <span className="text-xs text-gray-700">F{conn.fiberB}</span>
                      </div>

                      {/* Status toggle */}
                      <button
                        onClick={() => handleToggleStatus(idx)}
                        className={`
                          px-2 py-0.5 rounded text-[10px] font-medium transition-colors
                          ${conn.status === "completed"
                            ? "bg-green-100 text-green-700 hover:bg-green-200"
                            : "bg-amber-100 text-amber-700 hover:bg-amber-200"
                          }
                        `}
                      >
                        {conn.status === "completed" ? "Done" : "Pending"}
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => handleRemoveConnection(idx)}
                        className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors ml-auto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t bg-gray-50 rounded-b-xl flex justify-end gap-2">
            <button
              data-no-drag
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              data-no-drag
              onClick={handleSave}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-1"
            >
              <Save className="w-3.5 h-3.5" />
              Save Changes
            </button>
          </div>
        </>
      )}

      {isMinimized && (
        <div className="px-4 py-2 text-xs text-gray-500">
          {completedCount + pendingCount} connections ({completedCount} completed)
        </div>
      )}
    </div>
  );
}

export default FloatingSplicePanel;
