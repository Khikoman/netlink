import { useLiveQuery } from "dexie-react-hooks";
import {
  db,
  getOLTHierarchyStats,
  getLCPHierarchyStats,
  getNAPStats,
  getClosuresByOLT,
  getLCPsByClosure,
  getClosureHierarchyStats,
  getClosureContents,
  getClosuresByODF,
} from "./index";
import type {
  Project,
  Enclosure,
  Tray,
  Cable,
  Splice,
  InventoryItem,
  LossBudgetResult,
  MapNode,
  MapRoute,
  OLT,
  OLTPonPort,
  ODF,
  ODFPort,
} from "@/types";

// ============================================
// PROJECT HOOKS
// ============================================

export function useProjects() {
  return useLiveQuery(() => db.projects.orderBy("createdAt").reverse().toArray(), []);
}

export function useProject(id: number | undefined) {
  return useLiveQuery(() => (id ? db.projects.get(id) : undefined), [id]);
}

export function useActiveProjects() {
  return useLiveQuery(
    () => db.projects.where("status").equals("active").toArray(),
    []
  );
}

// ============================================
// ENCLOSURE HOOKS
// ============================================

export function useEnclosures(projectId: number | undefined) {
  return useLiveQuery(
    () => (projectId ? db.enclosures.where("projectId").equals(projectId).toArray() : []),
    [projectId]
  );
}

export function useEnclosure(id: number | undefined) {
  return useLiveQuery(() => (id ? db.enclosures.get(id) : undefined), [id]);
}

export function useAllEnclosures() {
  return useLiveQuery(() => db.enclosures.toArray(), []);
}

// ============================================
// TRAY HOOKS
// ============================================

export function useTrays(enclosureId: number | undefined) {
  return useLiveQuery(
    () =>
      enclosureId
        ? db.trays.where("enclosureId").equals(enclosureId).sortBy("number")
        : [],
    [enclosureId]
  );
}

export function useTray(id: number | undefined) {
  return useLiveQuery(() => (id ? db.trays.get(id) : undefined), [id]);
}

// ============================================
// CABLE HOOKS
// ============================================

export function useCables(projectId?: number) {
  return useLiveQuery(
    () =>
      projectId
        ? db.cables.where("projectId").equals(projectId).toArray()
        : db.cables.toArray(),
    [projectId]
  );
}

export function useCable(id: number | undefined) {
  return useLiveQuery(() => (id ? db.cables.get(id) : undefined), [id]);
}

// ============================================
// SPLICE HOOKS
// ============================================

export function useSplices(trayId: number | undefined) {
  return useLiveQuery(
    () => (trayId ? db.splices.where("trayId").equals(trayId).toArray() : []),
    [trayId]
  );
}

export function useSplicesByCable(cableId: number | undefined) {
  return useLiveQuery(async () => {
    if (!cableId) return [];
    const asA = await db.splices.where("cableAId").equals(cableId).toArray();
    const asB = await db.splices.where("cableBId").equals(cableId).toArray();
    // Deduplicate by id
    const map = new Map<number, Splice>();
    [...asA, ...asB].forEach((s) => {
      if (s.id) map.set(s.id, s);
    });
    return Array.from(map.values());
  }, [cableId]);
}

export function useSplice(id: number | undefined) {
  return useLiveQuery(() => (id ? db.splices.get(id) : undefined), [id]);
}

export function useSpliceStats(trayId: number | undefined) {
  return useLiveQuery(async () => {
    if (!trayId) return null;
    const splices = await db.splices.where("trayId").equals(trayId).toArray();
    const total = splices.length;
    const completed = splices.filter((s) => s.status === "completed").length;
    const pending = splices.filter((s) => s.status === "pending").length;
    const needsReview = splices.filter((s) => s.status === "needs-review").length;
    const failed = splices.filter((s) => s.status === "failed").length;
    const avgLoss =
      splices.filter((s) => s.loss !== undefined).reduce((sum, s) => sum + (s.loss || 0), 0) /
        (splices.filter((s) => s.loss !== undefined).length || 1);
    return { total, completed, pending, needsReview, failed, avgLoss };
  }, [trayId]);
}

// ============================================
// INVENTORY HOOKS
// ============================================

export function useInventory(category?: string) {
  return useLiveQuery(
    () =>
      category
        ? db.inventory.where("category").equals(category).toArray()
        : db.inventory.toArray(),
    [category]
  );
}

export function useInventoryItem(id: number | undefined) {
  return useLiveQuery(() => (id ? db.inventory.get(id) : undefined), [id]);
}

export function useLowStockItems() {
  return useLiveQuery(async () => {
    const items = await db.inventory.toArray();
    return items.filter((item) => item.quantity <= item.minStock);
  }, []);
}

export function useInventoryUsage(projectId: number | undefined) {
  return useLiveQuery(
    () =>
      projectId
        ? db.inventoryUsage.where("projectId").equals(projectId).toArray()
        : [],
    [projectId]
  );
}

// ============================================
// LOSS BUDGET HOOKS
// ============================================

