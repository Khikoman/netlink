"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import {
  Wrench,
  Link2,
  BarChart3,
  Package,
  Map,
  Menu,
  X,
  Zap,
} from "lucide-react";
import { CardSkeleton } from "@/components/ui";

// Fiber Tools (existing)
import FiberLookup from "@/components/fiber/FiberLookup";
import ReverseLookup from "@/components/fiber/ReverseLookup";
import CableOverview from "@/components/fiber/CableOverview";
import ColorReference from "@/components/fiber/ColorReference";

// Dynamically import heavy components to reduce initial bundle
const SpliceMatrix = dynamic(() => import("@/components/splice/SpliceMatrix"), {
  loading: () => <CardSkeleton />,
});
const EnclosureManager = dynamic(() => import("@/components/splice/EnclosureManager"), {
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

const groupConfig: Record<TabGroup, { label: string; icon: React.ReactNode }> = {
  tools: { label: "Tools", icon: <Wrench className="w-4 h-4" /> },
  splice: { label: "Splice", icon: <Link2 className="w-4 h-4" /> },
  analysis: { label: "Analysis", icon: <BarChart3 className="w-4 h-4" /> },
  inventory: { label: "Inventory", icon: <Package className="w-4 h-4" /> },
  map: { label: "Map", icon: <Map className="w-4 h-4" /> },
};

const groups: TabGroup[] = ["tools", "splice", "analysis", "inventory", "map"];

export default function Home() {
  const [activeGroup, setActiveGroup] = useState<TabGroup>("tools");
  const [activeTab, setActiveTab] = useState<Tab>("lookup");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const groupTabs = tabs.filter((t) => t.group === activeGroup);

  const handleGroupChange = (group: TabGroup) => {
    setActiveGroup(group);
    const firstTab = tabs.find((t) => t.group === group);
    if (firstTab) setActiveTab(firstTab.id);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">NetLink</h1>
                <p className="text-xs text-gray-500 hidden sm:block">OSP Fiber Management</p>
              </div>
            </div>

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
          <nav className="absolute top-[64px] left-0 right-0 bg-white shadow-lg border-t">
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
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
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

      {/* Mobile Tab Pills (for groups with multiple tabs) */}
      {groupTabs.length > 1 && (
        <div className="md:hidden bg-gray-50 border-b sticky top-[64px] z-10">
          <div className="px-4 py-2">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {groupTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
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
