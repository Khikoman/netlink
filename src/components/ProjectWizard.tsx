"use client";

import { useState } from "react";
import {
  createProject,
  createEnclosure,
  createTray,
  db,
} from "@/lib/db";
import { setLastProjectId } from "@/lib/preferences";
import {
  ChevronRight,
  ChevronLeft,
  Check,
  MapPin,
  Box,
  Layers,
  Link2,
  Map,
  Package,
  X,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { HelpTip } from "@/components/ui/HelpTooltip";

// Enclosure type values matching the Enclosure interface
type EnclosureType = "splice-closure" | "handhole" | "pedestal" | "building" | "pole" | "cabinet";

interface ProjectWizardProps {
  onComplete: (projectId: number, nextAction: string) => void;
  onCancel: () => void;
}

interface TempEnclosure {
  id: string;
  name: string;
  type: EnclosureType;
  trayCount: number;
  trayCapacity: number;
}

const ENCLOSURE_TYPES: { type: EnclosureType; label: string; description: string; icon: string }[] = [
  {
    type: "splice-closure",
    label: "Splice Closure",
    description: "Above-ground dome or inline enclosure",
    icon: "dome",
  },
  {
    type: "handhole",
    label: "Handhole",
    description: "Underground access point",
    icon: "underground",
  },
  {
    type: "building",
    label: "Building Entry",
    description: "Building or premises entry point",
    icon: "building",
  },
  {
    type: "pedestal",
    label: "Pedestal",
    description: "Ground-level cabinet",
    icon: "cabinet",
  },
  {
    type: "pole",
    label: "Pole Mount",
    description: "Aerial pole-mounted enclosure",
    icon: "pole",
  },
];

export default function ProjectWizard({ onComplete, onCancel }: ProjectWizardProps) {
  const [step, setStep] = useState(1);
  const [isCreating, setIsCreating] = useState(false);

  // Step 1: Project details
  const [projectName, setProjectName] = useState("");
  const [projectLocation, setProjectLocation] = useState("");
  const [projectDescription, setProjectDescription] = useState("");

  // Step 2: Enclosures
  const [enclosures, setEnclosures] = useState<TempEnclosure[]>([]);
  const [addingEnclosure, setAddingEnclosure] = useState(false);
  const [newEnclosureName, setNewEnclosureName] = useState("");
  const [newEnclosureType, setNewEnclosureType] = useState<EnclosureType>("splice-closure");
  const [newTrayCount, setNewTrayCount] = useState(1);
  const [newTrayCapacity, setNewTrayCapacity] = useState(24);

  const canProceedStep1 = projectName.trim().length > 0;
  const canProceedStep2 = true; // Enclosures are optional

  const addEnclosure = () => {
    if (!newEnclosureName.trim()) return;

    const newEnc: TempEnclosure = {
      id: Math.random().toString(36).substr(2, 9),
      name: newEnclosureName,
      type: newEnclosureType,
      trayCount: newTrayCount,
      trayCapacity: newTrayCapacity,
    };

    setEnclosures([...enclosures, newEnc]);
    setNewEnclosureName("");
    setNewEnclosureType("splice-closure");
    setNewTrayCount(1);
    setNewTrayCapacity(24);
    setAddingEnclosure(false);
  };

  const removeEnclosure = (id: string) => {
    setEnclosures(enclosures.filter((e) => e.id !== id));
  };

  const handleComplete = async (nextAction: string) => {
    setIsCreating(true);
    try {
      // Create project
      const projectId = await createProject(projectName, projectLocation, projectDescription);

      // Create enclosures and trays
      for (const enc of enclosures) {
        const enclosureId = await createEnclosure({
          projectId,
          name: enc.name,
          type: enc.type,
        });

        // Create trays for this enclosure
        for (let i = 1; i <= enc.trayCount; i++) {
          await createTray({
            enclosureId,
            number: i,
            capacity: enc.trayCapacity,
          });
        }
      }

      // Save as last project
      setLastProjectId(projectId);

      onComplete(projectId, nextAction);
    } catch (error) {
      console.error("Failed to create project:", error);
      alert("Failed to create project. Please try again.");
    }
    setIsCreating(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">New Project Setup</h2>
              <p className="text-blue-100 text-sm">Step {step} of 3</p>
            </div>
            <button
              onClick={onCancel}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="flex gap-2 mt-4">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`flex-1 h-1.5 rounded-full transition-colors ${
                  s <= step ? "bg-white" : "bg-white/30"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Project Details */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <MapPin className="w-12 h-12 text-blue-600 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-gray-800">Project Details</h3>
                <p className="text-gray-500 text-sm">
                  A project groups all splice work at one location
                </p>
              </div>

              <Input
                label="Project Name"
                placeholder="e.g., 123 Main St Fiber Install"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                required
                helperText="Use a descriptive name to easily identify this job"
              />

              <Input
                label="Location"
                placeholder="e.g., Main Street between 1st and 2nd Ave"
                value={projectLocation}
                onChange={(e) => setProjectLocation(e.target.value)}
                leftIcon={<MapPin className="w-4 h-4" />}
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (optional)
                </label>
                <textarea
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Brief description of the work, special instructions, etc."
                />
              </div>
            </div>
          )}

          {/* Step 2: Enclosures */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <Box className="w-12 h-12 text-blue-600 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-gray-800">
                  Add Enclosures
                  <HelpTip term="Enclosure" />
                </h3>
                <p className="text-gray-500 text-sm">
                  Where will you be splicing? You can add more later.
                </p>
              </div>

              {/* Added enclosures list */}
              {enclosures.length > 0 && (
                <div className="space-y-2 mb-4">
                  {enclosures.map((enc, index) => (
                    <div
                      key={enc.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-medium text-sm">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium text-gray-800">{enc.name}</div>
                          <div className="text-xs text-gray-500">
                            {ENCLOSURE_TYPES.find((t) => t.type === enc.type)?.label} •{" "}
                            {enc.trayCount} tray{enc.trayCount > 1 ? "s" : ""} ({enc.trayCapacity} capacity)
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => removeEnclosure(enc.id)}
                        className="p-1 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add enclosure form */}
              {addingEnclosure ? (
                <div className="border border-blue-200 rounded-xl p-4 bg-blue-50/50">
                  <h4 className="font-medium text-gray-800 mb-4">New Enclosure</h4>

                  <div className="space-y-4">
                    <Input
                      label="Enclosure Name"
                      placeholder="e.g., Enclosure 1, HH-101, etc."
                      value={newEnclosureName}
                      onChange={(e) => setNewEnclosureName(e.target.value)}
                    />

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Type
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {ENCLOSURE_TYPES.map((type) => (
                          <button
                            key={type.type}
                            onClick={() => setNewEnclosureType(type.type)}
                            className={`p-3 rounded-lg border text-left transition-all ${
                              newEnclosureType === type.type
                                ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
                                : "border-gray-200 hover:border-gray-300"
                            }`}
                          >
                            <div className="font-medium text-gray-800 text-sm">{type.label}</div>
                            <div className="text-xs text-gray-500">{type.description}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        label="Number of Trays"
                        type="number"
                        min={1}
                        max={24}
                        value={newTrayCount.toString()}
                        onChange={(e) => setNewTrayCount(parseInt(e.target.value) || 1)}
                      />
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Tray Capacity
                        </label>
                        <select
                          value={newTrayCapacity}
                          onChange={(e) => setNewTrayCapacity(parseInt(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-blue-500"
                        >
                          <option value={12}>12 splices</option>
                          <option value={24}>24 splices</option>
                          <option value={48}>48 splices</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setAddingEnclosure(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={addEnclosure}
                        disabled={!newEnclosureName.trim()}
                      >
                        Add Enclosure
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAddingEnclosure(true)}
                  className="w-full p-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Add Enclosure
                </button>
              )}

              {enclosures.length === 0 && (
                <p className="text-center text-sm text-gray-500">
                  You can skip this step and add enclosures later
                </p>
              )}
            </div>
          )}

          {/* Step 3: Summary & Next Action */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <Check className="w-12 h-12 text-green-600 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-gray-800">Ready to Go!</h3>
                <p className="text-gray-500 text-sm">
                  Review your project and choose what to do first
                </p>
              </div>

              {/* Summary */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-600" />
                  <span className="font-medium text-gray-800">Project:</span>
                  <span className="text-gray-600">{projectName}</span>
                </div>
                {projectLocation && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">{projectLocation}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Box className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">
                    {enclosures.length} enclosure{enclosures.length !== 1 ? "s" : ""} configured
                  </span>
                </div>
              </div>

              {/* Next actions */}
              <div>
                <h4 className="font-medium text-gray-800 mb-3">What would you like to do first?</h4>
                <div className="space-y-2">
                  <button
                    onClick={() => handleComplete("splice")}
                    disabled={isCreating}
                    className="w-full p-4 border border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all text-left flex items-center gap-4"
                  >
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Link2 className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-800">Start Splicing</div>
                      <div className="text-sm text-gray-500">Document fiber splices</div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 ml-auto" />
                  </button>

                  <button
                    onClick={() => handleComplete("enclosures")}
                    disabled={isCreating}
                    className="w-full p-4 border border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all text-left flex items-center gap-4"
                  >
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <Box className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-800">Manage Enclosures</div>
                      <div className="text-sm text-gray-500">Add or edit enclosures and trays</div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 ml-auto" />
                  </button>

                  <button
                    onClick={() => handleComplete("map")}
                    disabled={isCreating}
                    className="w-full p-4 border border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all text-left flex items-center gap-4"
                  >
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Map className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-800">Create Network Map</div>
                      <div className="text-sm text-gray-500">Draw your fiber network diagram</div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 ml-auto" />
                  </button>

                  <button
                    onClick={() => handleComplete("dashboard")}
                    disabled={isCreating}
                    className="w-full p-4 border border-gray-200 rounded-xl hover:border-gray-300 transition-all text-left flex items-center gap-4"
                  >
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                      <Package className="w-5 h-5 text-gray-600" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-800">Go to Dashboard</div>
                      <div className="text-sm text-gray-500">I&apos;ll decide later</div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 ml-auto" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex justify-between">
          {step > 1 ? (
            <Button
              variant="secondary"
              onClick={() => setStep(step - 1)}
              leftIcon={<ChevronLeft className="w-4 h-4" />}
            >
              Back
            </Button>
          ) : (
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
          )}

          {step < 3 && (
            <Button
              variant="primary"
              onClick={() => setStep(step + 1)}
              disabled={step === 1 && !canProceedStep1}
              rightIcon={<ChevronRight className="w-4 h-4" />}
            >
              Next
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
