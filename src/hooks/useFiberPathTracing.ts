"use client";

import { useCallback } from "react";
import { db } from "@/lib/db";
import type { Edge } from "reactflow";
import type { FiberPath, PathSegment, FiberPathTraceResult, FiberPathNodeType } from "@/types/splice-matrix";
import { getFiberInfo } from "@/lib/fiberColors";
import { useNetwork } from "@/contexts/NetworkContext";

interface TraceContext {
  visitedNodes: Set<string>;
  segments: PathSegment[];
  totalLoss: number;
  spliceCount: number;
  connectorCount: number;
  totalDistance: number;
  missingLinks: string[];
}

export function useFiberPathTracing() {
  const { projectId } = useNetwork();

  /**
   * Trace fiber path upstream (toward OLT)
   */
  const traceUpstream = useCallback(
    async (
      startNodeType: FiberPathNodeType,
      startDbId: number,
      startFiber: number | undefined,
      ctx: TraceContext
    ): Promise<void> => {
      let currentType: FiberPathNodeType | string = startNodeType;
      let currentId = startDbId;
      let currentFiber = startFiber;

      while (currentType !== "olt" && currentId > 0) {
        const nodeKey = `${currentType}-${currentId}`;
        if (ctx.visitedNodes.has(nodeKey)) break;
        ctx.visitedNodes.add(nodeKey);

        if (currentType === "odf") {
          const odf = await db.odfs.get(currentId);
          if (!odf) {
            ctx.missingLinks.push(`ODF ${currentId} not found`);
            break;
          }

          const segment: PathSegment = {
            order: 0, // Will be renumbered later
            nodeId: `odf-${currentId}`,
            nodeType: "odf",
            nodeName: odf.name || `ODF-${currentId}`,
            dbId: currentId,
          };

          // Find ODF port for this fiber
          if (currentFiber) {
            const odfPorts = await db.odfPorts.where("odfId").equals(currentId).toArray();
            const port = odfPorts.find((p) => p.portNumber === currentFiber);
            if (port) {
              segment.portInfo = {
                portId: port.id!,
                portNumber: port.portNumber,
                status: port.status,
              };
              segment.fiberIn = {
                number: currentFiber,
                color: getFiberInfo(currentFiber, 48)?.fiberColor.name || "Unknown",
                tube: getFiberInfo(currentFiber, 48)?.tubeColor.name || "Unknown",
              };
              ctx.connectorCount++;
            }
          }

          ctx.segments.unshift(segment);
          currentType = "olt";
          currentId = odf.oltId;
        } else {
          // Enclosure (closure, lcp, nap)
          const enclosure = await db.enclosures.get(currentId);
          if (!enclosure) {
            ctx.missingLinks.push(`${currentType} ${currentId} not found`);
            break;
          }

          const segment: PathSegment = {
            order: 0,
            nodeId: `${enclosure.type}-${currentId}`,
            nodeType: enclosure.type as FiberPathNodeType,
            nodeName: enclosure.name || `${enclosure.type.toUpperCase()}-${currentId}`,
            dbId: currentId,
          };

          // For closures, find splice connecting to upstream
          const isClosure = enclosure.type.includes("closure") || enclosure.type === "handhole" || enclosure.type === "pedestal";
          if (isClosure) {
            const trays = await db.trays.where("enclosureId").equals(currentId).toArray();

            for (const tray of trays) {
              if (!tray.id) continue;
              const splices = await db.splices.where("trayId").equals(tray.id).toArray();

              // Find splice where our fiber is on the B side (downstream)
              const foundSplice = splices.find((s) => s.fiberB === currentFiber);
              if (foundSplice) {
                const fiberInfoA = getFiberInfo(foundSplice.fiberA, 48);
                const fiberInfoB = getFiberInfo(foundSplice.fiberB, 48);

                segment.fiberIn = {
                  number: foundSplice.fiberB,
                  color: foundSplice.fiberBColor || fiberInfoB?.fiberColor.name || "Unknown",
                  tube: foundSplice.tubeBColor || fiberInfoB?.tubeColor.name || "Unknown",
                };
                segment.fiberOut = {
                  number: foundSplice.fiberA,
                  color: foundSplice.fiberAColor || fiberInfoA?.fiberColor.name || "Unknown",
                  tube: foundSplice.tubeAColor || fiberInfoA?.tubeColor.name || "Unknown",
                };
                segment.spliceInfo = {
                  spliceId: foundSplice.id!,
                  trayId: foundSplice.trayId,
                  trayNumber: tray.number,
                  loss: foundSplice.loss || 0.05,
                  status: foundSplice.status as "completed" | "pending" | "failed",
                };

                ctx.totalLoss += foundSplice.loss || 0.05;
                ctx.spliceCount++;
                currentFiber = foundSplice.fiberA;
                break;
              }
            }
          }

          // For LCP/NAP, check for splitter
          if (enclosure.type === "lcp" || enclosure.type === "fdt") {
            const splitters = await db.splitters.where("enclosureId").equals(currentId).toArray();
            if (splitters.length > 0) {
              const splitter = splitters[0];
              segment.splitterInfo = {
                splitterId: splitter.id!,
                type: splitter.type,
                inputPort: 1,
                outputPort: currentFiber || 1,
              };
              // Splitter loss based on type
              const splitterLoss = {
                "1:2": 3.5,
                "1:4": 7.0,
                "1:8": 10.5,
                "1:16": 14.0,
                "1:32": 17.5,
              };
              ctx.totalLoss += splitterLoss[splitter.type as keyof typeof splitterLoss] || 10;
            }
          }

          ctx.segments.unshift(segment);

          // Move to parent
          if (enclosure.parentType && enclosure.parentId) {
            currentType = enclosure.parentType === "closure" ? "splice-closure" : enclosure.parentType;
            currentId = enclosure.parentId;
          } else if (enclosure.odfPortId) {
            // Connected to ODF
            const odfPort = await db.odfPorts.get(enclosure.odfPortId);
            if (odfPort) {
              currentType = "odf";
              currentId = odfPort.odfId;
              currentFiber = odfPort.portNumber;
            } else {
              break;
            }
          } else {
            ctx.missingLinks.push(`${enclosure.type} ${enclosure.name} has no upstream connection`);
            break;
          }
        }
      }

      // Add OLT at the start if we reached it
      if (currentType === "olt" && currentId > 0) {
        const olt = await db.olts.get(currentId);
        if (olt) {
          const segment: PathSegment = {
            order: 0,
            nodeId: `olt-${currentId}`,
            nodeType: "olt",
            nodeName: olt.name || `OLT-${currentId}`,
            dbId: currentId,
          };

          if (currentFiber) {
            segment.fiberOut = {
              number: currentFiber,
              color: getFiberInfo(currentFiber, 48)?.fiberColor.name || "Unknown",
              tube: getFiberInfo(currentFiber, 48)?.tubeColor.name || "Unknown",
            };
          }

          ctx.segments.unshift(segment);
        }
      }
    },
    []
  );

  /**
   * Trace fiber path downstream (toward customer)
   */
  const traceDownstream = useCallback(
    async (
      startNodeType: FiberPathNodeType,
      startDbId: number,
      startFiber: number | undefined,
      ctx: TraceContext
    ): Promise<void> => {
      let currentType: FiberPathNodeType | string = startNodeType;
      let currentId = startDbId;
      let currentFiber = startFiber;

      while (currentType !== "nap" && currentType !== "customer" && currentId > 0) {
        const nodeKey = `${currentType}-${currentId}`;
        if (ctx.visitedNodes.has(nodeKey)) break;
        ctx.visitedNodes.add(nodeKey);

        if (currentType === "olt") {
          const olt = await db.olts.get(currentId);
          if (!olt) {
            ctx.missingLinks.push(`OLT ${currentId} not found`);
            break;
          }

          // Find ODFs connected to this OLT
          const odfs = await db.odfs.where("oltId").equals(currentId).toArray();
          if (odfs.length > 0) {
            currentType = "odf";
            currentId = odfs[0].id!;
          } else {
            ctx.missingLinks.push(`No ODF connected to OLT ${olt.name}`);
            break;
          }
        } else if (currentType === "odf") {
          const odf = await db.odfs.get(currentId);
          if (!odf) break;

          // Find closures connected to this ODF
          const odfPorts = await db.odfPorts.where("odfId").equals(currentId).toArray();
          const connectedPort = odfPorts.find((p) => p.closureId && (currentFiber ? p.portNumber === currentFiber : true));

          if (connectedPort?.closureId) {
            currentType = "splice-closure";
            currentId = connectedPort.closureId;
            currentFiber = connectedPort.portNumber;
          } else {
            ctx.missingLinks.push(`No closure connected to ODF ${odf.name}`);
            break;
          }
        } else {
          // Enclosure - find children
          const enclosure = await db.enclosures.get(currentId);
          if (!enclosure) break;

          // Find child enclosures
          const children = await db.enclosures
            .where("parentId")
            .equals(currentId)
            .filter((e) => e.parentType === currentType || e.parentType === "closure")
            .toArray();

          if (children.length > 0) {
            // Continue to first child (could be enhanced to follow specific fiber)
            const child = children[0];
            currentType = child.type as FiberPathNodeType;
            currentId = child.id!;

            const segment: PathSegment = {
              order: ctx.segments.length,
              nodeId: `${child.type}-${child.id}`,
              nodeType: child.type as FiberPathNodeType,
              nodeName: child.name || `${child.type.toUpperCase()}-${child.id}`,
              dbId: child.id!,
            };

            // Check for ports (NAP)
            if (child.type === "nap" || child.type === "fat") {
              const ports = await db.ports.where("enclosureId").equals(child.id!).toArray();
              const connectedPort = ports.find((p) => p.status === "connected");
              if (connectedPort) {
                segment.portInfo = {
                  portId: connectedPort.id!,
                  portNumber: connectedPort.portNumber,
                  status: connectedPort.status,
                  customerName: connectedPort.customerName,
                  customerAddress: connectedPort.customerAddress,
                  serviceId: connectedPort.serviceId,
                };
              }
            }

            ctx.segments.push(segment);
          } else {
            // No children, this is the end
            break;
          }
        }
      }
    },
    []
  );

  /**
   * Helper to build the start segment
   */
  const buildStartSegment = async (
    nodeType: FiberPathNodeType,
    dbId: number,
    fiber?: number
  ): Promise<PathSegment | null> => {
    let name = "";
    let actualType = nodeType;

    switch (nodeType) {
      case "olt": {
        const olt = await db.olts.get(dbId);
        name = olt?.name || `OLT-${dbId}`;
        break;
      }
      case "odf": {
        const odf = await db.odfs.get(dbId);
        name = odf?.name || `ODF-${dbId}`;
        break;
      }
      default: {
        const enc = await db.enclosures.get(dbId);
        if (enc) {
          name = enc.name || `${enc.type.toUpperCase()}-${dbId}`;
          actualType = enc.type as FiberPathNodeType;
        }
        break;
      }
    }

    if (!name) return null;

    const segment: PathSegment = {
      order: 0,
      nodeId: `${actualType}-${dbId}`,
      nodeType: actualType,
      nodeName: name,
      dbId,
    };

    if (fiber) {
      const fiberInfo = getFiberInfo(fiber, 48);
      segment.fiberIn = {
        number: fiber,
        color: fiberInfo?.fiberColor.name || "Unknown",
        tube: fiberInfo?.tubeColor.name || "Unknown",
      };
    }

    return segment;
  };

  /**
   * Main trace function - traces from any node bidirectionally
   */
  const tracePath = useCallback(
    async (
      startNodeType: FiberPathNodeType,
      startDbId: number,
      startFiber?: number,
      edges?: Edge[]
    ): Promise<FiberPathTraceResult> => {
      try {
        const ctx: TraceContext = {
          visitedNodes: new Set(),
          segments: [],
          totalLoss: 0,
          spliceCount: 0,
          connectorCount: 0,
          totalDistance: 0,
          missingLinks: [],
        };

        // First, add the start node as a segment
        const startSegment = await buildStartSegment(startNodeType, startDbId, startFiber);
        if (startSegment) {
          ctx.segments.push(startSegment);
          ctx.visitedNodes.add(`${startNodeType}-${startDbId}`);
        }

        // Trace upstream (toward OLT)
        await traceUpstream(startNodeType, startDbId, startFiber, ctx);

        // Reset visited for downstream (start node already included)
        ctx.visitedNodes.clear();
        ctx.visitedNodes.add(`${startNodeType}-${startDbId}`);

        // Trace downstream (toward customer)
        await traceDownstream(startNodeType, startDbId, startFiber, ctx);

        // Renumber segments in order
        ctx.segments.forEach((seg, idx) => {
          seg.order = idx;
        });

        // Build highlighted node and edge IDs
        const highlightedNodeIds = ctx.segments.map((s) => s.nodeId);
        const highlightedEdgeIds: string[] = [];

        // Find edges connecting our path nodes
        if (edges) {
          for (let i = 0; i < ctx.segments.length - 1; i++) {
            const sourceId = ctx.segments[i].nodeId;
            const targetId = ctx.segments[i + 1].nodeId;

            const edge = edges.find(
              (e) =>
                (e.source === sourceId && e.target === targetId) ||
                (e.source === targetId && e.target === sourceId)
            );
            if (edge) {
              highlightedEdgeIds.push(edge.id);
            }
          }
        }

        // Build the fiber path result
        const path: FiberPath = {
          id: `path-${Date.now()}`,
          projectId: projectId || 1,
          startNodeType: ctx.segments[0]?.nodeType || startNodeType,
          startNodeId: ctx.segments[0]?.nodeId || `${startNodeType}-${startDbId}`,
          startDbId: ctx.segments[0]?.dbId || startDbId,
          startDescription: ctx.segments[0]?.nodeName || "Unknown",
          endNodeType: ctx.segments[ctx.segments.length - 1]?.nodeType || startNodeType,
          endNodeId: ctx.segments[ctx.segments.length - 1]?.nodeId || `${startNodeType}-${startDbId}`,
          endDbId: ctx.segments[ctx.segments.length - 1]?.dbId || startDbId,
          endDescription: ctx.segments[ctx.segments.length - 1]?.nodeName || "Unknown",
          segments: ctx.segments,
          totalLoss: Math.round(ctx.totalLoss * 100) / 100,
          totalDistance: ctx.totalDistance,
          spliceCount: ctx.spliceCount,
          connectorCount: ctx.connectorCount,
          status: ctx.missingLinks.length === 0 ? "complete" : "partial",
          missingLinks: ctx.missingLinks,
        };

        return {
          success: true,
          path,
          highlightedNodeIds,
          highlightedEdgeIds,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error during path tracing",
          highlightedNodeIds: [],
          highlightedEdgeIds: [],
        };
      }
    },
    [traceUpstream, traceDownstream, projectId]
  );

  /**
   * Clear path highlight
   */
  const clearTrace = useCallback((): FiberPathTraceResult => {
    return {
      success: true,
      highlightedNodeIds: [],
      highlightedEdgeIds: [],
    };
  }, []);

  return { tracePath, clearTrace };
}
