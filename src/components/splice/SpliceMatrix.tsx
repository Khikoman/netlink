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
import type { Splice, Cable, Tray, SpliceType } from "@/types";

export default function SpliceMatrix() {
  // State for cable selection
  const [cableAId, setCableAId] = useState<number | null>(null);
  const [cableBId, setCableBId] = useState<number | null>(null);
  const [selectedTrayId, setSelectedTrayId] = useState<number | null>(null);

  // Quick mode state (for creating new cables/trays inline)
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
  const [technicianName, setTechnicianName] = useState("");

  // View state
  const [viewTube, setViewTube] = useState<number | null>(null);

  // Splice editor state
  const [editingSplice, setEditingSplice] = useState<{
    fiberA: number;
    fiberB: number;
    existing?: Splice;
  } | null>(null);

  // Get data from database
  const cables = useLiveQuery(() => db.cables.toArray(), []);
  const trays = useLiveQuery(() => db.trays.toArray(), []);
  const splices = useLiveQuery(
    () =>
      selectedTrayId
        ? db.splices.where("trayId").equals(selectedTrayId).toArray()
        : [],
    [selectedTrayId]
  );

  // Get splice for specific fiber pair
  const getSpliceForFibers = (fiberA: number, fiberB: number): Splice | undefined => {
    return splices?.find((s) => s.fiberA === fiberA && s.fiberB === fiberB);
  };

  // Create quick splice
  const handleCellClick = async (fiberA: number, fiberB: number) => {
    const existing = getSpliceForFibers(fiberA, fiberB);
    setEditingSplice({ fiberA, fiberB, existing });
  };

  // Save splice from editor
  const handleSaveSplice = async (spliceData: Partial<Splice>) => {
    if (!editingSplice) return;

    const colorInfoA = getFiberInfo(editingSplice.fiberA, cableACount);
    const colorInfoB = getFiberInfo(editingSplice.fiberB, cableBCount);

    if (!colorInfoA || !colorInfoB) return;

    if (editingSplice.existing?.id) {
      // Update existing
      await db.splices.update(editingSplice.existing.id, {
        ...spliceData,
        timestamp: new Date(),
      });
    } else {
      // Create new
      await createSplice({
        trayId: selectedTrayId || 0,
        cableAId: cableAId || 0,
        cableAName: cableAName,
        fiberA: editingSplice.fiberA,
        tubeAColor: colorInfoA.tubeColor.name,
        fiberAColor: colorInfoA.fiberColor.name,
        cableBId: cableBId || 0,
        cableBName: cableBName,
        fiberB: editingSplice.fiberB,
        tubeBColor: colorInfoB.tubeColor.name,
        fiberBColor: colorInfoB.fiberColor.name,
        spliceType: (spliceData.spliceType as SpliceType) || "fusion",
        loss: spliceData.loss,
        technicianName: spliceData.technicianName || "",
        timestamp: new Date(),
        status: spliceData.loss ? "completed" : "pending",
        notes: spliceData.notes,
      });
    }

    setEditingSplice(null);
  };

  // Batch create splices
  const handleBatchCreate = async () => {
    if (!technicianName.trim()) {
      alert("Please enter technician name");
      return;
    }

    const batchSplices = generateBatchSplices({
      trayId: selectedTrayId || 0,
      cableAId: cableAId || 0,
      cableAName,
      cableACount,
      cableBId: cableBId || 0,
      cableBName,
      cableBCount,
      startFiberA: batchStartA,
      startFiberB: batchStartB,
      count: batchCount,
      spliceType: batchType,
      technicianName,
    });

    for (const splice of batchSplices) {
      // Check if splice already exists
      const existing = getSpliceForFibers(splice.fiberA, splice.fiberB);
      if (!existing) {
        await createSplice(splice);
      }
    }

    setShowBatchModal(false);
  };

  // Calculate tube ranges for viewing
  const tubesA = Math.ceil(cableACount / 12);
  const tubesB = Math.ceil(cableBCount / 12);

  // Get fibers to display based on tube selection
  const getFibersForTube = (tubeNum: number, cableCount: number) => {
    const start = (tubeNum - 1) * 12 + 1;
    const end = Math.min(tubeNum * 12, cableCount);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  // Stats
  const stats = splices ? calculateSpliceStats(splices) : null;

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Splice Matrix</h2>

        {/* Cable Configuration */}
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

      {/* Stats Card */}
      {stats && stats.total > 0 && (
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
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Select Tube View</h3>
        <div className="grid grid-cols-2 gap-4">
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
                    className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-medium transition-all ${
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
      </div>

      {/* Matrix View */}
      {viewTube && (
        <div className="bg-white rounded-2xl shadow-lg p-6 overflow-x-auto">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Tube {viewTube} - Fibers {(viewTube - 1) * 12 + 1} to {Math.min(viewTube * 12, cableACount)}
          </h3>

          <div className="min-w-max">
            {/* Header row - Cable B fibers */}
            <div className="flex gap-1 mb-1">
              <div className="w-16 h-10"></div> {/* Corner cell */}
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
                  {/* Row header - Cable A fiber */}
                  <div
                    className="w-16 h-12 flex items-center justify-center text-xs font-medium rounded"
                    style={{
                      backgroundColor: colorInfoA?.fiberColor.hex,
                      color: colorInfoA?.fiberColor.textColor,
                    }}
                  >
                    {fiberA}
                  </div>

                  {/* Matrix cells */}
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
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full">
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Splice Type</label>
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
                  onChange={(e) => setTechnicianName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800"
                  placeholder="Your name"
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
  onSave: (data: Partial<Splice>) => void;
  onClose: () => void;
  onDelete: () => void;
}) {
  const [spliceType, setSpliceType] = useState<SpliceType>(existing?.spliceType || "fusion");
  const [loss, setLoss] = useState(existing?.loss?.toString() || "");
  const [technicianName, setTechnicianName] = useState(existing?.technicianName || "");
  const [notes, setNotes] = useState(existing?.notes || "");

  const colorInfoA = getFiberInfo(fiberA, cableACount);
  const colorInfoB = getFiberInfo(fiberB, cableBCount);

  const lossNum = loss ? parseFloat(loss) : undefined;
  const lossStatus = lossNum !== undefined ? validateSpliceLoss(lossNum, spliceType) : null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-lg w-full">
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Splice Type</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Loss (dB)</label>
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
              value={technicianName}
              onChange={(e) => setTechnicianName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800"
              placeholder="Your name"
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
                technicianName,
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
