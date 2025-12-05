"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import {
  Home,
  Wrench,
  BarChart3,
  Package,
  Map,
  Menu,
  X,
  Zap,
  Network,
} from "lucide-react";
import { CardSkeleton } from "@/components/ui";

// Fiber Tools (existing)
import FiberLookup from "@/components/fiber/FiberLookup";
import ReverseLookup from "@/components/fiber/ReverseLookup";
import CableOverview from "@/components/fiber/CableOverview";
import ColorReference from "@/components/fiber/ColorReference";

// Dashboard
import Dashboard from "@/components/Dashboard";

// Dynamically import heavy components to reduce initial bundle
const SpliceMatrix = dynamic(() => import("@/components/splice/SpliceMatrix"), {
  loading: () => <CardSkeleton />,
});
const LossBudgetCalculator = dynamic(() => import("@/components/analysis/LossBudgetCalculator"), {
  loading: () => <CardSkeleton />,
});
const InventoryList = dynamic(() => import("@/components/inventory/InventoryList"), {
  loading: () => <CardSkeleton />,
});
const OtdrViewer = dynamic(() => import("@/components/analysis/OtdrViewer"), {
  loading: () => <CardSkeleton />,
});
const NetworkMap = dynamic(() => import("@/components/map/NetworkMap"), {
  loading: () => <CardSkeleton />,
  ssr: false, // Konva doesn't work with SSR
});
const ProjectWizard = dynamic(() => import("@/components/ProjectWizard"), {
  loading: () => <CardSkeleton />,
});
const UnifiedHierarchyBrowser = dynamic(() => import("@/components/hierarchy/UnifiedHierarchyBrowser"), {
  loading: () => <CardSkeleton />,
});
const TopologyCanvas = dynamic(() => import("@/components/topology/TopologyCanvas"), {
  loading: () => <CardSkeleton />,
  ssr: false, // React Flow requires client-side rendering
});

// Navigation structure - Simplified: merged splice/distribution/hierarchy into "network"
type TabGroup = "home" | "tools" | "network" | "analysis" | "inventory" | "map";
type Tab =
  | "dashboard"
  | "lookup"
  | "reverse"
  | "overview"
  | "reference"
  | "hierarchy"
  | "topology"
  | "spliceMatrix"
  | "lossBudget"
  | "otdr"
  | "stock"
  | "networkMap";

interface TabConfig {
  id: Tab;
  label: string;
  group: TabGroup;
}

const tabs: TabConfig[] = [
  // Home group
  { id: "dashboard", label: "Dashboard", group: "home" },
  // Tools group
  { id: "lookup", label: "Fiber Lookup", group: "tools" },
  { id: "reverse", label: "Color to #", group: "tools" },
  { id: "overview", label: "Cable View", group: "tools" },
  { id: "reference", label: "Reference", group: "tools" },
  // Network group (unified: hierarchy + topology + splice matrix)
  { id: "hierarchy", label: "Hierarchy", group: "network" },
  { id: "topology", label: "Topology", group: "network" },
  { id: "spliceMatrix", label: "Splice Matrix", group: "network" },
  // Analysis group
  { id: "lossBudget", label: "Loss Budget", group: "analysis" },
  { id: "otdr", label: "OTDR Viewer", group: "analysis" },
  // Inventory group
  { id: "stock", label: "Inventory", group: "inventory" },
  // Map group
  { id: "networkMap", label: "Network Map", group: "map" },
];

const groupConfig: Record<TabGroup, { label: string; icon: React.ReactNode }> = {
  home: { label: "Home", icon: <Home className="w-4 h-4" /> },
  tools: { label: "Tools", icon: <Wrench className="w-4 h-4" /> },
  network: { label: "Network", icon: <Network className="w-4 h-4" /> },
  analysis: { label: "Analysis", icon: <BarChart3 className="w-4 h-4" /> },
  inventory: { label: "Inventory", icon: <Package className="w-4 h-4" /> },
  map: { label: "Map", icon: <Map className="w-4 h-4" /> },
};

const groups: TabGroup[] = ["home", "tools", "network", "analysis", "inventory", "map"];

