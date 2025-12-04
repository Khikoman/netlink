"use client";

import { useState, useEffect, useRef } from "react";
import {
  X,
  Cable,
  User,
  FileText,
  Activity,
  MapPin,
  Paperclip,
  Phone,
  Mail,
  Trash2,
  Download,
  Image,
  FileIcon,
  Clock,
} from "lucide-react";
import type {
  Port,
  PortStatus,
  Cable as CableType,
  ConnectorType,
  ServiceStatus,
  CustomerAttachment,
  AttachmentType,
} from "@/types";
import {
  updatePort,
  getCables,
  createAttachment,
  getAttachmentsByPort,
  deleteAttachment,
} from "@/lib/db";

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

const SERVICE_STATUS_OPTIONS: { value: ServiceStatus; label: string; color: string }[] = [
  { value: "active", label: "Active", color: "bg-green-500" },
  { value: "pending", label: "Pending", color: "bg-yellow-500" },
  { value: "suspended", label: "Suspended", color: "bg-red-500" },
  { value: "terminated", label: "Terminated", color: "bg-gray-500" },
];

const CONNECTOR_TYPES: ConnectorType[] = ["LC", "SC", "FC", "ST", "MPO", "MTP"];

type TabId = "basic" | "customer" | "onu" | "location" | "attachments";

// Signal level indicator component
function SignalIndicator({ value, label }: { value?: number; label: string }) {
  if (value === undefined || value === null) return null;

  const getLevel = (val: number) => {
    if (val > -20) return { color: "bg-green-500", text: "Excellent", textColor: "text-green-700" };
    if (val > -25) return { color: "bg-green-400", text: "Good", textColor: "text-green-600" };
    if (val > -27) return { color: "bg-yellow-500", text: "Fair", textColor: "text-yellow-700" };
    if (val > -28) return { color: "bg-orange-500", text: "Poor", textColor: "text-orange-700" };
    return { color: "bg-red-500", text: "Critical", textColor: "text-red-700" };
  };

  const level = getLevel(value);

  return (
    <div className="flex items-center gap-2 mt-1">
      <div className={`w-2 h-2 rounded-full ${level.color}`} />
      <span className={`text-xs ${level.textColor}`}>
        {value.toFixed(1)} dBm - {level.text}
      </span>
    </div>
  );
}

