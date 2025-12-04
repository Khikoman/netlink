"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, createEnclosure, createPort, deleteEnclosure } from "@/lib/db";
import type { Enclosure, Port, ConnectorType } from "@/types";
import {
  Plus,
  Network,
  MapPin,
  Trash2,
  ChevronDown,
  ChevronRight,
  User,
  Circle,
  Search,
} from "lucide-react";
import PortGrid, { PortStatusSummary } from "../port/PortGrid";
import PortConnectionModal from "../port/PortConnectionModal";
import { ConfirmModal } from "../ui/Modal";
import dynamic from "next/dynamic";

const LocationPicker = dynamic(() => import("@/components/map/LocationPicker"), {
  ssr: false,
  loading: () => <div className="h-32 bg-gray-100 rounded-lg animate-pulse" />,
});

interface NAPManagerProps {
  projectId: number;
}

export default function NAPManager({ projectId }: NAPManagerProps) {
  const [expandedNAP, setExpandedNAP] = useState<number | null>(null);
  const [showCreateNAP, setShowCreateNAP] = useState(false);
  const [showCreatePort, setShowCreatePort] = useState<number | null>(null);
  const [selectedPort, setSelectedPort] = useState<Port | null>(null);
  const [selectedNAPForPort, setSelectedNAPForPort] = useState<Enclosure | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<Enclosure | null>(null);

  // Form state for new NAP
  const [napName, setNapName] = useState("");
  const [napAddress, setNapAddress] = useState("");
  const [napLat, setNapLat] = useState<number | undefined>();
  const [napLng, setNapLng] = useState<number | undefined>();
  const [napPortCount, setNapPortCount] = useState(8);

  // Form state for adding ports
  const [portCount, setPortCount] = useState(4);
  const [connectorType, setConnectorType] = useState<ConnectorType>("SC");

  // Get all NAP enclosures
  const napEnclosures = useLiveQuery(
    () =>
      db.enclosures
        .where("projectId")
        .equals(projectId)
        .filter((enc) => enc.type === "nap" || enc.type === "fat")
        .toArray(),
    [projectId]
  );

  // Get all ports for search
  const allPorts = useLiveQuery(() => db.ports.toArray(), []);

  // Filter NAPs and ports by search
  const filteredNAPs = napEnclosures?.filter((nap) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();

    // Search in NAP name and address
    if (nap.name.toLowerCase().includes(query)) return true;
    if (nap.address?.toLowerCase().includes(query)) return true;

    // Search in ports (customer name, service ID)
    const napPorts = allPorts?.filter((p) => p.enclosureId === nap.id);
    return napPorts?.some(
      (p) =>
        p.customerName?.toLowerCase().includes(query) ||
        p.serviceId?.toLowerCase().includes(query) ||
        p.customerAddress?.toLowerCase().includes(query)
    );
  });

  const handleCreateNAP = async () => {
    if (!napName.trim()) return;

    const napId = await createEnclosure({
      projectId,
      name: napName.trim(),
      type: "nap",
      address: napAddress || undefined,
      gpsLat: napLat,
      gpsLng: napLng,
    });

    // Auto-create ports
    for (let i = 1; i <= napPortCount; i++) {
      await createPort({
        enclosureId: napId,
        portNumber: i,
        label: `P${i}`,
        type: "output",
        status: "available",
        connectorType: "SC",
      });
    }

    setNapName("");
    setNapAddress("");
    setNapLat(undefined);
    setNapLng(undefined);
    setNapPortCount(8);
    setShowCreateNAP(false);
  };

  const handleAddPorts = async (enclosureId: number) => {
    // Get existing port count
    const existingPorts = await db.ports.where("enclosureId").equals(enclosureId).toArray();
    const startNum = existingPorts.length + 1;

    for (let i = 0; i < portCount; i++) {
      await createPort({
        enclosureId,
        portNumber: startNum + i,
        label: `P${startNum + i}`,
        type: "output",
        status: "available",
        connectorType,
      });
    }

    setPortCount(4);
    setShowCreatePort(null);
  };

  const handleDeleteNAP = async () => {
    if (!deleteConfirm?.id) return;
    await deleteEnclosure(deleteConfirm.id);
    setDeleteConfirm(null);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">NAP Management</h2>
          <p className="text-sm text-gray-500">Network Access Points (Customer Drops)</p>
        </div>
        <button
          onClick={() => setShowCreateNAP(true)}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add NAP
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by NAP name, customer, service ID..."
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-gray-800"
        />
      </div>

      {/* Create NAP Form */}
      {showCreateNAP && (
        <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4 space-y-4">
          <h3 className="font-semibold text-gray-800">Create New NAP</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                value={napName}
                onChange={(e) => setNapName(e.target.value)}
                placeholder="e.g., NAP-001"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <input
                type="text"
                value={napAddress}
                onChange={(e) => setNapAddress(e.target.value)}
                placeholder="e.g., Oak Ave & 5th St"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Initial Port Count
            </label>
            <select
              value={napPortCount}
              onChange={(e) => setNapPortCount(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800"
            >
              <option value={4}>4 ports</option>
              <option value={8}>8 ports</option>
              <option value={12}>12 ports</option>
              <option value={16}>16 ports</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <MapPin className="w-4 h-4 inline mr-1" />
              GPS Location
            </label>
            <LocationPicker
              latitude={napLat}
              longitude={napLng}
              onLocationChange={(lat, lng) => {
                setNapLat(lat);
                setNapLng(lng);
              }}
              showMiniMap={true}
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowCreateNAP(false)}
              className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateNAP}
              disabled={!napName.trim()}
              className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50"
            >
              Create NAP
            </button>
          </div>
        </div>
      )}

      {/* NAP List */}
      {filteredNAPs?.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <Network className="w-12 h-12 mx-auto text-gray-400 mb-3" />
          <h3 className="text-lg font-medium text-gray-700 mb-1">
            {searchQuery ? "No NAPs Found" : "No NAPs Yet"}
          </h3>
          <p className="text-gray-500 mb-4">
            {searchQuery
              ? "Try a different search term"
              : "Create a NAP to manage customer drop points"}
          </p>
          {!searchQuery && (
            <button
              onClick={() => setShowCreateNAP(true)}
              className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700"
            >
              Create First NAP
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNAPs?.map((nap) => (
            <NAPCard
              key={nap.id}
              nap={nap}
              projectId={projectId}
              isExpanded={expandedNAP === nap.id}
              onToggle={() => setExpandedNAP(expandedNAP === nap.id ? null : nap.id!)}
              onDelete={() => setDeleteConfirm(nap)}
              onAddPorts={() => setShowCreatePort(nap.id!)}
              onPortClick={(port) => {
                setSelectedPort(port);
                setSelectedNAPForPort(nap);
              }}
              showAddPorts={showCreatePort === nap.id}
              portCount={portCount}
              setPortCount={setPortCount}
              connectorType={connectorType}
              setConnectorType={setConnectorType}
              onSubmitPorts={() => handleAddPorts(nap.id!)}
              onCancelPorts={() => setShowCreatePort(null)}
              searchQuery={searchQuery}
            />
          ))}
        </div>
      )}

      {/* Port Connection Modal */}
      {selectedPort && selectedNAPForPort && (
        <PortConnectionModal
          port={selectedPort}
          projectId={projectId}
          isNAP={true}
          onClose={() => {
            setSelectedPort(null);
            setSelectedNAPForPort(null);
          }}
          onSave={() => {
            // Refresh will happen via live query
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDeleteNAP}
        title="Delete NAP"
        message={`Are you sure you want to delete "${deleteConfirm?.name}" and all its customer connections? This cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}

// NAP Card Component
function NAPCard({
  nap,
  projectId,
  isExpanded,
  onToggle,
  onDelete,
  onAddPorts,
  onPortClick,
  showAddPorts,
  portCount,
  setPortCount,
  connectorType,
  setConnectorType,
  onSubmitPorts,
  onCancelPorts,
  searchQuery,
}: {
  nap: Enclosure;
  projectId: number;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onAddPorts: () => void;
  onPortClick: (port: Port) => void;
  showAddPorts: boolean;
  portCount: number;
  setPortCount: (v: number) => void;
  connectorType: ConnectorType;
  setConnectorType: (v: ConnectorType) => void;
  onSubmitPorts: () => void;
  onCancelPorts: () => void;
  searchQuery: string;
}) {
  // Get ports for this NAP
  const ports = useLiveQuery(
    () =>
      db.ports
        .where("enclosureId")
        .equals(nap.id!)
        .toArray()
        .then((p) => p.sort((a, b) => a.portNumber - b.portNumber)),
    [nap.id]
  );

  const connectedPorts = ports?.filter((p) => p.status === "connected").length || 0;
  const totalPorts = ports?.length || 0;

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-cyan-50 cursor-pointer hover:bg-cyan-100 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-cyan-600" />
          ) : (
            <ChevronRight className="w-5 h-5 text-cyan-600" />
          )}
          <div className="p-2 bg-cyan-100 rounded-lg">
            <Network className="w-5 h-5 text-cyan-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">{nap.name}</h3>
            <div className="text-sm text-gray-500 flex items-center gap-2">
              {nap.address && <span>{nap.address}</span>}
              {nap.gpsLat && nap.gpsLng && (
                <span className="text-green-600 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  GPS
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-600">
            <User className="w-4 h-4 inline mr-1" />
            {connectedPorts}/{totalPorts} connected
          </div>
          {ports && ports.length > 0 && <PortStatusSummary ports={ports} />}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-2 hover:bg-red-100 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-4 border-t">
          {/* Add Ports Form */}
          {showAddPorts && (
            <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-3 mb-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Count</label>
                  <input
                    type="number"
                    value={portCount}
                    onChange={(e) => setPortCount(parseInt(e.target.value) || 1)}
                    min={1}
                    max={24}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-gray-800 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Connector</label>
                  <select
                    value={connectorType}
                    onChange={(e) => setConnectorType(e.target.value as ConnectorType)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-gray-800 text-sm"
                  >
                    <option value="LC">LC</option>
                    <option value="SC">SC</option>
                    <option value="FC">FC</option>
                    <option value="ST">ST</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={onCancelPorts}
                  className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-200 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={onSubmitPorts}
                  className="px-3 py-1 text-sm bg-cyan-600 text-white rounded hover:bg-cyan-700"
                >
                  Add {portCount} Ports
                </button>
              </div>
            </div>
          )}

          {/* Ports List - Customer Focused View */}
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-700">Customer Ports</h4>
            <button onClick={onAddPorts} className="text-sm text-cyan-600 hover:underline">
              + Add Ports
            </button>
          </div>

          {ports && ports.length > 0 ? (
            <div className="space-y-2">
              {ports.map((port) => (
                <PortListItem
                  key={port.id}
                  port={port}
                  onClick={() => onPortClick(port)}
                  highlight={
                    !!(searchQuery &&
                    (port.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      port.serviceId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      port.customerAddress?.toLowerCase().includes(searchQuery.toLowerCase())))
                  }
                />
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-400 text-center py-4">No ports configured</div>
          )}
        </div>
      )}
    </div>
  );
}

// Port List Item Component (Customer-focused view)
function PortListItem({
  port,
  onClick,
  highlight,
}: {
  port: Port;
  onClick: () => void;
  highlight?: boolean;
}) {
  const statusConfig = {
    available: { color: "text-gray-400", bg: "bg-gray-50", label: "Available" },
    connected: { color: "text-green-600", bg: "bg-green-50", label: "Connected" },
    reserved: { color: "text-yellow-600", bg: "bg-yellow-50", label: "Reserved" },
    faulty: { color: "text-red-600", bg: "bg-red-50", label: "Faulty" },
  }[port.status];

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg border transition-all hover:shadow-sm ${
        highlight ? "border-cyan-400 bg-cyan-50" : `border-gray-200 ${statusConfig.bg}`
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center font-mono font-bold text-sm ${
              port.status === "connected"
                ? "bg-green-100 text-green-700"
                : port.status === "reserved"
                ? "bg-yellow-100 text-yellow-700"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {port.label || `P${port.portNumber}`}
          </div>
          <div>
            {port.status === "connected" && port.customerName ? (
              <>
                <div className="font-medium text-gray-800">{port.customerName}</div>
                {port.customerAddress && (
                  <div className="text-sm text-gray-500">{port.customerAddress}</div>
                )}
              </>
            ) : port.status === "reserved" ? (
              <>
                <div className="font-medium text-yellow-700">Reserved</div>
                {port.notes && <div className="text-sm text-gray-500">{port.notes}</div>}
              </>
            ) : (
              <div className={`font-medium ${statusConfig.color}`}>{statusConfig.label}</div>
            )}
          </div>
        </div>

        <div className="text-right">
          {port.serviceId && (
            <div className="text-sm font-mono text-gray-600">{port.serviceId}</div>
          )}
          <div className={`text-xs ${statusConfig.color}`}>{statusConfig.label}</div>
        </div>
      </div>
    </button>
  );
}
