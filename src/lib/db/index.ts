import Dexie, { type EntityTable } from "dexie";
import type {
  Project,
  Enclosure,
  Tray,
  Cable,
  Splice,
  OtdrTrace,
  InventoryItem,
  InventoryUsage,
  LossBudgetResult,
  MapNode,
  MapRoute,
  SyncQueueItem,
} from "@/types";

// NetLink Database using Dexie.js (IndexedDB wrapper)
class NetLinkDB extends Dexie {
  // Table declarations
  projects!: EntityTable<Project, "id">;
  enclosures!: EntityTable<Enclosure, "id">;
  trays!: EntityTable<Tray, "id">;
  cables!: EntityTable<Cable, "id">;
  splices!: EntityTable<Splice, "id">;
  otdrTraces!: EntityTable<OtdrTrace, "id">;
  inventory!: EntityTable<InventoryItem, "id">;
  inventoryUsage!: EntityTable<InventoryUsage, "id">;
  lossBudgets!: EntityTable<LossBudgetResult, "id">;
  mapNodes!: EntityTable<MapNode, "id">;
  mapRoutes!: EntityTable<MapRoute, "id">;
  syncQueue!: EntityTable<SyncQueueItem, "id">;

  constructor() {
    super("NetLinkDB");

    this.version(1).stores({
      // Primary key is 'id' with auto-increment (++)
      // Additional indexed fields after comma
      projects: "++id, name, status, createdAt",
      enclosures: "++id, projectId, name, type",
      trays: "++id, enclosureId, number",
      cables: "++id, projectId, name, fiberCount",
      splices: "++id, trayId, cableAId, cableBId, fiberA, fiberB, status, timestamp",
      otdrTraces: "++id, spliceId, wavelength, uploadedAt",
      inventory: "++id, category, name, partNumber",
      inventoryUsage: "++id, inventoryId, projectId, date",
      lossBudgets: "++id, [input.name], createdAt",
      mapNodes: "++id, projectId, type, enclosureId",
      mapRoutes: "++id, projectId, fromNodeId, toNodeId, cableId",
      syncQueue: "++id, table, recordId, synced, timestamp",
    });
  }
}

// Singleton database instance
export const db = new NetLinkDB();

// ============================================
// PROJECT OPERATIONS
// ============================================

export async function createProject(
  name: string,
  location: string,
  description?: string
): Promise<number> {
  const now = new Date();
  const id = await db.projects.add({
    name,
    location,
    description,
    createdAt: now,
    updatedAt: now,
    status: "active",
  });
  return id as number;
}

export async function getProjects() {
  return db.projects.orderBy("createdAt").reverse().toArray();
}

export async function getProject(id: number) {
  return db.projects.get(id);
}

export async function updateProject(id: number, updates: Partial<Project>) {
  return db.projects.update(id, { ...updates, updatedAt: new Date() });
}

export async function deleteProject(id: number) {
  // Delete all related data
  const enclosures = await db.enclosures.where("projectId").equals(id).toArray();
  for (const enc of enclosures) {
    if (enc.id) await deleteEnclosure(enc.id);
  }
  await db.cables.where("projectId").equals(id).delete();
  await db.mapNodes.where("projectId").equals(id).delete();
  await db.mapRoutes.where("projectId").equals(id).delete();
  return db.projects.delete(id);
}

// ============================================
// ENCLOSURE OPERATIONS
// ============================================

export async function createEnclosure(enclosure: Omit<Enclosure, "id" | "createdAt">): Promise<number> {
  const id = await db.enclosures.add({
    ...enclosure,
    createdAt: new Date(),
  });
  return id as number;
}

export async function getEnclosures(projectId: number) {
  return db.enclosures.where("projectId").equals(projectId).toArray();
}

export async function getEnclosure(id: number) {
  return db.enclosures.get(id);
}

export async function updateEnclosure(id: number, updates: Partial<Enclosure>) {
  return db.enclosures.update(id, updates);
}

export async function deleteEnclosure(id: number) {
  // Delete all trays and their splices
  const trays = await db.trays.where("enclosureId").equals(id).toArray();
  for (const tray of trays) {
    if (tray.id) await deleteTray(tray.id);
  }
  return db.enclosures.delete(id);
}

// ============================================
// TRAY OPERATIONS
// ============================================

export async function createTray(tray: Omit<Tray, "id">): Promise<number> {
  const id = await db.trays.add(tray);
  return id as number;
}

export async function getTrays(enclosureId: number) {
  const trays = await db.trays.where("enclosureId").equals(enclosureId).toArray();
  return trays.sort((a, b) => a.number - b.number);
}

export async function getTray(id: number) {
  return db.trays.get(id);
}

export async function updateTray(id: number, updates: Partial<Tray>) {
  return db.trays.update(id, updates);
}

export async function deleteTray(id: number) {
  // Delete all splices in this tray
  await db.splices.where("trayId").equals(id).delete();
  return db.trays.delete(id);
}

// ============================================
// CABLE OPERATIONS
// ============================================

export async function createCable(cable: Omit<Cable, "id">): Promise<number> {
  const id = await db.cables.add(cable);
  return id as number;
}

export async function getCables(projectId?: number) {
  if (projectId) {
    return db.cables.where("projectId").equals(projectId).toArray();
  }
  return db.cables.toArray();
}

export async function getCable(id: number) {
  return db.cables.get(id);
}

export async function updateCable(id: number, updates: Partial<Cable>) {
  return db.cables.update(id, updates);
}

export async function deleteCable(id: number) {
  return db.cables.delete(id);
}

// ============================================
// SPLICE OPERATIONS
// ============================================

export async function createSplice(splice: Omit<Splice, "id">): Promise<number> {
  const id = await db.splices.add(splice);
  return id as number;
}

