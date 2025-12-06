"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import type { Project, OLT, Enclosure, ODF } from "@/types";

interface NetworkContextValue {
  // Selection state
  projectId: number | null;
  oltId: number | null;
  enclosureId: number | null;

  // Actions
  selectProject: (id: number | null) => void;
  clearProject: () => void;
  selectOLT: (id: number | null) => void;
  selectEnclosure: (id: number | null) => void;

  // Derived data (cached via useLiveQuery)
  project: Project | undefined;
  projects: Project[];
  olts: OLT[];
  odfs: ODF[];
  enclosures: Enclosure[];

  // Loading states
  isLoading: boolean;
}

const NetworkContext = createContext<NetworkContextValue | null>(null);

const STORAGE_KEYS = {
  projectId: "netlink:projectId",
  oltId: "netlink:oltId",
  enclosureId: "netlink:enclosureId",
} as const;

function getStoredValue(key: string): number | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(key);
  return stored ? parseInt(stored, 10) : null;
}

function setStoredValue(key: string, value: number | null) {
  if (typeof window === "undefined") return;
  if (value !== null) {
    localStorage.setItem(key, String(value));
  } else {
    localStorage.removeItem(key);
  }
}

export function NetworkProvider({ children }: { children: ReactNode }) {
  // Initialize state from localStorage
  const [projectId, setProjectId] = useState<number | null>(null);
  const [oltId, setOltId] = useState<number | null>(null);
  const [enclosureId, setEnclosureId] = useState<number | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate from localStorage on mount (client-side only)
  useEffect(() => {
    setProjectId(getStoredValue(STORAGE_KEYS.projectId));
    setOltId(getStoredValue(STORAGE_KEYS.oltId));
    setEnclosureId(getStoredValue(STORAGE_KEYS.enclosureId));
    setIsHydrated(true);
  }, []);

  // Persist selections to localStorage
  useEffect(() => {
    if (!isHydrated) return;
    setStoredValue(STORAGE_KEYS.projectId, projectId);
  }, [projectId, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    setStoredValue(STORAGE_KEYS.oltId, oltId);
  }, [oltId, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    setStoredValue(STORAGE_KEYS.enclosureId, enclosureId);
  }, [enclosureId, isHydrated]);

  // Fetch all projects (for selectors)
  const projects = useLiveQuery(
    () => db.projects.orderBy("createdAt").reverse().toArray(),
    []
  ) || [];

  // Fetch current project
  const project = useLiveQuery(
    () => (projectId ? db.projects.get(projectId) : undefined),
    [projectId]
  );

  // Fetch OLTs for current project
  const olts = useLiveQuery(
    () => (projectId ? db.olts.where("projectId").equals(projectId).toArray() : []),
    [projectId]
  ) || [];

  // Fetch ODFs for current project
  const odfs = useLiveQuery(
    () => (projectId ? db.odfs.where("projectId").equals(projectId).toArray() : []),
    [projectId]
  ) || [];

  // Fetch enclosures for current project
  const enclosures = useLiveQuery(
    () => (projectId ? db.enclosures.where("projectId").equals(projectId).toArray() : []),
    [projectId]
  ) || [];

  // Actions with automatic child clearing
  const selectProject = useCallback((id: number | null) => {
    setProjectId(id);
    setOltId(null);
    setEnclosureId(null);
  }, []);

  const clearProject = useCallback(() => {
    setProjectId(null);
    setOltId(null);
    setEnclosureId(null);
  }, []);

  const selectOLT = useCallback((id: number | null) => {
    setOltId(id);
    setEnclosureId(null);
  }, []);

  const selectEnclosure = useCallback((id: number | null) => {
    setEnclosureId(id);
  }, []);

  // Validate that selected project still exists
  useEffect(() => {
    if (isHydrated && projectId && projects.length > 0) {
      const exists = projects.some((p) => p.id === projectId);
      if (!exists) {
        // Project was deleted, clear selection
        selectProject(null);
      }
    }
  }, [projects, projectId, isHydrated, selectProject]);

  const value: NetworkContextValue = {
    projectId,
    oltId,
    enclosureId,
    selectProject,
    clearProject,
    selectOLT,
    selectEnclosure,
    project,
    projects,
    olts,
    odfs,
    enclosures,
    isLoading: !isHydrated,
  };

  return (
    <NetworkContext.Provider value={value}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  const ctx = useContext(NetworkContext);
  if (!ctx) {
    throw new Error("useNetwork must be used within a NetworkProvider");
  }
  return ctx;
}

// Convenience hooks for specific data
export function useProject() {
  const { project, projectId, selectProject, isLoading } = useNetwork();
  return { project, projectId, selectProject, isLoading };
}

export function useProjects() {
  const { projects } = useNetwork();
  return projects;
}

export function useOLTs() {
  const { olts, oltId, selectOLT } = useNetwork();
  return { olts, oltId, selectOLT };
}

export function useEnclosures() {
  const { enclosures, enclosureId, selectEnclosure } = useNetwork();
  return { enclosures, enclosureId, selectEnclosure };
}
