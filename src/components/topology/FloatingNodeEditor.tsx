"use client";

import { useState, useCallback, useRef, useEffect, memo } from "react";
import {
  X,
  GripVertical,
  Save,
  Server,
  Box,
  Network,
  GitBranch,
  Link2,
  MapPin,
  Minimize2,
  Maximize2,
  Layers,
  Users,
  Loader2,
} from "lucide-react";
import { db } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import type { Enclosure } from "@/types";

interface FloatingNodeEditorProps {
  isOpen: boolean;
  nodeId: string;
  nodeType: string;
  dbId: number;
  onClose: () => void;
  onOpenGPSPicker?: (nodeId: string, nodeType: string, dbId: number) => void;
  onOpenPortManager?: (napId: number, napName: string) => void;
  onOpenTrayManager?: (closureId: number, closureName: string) => void;
}

// Node type icons
const nodeIcons: Record<string, React.ReactNode> = {
  olt: <Server className="w-4 h-4 text-teal-600" />,
  odf: <Box className="w-4 h-4 text-cyan-600" />,
  closure: <Network className="w-4 h-4 text-purple-600" />,
  "splice-closure": <Network className="w-4 h-4 text-purple-600" />,
  lcp: <GitBranch className="w-4 h-4 text-orange-600" />,
  fdt: <GitBranch className="w-4 h-4 text-orange-600" />,
  nap: <Link2 className="w-4 h-4 text-blue-600" />,
  fat: <Link2 className="w-4 h-4 text-blue-600" />,
};

// Node type background colors
const nodeBgColors: Record<string, string> = {
  olt: "from-teal-50 to-teal-100",
  odf: "from-cyan-50 to-cyan-100",
  closure: "from-purple-50 to-purple-100",
  "splice-closure": "from-purple-50 to-purple-100",
  lcp: "from-orange-50 to-orange-100",
  fdt: "from-orange-50 to-orange-100",
  nap: "from-blue-50 to-blue-100",
  fat: "from-blue-50 to-blue-100",
};

// Node type labels
const nodeLabels: Record<string, string> = {
  olt: "OLT",
  odf: "ODF",
  closure: "Closure",
  "splice-closure": "Closure",
  lcp: "LCP",
  fdt: "FDT",
  nap: "NAP",
  fat: "FAT",
};

