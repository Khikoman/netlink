"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, createOLT, updateOLT, createEnclosure, updateEnclosure, createPort, createTray, createSplitter } from "@/lib/db";
import LocationPicker from "@/components/map/LocationPicker";
import {
  useOLTs,
  useOLT,
  useClosuresByOLT,
  useLCPsByClosure,
  useLCPsByOLT,
  useNAPsByLCP,
  useOLTHierarchyStats,
  useClosureHierarchyStats,
  useLCPHierarchyStats,
  useNAPPortStats,
  useClosureContents,
  useODFsByOLT,
} from "@/lib/db/hooks";
import type { OLT, Enclosure, Port, Tray, Splitter } from "@/types";
import ODFManager from "@/components/odf/ODFManager";
import { useNetwork } from "@/contexts/NetworkContext";
import {
  Server,
  Link2,
  GitBranch,
  Network,
  ChevronRight,
  Plus,
  Home,
  Users,
  Activity,
  MapPin,
  X,
  Layers,
  Grid3X3,
  Pencil,
  Navigation,
} from "lucide-react";
import { PortStatusSummary } from "@/components/port/PortGrid";
import PortConnectionModal from "@/components/port/PortConnectionModal";

interface UnifiedHierarchyBrowserProps {
  projectId?: number; // Optional - will use context if not provided
}

interface HierarchyState {
  selectedOLTId: number | null;
  selectedClosureId: number | null;
  selectedLCPId: number | null;
  selectedNAPId: number | null;
}

