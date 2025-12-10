/**
 * Splice Service - Unified canvas-based splice operations
 *
 * This service provides edge-centric splice management for the UnifiedSpliceEditor.
 * All splice operations are tied to React Flow edge IDs for canvas integration.
 */

import { db } from "./index";
import type { Splice } from "@/types";

// ============================================
// TYPES
// ============================================

export interface SpliceConnection {
  id?: number;
  fiberA: number;
  fiberB: number;
  tubeAColor: string;
  tubeBColor: string;
  fiberAColor: string;
  fiberBColor: string;
  loss?: number;
  status: Splice["status"];
  spliceType: Splice["spliceType"];
  technicianName?: string;
  notes?: string;
}

export interface EdgeSpliceData {
  edgeId: string;
  cableAId: number;
  cableAName: string;
  cableBId: number;
  cableBName: string;
  trayId: number;
  connections: SpliceConnection[];
}

export interface SpliceStats {
  total: number;
  completed: number;
  pending: number;
  needsReview: number;
  failed: number;
  avgLoss: number;
  minLoss: number;
  maxLoss: number;
}

// ============================================
// READ OPERATIONS
// ============================================

/**
 * Get all splices for a React Flow edge
 */
export async function getSplicesByEdge(edgeId: string): Promise<Splice[]> {
  return db.splices.where("edgeId").equals(edgeId).toArray();
}

/**
 * Get splice statistics for an edge
 */
export async function getSpliceStatsByEdge(edgeId: string): Promise<SpliceStats | null> {
  const splices = await getSplicesByEdge(edgeId);

  if (splices.length === 0) {
    return null;
  }

  const lossValues = splices
    .filter(s => s.loss !== undefined && s.loss !== null)
    .map(s => s.loss as number);

  return {
    total: splices.length,
    completed: splices.filter(s => s.status === "completed").length,
    pending: splices.filter(s => s.status === "pending").length,
    needsReview: splices.filter(s => s.status === "needs-review").length,
    failed: splices.filter(s => s.status === "failed").length,
    avgLoss: lossValues.length > 0
      ? lossValues.reduce((sum, l) => sum + l, 0) / lossValues.length
      : 0,
    minLoss: lossValues.length > 0 ? Math.min(...lossValues) : 0,
    maxLoss: lossValues.length > 0 ? Math.max(...lossValues) : 0,
  };
}

/**
 * Check if an edge has any splices
 */
export async function edgeHasSplices(edgeId: string): Promise<boolean> {
  const count = await db.splices.where("edgeId").equals(edgeId).count();
  return count > 0;
}

/**
 * Get splice count for an edge (for badge display)
 */
export async function getSpliceCount(edgeId: string): Promise<number> {
  return db.splices.where("edgeId").equals(edgeId).count();
}

// ============================================
// WRITE OPERATIONS
// ============================================

/**
 * Save all splices for an edge (replaces existing)
 * This is the primary save operation for the UnifiedSpliceEditor
 */
export async function saveSplicesForEdge(data: EdgeSpliceData): Promise<number[]> {
  const { edgeId, cableAId, cableAName, cableBId, cableBName, trayId, connections } = data;

  return db.transaction("rw", db.splices, async () => {
    // Delete existing splices for this edge
    await db.splices.where("edgeId").equals(edgeId).delete();

    // Insert new splices
    const now = new Date();
    const spliceRecords: Omit<Splice, "id">[] = connections.map(conn => ({
      trayId,
      edgeId,
      cableAId,
      cableAName,
      cableBId,
      cableBName,
      fiberA: conn.fiberA,
      fiberB: conn.fiberB,
      tubeAColor: conn.tubeAColor,
      tubeBColor: conn.tubeBColor,
      fiberAColor: conn.fiberAColor,
      fiberBColor: conn.fiberBColor,
      loss: conn.loss,
      status: conn.status,
      spliceType: conn.spliceType,
      technicianName: conn.technicianName,
      notes: conn.notes,
      timestamp: now,
    }));

    const ids: number[] = [];
    for (const record of spliceRecords) {
      const id = await db.splices.add(record);
      ids.push(id as number);
    }

    return ids;
  });
}

/**
 * Add a single splice connection to an edge
 */
