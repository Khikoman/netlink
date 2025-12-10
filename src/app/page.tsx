"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import {
  Package,
  Map,
  Menu,
  X,
  Zap,
  Network,
  ChevronLeft,
  Calculator,
  Palette,
  Search,
  Activity,
  FolderOpen,
} from "lucide-react";
import { CardSkeleton } from "@/components/ui";
import { NetworkProvider, useNetwork } from "@/contexts/NetworkContext";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";

// Fiber Tools (existing)
import FiberLookup from "@/components/fiber/FiberLookup";
import ReverseLookup from "@/components/fiber/ReverseLookup";
import CableOverview from "@/components/fiber/CableOverview";
import ColorReference from "@/components/fiber/ColorReference";

// Dashboard
import Dashboard from "@/components/Dashboard";

// Dynamically import heavy components to reduce initial bundle
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
const TopologyCanvas = dynamic(() => import("@/components/topology/TopologyCanvas"), {
  loading: () => <CardSkeleton />,
  ssr: false, // React Flow requires client-side rendering
});

// Tool types for the sidebar
type Tool =
  | "canvas"
  | "lookup"
  | "reverse"
  | "overview"
  | "reference"
  | "lossBudget"
  | "otdr"
  | "stock"
  | "networkMap";

interface ToolConfig {
  id: Tool;
  label: string;
  icon: React.ReactNode;
  category: "network" | "tools" | "analysis" | "other";
}

const tools: ToolConfig[] = [
  { id: "canvas", label: "Topology", icon: <Network className="w-5 h-5" />, category: "network" },
  { id: "lookup", label: "Fiber Lookup", icon: <Search className="w-5 h-5" />, category: "tools" },
  { id: "reverse", label: "Color to #", icon: <Palette className="w-5 h-5" />, category: "tools" },
  { id: "reference", label: "Color Chart", icon: <Palette className="w-5 h-5" />, category: "tools" },
  { id: "lossBudget", label: "Loss Budget", icon: <Calculator className="w-5 h-5" />, category: "analysis" },
  { id: "otdr", label: "OTDR Viewer", icon: <Activity className="w-5 h-5" />, category: "analysis" },
  { id: "stock", label: "Inventory", icon: <Package className="w-5 h-5" />, category: "other" },
  { id: "networkMap", label: "Network Map", icon: <Map className="w-5 h-5" />, category: "other" },
];