export default function UnifiedHierarchyBrowser({ projectId: propProjectId }: UnifiedHierarchyBrowserProps) {
  // Use prop if provided, otherwise use context
  const { projectId: contextProjectId } = useNetwork();
  const projectId = propProjectId ?? contextProjectId ?? undefined;

  const [state, setState] = useState<HierarchyState>({
    selectedOLTId: null,
    selectedClosureId: null,
    selectedLCPId: null,
    selectedNAPId: null,
  });

  // Modal states
  const [showOLTForm, setShowOLTForm] = useState(false);
  const [showClosureForm, setShowClosureForm] = useState(false);
  const [showLCPForm, setShowLCPForm] = useState(false);
  const [showNAPForm, setShowNAPForm] = useState(false);

  // Edit states - which record is being edited
  const [editingOLT, setEditingOLT] = useState<OLT | null>(null);
  const [editingClosure, setEditingClosure] = useState<Enclosure | null>(null);
  const [editingLCP, setEditingLCP] = useState<Enclosure | null>(null);
  const [editingNAP, setEditingNAP] = useState<Enclosure | null>(null);

  // Port editor states
  const [selectedPort, setSelectedPort] = useState<Port | null>(null);
  const [selectedNAPForPort, setSelectedNAPForPort] = useState<Enclosure | null>(null);

  // ODF expanded state
  const [showODFs, setShowODFs] = useState(false);

  // Data
  const olts = useOLTs(projectId);
  const selectedOLT = useOLT(state.selectedOLTId ?? undefined);

  // ODFs under OLT
  const odfs = useODFsByOLT(state.selectedOLTId ?? undefined);

  // Closures under OLT
  const closures = useClosuresByOLT(state.selectedOLTId ?? undefined);
  const selectedClosure = useLiveQuery(
    () => (state.selectedClosureId ? db.enclosures.get(state.selectedClosureId) : undefined),
    [state.selectedClosureId]
  );

  // LCPs - support both new hierarchy (under closure) and legacy (directly under OLT)
  const lcpsUnderClosure = useLCPsByClosure(state.selectedClosureId ?? undefined);
  const legacyLCPs = useLCPsByOLT(state.selectedOLTId ?? undefined);
  // Combine LCPs: if closure selected, show under closure; otherwise show legacy
  const lcps = state.selectedClosureId ? lcpsUnderClosure : [];

  const selectedLCP = useLiveQuery(
    () => (state.selectedLCPId ? db.enclosures.get(state.selectedLCPId) : undefined),
    [state.selectedLCPId]
  );

  // NAPs under LCP
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

  // Closure contents (trays and splitters)
  const closureContents = useClosureContents(state.selectedClosureId ?? undefined);

  // Stats
  const oltStats = useOLTHierarchyStats(state.selectedOLTId ?? undefined);
  const closureStats = useClosureHierarchyStats(state.selectedClosureId ?? undefined);
  const lcpStats = useLCPHierarchyStats(state.selectedLCPId ?? undefined);
  const napStats = useNAPPortStats(state.selectedNAPId ?? undefined);

  // Check for legacy LCPs (directly under OLT without closure)
  const hasLegacyLCPs = (legacyLCPs?.length || 0) > 0;

  // Navigation handlers
  const selectOLT = (oltId: number) => {
    setState({ selectedOLTId: oltId, selectedClosureId: null, selectedLCPId: null, selectedNAPId: null });
  };

  const selectClosure = (closureId: number) => {
    setState((prev) => ({ ...prev, selectedClosureId: closureId, selectedLCPId: null, selectedNAPId: null }));
  };

  const selectLCP = (lcpId: number) => {
    setState((prev) => ({ ...prev, selectedLCPId: lcpId, selectedNAPId: null }));
  };

  const selectNAP = (napId: number) => {
    setState((prev) => ({ ...prev, selectedNAPId: napId }));
  };

  const resetToRoot = () => {
    setState({ selectedOLTId: null, selectedClosureId: null, selectedLCPId: null, selectedNAPId: null });
  };

  const resetToClosure = () => {
    setState((prev) => ({ ...prev, selectedClosureId: null, selectedLCPId: null, selectedNAPId: null }));
  };

  const resetToLCP = () => {
    setState((prev) => ({ ...prev, selectedLCPId: null, selectedNAPId: null }));
  };

  const resetToNAP = () => {
    setState((prev) => ({ ...prev, selectedNAPId: null }));
  };

  // Edit handlers
  const startEditOLT = (olt: OLT) => {
    setEditingOLT(olt);
    setShowOLTForm(true);
  };

  const startEditClosure = (closure: Enclosure) => {
    setEditingClosure(closure);
    setShowClosureForm(true);
  };

  const startEditLCP = (lcp: Enclosure) => {
    setEditingLCP(lcp);
    setShowLCPForm(true);
  };

  const startEditNAP = (nap: Enclosure) => {
    setEditingNAP(nap);
    setShowNAPForm(true);
  };

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <HierarchyBreadcrumb
        oltName={selectedOLT?.name}
        closureName={selectedClosure?.name}
        lcpName={selectedLCP?.name}
        napName={selectedNAP?.name}
        onNavigateHome={resetToRoot}
        onNavigateToOLT={resetToClosure}
        onNavigateToClosure={resetToLCP}
        onNavigateToLCP={resetToNAP}
      />

      {/* 4-Panel Layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* OLT Panel - Always visible */}
        <OLTPanel
          olts={olts || []}
          selectedId={state.selectedOLTId}
          onSelect={selectOLT}
          onEdit={startEditOLT}
          onAdd={() => { setEditingOLT(null); setShowOLTForm(true); }}
          stats={state.selectedOLTId ? oltStats : undefined}
        />

        {/* Closure Panel - Visible when OLT selected */}
        {state.selectedOLTId && (
          <ClosurePanel
            closures={closures || []}
            selectedId={state.selectedClosureId}
            onSelect={selectClosure}
            onEdit={startEditClosure}
            onAdd={() => { setEditingClosure(null); setShowClosureForm(true); }}
            stats={state.selectedClosureId ? closureStats : undefined}
            oltName={selectedOLT?.name}
            hasLegacyLCPs={hasLegacyLCPs}
          />
        )}

        {/* LCP Panel - Visible when Closure selected */}
        {state.selectedClosureId && (
          <LCPPanel
            lcps={lcps || []}
            selectedId={state.selectedLCPId}
            onSelect={selectLCP}
            onEdit={startEditLCP}
            onAdd={() => { setEditingLCP(null); setShowLCPForm(true); }}
            stats={state.selectedLCPId ? lcpStats : undefined}
            parentName={selectedClosure?.name}
          />
        )}

        {/* NAP Panel - Visible when LCP selected */}
        {state.selectedLCPId && (
          <NAPPanel
            naps={naps || []}
            selectedId={state.selectedNAPId}
            onSelect={selectNAP}
            onEdit={startEditNAP}
            onAdd={() => { setEditingNAP(null); setShowNAPForm(true); }}
            stats={state.selectedNAPId ? napStats : undefined}
            lcpName={selectedLCP?.name}
          />
        )}
      </div>

      {/* Closure Contents - When Closure selected */}
      {state.selectedClosureId && selectedClosure && closureContents && (
        <ClosureContentsDetail
          closure={selectedClosure}
          trays={closureContents.trays || []}
          splitters={closureContents.splitters || []}
        />
      )}

      {/* NAP Ports Detail - When NAP selected */}
      {state.selectedNAPId && selectedNAP && napPorts && (
        <NAPPortsDetail
          nap={selectedNAP}
          ports={napPorts.sort((a, b) => a.portNumber - b.portNumber)}
          onPortClick={(port) => {
            setSelectedPort(port);
            setSelectedNAPForPort(selectedNAP);
          }}
        />
      )}

      {/* ODF Management - When OLT selected */}
      {state.selectedOLTId && selectedOLT && (
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <button
            onClick={() => setShowODFs(!showODFs)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-teal-50 to-cyan-50 hover:from-teal-100 hover:to-cyan-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5 text-teal-600" />
              <span className="font-semibold text-gray-800">ODF Cabinets</span>
              <span className="text-sm text-gray-500">
                ({odfs?.length || 0} configured)
              </span>
            </div>
            <ChevronRight
              className={`w-5 h-5 text-gray-400 transition-transform ${
                showODFs ? "rotate-90" : ""
              }`}
            />
          </button>
          {showODFs && (
            <div className="p-4 border-t">
              <ODFManager
                projectId={projectId!}
                oltId={state.selectedOLTId}
                oltName={selectedOLT.name}
              />
            </div>
          )}
        </div>
      )}

      {/* Legacy LCPs Warning */}
      {hasLegacyLCPs && state.selectedOLTId && !state.selectedClosureId && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <GitBranch className="w-5 h-5 text-amber-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-amber-800">Legacy LCPs Detected</h4>
              <p className="text-sm text-amber-700 mt-1">
                This OLT has {legacyLCPs?.length} LCP(s) connected directly without a closure.
                Create a closure to properly organize your network hierarchy.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* OLT Form Modal */}
      {showOLTForm && (
        <OLTFormModal
          projectId={projectId!}
          editingOLT={editingOLT}
          onClose={() => { setShowOLTForm(false); setEditingOLT(null); }}
          onSaved={(id) => {
            setShowOLTForm(false);
            setEditingOLT(null);
            selectOLT(id);
          }}
        />
      )}

      {/* Closure Form Modal */}
      {showClosureForm && state.selectedOLTId && (
        <ClosureFormModal
          projectId={projectId!}
          oltId={state.selectedOLTId}
          editingClosure={editingClosure}
          onClose={() => { setShowClosureForm(false); setEditingClosure(null); }}
          onSaved={(id) => {
            setShowClosureForm(false);
            setEditingClosure(null);
            selectClosure(id);
          }}
        />
      )}

      {/* LCP Form Modal */}
      {showLCPForm && state.selectedClosureId && (
        <LCPFormModal
          projectId={projectId!}
          closureId={state.selectedClosureId}
          editingLCP={editingLCP}
          onClose={() => { setShowLCPForm(false); setEditingLCP(null); }}
          onSaved={(id) => {
            setShowLCPForm(false);
            setEditingLCP(null);
            selectLCP(id);
          }}
        />
      )}

      {/* NAP Form Modal */}
      {showNAPForm && state.selectedLCPId && (
        <NAPFormModal
          projectId={projectId!}
          lcpId={state.selectedLCPId}
          editingNAP={editingNAP}
          onClose={() => { setShowNAPForm(false); setEditingNAP(null); }}
          onSaved={(id) => {
            setShowNAPForm(false);
            setEditingNAP(null);
            selectNAP(id);
          }}
        />
      )}

      {/* Port Connection Modal - Edit NAP port details */}
      {selectedPort && selectedNAPForPort && (
        <PortConnectionModal
          port={selectedPort}
          projectId={projectId!}
          isNAP={true}
          onClose={() => {
            setSelectedPort(null);
            setSelectedNAPForPort(null);
          }}
          onSave={() => {
            setSelectedPort(null);
            setSelectedNAPForPort(null);
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
  closureName,
  lcpName,
  napName,
  onNavigateHome,
  onNavigateToOLT,
  onNavigateToClosure,
  onNavigateToLCP,
}: {
  oltName?: string;
  closureName?: string;
  lcpName?: string;
  napName?: string;
  onNavigateHome: () => void;
  onNavigateToOLT: () => void;
  onNavigateToClosure: () => void;
  onNavigateToLCP: () => void;
}) {
  return (
    <nav className="flex items-center gap-2 text-sm bg-white rounded-lg px-4 py-2 shadow-sm overflow-x-auto">
      <button
        onClick={onNavigateHome}
        className="flex items-center gap-1 text-gray-600 hover:text-blue-600 whitespace-nowrap"
      >
        <Home className="w-4 h-4" />
        <span>Network</span>
      </button>

      {oltName && (
        <>
          <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <button
            onClick={onNavigateToOLT}
            className="flex items-center gap-1 text-gray-600 hover:text-blue-600 whitespace-nowrap"
          >
            <Server className="w-4 h-4 text-teal-600" />
            <span>{oltName}</span>
          </button>
        </>
      )}

      {closureName && (
        <>
          <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <button
            onClick={onNavigateToClosure}
            className="flex items-center gap-1 text-gray-600 hover:text-blue-600 whitespace-nowrap"
          >
            <Link2 className="w-4 h-4 text-purple-600" />
            <span>{closureName}</span>
          </button>
        </>
      )}

      {lcpName && (
        <>
          <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <button
            onClick={onNavigateToLCP}
            className="flex items-center gap-1 text-gray-600 hover:text-blue-600 whitespace-nowrap"
          >
            <GitBranch className="w-4 h-4 text-orange-600" />
            <span>{lcpName}</span>
          </button>
        </>
      )}

      {napName && (
        <>
          <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <span className="flex items-center gap-1 font-medium text-gray-800 whitespace-nowrap">
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
  onEdit,
  onAdd,
  stats,
}: {
  olts: OLT[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onEdit: (olt: OLT) => void;
  onAdd: () => void;
  stats?: { closureCount?: number; lcpCount: number; napCount: number; customerCount: number; utilization: number } | null;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
      <div className="px-4 py-3 bg-teal-50 border-b border-teal-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-teal-600" />
            <h3 className="font-semibold text-gray-800">OLT</h3>
          </div>
          <span className="text-sm text-gray-500">{olts.length}</span>
        </div>
      </div>

      <div className="divide-y max-h-64 overflow-y-auto">
        {olts.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            No OLTs yet. Add one to start.
          </div>
        ) : (
          olts.map((olt) => (
            <div
              key={olt.id}
              onClick={() => onSelect(olt.id!)}
              onDoubleClick={() => onEdit(olt)}
              className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer ${
                selectedId === olt.id ? "bg-teal-50 border-l-4 border-teal-600" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-800">{olt.name}</div>
                  {olt.model && (
                    <div className="text-xs text-gray-500">{olt.model}</div>
                  )}
                  {olt.gpsLat && olt.gpsLng && (
                    <div className="text-xs text-green-600 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3" /> GPS
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); onEdit(olt); }}
                    className="p-1.5 hover:bg-gray-200 rounded transition-colors"
                    title="Edit OLT"
                  >
                    <Pencil className="w-3.5 h-3.5 text-gray-500" />
                  </button>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {selectedId && stats && (
        <div className="px-3 py-2 bg-gray-50 border-t text-xs text-gray-600 grid grid-cols-2 gap-1">
          {stats.closureCount !== undefined && stats.closureCount > 0 && (
            <div className="flex items-center gap-1">
              <Link2 className="w-3 h-3" />
              {stats.closureCount} Closures
            </div>
          )}
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
            {stats.customerCount}
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
// Closure Panel Component
// ============================================

function ClosurePanel({
  closures,
  selectedId,
  onSelect,
  onEdit,
  onAdd,
  stats,
  oltName,
  hasLegacyLCPs,
}: {
  closures: Enclosure[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onEdit: (closure: Enclosure) => void;
  onAdd: () => void;
  stats?: { lcpCount: number; napCount: number; customerCount: number; splitterCount: number; trayCount: number; utilization: number } | null;
  oltName?: string;
  hasLegacyLCPs?: boolean;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
      <div className="px-4 py-3 bg-purple-50 border-b border-purple-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-purple-600" />
            <h3 className="font-semibold text-gray-800">Closure</h3>
          </div>
          <span className="text-sm text-gray-500">{closures.length}</span>
        </div>
        {oltName && (
          <div className="text-xs text-purple-600 mt-1">Under: {oltName}</div>
        )}
      </div>

      <div className="divide-y max-h-64 overflow-y-auto">
        {closures.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            {hasLegacyLCPs
              ? "No closures yet. Create one to organize LCPs."
              : "No closures. Add one for splicing."}
          </div>
        ) : (
          closures.map((closure) => (
            <div
              key={closure.id}
              onClick={() => onSelect(closure.id!)}
              onDoubleClick={() => onEdit(closure)}
              className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer ${
                selectedId === closure.id ? "bg-purple-50 border-l-4 border-purple-600" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-800">{closure.name}</div>
                  {closure.address && (
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {closure.address}
                    </div>
                  )}
                  {closure.gpsLat && closure.gpsLng && (
                    <div className="text-xs text-green-600 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3" /> GPS
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); onEdit(closure); }}
                    className="p-1.5 hover:bg-gray-200 rounded transition-colors"
                    title="Edit Closure"
                  >
                    <Pencil className="w-3.5 h-3.5 text-gray-500" />
                  </button>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {selectedId && stats && (
        <div className="px-3 py-2 bg-gray-50 border-t text-xs text-gray-600 grid grid-cols-2 gap-1">
          <div className="flex items-center gap-1">
            <Layers className="w-3 h-3" />
            {stats.trayCount} Trays
          </div>
          <div className="flex items-center gap-1">
            <Grid3X3 className="w-3 h-3" />
            {stats.splitterCount} Splitters
          </div>
          <div className="flex items-center gap-1">
            <GitBranch className="w-3 h-3" />
            {stats.lcpCount} LCPs
          </div>
          <div className="flex items-center gap-1">
            <Network className="w-3 h-3" />
            {stats.napCount} NAPs
          </div>
        </div>
      )}

      <div className="p-2 border-t">
        <button
          onClick={onAdd}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-purple-600 hover:bg-purple-50 rounded-lg"
        >
          <Plus className="w-4 h-4" />
          Add Closure
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
  onEdit,
  onAdd,
  stats,
  parentName,
}: {
  lcps: Enclosure[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onEdit: (lcp: Enclosure) => void;
  onAdd: () => void;
  stats?: { napCount: number; customerCount: number; utilization: number } | null;
  parentName?: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
      <div className="px-4 py-3 bg-orange-50 border-b border-orange-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-orange-600" />
            <h3 className="font-semibold text-gray-800">LCP</h3>
          </div>
          <span className="text-sm text-gray-500">{lcps.length}</span>
        </div>
        {parentName && (
          <div className="text-xs text-orange-600 mt-1">Under: {parentName}</div>
        )}
      </div>

      <div className="divide-y max-h-64 overflow-y-auto">
        {lcps.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            No LCPs under this closure.
          </div>
        ) : (
          lcps.map((lcp) => (
            <div
              key={lcp.id}
              onClick={() => onSelect(lcp.id!)}
              onDoubleClick={() => onEdit(lcp)}
              className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer ${
                selectedId === lcp.id ? "bg-orange-50 border-l-4 border-orange-600" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-800">{lcp.name}</div>
                  {lcp.address && (
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {lcp.address}
                    </div>
                  )}
                  {lcp.gpsLat && lcp.gpsLng && (
                    <div className="text-xs text-green-600 flex items-center gap-1">
                      <Navigation className="w-3 h-3" />
                      GPS
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(lcp);
                    }}
                    className="p-1 hover:bg-orange-100 rounded"
                    title="Edit LCP"
                  >
                    <Pencil className="w-4 h-4 text-gray-500" />
                  </button>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {selectedId && stats && (
        <div className="px-3 py-2 bg-gray-50 border-t text-xs text-gray-600 grid grid-cols-2 gap-1">
          <div className="flex items-center gap-1">
            <Network className="w-3 h-3" />
            {stats.napCount} NAPs
          </div>
          <div className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {stats.customerCount}
          </div>
          <div className="flex items-center gap-1 col-span-2">
            <Activity className="w-3 h-3" />
            {stats.utilization}% util
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
  onEdit,
  onAdd,
  stats,
  lcpName,
}: {
  naps: Enclosure[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onEdit: (nap: Enclosure) => void;
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
          <span className="text-sm text-gray-500">{naps.length}</span>
        </div>
        {lcpName && (
          <div className="text-xs text-cyan-600 mt-1">Under: {lcpName}</div>
        )}
      </div>

      <div className="divide-y max-h-64 overflow-y-auto">
        {naps.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            No NAPs under this LCP.
          </div>
        ) : (
          naps.map((nap) => (
            <div
              key={nap.id}
              onClick={() => onSelect(nap.id!)}
              onDoubleClick={() => onEdit(nap)}
              className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer ${
                selectedId === nap.id ? "bg-cyan-50 border-l-4 border-cyan-600" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-800">{nap.name}</div>
                  {nap.address && (
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {nap.address}
                    </div>
                  )}
                  {nap.gpsLat && nap.gpsLng && (
                    <div className="text-xs text-green-600 flex items-center gap-1">
                      <Navigation className="w-3 h-3" />
                      GPS
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(nap);
                    }}
                    className="p-1 hover:bg-cyan-100 rounded"
                    title="Edit NAP"
                  >
                    <Pencil className="w-4 h-4 text-gray-500" />
                  </button>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {selectedId && stats && (
        <div className="px-3 py-2 bg-gray-50 border-t text-xs text-gray-600">
          <div className="flex justify-between">
            <span className="text-green-600">{stats.connected} conn</span>
            <span className="text-yellow-600">{stats.reserved} rsv</span>
            <span className="text-gray-500">{stats.available} avail</span>
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
// Closure Contents Detail Component
// ============================================

function ClosureContentsDetail({
  closure,
  trays,
  splitters,
}: {
  closure: Enclosure;
  trays: Tray[];
  splitters: Splitter[];
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border p-4">
      <div className="flex items-center gap-2 mb-4">
        <Link2 className="w-5 h-5 text-purple-600" />
        <h3 className="font-semibold text-gray-800">{closure.name} - Contents</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Splice Trays */}
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-gray-600" />
              <span className="font-medium text-gray-700">Splice Trays</span>
            </div>
            <span className="text-sm text-gray-500">{trays.length} total</span>
          </div>
          {trays.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-2">No trays yet</p>
          ) : (
            <div className="space-y-2">
              {trays.map((tray) => (
                <div
                  key={tray.id}
                  className="flex items-center justify-between bg-white rounded p-2 border"
                >
                  <span className="font-medium">Tray {tray.number}</span>
                  <span className="text-sm text-gray-500">{tray.capacity} capacity</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Splitters */}
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Grid3X3 className="w-4 h-4 text-gray-600" />
              <span className="font-medium text-gray-700">Splitters</span>
            </div>
            <span className="text-sm text-gray-500">{splitters.length} total</span>
          </div>
          {splitters.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-2">No splitters yet</p>
          ) : (
            <div className="space-y-2">
              {splitters.map((splitter) => (
                <div
                  key={splitter.id}
                  className="flex items-center justify-between bg-white rounded p-2 border"
                >
                  <span className="font-medium">{splitter.name}</span>
                  <span className="text-sm text-purple-600">{splitter.type}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// NAP Ports Detail Component
// ============================================

function NAPPortsDetail({
  nap,
  ports,
  onPortClick,
}: {
  nap: Enclosure;
  ports: Port[];
  onPortClick?: (port: Port) => void;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Network className="w-5 h-5 text-cyan-600" />
          <h3 className="font-semibold text-gray-800">{nap.name} - Ports</h3>
        </div>
        <PortStatusSummary ports={ports} />
      </div>

      <p className="text-xs text-gray-500 mb-3">
        Click a port to edit customer details
      </p>

      {ports.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No ports configured for this NAP.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
          {ports.map((port) => (
            <button
              key={port.id}
              onClick={() => onPortClick?.(port)}
              className={`p-2 rounded-lg border text-center transition-all cursor-pointer hover:ring-2 hover:ring-cyan-400 hover:shadow-md ${
                port.status === "connected"
                  ? "bg-green-50 border-green-200"
                  : port.status === "reserved"
                  ? "bg-yellow-50 border-yellow-200"
                  : port.status === "faulty"
                  ? "bg-red-50 border-red-200"
                  : "bg-gray-50 border-gray-200"
              }`}
            >
              <div
                className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center text-white font-medium text-sm ${
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
              {port.customerName && (
                <div className="text-xs mt-1 truncate text-gray-700" title={port.customerName}>
                  {port.customerName}
                </div>
              )}
            </button>
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
  editingOLT,
  onClose,
  onSaved,
}: {
  projectId: number;
  editingOLT: OLT | null;
  onClose: () => void;
  onSaved: (id: number) => void;
}) {
  const [name, setName] = useState(editingOLT?.name || "");
  const [model, setModel] = useState(editingOLT?.model || "");
  const [totalPonPorts, setTotalPonPorts] = useState(editingOLT?.totalPonPorts || 16);
  const [gpsLat, setGpsLat] = useState<number | undefined>(editingOLT?.gpsLat);
  const [gpsLng, setGpsLng] = useState<number | undefined>(editingOLT?.gpsLng);
  const [address, setAddress] = useState(editingOLT?.address || "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) {
      newErrors.name = "OLT name is required";
    }
    if (gpsLat !== undefined && (gpsLat < -90 || gpsLat > 90)) {
      newErrors.gps = "Latitude must be between -90 and 90";
    }
    if (gpsLng !== undefined && (gpsLng < -180 || gpsLng > 180)) {
      newErrors.gps = "Longitude must be between -180 and 180";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    try {
      if (editingOLT) {
        // Update existing OLT
        await updateOLT(editingOLT.id!, {
          name: name.trim(),
          model: model.trim() || undefined,
          totalPonPorts,
          gpsLat,
          gpsLng,
          address: address.trim() || undefined,
        });
        onSaved(editingOLT.id!);
      } else {
        // Create new OLT
        const id = await createOLT({
          projectId,
          name: name.trim(),
          model: model.trim() || undefined,
          totalPonPorts,
          gpsLat,
          gpsLng,
          address: address.trim() || undefined,
        });
        onSaved(id);
      }
    } catch (error) {
      console.error("Failed to save OLT:", error);
      setErrors({ submit: "Failed to save. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b sticky top-0 bg-white">
          <h3 className="font-semibold text-gray-800">
            {editingOLT ? "Edit OLT" : "Add OLT"}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" disabled={saving}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {errors.submit && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {errors.submit}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              OLT Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setErrors(prev => ({ ...prev, name: "" })); }}
              placeholder="e.g., OLT-001"
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 ${errors.name ? "border-red-500 bg-red-50" : ""}`}
              autoFocus
            />
            {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address / Location
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g., Main Office, Building A"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              GPS Location
            </label>
            <LocationPicker
              latitude={gpsLat}
              longitude={gpsLng}
              onLocationChange={(lat, lng) => {
                setGpsLat(lat);
                setGpsLng(lng);
              }}
              showMiniMap={true}
            />
          </div>
          {errors.gps && <p className="text-sm text-red-600">{errors.gps}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2"
            >
              {saving && (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              {saving ? "Saving..." : (editingOLT ? "Update OLT" : "Create OLT")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ClosureFormModal({
  projectId,
  oltId,
  editingClosure,
  onClose,
  onSaved,
}: {
  projectId: number;
  oltId: number;
  editingClosure: Enclosure | null;
  onClose: () => void;
  onSaved: (id: number) => void;
}) {
  const [name, setName] = useState(editingClosure?.name || "");
  const [address, setAddress] = useState(editingClosure?.address || "");
  const [gpsLat, setGpsLat] = useState<number | undefined>(editingClosure?.gpsLat);
  const [gpsLng, setGpsLng] = useState<number | undefined>(editingClosure?.gpsLng);
  const [trayCount, setTrayCount] = useState(2);
  const [trayCapacity, setTrayCapacity] = useState(12);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const isEditing = !!editingClosure;

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) {
      newErrors.name = "Closure name is required";
    }
    if (gpsLat !== undefined && (gpsLat < -90 || gpsLat > 90)) {
      newErrors.gps = "Latitude must be between -90 and 90";
    }
    if (gpsLng !== undefined && (gpsLng < -180 || gpsLng > 180)) {
      newErrors.gps = "Longitude must be between -180 and 180";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    try {
      if (isEditing) {
        // Update existing closure
        await updateEnclosure(editingClosure.id!, {
          name: name.trim(),
          address: address.trim() || undefined,
          gpsLat,
          gpsLng,
        });
        onSaved(editingClosure.id!);
      } else {
        // Create new closure
        const id = await createEnclosure({
          projectId,
          name: name.trim(),
          type: "splice-closure",
          parentType: "olt",
          parentId: oltId,
          address: address.trim() || undefined,
          gpsLat,
          gpsLng,
        });

        // Auto-create trays
        for (let i = 1; i <= trayCount; i++) {
          await createTray({
            enclosureId: id,
            number: i,
            capacity: trayCapacity,
          });
        }

        onSaved(id);
      }
    } catch (error) {
      console.error("Failed to save closure:", error);
      setErrors({ submit: "Failed to save. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b sticky top-0 bg-white">
          <h3 className="font-semibold text-gray-800">
            {isEditing ? "Edit Closure" : "Add Closure"}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {errors.submit && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {errors.submit}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Closure Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setErrors(prev => ({ ...prev, name: "" })); }}
              placeholder="e.g., CLO-001"
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${errors.name ? "border-red-500 bg-red-50" : ""}`}
              autoFocus
            />
            {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address/Location
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g., Pole #123, Main St"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          {/* GPS Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              GPS Location
            </label>
            <LocationPicker
              latitude={gpsLat}
              longitude={gpsLng}
              onLocationChange={(lat, lng) => {
                setGpsLat(lat);
                setGpsLng(lng);
                setErrors(prev => ({ ...prev, gps: "" }));
              }}
            />
            {errors.gps && <p className="mt-1 text-sm text-red-600">{errors.gps}</p>}
          </div>

          {!isEditing && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Splice Trays
                </label>
                <select
                  value={trayCount}
                  onChange={(e) => setTrayCount(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value={1}>1 tray</option>
                  <option value={2}>2 trays</option>
                  <option value={4}>4 trays</option>
                  <option value={6}>6 trays</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tray Capacity
                </label>
                <select
                  value={trayCapacity}
                  onChange={(e) => setTrayCapacity(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value={12}>12 splices</option>
                  <option value={24}>24 splices</option>
                </select>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
            >
              {saving && (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              {saving ? "Saving..." : (isEditing ? "Update Closure" : "Create Closure")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function LCPFormModal({
  projectId,
  closureId,
  editingLCP,
  onClose,
  onSaved,
}: {
  projectId: number;
  closureId: number;
  editingLCP: Enclosure | null;
  onClose: () => void;
  onSaved: (id: number) => void;
}) {
  const [name, setName] = useState(editingLCP?.name || "");
  const [address, setAddress] = useState(editingLCP?.address || "");
  const [gpsLat, setGpsLat] = useState<number | undefined>(editingLCP?.gpsLat);
  const [gpsLng, setGpsLng] = useState<number | undefined>(editingLCP?.gpsLng);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const isEditing = !!editingLCP;

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) {
      newErrors.name = "LCP name is required";
    }
    if (gpsLat !== undefined && (gpsLat < -90 || gpsLat > 90)) {
      newErrors.gps = "Latitude must be between -90 and 90";
    }
    if (gpsLng !== undefined && (gpsLng < -180 || gpsLng > 180)) {
      newErrors.gps = "Longitude must be between -180 and 180";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    try {
      if (isEditing) {
        // Update existing LCP
        await updateEnclosure(editingLCP.id!, {
          name: name.trim(),
          address: address.trim() || undefined,
          gpsLat,
          gpsLng,
        });
        onSaved(editingLCP.id!);
      } else {
        // Create new LCP
        const id = await createEnclosure({
          projectId,
          name: name.trim(),
          type: "lcp",
          parentType: "closure",
          parentId: closureId,
          address: address.trim() || undefined,
          gpsLat,
          gpsLng,
        });
        onSaved(id);
      }
    } catch (error) {
      console.error("Failed to save LCP:", error);
      setErrors({ submit: "Failed to save. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b sticky top-0 bg-white">
          <h3 className="font-semibold text-gray-800">
            {isEditing ? "Edit LCP" : "Add LCP"}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {errors.submit && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {errors.submit}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              LCP Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setErrors(prev => ({ ...prev, name: "" })); }}
              placeholder="e.g., LCP-001"
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${errors.name ? "border-red-500 bg-red-50" : ""}`}
              autoFocus
            />
            {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
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

          {/* GPS Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              GPS Location
            </label>
            <LocationPicker
              latitude={gpsLat}
              longitude={gpsLng}
              onLocationChange={(lat, lng) => {
                setGpsLat(lat);
                setGpsLng(lng);
                setErrors(prev => ({ ...prev, gps: "" }));
              }}
            />
            {errors.gps && <p className="mt-1 text-sm text-red-600">{errors.gps}</p>}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2"
            >
              {saving && (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              {saving ? "Saving..." : (isEditing ? "Update LCP" : "Create LCP")}
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
  editingNAP,
  onClose,
  onSaved,
}: {
  projectId: number;
  lcpId: number;
  editingNAP: Enclosure | null;
  onClose: () => void;
  onSaved: (id: number) => void;
}) {
  const [name, setName] = useState(editingNAP?.name || "");
  const [address, setAddress] = useState(editingNAP?.address || "");
  const [gpsLat, setGpsLat] = useState<number | undefined>(editingNAP?.gpsLat);
  const [gpsLng, setGpsLng] = useState<number | undefined>(editingNAP?.gpsLng);
  const [portCount, setPortCount] = useState(8);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const isEditing = !!editingNAP;

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) {
      newErrors.name = "NAP name is required";
    }
    if (gpsLat !== undefined && (gpsLat < -90 || gpsLat > 90)) {
      newErrors.gps = "Latitude must be between -90 and 90";
    }
    if (gpsLng !== undefined && (gpsLng < -180 || gpsLng > 180)) {
      newErrors.gps = "Longitude must be between -180 and 180";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    try {
      if (isEditing) {
        // Update existing NAP
        await updateEnclosure(editingNAP.id!, {
          name: name.trim(),
          address: address.trim() || undefined,
          gpsLat,
          gpsLng,
        });
        onSaved(editingNAP.id!);
      } else {
        // Create new NAP
        const id = await createEnclosure({
          projectId,
          name: name.trim(),
          type: "nap",
          parentType: "lcp",
          parentId: lcpId,
          address: address.trim() || undefined,
          gpsLat,
          gpsLng,
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

        onSaved(id);
      }
    } catch (error) {
      console.error("Failed to save NAP:", error);
      setErrors({ submit: "Failed to save. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b sticky top-0 bg-white">
          <h3 className="font-semibold text-gray-800">
            {isEditing ? "Edit NAP" : "Add NAP"}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {errors.submit && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {errors.submit}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              NAP Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setErrors(prev => ({ ...prev, name: "" })); }}
              placeholder="e.g., NAP-001"
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 ${errors.name ? "border-red-500 bg-red-50" : ""}`}
              autoFocus
            />
            {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
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

          {/* GPS Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              GPS Location
            </label>
            <LocationPicker
              latitude={gpsLat}
              longitude={gpsLng}
              onLocationChange={(lat, lng) => {
                setGpsLat(lat);
                setGpsLng(lng);
                setErrors(prev => ({ ...prev, gps: "" }));
              }}
            />
            {errors.gps && <p className="mt-1 text-sm text-red-600">{errors.gps}</p>}
          </div>

          {!isEditing && (
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
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 flex items-center gap-2"
            >
              {saving && (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              {saving ? "Saving..." : (isEditing ? "Update NAP" : "Create NAP")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
