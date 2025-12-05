"use client";

import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Server, Box, Link2, GitBranch, Network, MapPin } from "lucide-react";

interface BaseNodeData {
  label: string;
  type: "olt" | "odf" | "closure" | "lcp" | "nap";
  portCount?: number;
  connectedPorts?: number;
  hasGps?: boolean;
  selected?: boolean;
}

const nodeStyles: Record<string, { bg: string; border: string; icon: React.ReactNode }> = {
  olt: {
    bg: "bg-gradient-to-br from-teal-50 to-teal-100",
    border: "border-teal-400 hover:border-teal-500",
    icon: <Server className="w-4 h-4 text-teal-600" />,
  },
  odf: {
    bg: "bg-gradient-to-br from-cyan-50 to-cyan-100",
    border: "border-cyan-400 hover:border-cyan-500",
    icon: <Box className="w-4 h-4 text-cyan-600" />,
  },
  closure: {
    bg: "bg-gradient-to-br from-purple-50 to-purple-100",
    border: "border-purple-400 hover:border-purple-500",
    icon: <Link2 className="w-4 h-4 text-purple-600" />,
  },
  lcp: {
    bg: "bg-gradient-to-br from-orange-50 to-orange-100",
    border: "border-orange-400 hover:border-orange-500",
    icon: <GitBranch className="w-4 h-4 text-orange-600" />,
  },
  nap: {
    bg: "bg-gradient-to-br from-blue-50 to-blue-100",
    border: "border-blue-400 hover:border-blue-500",
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

function BaseNode({ data, selected }: NodeProps<BaseNodeData>) {
  const style = nodeStyles[data.type] || nodeStyles.closure;
  const showTopHandle = data.type !== "olt"; // OLT has no parent
  const showBottomHandle = data.type !== "nap"; // NAP has no children

  return (
    <div
      className={`
        px-4 py-3 rounded-lg border-2 shadow-sm min-w-[160px]
        transition-all duration-200 cursor-pointer
        ${style.bg} ${style.border}
        ${selected ? "ring-2 ring-blue-500 ring-offset-2 shadow-lg" : ""}
      `}
    >
      {/* Top handle (input from parent) */}
      {showTopHandle && (
        <Handle
          type="target"
          position={Position.Top}
          className="w-3 h-3 !bg-gray-400 border-2 border-white"
        />
      )}

      {/* Node content */}
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-md bg-white/50">
          {style.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
              {typeLabels[data.type]}
            </span>
            {data.hasGps && (
              <MapPin className="w-3 h-3 text-green-500" />
            )}
          </div>
          <div className="text-sm font-semibold text-gray-800 truncate">
            {data.label}
          </div>
        </div>
      </div>

      {/* Port count indicator */}
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

      {/* Bottom handle (output to children) */}
      {showBottomHandle && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="w-3 h-3 !bg-gray-400 border-2 border-white"
        />
      )}
    </div>
  );
}

// Export memoized versions for React Flow
export const OLTNode = memo(BaseNode);
export const ODFNode = memo(BaseNode);
export const ClosureNode = memo(BaseNode);
export const LCPNode = memo(BaseNode);
export const NAPNode = memo(BaseNode);

// Node types registry for React Flow
export const nodeTypes = {
  olt: OLTNode,
  odf: ODFNode,
  closure: ClosureNode,
  lcp: LCPNode,
  nap: NAPNode,
};
