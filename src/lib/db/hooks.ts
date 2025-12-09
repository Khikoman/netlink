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

// ============================================
// UPSTREAM/DOWNSTREAM CONNECTION HOOKS
// ============================================

/**
 * Get upstream connection info for a node (parent, cable, fiber colors)
 */
export function useUpstreamConnection(nodeType: string, nodeId: number | undefined) {
  return useLiveQuery(async () => {
    if (!nodeId) return null;

    // For ODF - upstream is the OLT
    if (nodeType === "odf") {
      const odf = await db.odfs.get(nodeId);
      if (!odf || !odf.oltId) return null;
      const olt = await db.olts.get(odf.oltId);
      return {
        parentType: "olt",
        parent: olt,
        cable: null, // ODF is directly part of OLT cabinet
      };
    }

    // For enclosure types (closure, lcp, nap)
    if (["closure", "splice-closure", "lcp", "fdt", "nap", "fat"].includes(nodeType)) {
      const enc = await db.enclosures.get(nodeId);
      if (!enc || !enc.parentId) return null;

      // Get parent based on parentType
      if (enc.parentType === "olt") {
        const olt = await db.olts.get(enc.parentId);
        // Find cable connecting OLT to this enclosure
        const cable = await db.cables.where("targetEnclosureId").equals(nodeId).first();
        return { parentType: "olt", parent: olt, cable };
      } else if (enc.parentType === "odf") {
        const odf = await db.odfs.get(enc.parentId);
        // Find ODF port connecting to this enclosure
        const odfPort = await db.odfPorts.where("enclosureId").equals(nodeId).first();
        const cable = odfPort ? await db.cables.where("odfPortId").equals(odfPort.id!).first() : null;
        return { parentType: "odf", parent: odf, cable, odfPort };
      } else if (enc.parentType === "closure") {
        const parentClosure = await db.enclosures.get(enc.parentId);
        const cable = await db.cables.where("targetEnclosureId").equals(nodeId).first();
        return { parentType: "closure", parent: parentClosure, cable };
      } else if (enc.parentType === "lcp") {
        const parentLcp = await db.enclosures.get(enc.parentId);
        const cable = await db.cables.where("targetEnclosureId").equals(nodeId).first();
        return { parentType: "lcp", parent: parentLcp, cable };
      }
    }

    return null;
  }, [nodeType, nodeId]);
}

/**
 * Get downstream connections for a node (children, cables)
 */
export function useDownstreamConnections(nodeType: string, nodeId: number | undefined) {
  return useLiveQuery(async () => {
    if (!nodeId) return [];

    // For OLT - downstream includes ODFs and closures
    if (nodeType === "olt") {
      const odfs = await db.odfs.where("oltId").equals(nodeId).toArray();
      const closures = await db.enclosures
        .where("parentId")
        .equals(nodeId)
        .filter((e) => e.parentType === "olt")
        .toArray();

      const result = [];
      for (const odf of odfs) {
        result.push({ type: "odf", item: odf, cable: null });
      }
      for (const closure of closures) {
        const cable = await db.cables.where("targetEnclosureId").equals(closure.id!).first();
        result.push({ type: closure.type, item: closure, cable });
      }
      return result;
    }

    // For ODF - downstream includes closures connected via ODF ports
    if (nodeType === "odf") {
      const ports = await db.odfPorts.where("odfId").equals(nodeId).toArray();
      const result = [];
      for (const port of ports) {
        if (port.closureId) {
          const enc = await db.enclosures.get(port.closureId);
          const cable = await db.cables.where("odfPortId").equals(port.id!).first();
          if (enc) {
            result.push({ type: enc.type, item: enc, cable, port });
          }
        }
      }
      return result;
    }

    // For closures - downstream includes LCPs
    if (["closure", "splice-closure"].includes(nodeType)) {
      const lcps = await db.enclosures
        .where("parentId")
        .equals(nodeId)
        .filter((e) => e.parentType === "closure" && (e.type === "lcp" || e.type === "fdt"))
        .toArray();

      const result = [];
      for (const lcp of lcps) {
        const cable = await db.cables.where("targetEnclosureId").equals(lcp.id!).first();
        result.push({ type: lcp.type, item: lcp, cable });
      }
      return result;
    }

    // For LCP - downstream includes NAPs
    if (["lcp", "fdt"].includes(nodeType)) {
      const naps = await db.enclosures
        .where("parentId")
        .equals(nodeId)
        .filter((e) => e.parentType === "lcp" && (e.type === "nap" || e.type === "fat"))
        .toArray();

      const result = [];
      for (const nap of naps) {
        const cable = await db.cables.where("targetEnclosureId").equals(nap.id!).first();
        result.push({ type: nap.type, item: nap, cable });
      }
      return result;
    }

    // For NAP - downstream includes customer attachments
    if (["nap", "fat"].includes(nodeType)) {
      const ports = await db.ports.where("enclosureId").equals(nodeId).toArray();
      const result = [];
      for (const port of ports) {
        if (port.status === "connected" || port.customerName) {
          result.push({ type: "customer", port, customerName: port.customerName });
        }
      }
      return result;
    }

    return [];
  }, [nodeType, nodeId]);
}

/**
 * Get splice summary with fiber colors for an enclosure (closure)
 */
export function useSpliceSummary(enclosureId: number | undefined) {
  return useLiveQuery(async () => {
    if (!enclosureId) return { total: 0, completed: 0, pending: 0, splices: [] };

    const trays = await db.trays.where("enclosureId").equals(enclosureId).toArray();
    const allSplices: Splice[] = [];

    for (const tray of trays) {
      const traySplices = await db.splices.where("trayId").equals(tray.id!).toArray();
      allSplices.push(...traySplices);
    }

    return {
      total: allSplices.length,
      completed: allSplices.filter((s) => s.status === "completed").length,
      pending: allSplices.filter((s) => s.status === "pending").length,
      needsReview: allSplices.filter((s) => s.status === "needs-review").length,
      failed: allSplices.filter((s) => s.status === "failed").length,
      splices: allSplices.map((s) => ({
        id: s.id,
        fiberA: s.fiberA,
        fiberB: s.fiberB,
        fiberAColor: s.fiberAColor,
        fiberBColor: s.fiberBColor,
        tubeAColor: s.tubeAColor,
        tubeBColor: s.tubeBColor,
        status: s.status,
        loss: s.loss,
      })),
    };
  }, [enclosureId]);
}

/**
 * Get fiber path info for a cable connection
 */
export function useFiberPath(cableId: number | undefined) {
  return useLiveQuery(async () => {
    if (!cableId) return null;

    const cable = await db.cables.get(cableId);
    if (!cable) return null;

    // Get splices associated with this cable
    const splicesA = await db.splices.where("cableAId").equals(cableId).toArray();
    const splicesB = await db.splices.where("cableBId").equals(cableId).toArray();
    const allSplices = [...splicesA, ...splicesB];

    // Collect unique fiber colors used
    const fiberColors = new Set<string>();
    const tubeColors = new Set<string>();

    for (const splice of allSplices) {
      if (splice.fiberAColor) fiberColors.add(splice.fiberAColor);
      if (splice.fiberBColor) fiberColors.add(splice.fiberBColor);
      if (splice.tubeAColor) tubeColors.add(splice.tubeAColor);
      if (splice.tubeBColor) tubeColors.add(splice.tubeBColor);
    }

    return {
      cable,
      fiberCount: cable.fiberCount,
      spliceCount: allSplices.length,
      fiberColors: Array.from(fiberColors),
      tubeColors: Array.from(tubeColors),
    };
  }, [cableId]);
}