// Inner component that uses the context
function HomePageContent() {
  const { projectId, selectProject, clearProject } = useNetwork();
  const [activeTool, setActiveTool] = useState<Tool>("canvas");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Get current project info
  const currentProject = useLiveQuery(
    () => (projectId ? db.projects.get(projectId) : undefined),
    [projectId]
  );

  // Handle navigation from Dashboard
  const handleNavigate = (tab: string) => {
    if (tab === "dashboard") {
      clearProject();
    } else if (tab === "topology") {
      setActiveTool("canvas");
    } else {
      setActiveTool(tab as Tool);
    }
  };

  // If no project selected, show Dashboard
  if (!projectId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-blue-50">
        {/* Minimal Header for Dashboard */}
        <header className="bg-white shadow-sm sticky top-0 z-30">
          <div className="max-w-6xl mx-auto px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div className="text-left">
                <h1 className="text-xl font-bold text-gray-900">NetLink</h1>
                <p className="text-xs text-gray-500">OSP Fiber Management</p>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 py-6">
          <Dashboard onNavigate={handleNavigate} />
        </main>
      </div>
    );
  }

  // Project is selected - Canvas-centric layout
  return (
    <div className="h-screen flex flex-col bg-gray-100 overflow-hidden">
      {/* Top Header Bar */}
      <header className="bg-white border-b px-4 py-2 flex items-center justify-between flex-shrink-0 z-30">
        <div className="flex items-center gap-4">
          {/* Back to Dashboard */}
          <button
            onClick={() => clearProject()}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline text-sm">Projects</span>
          </button>

          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900 hidden sm:inline">NetLink</span>
          </div>
        </div>

        {/* Current Project */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg">
            <FolderOpen className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-700 max-w-[200px] truncate">
              {currentProject?.name || "Loading..."}
            </span>
          </div>

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop Sidebar */}
        <aside
          className={`
            hidden md:flex flex-col bg-white border-r transition-all duration-300
            ${sidebarOpen ? "w-56" : "w-14"}
          `}
        >
          {/* Toggle button */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-3 border-b hover:bg-gray-50 flex items-center justify-center"
            title={sidebarOpen ? "Collapse" : "Expand"}
          >
            <ChevronLeft className={`w-5 h-5 text-gray-400 transition-transform ${sidebarOpen ? "" : "rotate-180"}`} />
          </button>

          {/* Tool buttons */}
          <nav className="flex-1 overflow-y-auto py-2">
            {/* Network Tools */}
            {sidebarOpen && (
              <div className="px-3 py-2 text-xs font-medium text-gray-400 uppercase tracking-wide">
                Network
              </div>
            )}
            {tools.filter(t => t.category === "network").map((tool) => (
              <button
                key={tool.id}
                onClick={() => setActiveTool(tool.id)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 transition-colors
                  ${activeTool === tool.id
                    ? "bg-blue-50 text-blue-600 border-r-2 border-blue-600"
                    : "text-gray-600 hover:bg-gray-50"
                  }
                `}
                title={!sidebarOpen ? tool.label : undefined}
              >
                {tool.icon}
                {sidebarOpen && <span className="text-sm font-medium">{tool.label}</span>}
              </button>
            ))}

            {/* Quick Tools */}
            {sidebarOpen && (
              <div className="px-3 py-2 mt-4 text-xs font-medium text-gray-400 uppercase tracking-wide">
                Quick Tools
              </div>
            )}
            {tools.filter(t => t.category === "tools").map((tool) => (
              <button
                key={tool.id}
                onClick={() => setActiveTool(tool.id)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 transition-colors
                  ${activeTool === tool.id
                    ? "bg-blue-50 text-blue-600 border-r-2 border-blue-600"
                    : "text-gray-600 hover:bg-gray-50"
                  }
                `}
                title={!sidebarOpen ? tool.label : undefined}
              >
                {tool.icon}
                {sidebarOpen && <span className="text-sm font-medium">{tool.label}</span>}
              </button>
            ))}

            {/* Analysis */}
            {sidebarOpen && (
              <div className="px-3 py-2 mt-4 text-xs font-medium text-gray-400 uppercase tracking-wide">
                Analysis
              </div>
            )}
            {tools.filter(t => t.category === "analysis").map((tool) => (
              <button
                key={tool.id}
                onClick={() => setActiveTool(tool.id)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 transition-colors
                  ${activeTool === tool.id
                    ? "bg-blue-50 text-blue-600 border-r-2 border-blue-600"
                    : "text-gray-600 hover:bg-gray-50"
                  }
                `}
                title={!sidebarOpen ? tool.label : undefined}
              >
                {tool.icon}
                {sidebarOpen && <span className="text-sm font-medium">{tool.label}</span>}
              </button>
            ))}

            {/* Other */}
            {sidebarOpen && (
              <div className="px-3 py-2 mt-4 text-xs font-medium text-gray-400 uppercase tracking-wide">
                Other
              </div>
            )}
            {tools.filter(t => t.category === "other").map((tool) => (
              <button
                key={tool.id}
                onClick={() => setActiveTool(tool.id)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 transition-colors
                  ${activeTool === tool.id
                    ? "bg-blue-50 text-blue-600 border-r-2 border-blue-600"
                    : "text-gray-600 hover:bg-gray-50"
                  }
                `}
                title={!sidebarOpen ? tool.label : undefined}
              >
                {tool.icon}
                {sidebarOpen && <span className="text-sm font-medium">{tool.label}</span>}
              </button>
            ))}
          </nav>
        </aside>

        {/* Mobile Bottom Navigation Overlay */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setMobileMenuOpen(false)}
            />
            <nav className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl max-h-[70vh] overflow-y-auto">
              <div className="p-4 space-y-2">
                <div className="text-center text-xs text-gray-400 font-medium mb-4">
                  Select a tool
                </div>
                {tools.map((tool) => (
                  <button
                    key={tool.id}
                    onClick={() => {
                      setActiveTool(tool.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`
                      w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors
                      ${activeTool === tool.id
                        ? "bg-blue-600 text-white"
                        : "text-gray-700 hover:bg-gray-100"
                      }
                    `}
                  >
                    {tool.icon}
                    <span className="font-medium">{tool.label}</span>
                  </button>
                ))}
              </div>
            </nav>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto">
          {/* Topology Canvas - Full height */}
          {activeTool === "canvas" && (
            <div className="h-full">
              <TopologyCanvas projectId={projectId} />
            </div>
          )}

          {/* Other tools - with padding */}
          {activeTool !== "canvas" && (
            <div className="p-4 md:p-6 max-w-6xl mx-auto">
              {activeTool === "lookup" && <FiberLookup />}
              {activeTool === "reverse" && <ReverseLookup />}
              {activeTool === "overview" && <CableOverview />}
              {activeTool === "reference" && <ColorReference />}
              {activeTool === "lossBudget" && <LossBudgetCalculator />}
              {activeTool === "otdr" && <OtdrViewer />}
              {activeTool === "stock" && <InventoryList />}
              {activeTool === "networkMap" && <NetworkMap />}
            </div>
          )}
        </main>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <nav className="md:hidden bg-white border-t flex items-center justify-around py-2 flex-shrink-0">
        <button
          onClick={() => setActiveTool("canvas")}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 ${
            activeTool === "canvas" ? "text-blue-600" : "text-gray-500"
          }`}
        >
          <Network className="w-5 h-5" />
          <span className="text-[10px]">Topology</span>
        </button>
        <button
          onClick={() => setActiveTool("lookup")}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 ${
            activeTool === "lookup" ? "text-blue-600" : "text-gray-500"
          }`}
        >
          <Search className="w-5 h-5" />
          <span className="text-[10px]">Fiber</span>
        </button>
        <button
          onClick={() => setActiveTool("stock")}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 ${
            activeTool === "stock" ? "text-blue-600" : "text-gray-500"
          }`}
        >
          <Package className="w-5 h-5" />
          <span className="text-[10px]">Inventory</span>
        </button>
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="flex flex-col items-center gap-0.5 px-3 py-1 text-gray-500"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px]">More</span>
        </button>
      </nav>
    </div>
  );
}

// Wrap the entire app with NetworkProvider
export default function HomePage() {
  return (
    <NetworkProvider>
      <HomePageContent />
    </NetworkProvider>
  );
}
