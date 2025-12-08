"use client";

import { useState, useEffect } from "react";
import { X, Server, Box, Network, GitBranch, Link2 } from "lucide-react";
import { db } from "@/lib/db";
import type { OLT, ODF, Enclosure } from "@/types";

interface NodeEditDialogProps {
  nodeId: string;
  nodeType: string;
  dbId: number;
  onClose: () => void;
}

// Node type icons
const nodeIcons: Record<string, React.ReactNode> = {
  olt: <Server className="w-5 h-5 text-teal-600" />,
  odf: <Box className="w-5 h-5 text-cyan-600" />,
  closure: <Network className="w-5 h-5 text-purple-600" />,
  lcp: <GitBranch className="w-5 h-5 text-orange-600" />,
  nap: <Link2 className="w-5 h-5 text-blue-600" />,
};

// Node type labels
const nodeLabels: Record<string, string> = {
  olt: "OLT (Optical Line Terminal)",
  odf: "ODF (Optical Distribution Frame)",
  closure: "Splice Closure",
  lcp: "LCP (Local Convergence Point)",
  nap: "NAP (Network Access Point)",
};

export function NodeEditDialog({ nodeId, nodeType, dbId, onClose }: NodeEditDialogProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");

  // OLT-specific fields
  const [totalPonPorts, setTotalPonPorts] = useState(16);
  const [model, setModel] = useState("");

  // ODF-specific fields
  const [portCount, setPortCount] = useState(48);

  // Enclosure-specific fields
  const [enclosureType, setEnclosureType] = useState<string>("splice-closure");

  // LCP-specific fields (splitter info is stored separately, but we show summary)
  const [splitterCount, setSplitterCount] = useState(0);

  // NAP-specific fields
  const [napPortCount, setNapPortCount] = useState(8);

  // Load existing data
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        if (nodeType === "olt") {
          const olt = await db.olts.get(dbId);
          if (olt) {
            setName(olt.name || "");
            setAddress(olt.address || "");
            setTotalPonPorts(olt.totalPonPorts || 16);
            setModel(olt.model || "");
          }
        } else if (nodeType === "odf") {
          const odf = await db.odfs.get(dbId);
          if (odf) {
            setName(odf.name || "");
            setAddress(odf.location || "");
            setPortCount(odf.portCount || 48);
          }
        } else {
          const enclosure = await db.enclosures.get(dbId);
          if (enclosure) {
            setName(enclosure.name || "");
            setAddress(enclosure.address || "");
            setEnclosureType(enclosure.type || "splice-closure");

            // Load LCP splitter count
            if (nodeType === "lcp") {
              const splitters = await db.splitters.where("enclosureId").equals(dbId).count();
              setSplitterCount(splitters);
            }

            // Load NAP port count
            if (nodeType === "nap") {
              const ports = await db.ports.where("enclosureId").equals(dbId).count();
              setNapPortCount(ports || 8);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load node data:", err);
        setError("Failed to load node data");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [nodeType, dbId]);

  // Save changes
  const handleSave = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (nodeType === "olt") {
        await db.olts.update(dbId, {
          name: name.trim(),
          address: address.trim() || undefined,
          totalPonPorts,
          model: model.trim() || undefined,
        });
      } else if (nodeType === "odf") {
        await db.odfs.update(dbId, {
          name: name.trim(),
          location: address.trim() || undefined,
          portCount,
        });
      } else {
        await db.enclosures.update(dbId, {
          name: name.trim(),
          address: address.trim() || undefined,
          type: enclosureType as Enclosure["type"],
        });
      }

      onClose();
    } catch (err) {
      console.error("Failed to save node:", err);
      setError("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            {nodeIcons[nodeType]}
            Edit {nodeLabels[nodeType] || nodeType.toUpperCase()}
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Loading state */}
        {loading ? (
          <div className="py-8 text-center text-gray-500">
            Loading...
          </div>
        ) : (
          <>
            {/* Error message */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Form fields */}
            <div className="space-y-4">
              {/* Name field - all node types */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder={`Enter ${nodeType.toUpperCase()} name`}
                />
              </div>

              {/* Address/Location field - all node types */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {nodeType === "odf" ? "Location" : "Address"}
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter address or location"
                />
              </div>

              {/* OLT-specific fields */}
              {nodeType === "olt" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Model
                    </label>
                    <input
                      type="text"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., Huawei MA5800"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Total PON Ports
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={128}
                      value={totalPonPorts}
                      onChange={(e) => setTotalPonPorts(parseInt(e.target.value) || 16)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </>
              )}

              {/* ODF-specific fields */}
              {nodeType === "odf" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Port Count
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={288}
                    value={portCount}
                    onChange={(e) => setPortCount(parseInt(e.target.value) || 48)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              )}

              {/* Closure-specific fields */}
              {nodeType === "closure" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Closure Type
                  </label>
                  <select
                    value={enclosureType}
                    onChange={(e) => setEnclosureType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="splice-closure">Splice Closure</option>
                    <option value="handhole">Handhole</option>
                    <option value="pedestal">Pedestal</option>
                    <option value="aerial">Aerial Closure</option>
                  </select>
                </div>
              )}

              {/* LCP-specific fields */}
              {nodeType === "lcp" && (
                <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Splitter Configuration
                  </label>
                  <p className="text-sm text-gray-600">
                    {splitterCount > 0
                      ? `${splitterCount} splitter(s) configured`
                      : "No splitters configured yet"}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Use the canvas to manage splitters
                  </p>
                </div>
              )}

              {/* NAP-specific fields */}
              {nodeType === "nap" && (
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Port Configuration
                  </label>
                  <p className="text-sm text-gray-600">
                    {napPortCount > 0
                      ? `${napPortCount} port(s) configured`
                      : "No ports configured yet"}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Expand the node on canvas to manage ports
                  </p>
                </div>
              )}
            </div>

            {/* Buttons */}
            <div className="flex gap-2 mt-6">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default NodeEditDialog;
