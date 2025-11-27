"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import type { Splitter, Port, Cable } from "@/types";
import { GitBranch, Trash2, Edit } from "lucide-react";
import { PortGridCompact, PortStatusSummary } from "./PortGrid";

interface SplitterCardProps {
  splitter: Splitter;
  onPortClick?: (port: Port) => void;
  onEdit?: (splitter: Splitter) => void;
  onDelete?: (splitter: Splitter) => void;
}

export default function SplitterCard({
  splitter,
  onPortClick,
  onEdit,
  onDelete,
}: SplitterCardProps) {
  // Get ports for this splitter
  const ports = useLiveQuery(
    () => db.ports.where("splitterId").equals(splitter.id!).toArray(),
    [splitter.id]
  );

  // Get input cable info
  const inputCable = useLiveQuery<Cable | undefined>(
    async () => {
      if (!splitter.inputCableId) return undefined;
      return db.cables.get(splitter.inputCableId);
    },
    [splitter.inputCableId]
  );

  const sortedPorts = ports?.sort((a, b) => a.portNumber - b.portNumber) || [];

  // Get the output count from splitter type (e.g., "1:8" -> 8)
  const outputCount = parseInt(splitter.type.split(":")[1]);

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-purple-50 border-b border-purple-100">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <GitBranch className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h4 className="font-semibold text-gray-800">{splitter.name}</h4>
            <div className="text-sm text-gray-500">
              {splitter.type} Splitter ({outputCount} outputs)
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {onEdit && (
            <button
              onClick={() => onEdit(splitter)}
              className="p-2 hover:bg-purple-100 rounded-lg transition-colors"
              title="Edit Splitter"
            >
              <Edit className="w-4 h-4 text-gray-500" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(splitter)}
              className="p-2 hover:bg-red-100 rounded-lg transition-colors"
              title="Delete Splitter"
            >
              <Trash2 className="w-4 h-4 text-red-500" />
            </button>
          )}
        </div>
      </div>

      {/* Input Info */}
      {inputCable && (
        <div className="px-4 py-2 bg-blue-50 border-b text-sm">
          <span className="text-blue-600 font-medium">Input:</span>{" "}
          <span className="text-gray-700">
            {inputCable.name} / Fiber {splitter.inputFiber}
          </span>
        </div>
      )}

      {/* Output Ports */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-700">Output Ports</span>
          {sortedPorts.length > 0 && <PortStatusSummary ports={sortedPorts} />}
        </div>

        {sortedPorts.length > 0 ? (
          <PortGridCompact ports={sortedPorts} onPortClick={onPortClick} />
        ) : (
          <div className="text-sm text-gray-400 text-center py-4">
            No output ports configured.
            <br />
            Ports will be created automatically.
          </div>
        )}
      </div>

      {/* Notes */}
      {splitter.notes && (
        <div className="px-4 py-2 bg-gray-50 border-t text-sm text-gray-500">
          {splitter.notes}
        </div>
      )}
    </div>
  );
}

// Splitter Type Selector
export function SplitterTypeSelector({
  value,
  onChange,
}: {
  value: Splitter["type"];
  onChange: (type: Splitter["type"]) => void;
}) {
  const types: { value: Splitter["type"]; label: string; outputs: number }[] = [
    { value: "1:2", label: "1:2", outputs: 2 },
    { value: "1:4", label: "1:4", outputs: 4 },
    { value: "1:8", label: "1:8", outputs: 8 },
    { value: "1:16", label: "1:16", outputs: 16 },
    { value: "1:32", label: "1:32", outputs: 32 },
  ];

  return (
    <div className="grid grid-cols-5 gap-2">
      {types.map((type) => (
        <button
          key={type.value}
          type="button"
          onClick={() => onChange(type.value)}
          className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
            value === type.value
              ? "bg-purple-600 text-white border-purple-600"
              : "bg-white text-gray-700 border-gray-300 hover:border-purple-400"
          }`}
        >
          {type.label}
        </button>
      ))}
    </div>
  );
}