export default function PortConnectionModal({
  port,
  projectId,
  isNAP = false,
  onClose,
  onSave,
}: PortConnectionModalProps) {
  // Tab state
  const [activeTab, setActiveTab] = useState<TabId>("basic");

  // Basic info state
  const [status, setStatus] = useState<PortStatus>(port.status);
  const [connectorType, setConnectorType] = useState<ConnectorType>(port.connectorType);
  const [connectedCableId, setConnectedCableId] = useState<number | undefined>(port.connectedCableId);
  const [connectedFiber, setConnectedFiber] = useState<number | undefined>(port.connectedFiber);
  const [notes, setNotes] = useState(port.notes || "");

  // Customer info state
  const [customerName, setCustomerName] = useState(port.customerName || "");
  const [customerAddress, setCustomerAddress] = useState(port.customerAddress || "");
  const [serviceId, setServiceId] = useState(port.serviceId || "");
  const [customerPhone, setCustomerPhone] = useState(port.customerPhone || "");
  const [customerEmail, setCustomerEmail] = useState(port.customerEmail || "");
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus>(port.serviceStatus || "active");
  const [planType, setPlanType] = useState(port.planType || "");

  // ONU readings state
  const [onuRxPower, setOnuRxPower] = useState<number | undefined>(port.onuRxPower);
  const [onuTxPower, setOnuTxPower] = useState<number | undefined>(port.onuTxPower);
  const [oltRxPower, setOltRxPower] = useState<number | undefined>(port.oltRxPower);
  const [onuModel, setOnuModel] = useState(port.onuModel || "");
  const [onuSerial, setOnuSerial] = useState(port.onuSerial || "");
  const [onuMac, setOnuMac] = useState(port.onuMac || "");

  // GPS state
  const [customerGpsLat, setCustomerGpsLat] = useState<number | undefined>(port.customerGpsLat);
  const [customerGpsLng, setCustomerGpsLng] = useState<number | undefined>(port.customerGpsLng);

  // Attachments state
  const [attachments, setAttachments] = useState<CustomerAttachment[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Other state
  const [cables, setCables] = useState<CableType[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getCables(projectId).then(setCables);
    if (port.id) {
      getAttachmentsByPort(port.id).then(setAttachments);
    }
  }, [projectId, port.id]);

  const selectedCable = cables.find((c) => c.id === connectedCableId);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !port.id) return;

    setUploadingFile(true);
    try {
      for (const file of Array.from(files)) {
        // Determine attachment type from mime type
        let attachmentType: AttachmentType = "other";
        if (file.type.startsWith("image/")) attachmentType = "photo";
        else if (file.type === "application/pdf") attachmentType = "document";

        await createAttachment({
          portId: port.id,
          projectId,
          filename: file.name,
          mimeType: file.type,
          fileSize: file.size,
          blob: file,
          attachmentType,
        });
      }
      // Refresh attachments
      const updated = await getAttachmentsByPort(port.id);
      setAttachments(updated);
    } catch (error) {
      console.error("Failed to upload file:", error);
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteAttachment = async (id: number) => {
    if (!port.id) return;
    await deleteAttachment(id);
    const updated = await getAttachmentsByPort(port.id);
    setAttachments(updated);
  };

  const handleDownloadAttachment = (attachment: CustomerAttachment) => {
    const url = URL.createObjectURL(attachment.blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = attachment.filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCustomerGpsLat(position.coords.latitude);
          setCustomerGpsLng(position.coords.longitude);
        },
        (error) => {
          console.error("Geolocation error:", error);
          alert("Could not get location. Please check permissions.");
        }
      );
    }
  };

  const openInMaps = () => {
    if (customerGpsLat && customerGpsLng) {
      window.open(
        `https://www.google.com/maps?q=${customerGpsLat},${customerGpsLng}`,
        "_blank"
      );
    }
  };

  const handleSave = async () => {
    if (!port.id) return;

    setSaving(true);
    try {
      await updatePort(port.id, {
        status,
        connectorType,
        connectedCableId: status === "connected" ? connectedCableId : undefined,
        connectedFiber: status === "connected" ? connectedFiber : undefined,
        // Customer info (NAP only)
        customerName: isNAP ? customerName || undefined : undefined,
        customerAddress: isNAP ? customerAddress || undefined : undefined,
        serviceId: isNAP ? serviceId || undefined : undefined,
        customerPhone: isNAP ? customerPhone || undefined : undefined,
        customerEmail: isNAP ? customerEmail || undefined : undefined,
        serviceStatus: isNAP && (status === "connected" || status === "reserved") ? serviceStatus : undefined,
        planType: isNAP ? planType || undefined : undefined,
        // ONU readings
        onuRxPower: isNAP ? onuRxPower : undefined,
        onuTxPower: isNAP ? onuTxPower : undefined,
        oltRxPower: isNAP ? oltRxPower : undefined,
        onuModel: isNAP ? onuModel || undefined : undefined,
        onuSerial: isNAP ? onuSerial || undefined : undefined,
        onuMac: isNAP ? onuMac || undefined : undefined,
        lastReadingDate: isNAP && (onuRxPower || onuTxPower || oltRxPower) ? new Date() : undefined,
        // GPS
        customerGpsLat: isNAP ? customerGpsLat : undefined,
        customerGpsLng: isNAP ? customerGpsLng : undefined,
        // Notes
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

  const tabs: { id: TabId; label: string; icon: React.ReactNode; show: boolean }[] = [
    { id: "basic", label: "Basic", icon: <Cable className="w-4 h-4" />, show: true },
    { id: "customer", label: "Customer", icon: <User className="w-4 h-4" />, show: isNAP },
    { id: "onu", label: "ONU", icon: <Activity className="w-4 h-4" />, show: isNAP },
    { id: "location", label: "Location", icon: <MapPin className="w-4 h-4" />, show: isNAP },
    { id: "attachments", label: "Files", icon: <Paperclip className="w-4 h-4" />, show: isNAP },
  ];

  const visibleTabs = tabs.filter((t) => t.show);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">
              Port {port.label || `P${port.portNumber}`}
            </h3>
            {customerName && (
              <p className="text-sm text-gray-500">{customerName}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        {visibleTabs.length > 1 && (
          <div className="flex border-b px-4 flex-shrink-0 overflow-x-auto">
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Basic Tab */}
          {activeTab === "basic" && (
            <>
              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Port Status
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

              {/* Cable Connection */}
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

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <FileText className="w-4 h-4 inline mr-1" />
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800 text-sm resize-none"
                />
              </div>
            </>
          )}

          {/* Customer Tab */}
          {activeTab === "customer" && isNAP && (
            <div className="space-y-4">
              {/* Service Status Badge */}
              {(status === "connected" || status === "reserved") && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Service Status
                  </label>
                  <div className="flex gap-2">
                    {SERVICE_STATUS_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setServiceStatus(opt.value)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                          serviceStatus === opt.value
                            ? `${opt.color} text-white`
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    <Phone className="w-3 h-3 inline mr-1" />
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="09XX XXX XXXX"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    <Mail className="w-3 h-3 inline mr-1" />
                    Email
                  </label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
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
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Plan Type</label>
                  <input
                    type="text"
                    value={planType}
                    onChange={(e) => setPlanType(e.target.value)}
                    placeholder="e.g., 50 Mbps"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800 text-sm"
                  />
                </div>
              </div>

              {/* Installation Notes / Comments */}
              <div className="p-3 bg-amber-50 rounded-lg">
                <label className="block text-sm font-medium text-amber-800 mb-2">
                  <FileText className="w-4 h-4 inline mr-1" />
                  Installation Notes / Comments
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes about the installation, customer requests, technician remarks, issues encountered, etc."
                  rows={4}
                  className="w-full px-3 py-2 border border-amber-200 rounded-lg text-gray-800 text-sm resize-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
                />
                <p className="text-xs text-amber-600 mt-1">
                  Notes visible to technicians and support staff
                </p>
              </div>
            </div>
          )}

          {/* ONU Tab */}
          {activeTab === "onu" && isNAP && (
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-blue-700 font-medium text-sm">
                    <Activity className="w-4 h-4" />
                    Optical Power Readings
                  </div>
                  <button
                    onClick={() => {
                      // Record current timestamp
                    }}
                    className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                  >
                    <Clock className="w-3 h-3 inline mr-1" />
                    Now
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">ONU Rx (dBm)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={onuRxPower ?? ""}
                      onChange={(e) => setOnuRxPower(e.target.value ? Number(e.target.value) : undefined)}
                      placeholder="-20.5"
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-gray-800 text-sm"
                    />
                    <SignalIndicator value={onuRxPower} label="ONU Rx" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">ONU Tx (dBm)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={onuTxPower ?? ""}
                      onChange={(e) => setOnuTxPower(e.target.value ? Number(e.target.value) : undefined)}
                      placeholder="2.5"
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-gray-800 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">OLT Rx (dBm)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={oltRxPower ?? ""}
                      onChange={(e) => setOltRxPower(e.target.value ? Number(e.target.value) : undefined)}
                      placeholder="-18.3"
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-gray-800 text-sm"
                    />
                    <SignalIndicator value={oltRxPower} label="OLT Rx" />
                  </div>
                </div>
              </div>

              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 text-gray-700 font-medium text-sm mb-3">
                  ONU Device Info
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">ONU Model</label>
                    <input
                      type="text"
                      value={onuModel}
                      onChange={(e) => setOnuModel(e.target.value)}
                      placeholder="e.g., Huawei HG8145V5"
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-gray-800 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Serial Number</label>
                      <input
                        type="text"
                        value={onuSerial}
                        onChange={(e) => setOnuSerial(e.target.value)}
                        placeholder="HWTC12345678"
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-gray-800 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">MAC Address</label>
                      <input
                        type="text"
                        value={onuMac}
                        onChange={(e) => setOnuMac(e.target.value)}
                        placeholder="AA:BB:CC:DD:EE:FF"
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-gray-800 text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Location Tab */}
          {activeTab === "location" && isNAP && (
            <div className="space-y-4">
              <div className="p-3 bg-purple-50 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-purple-700 font-medium text-sm">
                    <MapPin className="w-4 h-4" />
                    Customer Location
                  </div>
                  <button
                    onClick={getCurrentLocation}
                    className="text-xs bg-purple-600 text-white px-2 py-1 rounded hover:bg-purple-700"
                  >
                    Get GPS
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Latitude</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={customerGpsLat ?? ""}
                      onChange={(e) => setCustomerGpsLat(e.target.value ? Number(e.target.value) : undefined)}
                      placeholder="14.5995"
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-gray-800 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Longitude</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={customerGpsLng ?? ""}
                      onChange={(e) => setCustomerGpsLng(e.target.value ? Number(e.target.value) : undefined)}
                      placeholder="120.9842"
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-gray-800 text-sm"
                    />
                  </div>
                </div>

                {customerGpsLat && customerGpsLng && (
                  <button
                    onClick={openInMaps}
                    className="mt-3 w-full py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                  >
                    Open in Google Maps
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Attachments Tab */}
          {activeTab === "attachments" && isNAP && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-700 font-medium text-sm">
                  <Paperclip className="w-4 h-4" />
                  Attachments ({attachments.length})
                </div>
                <label className="cursor-pointer bg-amber-600 text-white px-3 py-1.5 rounded text-sm hover:bg-amber-700">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,.pdf,.doc,.docx"
                    hidden
                    onChange={handleFileUpload}
                    disabled={uploadingFile}
                  />
                  {uploadingFile ? "Uploading..." : "Add File"}
                </label>
              </div>

              {attachments.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  No attachments yet. Add photos, documents, or signatures.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {attachments.map((att) => (
                    <div
                      key={att.id}
                      className="border rounded-lg p-2 bg-gray-50 relative group"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        {att.mimeType.startsWith("image/") ? (
                          <Image className="w-4 h-4 text-blue-600" />
                        ) : (
                          <FileIcon className="w-4 h-4 text-gray-600" />
                        )}
                        <span className="text-xs text-gray-700 truncate flex-1">
                          {att.filename}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {(att.fileSize / 1024).toFixed(1)} KB
                      </div>
                      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 flex gap-1">
                        <button
                          onClick={() => handleDownloadAttachment(att)}
                          className="p-1 bg-white rounded shadow hover:bg-gray-100"
                        >
                          <Download className="w-3 h-3 text-blue-600" />
                        </button>
                        <button
                          onClick={() => att.id && handleDeleteAttachment(att.id)}
                          className="p-1 bg-white rounded shadow hover:bg-gray-100"
                        >
                          <Trash2 className="w-3 h-3 text-red-600" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t bg-gray-50 flex-shrink-0">
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
