"use client";

import React, { useState, useCallback, useRef, useEffect, memo } from "react";
import {
  X,
  GripVertical,
  Minimize2,
  Maximize2,
  Loader2,
  AlertCircle,
  Route,
  Zap,
  TrendingUp,
  User,
  Box,
  MapPin,
} from "lucide-react";
import { useFiberPathTracing } from "@/hooks/useFiberPathTracing";
import type { FiberPath, FiberPathTraceResult, FiberPathNodeType } from "@/types/splice-matrix";

interface FiberPathPanelProps {
  isOpen: boolean;
  onClose: () => void;
  startNodeId: string;
  startNodeType: string;
  startDbId: number;
  startFiber?: number;
  edges?: any[]; // React Flow edges for path detection
  onHighlightPath: (nodeIds: string[], edgeIds: string[]) => void;
  onClearHighlight: () => void;
}

function getNodeIcon(nodeType: string): string {
  switch (nodeType) {
    case 'olt':
      return '🏢';
    case 'odf':
      return '📦';
    case 'splice-closure':
    case 'closure':
      return '📍';
    case 'lcp':
    case 'fdt':
      return '🔀';
    case 'nap':
    case 'fat':
      return '📍';
    default:
      return '🔷';
  }
}

function getNodeLabel(nodeType: string): string {
  switch (nodeType) {
    case 'olt':
      return 'OLT';
    case 'odf':
      return 'ODF';
    case 'splice-closure':
    case 'closure':
      return 'Closure';
    case 'lcp':
      return 'LCP';
    case 'fdt':
      return 'FDT';
    case 'nap':
      return 'NAP';
    case 'fat':
      return 'FAT';
    default:
      return nodeType.toUpperCase();
  }
}

