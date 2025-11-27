"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, createOLT, createEnclosure, createPort } from "@/lib/db";
import {
  useOLTs,
  useOLT,
  useLCPsByOLT,
  useNAPsByLCP,
  useOLTHierarchyStats,
  useLCPHierarchyStats,
  useNAPPortStats,
} from "@/lib/db/hooks";
import type { OLT, Enclosure, Port } from "@/types";
import {
  Server,
  GitBranch,
  Network,
  ChevronRight,
  Plus,
  Home,
  Users,
  Activity,
  MapPin,
  X,
} from "lucide-react";
import { PortGridCompact, PortStatusSummary } from "@/components/port/PortGrid";

interface HierarchyBrowserProps {
  projectId: number;
}

interface HierarchyState {
  selectedOLTId: number | null;
  selectedLCPId: number | null;
  selectedNAPId: number | null;
}

export default function HierarchyBrowser({ projectId }: HierarchyBrowserProps) {
  const [state, setState] = useState<HierarchyState>({
    selectedOLTId: null,
    selectedLCPId: null,
    selectedNAPId: null,
  });

  // Modal states
  const [showOLTForm, setShowOLTForm] = useState(false);
  const [showLCPForm, setShowLCPForm] = useState(false);
  const [showNAPForm, setShowNAPForm] = useState(false);

  // Data
  const olts = useOLTs(projectId);
  const selectedOLT = useOLT(state.selectedOLTId ?? undefined);
  const lcps = useLCPsByOLT(state.selectedOLTId ?? undefined);
  const selectedLCP = useLiveQuery(
    () => (state.selectedLCPId ? db.enclosures.get(state.selectedLCPId) : undefined),
    [state.selectedLCPId]
  );
  const naps = useNAPsByLCP(state.selectedLCPId ?? undefined);
  const selectedNAP = useLiveQuery(
    () => (state.selectedNAPId ? db.enclosures.get(state.selectedNAPId) : undefined),
    [state.selectedNAPId]
  );
  const napPorts = useLiveQuery(
    () =>
      state.selectedNAPId
        ? db.ports.where("enclosureId").equals(state.selectedNAPId).toArray()
        : [],
    [state.selectedNAPId]
  );

  // Stats
  const oltStats = useOLTHierarchyStats(state.selectedOLTId ?? undefined);
  const lcpStats = useLCPHierarchyStats(state.selectedLCPId ?? undefined);
  const napStats = useNAPPortStats(state.selectedNAPId ?? undefined);

  // Navigation handlers
  const selectOLT = (oltId: number) => {
    setState({ selectedOLTId: oltId, selectedLCPId: null, selectedNAPId: null });
  };

  const selectLCP = (lcpId: number) => {
    setState((prev) => ({ ...prev, selectedLCPId: lcpId, selectedNAPId: null }));
  };

  const selectNAP = (napId: number) => {
    setState((prev) => ({ ...prev, selectedNAPId: napId }));
  };

  const resetToOLT = () => {
    setState({ selectedOLTId: null, selectedLCPId: null, selectedNAPId: null });
  };

  const resetToLCP = () => {
    setState((prev) => ({ ...prev, selectedLCPId: null, selectedNAPId: null }));
  };

  const resetToNAP = () => {
    setState((prev) => ({ ...prev, selectedNAPId: null }));
  };

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <HierarchyBreadcrumb
        oltName={selectedOLT?.name}
        lcpName={selectedLCP?.name}
        napName={selectedNAP?.name}
        onNavigateHome={resetToOLT}
        onNavigateToOLT={resetToLCP}
        onNavigateToLCP={resetToNAP}
      />

      {/* 3-Panel Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* OLT Panel - Always visible */}
        <OLTPanel
          olts={olts || []}
          selectedId={state.selectedOLTId}
          onSelect={selectOLT}
          onAdd={() => setShowOLTForm(true)}
          stats={state.selectedOLTId ? oltStats : undefined}
        />

        {/* LCP Panel - Visible when OLT selected */}
        {state.selectedOLTId && (
          <LCPPanel
            lcps={lcps || []}
            selectedId={state.selectedLCPId}
            onSelect={selectLCP}
            onAdd={() => setShowLCPForm(true)}
            stats={state.selectedLCPId ? lcpStats : undefined}
            oltName={selectedOLT?.name}
          />
        )}

        {/* NAP Panel - Visible when LCP selected */}
        {state.selectedLCPId && (
          <NAPPanel
            naps={naps || []}
            selectedId={state.selectedNAPId}
            onSelect={selectNAP}
            onAdd={() => setShowNAPForm(true)}
            stats={state.selectedNAPId ? napStats : undefined}
            lcpName={selectedLCP?.name}
          />
        )}
      </div>

      {/* NAP Ports Detail - When NAP selected */}
      {state.selectedNAPId && selectedNAP && napPorts && (
        <NAPPortsDetail
          nap={selectedNAP}
          ports={napPorts.sort((a, b) => a.portNumber - b.portNumber)}
        />
      )}

      {/* OLT Form Modal */}
      {showOLTForm && (
        <OLTFormModal
          projectId={projectId}
          onClose={() => setShowOLTForm(false)}
          onCreated={(id) => {
            setShowOLTForm(false);
            selectOLT(id);
          }}
        />
      )}

      {/* LCP Form Modal */}
      {showLCPForm && state.selectedOLTId && (
        <LCPFormModal
          projectId={projectId}
          oltId={state.selectedOLTId}
          onClose={() => setShowLCPForm(false)}
          onCreated={(id) => {
            setShowLCPForm(false);
            selectLCP(id);
          }}
        />
      )}

      {/* NAP Form Modal */}
      {showNAPForm && state.selectedLCPId && (
        <NAPFormModal
          projectId={projectId}
          lcpId={state.selectedLCPId}
          onClose={() => setShowNAPForm(false)}
          onCreated={(id) => {
            setShowNAPForm(false);
            selectNAP(id);
          }}
        />
      )}
    </div>
  );
}

