"use client";

import { useState, useEffect } from "react";
import { CABLE_CONFIGS, getFiberInfo, FIBER_COLORS } from "@/lib/fiberColors";
import {
  generateBatchSplices,
  validateSpliceLoss,
  getLossStatusColor,
  calculateSpliceStats,
} from "@/lib/spliceUtils";
import { db, createSplice } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { getTechnicianName, setTechnicianName, getDefaultSpliceType, getDefaultCableCount } from "@/lib/preferences";
import { HelpTip } from "@/components/ui/HelpTooltip";
import { AlertCircle, ChevronDown, Layers, FolderOpen, Box } from "lucide-react";
import type { Splice, SpliceType, Project, Enclosure, Tray } from "@/types";

export default function SpliceMatrix() {
  // ============ PROJECT/ENCLOSURE/TRAY SELECTORS ============
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedEnclosureId, setSelectedEnclosureId] = useState<number | null>(null);
  const [selectedTrayId, setSelectedTrayId] = useState<number | null>(null);

  // Get data from database with cascading filters
  const projects = useLiveQuery(() => db.projects.orderBy("createdAt").reverse().toArray(), []);
  const enclosures = useLiveQuery(
    () => selectedProjectId ? db.enclosures.where("projectId").equals(selectedProjectId).toArray() : [],
    [selectedProjectId]
  );
  const trays = useLiveQuery(
    () => selectedEnclosureId ? db.trays.where("enclosureId").equals(selectedEnclosureId).toArray() : [],
    [selectedEnclosureId]
  );
  const splices = useLiveQuery(
    () => selectedTrayId ? db.splices.where("trayId").equals(selectedTrayId).toArray() : [],
    [selectedTrayId]
  );

  // Get selected entities for display
  const selectedProject = projects?.find(p => p.id === selectedProjectId);
  const selectedEnclosure = enclosures?.find(e => e.id === selectedEnclosureId);
  const selectedTray = trays?.find(t => t.id === selectedTrayId);

  // Cable state
  const [cableAName, setCableAName] = useState("Cable A");
  const [cableACount, setCableACount] = useState(144);
  const [cableBName, setCableBName] = useState("Cable B");
  const [cableBCount, setCableBCount] = useState(144);

  // Batch splice state
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchStartA, setBatchStartA] = useState(1);
  const [batchStartB, setBatchStartB] = useState(1);
  const [batchCount, setBatchCount] = useState(12);
  const [batchType, setBatchType] = useState<SpliceType>("fusion");
  const [technicianName, setTechName] = useState("");

  // View state
  const [viewTube, setViewTube] = useState<number | null>(null);

  // Splice editor state
  const [editingSplice, setEditingSplice] = useState<{
    fiberA: number;
    fiberB: number;
    existing?: Splice;
  } | null>(null);

  // Load preferences on mount
  useEffect(() => {
    setTechName(getTechnicianName());
    setBatchType(getDefaultSpliceType());
    const defaultCount = getDefaultCableCount();
    setCableACount(defaultCount);
    setCableBCount(defaultCount);
  }, []);

  // Clear child selections when parent changes
  useEffect(() => {
    setSelectedEnclosureId(null);
    setSelectedTrayId(null);
  }, [selectedProjectId]);

  useEffect(() => {
    setSelectedTrayId(null);
  }, [selectedEnclosureId]);

  // Save technician name on change
  const handleTechnicianChange = (name: string) => {
    setTechName(name);
    setTechnicianName(name);
  };

  // Get splice for specific fiber pair
  const getSpliceForFibers = (fiberA: number, fiberB: number): Splice | undefined => {
    return splices?.find((s) => s.fiberA === fiberA && s.fiberB === fiberB);
  };

  // Create quick splice
  const handleCellClick = async (fiberA: number, fiberB: number) => {
    if (!selectedTrayId) {
      alert("Please select a tray first");
      return;
    }
    const existing = getSpliceForFibers(fiberA, fiberB);
    setEditingSplice({ fiberA, fiberB, existing });
  };

  // Save splice from editor
  const handleSaveSplice = async (spliceData: Partial<Splice>) => {
    if (!editingSplice || !selectedTrayId) return;

    const colorInfoA = getFiberInfo(editingSplice.fiberA, cableACount);
    const colorInfoB = getFiberInfo(editingSplice.fiberB, cableBCount);

    if (!colorInfoA || !colorInfoB) return;

    if (editingSplice.existing?.id) {
      await db.splices.update(editingSplice.existing.id, {
        ...spliceData,
        timestamp: new Date(),
      });
    } else {
      await createSplice({
        trayId: selectedTrayId,
        cableAId: 0,
        cableAName: cableAName,
        fiberA: editingSplice.fiberA,
        tubeAColor: colorInfoA.tubeColor.name,
        fiberAColor: colorInfoA.fiberColor.name,
        cableBId: 0,
        cableBName: cableBName,
        fiberB: editingSplice.fiberB,
        tubeBColor: colorInfoB.tubeColor.name,
        fiberBColor: colorInfoB.fiberColor.name,
        spliceType: (spliceData.spliceType as SpliceType) || "fusion",
        loss: spliceData.loss,
        technicianName: spliceData.technicianName || technicianName,
        timestamp: new Date(),
        status: spliceData.loss ? "completed" : "pending",
        notes: spliceData.notes,
      });
    }

    setEditingSplice(null);
  };

  // Batch create splices
  const handleBatchCreate = async () => {
    if (!selectedTrayId) {
      alert("Please select a tray first");
      return;
    }
    if (!technicianName.trim()) {
      alert("Please enter technician name");
      return;
    }

    const batchSplices = generateBatchSplices({
      trayId: selectedTrayId,
      cableAId: 0,
      cableAName,
      cableACount,
      cableBId: 0,
      cableBName,
      cableBCount,
      startFiberA: batchStartA,
      startFiberB: batchStartB,
      count: batchCount,
      spliceType: batchType,
      technicianName,
    });

    for (const splice of batchSplices) {
      const existing = getSpliceForFibers(splice.fiberA, splice.fiberB);
      if (!existing) {
        await createSplice(splice);
      }
    }

    setShowBatchModal(false);
  };

  // Calculate tube ranges for viewing
  const tubesA = Math.ceil(cableACount / 12);

  // Get fibers to display based on tube selection
  const getFibersForTube = (tubeNum: number, cableCount: number) => {
    const start = (tubeNum - 1) * 12 + 1;
    const end = Math.min(tubeNum * 12, cableCount);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  // Stats
  const stats = splices ? calculateSpliceStats(splices) : null;
  const trayCapacity = selectedTray?.capacity || 24;
  const spliceCount = splices?.length || 0;

  // Check if setup is complete
  const setupComplete = selectedProjectId && selectedEnclosureId && selectedTrayId;

  return (
    <div className="space-y-6">
      {/* ============ PROJECT/ENCLOSURE/TRAY SELECTION ============ */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Layers className="w-5 h-5 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-800">Select Location</h2>
          <HelpTip term="Tray" />
        </div>

        {(!projects || projects.length === 0) && (
          <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl text-center">
            <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
            <h3 className="font-semibold text-gray-800 mb-2">No Projects Yet</h3>
            <p className="text-gray-600 text-sm mb-4">
              Create a project first to start documenting splices. Projects help organize your work by location.
            </p>
            <p className="text-sm text-gray-500">
              Go to <strong>Dashboard</strong> to create your first project.
            </p>
          </div>
        )}

        {projects && projects.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Project Selector */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <FolderOpen className="w-4 h-4" />
                Project
              </label>
              <div className="relative">
                <select
                  value={selectedProjectId || ""}
                  onChange={(e) => setSelectedProjectId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-800 appearance-none cursor-pointer focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select project...</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
              </div>
              {selectedProject && (
                <p className="mt-1 text-xs text-gray-500">{selectedProject.location}</p>
              )}
            </div>

            {/* Enclosure Selector */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Box className="w-4 h-4" />
                Enclosure
                <HelpTip term="Enclosure" />
              </label>
              <div className="relative">
                <select
                  value={selectedEnclosureId || ""}
                  onChange={(e) => setSelectedEnclosureId(e.target.value ? Number(e.target.value) : null)}
                  disabled={!selectedProjectId}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-800 appearance-none cursor-pointer focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-400"
                >
                  <option value="">{selectedProjectId ? "Select enclosure..." : "Select project first"}</option>
                  {enclosures?.map((enc) => (
                    <option key={enc.id} value={enc.id}>
                      {enc.name} ({enc.type})
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
              </div>
              {enclosures?.length === 0 && selectedProjectId && (
                <p className="mt-1 text-xs text-amber-600">No enclosures in this project</p>
              )}
            </div>

            {/* Tray Selector */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Layers className="w-4 h-4" />
                Splice Tray
              </label>
              <div className="relative">
                <select
                  value={selectedTrayId || ""}
                  onChange={(e) => setSelectedTrayId(e.target.value ? Number(e.target.value) : null)}
                  disabled={!selectedEnclosureId}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-800 appearance-none cursor-pointer focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-400"
                >
                  <option value="">{selectedEnclosureId ? "Select tray..." : "Select enclosure first"}</option>
                  {trays?.sort((a, b) => a.number - b.number).map((tray) => (
                    <option key={tray.id} value={tray.id}>
                      Tray {tray.number} (Capacity: {tray.capacity})
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
              </div>
              {trays?.length === 0 && selectedEnclosureId && (
                <p className="mt-1 text-xs text-amber-600">No trays in this enclosure</p>
              )}
            </div>
          </div>
        )}

        {/* Capacity Display */}
        {setupComplete && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-gray-600">Selected: </span>
                <span className="font-medium text-gray-800">
                  {selectedProject?.name} → {selectedEnclosure?.name} → Tray {selectedTray?.number}
                </span>
              </div>
              <div className="text-sm">
                <span className="text-gray-600">Capacity: </span>
                <span className={`font-bold ${spliceCount >= trayCapacity ? "text-red-600" : "text-green-600"}`}>
                  {spliceCount}/{trayCapacity}
                </span>
                <span className="text-gray-500"> splices</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============ CABLE CONFIGURATION ============ */}
      {setupComplete && (
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Cable Configuration</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Cable A */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">Cable A (Source)</label>
              <input
                type="text"
                value={cableAName}
                onChange={(e) => setCableAName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800"
                placeholder="Cable name"
              />
              <div className="flex flex-wrap gap-2">
                {CABLE_CONFIGS.map((config) => (
                  <button
                    key={config.count}
                    onClick={() => setCableACount(config.count)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      cableACount === config.count
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {config.count}F
                  </button>
                ))}
              </div>
            </div>

            {/* Cable B */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">Cable B (Destination)</label>
              <input
                type="text"
                value={cableBName}
                onChange={(e) => setCableBName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800"
                placeholder="Cable name"
              />
              <div className="flex flex-wrap gap-2">
                {CABLE_CONFIGS.map((config) => (
                  <button
                    key={config.count}
                    onClick={() => setCableBCount(config.count)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      cableBCount === config.count
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {config.count}F
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowBatchModal(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
            >
              Batch Create Splices
            </button>
          </div>
        </div>
      )}

      {/* Stats Card */}
      {setupComplete && stats && stats.total > 0 && (
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Splice Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-800">{stats.total}</div>
              <div className="text-sm text-gray-500">Total</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
              <div className="text-sm text-gray-500">Completed</div>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
              <div className="text-sm text-gray-500">Pending</div>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {stats.avgLoss > 0 ? stats.avgLoss.toFixed(2) : "-"}
              </div>
              <div className="text-sm text-gray-500">Avg Loss (dB)</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {stats.passRate.toFixed(0)}%
              </div>
              <div className="text-sm text-gray-500">Pass Rate</div>
            </div>
          </div>
        </div>
      )}

      {/* Tube Selection */}
      {setupComplete && (
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Select Tube View
            <HelpTip term="Buffer Tube" />
          </h3>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">
              {cableAName} Tube
            </label>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: tubesA }, (_, i) => i + 1).map((tube) => {
                const tubeColor = FIBER_COLORS[(tube - 1) % 12];
                return (
                  <button
                    key={tube}
                    onClick={() => setViewTube(tube)}
                    className={`w-12 h-12 rounded-lg flex items-center justify-center text-sm font-medium transition-all ${
                      viewTube === tube ? "ring-2 ring-blue-500 ring-offset-2" : ""
                    }`}
                    style={{
                      backgroundColor: tubeColor.hex,
                      color: tubeColor.textColor,
                    }}
                  >
                    {tube}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Matrix View */}
      {setupComplete && viewTube && (
        <div className="bg-white rounded-2xl shadow-lg p-6 overflow-x-auto">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Tube {viewTube} - Fibers {(viewTube - 1) * 12 + 1} to {Math.min(viewTube * 12, cableACount)}
          </h3>

          <div className="min-w-max">
            {/* Header row - Cable B fibers */}
            <div className="flex gap-1 mb-1">
              <div className="w-16 h-10"></div>
              {getFibersForTube(viewTube, cableBCount).map((fiberB) => {
                const colorInfo = getFiberInfo(fiberB, cableBCount);
                return (
                  <div
                    key={fiberB}
                    className="w-12 h-10 flex items-center justify-center text-xs font-medium rounded"
                    style={{
                      backgroundColor: colorInfo?.fiberColor.hex,
                      color: colorInfo?.fiberColor.textColor,
                    }}
                  >
                    {fiberB}
                  </div>
                );
              })}
            </div>

            {/* Matrix rows */}
            {getFibersForTube(viewTube, cableACount).map((fiberA) => {
              const colorInfoA = getFiberInfo(fiberA, cableACount);
              return (
                <div key={fiberA} className="flex gap-1 mb-1">
                  <div
                    className="w-16 h-12 flex items-center justify-center text-xs font-medium rounded"
                    style={{
                      backgroundColor: colorInfoA?.fiberColor.hex,
                      color: colorInfoA?.fiberColor.textColor,
                    }}
                  >
                    {fiberA}
                  </div>

                  {getFibersForTube(viewTube, cableBCount).map((fiberB) => {
                    const splice = getSpliceForFibers(fiberA, fiberB);
                    const lossStatus = splice?.loss !== undefined
                      ? validateSpliceLoss(splice.loss, splice.spliceType)
                      : null;
                    const lossColor = getLossStatusColor(lossStatus?.status);

                    return (
                      <button
                        key={`${fiberA}-${fiberB}`}
                        onClick={() => handleCellClick(fiberA, fiberB)}
                        className={`w-12 h-12 rounded border-2 flex flex-col items-center justify-center text-xs transition-all hover:scale-105 ${
                          splice
                            ? `${lossColor.bg} ${lossColor.text} border-gray-300`
                            : "bg-gray-50 border-gray-200 hover:border-blue-400"
                        }`}
                      >
                        {splice ? (
                          <>
                            <span className="font-medium">
                              {splice.loss !== undefined ? splice.loss.toFixed(2) : "?"}
                            </span>
                            <span className="text-[10px] opacity-75">dB</span>
                          </>
                        ) : (
                          <span className="text-gray-400">+</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-100 border border-green-300"></div>
              <span className="text-gray-600">Good (&le;0.1 dB)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-blue-100 border border-blue-300"></div>
              <span className="text-gray-600">Acceptable (&le;0.15 dB)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-yellow-100 border border-yellow-300"></div>
              <span className="text-gray-600">High (&le;0.3 dB)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-red-100 border border-red-300"></div>
              <span className="text-gray-600">Failed (&gt;0.3 dB)</span>
            </div>
          </div>
        </div>
      )}

      {/* Batch Create Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Batch Create Splices</h3>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Fiber A
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={cableACount}
                    value={batchStartA}
                    onChange={(e) => setBatchStartA(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Fiber B
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={cableBCount}
                    value={batchStartB}
                    onChange={(e) => setBatchStartB(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Number of Splices
                </label>
                <input
                  type="number"
                  min={1}
                  max={Math.min(cableACount, cableBCount)}
                  value={batchCount}
                  onChange={(e) => setBatchCount(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800"
                />
              </div>

              <div>
                <label className="flex items-center gap-1 text-sm font-medium text-gray-700 mb-1">
                  Splice Type
                  <HelpTip term="Fusion Splice" />
                </label>
                <select
                  value={batchType}
                  onChange={(e) => setBatchType(e.target.value as SpliceType)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800"
                >
                  <option value="fusion">Fusion</option>
                  <option value="mechanical">Mechanical</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Technician Name
                </label>
                <input
                  type="text"
                  value={technicianName}
                  onChange={(e) => handleTechnicianChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800"
                  placeholder="Your name (saved for future use)"
                />
              </div>

              <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
                This will create {batchCount} sequential 1-to-1 splices:
                <br />
                Fiber {batchStartA} → Fiber {batchStartB}
                <br />
                Fiber {batchStartA + 1} → Fiber {batchStartB + 1}
                <br />
                ... up to Fiber {batchStartA + batchCount - 1} → Fiber {batchStartB + batchCount - 1}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowBatchModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBatchCreate}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Create Splices
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Splice Editor Modal */}
      {editingSplice && (
        <SpliceEditorModal
          fiberA={editingSplice.fiberA}
          fiberB={editingSplice.fiberB}
          cableAName={cableAName}
          cableBName={cableBName}
          cableACount={cableACount}
          cableBCount={cableBCount}
          existing={editingSplice.existing}
          defaultTechnicianName={technicianName}
          onSave={handleSaveSplice}
          onClose={() => setEditingSplice(null)}
          onDelete={async () => {
            if (editingSplice.existing?.id) {
              await db.splices.delete(editingSplice.existing.id);
            }
            setEditingSplice(null);
          }}
        />
      )}
    </div>
  );
}

// Splice Editor Modal Component
function SpliceEditorModal({
  fiberA,
  fiberB,
  cableAName,
  cableBName,
  cableACount,
  cableBCount,
  existing,
  defaultTechnicianName,
  onSave,
  onClose,
  onDelete,
}: {
  fiberA: number;
  fiberB: number;
  cableAName: string;
  cableBName: string;
  cableACount: number;
  cableBCount: number;
  existing?: Splice;
  defaultTechnicianName: string;
  onSave: (data: Partial<Splice>) => void;
  onClose: () => void;
  onDelete: () => void;
}) {
  const [spliceType, setSpliceType] = useState<SpliceType>(existing?.spliceType || getDefaultSpliceType());
  const [loss, setLoss] = useState(existing?.loss?.toString() || "");
  const [techName, setTechName] = useState(existing?.technicianName || defaultTechnicianName);
  const [notes, setNotes] = useState(existing?.notes || "");

  const colorInfoA = getFiberInfo(fiberA, cableACount);
  const colorInfoB = getFiberInfo(fiberB, cableBCount);

  const lossNum = loss ? parseFloat(loss) : undefined;
  const lossStatus = lossNum !== undefined ? validateSpliceLoss(lossNum, spliceType) : null;

  // Save technician name when changed
  const handleTechChange = (name: string) => {
    setTechName(name);
    setTechnicianName(name);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          {existing ? "Edit Splice" : "Create Splice"}
        </h3>

        {/* Fiber Info Display */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-gray-50 rounded-xl">
            <div className="text-sm text-gray-500 mb-2">{cableAName}</div>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full"
                style={{ backgroundColor: colorInfoA?.tubeColor.hex }}
              />
              <div
                className="w-10 h-10 rounded-full"
                style={{ backgroundColor: colorInfoA?.fiberColor.hex }}
              />
              <div>
                <div className="font-semibold text-gray-800">Fiber {fiberA}</div>
                <div className="text-xs text-gray-500">
                  {colorInfoA?.tubeColor.name}/{colorInfoA?.fiberColor.name}
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-gray-50 rounded-xl">
            <div className="text-sm text-gray-500 mb-2">{cableBName}</div>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full"
                style={{ backgroundColor: colorInfoB?.tubeColor.hex }}
              />
              <div
                className="w-10 h-10 rounded-full"
                style={{ backgroundColor: colorInfoB?.fiberColor.hex }}
              />
              <div>
                <div className="font-semibold text-gray-800">Fiber {fiberB}</div>
                <div className="text-xs text-gray-500">
                  {colorInfoB?.tubeColor.name}/{colorInfoB?.fiberColor.name}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Form Fields */}
        <div className="space-y-4">
          <div>
            <label className="flex items-center gap-1 text-sm font-medium text-gray-700 mb-1">
              Splice Type
              <HelpTip term="Fusion Splice" />
            </label>
            <select
              value={spliceType}
              onChange={(e) => setSpliceType(e.target.value as SpliceType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800"
            >
              <option value="fusion">Fusion</option>
              <option value="mechanical">Mechanical</option>
            </select>
          </div>

          <div>
            <label className="flex items-center gap-1 text-sm font-medium text-gray-700 mb-1">
              Loss (dB)
              <HelpTip term="Acceptable Loss" />
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={loss}
              onChange={(e) => setLoss(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800"
              placeholder="e.g., 0.08"
            />
            {lossStatus && (
              <div
                className={`mt-1 text-sm ${
                  lossStatus.status === "good"
                    ? "text-green-600"
                    : lossStatus.status === "acceptable"
                    ? "text-blue-600"
                    : lossStatus.status === "high"
                    ? "text-yellow-600"
                    : "text-red-600"
                }`}
              >
                {lossStatus.message}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Technician Name</label>
            <input
              type="text"
              value={techName}
              onChange={(e) => handleTechChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800"
              placeholder="Your name (saved for future use)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800"
              rows={2}
              placeholder="Optional notes..."
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          {existing && (
            <button
              onClick={onDelete}
              className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
            >
              Delete
            </button>
          )}
          <div className="flex-1"></div>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() =>
              onSave({
                spliceType,
                loss: lossNum,
                technicianName: techName,
                notes,
              })
            }
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