const FiberPathPanel = memo(function FiberPathPanel({
  isOpen,
  onClose,
  startNodeId,
  startNodeType,
  startDbId,
  startFiber,
  edges,
  onHighlightPath,
  onClearHighlight,
}: FiberPathPanelProps) {
  const [position, setPosition] = useState({ x: 220, y: 120 });
  const [isDragging, setIsDragging] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [traceResult, setTraceResult] = useState<FiberPathTraceResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isHighlighted, setIsHighlighted] = useState(false);

  const dragOffset = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);
  const { tracePath } = useFiberPathTracing();

  // Load position from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("netlink:fiberPathPanelPosition");
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
    localStorage.setItem("netlink:fiberPathPanelPosition", JSON.stringify(position));
  }, [position]);

  // Trace the path when panel opens or start point changes
  useEffect(() => {
    if (!isOpen) return;

    const loadPath = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await tracePath(startNodeType as FiberPathNodeType, startDbId, startFiber, edges);
        if (result.success && result.path) {
          setTraceResult(result);
        } else {
          setError(result.error || "Failed to trace fiber path. Please check the connections.");
          setTraceResult(null);
        }
      } catch (err) {
        console.error("Failed to trace fiber path:", err);
        setError("Failed to trace fiber path. Please check the connections.");
        setTraceResult(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadPath();
  }, [isOpen, startNodeType, startDbId, startFiber, edges, tracePath]);

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

  // Highlight path handler
  const handleHighlightPath = useCallback(() => {
    if (!traceResult) return;
    onHighlightPath(traceResult.highlightedNodeIds, traceResult.highlightedEdgeIds);
    setIsHighlighted(true);
  }, [traceResult, onHighlightPath]);

  // Clear highlight handler
  const handleClearHighlight = useCallback(() => {
    onClearHighlight();
    setIsHighlighted(false);
  }, [onClearHighlight]);

  // Close handler
  const handleClose = useCallback(() => {
    handleClearHighlight();
    onClose();
  }, [handleClearHighlight, onClose]);

  if (!isOpen) return null;

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
        width: isMinimized ? 300 : 420,
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-xl">
        <div className="flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-gray-400" />
          <Route className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-semibold text-gray-700">Fiber Path</span>
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
            onClick={handleClose}
            className="p-1 hover:bg-white/50 rounded transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Loading State */}
          {isLoading && (
            <div className="p-8 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              <p className="text-sm text-gray-500">Tracing fiber path...</p>
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div className="p-6 flex flex-col items-center justify-center gap-3">
              <AlertCircle className="w-8 h-8 text-red-500" />
              <p className="text-sm text-red-600 text-center">{error}</p>
              <button
                data-no-drag
                onClick={handleClose}
                className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          )}

          {/* Path Display */}
          {traceResult?.path && !isLoading && !error && (
            <>
              {/* Path Segments */}
              <div className="max-h-[400px] overflow-y-auto p-4" data-no-drag>
                <div className="space-y-1">
                  {traceResult.path.segments.map((segment, idx) => (
                    <div key={segment.nodeId}>
                      {/* Node */}
                      <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                        <span className="text-xl" role="img" aria-label={segment.nodeType}>
                          {getNodeIcon(segment.nodeType)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-800 truncate">
                              {segment.nodeName}
                            </span>
                            <span className="text-xs text-gray-500 px-1.5 py-0.5 bg-white rounded">
                              {getNodeLabel(segment.nodeType)}
                            </span>
                          </div>
                          {/* Fiber Info */}
                          <div className="text-xs text-gray-600 mt-0.5">
                            {segment.fiberIn && (
                              <span>
                                In: F{segment.fiberIn.number} ({segment.fiberIn.color})
                              </span>
                            )}
                            {segment.fiberIn && segment.fiberOut && (
                              <span className="mx-1">→</span>
                            )}
                            {segment.fiberOut && (
                              <span>
                                Out: F{segment.fiberOut.number} ({segment.fiberOut.color})
                              </span>
                            )}
                          </div>
                          {/* Splice Info */}
                          {segment.spliceInfo && (
                            <div className={`text-xs mt-0.5 flex items-center gap-1 ${
                              segment.spliceInfo.loss > 10 ? 'text-red-600' :
                              segment.spliceInfo.loss > 5 ? 'text-amber-600' : 'text-green-600'
                            }`}>
                              <Zap className="w-3 h-3" />
                              Splice: Tray {segment.spliceInfo.trayNumber}, Loss: {segment.spliceInfo.loss.toFixed(2)} dB
                              {segment.spliceInfo.status !== "completed" && (
                                <span className="text-[10px] px-1 py-0.5 bg-yellow-100 text-yellow-700 rounded">
                                  {segment.spliceInfo.status}
                                </span>
                              )}
                            </div>
                          )}
                          {/* Splitter Info */}
                          {segment.splitterInfo && (
                            <div className="text-xs text-orange-600 mt-0.5 flex items-center gap-1">
                              <Box className="w-3 h-3" />
                              Splitter: {segment.splitterInfo.type} (Port {segment.splitterInfo.inputPort} → {segment.splitterInfo.outputPort})
                            </div>
                          )}
                          {/* Customer Info */}
                          {segment.portInfo?.customerName && (
                            <div className="text-xs text-blue-600 mt-0.5 flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {segment.portInfo.customerName}
                              {segment.portInfo.customerAddress && (
                                <span className="text-gray-400">- {segment.portInfo.customerAddress}</span>
                              )}
                              {segment.portInfo.serviceId && (
                                <span className="text-gray-400">({segment.portInfo.serviceId})</span>
                              )}
                            </div>
                          )}
                          {/* Cable Info */}
                          {segment.cableInfo && (
                            <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                              Cable: {segment.cableInfo.name} ({segment.cableInfo.fiberCount}F)
                              {segment.cableInfo.distance && (
                                <span>- {segment.cableInfo.distance}m</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Connector Line */}
                      {traceResult.path && idx < traceResult.path.segments.length - 1 && (
                        <div className="flex justify-center py-1">
                          <div className="w-0.5 h-4 bg-gradient-to-b from-blue-300 to-blue-400"></div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary Footer */}
              <div className="px-4 py-3 border-t bg-gray-50 rounded-b-xl">
                {/* Stats */}
                <div className="flex items-center justify-between mb-3 text-xs">
                  <div className="flex items-center gap-1 text-gray-600">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span className="font-medium">Total Loss:</span>
                    <span className={`font-bold ${
                      traceResult.path.totalLoss > 10 ? 'text-red-600' :
                      traceResult.path.totalLoss > 5 ? 'text-amber-600' : 'text-green-600'
                    }`}>
                      {traceResult.path.totalLoss.toFixed(2)} dB
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-gray-600">
                    <Zap className="w-3.5 h-3.5" />
                    <span className="font-medium">Splices:</span>
                    <span className="font-bold">{traceResult.path.spliceCount}</span>
                  </div>
                  <div className="flex items-center gap-1 text-gray-600">
                    <Box className="w-3.5 h-3.5" />
                    <span className="font-medium">Connectors:</span>
                    <span className="font-bold">{traceResult.path.connectorCount}</span>
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex justify-end gap-2">
                  {isHighlighted ? (
                    <button
                      data-no-drag
                      onClick={handleClearHighlight}
                      className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                    >
                      Clear
                    </button>
                  ) : (
                    <button
                      data-no-drag
                      onClick={handleHighlightPath}
                      className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                    >
                      Highlight Path
                    </button>
                  )}
                  <button
                    data-no-drag
                    onClick={handleClose}
                    className="px-3 py-1.5 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Minimized View */}
      {isMinimized && (
        <div className="px-4 py-2 text-xs text-gray-500">
          {isLoading && "Tracing path..."}
          {error && "Error tracing path"}
          {traceResult?.path && (
            <>
              {traceResult.path.segments.length} nodes | Loss: {traceResult.path.totalLoss.toFixed(2)} dB | {traceResult.path.spliceCount} splices
            </>
          )}
        </div>
      )}
    </div>
  );
});

export default FiberPathPanel;
