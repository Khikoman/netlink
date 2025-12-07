"use client";

import { memo, useState, useCallback, useEffect } from "react";
import { Handle, Position, NodeProps, NodeToolbar } from "reactflow";
import {
  Server,
  Box,
  Link2,
  GitBranch,
  Network,
  MapPin,
  ChevronDown,
  ChevronUp,
  Users,
  Layers,
  User,
  Phone,
  Signal,
  Plus,
  Edit3,
  Trash2,
  Copy,
} from "lucide-react";
import { db, toggleEnclosureExpanded } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { FIBER_COLORS } from "@/lib/fiberColors";
import type { NodeType } from "@/lib/db";

// Handle styles for interactive connection ports
const handleBaseStyle = "!w-3 !h-3 !border-2 !border-white transition-all duration-200";
const handleColors: Record<string, string> = {
  olt: "!bg-teal-500 hover:!bg-teal-400 hover:!scale-150 hover:!shadow-lg hover:!shadow-teal-500/50",
  odf: "!bg-cyan-500 hover:!bg-cyan-400 hover:!scale-150 hover:!shadow-lg hover:!shadow-cyan-500/50",
  closure: "!bg-purple-500 hover:!bg-purple-400 hover:!scale-150 hover:!shadow-lg hover:!shadow-purple-500/50",
  lcp: "!bg-orange-500 hover:!bg-orange-400 hover:!scale-150 hover:!shadow-lg hover:!shadow-orange-500/50",
  nap: "!bg-blue-500 hover:!bg-blue-400 hover:!scale-150 hover:!shadow-lg hover:!shadow-blue-500/50",
};

interface BaseNodeData {
  label: string;
  type: "olt" | "odf" | "closure" | "lcp" | "nap";
  portCount?: number;
  connectedPorts?: number;
  hasGps?: boolean;
  selected?: boolean;
  dbId?: number;
  nodeType?: NodeType;
  expanded?: boolean;
  // Action callbacks (passed from TopologyCanvas via node.data)
  onAddChild?: (nodeId: string, nodeType: string) => void;
  onEdit?: (nodeId: string, nodeType: string) => void;
  onDelete?: (nodeId: string) => void;
  onDuplicate?: (nodeId: string, nodeType: string) => void;
  onSetLocation?: (nodeId: string, nodeType: string) => void;
}

// Color configurations for each node type
const nodeStyles: Record<string, { bg: string; border: string; expandedBg: string; icon: React.ReactNode }> = {
  olt: {
    bg: "bg-gradient-to-br from-teal-50 to-teal-100",
    border: "border-teal-400 hover:border-teal-500",
    expandedBg: "bg-teal-50",
    icon: <Server className="w-4 h-4 text-teal-600" />,
  },
  odf: {
    bg: "bg-gradient-to-br from-cyan-50 to-cyan-100",
    border: "border-cyan-400 hover:border-cyan-500",
    expandedBg: "bg-cyan-50",
    icon: <Box className="w-4 h-4 text-cyan-600" />,
  },
  closure: {
    bg: "bg-gradient-to-br from-purple-50 to-purple-100",
    border: "border-purple-400 hover:border-purple-500",
    expandedBg: "bg-purple-50",
    icon: <Link2 className="w-4 h-4 text-purple-600" />,
  },
  lcp: {
    bg: "bg-gradient-to-br from-orange-50 to-orange-100",
    border: "border-orange-400 hover:border-orange-500",
    expandedBg: "bg-orange-50",
    icon: <GitBranch className="w-4 h-4 text-orange-600" />,
  },
  nap: {
    bg: "bg-gradient-to-br from-blue-50 to-blue-100",
    border: "border-blue-400 hover:border-blue-500",
    expandedBg: "bg-blue-50",
    icon: <Network className="w-4 h-4 text-blue-600" />,
  },
};

const typeLabels: Record<string, string> = {
  olt: "OLT",
  odf: "ODF",
  closure: "Closure",
  lcp: "LCP",
  nap: "NAP",
};

// ===========================================
// EXPANDABLE CLOSURE NODE
// Shows trays and splices when expanded
// ===========================================