// ============================================
// Breadcrumb Component
// ============================================

function HierarchyBreadcrumb({
  oltName,
  lcpName,
  napName,
  onNavigateHome,
  onNavigateToOLT,
  onNavigateToLCP,
}: {
  oltName?: string;
  lcpName?: string;
  napName?: string;
  onNavigateHome: () => void;
  onNavigateToOLT: () => void;
  onNavigateToLCP: () => void;
}) {
  return (
    <nav className="flex items-center gap-2 text-sm bg-white rounded-lg px-4 py-2 shadow-sm">
      <button
        onClick={onNavigateHome}
        className="flex items-center gap-1 text-gray-600 hover:text-blue-600"
      >
        <Home className="w-4 h-4" />
        <span>Network</span>
      </button>

      {oltName && (
        <>
          <ChevronRight className="w-4 h-4 text-gray-400" />
          <button
            onClick={onNavigateToOLT}
            className="flex items-center gap-1 text-gray-600 hover:text-blue-600"
          >
            <Server className="w-4 h-4 text-teal-600" />
            <span>{oltName}</span>
          </button>
        </>
      )}

      {lcpName && (
        <>
          <ChevronRight className="w-4 h-4 text-gray-400" />
          <button
            onClick={onNavigateToLCP}
            className="flex items-center gap-1 text-gray-600 hover:text-blue-600"
          >
            <GitBranch className="w-4 h-4 text-orange-600" />
            <span>{lcpName}</span>
          </button>
        </>
      )}

      {napName && (
        <>
          <ChevronRight className="w-4 h-4 text-gray-400" />
          <span className="flex items-center gap-1 font-medium text-gray-800">
            <Network className="w-4 h-4 text-cyan-600" />
            <span>{napName}</span>
          </span>
        </>
      )}
    </nav>
  );
}

// ============================================
// OLT Panel Component
// ============================================