export function useLossBudgets() {
  return useLiveQuery(() => db.lossBudgets.orderBy("createdAt").reverse().toArray(), []);
}

export function useLossBudget(id: number | undefined) {
  return useLiveQuery(() => (id ? db.lossBudgets.get(id) : undefined), [id]);
}

// ============================================
// MAP HOOKS
// ============================================

export function useMapNodes(projectId: number | undefined) {
  return useLiveQuery(
    () => (projectId ? db.mapNodes.where("projectId").equals(projectId).toArray() : []),
    [projectId]
  );
}

export function useMapRoutes(projectId: number | undefined) {
  return useLiveQuery(
    () => (projectId ? db.mapRoutes.where("projectId").equals(projectId).toArray() : []),
    [projectId]
  );
}

export function useNetworkMap(projectId: number | undefined) {
  return useLiveQuery(async () => {
    if (!projectId) return { nodes: [], routes: [] };
    const nodes = await db.mapNodes.where("projectId").equals(projectId).toArray();
    const routes = await db.mapRoutes.where("projectId").equals(projectId).toArray();
    return { nodes, routes };
  }, [projectId]);
}

// ============================================
// OLT HOOKS
// ============================================

export function useOLTs(projectId: number | undefined) {
  return useLiveQuery(
    () => (projectId ? db.olts.where("projectId").equals(projectId).toArray() : []),
    [projectId]
  );
}

export function useOLT(id: number | undefined) {
  return useLiveQuery(() => (id ? db.olts.get(id) : undefined), [id]);
}

export function useOLTPonPorts(oltId: number | undefined) {
  return useLiveQuery(
    async () => {
      if (!oltId) return [];
      const ports = await db.oltPonPorts.where("oltId").equals(oltId).toArray();
      return ports.sort((a, b) => a.portNumber - b.portNumber);
    },
    [oltId]
  );
}

export function useOLTPonPort(id: number | undefined) {
  return useLiveQuery(() => (id ? db.oltPonPorts.get(id) : undefined), [id]);
}

// ============================================
// ODF HOOKS
// ============================================

export function useODFs(projectId: number | undefined) {
  return useLiveQuery(
    () => (projectId ? db.odfs.where("projectId").equals(projectId).toArray() : []),
    [projectId]
  );
}

export function useODFsByOLT(oltId: number | undefined) {
  return useLiveQuery(
    () => (oltId ? db.odfs.where("oltId").equals(oltId).toArray() : []),
    [oltId]
  );
}

export function useODF(id: number | undefined) {
  return useLiveQuery(() => (id ? db.odfs.get(id) : undefined), [id]);
}

export function useODFPorts(odfId: number | undefined) {
  return useLiveQuery(
    async () => {
      if (!odfId) return [];
      const ports = await db.odfPorts.where("odfId").equals(odfId).toArray();
      return ports.sort((a, b) => a.portNumber - b.portNumber);
    },
    [odfId]
  );
}

export function useODFPort(id: number | undefined) {
  return useLiveQuery(() => (id ? db.odfPorts.get(id) : undefined), [id]);
}

export function useODFPortStats(odfId: number | undefined) {
  return useLiveQuery(
    async () => {
      if (!odfId) return null;
      const ports = await db.odfPorts.where("odfId").equals(odfId).toArray();
      return {
        total: ports.length,
        available: ports.filter((p) => p.status === "available").length,
        connected: ports.filter((p) => p.status === "connected").length,
        reserved: ports.filter((p) => p.status === "reserved").length,
        faulty: ports.filter((p) => p.status === "faulty").length,
      };
    },
    [odfId]
  );
}

/**
 * Get closures connected to an ODF via ODF ports
 */
export function useClosuresByODF(odfId: number | undefined) {
  return useLiveQuery(
    async () => {
      if (!odfId) return [];
      return getClosuresByODF(odfId);
    },
    [odfId]
  );
}

// ============================================
// HIERARCHY HOOKS
// ============================================

export function useLCPsByOLT(oltId: number | undefined) {
  return useLiveQuery(
    async () => {
      if (!oltId) return [];
      return db.enclosures
        .where("parentId")
        .equals(oltId)
        .filter((e) => e.parentType === "olt" && (e.type === "lcp" || e.type === "fdt"))
        .toArray();
    },
    [oltId]
  );
}

export function useNAPsByLCP(lcpId: number | undefined) {
  return useLiveQuery(
    async () => {
      if (!lcpId) return [];
      return db.enclosures
        .where("parentId")
        .equals(lcpId)
        .filter((e) => e.parentType === "lcp" && (e.type === "nap" || e.type === "fat"))
        .toArray();
    },
    [lcpId]
  );
}

export function useOrphanedLCPs(projectId: number | undefined) {
  return useLiveQuery(
    async () => {
      if (!projectId) return [];
      return db.enclosures
        .where("projectId")
        .equals(projectId)
        .filter((e) => (e.type === "lcp" || e.type === "fdt") && !e.parentId)
        .toArray();
    },
    [projectId]
  );
}

