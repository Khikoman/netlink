"use client";

import { useState, memo } from "react";
import {
  ChevronDown,
  ChevronUp,
  MapPin,
  ArrowUp,
  ArrowDown,
  Link2,
  Server,
  Box,
  Network,
  GitBranch,
  Users,
  ExternalLink,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import {
  useUpstreamConnection,
  useDownstreamConnections,
  useSpliceSummary,
} from "@/lib/db/hooks";
import { FIBER_COLORS } from "@/lib/fiberColors";

interface NodeInfoDropdownProps {
  nodeId: string;
  nodeType: string;
  dbId: number;
  isOpen: boolean;
  onClose: () => void;
  onOpenSplicePanel?: (edgeId: string) => void;
  onOpenGpsDialog?: () => void;
  gpsLat?: number;
  gpsLng?: number;
  nodeName?: string;
  position?: "fixed" | "absolute"; // fixed = side panel, absolute = near node
}

// Map node types to their icons and colors
const nodeConfig: Record<string, { icon: React.ReactNode; color: string; bgColor: string }> = {
  olt: { icon: <Server className="w-4 h-4" />, color: "text-teal-600", bgColor: "bg-teal-50" },
  odf: { icon: <Box className="w-4 h-4" />, color: "text-cyan-600", bgColor: "bg-cyan-50" },
  closure: { icon: <Link2 className="w-4 h-4" />, color: "text-purple-600", bgColor: "bg-purple-50" },
  "splice-closure": { icon: <Link2 className="w-4 h-4" />, color: "text-purple-600", bgColor: "bg-purple-50" },
  lcp: { icon: <GitBranch className="w-4 h-4" />, color: "text-orange-600", bgColor: "bg-orange-50" },
  fdt: { icon: <GitBranch className="w-4 h-4" />, color: "text-orange-600", bgColor: "bg-orange-50" },
  nap: { icon: <Network className="w-4 h-4" />, color: "text-blue-600", bgColor: "bg-blue-50" },
  fat: { icon: <Network className="w-4 h-4" />, color: "text-blue-600", bgColor: "bg-blue-50" },
};

// Color dot component
function ColorDot({ color, size = "sm" }: { color?: string; size?: "sm" | "md" }) {
  const sizeClasses = size === "sm" ? "w-2 h-2" : "w-3 h-3";
  const hex = color ? (FIBER_COLORS.find(c => c.name.toLowerCase() === color.toLowerCase())?.hex || color) : "#888";

  return (
    <span
      className={`${sizeClasses} rounded-full border border-white shadow-sm inline-block`}
      style={{ backgroundColor: hex }}
      title={color || "Unknown"}
    />
  );
}

// Status indicator component
function StatusIndicator({ status }: { status?: string }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="w-3 h-3 text-green-500" />;
    case "pending":
      return <Clock className="w-3 h-3 text-yellow-500" />;
    case "needs-review":
    case "failed":
      return <AlertCircle className="w-3 h-3 text-red-500" />;
    default:
      return <Clock className="w-3 h-3 text-gray-400" />;
  }
}

// Fiber color badge showing multiple colors in a row
export function FiberPathBadge({
  colors,
  maxDisplay = 6,
  showArrow = false,
}: {
  colors: string[];
  maxDisplay?: number;
  showArrow?: boolean;
}) {
  const displayed = colors.slice(0, maxDisplay);
  const remaining = colors.length - maxDisplay;

  return (
    <div className="flex items-center gap-0.5">
      {displayed.map((color, i) => (
        <ColorDot key={i} color={color} />
      ))}
      {remaining > 0 && (
        <span className="text-[10px] text-gray-500 ml-0.5">+{remaining}</span>
      )}
      {showArrow && <span className="text-gray-400 text-xs mx-1">→</span>}
    </div>
  );
}

