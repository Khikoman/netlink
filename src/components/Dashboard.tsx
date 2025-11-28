"use client";

import { useState } from "react";
import { db, createProject, deleteProject } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import {
  FolderOpen,
  Plus,
  MapPin,
  Link2,
  Box,
  ChevronRight,
  Trash2,
  Search,
  Calculator,
  Palette,
  AlertTriangle,
  Clock,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { NoProjectsEmpty } from "@/components/ui/EmptyState";
import type { Project } from "@/types";

interface DashboardProps {
  onNavigate: (tab: string) => void;
  onSelectProject?: (projectId: number) => void;
}

export default function Dashboard({ onNavigate, onSelectProject }: DashboardProps) {
  const [showNewProject, setShowNewProject] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectLocation, setProjectLocation] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Project | null>(null);

  // Get projects with stats
  const projects = useLiveQuery(() => db.projects.orderBy("createdAt").reverse().toArray(), []);
  const enclosures = useLiveQuery(() => db.enclosures.toArray(), []);
  const splices = useLiveQuery(() => db.splices.toArray(), []);
  const lowStockItems = useLiveQuery(async () => {
    const items = await db.inventory.toArray();
    return items.filter((item) => item.quantity <= item.minStock);
  }, []);

  // Calculate stats for each project
  const getProjectStats = (projectId: number) => {
    const projectEnclosures = enclosures?.filter((e) => e.projectId === projectId) || [];
    const enclosureIds = projectEnclosures.map((e) => e.id);

    // We need to get trays for these enclosures to count splices
    // For simplicity, count total splices that belong to trays in project enclosures
    // This is a simplified calculation
    return {
      enclosureCount: projectEnclosures.length,
      // Note: splice count would need tray lookup - simplified for now
      spliceCount: 0,
    };
  };

  const handleCreateProject = async () => {
    if (!projectName.trim()) return;

    setIsCreating(true);
    try {
      const id = await createProject(projectName, projectLocation, projectDescription);
      setShowNewProject(false);
      setProjectName("");
      setProjectLocation("");
      setProjectDescription("");

      // Navigate to enclosures to add first enclosure
      if (onSelectProject) {
        onSelectProject(id);
      }
    } catch {
      alert("Failed to create project");
    }
    setIsCreating(false);
  };

  const handleDeleteProject = async () => {
    if (!deleteConfirm?.id) return;
    try {
      await deleteProject(deleteConfirm.id);
      setDeleteConfirm(null);
    } catch {
      alert("Failed to delete project");
    }
  };

  const handleContinueProject = (project: Project) => {
    if (onSelectProject && project.id) {
      onSelectProject(project.id);
    }
    onNavigate("hierarchy");
  };

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">Welcome to NetLink</h1>
        <p className="text-blue-100">
          Your OSP fiber documentation tool. Create a project to start tracking splices, or use the quick tools below.
        </p>
      </div>

      {/* Projects Section */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-800">Your Projects</h2>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowNewProject(true)}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            New Project
          </Button>
        </div>

        {!projects || projects.length === 0 ? (
          <NoProjectsEmpty onAction={() => setShowNewProject(true)} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => {
              const stats = getProjectStats(project.id!);
              const isCompleted = project.status === "completed";

              return (
                <div
                  key={project.id}
                  className={`border rounded-xl p-4 transition-all hover:shadow-md ${
                    isCompleted ? "bg-green-50 border-green-200" : "bg-white border-gray-200"
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <FolderOpen
                        className={`w-5 h-5 ${isCompleted ? "text-green-600" : "text-blue-600"}`}
                      />
                      <h3 className="font-semibold text-gray-800 line-clamp-1">{project.name}</h3>
                    </div>
                    {isCompleted && (
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    )}
                  </div>

                  {project.location && (
                    <div className="flex items-center gap-1 text-sm text-gray-500 mb-2">
                      <MapPin className="w-3 h-3" />
                      <span className="line-clamp-1">{project.location}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                    <div className="flex items-center gap-1">
                      <Box className="w-4 h-4" />
                      <span>{stats.enclosureCount} enclosures</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-gray-400 mb-4">
                    <Clock className="w-3 h-3" />
                    <span>
                      {project.createdAt
                        ? new Date(project.createdAt).toLocaleDateString()
                        : "Unknown date"}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant={isCompleted ? "secondary" : "primary"}
                      size="sm"
                      className="flex-1"
                      onClick={() => handleContinueProject(project)}
                      rightIcon={<ChevronRight className="w-4 h-4" />}
                    >
                      {isCompleted ? "View" : "Continue"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteConfirm(project)}
                      className="text-red-500 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Tools Section */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Search className="w-5 h-5 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-800">Quick Tools</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Use these tools without creating a project
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button
            onClick={() => onNavigate("lookup")}
            className="p-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-left"
          >
            <Search className="w-6 h-6 text-blue-600 mb-2" />
            <div className="font-medium text-gray-800">Fiber Lookup</div>
            <div className="text-xs text-gray-500">Find fiber by number</div>
          </button>

          <button
            onClick={() => onNavigate("reverse")}
            className="p-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-left"
          >
            <Palette className="w-6 h-6 text-green-600 mb-2" />
            <div className="font-medium text-gray-800">Color to #</div>
            <div className="text-xs text-gray-500">Find # by color</div>
          </button>

          <button
            onClick={() => onNavigate("lossBudget")}
            className="p-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-left"
          >
            <Calculator className="w-6 h-6 text-purple-600 mb-2" />
            <div className="font-medium text-gray-800">Loss Budget</div>
            <div className="text-xs text-gray-500">Calculate link loss</div>
          </button>

          <button
            onClick={() => onNavigate("reference")}
            className="p-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-left"
          >
            <Palette className="w-6 h-6 text-orange-600 mb-2" />
            <div className="font-medium text-gray-800">Color Chart</div>
            <div className="text-xs text-gray-500">TIA-598 reference</div>
          </button>
        </div>
      </div>

      {/* Alerts Section */}
      {lowStockItems && lowStockItems.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h2 className="text-lg font-semibold text-gray-800">Low Stock Alert</h2>
          </div>
          <p className="text-sm text-amber-800 mb-3">
            {lowStockItems.length} item{lowStockItems.length > 1 ? "s" : ""} running low
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onNavigate("stock")}
          >
            View Inventory
          </Button>
        </div>
      )}

      {/* New Project Modal */}
      <Modal
        isOpen={showNewProject}
        onClose={() => setShowNewProject(false)}
        title="Create New Project"
        size="md"
      >
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 rounded-lg text-sm text-blue-800">
            <strong>What is a project?</strong>
            <p className="mt-1">
              A project organizes all your splice work at a specific location.
              For example: &quot;123 Main St Fiber Install&quot; or &quot;Oak Ave Repair Job&quot;.
            </p>
          </div>

          <Input
            label="Project Name"
            placeholder="e.g., 123 Main St Fiber Install"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            required
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
              rows={2}
              placeholder="Brief description of the work..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setShowNewProject(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={handleCreateProject}
              isLoading={isCreating}
              disabled={!projectName.trim()}
            >
              Create Project
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Project?"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to delete <strong>{deleteConfirm?.name}</strong>?
          </p>
          <p className="text-sm text-red-600">
            This will permanently delete all enclosures, trays, and splices in this project.
          </p>

          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setDeleteConfirm(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={handleDeleteProject}
            >
              Delete Project
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
