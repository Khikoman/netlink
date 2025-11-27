"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import dynamic from "next/dynamic";
import {
  db,
  createProject,
  createEnclosure,
  createTray,
  updateEnclosure,
  deleteEnclosure,
  deleteTray,
} from "@/lib/db";
import type { Project, Enclosure, Tray, Splice } from "@/types";
import { MapPin } from "lucide-react";

// Dynamically import LocationPicker to avoid SSR issues with Leaflet
const LocationPicker = dynamic(() => import("@/components/map/LocationPicker"), {
  ssr: false,
  loading: () => (
    <div className="h-32 bg-gray-100 rounded-lg animate-pulse flex items-center justify-center text-gray-400">
      Loading map...
    </div>
  ),
});

const ENCLOSURE_TYPES = [
  { value: "splice-closure", label: "Splice Closure" },
  { value: "handhole", label: "Handhole" },
  { value: "pedestal", label: "Pedestal" },
  { value: "building", label: "Building Entry" },
  { value: "pole", label: "Pole Mount" },
  { value: "cabinet", label: "Cabinet" },
  { value: "lcp", label: "LCP (Aggregation)" },
  { value: "nap", label: "NAP (Customer Drop)" },
  { value: "fdt", label: "FDT (Fiber Distribution)" },
  { value: "fat", label: "FAT (Fiber Access)" },
] as const;