function ExpandableClosureNodeComponent({ data, selected, id }: NodeProps<BaseNodeData>) {
  const [isExpanded, setIsExpanded] = useState(data.expanded || false);
  const style = nodeStyles[data.type] || nodeStyles.closure;
  // Read callbacks from data prop (passed from TopologyCanvas)
  const { onAddChild, onEdit, onDelete, onSetLocation } = data;

  // Fetch trays and splices for this closure
  const trays = useLiveQuery(
    () => data.dbId ? db.trays.where("enclosureId").equals(data.dbId).toArray() : [],
    [data.dbId]
  );

  const splices = useLiveQuery(async () => {
    if (!trays || trays.length === 0) return [];
    const trayIds = trays.map(t => t.id).filter((id): id is number => id !== undefined);
    if (trayIds.length === 0) return [];

    const allSplices = await Promise.all(
      trayIds.map(id => db.splices.where("trayId").equals(id).toArray())
    );
    return allSplices.flat();
  }, [trays]);

  // Toggle expansion and persist to database
  const handleToggle = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    if (data.dbId) {
      await toggleEnclosureExpanded(data.dbId, newExpanded);
    }
  }, [isExpanded, data.dbId]);

  const spliceCount = splices?.length || 0;
  const trayCount = trays?.length || 0;

  return (
    <div
      className={`
        rounded-lg border-2 shadow-sm
        transition-all duration-300 ease-in-out cursor-pointer
        ${style.bg} ${style.border}
        ${selected ? "ring-2 ring-blue-500 ring-offset-2 shadow-lg" : ""}
        ${isExpanded ? "min-w-[280px]" : "min-w-[160px]"}
      `}
    >
      {/* Quick Actions Toolbar - appears on selection */}
      <NodeToolbar
        isVisible={selected}
        position={Position.Top}
        offset={8}
        className="flex items-center gap-1 p-1 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200"
      >
        <button
          className="p-1.5 rounded-md bg-green-500 hover:bg-green-600 text-white text-xs font-medium flex items-center gap-1 transition-all hover:scale-105"
          title="Add Child"
          onClick={(e) => { e.stopPropagation(); onAddChild?.(id, data.type); }}
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Add</span>
        </button>
        <button
          className="p-1.5 rounded-md bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium flex items-center gap-1 transition-all hover:scale-105"
          title="Edit Splices"
          onClick={(e) => { e.stopPropagation(); onEdit?.(id, data.type); }}
        >
          <Link2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Splices</span>
        </button>
        <button
          className="p-1.5 rounded-md bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-medium flex items-center gap-1 transition-all hover:scale-105"
          title="Set GPS Location"
          onClick={(e) => { e.stopPropagation(); onSetLocation?.(id, data.type); }}
        >
          <MapPin className="w-3.5 h-3.5" />
        </button>
        <button
          className="p-1.5 rounded-md bg-red-500 hover:bg-red-600 text-white text-xs font-medium flex items-center gap-1 transition-all hover:scale-105"
          title="Delete"
          onClick={(e) => { e.stopPropagation(); onDelete?.(id); }}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </NodeToolbar>

      {/* Top handle - for incoming connections */}
      <Handle
        type="target"
        position={Position.Top}
        className={`${handleBaseStyle} ${handleColors[data.type] || handleColors.closure}`}
      />

      {/* Header - always visible */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-white/50">
            {style.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
                {typeLabels[data.type]}
              </span>
              {data.hasGps && <MapPin className="w-3 h-3 text-green-500" />}
            </div>
            <div className="text-sm font-semibold text-gray-800 truncate">
              {data.label}
            </div>
          </div>

          {/* Expand button */}
          <button
            onClick={handleToggle}
            className="p-1 hover:bg-white/50 rounded transition-colors"
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            )}
          </button>
        </div>

        {/* Summary stats when collapsed */}
        {!isExpanded && (
          <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <Layers className="w-3 h-3" />
              <span>{trayCount} trays</span>
            </div>
            <div className="flex items-center gap-1">
              <Link2 className="w-3 h-3" />
              <span>{spliceCount} splices</span>
            </div>
          </div>
        )}
      </div>

      {/* Expanded content - trays and splices */}
      {isExpanded && (
        <div className={`px-4 pb-3 border-t border-purple-200 ${style.expandedBg}`}>
          <div className="pt-3 space-y-2 max-h-[300px] overflow-y-auto">
            {trays && trays.length > 0 ? (
              trays.map((tray) => (
                <TraySection key={tray.id} trayId={tray.id!} trayNumber={tray.number} />
              ))
            ) : (
              <div className="text-xs text-gray-400 text-center py-2">
                No trays configured
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom handle - for outgoing connections */}
      <Handle
        type="source"
        position={Position.Bottom}
        className={`${handleBaseStyle} ${handleColors[data.type] || handleColors.closure}`}
      />
    </div>
  );
}

// Helper to find color hex from color name
function getColorHex(colorName: string): string {
  const color = FIBER_COLORS.find(
    c => c.name.toLowerCase() === colorName.toLowerCase()
  );
  return color?.hex || "#9ca3af"; // default gray
}

// Sub-component for tray section
function TraySection({ trayId, trayNumber }: { trayId: number; trayNumber: number }) {
  const splices = useLiveQuery(
    () => db.splices.where("trayId").equals(trayId).toArray(),
    [trayId]
  );

  return (
    <div className="bg-white/50 rounded p-2">
      <div className="text-xs font-medium text-gray-600 mb-1.5">
        Tray {trayNumber} ({splices?.length || 0} splices)
      </div>
      <div className="flex flex-wrap gap-1">
        {splices?.slice(0, 12).map((splice) => {
          // Use stored fiber colors from splice record
          const fiberAColor = getColorHex(splice.fiberAColor);
          const fiberBColor = getColorHex(splice.fiberBColor);
          return (
            <div
              key={splice.id}
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-white border"
              title={`${splice.cableAName} F${splice.fiberA} ↔ ${splice.cableBName} F${splice.fiberB}`}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: fiberAColor }}
              />
              <span className="text-gray-400">↔</span>
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: fiberBColor }}
              />
            </div>
          );
        })}
        {splices && splices.length > 12 && (
          <span className="text-[10px] text-gray-400 px-1">
            +{splices.length - 12} more
          </span>
        )}
      </div>
    </div>
  );
}

