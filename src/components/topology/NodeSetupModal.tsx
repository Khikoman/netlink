"use client";

import React, { useState, useCallback, useEffect } from "react";
import {
  X,
  Server,
  Box,
  GitBranch,
  Network,
  Link2,
  MapPin,
} from "lucide-react";

type NodeType = "olt" | "odf" | "closure" | "lcp" | "nap";

interface NodeSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodeType: NodeType;
  onSave: (config: NodeConfig) => void;
  defaultName?: string;
}

interface NodeConfig {
  name: string;
  portCount?: number;
  ponPorts?: number;
  trayCount?: number;
  splitterRatio?: string;
  gpsLat?: number;
  gpsLng?: number;
}

const NODE_ICONS: Record<NodeType, React.ReactNode> = {
  olt: <Server className="w-6 h-6" />,
  odf: <Box className="w-6 h-6" />,
  closure: <Link2 className="w-6 h-6" />,
  lcp: <GitBranch className="w-6 h-6" />,
  nap: <Network className="w-6 h-6" />,
};

const NODE_COLORS: Record<NodeType, string> = {
  olt: "from-teal-500 to-teal-600",
  odf: "from-cyan-500 to-cyan-600",
  closure: "from-purple-500 to-purple-600",
  lcp: "from-orange-500 to-orange-600",
  nap: "from-blue-500 to-blue-600",
};

const NODE_TITLES: Record<NodeType, string> = {
  olt: "New OLT",
  odf: "New ODF",
  closure: "New Closure",
  lcp: "New LCP",
  nap: "New NAP",
};

const PON_OPTIONS = [8, 16, 32, 64];
const ODF_PORT_OPTIONS = [24, 48, 96, 144];
const TRAY_OPTIONS = [1, 2, 3, 4, 6, 8];
const SPLITTER_OPTIONS = ["1:2", "1:4", "1:8", "1:16", "1:32", "1:64"];
const NAP_PORT_OPTIONS = [4, 8, 12, 16, 24];

export function NodeSetupModal({
  isOpen,
  onClose,
  nodeType,
  onSave,
  defaultName = "",
}: NodeSetupModalProps) {
  const [name, setName] = useState(defaultName);
  const [ponPorts, setPonPorts] = useState(16);
  const [portCount, setPortCount] = useState(48);
  const [trayCount, setTrayCount] = useState(2);
  const [splitterRatio, setSplitterRatio] = useState("1:8");
  const [napPorts, setNapPorts] = useState(8);

  // Reset form when modal opens with new node type
  useEffect(() => {
    if (isOpen) {
      setName(defaultName);
      setPonPorts(16);
      setPortCount(48);
      setTrayCount(2);
      setSplitterRatio("1:8");
      setNapPorts(8);
    }
  }, [isOpen, defaultName]);

  const handleSave = useCallback(() => {
    const config: NodeConfig = { name: name.trim() || defaultName };

    switch (nodeType) {
      case "olt":
        config.ponPorts = ponPorts;
        break;
      case "odf":
        config.portCount = portCount;
        break;
      case "closure":
        config.trayCount = trayCount;
        break;
      case "lcp":
        config.splitterRatio = splitterRatio;
        break;
      case "nap":
        config.portCount = napPorts;
        break;
    }

    onSave(config);
    onClose();
  }, [name, defaultName, nodeType, ponPorts, portCount, trayCount, splitterRatio, napPorts, onSave, onClose]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter") handleSave();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, onClose, handleSave]);

  if (!isOpen) return null;

  const renderOptions = () => {
    switch (nodeType) {
      case "olt":
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                PON Ports
              </label>
              <div className="grid grid-cols-4 gap-2">
                {PON_OPTIONS.map((count) => (
                  <button
                    key={count}
                    onClick={() => setPonPorts(count)}
                    className={`
                      px-4 py-3 text-sm font-semibold rounded-lg border-2 transition-all
                      ${ponPorts === count
                        ? "border-teal-500 bg-teal-50 text-teal-700"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                      }
                    `}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case "odf":
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Port Count
              </label>
              <div className="grid grid-cols-4 gap-2">
                {ODF_PORT_OPTIONS.map((count) => (
                  <button
                    key={count}
                    onClick={() => setPortCount(count)}
                    className={`
                      px-4 py-3 text-sm font-semibold rounded-lg border-2 transition-all
                      ${portCount === count
                        ? "border-cyan-500 bg-cyan-50 text-cyan-700"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                      }
                    `}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case "closure":
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Splice Trays
              </label>
              <div className="grid grid-cols-6 gap-2">
                {TRAY_OPTIONS.map((count) => (
                  <button
                    key={count}
                    onClick={() => setTrayCount(count)}
                    className={`
                      px-3 py-3 text-sm font-semibold rounded-lg border-2 transition-all
                      ${trayCount === count
                        ? "border-purple-500 bg-purple-50 text-purple-700"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                      }
                    `}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case "lcp":
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Splitter Ratio
              </label>
              <div className="grid grid-cols-3 gap-2">
                {SPLITTER_OPTIONS.map((ratio) => (
                  <button
                    key={ratio}
                    onClick={() => setSplitterRatio(ratio)}
                    className={`
                      px-4 py-3 text-sm font-semibold rounded-lg border-2 transition-all
                      ${splitterRatio === ratio
                        ? "border-orange-500 bg-orange-50 text-orange-700"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                      }
                    `}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case "nap":
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Drop Ports
              </label>
              <div className="grid grid-cols-5 gap-2">
                {NAP_PORT_OPTIONS.map((count) => (
                  <button
                    key={count}
                    onClick={() => setNapPorts(count)}
                    className={`
                      px-3 py-3 text-sm font-semibold rounded-lg border-2 transition-all
                      ${napPorts === count
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                      }
                    `}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`bg-gradient-to-r ${NODE_COLORS[nodeType]} px-6 py-4 flex items-center justify-between`}>
          <div className="flex items-center gap-3 text-white">
            {NODE_ICONS[nodeType]}
            <h2 className="text-lg font-semibold">{NODE_TITLES[nodeType]}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/20 rounded-full transition-colors text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Name Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={defaultName}
              className="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
          </div>

          {/* Type-specific options */}
          {renderOptions()}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className={`px-5 py-2.5 text-sm font-medium text-white rounded-lg transition-colors bg-gradient-to-r ${NODE_COLORS[nodeType]} hover:opacity-90`}
          >
            Create {nodeType.toUpperCase()}
          </button>
        </div>
      </div>
    </div>
  );
}

export default NodeSetupModal;
