"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  db,
  createODF,
  deleteODF,
  createODFPort,
  updateODFPort,
} from "@/lib/db";
import type { ODF, ODFPort, ODFPortStatus } from "@/types";
import {
  Plus,
  Server,
  MapPin,
  Trash2,
  ChevronDown,
  ChevronRight,
  Circle,
  Link2,
} from "lucide-react";
import { ConfirmModal } from "../ui/Modal";
import dynamic from "next/dynamic";

const LocationPicker = dynamic(() => import("@/components/map/LocationPicker"), {
  ssr: false,
  loading: () => <div className="h-32 bg-gray-100 rounded-lg animate-pulse" />,
});

interface ODFManagerProps {
  projectId: number;
  oltId: number;
  oltName: string;
}

export default function ODFManager({ projectId, oltId, oltName }: ODFManagerProps) {
  const [expandedODF, setExpandedODF] = useState<number | null>(null);
  const [showCreateODF, setShowCreateODF] = useState(false);
  const [deleteODFConfirm, setDeleteODFConfirm] = useState<ODF | null>(null);

  // Form state for new ODF
  const [odfName, setOdfName] = useState("");
  const [odfPortCount, setOdfPortCount] = useState(48);
  const [odfLocation, setOdfLocation] = useState("");
  const [odfLat, setOdfLat] = useState<number | undefined>();
  const [odfLng, setOdfLng] = useState<number | undefined>();

  // Get all ODFs for this OLT
  const odfs = useLiveQuery(
    () => db.odfs.where("oltId").equals(oltId).toArray(),
    [oltId]
  );

  const handleCreateODF = async () => {
    if (!odfName.trim()) return;

    const odfId = await createODF({
      projectId,
      oltId,
      name: odfName.trim(),
      portCount: odfPortCount,
      location: odfLocation || undefined,
      gpsLat: odfLat,
      gpsLng: odfLng,
    });

    // Auto-create ODF ports
    for (let i = 1; i <= odfPortCount; i++) {
      await createODFPort({
        odfId,
        portNumber: i,
        label: `${odfName.trim()}-${String(i).padStart(2, "0")}`,
        status: "available",
      });
    }

    setOdfName("");
    setOdfPortCount(48);
    setOdfLocation("");
    setOdfLat(undefined);
    setOdfLng(undefined);
    setShowCreateODF(false);
    setExpandedODF(odfId);
  };

  const handleDeleteODF = async () => {
    if (!deleteODFConfirm?.id) return;
    await deleteODF(deleteODFConfirm.id);
    setDeleteODFConfirm(null);
    if (expandedODF === deleteODFConfirm.id) {
      setExpandedODF(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Server className="w-5 h-5 text-teal-600" />
            ODF Cabinets
          </h3>
          <p className="text-sm text-gray-500">
            Optical Distribution Frames for {oltName}
          </p>
        </div>
        <button
          onClick={() => setShowCreateODF(true)}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add ODF
        </button>
      </div>

      {/* Create ODF Form */}
      {showCreateODF && (
        <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 space-y-4">
          <h4 className="font-semibold text-gray-800">Create New ODF</h4>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name *
              </label>
              <input
                type="text"
                value={odfName}
                onChange={(e) => setOdfName(e.target.value)}
                placeholder="e.g., ODF-A"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Port Count
              </label>
              <select
                value={odfPortCount}
                onChange={(e) => setOdfPortCount(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800"
              >
                <option value={12}>12 Ports</option>
                <option value={24}>24 Ports</option>
                <option value={48}>48 Ports</option>
                <option value={72}>72 Ports</option>
                <option value={96}>96 Ports</option>
                <option value={144}>144 Ports</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Location Description
            </label>
            <input
              type="text"
              value={odfLocation}
              onChange={(e) => setOdfLocation(e.target.value)}
              placeholder="e.g., Rack A, Row 2"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <MapPin className="w-4 h-4 inline mr-1" />
              GPS Location
            </label>
            <LocationPicker
              latitude={odfLat}
              longitude={odfLng}
              onLocationChange={(lat, lng) => {
                setOdfLat(lat);
                setOdfLng(lng);
              }}
              showMiniMap={true}
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowCreateODF(false)}
              className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateODF}
              disabled={!odfName.trim()}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
            >
              Create ODF
            </button>
          </div>
        </div>
      )}

      {/* ODF List */}
      {odfs?.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <Server className="w-10 h-10 mx-auto text-gray-400 mb-2" />
          <h4 className="text-base font-medium text-gray-700 mb-1">No ODFs Yet</h4>
          <p className="text-sm text-gray-500 mb-3">
            Add an ODF cabinet to patch PON ports to closures
          </p>
          <button
            onClick={() => setShowCreateODF(true)}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm"
          >
            Create First ODF
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {odfs?.map((odf) => (
            <ODFCard
              key={odf.id}
              odf={odf}
              isExpanded={expandedODF === odf.id}
              onToggle={() => setExpandedODF(expandedODF === odf.id ? null : odf.id!)}
              onDelete={() => setDeleteODFConfirm(odf)}
            />
          ))}
        </div>
      )}

      {/* Delete ODF Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteODFConfirm !== null}
        onClose={() => setDeleteODFConfirm(null)}
        onConfirm={handleDeleteODF}
        title="Delete ODF"
        message={`Are you sure you want to delete "${deleteODFConfirm?.name}" and all its ports? This cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}

// ODF Card Component
function ODFCard({
  odf,
  isExpanded,
  onToggle,
  onDelete,
}: {
  odf: ODF;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  // Get ports for this ODF
  const ports = useLiveQuery(
    () =>
      odf.id
        ? db.odfPorts
            .where("odfId")
            .equals(odf.id)
            .toArray()
            .then((p) => p.sort((a, b) => a.portNumber - b.portNumber))
        : [],
    [odf.id]
  );

  const portStats = {
    total: ports?.length || 0,
    available: ports?.filter((p) => p.status === "available").length || 0,
    connected: ports?.filter((p) => p.status === "connected").length || 0,
    reserved: ports?.filter((p) => p.status === "reserved").length || 0,
    faulty: ports?.filter((p) => p.status === "faulty").length || 0,
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-teal-50 cursor-pointer hover:bg-teal-100 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-teal-600" />
          ) : (
            <ChevronRight className="w-5 h-5 text-teal-600" />
          )}
          <div className="p-2 bg-teal-100 rounded-lg">
            <Server className="w-5 h-5 text-teal-600" />
          </div>
          <div>
            <h4 className="font-semibold text-gray-800">{odf.name}</h4>
            <div className="text-sm text-gray-500 flex items-center gap-2">
              <span>{odf.portCount} ports</span>
              {odf.location && <span>| {odf.location}</span>}
              {odf.gpsLat && odf.gpsLng && (
                <span className="text-green-600 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  GPS
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ODFPortStatusSummary stats={portStats} />
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-2 hover:bg-red-100 rounded-lg transition-colors"
            aria-label={`Delete ODF ${odf.name}`}
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      </div>

      {/* Expanded Content - Port Grid */}
      {isExpanded && ports && (
        <div className="p-4 border-t">
          <ODFPortGrid ports={ports} />
        </div>
      )}
    </div>
  );
}

// Port Status Summary for ODF
function ODFPortStatusSummary({
  stats,
}: {
  stats: {
    total: number;
    available: number;
    connected: number;
    reserved: number;
    faulty: number;
  };
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="flex items-center gap-1 text-gray-500">
        <Circle className="w-2 h-2 fill-gray-300" />
        {stats.available}
      </span>
      <span className="flex items-center gap-1 text-green-600">
        <Circle className="w-2 h-2 fill-green-500" />
        {stats.connected}
      </span>
      {stats.reserved > 0 && (
        <span className="flex items-center gap-1 text-amber-600">
          <Circle className="w-2 h-2 fill-amber-500" />
          {stats.reserved}
        </span>
      )}
      {stats.faulty > 0 && (
        <span className="flex items-center gap-1 text-red-600">
          <Circle className="w-2 h-2 fill-red-500" />
          {stats.faulty}
        </span>
      )}
    </div>
  );
}

// ODF Port Grid
function ODFPortGrid({ ports }: { ports: ODFPort[] }) {
  const [selectedPort, setSelectedPort] = useState<ODFPort | null>(null);

  // Group ports into rows of 12
  const rows: ODFPort[][] = [];
  for (let i = 0; i < ports.length; i += 12) {
    rows.push(ports.slice(i, i + 12));
  }

  const getPortColor = (status: ODFPortStatus) => {
    switch (status) {
      case "available":
        return "bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200";
      case "connected":
        return "bg-green-100 border-green-400 text-green-700 hover:bg-green-200";
      case "reserved":
        return "bg-amber-100 border-amber-400 text-amber-700 hover:bg-amber-200";
      case "faulty":
        return "bg-red-100 border-red-400 text-red-700 hover:bg-red-200";
      default:
        return "bg-gray-100 border-gray-300 text-gray-600";
    }
  };

  const handlePortClick = (port: ODFPort) => {
    setSelectedPort(port);
  };

  const handleStatusChange = async (portId: number, newStatus: ODFPortStatus) => {
    await updateODFPort(portId, { status: newStatus });
    setSelectedPort(null);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <h5 className="text-sm font-medium text-gray-700">ODF Ports</h5>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-gray-100 border border-gray-300 rounded"></span>
            Available
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-green-100 border border-green-400 rounded"></span>
            Connected
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-amber-100 border border-amber-400 rounded"></span>
            Reserved
          </span>
        </div>
      </div>

      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="flex gap-1 flex-wrap">
          {row.map((port) => (
            <button
              key={port.id}
              onClick={() => handlePortClick(port)}
              className={`
                w-10 h-10 rounded border-2 text-xs font-medium
                flex items-center justify-center
                transition-colors cursor-pointer
                ${getPortColor(port.status)}
              `}
              title={`Port ${port.portNumber}: ${port.status}${
                port.closureId ? " (connected to closure)" : ""
              }`}
            >
              {port.portNumber}
            </button>
          ))}
        </div>
      ))}

      {/* Port Quick Edit Popover */}
      {selectedPort && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setSelectedPort(null)}
          />
          <div className="relative bg-white rounded-lg shadow-xl p-4 w-72">
            <h5 className="font-semibold text-gray-800 mb-3">
              Port {selectedPort.portNumber}
            </h5>
            <div className="space-y-2">
              <p className="text-sm text-gray-500 mb-3">
                Current: <span className="font-medium">{selectedPort.status}</span>
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleStatusChange(selectedPort.id!, "available")}
                  className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  Available
                </button>
                <button
                  onClick={() => handleStatusChange(selectedPort.id!, "connected")}
                  className="px-3 py-2 text-sm bg-green-100 hover:bg-green-200 rounded-lg text-green-700"
                >
                  Connected
                </button>
                <button
                  onClick={() => handleStatusChange(selectedPort.id!, "reserved")}
                  className="px-3 py-2 text-sm bg-amber-100 hover:bg-amber-200 rounded-lg text-amber-700"
                >
                  Reserved
                </button>
                <button
                  onClick={() => handleStatusChange(selectedPort.id!, "faulty")}
                  className="px-3 py-2 text-sm bg-red-100 hover:bg-red-200 rounded-lg text-red-700"
                >
                  Faulty
                </button>
              </div>
              {selectedPort.closureId && (
                <div className="mt-3 p-2 bg-blue-50 rounded-lg text-sm text-blue-700">
                  <Link2 className="w-4 h-4 inline mr-1" />
                  Connected to Closure ID: {selectedPort.closureId}
                </div>
              )}
              <button
                onClick={() => setSelectedPort(null)}
                className="w-full mt-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
