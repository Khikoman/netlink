"use client";

import { memo, useCallback, useState } from "react";
import { NodeToolbar, Position } from "reactflow";
import {
  Plus,
  Trash2,
  Edit3,
  Copy,
  Link2,
  MapPin,
  Eye,
  EyeOff,
  Unlink,
  MoreHorizontal,
} from "lucide-react";

interface NodeToolbarActionsProps {
  nodeId: string;
  nodeType: string;
  isVisible: boolean;
  onAddChild?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onSetLocation?: () => void;
  onToggleExpand?: () => void;
  isExpanded?: boolean;
  canHaveChildren?: boolean;
  canDelete?: boolean;
}

function NodeToolbarActionsComponent({
  nodeId,
  nodeType,
  isVisible,
  onAddChild,
  onEdit,
  onDelete,
  onDuplicate,
  onConnect,
  onDisconnect,
  onSetLocation,
  onToggleExpand,
  isExpanded,
  canHaveChildren = true,
  canDelete = true,
}: NodeToolbarActionsProps) {
  const [showMore, setShowMore] = useState(false);

  // Determine what actions are available based on node type
  const getAvailableActions = () => {
    const actions = [];

    // Add child - available for OLT, ODF, Closure, LCP
    if (canHaveChildren && onAddChild) {
      actions.push({
        id: "add",
        icon: <Plus className="w-3.5 h-3.5" />,
        label: "Add Child",
        onClick: onAddChild,
        className: "bg-green-500 hover:bg-green-600 text-white",
      });
    }

    // Edit - always available
    if (onEdit) {
      actions.push({
        id: "edit",
        icon: <Edit3 className="w-3.5 h-3.5" />,
        label: "Edit",
        onClick: onEdit,
        className: "bg-blue-500 hover:bg-blue-600 text-white",
      });
    }

    // Connect - for creating new edges
    if (onConnect) {
      actions.push({
        id: "connect",
        icon: <Link2 className="w-3.5 h-3.5" />,
        label: "Connect",
        onClick: onConnect,
        className: "bg-purple-500 hover:bg-purple-600 text-white",
      });
    }

    // Duplicate - available for most nodes
    if (onDuplicate && nodeType !== "olt") {
      actions.push({
        id: "duplicate",
        icon: <Copy className="w-3.5 h-3.5" />,
        label: "Duplicate",
        onClick: onDuplicate,
        className: "bg-gray-500 hover:bg-gray-600 text-white",
      });
    }

    // Set location - available for all nodes
    if (onSetLocation) {
      actions.push({
        id: "location",
        icon: <MapPin className="w-3.5 h-3.5" />,
        label: "Set Location",
        onClick: onSetLocation,
        className: "bg-indigo-500 hover:bg-indigo-600 text-white",
      });
    }

    // Toggle expand - for expandable nodes (closure, nap)
    if (onToggleExpand && (nodeType === "closure" || nodeType === "nap")) {
      actions.push({
        id: "expand",
        icon: isExpanded ? (
          <EyeOff className="w-3.5 h-3.5" />
        ) : (
          <Eye className="w-3.5 h-3.5" />
        ),
        label: isExpanded ? "Collapse" : "Expand",
        onClick: onToggleExpand,
        className: "bg-amber-500 hover:bg-amber-600 text-white",
      });
    }

    // Delete - available for all except OLT (with confirmation)
    if (canDelete && onDelete) {
      actions.push({
        id: "delete",
        icon: <Trash2 className="w-3.5 h-3.5" />,
        label: "Delete",
        onClick: onDelete,
        className: "bg-red-500 hover:bg-red-600 text-white",
      });
    }

    return actions;
  };

  const actions = getAvailableActions();
  const primaryActions = actions.slice(0, 4);
  const moreActions = actions.slice(4);

  if (!isVisible) return null;

  return (
    <NodeToolbar
      isVisible={isVisible}
      position={Position.Top}
      offset={8}
      className="flex items-center gap-1 p-1 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200"
    >
      {primaryActions.map((action) => (
        <button
          key={action.id}
          onClick={(e) => {
            e.stopPropagation();
            action.onClick();
          }}
          className={`
            p-1.5 rounded-md transition-all duration-150
            ${action.className}
            flex items-center gap-1
            text-xs font-medium
            hover:scale-105 active:scale-95
          `}
          title={action.label}
        >
          {action.icon}
          <span className="hidden sm:inline">{action.label}</span>
        </button>
      ))}

      {moreActions.length > 0 && (
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMore(!showMore);
            }}
            className="p-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
            title="More actions"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>

          {showMore && (
            <div
              className="absolute top-full mt-1 right-0 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[140px] z-10"
              onClick={(e) => e.stopPropagation()}
            >
              {moreActions.map((action) => (
                <button
                  key={action.id}
                  onClick={() => {
                    action.onClick();
                    setShowMore(false);
                  }}
                  className={`
                    w-full px-3 py-2 text-left text-sm flex items-center gap-2
                    hover:bg-gray-50 transition-colors
                  `}
                >
                  <span className={action.className.includes("red") ? "text-red-500" : "text-gray-500"}>
                    {action.icon}
                  </span>
                  <span>{action.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </NodeToolbar>
  );
}

export const NodeToolbarActions = memo(NodeToolbarActionsComponent);
export default NodeToolbarActions;
