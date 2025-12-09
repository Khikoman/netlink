import { useCallback } from 'react';
import { db } from '@/lib/db';

interface PathSegment {
  nodeId: string;
  nodeType: string;
  nodeName: string;
  dbId: number;
  fiberIn?: { number: number; color: string; tube: string };
  fiberOut?: { number: number; color: string; tube: string };
  spliceInfo?: { trayId: number; loss: number };
}

interface FiberPath {
  segments: PathSegment[];
  totalLoss: number;
  spliceCount: number;
}

export function useFiberPathTracing() {
  const tracePath = useCallback(async (
    startNodeType: string,
    startNodeId: number,
    startFiber?: number
  ): Promise<FiberPath> => {
    const segments: PathSegment[] = [];
    let totalLoss = 0;
    let spliceCount = 0;

    // Trace UPSTREAM to OLT
    let currentType = startNodeType;
    let currentId = startNodeId;
    let currentFiber = startFiber;

    while (currentType !== 'olt') {
      if (currentType === 'odf') {
        const odf = await db.odfs.get(currentId);
        if (!odf) break;
        segments.unshift({
          nodeId: `odf-${currentId}`,
          nodeType: 'odf',
          nodeName: odf.name || `ODF-${currentId}`,
          dbId: currentId,
        });
        currentType = 'olt';
        currentId = odf.oltId || 0;
      } else {
        // Enclosure (closure, lcp, nap)
        const enclosure = await db.enclosures.get(currentId);
        if (!enclosure) break;

        // Find splice for this fiber
        const trays = await db.trays.where('enclosureId').equals(currentId).toArray();
        let foundSplice = null;
        for (const tray of trays) {
          if (!tray.id) continue;
          const splices = await db.splices.where('trayId').equals(tray.id).toArray();
          foundSplice = splices.find(s => s.fiberB === currentFiber);
          if (foundSplice) break;
        }

        segments.unshift({
          nodeId: `${currentType}-${currentId}`,
          nodeType: currentType,
          nodeName: enclosure.name || `${currentType.toUpperCase()}-${currentId}`,
          dbId: currentId,
          fiberIn: currentFiber ? { number: currentFiber, color: 'Blue', tube: 'Blue' } : undefined,
          fiberOut: foundSplice ? { number: foundSplice.fiberA, color: foundSplice.fiberAColor || 'Blue', tube: 'Blue' } : undefined,
          spliceInfo: foundSplice ? { trayId: foundSplice.trayId, loss: foundSplice.loss || 0.1 } : undefined,
        });

        if (foundSplice) {
          totalLoss += foundSplice.loss || 0.1;
          spliceCount++;
          currentFiber = foundSplice.fiberA;
        }

        currentType = enclosure.parentType || 'olt';
        currentId = enclosure.parentId || 0;
      }
    }

    // Add OLT at the start
    if (currentType === 'olt' && currentId) {
      const olt = await db.olts.get(currentId);
      segments.unshift({
        nodeId: `olt-${currentId}`,
        nodeType: 'olt',
        nodeName: olt?.name || `OLT-${currentId}`,
        dbId: currentId,
        fiberOut: currentFiber ? { number: currentFiber, color: 'Blue', tube: 'Blue' } : undefined,
      });
    }

    return { segments, totalLoss, spliceCount };
  }, []);

  return { tracePath };
}