export default function HomePage() {
  // Start with Dashboard as default
  const [activeGroup, setActiveGroup] = useState<TabGroup>("home");
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

  const groupTabs = tabs.filter((t) => t.group === activeGroup);

  const handleGroupChange = (group: TabGroup) => {
    setActiveGroup(group);
    const firstTab = tabs.find((t) => t.group === group);
    if (firstTab) setActiveTab(firstTab.id);
    setMobileMenuOpen(false);
  };

  const handleNavigate = (tab: string) => {
    const tabConfig = tabs.find((t) => t.id === tab);
    if (tabConfig) {
      setActiveGroup(tabConfig.group);
      setActiveTab(tabConfig.id);
    }
  };

  const handleSelectProject = (projectId: number) => {
    setSelectedProjectId(projectId);
  };

  const handleWizardComplete = (projectId: number, nextAction: string) => {
    setSelectedProjectId(projectId);
    setShowWizard(false);

    // Navigate based on what user chose
    switch (nextAction) {
      case "splice":
        handleNavigate("spliceMatrix");
        break;
      case "enclosures":
      case "hierarchy":
        handleNavigate("hierarchy");
        break;
      case "map":
        handleNavigate("networkMap");
        break;
      default:
        handleNavigate("dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => handleNavigate("dashboard")}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div className="text-left">
                <h1 className="text-xl font-bold text-gray-900">NetLink</h1>
                <p className="text-xs text-gray-500 hidden sm:block">OSP Fiber Management</p>
              </div>
            </button>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>

            {/* Desktop: Current location indicator */}
            <div className="hidden md:flex items-center gap-2 text-sm text-gray-500">
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-lg">
                {groupConfig[activeGroup].icon}
                {groupConfig[activeGroup].label}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <nav className="absolute top-[64px] left-0 right-0 bg-white shadow-lg border-t max-h-[calc(100vh-64px)] overflow-y-auto">
            <div className="p-4 space-y-2">
              {groups.map((group) => {
                const isActive = activeGroup === group;
                const groupTabsForMobile = tabs.filter((t) => t.group === group);

                return (
                  <div key={group}>
                    <button
                      onClick={() => handleGroupChange(group)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${
                        isActive
                          ? "bg-blue-600 text-white"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      {groupConfig[group].icon}
                      <span>{groupConfig[group].label}</span>
                    </button>

                    {/* Show sub-tabs for active group */}
                    {isActive && groupTabsForMobile.length > 1 && (
                      <div className="ml-8 mt-2 space-y-1">
                        {groupTabsForMobile.map((tab) => (
                          <button
                            key={tab.id}
                            onClick={() => {
                              setActiveTab(tab.id);
                              setMobileMenuOpen(false);
                            }}
                            className={`w-full text-left px-4 py-2 rounded-lg text-sm transition-colors ${
                              activeTab === tab.id
                                ? "bg-blue-100 text-blue-700 font-medium"
                                : "text-gray-600 hover:bg-gray-50"
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </nav>
        </div>
      )}

      {/* Desktop Group Navigation */}
      <nav className="hidden md:block bg-white border-b sticky top-[64px] z-20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto py-2 scrollbar-hide">
            {groups.map((group) => (
              <button
                key={group}
                onClick={() => handleGroupChange(group)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  activeGroup === group
                    ? "bg-blue-600 text-white shadow-md"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {groupConfig[group].icon}
                <span>{groupConfig[group].label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Tab Navigation (within group) - Desktop only */}
      {groupTabs.length > 1 && (
        <div className="hidden md:block bg-gray-50 border-b sticky top-[120px] z-10">
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex gap-1 overflow-x-auto py-2 scrollbar-hide">
              {groupTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                    activeTab === tab.id
                      ? "bg-white text-blue-600 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Tab Pills (for groups with multiple tabs) */}
      {groupTabs.length > 1 && (
        <div className="md:hidden bg-gray-50 border-b sticky top-[64px] z-10">
          <div className="px-4 py-2">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {groupTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-shrink-0 px-4 py-2.5 rounded-full text-sm font-medium transition-all min-h-[40px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                    activeTab === tab.id
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-600 border border-gray-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main id="main-content" className="max-w-6xl mx-auto px-4 py-6">
        {/* Dashboard */}
        {activeTab === "dashboard" && (
          <Dashboard
            onNavigate={handleNavigate}
            onSelectProject={handleSelectProject}
          />
        )}

        {/* Tools */}
        {activeTab === "lookup" && <FiberLookup />}
        {activeTab === "reverse" && <ReverseLookup />}
        {activeTab === "overview" && <CableOverview />}
        {activeTab === "reference" && <ColorReference />}

        {/* Network - Unified Hierarchy (OLT → Closure → LCP → NAP) */}
        {activeTab === "hierarchy" && selectedProjectId && (
          <UnifiedHierarchyBrowser projectId={selectedProjectId} />
        )}
        {activeTab === "hierarchy" && !selectedProjectId && (
          <div className="text-center py-12 bg-white rounded-2xl shadow-lg">
            <Network className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-700 mb-2">Select a Project First</h3>
            <p className="text-gray-500 mb-4">
              Please select a project from the Dashboard to browse network hierarchy
            </p>
            <button
              onClick={() => handleNavigate("dashboard")}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Go to Dashboard
            </button>
          </div>
        )}

        {/* Network - Topology Canvas View */}
        {activeTab === "topology" && selectedProjectId && (
          <TopologyCanvas projectId={selectedProjectId} />
        )}
        {activeTab === "topology" && !selectedProjectId && (
          <div className="text-center py-12 bg-white rounded-2xl shadow-lg">
            <Network className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-700 mb-2">Select a Project First</h3>
            <p className="text-gray-500 mb-4">
              Please select a project from the Dashboard to view network topology
            </p>
            <button
              onClick={() => handleNavigate("dashboard")}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Go to Dashboard
            </button>
          </div>
        )}

        {/* Network - Splice Matrix */}
        {activeTab === "spliceMatrix" && <SpliceMatrix />}

        {/* Analysis */}
        {activeTab === "lossBudget" && <LossBudgetCalculator />}
        {activeTab === "otdr" && <OtdrViewer />}

        {/* Inventory */}
        {activeTab === "stock" && <InventoryList />}

        {/* Map */}
        {activeTab === "networkMap" && <NetworkMap />}
      </main>

      {/* Project Wizard Modal */}
      {showWizard && (
        <ProjectWizard
          onComplete={handleWizardComplete}
          onCancel={() => setShowWizard(false)}
        />
      )}

      {/* Footer */}
      <footer className="bg-white border-t mt-8">
        <div className="max-w-6xl mx-auto px-4 py-4 text-center text-sm text-gray-500">
          NetLink OSP Fiber Management Tool
        </div>
      </footer>
    </div>
  );
}