export default function EnclosureManager() {
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedEnclosureId, setSelectedEnclosureId] = useState<number | null>(null);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [showEnclosureForm, setShowEnclosureForm] = useState(false);
  const [showTrayForm, setShowTrayForm] = useState(false);
  const [editingEnclosure, setEditingEnclosure] = useState<Enclosure | null>(null);

  // Form state
  const [projectName, setProjectName] = useState("");
  const [projectLocation, setProjectLocation] = useState("");
  const [enclosureName, setEnclosureName] = useState("");
  const [enclosureType, setEnclosureType] = useState<Enclosure["type"]>("splice-closure");
  const [enclosureAddress, setEnclosureAddress] = useState("");
  const [enclosureLat, setEnclosureLat] = useState<number | undefined>(undefined);
  const [enclosureLng, setEnclosureLng] = useState<number | undefined>(undefined);
  const [trayNumber, setTrayNumber] = useState(1);
  const [trayCapacity, setTrayCapacity] = useState(12);

  // Data queries
  const projects = useLiveQuery(() => db.projects.orderBy("createdAt").reverse().toArray(), []);
  const enclosures = useLiveQuery(
    () =>
      selectedProjectId
        ? db.enclosures.where("projectId").equals(selectedProjectId).toArray()
        : [],
    [selectedProjectId]
  );
  const trays = useLiveQuery(
    () =>
      selectedEnclosureId
        ? db.trays.where("enclosureId").equals(selectedEnclosureId).sortBy("number")
        : [],
    [selectedEnclosureId]
  );

  // Get splice count for a tray
  const traySpliceCounts = useLiveQuery(async () => {
    if (!trays) return {};
    const counts: Record<number, number> = {};
    for (const tray of trays) {
      if (tray.id) {
        counts[tray.id] = await db.splices.where("trayId").equals(tray.id).count();
      }
    }
    return counts;
  }, [trays]);

  // Handlers
  const handleCreateProject = async () => {
    if (!projectName.trim()) return;
    const id = await createProject(projectName, projectLocation);
    setSelectedProjectId(id);
    setProjectName("");
    setProjectLocation("");
    setShowProjectForm(false);
  };

  const handleCreateEnclosure = async () => {
    if (!selectedProjectId || !enclosureName.trim()) return;
    const id = await createEnclosure({
      projectId: selectedProjectId,
      name: enclosureName,
      type: enclosureType,
      address: enclosureAddress,
      gpsLat: enclosureLat,
      gpsLng: enclosureLng,
    });
    setSelectedEnclosureId(id);
    resetEnclosureForm();
    setShowEnclosureForm(false);
  };

  const handleUpdateEnclosure = async () => {
    if (!editingEnclosure?.id) return;
    await updateEnclosure(editingEnclosure.id, {
      name: enclosureName,
      type: enclosureType,
      address: enclosureAddress,
      gpsLat: enclosureLat,
      gpsLng: enclosureLng,
    });
    setEditingEnclosure(null);
    resetEnclosureForm();
    setShowEnclosureForm(false);
  };

  const resetEnclosureForm = () => {
    setEnclosureName("");
    setEnclosureAddress("");
    setEnclosureLat(undefined);
    setEnclosureLng(undefined);
  };

  const handleDeleteEnclosure = async (id: number) => {
    if (confirm("Delete this enclosure and all its trays/splices?")) {
      await deleteEnclosure(id);
      if (selectedEnclosureId === id) {
        setSelectedEnclosureId(null);
      }
    }
  };

  const handleCreateTray = async () => {
    if (!selectedEnclosureId) return;
    await createTray({
      enclosureId: selectedEnclosureId,
      number: trayNumber,
      capacity: trayCapacity,
    });
    setTrayNumber(trayNumber + 1);
    setShowTrayForm(false);
  };

  const handleDeleteTray = async (id: number) => {
    if (confirm("Delete this tray and all its splices?")) {
      await deleteTray(id);
    }
  };

  const startEditEnclosure = (enc: Enclosure) => {
    setEditingEnclosure(enc);
    setEnclosureName(enc.name);
    setEnclosureType(enc.type);
    setEnclosureAddress(enc.address || "");
    setEnclosureLat(enc.gpsLat);
    setEnclosureLng(enc.gpsLng);
    setShowEnclosureForm(true);
  };

  return (
    <div className="space-y-6">
      {/* Projects Section */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Projects</h2>
          <button
            onClick={() => setShowProjectForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            + New Project
          </button>
        </div>

        {projects && projects.length > 0 ? (
          <div className="grid gap-3">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => {
                  setSelectedProjectId(project.id!);
                  setSelectedEnclosureId(null);
                }}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                  selectedProjectId === project.id
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="font-medium text-gray-800">{project.name}</div>
                <div className="text-sm text-gray-500">{project.location}</div>
                <div className="text-xs text-gray-400 mt-1">
                  Created {new Date(project.createdAt).toLocaleDateString()}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No projects yet. Create one to get started.
          </div>
        )}

        {/* Project Form Modal */}
        {showProjectForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">New Project</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Project Name
                  </label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800"
                    placeholder="e.g., Main Street Fiber Build"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  <input
                    type="text"
                    value={projectLocation}
                    onChange={(e) => setProjectLocation(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800"
                    placeholder="e.g., Downtown Area"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowProjectForm(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateProject}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Enclosures Section */}
      {selectedProjectId && (
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800">Enclosures</h2>
            <button
              onClick={() => {
                setEditingEnclosure(null);
                resetEnclosureForm();
                setShowEnclosureForm(true);
              }}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
            >
              + Add Enclosure
            </button>
          </div>

          {enclosures && enclosures.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {enclosures.map((enc) => (
                <div
                  key={enc.id}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    selectedEnclosureId === enc.id
                      ? "border-green-500 bg-green-50"
                      : "border-gray-200"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <button
                      onClick={() => setSelectedEnclosureId(enc.id!)}
                      className="text-left flex-1"
                    >
                      <div className="font-medium text-gray-800">{enc.name}</div>
                      <div className="text-sm text-gray-500">
                        {ENCLOSURE_TYPES.find((t) => t.value === enc.type)?.label}
                      </div>
                      {enc.address && (
                        <div className="text-xs text-gray-400 mt-1">{enc.address}</div>
                      )}
                      {enc.gpsLat && enc.gpsLng && (
                        <div className="flex items-center gap-1 text-xs text-green-600 mt-1">
                          <MapPin className="w-3 h-3" />
                          GPS: {enc.gpsLat.toFixed(4)}, {enc.gpsLng.toFixed(4)}
                        </div>
                      )}
                    </button>
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEditEnclosure(enc)}
                        className="p-2 text-gray-400 hover:text-blue-600"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteEnclosure(enc.id!)}
                        className="p-2 text-gray-400 hover:text-red-600"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No enclosures yet. Add one to start documenting splices.
            </div>
          )}

          {/* Enclosure Form Modal */}
          {showEnclosureForm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  {editingEnclosure ? "Edit Enclosure" : "New Enclosure"}
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input
                      type="text"
                      value={enclosureName}
                      onChange={(e) => setEnclosureName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800"
                      placeholder="e.g., HH-001 or SC-001"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select
                      value={enclosureType}
                      onChange={(e) => setEnclosureType(e.target.value as Enclosure["type"])}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800"
                    >
                      {ENCLOSURE_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Address / Location
                    </label>
                    <input
                      type="text"
                      value={enclosureAddress}
                      onChange={(e) => setEnclosureAddress(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800"
                      placeholder="e.g., 123 Main St, Near Pole #45"
                    />
                  </div>

                  {/* GPS Location Section */}
                  <div className="border-t pt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-green-600" />
                      GPS Coordinates
                    </label>
                    <LocationPicker
                      latitude={enclosureLat}
                      longitude={enclosureLng}
                      onLocationChange={(lat, lng) => {
                        setEnclosureLat(lat);
                        setEnclosureLng(lng);
                      }}
                      showMiniMap={true}
                    />
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => {
                      setShowEnclosureForm(false);
                      setEditingEnclosure(null);
                      resetEnclosureForm();
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={editingEnclosure ? handleUpdateEnclosure : handleCreateEnclosure}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    {editingEnclosure ? "Update" : "Create"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Trays Section */}
      {selectedEnclosureId && (
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800">Splice Trays</h2>
            <button
              onClick={() => setShowTrayForm(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700"
            >
              + Add Tray
            </button>
          </div>

          {trays && trays.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-3">
              {trays.map((tray) => {
                const spliceCount = traySpliceCounts?.[tray.id!] || 0;
                const fillPercent = (spliceCount / tray.capacity) * 100;

                return (
                  <div
                    key={tray.id}
                    className="p-4 rounded-xl border-2 border-gray-200 hover:border-purple-300"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium text-gray-800">Tray {tray.number}</div>
                      <button
                        onClick={() => handleDeleteTray(tray.id!)}
                        className="p-1 text-gray-400 hover:text-red-600"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                    <div className="text-sm text-gray-500 mb-2">
                      {spliceCount} / {tray.capacity} splices
                    </div>
                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          fillPercent > 90
                            ? "bg-red-500"
                            : fillPercent > 70
                            ? "bg-yellow-500"
                            : "bg-green-500"
                        }`}
                        style={{ width: `${Math.min(fillPercent, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No trays yet. Add trays to organize your splices.
            </div>
          )}

          {/* Tray Form Modal */}
          {showTrayForm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Add Splice Tray</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tray Number
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={trayNumber}
                      onChange={(e) => setTrayNumber(parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Capacity (max splices)
                    </label>
                    <select
                      value={trayCapacity}
                      onChange={(e) => setTrayCapacity(parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800"
                    >
                      <option value={6}>6 splices</option>
                      <option value={12}>12 splices</option>
                      <option value={24}>24 splices</option>
                      <option value={36}>36 splices</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setShowTrayForm(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateTray}
                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                  >
                    Add Tray
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Help Text */}
      {!selectedProjectId && (
        <div className="bg-blue-50 rounded-2xl p-6">
          <h3 className="font-semibold text-blue-900 mb-2">Getting Started</h3>
          <ol className="list-decimal list-inside space-y-2 text-blue-800">
            <li>Create a project for your fiber build</li>
            <li>Add enclosures (splice closures, handholes, etc.)</li>
            <li>Add splice trays to each enclosure</li>
            <li>Go to Splice Matrix to document your splices</li>
          </ol>
        </div>
      )}
    </div>
  );
}