// ===========================================
// EXPANDABLE NAP NODE
// Shows ports and connected customers when expanded
// ===========================================

function ExpandableNAPNodeComponent({ data, selected, id }: NodeProps<BaseNodeData>) {
  const [isExpanded, setIsExpanded] = useState(data.expanded || false);
  const style = nodeStyles[data.type] || nodeStyles.nap;
  // Read callbacks from data prop (passed from TopologyCanvas)
  const { onAddChild, onEdit, onDelete, onSetLocation } = data;

  // Fetch ports for this NAP
  const ports = useLiveQuery(
    () => data.dbId ? db.ports.where("enclosureId").equals(data.dbId).toArray() : [],
    [data.dbId]
  );

  // Toggle expansion and persist
  const handleToggle = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    if (data.dbId) {
      await toggleEnclosureExpanded(data.dbId, newExpanded);
    }
  }, [isExpanded, data.dbId]);

  const totalPorts = ports?.length || 0;
  const connectedPorts = ports?.filter(p => p.status === "connected").length || 0;
  const availablePorts = ports?.filter(p => p.status === "available").length || 0;

  return (
    <div
      className={`
        rounded-lg border-2 shadow-sm
        transition-all duration-300 ease-in-out cursor-pointer
        ${style.bg} ${style.border}
        ${selected ? "ring-2 ring-blue-500 ring-offset-2 shadow-lg" : ""}
        ${isExpanded ? "min-w-[260px]" : "min-w-[160px]"}
      `}
    >
      {/* Quick Actions Toolbar - appears on selection */}
      <NodeToolbar
        isVisible={selected}
        position={Position.Top}
        offset={8}
        className="flex items-center gap-1 p-1 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200"
      >
        <button
          className="p-1.5 rounded-md bg-green-500 hover:bg-green-600 text-white text-xs font-medium flex items-center gap-1 transition-all hover:scale-105"
          title="Add Customer"
          onClick={(e) => { e.stopPropagation(); onAddChild?.(id, data.type); }}
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Customer</span>
        </button>
        <button
          className="p-1.5 rounded-md bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium flex items-center gap-1 transition-all hover:scale-105"
          title="Edit Ports"
          onClick={(e) => { e.stopPropagation(); onEdit?.(id, data.type); }}
        >
          <Edit3 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Ports</span>
        </button>
        <button
          className="p-1.5 rounded-md bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-medium flex items-center gap-1 transition-all hover:scale-105"
          title="Set GPS Location"
          onClick={(e) => { e.stopPropagation(); onSetLocation?.(id, data.type); }}
        >
          <MapPin className="w-3.5 h-3.5" />
        </button>
        <button
          className="p-1.5 rounded-md bg-red-500 hover:bg-red-600 text-white text-xs font-medium flex items-center gap-1 transition-all hover:scale-105"
          title="Delete"
          onClick={(e) => { e.stopPropagation(); onDelete?.(id); }}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </NodeToolbar>

      {/* Top handle - for incoming connections */}
      <Handle
        type="target"
        position={Position.Top}
        className={`${handleBaseStyle} ${handleColors[data.type] || handleColors.nap}`}
      />

      {/* Header */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-white/50">
            {style.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
                {typeLabels[data.type]}
              </span>
              {data.hasGps && <MapPin className="w-3 h-3 text-green-500" />}
            </div>
            <div className="text-sm font-semibold text-gray-800 truncate">
              {data.label}
            </div>
          </div>

          {/* Expand button */}
          <button
            onClick={handleToggle}
            className="p-1 hover:bg-white/50 rounded transition-colors"
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            )}
          </button>
        </div>

        {/* Port usage bar */}
        <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
          <div className="flex-1 bg-gray-200 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{
                width: `${totalPorts > 0 ? (connectedPorts / totalPorts) * 100 : 0}%`,
              }}
            />
          </div>
          <span className="text-[10px] font-medium whitespace-nowrap">
            {connectedPorts}/{totalPorts}
          </span>
        </div>
      </div>

      {/* Expanded content - customer list */}
      {isExpanded && (
        <div className={`px-4 pb-3 border-t border-blue-200 ${style.expandedBg}`}>
          <div className="pt-3 space-y-1.5 max-h-[250px] overflow-y-auto">
            {ports && ports.filter(p => p.status === "connected").length > 0 ? (
              ports
                .filter(p => p.status === "connected")
                .map((port) => (
                  <CustomerPortItem key={port.id} port={port} />
                ))
            ) : (
              <div className="text-xs text-gray-400 text-center py-2">
                No customers connected
              </div>
            )}

            {/* Available ports summary */}
            {availablePorts > 0 && (
              <div className="text-xs text-gray-400 text-center pt-2 border-t border-blue-100">
                {availablePorts} port{availablePorts > 1 ? "s" : ""} available
              </div>
            )}
          </div>
        </div>
      )}

      {/* No bottom handle for NAP - end of chain */}
    </div>
  );
}

