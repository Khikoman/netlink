"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";

export interface SpliceMetadata {
  loss?: number;
  status: "completed" | "pending" | "needs-review" | "failed";
  spliceType: "fusion" | "mechanical";
  technicianName?: string;
  notes?: string;
}

export interface MetadataPanelProps {
  metadata: SpliceMetadata;
  onChange: (updates: Partial<SpliceMetadata>) => void;
  selectedConnection?: {
    fiberA: number;
    fiberB: number;
    colorA: string;
    colorB: string;
  };
  className?: string;
}

const lossQuality = (loss: number | undefined) => {
  if (loss === undefined) return { label: "Not tested", color: "text-slate-400", bg: "bg-slate-700" };
  if (loss < 0.05) return { label: "Excellent", color: "text-green-400", bg: "bg-green-900/30" };
  if (loss < 0.1) return { label: "Good", color: "text-green-300", bg: "bg-green-900/20" };
  if (loss < 0.15) return { label: "Acceptable", color: "text-amber-400", bg: "bg-amber-900/30" };
  if (loss < 0.3) return { label: "Marginal", color: "text-orange-400", bg: "bg-orange-900/30" };
  return { label: "Poor - Review", color: "text-red-400", bg: "bg-red-900/30" };
};

export const MetadataPanel = memo(function MetadataPanel({
  metadata,
  onChange,
  selectedConnection,
  className,
}: MetadataPanelProps) {
  const quality = lossQuality(metadata.loss);

  return (
    <div
      className={cn(
        "bg-slate-800/90 rounded-lg border border-slate-600 p-4",
        className
      )}
    >
      {/* Selected connection preview */}
      {selectedConnection && (
        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <div
              className="w-5 h-5 rounded-full border-2 border-white/30 flex items-center justify-center text-[10px] font-bold"
              style={{ backgroundColor: selectedConnection.colorA }}
            >
              {selectedConnection.fiberA}
            </div>
            <span className="text-slate-300">F{selectedConnection.fiberA}</span>
          </div>
          <div className="flex-1 h-0.5 bg-gradient-to-r from-slate-600 via-white/20 to-slate-600" />
          <div className="flex items-center gap-2">
            <span className="text-slate-300">F{selectedConnection.fiberB}</span>
            <div
              className="w-5 h-5 rounded-full border-2 border-white/30 flex items-center justify-center text-[10px] font-bold"
              style={{ backgroundColor: selectedConnection.colorB }}
            >
              {selectedConnection.fiberB}
            </div>
          </div>
        </div>
      )}

      {/* Loss reading */}
      <div className="mb-4">
        <label className="text-xs text-slate-400 block mb-1">Loss (dB)</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            step="0.01"
            min="0"
            max="10"
            value={metadata.loss ?? ""}
            onChange={(e) =>
              onChange({ loss: e.target.value ? parseFloat(e.target.value) : undefined })
            }
            placeholder="0.00"
            className={cn(
              "w-24 px-3 py-2 rounded bg-slate-900 border border-slate-600",
              "text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500",
              quality.bg
            )}
          />
          <div
            className={cn(
              "flex-1 px-3 py-2 rounded text-sm font-medium",
              quality.color,
              quality.bg
            )}
          >
            {quality.label}
          </div>
        </div>
        {/* Loss slider for visual input */}
        <input
          type="range"
          min="0"
          max="0.5"
          step="0.01"
          value={metadata.loss ?? 0}
          onChange={(e) => onChange({ loss: parseFloat(e.target.value) })}
          className="w-full mt-2 accent-blue-500"
        />
      </div>

      {/* Splice method */}
      <div className="mb-4">
        <label className="text-xs text-slate-400 block mb-1">Splice Method</label>
        <div className="flex gap-2">
          <button
            onClick={() => onChange({ spliceType: "fusion" })}
            className={cn(
              "flex-1 px-3 py-2 rounded text-sm font-medium transition-all",
              metadata.spliceType === "fusion"
                ? "bg-blue-600 text-white"
                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
            )}
          >
            Fusion
          </button>
          <button
            onClick={() => onChange({ spliceType: "mechanical" })}
            className={cn(
              "flex-1 px-3 py-2 rounded text-sm font-medium transition-all",
              metadata.spliceType === "mechanical"
                ? "bg-purple-600 text-white"
                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
            )}
          >
            Mechanical
          </button>
        </div>
      </div>

      {/* Status */}
      <div className="mb-4">
        <label className="text-xs text-slate-400 block mb-1">Status</label>
        <select
          value={metadata.status}
          onChange={(e) =>
            onChange({ status: e.target.value as SpliceMetadata["status"] })
          }
          className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-600 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
          <option value="needs-review">Needs Review</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {/* Technician */}
      <div className="mb-4">
        <label className="text-xs text-slate-400 block mb-1">Technician</label>
        <input
          type="text"
          value={metadata.technicianName ?? ""}
          onChange={(e) => onChange({ technicianName: e.target.value || undefined })}
          placeholder="Enter technician name"
          className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-600 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Notes */}
      <div>
        <label className="text-xs text-slate-400 block mb-1">Notes</label>
        <textarea
          value={metadata.notes ?? ""}
          onChange={(e) => onChange({ notes: e.target.value || undefined })}
          placeholder="Add notes..."
          rows={2}
          className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-600 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>
    </div>
  );
});

export default MetadataPanel;
