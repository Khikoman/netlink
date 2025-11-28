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
  Splitter,
  Port,
  OLT,
  OLTPonPort,
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
  splitters!: EntityTable<Splitter, "id">;
  ports!: EntityTable<Port, "id">;
  olts!: EntityTable<OLT, "id">;
  oltPonPorts!: EntityTable<OLTPonPort, "id">;

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

    // Version 2: Add splitters and ports for LCP/NAP support
    this.version(2).stores({
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
      splitters: "++id, enclosureId, name, type",
      ports: "++id, enclosureId, splitterId, portNumber, status",
    });

    // Version 3: Add OLT support and hierarchy (parentType/parentId on enclosures)
    this.version(3).stores({
      projects: "++id, name, status, createdAt",
      enclosures: "++id, projectId, name, type, parentType, parentId",
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
      splitters: "++id, enclosureId, name, type",
      ports: "++id, enclosureId, splitterId, portNumber, status",
      olts: "++id, projectId, name",
      oltPonPorts: "++id, oltId, portNumber, status",
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
  // Delete all splitters and ports (for LCP/NAP)
  const splitters = await db.splitters.where("enclosureId").equals(id).toArray();
  for (const splitter of splitters) {
    if (splitter.id) await deleteSplitter(splitter.id);
  }
  await db.ports.where("enclosureId").equals(id).delete();
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
// SPLITTER OPERATIONS (LCP/NAP)
// ============================================

export async function createSplitter(splitter: Omit<Splitter, "id" | "createdAt">): Promise<number> {
  const id = await db.splitters.add({
    ...splitter,
    createdAt: new Date(),
  });
  return id as number;
}

export async function getSplitters(enclosureId: number) {
  return db.splitters.where("enclosureId").equals(enclosureId).toArray();
}

export async function getSplitter(id: number) {
  return db.splitters.get(id);
}

export async function updateSplitter(id: number, updates: Partial<Splitter>) {
  return db.splitters.update(id, updates);
}

export async function deleteSplitter(id: number) {
  // Delete all ports belonging to this splitter
  await db.ports.where("splitterId").equals(id).delete();
  return db.splitters.delete(id);
}

// ============================================
// PORT OPERATIONS (LCP/NAP)
// ============================================

export async function createPort(port: Omit<Port, "id" | "createdAt">): Promise<number> {
  const id = await db.ports.add({
    ...port,
    createdAt: new Date(),
  });
  return id as number;
}

export async function getPorts(enclosureId: number) {
  const ports = await db.ports.where("enclosureId").equals(enclosureId).toArray();
  return ports.sort((a, b) => a.portNumber - b.portNumber);
}

export async function getPortsBySplitter(splitterId: number) {
  const ports = await db.ports.where("splitterId").equals(splitterId).toArray();
  return ports.sort((a, b) => a.portNumber - b.portNumber);
}

export async function getPort(id: number) {
  return db.ports.get(id);
}

export async function updatePort(id: number, updates: Partial<Port>) {
  return db.ports.update(id, updates);
}

export async function deletePort(id: number) {
  return db.ports.delete(id);
}

export async function getAvailablePorts(enclosureId: number) {
  const ports = await db.ports.where("enclosureId").equals(enclosureId).toArray();
  return ports.filter(p => p.status === "available").sort((a, b) => a.portNumber - b.portNumber);
}

export async function getPortsByStatus(enclosureId: number, status: Port["status"]) {
  const ports = await db.ports.where("enclosureId").equals(enclosureId).toArray();
  return ports.filter(p => p.status === status).sort((a, b) => a.portNumber - b.portNumber);
}

// ============================================
// OLT OPERATIONS
// ============================================

export async function createOLT(olt: Omit<OLT, "id" | "createdAt">): Promise<number> {
  const id = await db.olts.add({
    ...olt,
    createdAt: new Date(),
  });
  return id as number;
}

export async function getOLTs(projectId: number) {
  return db.olts.where("projectId").equals(projectId).toArray();
}

export async function getOLT(id: number) {
  return db.olts.get(id);
}

export async function updateOLT(id: number, updates: Partial<OLT>) {
  return db.olts.update(id, updates);
}

export async function deleteOLT(id: number) {
  // Delete all PON ports
  await db.oltPonPorts.where("oltId").equals(id).delete();
  // Set parentId to undefined for any LCPs using this OLT
  const lcps = await db.enclosures
    .where("parentId")
    .equals(id)
    .filter((e) => e.parentType === "olt")
    .toArray();
  for (const lcp of lcps) {
    if (lcp.id) {
      await db.enclosures.update(lcp.id, { parentId: undefined, parentType: undefined });
    }
  }
  return db.olts.delete(id);
}

// ============================================
// OLT PON PORT OPERATIONS
// ============================================

export async function createOLTPonPort(port: Omit<OLTPonPort, "id">): Promise<number> {
  const id = await db.oltPonPorts.add(port);
  return id as number;
}

export async function getOLTPonPorts(oltId: number) {
  const ports = await db.oltPonPorts.where("oltId").equals(oltId).toArray();
  return ports.sort((a, b) => a.portNumber - b.portNumber);
}

export async function getOLTPonPort(id: number) {
  return db.oltPonPorts.get(id);
}

export async function updateOLTPonPort(id: number, updates: Partial<OLTPonPort>) {
  return db.oltPonPorts.update(id, updates);
}

export async function deleteOLTPonPort(id: number) {
  // Clear oltPonPortId on any LCPs using this port
  const lcps = await db.enclosures
    .filter((e) => e.oltPonPortId === id)
    .toArray();
  for (const lcp of lcps) {
    if (lcp.id) {
      await db.enclosures.update(lcp.id, { oltPonPortId: undefined });
    }
  }
  return db.oltPonPorts.delete(id);
}

// ============================================
// HIERARCHY QUERIES
// ============================================

export async function getLCPsByOLT(oltId: number) {
  return db.enclosures
    .where("parentId")
    .equals(oltId)
    .filter((e) => e.parentType === "olt" && (e.type === "lcp" || e.type === "fdt"))
    .toArray();
}

export async function getNAPsByLCP(lcpId: number) {
  return db.enclosures
    .where("parentId")
    .equals(lcpId)
    .filter((e) => e.parentType === "lcp" && (e.type === "nap" || e.type === "fat"))
    .toArray();
}

export async function getOrphanedLCPs(projectId: number) {
  return db.enclosures
    .where("projectId")
    .equals(projectId)
    .filter((e) => (e.type === "lcp" || e.type === "fdt") && !e.parentId)
    .toArray();
}

export async function getOrphanedNAPs(projectId: number) {
  return db.enclosures
    .where("projectId")
    .equals(projectId)
    .filter((e) => (e.type === "nap" || e.type === "fat") && !e.parentId)
    .toArray();
}

// ============================================
// CLOSURE HIERARCHY QUERIES (OLT → Closure → LCP → NAP)
// ============================================

/**
 * Get closures directly under an OLT (parentType: "olt", type: "splice-closure")
 */
export async function getClosuresByOLT(oltId: number) {
  return db.enclosures
    .where("parentId")
    .equals(oltId)
    .filter((e) => e.parentType === "olt" && e.type === "splice-closure")
    .toArray();
}

/**
 * Get LCPs under a closure (parentType: "closure")
 */
export async function getLCPsByClosure(closureId: number) {
  return db.enclosures
    .where("parentId")
    .equals(closureId)
    .filter((e) => e.parentType === "closure" && (e.type === "lcp" || e.type === "fdt"))
    .toArray();
}

/**
 * Get closures without a parent OLT (orphaned)
 */
export async function getOrphanedClosures(projectId: number) {
  return db.enclosures
    .where("projectId")
    .equals(projectId)
    .filter((e) => e.type === "splice-closure" && !e.parentId)
    .toArray();
}

export interface ClosureHierarchyStats {
  lcpCount: number;
  napCount: number;
  customerCount: number;
  splitterCount: number;
  trayCount: number;
  utilization: number;
}

/**
 * Get hierarchy stats for a closure (LCPs, NAPs, customers under it)
 */
export async function getClosureHierarchyStats(closureId: number): Promise<ClosureHierarchyStats> {
  const lcps = await getLCPsByClosure(closureId);
  let totalNAPs = 0;
  let totalCustomers = 0;
  let totalPorts = 0;
  let connectedPorts = 0;

  // Count splitters and trays in the closure itself
  const splitters = await db.splitters.where("enclosureId").equals(closureId).toArray();
  const trays = await db.trays.where("enclosureId").equals(closureId).toArray();

  for (const lcp of lcps) {
    if (!lcp.id) continue;
    const naps = await getNAPsByLCP(lcp.id);
    totalNAPs += naps.length;

    for (const nap of naps) {
      if (!nap.id) continue;
      const ports = await db.ports.where("enclosureId").equals(nap.id).toArray();
      totalPorts += ports.length;
      connectedPorts += ports.filter((p) => p.status === "connected").length;
      totalCustomers += ports.filter((p) => p.status === "connected").length;
    }
  }

  return {
    lcpCount: lcps.length,
    napCount: totalNAPs,
    customerCount: totalCustomers,
    splitterCount: splitters.length,
    trayCount: trays.length,
    utilization: totalPorts > 0 ? Math.round((connectedPorts / totalPorts) * 100) : 0,
  };
}

/**
 * Get closure contents (trays and splitters)
 */
export async function getClosureContents(closureId: number) {
  const trays = await db.trays.where("enclosureId").equals(closureId).toArray();
  const splitters = await db.splitters.where("enclosureId").equals(closureId).toArray();
  return { trays: trays.sort((a, b) => a.number - b.number), splitters };
}

export interface HierarchyStats {
  closureCount?: number;
  lcpCount: number;
  napCount: number;
  customerCount: number;
  utilization: number;
}

/**
 * Get OLT hierarchy stats - supports both old (OLT→LCP) and new (OLT→Closure→LCP) hierarchy
 */
export async function getOLTHierarchyStats(oltId: number): Promise<HierarchyStats> {
  // Get closures under this OLT (new hierarchy)
  const closures = await getClosuresByOLT(oltId);
  // Get legacy LCPs directly under OLT (old hierarchy)
  const legacyLCPs = await getLCPsByOLT(oltId);

  let totalLCPs = legacyLCPs.length;
  let totalNAPs = 0;
  let totalCustomers = 0;
  let totalPorts = 0;
  let connectedPorts = 0;

  // Process new hierarchy: OLT → Closure → LCP → NAP
  for (const closure of closures) {
    if (!closure.id) continue;
    const lcps = await getLCPsByClosure(closure.id);
    totalLCPs += lcps.length;

    for (const lcp of lcps) {
      if (!lcp.id) continue;
      const naps = await getNAPsByLCP(lcp.id);
      totalNAPs += naps.length;

      for (const nap of naps) {
        if (!nap.id) continue;
        const ports = await db.ports.where("enclosureId").equals(nap.id).toArray();
        totalPorts += ports.length;
        connectedPorts += ports.filter((p) => p.status === "connected").length;
        totalCustomers += ports.filter((p) => p.status === "connected").length;
      }
    }
  }

  // Process legacy hierarchy: OLT → LCP → NAP (backwards compatibility)
  for (const lcp of legacyLCPs) {
    if (!lcp.id) continue;
    const naps = await getNAPsByLCP(lcp.id);
    totalNAPs += naps.length;

    for (const nap of naps) {
      if (!nap.id) continue;
      const ports = await db.ports.where("enclosureId").equals(nap.id).toArray();
      totalPorts += ports.length;
      connectedPorts += ports.filter((p) => p.status === "connected").length;
      totalCustomers += ports.filter((p) => p.status === "connected").length;
    }
  }

  return {
    closureCount: closures.length,
    lcpCount: totalLCPs,
    napCount: totalNAPs,
    customerCount: totalCustomers,
    utilization: totalPorts > 0 ? Math.round((connectedPorts / totalPorts) * 100) : 0,
  };
}

export async function getLCPHierarchyStats(lcpId: number): Promise<HierarchyStats> {
  const naps = await getNAPsByLCP(lcpId);
  let totalCustomers = 0;
  let totalPorts = 0;
  let connectedPorts = 0;

  for (const nap of naps) {
    if (!nap.id) continue;
    const ports = await db.ports.where("enclosureId").equals(nap.id).toArray();
    totalPorts += ports.length;
    connectedPorts += ports.filter((p) => p.status === "connected").length;
    totalCustomers += ports.filter((p) => p.status === "connected").length;
  }

  return {
    lcpCount: 0,
    napCount: naps.length,
    customerCount: totalCustomers,
    utilization: totalPorts > 0 ? Math.round((connectedPorts / totalPorts) * 100) : 0,
  };
}

export async function getNAPStats(napId: number) {
  const ports = await db.ports.where("enclosureId").equals(napId).toArray();
  return {
    total: ports.length,
    available: ports.filter((p) => p.status === "available").length,
    connected: ports.filter((p) => p.status === "connected").length,
    reserved: ports.filter((p) => p.status === "reserved").length,
    faulty: ports.filter((p) => p.status === "faulty").length,
  };
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