// Customer port item component
function CustomerPortItem({ port }: { port: { id?: number; portNumber: number; label?: string; customerName?: string; customerPhone?: string; serviceStatus?: string; onuRxPower?: number } }) {
  const statusColors: Record<string, string> = {
    active: "bg-green-500",
    suspended: "bg-yellow-500",
    pending: "bg-blue-500",
    terminated: "bg-red-500",
  };

  return (
    <div className="bg-white rounded p-2 flex items-center gap-2 text-xs">
      <div className={`w-2 h-2 rounded-full ${statusColors[port.serviceStatus || "active"] || "bg-gray-400"}`} />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-800 truncate">
          {port.customerName || `Port ${port.portNumber}`}
        </div>
        {port.customerPhone && (
          <div className="text-gray-400 flex items-center gap-1 truncate">
            <Phone className="w-2.5 h-2.5" />
            {port.customerPhone}
          </div>
        )}
      </div>
      {port.onuRxPower !== undefined && (
        <div className="flex items-center gap-0.5 text-gray-400" title="ONU Rx Power">
          <Signal className="w-3 h-3" />
          <span>{port.onuRxPower}dBm</span>
        </div>
      )}
    </div>
  );
}

// ===========================================
// BASIC NODE (for OLT, ODF, LCP - no expansion)
// ===========================================

