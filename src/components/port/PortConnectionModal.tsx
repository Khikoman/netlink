"use client";

import { useState, useEffect } from "react";
import { X, Cable, User, FileText } from "lucide-react";
import type { Port, PortStatus, Cable as CableType, ConnectorType } from "@/types";
import { updatePort, getCables } from "@/lib/db";

interface PortConnectionModalProps {
  port: Port;
  projectId: number;
  isNAP?: boolean;
  onClose: () => void;
  onSave: () => void;
}

const STATUS_OPTIONS: { value: PortStatus; label: string; color: string }[] = [
  { value: "available", label: "Available", color: "text-gray-500" },
  { value: "connected", label: "Connected", color: "text-green-600" },
  { value: "reserved", label: "Reserved", color: "text-yellow-600" },
  { value: "faulty", label: "Faulty", color: "text-red-600" },
];

const CONNECTOR_TYPES: ConnectorType[] = ["LC", "SC", "FC", "ST", "MPO", "MTP"];

export default function PortConnectionModal({
  port,
  projectId,
  isNAP = false,
  onClose,
  onSave,
}: PortConnectionModalProps) {
  const [status, setStatus] = useState<PortStatus>(port.status);
  const [connectorType, setConnectorType] = useState<ConnectorType>(port.connectorType);
  const [connectedCableId, setConnectedCableId] = useState<number | undefined>(port.connectedCableId);
  const [connectedFiber, setConnectedFiber] = useState<number | undefined>(port.connectedFiber);
  const [customerName, setCustomerName] = useState(port.customerName || "");
  const [customerAddress, setCustomerAddress] = useState(port.customerAddress || "");
  const [serviceId, setServiceId] = useState(port.serviceId || "");
  const [notes, setNotes] = useState(port.notes || "");
  const [cables, setCables] = useState<CableType[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getCables(projectId).then(setCables);
  }, [projectId]);

  const selectedCable = cables.find((c) => c.id === connectedCableId);

  const handleSave = async () => {
    if (!port.id) return;

    setSaving(true);
    try {
      await updatePort(port.id, {
        status,
        connectorType,
        connectedCableId: status === "connected" ? connectedCableId : undefined,
        connectedFiber: status === "connected" ? connectedFiber : undefined,
        customerName: isNAP ? customerName || undefined : undefined,
        customerAddress: isNAP ? customerAddress || undefined : undefined,
        serviceId: isNAP ? serviceId || undefined : undefined,
        notes: notes || undefined,
      });
      onSave();
      onClose();
    } catch (error) {
      console.error("Failed to update port:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-800">
            Configure Port {port.label || `P${port.portNumber}`}
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as PortStatus)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Connector Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Connector Type
            </label>
            <select
              value={connectorType}
              onChange={(e) => setConnectorType(e.target.value as ConnectorType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800"
            >
              {CONNECTOR_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {/* Cable Connection (shown when connected) */}
          {status === "connected" && (
            <div className="space-y-3 p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2 text-blue-700 font-medium text-sm">
                <Cable className="w-4 h-4" />
                Cable Connection
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">Cable</label>
                <select
                  value={connectedCableId || ""}
                  onChange={(e) => {
                    setConnectedCableId(e.target.value ? Number(e.target.value) : undefined);
                    setConnectedFiber(undefined);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800 text-sm"
                >
                  <option value="">Select Cable...</option>
                  {cables.map((cable) => (
                    <option key={cable.id} value={cable.id}>
                      {cable.name} ({cable.fiberCount}F)
                    </option>
                  ))}
                </select>
              </div>

              {selectedCable && (
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Fiber</label>
                  <select
                    value={connectedFiber || ""}
                    onChange={(e) =>
                      setConnectedFiber(e.target.value ? Number(e.target.value) : undefined)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800 text-sm"
                  >
                    <option value="">Select Fiber...</option>
                    {Array.from({ length: selectedCable.fiberCount }, (_, i) => i + 1).map(
                      (fiber) => (
                        <option key={fiber} value={fiber}>
                          Fiber {fiber}
                        </option>
                      )
                    )}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Customer Info (NAP only) */}
          {isNAP && (status === "connected" || status === "reserved") && (
            <div className="space-y-3 p-3 bg-green-50 rounded-lg">
              <div className="flex items-center gap-2 text-green-700 font-medium text-sm">
                <User className="w-4 h-4" />
                Customer Information
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">Customer Name</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g., John Smith"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">Address</label>
                <input
                  type="text"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="e.g., 123 Main St"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">Service ID</label>
                <input
                  type="text"
                  value={serviceId}
                  onChange={(e) => setServiceId(e.target.value)}
                  placeholder="e.g., ACC-10045"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800 text-sm"
                />
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <FileText className="w-4 h-4 inline mr-1" />
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                status === "reserved"
                  ? "e.g., Pending installation Dec 15"
                  : "Optional notes..."
              }
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800 text-sm resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