export async function addSpliceConnection(
  edgeId: string,
  trayId: number,
  cableAId: number,
  cableAName: string,
  cableBId: number,
  cableBName: string,
  connection: SpliceConnection
): Promise<number> {
  const id = await db.splices.add({
    trayId,
    edgeId,
    cableAId,
    cableAName,
    cableBId,
    cableBName,
    fiberA: connection.fiberA,
    fiberB: connection.fiberB,
    tubeAColor: connection.tubeAColor,
    tubeBColor: connection.tubeBColor,
    fiberAColor: connection.fiberAColor,
    fiberBColor: connection.fiberBColor,
    loss: connection.loss,
    status: connection.status,
    spliceType: connection.spliceType,
    technicianName: connection.technicianName,
    notes: connection.notes,
    timestamp: new Date(),
  });
  return id as number;
}

/**
 * Update splice metadata (loss, status, notes, etc.)
 */
export async function updateSpliceMetadata(
  spliceId: number,
  updates: Partial<Pick<Splice, "loss" | "status" | "spliceType" | "technicianName" | "notes">>
): Promise<void> {
  await db.splices.update(spliceId, updates);
}

/**
 * Delete a single splice connection
 */
export async function deleteSpliceConnection(spliceId: number): Promise<void> {
  await db.splices.delete(spliceId);
}

/**
 * Delete all splices for an edge
 */
export async function deleteSplicesForEdge(edgeId: string): Promise<number> {
  return db.splices.where("edgeId").equals(edgeId).delete();
}

/**
 * Update all splices for an edge to a new status (batch operation)
 */
export async function batchUpdateSpliceStatus(
  edgeId: string,
  status: Splice["status"]
): Promise<number> {
  const splices = await getSplicesByEdge(edgeId);
  const ids = splices.map(s => s.id).filter((id): id is number => id !== undefined);

  await db.splices.bulkUpdate(
    ids.map(id => ({ key: id, changes: { status } }))
  );

  return ids.length;
}

/**
 * Auto-match fibers 1:1 between two cables
 * Creates splice connections for matching fiber positions
 */
export async function autoMatchFibers(
  edgeId: string,
  trayId: number,
  cableA: { id: number; name: string; fiberCount: number },
  cableB: { id: number; name: string; fiberCount: number },
  fiberColors: { fiberColor: string; tubeColor: string }[],
  defaultStatus: Splice["status"] = "pending",
  defaultSpliceType: Splice["spliceType"] = "fusion"
): Promise<number[]> {
  // Match up to the minimum fiber count
  const matchCount = Math.min(cableA.fiberCount, cableB.fiberCount);

  const connections: SpliceConnection[] = [];

  for (let i = 0; i < matchCount; i++) {
    const fiberNum = i + 1;
    // Use provided fiber colors or defaults
    const colorA = fiberColors[i] || { fiberColor: "blue", tubeColor: "blue" };
    const colorB = fiberColors[i] || { fiberColor: "blue", tubeColor: "blue" };

    connections.push({
      fiberA: fiberNum,
      fiberB: fiberNum,
      tubeAColor: colorA.tubeColor,
      tubeBColor: colorB.tubeColor,
      fiberAColor: colorA.fiberColor,
      fiberBColor: colorB.fiberColor,
      status: defaultStatus,
      spliceType: defaultSpliceType,
    });
  }

  return saveSplicesForEdge({
    edgeId,
    cableAId: cableA.id,
    cableAName: cableA.name,
    cableBId: cableB.id,
    cableBName: cableB.name,
    trayId,
    connections,
  });
}

// ============================================
// MIGRATION HELPERS
// ============================================

/**
 * Migrate splices from tray-based to edge-based storage
 * Call this when transitioning existing splice data
 */
export async function migrateSplicesToEdge(
  trayId: number,
  edgeId: string
): Promise<number> {
  const splices = await db.splices.where("trayId").equals(trayId).toArray();

  let updated = 0;
  for (const splice of splices) {
    if (splice.id && !splice.edgeId) {
      await db.splices.update(splice.id, { edgeId });
      updated++;
    }
  }

  return updated;
}

/**
 * Find orphaned splices (have trayId but no edgeId)
 * Useful for data cleanup and migration verification
 */
export async function findOrphanedSplices(): Promise<Splice[]> {
  const allSplices = await db.splices.toArray();
  return allSplices.filter(s => !s.edgeId);
}
