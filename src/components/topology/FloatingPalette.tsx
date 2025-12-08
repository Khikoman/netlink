"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Server,
  Box,
  GitBranch,
  Network,
  X,
  GripVertical,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface PaletteItem {
  type: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  description: string;
}

const paletteItems: PaletteItem[] = [
  {
    type: "olt",
    label: "OLT",
    icon: <Server className="w-5 h-5" />,
    color: "bg-purple-500",
    description: "Optical Line Terminal",
  },
  {
    type: "odf",
    label: "ODF",
    icon: <Box className="w-5 h-5" />,
    color: "bg-cyan-500",
    description: "Optical Distribution Frame",
  },
  {
    type: "closure",
    label: "Closure",
    icon: <Network className="w-5 h-5" />,
    color: "bg-purple-500",
    description: "Splice Closure",
  },
  {
    type: "lcp",
    label: "LCP",
    icon: <GitBranch className="w-5 h-5" />,
    color: "bg-orange-500",
    description: "Local Convergence Point",
  },
  {
    type: "nap",
    label: "NAP",
    icon: <Network className="w-5 h-5" />,
    color: "bg-green-500",
    description: "Network Access Point",
  },
];

interface FloatingPaletteProps {
  onDragStart: (event: React.DragEvent, nodeType: string) => void;
  onClose?: () => void;
  isOpen?: boolean;
}

export function FloatingPalette({
  onDragStart,
  onClose,
  isOpen = true,
}: FloatingPaletteProps) {
  const [position, setPosition] = useState({ x: 20, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  // Load position from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("netlink:palettePosition");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setPosition(parsed);
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  // Save position to localStorage
  useEffect(() => {
    localStorage.setItem("netlink:palettePosition", JSON.stringify(position));
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

  // Handle item drag start for React Flow
  const handleItemDragStart = useCallback(
    (event: React.DragEvent, item: PaletteItem) => {
      event.dataTransfer.setData("application/reactflow", item.type);
      event.dataTransfer.effectAllowed = "move";
      onDragStart(event, item.type);
    },
    [onDragStart]
  );

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      className={`
        fixed z-50 bg-white rounded-xl shadow-2xl border border-gray-200
        transition-all duration-200 select-none
        ${isDragging ? "cursor-grabbing shadow-3xl scale-[1.02]" : "cursor-grab"}
      `}
      style={{
        left: position.x,
        top: position.y,
        minWidth: isCollapsed ? 160 : 200,
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-xl">
        <div className="flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-semibold text-gray-700">Components</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            data-no-drag
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 hover:bg-white/50 rounded transition-colors"
          >
            {isCollapsed ? (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronUp className="w-4 h-4 text-gray-500" />
            )}
          </button>
          {onClose && (
            <button
              data-no-drag
              onClick={onClose}
              className="p-1 hover:bg-white/50 rounded transition-colors"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          )}
        </div>
      </div>

      {/* Palette Items */}
      {!isCollapsed && (
        <div className="p-2 space-y-1">
          {paletteItems.map((item) => (
            <div
              key={item.type}
              draggable
              onDragStart={(e) => handleItemDragStart(e, item)}
              data-no-drag
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-grab
                bg-gray-50 hover:bg-gray-100 border border-transparent
                hover:border-blue-200 hover:shadow-sm
                active:cursor-grabbing active:scale-[0.98]
                transition-all duration-150
                group
              `}
            >
              <div
                className={`
                  w-8 h-8 rounded-lg ${item.color} text-white
                  flex items-center justify-center
                  group-hover:scale-110 transition-transform
                `}
              >
                {item.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800">
                  {item.label}
                </div>
                <div className="text-[10px] text-gray-500 truncate">
                  {item.description}
                </div>
              </div>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                <GripVertical className="w-4 h-4 text-gray-300" />
              </div>
            </div>
          ))}

          {/* Help text */}
          <div className="pt-2 px-2 text-[10px] text-gray-400 text-center">
            Drag to canvas to create
          </div>
        </div>
      )}
    </div>
  );
}

export default FloatingPalette;
