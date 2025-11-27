"use client";

import type { Port, PortStatus } from "@/types";
import { Circle, User, AlertTriangle, Clock } from "lucide-react";

interface PortGridProps {
  ports: Port[];
  onPortClick?: (port: Port) => void;
  showCustomerInfo?: boolean;
  columns?: number;
}

const STATUS_CONFIG: Record<PortStatus, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  available: {
    color: "text-gray-400",
    bg: "bg-gray-50 border-gray-200 hover:border-gray-400",
    icon: <Circle className="w-3 h-3" />,
    label: "Available",
  },
  connected: {
    color: "text-green-500",
    bg: "bg-green-50 border-green-300 hover:border-green-500",
    icon: <Circle className="w-3 h-3 fill-current" />,
    label: "Connected",
  },
  reserved: {
    color: "text-yellow-500",
    bg: "bg-yellow-50 border-yellow-300 hover:border-yellow-500",
    icon: <Clock className="w-3 h-3" />,
    label: "Reserved",
  },
  faulty: {
    color: "text-red-500",
    bg: "bg-red-50 border-red-300 hover:border-red-500",
    icon: <AlertTriangle className="w-3 h-3" />,
    label: "Faulty",
  },
};

export default function PortGrid({
  ports,
  onPortClick,
  showCustomerInfo = false,
  columns = 4,
}: PortGridProps) {
  if (ports.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Circle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
        <p>No ports configured</p>
      </div>
    );
  }

  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {ports.map((port) => {
        const config = STATUS_CONFIG[port.status];
        return (
          <button
            key={port.id}
            onClick={() => onPortClick?.(port)}
            className={`p-3 rounded-lg border-2 transition-all text-left ${config.bg} ${
              onPortClick ? "cursor-pointer" : "cursor-default"
            }`}
          >
            {/* Port Header */}
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono font-bold text-gray-800 text-sm">
                {port.label || `P${port.portNumber}`}
              </span>
              <span className={config.color}>{config.icon}</span>
            </div>

            {/* Status Label */}
            <div className={`text-xs ${config.color} font-medium`}>
              {config.label}
            </div>

            {/* Customer Info (for NAP ports) */}
            {showCustomerInfo && port.status === "connected" && port.customerName && (
              <div className="mt-2 pt-2 border-t border-gray-200">
                <div className="flex items-center gap-1 text-xs text-gray-600">
                  <User className="w-3 h-3" />
                  <span className="truncate">{port.customerName}</span>
                </div>
                {port.serviceId && (
                  <div className="text-xs text-gray-400 mt-0.5 truncate">
                    {port.serviceId}
                  </div>
                )}
              </div>
            )}

            {/* Reserved Note */}
            {port.status === "reserved" && port.notes && (
              <div className="mt-1 text-xs text-yellow-600 truncate">
                {port.notes}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

// Compact version for inline display
export function PortGridCompact({
  ports,
  onPortClick,
}: {
  ports: Port[];
  onPortClick?: (port: Port) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {ports.map((port) => {
        const config = STATUS_CONFIG[port.status];
        return (
          <button
            key={port.id}
            onClick={() => onPortClick?.(port)}
            className={`w-8 h-8 rounded flex items-center justify-center border ${config.bg} ${
              onPortClick ? "cursor-pointer" : "cursor-default"
            }`}
            title={`${port.label || `P${port.portNumber}`} - ${config.label}${
              port.customerName ? ` (${port.customerName})` : ""
            }`}
          >
            <span className={config.color}>{config.icon}</span>
          </button>
        );
      })}
    </div>
  );
}

// Port Status Summary
export function PortStatusSummary({ ports }: { ports: Port[] }) {
  const counts = ports.reduce(
    (acc, port) => {
      acc[port.status] = (acc[port.status] || 0) + 1;
      return acc;
    },
    {} as Record<PortStatus, number>
  );

  return (
    <div className="flex items-center gap-3 text-sm">
      {(["connected", "reserved", "available", "faulty"] as PortStatus[]).map((status) => {
        const count = counts[status] || 0;
        if (count === 0) return null;
        const config = STATUS_CONFIG[status];
        return (
          <div key={status} className={`flex items-center gap-1 ${config.color}`}>
            {config.icon}
            <span>{count}</span>
          </div>
        );
      })}
      <div className="text-gray-400">
        Total: {ports.length}
      </div>
    </div>
  );
}