// Main dropdown component
export const NodeInfoDropdown = memo(function NodeInfoDropdown({
  nodeId,
  nodeType,
  dbId,
  isOpen,
  onClose,
  onOpenSplicePanel,
  onOpenGpsDialog,
  gpsLat,
  gpsLng,
  nodeName,
  position = "fixed",
}: NodeInfoDropdownProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>("upstream");

  // Fetch connection data
  const upstream = useUpstreamConnection(nodeType, dbId);
  const downstream = useDownstreamConnections(nodeType, dbId);
  const spliceSummary = useSpliceSummary(
    ["closure", "splice-closure"].includes(nodeType) ? dbId : undefined
  );

  if (!isOpen) return null;

  const config = nodeConfig[nodeType] || nodeConfig.closure;

  // Toggle section expansion
  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  // Get unique fiber colors from splices
  const spliceColors = spliceSummary?.splices?.reduce((acc, splice) => {
    if (splice.fiberAColor && !acc.includes(splice.fiberAColor)) acc.push(splice.fiberAColor);
    if (splice.fiberBColor && !acc.includes(splice.fiberBColor)) acc.push(splice.fiberBColor);
    return acc;
  }, [] as string[]) || [];

  // Position classes based on mode
  const positionClasses = position === "fixed"
    ? "fixed top-20 right-4 z-50 max-h-[calc(100vh-6rem)] overflow-y-auto"
    : "absolute top-full left-0 mt-1 z-50";

  return (
    <div className={`${positionClasses} w-72 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden`}>
      {/* Header */}
      <div className={`px-3 py-2 ${config.bgColor} border-b flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <span className={config.color}>{config.icon}</span>
          <span className="font-medium text-gray-800 text-sm truncate">
            {nodeName || `${nodeType.toUpperCase()}-${dbId}`}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 p-1"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>

      {/* GPS Section */}
      {(gpsLat !== undefined || gpsLng !== undefined) && (
        <div className="px-3 py-2 border-b bg-green-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-green-600" />
              <span className="text-gray-700">
                {gpsLat?.toFixed(6)}, {gpsLng?.toFixed(6)}
              </span>
            </div>
            {onOpenGpsDialog && (
              <button
                onClick={onOpenGpsDialog}
                className="text-green-600 hover:text-green-700 text-xs flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" />
                Map
              </button>
            )}
          </div>
        </div>
      )}

      {/* Upstream Section */}
      <div className="border-b">
        <button
          onClick={() => toggleSection("upstream")}
          className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-50"
        >
          <div className="flex items-center gap-2 text-sm">
            <ArrowUp className="w-4 h-4 text-blue-500" />
            <span className="font-medium text-gray-700">Upstream</span>
          </div>
          {expandedSection === "upstream" ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </button>
        {expandedSection === "upstream" && (
          <div className="px-3 pb-2">
            {upstream ? (
              <div className="bg-gray-50 rounded-lg p-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className={nodeConfig[upstream.parentType]?.color || "text-gray-600"}>
                    {nodeConfig[upstream.parentType]?.icon}
                  </span>
                  <span className="font-medium">
                    {(upstream.parent as { name?: string })?.name || `${upstream.parentType.toUpperCase()}`}
                  </span>
                </div>
                {upstream.cable && (
                  <div className="mt-1.5 pl-6 text-gray-600">
                    <div className="flex items-center gap-1">
                      <span>Cable: {(upstream.cable as { name?: string })?.name || 'Unnamed'}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span>{(upstream.cable as { fiberCount?: number })?.fiberCount || 0}F</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-500 italic">No upstream connection</p>
            )}
          </div>
        )}
      </div>

      {/* Splices Section (only for closures) */}
      {["closure", "splice-closure"].includes(nodeType) && spliceSummary && (
        <div className="border-b">
          <button
            onClick={() => toggleSection("splices")}
            className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-50"
          >
            <div className="flex items-center gap-2 text-sm">
              <Link2 className="w-4 h-4 text-purple-500" />
              <span className="font-medium text-gray-700">
                Splices ({spliceSummary.total})
              </span>
              {spliceColors.length > 0 && (
                <FiberPathBadge colors={spliceColors} maxDisplay={4} />
              )}
            </div>
            {expandedSection === "splices" ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>
          {expandedSection === "splices" && (
            <div className="px-3 pb-2">
              {/* Splice summary stats */}
              <div className="flex gap-2 text-xs mb-2">
                <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded">
                  {spliceSummary.completed} done
                </span>
                <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded">
                  {spliceSummary.pending} pending
                </span>
                {(spliceSummary.needsReview || 0) > 0 && (
                  <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded">
                    {spliceSummary.needsReview} review
                  </span>
                )}
              </div>

              {/* Splice grid (show first few) */}
              {spliceSummary.splices && spliceSummary.splices.length > 0 && (
                <div className="grid grid-cols-4 gap-1">
                  {spliceSummary.splices.slice(0, 8).map((splice, i) => (
                    <div
                      key={splice.id || i}
                      className="flex items-center justify-center gap-0.5 p-1 bg-gray-50 rounded text-[10px]"
                      title={`F${splice.fiberA} ↔ F${splice.fiberB}`}
                    >
                      <ColorDot color={splice.fiberAColor} />
                      <StatusIndicator status={splice.status} />
                      <ColorDot color={splice.fiberBColor} />
                    </div>
                  ))}
                </div>
              )}

              {spliceSummary.total > 8 && (
                <button
                  onClick={() => {
                    // Could open splice panel here
                  }}
                  className="mt-2 w-full text-center text-xs text-purple-600 hover:text-purple-700"
                >
                  View all {spliceSummary.total} splices...
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Downstream Section */}
      <div>
        <button
          onClick={() => toggleSection("downstream")}
          className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-50"
        >
          <div className="flex items-center gap-2 text-sm">
            <ArrowDown className="w-4 h-4 text-green-500" />
            <span className="font-medium text-gray-700">
              Downstream ({downstream?.length || 0})
            </span>
          </div>
          {expandedSection === "downstream" ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </button>
        {expandedSection === "downstream" && (
          <div className="px-3 pb-2">
            {downstream && downstream.length > 0 ? (
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {downstream.map((conn, i) => {
                  // Type-safe access to connection properties
                  const isCustomer = conn.type === "customer";
                  const displayName = isCustomer
                    ? (conn as { customerName?: string }).customerName || `Port ${((conn as { port?: { portNumber?: number } }).port?.portNumber || '?')}`
                    : ((conn as { item?: { name?: string } }).item?.name || `${conn.type.toUpperCase()}`);
                  const cableInfo = (conn as { cable?: { fiberCount?: number } }).cable;

                  return (
                    <div
                      key={i}
                      className="bg-gray-50 rounded-lg p-2 text-xs flex items-center gap-2"
                    >
                      <span className={nodeConfig[conn.type]?.color || "text-gray-600"}>
                        {nodeConfig[conn.type]?.icon || <Network className="w-3 h-3" />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {displayName}
                        </div>
                        {cableInfo && (
                          <div className="text-gray-500 text-[10px]">
                            via {cableInfo.fiberCount || 0}F cable
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-500 italic">No downstream connections</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

export default NodeInfoDropdown;