function BasicNodeComponent({ data, selected, id }: NodeProps<BaseNodeData>) {
  const style = nodeStyles[data.type] || nodeStyles.closure;
  const showTopHandle = data.type !== "olt";
  const showBottomHandle = data.type !== "nap";
  // Read callbacks from data prop (passed from TopologyCanvas)
  const { onAddChild, onEdit, onDelete, onDuplicate, onSetLocation } = data;

  // Determine which child types this node can have
  const canHaveChildren = ["olt", "odf", "closure", "lcp"].includes(data.type);
  const canDelete = data.type !== "olt";

  return (
    <div
      className={`
        px-4 py-3 rounded-lg border-2 shadow-sm min-w-[160px]
        transition-all duration-200 cursor-pointer
        ${style.bg} ${style.border}
        ${selected ? "ring-2 ring-blue-500 ring-offset-2 shadow-lg" : ""}
      `}
    >
      {/* Quick Actions Toolbar - appears on selection */}
      <NodeToolbar
        isVisible={selected}
        position={Position.Top}
        offset={8}
        className="flex items-center gap-1 p-1 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200"
      >
        {canHaveChildren && (
          <button
            className="p-1.5 rounded-md bg-green-500 hover:bg-green-600 text-white text-xs font-medium flex items-center gap-1 transition-all hover:scale-105"
            title="Add Child"
            onClick={(e) => { e.stopPropagation(); onAddChild?.(id, data.type); }}
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add</span>
          </button>
        )}
        <button
          className="p-1.5 rounded-md bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium flex items-center gap-1 transition-all hover:scale-105"
          title="Edit"
          onClick={(e) => { e.stopPropagation(); onEdit?.(id, data.type); }}
        >
          <Edit3 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Edit</span>
        </button>
        <button
          className="p-1.5 rounded-md bg-gray-500 hover:bg-gray-600 text-white text-xs font-medium flex items-center gap-1 transition-all hover:scale-105"
          title="Duplicate"
          onClick={(e) => { e.stopPropagation(); onDuplicate?.(id, data.type); }}
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
        <button
          className="p-1.5 rounded-md bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-medium flex items-center gap-1 transition-all hover:scale-105"
          title="Set GPS Location"
          onClick={(e) => { e.stopPropagation(); onSetLocation?.(id, data.type); }}
        >
          <MapPin className="w-3.5 h-3.5" />
        </button>
        {canDelete && (
          <button
            className="p-1.5 rounded-md bg-red-500 hover:bg-red-600 text-white text-xs font-medium flex items-center gap-1 transition-all hover:scale-105"
            title="Delete"
            onClick={(e) => { e.stopPropagation(); onDelete?.(id); }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </NodeToolbar>

      {showTopHandle && (
        <Handle
          type="target"
          position={Position.Top}
          className={`${handleBaseStyle} ${handleColors[data.type] || handleColors.closure}`}
        />
      )}

      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-md bg-white/50">
          {style.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
              {typeLabels[data.type]}
            </span>
            {data.hasGps && <MapPin className="w-3 h-3 text-green-500" />}
          </div>
          <div className="text-sm font-semibold text-gray-800 truncate">
            {data.label}
          </div>
        </div>
      </div>

      {data.portCount !== undefined && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
          <div className="flex-1 bg-gray-200 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{
                width: `${
                  data.portCount > 0
                    ? ((data.connectedPorts || 0) / data.portCount) * 100
                    : 0
                }%`,
              }}
            />
          </div>
          <span className="text-[10px] font-medium whitespace-nowrap">
            {data.connectedPorts || 0}/{data.portCount}
          </span>
        </div>
      )}

      {showBottomHandle && (
        <Handle
          type="source"
          position={Position.Bottom}
          className={`${handleBaseStyle} ${handleColors[data.type] || handleColors.closure}`}
        />
      )}
    </div>
  );
}

// ===========================================
// CUSTOMER NODE
// Small node representing individual customer connected to NAP
// ===========================================

interface CustomerNodeData {
  label: string;
  type: "customer";
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  serviceStatus?: "active" | "suspended" | "pending" | "terminated";
  planType?: string;
  onuRxPower?: number;
  portId?: number;
  dbId?: number;
}

function CustomerNodeComponent({ data, selected }: NodeProps<CustomerNodeData>) {
  const statusColors: Record<string, { bg: string; border: string; dot: string }> = {
    active: { bg: "bg-green-50", border: "border-green-400", dot: "bg-green-500" },
    suspended: { bg: "bg-yellow-50", border: "border-yellow-400", dot: "bg-yellow-500" },
    pending: { bg: "bg-blue-50", border: "border-blue-400", dot: "bg-blue-500" },
    terminated: { bg: "bg-gray-50", border: "border-gray-400", dot: "bg-gray-500" },
  };

  const status = data.serviceStatus || "active";
  const colors = statusColors[status] || statusColors.active;

  // Signal strength indicator
  const getSignalLevel = (rxPower?: number) => {
    if (rxPower === undefined) return { level: 0, color: "text-gray-300" };
    if (rxPower >= -15) return { level: 4, color: "text-green-500" };
    if (rxPower >= -20) return { level: 3, color: "text-green-400" };
    if (rxPower >= -25) return { level: 2, color: "text-yellow-500" };
    if (rxPower >= -28) return { level: 1, color: "text-orange-500" };
    return { level: 0, color: "text-red-500" };
  };

  const signal = getSignalLevel(data.onuRxPower);

  return (
    <div
      className={`
        px-3 py-2 rounded-lg border-2 shadow-sm min-w-[120px]
        transition-all duration-200 cursor-pointer
        ${colors.bg} ${colors.border}
        ${selected ? "ring-2 ring-blue-500 ring-offset-1 shadow-lg" : ""}
      `}
    >
      {/* Top handle (connect to NAP) */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2.5 !h-2.5 !bg-green-500 !border-2 !border-white transition-all duration-200 hover:!scale-150 hover:!shadow-lg hover:!shadow-green-500/50"
      />

      <div className="flex items-center gap-2">
        {/* Status dot */}
        <div className={`w-2 h-2 rounded-full ${colors.dot}`} />

        {/* Customer info */}
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-gray-800 truncate">
            {data.customerName || data.label}
          </div>
          {data.planType && (
            <div className="text-[10px] text-gray-500 truncate">
              {data.planType}
            </div>
          )}
        </div>

        {/* Signal strength indicator */}
        {data.onuRxPower !== undefined && (
          <div className={`flex items-end gap-0.5 ${signal.color}`} title={`${data.onuRxPower} dBm`}>
            {[1, 2, 3, 4].map((bar) => (
              <div
                key={bar}
                className={`w-0.5 rounded-sm ${
                  bar <= signal.level ? "bg-current" : "bg-gray-200"
                }`}
                style={{ height: `${bar * 3}px` }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Phone number if available */}
      {data.customerPhone && (
        <div className="mt-1 flex items-center gap-1 text-[10px] text-gray-400">
          <Phone className="w-2.5 h-2.5" />
          <span className="truncate">{data.customerPhone}</span>
        </div>
      )}
    </div>
  );
}

// Export memoized versions
export const ExpandableClosureNode = memo(ExpandableClosureNodeComponent);
export const ExpandableNAPNode = memo(ExpandableNAPNodeComponent);
export const BasicNode = memo(BasicNodeComponent);
export const CustomerNode = memo(CustomerNodeComponent);

// New node types registry with expandable nodes
export const expandableNodeTypes = {
  olt: BasicNode,
  odf: BasicNode,
  closure: ExpandableClosureNode,
  lcp: BasicNode,
  nap: ExpandableNAPNode,
  customer: CustomerNode,
};