export const FloatingNodeEditor = memo(function FloatingNodeEditor({
  isOpen,
  nodeId,
  nodeType,
  dbId,
  onClose,
  onOpenGPSPicker,
  onOpenPortManager,
  onOpenTrayManager,
}: FloatingNodeEditorProps) {
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [model, setModel] = useState("");
  const [totalPonPorts, setTotalPonPorts] = useState(16);
  const [portCount, setPortCount] = useState(48);
  const [enclosureType, setEnclosureType] = useState<string>("splice-closure");

  // Fetch node data reactively
  const nodeData = useLiveQuery(async () => {
    if (!dbId) return null;

    if (nodeType === "olt") {
      const olt = await db.olts.get(dbId);
      return olt ? { ...olt, _type: "olt" as const } : null;
    } else if (nodeType === "odf") {
      const odf = await db.odfs.get(dbId);
      return odf ? { ...odf, _type: "odf" as const } : null;
    } else {
      const enclosure = await db.enclosures.get(dbId);
      return enclosure ? { ...enclosure, _type: "enclosure" as const } : null;
    }
  }, [nodeType, dbId]);

  // Fetch related counts
  const relatedCounts = useLiveQuery(async () => {
    if (!dbId) return { trays: 0, splices: 0, ports: 0, splitters: 0 };

    const trays = await db.trays.where("enclosureId").equals(dbId).count();
    const ports = await db.ports.where("enclosureId").equals(dbId).count();
    const splitters = await db.splitters.where("enclosureId").equals(dbId).count();

    // Count splices across all trays
    const trayIds = await db.trays.where("enclosureId").equals(dbId).primaryKeys();
    let splices = 0;
    for (const trayId of trayIds) {
      if (trayId !== undefined) {
        splices += await db.splices.where("trayId").equals(trayId).count();
      }
    }

    return { trays, splices, ports, splitters };
  }, [dbId]);

  // Load position from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("netlink:nodeEditorPosition");
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
    localStorage.setItem("netlink:nodeEditorPosition", JSON.stringify(position));
  }, [position]);

  // Update form state when node data changes
  useEffect(() => {
    if (nodeData) {
      if (nodeData._type === "olt") {
        setName(nodeData.name || "");
        setAddress(nodeData.address || "");
        setModel(nodeData.model || "");
        setTotalPonPorts(nodeData.totalPonPorts || 16);
      } else if (nodeData._type === "odf") {
        setName(nodeData.name || "");
        setAddress(nodeData.location || "");
        setPortCount(nodeData.portCount || 48);
      } else {
        setName(nodeData.name || "");
        setAddress(nodeData.address || "");
        setEnclosureType(nodeData.type || "splice-closure");
      }
      setHasChanges(false);
    }
  }, [nodeData]);

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

  // Auto-save with debounce
  const triggerAutoSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      handleSave();
    }, 1000);
  }, []);

  // Mark changes and trigger auto-save
  const markChanged = useCallback(() => {
    setHasChanges(true);
    triggerAutoSave();
  }, [triggerAutoSave]);

  // Save changes
  const handleSave = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (nodeType === "olt") {
        await db.olts.update(dbId, {
          name: name.trim(),
          address: address.trim() || undefined,
          totalPonPorts,
          model: model.trim() || undefined,
        });
      } else if (nodeType === "odf") {
        await db.odfs.update(dbId, {
          name: name.trim(),
          location: address.trim() || undefined,
          portCount,
        });
      } else {
        await db.enclosures.update(dbId, {
          name: name.trim(),
          address: address.trim() || undefined,
          type: enclosureType as Enclosure["type"],
        });
      }
      setHasChanges(false);
    } catch (err) {
      console.error("Failed to save node:", err);
      setError("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  if (!isOpen) return null;

  const bgColor = nodeBgColors[nodeType] || nodeBgColors.closure;
  const gpsLat = nodeData && "_type" in nodeData ? (nodeData._type === "odf" ? undefined : (nodeData as { gpsLat?: number }).gpsLat) : undefined;
  const gpsLng = nodeData && "_type" in nodeData ? (nodeData._type === "odf" ? undefined : (nodeData as { gpsLng?: number }).gpsLng) : undefined;
  const hasGps = gpsLat !== undefined && gpsLng !== undefined;

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
        width: isMinimized ? 280 : 340,
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Header */}
      <div className={`flex items-center justify-between px-3 py-2 border-b bg-gradient-to-r ${bgColor} rounded-t-xl`}>
        <div className="flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-gray-400" />
          {nodeIcons[nodeType]}
          <span className="text-sm font-semibold text-gray-700">
            Edit {nodeLabels[nodeType] || nodeType.toUpperCase()}
          </span>
          {hasChanges && !saving && (
            <span className="w-2 h-2 bg-amber-500 rounded-full" title="Unsaved changes" />
          )}
          {saving && (
            <Loader2 className="w-3 h-3 text-gray-500 animate-spin" />
          )}
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
          {/* Error message */}
          {error && (
            <div className="mx-3 mt-3 p-2 bg-red-50 text-red-700 rounded-lg text-xs">
              {error}
            </div>
          )}

          {/* Form */}
          <div className="p-3 space-y-3" data-no-drag>
            {/* Name field */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); markChanged(); }}
                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={`${nodeLabels[nodeType]} name`}
              />
            </div>

            {/* Address field */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {nodeType === "odf" ? "Location" : "Address"}
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => { setAddress(e.target.value); markChanged(); }}
                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter address"
              />
            </div>

            {/* OLT-specific fields */}
            {nodeType === "olt" && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Model
                  </label>
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => { setModel(e.target.value); markChanged(); }}
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., Huawei MA5800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    PON Ports
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={128}
                    value={totalPonPorts}
                    onChange={(e) => { setTotalPonPorts(parseInt(e.target.value) || 16); markChanged(); }}
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </>
            )}

            {/* ODF-specific fields */}
            {nodeType === "odf" && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Port Count
                </label>
                <input
                  type="number"
                  min={1}
                  max={288}
                  value={portCount}
                  onChange={(e) => { setPortCount(parseInt(e.target.value) || 48); markChanged(); }}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}

            {/* Closure-specific fields */}
            {(nodeType === "closure" || nodeType === "splice-closure") && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Type
                </label>
                <select
                  value={enclosureType}
                  onChange={(e) => { setEnclosureType(e.target.value); markChanged(); }}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="splice-closure">Splice Closure</option>
                  <option value="handhole">Handhole</option>
                  <option value="pedestal">Pedestal</option>
                  <option value="aerial">Aerial</option>
                </select>
              </div>
            )}

            {/* GPS section */}
            <div className="p-2 bg-gray-50 rounded-lg border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs">
                  <MapPin className={`w-3.5 h-3.5 ${hasGps ? "text-green-600" : "text-gray-400"}`} />
                  <span className="text-gray-600">
                    {hasGps
                      ? `${gpsLat?.toFixed(6)}, ${gpsLng?.toFixed(6)}`
                      : "No location set"}
                  </span>
                </div>
                {onOpenGPSPicker && (
                  <button
                    onClick={() => onOpenGPSPicker(nodeId, nodeType, dbId)}
                    className="px-2 py-1 text-xs bg-indigo-100 text-indigo-600 rounded hover:bg-indigo-200 transition-colors"
                  >
                    {hasGps ? "Change" : "Set Location"}
                  </button>
                )}
              </div>
            </div>

            {/* Related items section */}
            {(nodeType === "closure" || nodeType === "splice-closure") && relatedCounts && (
              <div className="p-2 bg-purple-50 rounded-lg border border-purple-200">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-purple-700">
                      <Layers className="w-3 h-3" />
                      {relatedCounts.trays} trays
                    </span>
                    <span className="text-purple-600">
                      {relatedCounts.splices} splices
                    </span>
                  </div>
                  {onOpenTrayManager && (
                    <button
                      onClick={() => onOpenTrayManager(dbId, name)}
                      className="px-2 py-1 text-xs bg-purple-100 text-purple-600 rounded hover:bg-purple-200 transition-colors"
                    >
                      Manage
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* NAP port section */}
            {(nodeType === "nap" || nodeType === "fat") && relatedCounts && (
              <div className="p-2 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1 text-blue-700">
                    <Users className="w-3 h-3" />
                    {relatedCounts.ports} ports configured
                  </div>
                  {onOpenPortManager && (
                    <button
                      onClick={() => onOpenPortManager(dbId, name)}
                      className="px-2 py-1 text-xs bg-blue-100 text-blue-600 rounded hover:bg-blue-200 transition-colors"
                    >
                      Manage Ports
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* LCP splitter section */}
            {(nodeType === "lcp" || nodeType === "fdt") && relatedCounts && (
              <div className="p-2 bg-orange-50 rounded-lg border border-orange-200">
                <div className="flex items-center gap-1 text-xs text-orange-700">
                  <GitBranch className="w-3 h-3" />
                  {relatedCounts.splitters} splitters configured
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-3 py-2 border-t bg-gray-50 rounded-b-xl flex justify-between items-center">
            <span className="text-[10px] text-gray-400">
              {hasChanges ? "Auto-saving..." : "Changes saved"}
            </span>
            <button
              data-no-drag
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1"
            >
              <Save className="w-3 h-3" />
              Save
            </button>
          </div>
        </>
      )}

      {isMinimized && (
        <div className="px-3 py-2 text-xs text-gray-500">
          {name || "Unnamed"} {hasChanges && "• Unsaved"}
        </div>
      )}
    </div>
  );
});

export default FloatingNodeEditor;
