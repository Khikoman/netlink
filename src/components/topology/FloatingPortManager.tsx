"use client";

import { useState, useCallback, useRef, useEffect, memo } from "react";
import {
  X,
  GripVertical,
  Save,
  Network,
  User,
  Phone,
  MapPin,
  Signal,
  Loader2,
  Wifi,
  WifiOff,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { db } from "@/lib/db";
import { usePorts } from "@/lib/db/hooks";
import type { Port, PortStatus, ServiceStatus } from "@/types";

interface FloatingPortManagerProps {
  isOpen: boolean;
  napId: number;
  napName?: string;
  onClose: () => void;
}

// Port status colors
const statusColors: Record<PortStatus, { bg: string; text: string; dot: string }> = {
  available: { bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500" },
  connected: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  reserved: { bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-500" },
  faulty: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
};

// Service status colors
const serviceColors: Record<ServiceStatus, { bg: string; text: string }> = {
  active: { bg: "bg-green-100", text: "text-green-700" },
  suspended: { bg: "bg-yellow-100", text: "text-yellow-700" },
  pending: { bg: "bg-blue-100", text: "text-blue-700" },
  terminated: { bg: "bg-gray-100", text: "text-gray-700" },
};

// Port card component
const PortCard = memo(function PortCard({
  port,
  isExpanded,
  onToggle,
  onUpdate,
  onDelete,
}: {
  port: Port;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: (updates: Partial<Port>) => void;
  onDelete: () => void;
}) {
  const [customerName, setCustomerName] = useState(port.customerName || "");
  const [customerPhone, setCustomerPhone] = useState(port.customerPhone || "");
  const [customerAddress, setCustomerAddress] = useState(port.customerAddress || "");
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus>(port.serviceStatus || "pending");
  const [onuRxPower, setOnuRxPower] = useState(port.onuRxPower?.toString() || "");
  const [notes, setNotes] = useState(port.notes || "");
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  const statusColor = statusColors[port.status] || statusColors.available;
  const isConnected = port.status === "connected";

  // Handle save
  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate({
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        customerAddress: customerAddress.trim() || undefined,
        serviceStatus: isConnected ? serviceStatus : undefined,
        onuRxPower: onuRxPower ? parseFloat(onuRxPower) : undefined,
        notes: notes.trim() || undefined,
        status: customerName.trim() ? "connected" : "available",
      });
      setHasChanges(false);
    } finally {
      setSaving(false);
    }
  };

  // Mark changes
  const markChanged = useCallback(() => setHasChanges(true), []);

  return (
    <div className={`rounded-lg border ${statusColor.bg} ${isExpanded ? "border-blue-300" : "border-gray-200"}`}>
      {/* Port header - always visible */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 text-left"
      >
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${statusColor.dot}`} />
          <span className="font-medium text-sm">Port {port.portNumber}</span>
          {port.customerName && (
            <span className="text-xs text-gray-600 truncate max-w-[120px]">
              - {port.customerName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-1.5 py-0.5 rounded ${statusColor.bg} ${statusColor.text}`}>
            {port.status}
          </span>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-gray-200 pt-3">
          {/* Customer Info */}
          <div className="space-y-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                <User className="w-3 h-3 inline mr-1" />
                Customer Name
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => { setCustomerName(e.target.value); markChanged(); }}
                placeholder="Enter customer name..."
                className="w-full px-2 py-1.5 text-sm border rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  <Phone className="w-3 h-3 inline mr-1" />
                  Phone
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => { setCustomerPhone(e.target.value); markChanged(); }}
                  placeholder="+63..."
                  className="w-full px-2 py-1.5 text-sm border rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  <Signal className="w-3 h-3 inline mr-1" />
                  ONU Rx (dBm)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={onuRxPower}
                  onChange={(e) => { setOnuRxPower(e.target.value); markChanged(); }}
                  placeholder="-18.5"
                  className="w-full px-2 py-1.5 text-sm border rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">
                <MapPin className="w-3 h-3 inline mr-1" />
                Address
              </label>
              <input
                type="text"
                value={customerAddress}
                onChange={(e) => { setCustomerAddress(e.target.value); markChanged(); }}
                placeholder="Customer address..."
                className="w-full px-2 py-1.5 text-sm border rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Service Status */}
            {customerName && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  <Wifi className="w-3 h-3 inline mr-1" />
                  Service Status
                </label>
                <div className="flex gap-1">
                  {(["active", "suspended", "pending", "terminated"] as ServiceStatus[]).map((status) => (
                    <button
                      key={status}
                      onClick={() => { setServiceStatus(status); markChanged(); }}
                      className={`flex-1 px-2 py-1 text-xs rounded capitalize transition-colors ${
                        serviceStatus === status
                          ? serviceColors[status].bg + " " + serviceColors[status].text + " font-medium"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs text-gray-500 mb-1">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => { setNotes(e.target.value); markChanged(); }}
                placeholder="Additional notes..."
                rows={2}
                className="w-full px-2 py-1.5 text-sm border rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-none"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between items-center pt-2 border-t">
            <button
              onClick={onDelete}
              className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1"
            >
              <WifiOff className="w-3 h-3" />
              Disconnect
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

export const FloatingPortManager = memo(function FloatingPortManager({
  isOpen,
  napId,
  napName,
  onClose,
}: FloatingPortManagerProps) {
  const [position, setPosition] = useState({ x: 200, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [expandedPort, setExpandedPort] = useState<number | null>(null);
  const [addingPort, setAddingPort] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  // Fetch ports for this NAP
  const ports = usePorts(napId);

  // Load position from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("netlink:portManagerPosition");
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
    localStorage.setItem("netlink:portManagerPosition", JSON.stringify(position));
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

  // Add new port
  const handleAddPort = async () => {
    setAddingPort(true);
    try {
      const nextPortNumber = (ports?.length || 0) + 1;
      const newPortId = await db.ports.add({
        enclosureId: napId,
        portNumber: nextPortNumber,
        type: "output",
        status: "available",
        connectorType: "SC",
        createdAt: new Date(),
      });
      setExpandedPort(newPortId as number);
    } catch (err) {
      console.error("Failed to add port:", err);
    } finally {
      setAddingPort(false);
    }
  };

  // Update port
  const handleUpdatePort = useCallback(async (portId: number, updates: Partial<Port>) => {
    try {
      await db.ports.update(portId, updates);
    } catch (err) {
      console.error("Failed to update port:", err);
    }
  }, []);

  // Delete/disconnect port
  const handleDeletePort = useCallback(async (portId: number) => {
    try {
      // Clear customer info but keep the port
      await db.ports.update(portId, {
        customerName: undefined,
        customerPhone: undefined,
        customerAddress: undefined,
        serviceStatus: undefined,
        onuRxPower: undefined,
        notes: undefined,
        status: "available",
      });
      setExpandedPort(null);
    } catch (err) {
      console.error("Failed to disconnect port:", err);
    }
  }, []);

  if (!isOpen) return null;

  const sortedPorts = ports?.slice().sort((a, b) => a.portNumber - b.portNumber) || [];
  const connectedCount = sortedPorts.filter(p => p.status === "connected").length;

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
        width: 340,
        maxHeight: "calc(100vh - 100px)",
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-xl">
        <div className="flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-gray-400" />
          <Network className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-semibold text-gray-700">
            {napName || `NAP-${napId}`}
          </span>
          <span className="text-xs text-gray-500">
            ({connectedCount}/{sortedPorts.length} connected)
          </span>
        </div>
        <button
          data-no-drag
          onClick={onClose}
          className="p-1 hover:bg-white/50 rounded transition-colors"
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Port Grid (quick view) */}
      <div className="px-3 py-2 border-b bg-gray-50">
        <div className="flex flex-wrap gap-1">
          {sortedPorts.map((port) => {
            const color = statusColors[port.status];
            return (
              <button
                key={port.id}
                data-no-drag
                onClick={() => setExpandedPort(expandedPort === port.id ? null : port.id!)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium transition-all ${
                  expandedPort === port.id
                    ? "ring-2 ring-blue-500 " + color.bg
                    : color.bg + " hover:ring-1 hover:ring-gray-300"
                }`}
                title={port.customerName || `Port ${port.portNumber} - ${port.status}`}
              >
                <span className={color.text}>{port.portNumber}</span>
              </button>
            );
          })}
          {/* Add port button */}
          <button
            data-no-drag
            onClick={handleAddPort}
            disabled={addingPort}
            className="w-8 h-8 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
            title="Add port"
          >
            {addingPort ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Port Details */}
      <div className="p-3 space-y-2 max-h-[400px] overflow-y-auto" data-no-drag>
        {sortedPorts.length === 0 ? (
          <p className="text-center text-sm text-gray-500 py-4">
            No ports yet. Click + to add a port.
          </p>
        ) : (
          sortedPorts.map((port) => (
            <PortCard
              key={port.id}
              port={port}
              isExpanded={expandedPort === port.id}
              onToggle={() => setExpandedPort(expandedPort === port.id ? null : port.id!)}
              onUpdate={(updates) => handleUpdatePort(port.id!, updates)}
              onDelete={() => handleDeletePort(port.id!)}
            />
          ))
        )}
      </div>

      {/* Footer stats */}
      <div className="px-3 py-2 border-t bg-gray-50 rounded-b-xl flex justify-between items-center text-xs text-gray-500">
        <div className="flex gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            {sortedPorts.filter(p => p.status === "available").length} free
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            {connectedCount} used
          </span>
        </div>
        <span>Total: {sortedPorts.length} ports</span>
      </div>
    </div>
  );
});

export default FloatingPortManager;