export function useOrphanedNAPs(projectId: number | undefined) {
  return useLiveQuery(
    async () => {
      if (!projectId) return [];
      return db.enclosures
        .where("projectId")
        .equals(projectId)
        .filter((e) => (e.type === "nap" || e.type === "fat") && !e.parentId)
        .toArray();
    },
    [projectId]
  );
}

export function useOLTHierarchyStats(oltId: number | undefined) {
  return useLiveQuery(
    async () => {
      if (!oltId) return null;
      return getOLTHierarchyStats(oltId);
    },
    [oltId]
  );
}

export function useLCPHierarchyStats(lcpId: number | undefined) {
  return useLiveQuery(
    async () => {
      if (!lcpId) return null;
      return getLCPHierarchyStats(lcpId);
    },
    [lcpId]
  );
}

export function useNAPPortStats(napId: number | undefined) {
  return useLiveQuery(
    async () => {
      if (!napId) return null;
      return getNAPStats(napId);
    },
    [napId]
  );
}

// ============================================
// CLOSURE HIERARCHY HOOKS (OLT → Closure → LCP → NAP)
// ============================================

/**
 * Get closures under an OLT
 */
export function useClosuresByOLT(oltId: number | undefined) {
  return useLiveQuery(
    async () => {
      if (!oltId) return [];
      return getClosuresByOLT(oltId);
    },
    [oltId]
  );
}

/**
 * Get LCPs under a closure
 */
export function useLCPsByClosure(closureId: number | undefined) {
  return useLiveQuery(
    async () => {
      if (!closureId) return [];
      return getLCPsByClosure(closureId);
    },
    [closureId]
  );
}

/**
 * Get hierarchy stats for a closure
 */
export function useClosureHierarchyStats(closureId: number | undefined) {
  return useLiveQuery(
    async () => {
      if (!closureId) return null;
      return getClosureHierarchyStats(closureId);
    },
    [closureId]
  );
}

/**
 * Get closure contents (trays and splitters)
 */
export function useClosureContents(closureId: number | undefined) {
  return useLiveQuery(
    async () => {
      if (!closureId) return { trays: [], splitters: [] };
      return getClosureContents(closureId);
    },
    [closureId]
  );
}

/**
 * Get orphaned closures (no parent OLT)
 */
export function useOrphanedClosures(projectId: number | undefined) {
  return useLiveQuery(
    async () => {
      if (!projectId) return [];
      return db.enclosures
        .where("projectId")
        .equals(projectId)
        .filter((e) => e.type === "splice-closure" && !e.parentId)
        .toArray();
    },
    [projectId]
  );
}

// ============================================
// SYNC HOOKS
// ============================================

export function usePendingSyncCount() {
  return useLiveQuery(async () => {
    return db.syncQueue.filter(item => !item.synced).count();
  }, []);
}

// ============================================
// SPLITTER HOOKS
// ============================================

export function useSplitters(enclosureId: number | undefined) {
  return useLiveQuery(
    () => enclosureId ? db.splitters.where("enclosureId").equals(enclosureId).toArray() : [],
    [enclosureId]
  );
}

export function useSplitter(id: number | undefined) {
  return useLiveQuery(() => id ? db.splitters.get(id) : undefined, [id]);
}

// ============================================
// PORT HOOKS
// ============================================

export function usePorts(enclosureId: number | undefined) {
  return useLiveQuery(
    () => enclosureId ? db.ports.where("enclosureId").equals(enclosureId).toArray() : [],
    [enclosureId]
  );
}

export function usePort(id: number | undefined) {
  return useLiveQuery(() => id ? db.ports.get(id) : undefined, [id]);
}

export function usePortsBySplitter(splitterId: number | undefined) {
  return useLiveQuery(
    () => splitterId ? db.ports.where("splitterId").equals(splitterId).toArray() : [],
    [splitterId]
  );
}

// ============================================
// CUSTOMER ATTACHMENT HOOKS
// ============================================

export function useAttachmentsByPort(portId: number | undefined) {
  return useLiveQuery(
    () => portId ? db.customerAttachments.where("portId").equals(portId).toArray() : [],
    [portId]
  );
}

export function useAttachmentsByProject(projectId: number | undefined) {
  return useLiveQuery(
    () => projectId ? db.customerAttachments.where("projectId").equals(projectId).toArray() : [],
    [projectId]
  );
}

export function useAttachment(id: number | undefined) {
  return useLiveQuery(() => id ? db.customerAttachments.get(id) : undefined, [id]);
}

// ============================================
// OTDR TRACE HOOKS
// ============================================

export function useOtdrTrace(id: number | undefined) {
  return useLiveQuery(() => id ? db.otdrTraces.get(id) : undefined, [id]);
}

export function useOtdrTracesBySplice(spliceId: number | undefined) {
  return useLiveQuery(
    () => spliceId ? db.otdrTraces.where("spliceId").equals(spliceId).toArray() : [],
    [spliceId]
  );
}
