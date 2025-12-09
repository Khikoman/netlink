"use client";

import { memo, useCallback, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, Edit3, Trash2, Layers } from "lucide-react";
import { db, createTray, deleteTray } from "@/lib/db";

interface TrayManagerProps {
  enclosureId: number;
  onOpenSpliceMatrix?: (trayId: number) => void;
}

function TrayManagerComponent({ enclosureId, onOpenSpliceMatrix }: TrayManagerProps) {
  const [isAddingTray, setIsAddingTray] = useState(false);

  // Fetch trays for this enclosure reactively
  const trays = useLiveQuery(
    () => db.trays.where("enclosureId").equals(enclosureId).toArray(),
    [enclosureId]
  );

  // Fetch splice counts for each tray
  const traySpliceCounts = useLiveQuery(async () => {
    if (!trays || trays.length === 0) return {};
    const counts: Record<number, number> = {};
    for (const tray of trays) {
      if (tray.id) {
        const splices = await db.splices.where("trayId").equals(tray.id).toArray();
        counts[tray.id] = splices.length;
      }
    }
    return counts;
  }, [trays]);

  // Add new tray
  const handleAddTray = useCallback(async () => {
    try {
      const nextNumber = trays ? Math.max(0, ...trays.map(t => t.number)) + 1 : 1;
      await createTray({
        enclosureId,
        number: nextNumber,
        capacity: 12, // Default capacity
      });
      setIsAddingTray(false);
    } catch (error) {
      console.error("Failed to create tray:", error);
    }
  }, [enclosureId, trays]);

  // Delete tray with confirmation
  const handleDeleteTray = useCallback(async (trayId: number, trayNumber: number) => {
    const spliceCount = traySpliceCounts?.[trayId] || 0;
    const message = spliceCount > 0
      ? `Delete Tray ${trayNumber}? This will also delete ${spliceCount} splice${spliceCount > 1 ? "s" : ""}.`
      : `Delete Tray ${trayNumber}?`;

    if (!window.confirm(message)) return;

    try {
      await deleteTray(trayId);
    } catch (error) {
      console.error("Failed to delete tray:", error);
    }
  }, [traySpliceCounts]);

  // Open splice matrix for editing
  const handleEditTray = useCallback((trayId: number) => {
    onOpenSpliceMatrix?.(trayId);
  }, [onOpenSpliceMatrix]);

  const sortedTrays = trays?.sort((a, b) => a.number - b.number) || [];

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-purple-500" />
          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
            Trays
          </span>
        </div>
        <button
          onClick={() => setIsAddingTray(true)}
          onDoubleClick={handleAddTray}
          className="px-2 py-1 text-xs bg-purple-100 text-purple-600 rounded hover:bg-purple-200 transition-colors flex items-center gap-1"
        >
          <Plus className="w-3 h-3" />
          <span>Add</span>
        </button>
      </div>

      {/* Tray List */}
      <div className="space-y-1.5">
        {sortedTrays.length === 0 ? (
          <div className="text-xs text-gray-400 text-center py-3 bg-gray-50 rounded border border-dashed border-gray-200">
            No trays configured
          </div>
        ) : (
          sortedTrays.map((tray) => {
            const spliceCount = traySpliceCounts?.[tray.id!] || 0;
            const capacity = tray.capacity || 12;
            const usagePercent = capacity > 0 ? (spliceCount / capacity) * 100 : 0;

            return (
              <div
                key={tray.id}
                className="bg-white rounded border border-gray-200 p-2 hover:border-purple-300 transition-all"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-700">
                      Tray {tray.number}
                    </span>
                    <span className="text-[10px] text-gray-500">
                      {spliceCount}/{capacity}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {onOpenSpliceMatrix && (
                      <button
                        onClick={() => handleEditTray(tray.id!)}
                        className="p-1 text-purple-500 hover:bg-purple-50 rounded transition-colors"
                        title="Edit Splices"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteTray(tray.id!, tray.number)}
                      className="p-1 text-red-400 hover:bg-red-50 rounded transition-colors"
                      title="Delete Tray"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Capacity Bar */}
                <div className="relative w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      usagePercent >= 100
                        ? "bg-red-500"
                        : usagePercent >= 80
                        ? "bg-yellow-500"
                        : "bg-green-500"
                    }`}
                    style={{ width: `${Math.min(usagePercent, 100)}%` }}
                  />
                </div>

                {/* Optional: Notes */}
                {tray.notes && (
                  <div className="mt-1 text-[10px] text-gray-400 truncate">
                    {tray.notes}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add Tray Confirmation (inline) */}
      {isAddingTray && (
        <div className="bg-purple-50 border border-purple-200 rounded p-2 text-xs">
          <div className="font-medium text-gray-700 mb-2">Add new tray?</div>
          <div className="flex gap-2">
            <button
              onClick={handleAddTray}
              className="flex-1 px-2 py-1 bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors"
            >
              Confirm
            </button>
            <button
              onClick={() => setIsAddingTray(false)}
              className="flex-1 px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export const TrayManager = memo(TrayManagerComponent);
