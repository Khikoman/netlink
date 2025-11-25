import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./index";
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
// SYNC HOOKS
// ============================================

export function usePendingSyncCount() {
  return useLiveQuery(async () => {
    return db.syncQueue.filter(item => !item.synced).count();
  }, []);
}
