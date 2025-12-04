"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, createEnclosure, createSplitter, createPort, deleteSplitter, deleteEnclosure } from "@/lib/db";
import type { Enclosure, Port, Splitter, SplitterType, ConnectorType } from "@/types";
import {
  Plus,
  GitBranch,
  MapPin,
  Trash2,
  ChevronDown,
  ChevronRight,
  Circle,
  ArrowDownToLine,
  ArrowUpFromLine,
} from "lucide-react";
import PortGrid, { PortStatusSummary } from "../port/PortGrid";
import SplitterCard, { SplitterTypeSelector } from "../port/SplitterCard";
import PortConnectionModal from "../port/PortConnectionModal";
import { ConfirmModal } from "../ui/Modal";
import dynamic from "next/dynamic";

const LocationPicker = dynamic(() => import("@/components/map/LocationPicker"), {
  ssr: false,
  loading: () => <div className="h-32 bg-gray-100 rounded-lg animate-pulse" />,
});

interface LCPManagerProps {
  projectId: number;
}

export default function LCPManager({ projectId }: LCPManagerProps) {
  const [expandedLCP, setExpandedLCP] = useState<number | null>(null);
  const [showCreateLCP, setShowCreateLCP] = useState(false);
  const [showCreateSplitter, setShowCreateSplitter] = useState<number | null>(null);
  const [showCreatePort, setShowCreatePort] = useState<number | null>(null);
  const [selectedPort, setSelectedPort] = useState<Port | null>(null);
  const [selectedLCPForPort, setSelectedLCPForPort] = useState<Enclosure | null>(null);
  const [deleteSplitterConfirm, setDeleteSplitterConfirm] = useState<Splitter | null>(null);
  const [deleteLCPConfirm, setDeleteLCPConfirm] = useState<Enclosure | null>(null);

  // Form state for new LCP
  const [lcpName, setLcpName] = useState("");
  const [lcpAddress, setLcpAddress] = useState("");
  const [lcpLat, setLcpLat] = useState<number | undefined>();
  const [lcpLng, setLcpLng] = useState<number | undefined>();

  // Form state for new splitter
  const [splitterName, setSplitterName] = useState("");
  const [splitterType, setSplitterType] = useState<SplitterType>("1:8");

  // Form state for ports
  const [portCount, setPortCount] = useState(8);
  const [portType, setPortType] = useState<"input" | "output">("output");
  const [connectorType, setConnectorType] = useState<ConnectorType>("SC");

  // Get all LCP enclosures
  const lcpEnclosures = useLiveQuery(
    () =>
      db.enclosures
        .where("projectId")
        .equals(projectId)
        .filter((enc) => enc.type === "lcp" || enc.type === "fdt")
        .toArray(),
    [projectId]
  );

  const handleCreateLCP = async () => {
    if (!lcpName.trim()) return;

    await createEnclosure({
      projectId,
      name: lcpName.trim(),
      type: "lcp",
      address: lcpAddress || undefined,
      gpsLat: lcpLat,
      gpsLng: lcpLng,
    });

    setLcpName("");
    setLcpAddress("");
    setLcpLat(undefined);
    setLcpLng(undefined);
    setShowCreateLCP(false);
  };

  const handleCreateSplitter = async (enclosureId: number) => {
    if (!splitterName.trim()) return;

    const splitterId = await createSplitter({
      enclosureId,
      name: splitterName.trim(),
      type: splitterType,
    });

    // Auto-create output ports for the splitter
    const outputCount = parseInt(splitterType.split(":")[1]);
    for (let i = 1; i <= outputCount; i++) {
      await createPort({
        enclosureId,
        splitterId,
        portNumber: i,
        label: `${splitterName.trim()}-${i}`,
        type: "output",
        status: "available",
        connectorType: "SC",
      });
    }

    setSplitterName("");
    setSplitterType("1:8");
    setShowCreateSplitter(null);
  };

  const handleCreatePorts = async (enclosureId: number) => {
    // Get existing ports to determine starting number
    const existingPorts = await db.ports
      .where("enclosureId")
      .equals(enclosureId)
      .filter((p) => !p.splitterId && p.type === portType)
      .toArray();

    const startNum = existingPorts.length + 1;
    const prefix = portType === "input" ? "I" : "O";

    for (let i = 0; i < portCount; i++) {
      await createPort({
        enclosureId,
        portNumber: startNum + i,
        label: `${prefix}-${startNum + i}`,
        type: portType,
        status: "available",
        connectorType,
      });
    }

    setPortCount(8);
    setShowCreatePort(null);
  };

  const handleDeleteSplitter = async () => {
    if (!deleteSplitterConfirm?.id) return;
    await deleteSplitter(deleteSplitterConfirm.id);
    setDeleteSplitterConfirm(null);
  };

  const handleDeleteLCP = async () => {
    if (!deleteLCPConfirm?.id) return;
    await deleteEnclosure(deleteLCPConfirm.id);
    setDeleteLCPConfirm(null);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">LCP Management</h2>
          <p className="text-sm text-gray-500">Local Convergence Points (Aggregation)</p>
        </div>
        <button
          onClick={() => setShowCreateLCP(true)}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add LCP
        </button>
      </div>

      {/* Create LCP Form */}
      {showCreateLCP && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 space-y-4">
          <h3 className="font-semibold text-gray-800">Create New LCP</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                value={lcpName}
                onChange={(e) => setLcpName(e.target.value)}
                placeholder="e.g., LCP-001"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <input
                type="text"
                value={lcpAddress}
                onChange={(e) => setLcpAddress(e.target.value)}
                placeholder="e.g., Main St & Oak Ave"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <MapPin className="w-4 h-4 inline mr-1" />
              GPS Location
            </label>
            <LocationPicker
              latitude={lcpLat}
              longitude={lcpLng}
              onLocationChange={(lat, lng) => {
                setLcpLat(lat);
                setLcpLng(lng);
              }}
              showMiniMap={true}
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowCreateLCP(false)}
              className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateLCP}
              disabled={!lcpName.trim()}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
            >
              Create LCP
            </button>
          </div>
        </div>
      )}

      {/* LCP List */}
      {lcpEnclosures?.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <GitBranch className="w-12 h-12 mx-auto text-gray-400 mb-3" />
          <h3 className="text-lg font-medium text-gray-700 mb-1">No LCPs Yet</h3>
          <p className="text-gray-500 mb-4">Create an LCP to manage your aggregation points</p>
          <button
            onClick={() => setShowCreateLCP(true)}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
          >
            Create First LCP
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {lcpEnclosures?.map((lcp) => (
            <LCPCard
              key={lcp.id}
              lcp={lcp}
              isExpanded={expandedLCP === lcp.id}
              onToggle={() => setExpandedLCP(expandedLCP === lcp.id ? null : lcp.id!)}
              onDelete={() => setDeleteLCPConfirm(lcp)}
              onCreateSplitter={() => setShowCreateSplitter(lcp.id!)}
              onCreatePort={() => setShowCreatePort(lcp.id!)}
              onPortClick={(port) => {
                setSelectedPort(port);
                setSelectedLCPForPort(lcp);
              }}
              showCreateSplitter={showCreateSplitter === lcp.id}
              showCreatePort={showCreatePort === lcp.id}
              splitterName={splitterName}
              setSplitterName={setSplitterName}
              splitterType={splitterType}
              setSplitterType={setSplitterType}
              onSubmitSplitter={() => handleCreateSplitter(lcp.id!)}
              onCancelSplitter={() => setShowCreateSplitter(null)}
              portCount={portCount}
              setPortCount={setPortCount}
              portType={portType}
              setPortType={setPortType}
              connectorType={connectorType}
              setConnectorType={setConnectorType}
              onSubmitPorts={() => handleCreatePorts(lcp.id!)}
              onCancelPorts={() => setShowCreatePort(null)}
              onDeleteSplitter={(splitter) => setDeleteSplitterConfirm(splitter)}
            />
          ))}
        </div>
      )}

      {/* Port Connection Modal */}
      {selectedPort && selectedLCPForPort && (
        <PortConnectionModal
          port={selectedPort}
          projectId={projectId}
          isNAP={false}
          onClose={() => {
            setSelectedPort(null);
            setSelectedLCPForPort(null);
          }}
          onSave={() => {
            // Refresh will happen via live query
          }}
        />
      )}

      {/* Delete Splitter Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteSplitterConfirm !== null}
        onClose={() => setDeleteSplitterConfirm(null)}
        onConfirm={handleDeleteSplitter}
        title="Delete Splitter"
        message={`Are you sure you want to delete "${deleteSplitterConfirm?.name}" and all its ports? This cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />

      {/* Delete LCP Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteLCPConfirm !== null}
        onClose={() => setDeleteLCPConfirm(null)}
        onConfirm={handleDeleteLCP}
        title="Delete LCP"
        message={`Are you sure you want to delete "${deleteLCPConfirm?.name}" and all its splitters and ports? This cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}

// LCP Card Component
function LCPCard({
  lcp,
  isExpanded,
  onToggle,
  onDelete,
  onCreateSplitter,
  onCreatePort,
  onPortClick,
  showCreateSplitter,
  showCreatePort,
  splitterName,
  setSplitterName,
  splitterType,
  setSplitterType,
  onSubmitSplitter,
  onCancelSplitter,
  portCount,
  setPortCount,
  portType,
  setPortType,
  connectorType,
  setConnectorType,
  onSubmitPorts,
  onCancelPorts,
  onDeleteSplitter,
}: {
  lcp: Enclosure;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onCreateSplitter: () => void;
  onCreatePort: () => void;
  onPortClick: (port: Port) => void;
  showCreateSplitter: boolean;
  showCreatePort: boolean;
  splitterName: string;
  setSplitterName: (v: string) => void;
  splitterType: SplitterType;
  setSplitterType: (v: SplitterType) => void;
  onSubmitSplitter: () => void;
  onCancelSplitter: () => void;
  portCount: number;
  setPortCount: (v: number) => void;
  portType: "input" | "output";
  setPortType: (v: "input" | "output") => void;
  connectorType: ConnectorType;
  setConnectorType: (v: ConnectorType) => void;
  onSubmitPorts: () => void;
  onCancelPorts: () => void;
  onDeleteSplitter: (splitter: Splitter) => void;
}) {
  // Get splitters and ports for this LCP
  const splitters = useLiveQuery(
    () => db.splitters.where("enclosureId").equals(lcp.id!).toArray(),
    [lcp.id]
  );

  const ports = useLiveQuery(
    () => db.ports.where("enclosureId").equals(lcp.id!).toArray(),
    [lcp.id]
  );

  const inputPorts = ports?.filter((p) => p.type === "input" && !p.splitterId) || [];
  const outputPorts = ports?.filter((p) => p.type === "output" && !p.splitterId) || [];
  const allPorts = ports || [];

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-orange-50 cursor-pointer hover:bg-orange-100 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-orange-600" />
          ) : (
            <ChevronRight className="w-5 h-5 text-orange-600" />
          )}
          <div className="p-2 bg-orange-100 rounded-lg">
            <GitBranch className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">{lcp.name}</h3>
            <div className="text-sm text-gray-500 flex items-center gap-2">
              {lcp.address && <span>{lcp.address}</span>}
              {lcp.gpsLat && lcp.gpsLng && (
                <span className="text-green-600 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  GPS
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {allPorts.length > 0 && <PortStatusSummary ports={allPorts} />}
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
        <div className="p-4 space-y-4 border-t">
          {/* Input Ports Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-700 flex items-center gap-2">
                <ArrowDownToLine className="w-4 h-4 text-blue-600" />
                Input Ports (Feeder Cables)
              </h4>
            </div>
            {inputPorts.length > 0 ? (
              <PortGrid ports={inputPorts} onPortClick={onPortClick} columns={6} />
            ) : (
              <div className="text-sm text-gray-400 bg-gray-50 p-3 rounded-lg">
                No input ports configured
              </div>
            )}
          </div>

          {/* Splitters Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-700 flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-purple-600" />
                Splitters
              </h4>
              <button
                onClick={onCreateSplitter}
                className="text-sm text-purple-600 hover:underline"
              >
                + Add Splitter
              </button>
            </div>

            {showCreateSplitter && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-3 space-y-3">
                <input
                  type="text"
                  value={splitterName}
                  onChange={(e) => setSplitterName(e.target.value)}
                  placeholder="Splitter Name (e.g., SPL-01)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800 text-sm"
                />
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Type</label>
                  <SplitterTypeSelector value={splitterType} onChange={setSplitterType} />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={onCancelSplitter}
                    className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-200 rounded"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={onSubmitSplitter}
                    disabled={!splitterName.trim()}
                    className="px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                  >
                    Create
                  </button>
                </div>
              </div>
            )}

            {splitters && splitters.length > 0 ? (
              <div className="space-y-2">
                {splitters.map((splitter) => (
                  <SplitterCard
                    key={splitter.id}
                    splitter={splitter}
                    onPortClick={onPortClick}
                    onDelete={onDeleteSplitter}
                  />
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-400 bg-gray-50 p-3 rounded-lg">
                No splitters configured
              </div>
            )}
          </div>

          {/* Output Ports Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-700 flex items-center gap-2">
                <ArrowUpFromLine className="w-4 h-4 text-green-600" />
                Output Ports (Distribution)
              </h4>
              <button onClick={onCreatePort} className="text-sm text-green-600 hover:underline">
                + Add Ports
              </button>
            </div>

            {showCreatePort && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3 space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Type</label>
                    <select
                      value={portType}
                      onChange={(e) => setPortType(e.target.value as "input" | "output")}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-gray-800 text-sm"
                    >
                      <option value="input">Input</option>
                      <option value="output">Output</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Count</label>
                    <input
                      type="number"
                      value={portCount}
                      onChange={(e) => setPortCount(parseInt(e.target.value) || 1)}
                      min={1}
                      max={48}
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
                    className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Add {portCount} Ports
                  </button>
                </div>
              </div>
            )}

            {outputPorts.length > 0 ? (
              <PortGrid ports={outputPorts} onPortClick={onPortClick} columns={6} />
            ) : (
              <div className="text-sm text-gray-400 bg-gray-50 p-3 rounded-lg">
                No standalone output ports (splitter outputs shown above)
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