function OLTPanel({
  olts,
  selectedId,
  onSelect,
  onAdd,
  stats,
}: {
  olts: OLT[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onAdd: () => void;
  stats?: { lcpCount: number; napCount: number; customerCount: number; utilization: number } | null;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
      <div className="px-4 py-3 bg-teal-50 border-b border-teal-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-teal-600" />
            <h3 className="font-semibold text-gray-800">OLT</h3>
          </div>
          <span className="text-sm text-gray-500">{olts.length} total</span>
        </div>
      </div>

      <div className="divide-y max-h-80 overflow-y-auto">
        {olts.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            No OLTs yet. Add one to get started.
          </div>
        ) : (
          olts.map((olt) => (
            <button
              key={olt.id}
              onClick={() => onSelect(olt.id!)}
              className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                selectedId === olt.id ? "bg-teal-50 border-l-4 border-teal-600" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-800">{olt.name}</div>
                  {olt.model && (
                    <div className="text-xs text-gray-500">{olt.model}</div>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            </button>
          ))
        )}
      </div>

      {selectedId && stats && (
        <div className="px-4 py-2 bg-gray-50 border-t text-xs text-gray-600 grid grid-cols-2 gap-2">
          <div className="flex items-center gap-1">
            <GitBranch className="w-3 h-3" />
            {stats.lcpCount} LCPs
          </div>
          <div className="flex items-center gap-1">
            <Network className="w-3 h-3" />
            {stats.napCount} NAPs
          </div>
          <div className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {stats.customerCount} customers
          </div>
          <div className="flex items-center gap-1">
            <Activity className="w-3 h-3" />
            {stats.utilization}% util
          </div>
        </div>
      )}

      <div className="p-2 border-t">
        <button
          onClick={onAdd}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-teal-600 hover:bg-teal-50 rounded-lg"
        >
          <Plus className="w-4 h-4" />
          Add OLT
        </button>
      </div>
    </div>
  );
}

// ============================================
// LCP Panel Component
// ============================================

function LCPPanel({
  lcps,
  selectedId,
  onSelect,
  onAdd,
  stats,
  oltName,
}: {
  lcps: Enclosure[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onAdd: () => void;
  stats?: { napCount: number; customerCount: number; utilization: number } | null;
  oltName?: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
      <div className="px-4 py-3 bg-orange-50 border-b border-orange-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-orange-600" />
            <h3 className="font-semibold text-gray-800">LCP</h3>
          </div>
          <span className="text-sm text-gray-500">{lcps.length} total</span>
        </div>
        {oltName && (
          <div className="text-xs text-orange-600 mt-1">Under: {oltName}</div>
        )}
      </div>

      <div className="divide-y max-h-80 overflow-y-auto">
        {lcps.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            No LCPs under this OLT. Add one to continue.
          </div>
        ) : (
          lcps.map((lcp) => (
            <button
              key={lcp.id}
              onClick={() => onSelect(lcp.id!)}
              className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                selectedId === lcp.id ? "bg-orange-50 border-l-4 border-orange-600" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-800">{lcp.name}</div>
                  {lcp.address && (
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {lcp.address}
                    </div>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            </button>
          ))
        )}
      </div>

      {selectedId && stats && (
        <div className="px-4 py-2 bg-gray-50 border-t text-xs text-gray-600 grid grid-cols-2 gap-2">
          <div className="flex items-center gap-1">
            <Network className="w-3 h-3" />
            {stats.napCount} NAPs
          </div>
          <div className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {stats.customerCount} customers
          </div>
          <div className="flex items-center gap-1 col-span-2">
            <Activity className="w-3 h-3" />
            {stats.utilization}% utilization
          </div>
        </div>
      )}

      <div className="p-2 border-t">
        <button
          onClick={onAdd}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-orange-600 hover:bg-orange-50 rounded-lg"
        >
          <Plus className="w-4 h-4" />
          Add LCP
        </button>
      </div>
    </div>
  );
}

// ============================================
// NAP Panel Component
// ============================================

function NAPPanel({
  naps,
  selectedId,
  onSelect,
  onAdd,
  stats,
  lcpName,
}: {
  naps: Enclosure[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onAdd: () => void;
  stats?: { total: number; available: number; connected: number; reserved: number; faulty: number } | null;
  lcpName?: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
      <div className="px-4 py-3 bg-cyan-50 border-b border-cyan-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Network className="w-5 h-5 text-cyan-600" />
            <h3 className="font-semibold text-gray-800">NAP</h3>
          </div>
          <span className="text-sm text-gray-500">{naps.length} total</span>
        </div>
        {lcpName && (
          <div className="text-xs text-cyan-600 mt-1">Under: {lcpName}</div>
        )}
      </div>

      <div className="divide-y max-h-80 overflow-y-auto">
        {naps.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            No NAPs under this LCP. Add one to add customers.
          </div>
        ) : (
          naps.map((nap) => (
            <button
              key={nap.id}
              onClick={() => onSelect(nap.id!)}
              className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                selectedId === nap.id ? "bg-cyan-50 border-l-4 border-cyan-600" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-800">{nap.name}</div>
                  {nap.address && (
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {nap.address}
                    </div>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            </button>
          ))
        )}
      </div>

      {selectedId && stats && (
        <div className="px-4 py-2 bg-gray-50 border-t text-xs text-gray-600">
          <div className="flex justify-between">
            <span className="text-green-600">{stats.connected} connected</span>
            <span className="text-yellow-600">{stats.reserved} reserved</span>
            <span className="text-gray-500">{stats.available} available</span>
            {stats.faulty > 0 && <span className="text-red-600">{stats.faulty} faulty</span>}
          </div>
        </div>
      )}

      <div className="p-2 border-t">
        <button
          onClick={onAdd}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-cyan-600 hover:bg-cyan-50 rounded-lg"
        >
          <Plus className="w-4 h-4" />
          Add NAP
        </button>
      </div>
    </div>
  );
}

// ============================================
// NAP Ports Detail Component
// ============================================

function NAPPortsDetail({ nap, ports }: { nap: Enclosure; ports: Port[] }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Network className="w-5 h-5 text-cyan-600" />
          <h3 className="font-semibold text-gray-800">{nap.name} - Ports</h3>
        </div>
        <PortStatusSummary ports={ports} />
      </div>

      {ports.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No ports configured for this NAP.
        </div>
      ) : (
        <div className="space-y-2">
          {ports.map((port) => (
            <div
              key={port.id}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                port.status === "connected"
                  ? "bg-green-50 border-green-200"
                  : port.status === "reserved"
                  ? "bg-yellow-50 border-yellow-200"
                  : port.status === "faulty"
                  ? "bg-red-50 border-red-200"
                  : "bg-gray-50 border-gray-200"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-medium ${
                    port.status === "connected"
                      ? "bg-green-500"
                      : port.status === "reserved"
                      ? "bg-yellow-500"
                      : port.status === "faulty"
                      ? "bg-red-500"
                      : "bg-gray-400"
                  }`}
                >
                  {port.portNumber}
                </div>
                <div>
                  <div className="font-medium text-gray-800">
                    Port {port.portNumber}
                    {port.label && ` (${port.label})`}
                  </div>
                  <div className="text-xs text-gray-500 capitalize">{port.status}</div>
                </div>
              </div>

              {port.status === "connected" && port.customerName && (
                <div className="text-right">
                  <div className="font-medium text-gray-800">{port.customerName}</div>
                  {port.customerAddress && (
                    <div className="text-xs text-gray-500">{port.customerAddress}</div>
                  )}
                  {port.serviceId && (
                    <div className="text-xs text-blue-600">#{port.serviceId}</div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// Form Modals
// ============================================

function OLTFormModal({
  projectId,
  onClose,
  onCreated,
}: {
  projectId: number;
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  const [name, setName] = useState("");
  const [model, setModel] = useState("");
  const [totalPonPorts, setTotalPonPorts] = useState(16);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const id = await createOLT({
      projectId,
      name: name.trim(),
      model: model.trim() || undefined,
      totalPonPorts,
    });
    onCreated(id);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-gray-800">Add OLT</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              OLT Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., OLT-001"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Model
            </label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="e.g., Huawei MA5800"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Total PON Ports
            </label>
            <select
              value={totalPonPorts}
              onChange={(e) => setTotalPonPorts(Number(e.target.value))}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            >
              <option value={8}>8 ports</option>
              <option value={16}>16 ports</option>
              <option value={32}>32 ports</option>
              <option value={64}>64 ports</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
            >
              Create OLT
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function LCPFormModal({
  projectId,
  oltId,
  onClose,
  onCreated,
}: {
  projectId: number;
  oltId: number;
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const id = await createEnclosure({
      projectId,
      name: name.trim(),
      type: "lcp",
      parentType: "olt",
      parentId: oltId,
      address: address.trim() || undefined,
    });
    onCreated(id);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-gray-800">Add LCP</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              LCP Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., LCP-001"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address/Location
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g., Main St & Oak Ave"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
            >
              Create LCP
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NAPFormModal({
  projectId,
  lcpId,
  onClose,
  onCreated,
}: {
  projectId: number;
  lcpId: number;
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [portCount, setPortCount] = useState(8);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const id = await createEnclosure({
      projectId,
      name: name.trim(),
      type: "nap",
      parentType: "lcp",
      parentId: lcpId,
      address: address.trim() || undefined,
    });

    // Auto-create ports
    for (let i = 1; i <= portCount; i++) {
      await createPort({
        enclosureId: id,
        portNumber: i,
        type: "output",
        status: "available",
        connectorType: "SC",
      });
    }

    onCreated(id);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-gray-800">Add NAP</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              NAP Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., NAP-001"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address/Location
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g., 123 Oak Ave"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Number of Ports
            </label>
            <select
              value={portCount}
              onChange={(e) => setPortCount(Number(e.target.value))}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
            >
              <option value={4}>4 ports</option>
              <option value={8}>8 ports</option>
              <option value={12}>12 ports</option>
              <option value={16}>16 ports</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700"
            >
              Create NAP
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
