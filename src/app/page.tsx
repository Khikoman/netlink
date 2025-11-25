"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

// Fiber Tools (existing)
import FiberLookup from "@/components/fiber/FiberLookup";
import ReverseLookup from "@/components/fiber/ReverseLookup";
import CableOverview from "@/components/fiber/CableOverview";
import ColorReference from "@/components/fiber/ColorReference";

// Dynamically import heavy components to reduce initial bundle
const SpliceMatrix = dynamic(() => import("@/components/splice/SpliceMatrix"), {
  loading: () => <LoadingCard />,
});
const EnclosureManager = dynamic(() => import("@/components/splice/EnclosureManager"), {
  loading: () => <LoadingCard />,
});
const LossBudgetCalculator = dynamic(() => import("@/components/analysis/LossBudgetCalculator"), {
  loading: () => <LoadingCard />,
});
const InventoryList = dynamic(() => import("@/components/inventory/InventoryList"), {
  loading: () => <LoadingCard />,
});
const OtdrViewer = dynamic(() => import("@/components/analysis/OtdrViewer"), {
  loading: () => <LoadingCard />,
});
const NetworkMap = dynamic(() => import("@/components/map/NetworkMap"), {
  loading: () => <LoadingCard />,
  ssr: false, // Konva doesn't work with SSR
});

function LoadingCard() {
  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 animate-pulse">
      <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
      <div className="space-y-3">
        <div className="h-4 bg-gray-200 rounded"></div>
        <div className="h-4 bg-gray-200 rounded w-5/6"></div>
        <div className="h-4 bg-gray-200 rounded w-4/6"></div>
      </div>
    </div>
  );
}

// Navigation structure
type TabGroup = "tools" | "splice" | "analysis" | "inventory" | "map";
type Tab =
  | "lookup"
  | "reverse"
  | "overview"
  | "reference"
  | "matrix"
  | "enclosures"
  | "lossBudget"
  | "otdr"
  | "stock"
  | "network";

interface TabConfig {
  id: Tab;
  label: string;
  group: TabGroup;
}

const tabs: TabConfig[] = [
  // Tools group
  { id: "lookup", label: "Fiber Lookup", group: "tools" },
  { id: "reverse", label: "Color to #", group: "tools" },
  { id: "overview", label: "Cable View", group: "tools" },
  { id: "reference", label: "Reference", group: "tools" },
  // Splice group
  { id: "matrix", label: "Splice Matrix", group: "splice" },
  { id: "enclosures", label: "Enclosures", group: "splice" },
  // Analysis group
  { id: "lossBudget", label: "Loss Budget", group: "analysis" },
  { id: "otdr", label: "OTDR Viewer", group: "analysis" },
  // Inventory group
  { id: "stock", label: "Inventory", group: "inventory" },
  // Map group
  { id: "network", label: "Network Map", group: "map" },
];

const groupLabels: Record<TabGroup, { label: string; icon: string }> = {
  tools: { label: "Tools", icon: "🔧" },
  splice: { label: "Splice", icon: "🔗" },
  analysis: { label: "Analysis", icon: "📊" },
  inventory: { label: "Inventory", icon: "📦" },
  map: { label: "Map", icon: "🗺️" },
};

const groups: TabGroup[] = ["tools", "splice", "analysis", "inventory", "map"];

export default function Home() {
  const [activeGroup, setActiveGroup] = useState<TabGroup>("tools");
  const [activeTab, setActiveTab] = useState<Tab>("lookup");

  const groupTabs = tabs.filter((t) => t.group === activeGroup);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">NetLink</h1>
                <p className="text-xs text-gray-500">OSP Fiber Management</p>
              </div>
            </div>
            {/* Offline indicator could go here */}
          </div>
        </div>
      </header>

      {/* Group Navigation */}
      <nav className="bg-white border-b sticky top-[64px] z-10">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto py-2 scrollbar-hide">
            {groups.map((group) => (
              <button
                key={group}
                onClick={() => {
                  setActiveGroup(group);
                  // Set first tab in group as active
                  const firstTab = tabs.find((t) => t.group === group);
                  if (firstTab) setActiveTab(firstTab.id);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                  activeGroup === group
                    ? "bg-blue-600 text-white shadow-md"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <span>{groupLabels[group].icon}</span>
                <span>{groupLabels[group].label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Tab Navigation (within group) */}
      {groupTabs.length > 1 && (
        <div className="bg-gray-50 border-b sticky top-[120px] z-10">
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex gap-1 overflow-x-auto py-2 scrollbar-hide">
              {groupTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-all ${
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

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Tools */}
        {activeTab === "lookup" && <FiberLookup />}
        {activeTab === "reverse" && <ReverseLookup />}
        {activeTab === "overview" && <CableOverview />}
        {activeTab === "reference" && <ColorReference />}

        {/* Splice */}
        {activeTab === "matrix" && <SpliceMatrix />}
        {activeTab === "enclosures" && <EnclosureManager />}

        {/* Analysis */}
        {activeTab === "lossBudget" && <LossBudgetCalculator />}
        {activeTab === "otdr" && <OtdrViewer />}

        {/* Inventory */}
        {activeTab === "stock" && <InventoryList />}

        {/* Map */}
        {activeTab === "network" && <NetworkMap />}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-8">
        <div className="max-w-6xl mx-auto px-4 py-4 text-center text-sm text-gray-500">
          NetLink OSP Fiber Management Tool
        </div>
      </footer>
    </div>
  );
}