export async function getSplices(trayId: number) {
  return db.splices.where("trayId").equals(trayId).toArray();
}

export async function getSplicesByCable(cableId: number) {
  const asA = await db.splices.where("cableAId").equals(cableId).toArray();
  const asB = await db.splices.where("cableBId").equals(cableId).toArray();
  return [...asA, ...asB];
}

export async function getSplice(id: number) {
  return db.splices.get(id);
}

export async function updateSplice(id: number, updates: Partial<Splice>) {
  return db.splices.update(id, updates);
}

export async function deleteSplice(id: number) {
  // Delete associated OTDR trace if exists
  const splice = await db.splices.get(id);
  if (splice?.otdrTraceId) {
    await db.otdrTraces.delete(splice.otdrTraceId);
  }
  return db.splices.delete(id);
}

// ============================================
// OTDR TRACE OPERATIONS
// ============================================

export async function createOtdrTrace(trace: Omit<OtdrTrace, "id" | "uploadedAt">): Promise<number> {
  const id = await db.otdrTraces.add({
    ...trace,
    uploadedAt: new Date(),
  });
  return id as number;
}

export async function getOtdrTrace(id: number) {
  return db.otdrTraces.get(id);
}

export async function getOtdrTraceBySplice(spliceId: number) {
  return db.otdrTraces.where("spliceId").equals(spliceId).first();
}

export async function deleteOtdrTrace(id: number) {
  return db.otdrTraces.delete(id);
}

// ============================================
// INVENTORY OPERATIONS
// ============================================

export async function createInventoryItem(item: Omit<InventoryItem, "id">): Promise<number> {
  const id = await db.inventory.add(item);
  return id as number;
}

export async function getInventory(category?: string) {
  if (category) {
    return db.inventory.where("category").equals(category).toArray();
  }
  return db.inventory.toArray();
}

export async function getInventoryItem(id: number) {
  return db.inventory.get(id);
}

export async function updateInventoryItem(id: number, updates: Partial<InventoryItem>) {
  return db.inventory.update(id, updates);
}

export async function deleteInventoryItem(id: number) {
  await db.inventoryUsage.where("inventoryId").equals(id).delete();
  return db.inventory.delete(id);
}

export async function getLowStockItems() {
  const items = await db.inventory.toArray();
  return items.filter((item) => item.quantity <= item.minStock);
}

// ============================================
// INVENTORY USAGE OPERATIONS
// ============================================

export async function logInventoryUsage(usage: Omit<InventoryUsage, "id">): Promise<number> {
  // Deduct from inventory
  const item = await db.inventory.get(usage.inventoryId);
  if (item) {
    await db.inventory.update(usage.inventoryId, {
      quantity: Math.max(0, item.quantity - usage.quantity),
    });
  }
  const id = await db.inventoryUsage.add(usage);
  return id as number;
}

export async function getInventoryUsage(projectId: number) {
  return db.inventoryUsage.where("projectId").equals(projectId).toArray();
}

export async function getItemUsageHistory(inventoryId: number) {
  return db.inventoryUsage.where("inventoryId").equals(inventoryId).toArray();
}

// ============================================
// LOSS BUDGET OPERATIONS
// ============================================

export async function saveLossBudget(result: Omit<LossBudgetResult, "id" | "createdAt">): Promise<number> {
  const id = await db.lossBudgets.add({
    ...result,
    createdAt: new Date(),
  });
  return id as number;
}

export async function getLossBudgets() {
  return db.lossBudgets.orderBy("createdAt").reverse().toArray();
}

export async function getLossBudget(id: number) {
  return db.lossBudgets.get(id);
}

export async function deleteLossBudget(id: number) {
  return db.lossBudgets.delete(id);
}

// ============================================
// MAP OPERATIONS
// ============================================

export async function createMapNode(node: Omit<MapNode, "id">): Promise<number> {
  const id = await db.mapNodes.add(node);
  return id as number;
}

export async function getMapNodes(projectId: number) {
  return db.mapNodes.where("projectId").equals(projectId).toArray();
}

export async function updateMapNode(id: number, updates: Partial<MapNode>) {
  return db.mapNodes.update(id, updates);
}

export async function deleteMapNode(id: number) {
  // Delete routes connected to this node
  await db.mapRoutes.where("fromNodeId").equals(id).delete();
  await db.mapRoutes.where("toNodeId").equals(id).delete();
  return db.mapNodes.delete(id);
}

export async function createMapRoute(route: Omit<MapRoute, "id">): Promise<number> {
  const id = await db.mapRoutes.add(route);
  return id as number;
}

export async function getMapRoutes(projectId: number) {
  return db.mapRoutes.where("projectId").equals(projectId).toArray();
}

export async function updateMapRoute(id: number, updates: Partial<MapRoute>) {
  return db.mapRoutes.update(id, updates);
}

export async function deleteMapRoute(id: number) {
  return db.mapRoutes.delete(id);
}

// ============================================
// SYNC QUEUE (for future cloud sync)
// ============================================

export async function addToSyncQueue(
  table: string,
  recordId: number,
  action: "create" | "update" | "delete",
  data: object
) {
  const id = await db.syncQueue.add({
    table,
    recordId,
    action,
    data: JSON.stringify(data),
    timestamp: new Date(),
    synced: false,
  });
  return id as number;
}

export async function getPendingSyncItems() {
  return db.syncQueue.filter(item => !item.synced).toArray();
}

export async function markSynced(id: number) {
  return db.syncQueue.update(id, { synced: true });
}

export async function clearSyncedItems() {
  const items = await db.syncQueue.filter(item => item.synced).toArray();
  const ids = items.map(item => item.id).filter((id): id is number => id !== undefined);
  return db.syncQueue.bulkDelete(ids);
}

export default db;
