"use client";

import { useCallback, useState, useEffect, useMemo, useRef } from "react";
import ReactFlow, {
  Node,
  Edge,
  Controls,
  MiniMap,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  NodeChange,
  Panel,
  BackgroundVariant,
  ReactFlowProvider,
  useReactFlow,
  SelectionMode,
} from "reactflow";
import "reactflow/dist/style.css";
import {
  LayoutGrid,
  Plus,
  Search,
  Trash2,
  Edit,
  X,
  ChevronDown,
  MapPin,
  Server,
  Box,
  Link2,
  GitBranch,
  Network,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Palette,
  Undo2,
  Redo2,
} from "lucide-react";
import { db, updateNodePosition, deleteOLT, deleteODF, deleteEnclosure, type NodeType } from "@/lib/db";
import {
  useOLTs,
  useODFs,
  useEnclosures,
} from "@/lib/db/hooks";
import { useNetwork } from "@/contexts/NetworkContext";
import { NodeActionsProvider } from "@/contexts/NodeActionsContext";
import { expandableNodeTypes } from "./nodes/ExpandableNodes";
import { fiberEdgeTypes } from "./edges/FiberEdge";
import { getLayoutedElements } from "@/lib/topology/layoutUtils";
import { FloatingPalette } from "./FloatingPalette";
import { FloatingSplicePanel } from "./FloatingSplicePanel";
import LocationPicker from "@/components/map/LocationPicker";
import { useUndoRedo, createCommand } from "@/hooks/useUndoRedo";
import { NodeEditDialog } from "./NodeEditDialog";
import type { OLT, ODF, Enclosure } from "@/types";

// Combine edge types
const edgeTypes = {
  ...fiberEdgeTypes,
};

interface TopologyCanvasProps {
  projectId?: number; // Optional - will use context if not provided
}

interface ContextMenu {
  x: number;
  y: number;
  nodeId: string;
  nodeType: string;
}

interface AddNodeDialog {
  parentId: string;
  parentType: string;
  allowedTypes: string[];
}

// Convert database data to React Flow nodes/edges
function buildFlowData(
  olts: OLT[],
  odfs: ODF[],
  enclosures: Enclosure[],
  useAutoLayout: boolean = true
): { nodes: Node[]; edges: Edge[]; hasPersistedPositions: boolean } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  let hasPersistedPositions = false;

  // Add OLT nodes
  olts.forEach((olt, idx) => {
    // Use persisted position if available, otherwise use auto-layout position
    const hasPosition = olt.canvasX !== undefined && olt.canvasY !== undefined;
    if (hasPosition) hasPersistedPositions = true;

    nodes.push({
      id: `olt-${olt.id}`,
      type: "olt",
      position: hasPosition
        ? { x: olt.canvasX!, y: olt.canvasY! }
        : { x: idx * 250, y: 0 },
      data: {
        label: olt.name,
        type: "olt",
        portCount: olt.totalPonPorts,
        hasGps: !!(olt.gpsLat && olt.gpsLng),
        dbId: olt.id,
        nodeType: "olt" as NodeType,
      },
    });
  });

  // Add ODF nodes
  odfs.forEach((odf, idx) => {
    const hasPosition = odf.canvasX !== undefined && odf.canvasY !== undefined;
    if (hasPosition) hasPersistedPositions = true;

    nodes.push({
      id: `odf-${odf.id}`,
      type: "odf",
      position: hasPosition
        ? { x: odf.canvasX!, y: odf.canvasY! }
        : { x: idx * 200, y: 100 },
      data: {
        label: odf.name,
        type: "odf",
        portCount: odf.portCount,
        hasGps: !!(odf.gpsLat && odf.gpsLng),
        dbId: odf.id,
        nodeType: "odf" as NodeType,
      },
    });
    // Edge from OLT to ODF
    edges.push({
      id: `e-olt-${odf.oltId}-odf-${odf.id}`,
      source: `olt-${odf.oltId}`,
      target: `odf-${odf.id}`,
      type: "fiber",
      data: {
        label: "OLT-ODF Link",
        sourceColor: "#14b8a6", // teal (OLT color)
        targetColor: "#06b6d4", // cyan (ODF color)
        cable: { name: "Patch", fiberCount: 1 },
      },
    });
  });

  // Group enclosures by type for positioning
  const closures = enclosures.filter(
    (e) => e.type === "splice-closure" || e.type === "handhole" || e.type === "pedestal"
  );
  const lcps = enclosures.filter((e) => e.type === "lcp" || e.type === "fdt");
  const naps = enclosures.filter((e) => e.type === "nap" || e.type === "fat");

  // Add Closure nodes
  closures.forEach((enc, idx) => {
    const hasPosition = enc.canvasX !== undefined && enc.canvasY !== undefined;
    if (hasPosition) hasPersistedPositions = true;

    nodes.push({
      id: `closure-${enc.id}`,
      type: "closure",
      position: hasPosition
        ? { x: enc.canvasX!, y: enc.canvasY! }
        : { x: idx * 200, y: 200 },
      data: {
        label: enc.name,
        type: "closure",
        hasGps: !!(enc.gpsLat && enc.gpsLng),
        dbId: enc.id,
        nodeType: "enclosure" as NodeType,
        expanded: enc.expanded,
      },
    });

    // Edge from parent
    if (enc.parentType === "odf" && enc.parentId) {
      edges.push({
        id: `e-odf-${enc.parentId}-closure-${enc.id}`,
        source: `odf-${enc.parentId}`,
        target: `closure-${enc.id}`,
        type: "fiber",
        data: {
          sourceColor: "#06b6d4", // cyan (ODF)
          targetColor: "#a855f7", // purple (Closure)
          cable: { name: "Feeder", fiberCount: 48 },
        },
      });
    } else if (enc.parentType === "olt" && enc.parentId) {
      edges.push({
        id: `e-olt-${enc.parentId}-closure-${enc.id}`,
        source: `olt-${enc.parentId}`,
        target: `closure-${enc.id}`,
        type: "fiber",
        data: {
          sourceColor: "#14b8a6", // teal (OLT)
          targetColor: "#a855f7", // purple (Closure)
          cable: { name: "Trunk", fiberCount: 96 },
        },
      });
    } else if (enc.parentType === "closure" && enc.parentId) {
      // Cascading closure
      edges.push({
        id: `e-closure-${enc.parentId}-closure-${enc.id}`,
        source: `closure-${enc.parentId}`,
        target: `closure-${enc.id}`,
        type: "fiber",
        data: {
          sourceColor: "#a855f7", // purple
          targetColor: "#a855f7", // purple
          cable: { name: "Dist", fiberCount: 24 },
          animated: true, // Animated for cascading
        },
      });
    }
  });

  // Add LCP nodes
  lcps.forEach((enc, idx) => {
    const hasPosition = enc.canvasX !== undefined && enc.canvasY !== undefined;
    if (hasPosition) hasPersistedPositions = true;

    nodes.push({
      id: `lcp-${enc.id}`,
      type: "lcp",
      position: hasPosition
        ? { x: enc.canvasX!, y: enc.canvasY! }
        : { x: idx * 180, y: 300 },
      data: {
        label: enc.name,
        type: "lcp",
        hasGps: !!(enc.gpsLat && enc.gpsLng),
        dbId: enc.id,
        nodeType: "enclosure" as NodeType,
        expanded: enc.expanded,
      },
    });

    // Edge from parent (closure or olt)
    if (enc.parentType === "closure" && enc.parentId) {
      edges.push({
        id: `e-closure-${enc.parentId}-lcp-${enc.id}`,
        source: `closure-${enc.parentId}`,
        target: `lcp-${enc.id}`,
        type: "fiber",
        data: {
          sourceColor: "#a855f7", // purple (Closure)
          targetColor: "#f97316", // orange (LCP)
          cable: { name: "Dist", fiberCount: 12 },
        },
      });
    } else if (enc.parentType === "olt" && enc.parentId) {
      edges.push({
        id: `e-olt-${enc.parentId}-lcp-${enc.id}`,
        source: `olt-${enc.parentId}`,
        target: `lcp-${enc.id}`,
        type: "fiber",
        data: {
          sourceColor: "#14b8a6", // teal (OLT)
          targetColor: "#f97316", // orange (LCP)
          cable: { name: "Trunk", fiberCount: 48 },
        },
      });
    }
  });

  // Add NAP nodes
  naps.forEach((enc, idx) => {
    const hasPosition = enc.canvasX !== undefined && enc.canvasY !== undefined;
    if (hasPosition) hasPersistedPositions = true;

    nodes.push({
      id: `nap-${enc.id}`,
      type: "nap",
      position: hasPosition
        ? { x: enc.canvasX!, y: enc.canvasY! }
        : { x: idx * 160, y: 400 },
      data: {
        label: enc.name,
        type: "nap",
        hasGps: !!(enc.gpsLat && enc.gpsLng),
        dbId: enc.id,
        nodeType: "enclosure" as NodeType,
        expanded: enc.expanded,
      },
    });

    // Edge from parent LCP
    if (enc.parentType === "lcp" && enc.parentId) {
      edges.push({
        id: `e-lcp-${enc.parentId}-nap-${enc.id}`,
        source: `lcp-${enc.parentId}`,
        target: `nap-${enc.id}`,
        type: "fiber",
        data: {
          sourceColor: "#f97316", // orange (LCP)
          targetColor: "#3b82f6", // blue (NAP)
          cable: { name: "Drop", fiberCount: 4 },
          animated: true, // Show active customer drop
        },
      });
    }
  });

  return { nodes, edges, hasPersistedPositions };
}

function TopologyCanvasInner({ projectId: propProjectId }: TopologyCanvasProps) {
  // Use prop if provided, otherwise use context
  const { projectId: contextProjectId } = useNetwork();
  const projectId = propProjectId ?? contextProjectId ?? undefined;

  const reactFlowInstance = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [addDialog, setAddDialog] = useState<AddNodeDialog | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showMinimap, setShowMinimap] = useState(true);
  const [newNodeName, setNewNodeName] = useState("");
  const [newNodeType, setNewNodeType] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{ nodeId: string; childCount: number } | null>(null);
  const [showPalette, setShowPalette] = useState(true);
  const [splicePanel, setSplicePanel] = useState<{
    edgeId: string;
    cableAName: string;
    cableBName: string;
    fiberCountA: number;
    fiberCountB: number;
    connections: Array<{
      fiberA: number;
      fiberB: number;
      colorA: string;
      colorB: string;
      status: "completed" | "pending" | "failed";
    }>;
  } | null>(null);
  const [editDialog, setEditDialog] = useState<{ nodeId: string; nodeType: string; dbId: number } | null>(null);
  const [gpsDialog, setGpsDialog] = useState<{ nodeId: string; nodeType: string; dbId: number; lat?: number; lng?: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  // Initialize undo/redo system
  const {
    executeCommand,
    undoCommand,
    redoCommand,
    canUndoCommand,
    canRedoCommand,
  } = useUndoRedo(null);

  // Fetch data using reactive hooks (useLiveQuery) for automatic updates
  const olts = useOLTs(projectId);
  const odfs = useODFs(projectId);
  const enclosures = useEnclosures(projectId);

  // Build flow data when data changes - callbacks injected in separate useEffect
  useEffect(() => {
    if (olts && enclosures && odfs) {
      const { nodes: newNodes, edges: newEdges, hasPersistedPositions } = buildFlowData(
        olts,
        odfs,
        enclosures
      );
      // Apply auto-layout only if this is first load AND no persisted positions
      if (nodes.length === 0 && newNodes.length > 0 && !hasPersistedPositions) {
        const layouted = getLayoutedElements(newNodes, newEdges);
        setNodes(layouted.nodes);
        setEdges(layouted.edges);
        // Fit view after layout
        setTimeout(() => {
          reactFlowInstance.fitView({ padding: 0.2 });
        }, 100);
      } else {
        setNodes(newNodes);
        setEdges(newEdges);
        // Fit view for first load with persisted positions
        if (nodes.length === 0 && hasPersistedPositions) {
          setTimeout(() => {
            reactFlowInstance.fitView({ padding: 0.2 });
          }, 100);
        }
      }
    }
  }, [olts, odfs, enclosures]);

  // Handle node drag stop - persist position to database
  const onNodeDragStop = useCallback(
    async (_event: React.MouseEvent, node: Node) => {
      const { dbId, nodeType } = node.data;
      if (dbId && nodeType) {
        try {
          await updateNodePosition(nodeType, dbId, node.position.x, node.position.y);
        } catch (err) {
          console.error("Failed to persist node position:", err);
        }
      }
    },
    []
  );

  // Handle drag over for palette items
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  // Handle drop from palette to create new nodes
  const onDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault();

      if (!projectId || !reactFlowWrapper.current) return;

      const type = event.dataTransfer.getData("application/reactflow");
      if (!type) return;

      // Get drop position in flow coordinates
      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });

      try {
        // Create node based on type
        if (type === "olt") {
          // OLT is a root node - create directly
          await db.olts.add({
            projectId,
            name: `OLT-${Date.now().toString(36).toUpperCase()}`,
            totalPonPorts: 16,
            createdAt: new Date(),
            canvasX: position.x,
            canvasY: position.y,
          });
        } else if (type === "odf") {
          // ODF needs an OLT parent - find closest or first OLT
          const closestOlt = olts?.[0];
          if (!closestOlt) {
            alert("Please create an OLT first before adding ODFs");
            return;
          }
          await db.odfs.add({
            projectId,
            oltId: closestOlt.id!,
            name: `ODF-${Date.now().toString(36).toUpperCase()}`,
            portCount: 48,
            createdAt: new Date(),
            canvasX: position.x,
            canvasY: position.y,
          });
        } else if (type === "closure") {
          // Closure can be parented to OLT, ODF, or another Closure
          // Default to first OLT if exists
          const parentOlt = olts?.[0];
          if (!parentOlt) {
            alert("Please create an OLT first before adding Closures");
            return;
          }
          await db.enclosures.add({
            projectId,
            name: `CL-${Date.now().toString(36).toUpperCase()}`,
            type: "splice-closure",
            parentType: "olt",
            parentId: parentOlt.id!,
            createdAt: new Date(),
            canvasX: position.x,
            canvasY: position.y,
          });
        } else if (type === "lcp") {
          // LCP needs an OLT or Closure parent
          const parentOlt = olts?.[0];
          if (!parentOlt) {
            alert("Please create an OLT first before adding LCPs");
            return;
          }
          await db.enclosures.add({
            projectId,
            name: `LCP-${Date.now().toString(36).toUpperCase()}`,
            type: "lcp",
            parentType: "olt",
            parentId: parentOlt.id!,
            createdAt: new Date(),
            canvasX: position.x,
            canvasY: position.y,
          });
        } else if (type === "nap") {
          // NAP needs an LCP parent
          const lcpEnclosure = enclosures?.find((e) => e.type === "lcp" || e.type === "fdt");
          if (!lcpEnclosure) {
            alert("Please create an LCP first before adding NAPs");
            return;
          }
          await db.enclosures.add({
            projectId,
            name: `NAP-${Date.now().toString(36).toUpperCase()}`,
            type: "nap",
            parentType: "lcp",
            parentId: lcpEnclosure.id!,
            createdAt: new Date(),
            canvasX: position.x,
            canvasY: position.y,
          });
        }
      } catch (err) {
        console.error("Failed to create node from drop:", err);
        alert("Failed to create node");
      }
    },
    [projectId, reactFlowInstance, olts, enclosures]
  );

  // Handle drag start from palette (no-op, just for the callback)
  const onPaletteDragStart = useCallback(
    (_event: React.DragEvent, _nodeType: string) => {
      // The actual data transfer is set in FloatingPalette
    },
    []
  );

  // Handle node right-click
  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        nodeId: node.id,
        nodeType: node.data.type,
      });
    },
    []
  );

  // Validate and handle new connections between nodes
  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target || !projectId) return;

      // Parse node types from IDs
      const sourceType = connection.source.split("-")[0];
      const targetType = connection.target.split("-")[0];
      const sourceDbId = parseInt(connection.source.split("-")[1]);
      const targetDbId = parseInt(connection.target.split("-")[1]);

      // Validate connection based on hierarchy rules
      const validConnections: Record<string, string[]> = {
        olt: ["odf", "closure", "lcp"],
        odf: ["closure"],
        closure: ["closure", "lcp"],
        lcp: ["nap"],
      };

      if (!validConnections[sourceType]?.includes(targetType)) {
        console.warn(`Invalid connection: ${sourceType} → ${targetType}`);
        return;
      }

      // Update the target node's parent reference in the database
      try {
        if (targetType === "odf") {
          // ODF's parent is always OLT (via oltId field)
          await db.odfs.update(targetDbId, { oltId: sourceDbId });
        } else if (["closure", "lcp", "nap"].includes(targetType)) {
          // These are enclosures with parentType/parentId
          const parentTypeMap: Record<string, "olt" | "odf" | "closure" | "lcp"> = {
            olt: "olt",
            odf: "odf",
            closure: "closure",
            lcp: "lcp",
          };
          await db.enclosures.update(targetDbId, {
            parentType: parentTypeMap[sourceType],
            parentId: sourceDbId,
          });
        }

        // Add the edge visually with fiber styling
        const sourceColors: Record<string, string> = {
          olt: "#14b8a6",
          odf: "#06b6d4",
          closure: "#a855f7",
          lcp: "#f97316",
        };
        const targetColors: Record<string, string> = {
          odf: "#06b6d4",
          closure: "#a855f7",
          lcp: "#f97316",
          nap: "#3b82f6",
        };

        const newEdge: Edge = {
          id: `e-${connection.source}-${connection.target}`,
          source: connection.source,
          target: connection.target,
          type: "fiber",
          data: {
            sourceColor: sourceColors[sourceType] || "#a855f7",
            targetColor: targetColors[targetType] || "#a855f7",
            cable: { name: "New Link", fiberCount: 12 },
          },
        };

        setEdges((eds) => addEdge(newEdge, eds));
      } catch (err) {
        console.error("Failed to create connection:", err);
      }
    },
    [projectId, setEdges]
  );

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  // Auto-layout
  const handleAutoLayout = useCallback(() => {
    const layouted = getLayoutedElements(nodes, edges);
    setNodes(layouted.nodes);
    setEdges(layouted.edges);
    setTimeout(() => {
      reactFlowInstance.fitView({ padding: 0.2 });
    }, 50);
  }, [nodes, edges, reactFlowInstance, setNodes, setEdges]);

  // Fit to view
  const handleFitView = useCallback(() => {
    reactFlowInstance.fitView({ padding: 0.2 });
  }, [reactFlowInstance]);

  // Get allowed child types for a node
  const getAllowedChildTypes = (nodeType: string): string[] => {
    switch (nodeType) {
      case "olt":
        return ["odf", "closure", "lcp"];
      case "odf":
        return ["closure"];
      case "closure":
        return ["closure", "lcp"]; // Cascading closures!
      case "lcp":
        return ["nap"];
      default:
        return [];
    }
  };

  // Handle add child
  const handleAddChild = () => {
    if (!contextMenu) return;
    const allowedTypes = getAllowedChildTypes(contextMenu.nodeType);
    if (allowedTypes.length === 0) {
      alert("This node type cannot have children");
      return;
    }
    setAddDialog({
      parentId: contextMenu.nodeId,
      parentType: contextMenu.nodeType,
      allowedTypes,
    });
    setNewNodeType(allowedTypes[0]);
    setNewNodeName("");
    setContextMenu(null);
  };

  // Create new node
  const handleCreateNode = async () => {
    if (!addDialog || !newNodeName.trim() || !newNodeType || !projectId) return;

    const parentParts = addDialog.parentId.split("-");
    const parentDbId = parseInt(parentParts[parentParts.length - 1]);

    try {
      if (newNodeType === "odf") {
        await db.odfs.add({
          projectId,
          oltId: parentDbId,
          name: newNodeName.trim(),
          portCount: 48,
          createdAt: new Date(),
        });
      } else if (newNodeType === "closure") {
        const parentType = addDialog.parentType === "odf" ? "odf" :
                          addDialog.parentType === "olt" ? "olt" : "closure";
        await db.enclosures.add({
          projectId,
          name: newNodeName.trim(),
          type: "splice-closure",
          parentType: parentType as "odf" | "olt" | "closure",
          parentId: parentDbId,
          createdAt: new Date(),
        });
      } else if (newNodeType === "lcp") {
        const parentType = addDialog.parentType === "olt" ? "olt" : "closure";
        await db.enclosures.add({
          projectId,
          name: newNodeName.trim(),
          type: "lcp",
          parentType: parentType as "olt" | "closure",
          parentId: parentDbId,
          createdAt: new Date(),
        });
      } else if (newNodeType === "nap") {
        await db.enclosures.add({
          projectId,
          name: newNodeName.trim(),
          type: "nap",
          parentType: "lcp",
          parentId: parentDbId,
          createdAt: new Date(),
        });
      }
      setAddDialog(null);
    } catch (err) {
      console.error("Failed to create node:", err);
      alert("Failed to create node");
    }
  };

  // Count children of a node
  const countChildren = useCallback((nodeId: string): number => {
    return edges.filter((e) => e.source === nodeId).length;
  }, [edges]);

  // Perform delete with cascade
  const performDelete = useCallback(async (nodeId: string) => {
    const parts = nodeId.split("-");
    const type = parts[0];
    const dbId = parseInt(parts[parts.length - 1]);

    try {
      // Get all child node IDs recursively
      const getChildIds = (id: string): string[] => {
        const children = edges.filter((e) => e.source === id).map((e) => e.target);
        return children.concat(children.flatMap(getChildIds));
      };

      const allNodeIds = [nodeId, ...getChildIds(nodeId)];

      // Delete from database using cascade-aware functions
      for (const id of allNodeIds) {
        const [t, idStr] = id.split("-");
        const dbIdToDelete = parseInt(idStr);
        if (t === "olt") {
          await deleteOLT(dbIdToDelete);
        } else if (t === "odf") {
          await deleteODF(dbIdToDelete);
        } else if (t === "closure" || t === "lcp" || t === "nap") {
          await deleteEnclosure(dbIdToDelete);
        }
      }

      setDeleteConfirm(null);
    } catch (err) {
      console.error("Failed to delete:", err);
      alert("Failed to delete node");
    }
  }, [edges]);

  // Handle delete from context menu
  const handleDelete = useCallback(() => {
    if (!contextMenu) return;
    const childCount = countChildren(contextMenu.nodeId);
    if (childCount > 0) {
      setDeleteConfirm({ nodeId: contextMenu.nodeId, childCount });
    } else {
      performDelete(contextMenu.nodeId);
    }
    setContextMenu(null);
  }, [contextMenu, countChildren, performDelete]);

  // =============================================
  // NODE ACTION HANDLERS (for NodeActionsContext)
  // =============================================

  // Handle add child from toolbar
  const handleNodeAddChild = useCallback((nodeId: string, nodeType: string) => {
    const allowedTypes = getAllowedChildTypes(nodeType);
    if (allowedTypes.length === 0) {
      alert("This node type cannot have children");
      return;
    }
    setAddDialog({
      parentId: nodeId,
      parentType: nodeType,
      allowedTypes,
    });
    setNewNodeType(allowedTypes[0]);
    setNewNodeName("");
  }, []);

  // Handle edit from toolbar
  const handleNodeEdit = useCallback((nodeId: string, nodeType: string) => {
    // Extract dbId from nodeId (format: "type-id")
    const parts = nodeId.split("-");
    const dbId = parseInt(parts[parts.length - 1]);
    setEditDialog({ nodeId, nodeType, dbId });
  }, []);

  // Handle delete from toolbar
  const handleNodeDelete = useCallback((nodeId: string) => {
    const childCount = countChildren(nodeId);
    if (childCount > 0) {
      setDeleteConfirm({ nodeId, childCount });
    } else {
      performDelete(nodeId);
    }
  }, [countChildren, performDelete]);

  // Handle keyboard shortcuts (Delete key)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if dialog is open or if in an input field
      if (editDialog || addDialog || gpsDialog || deleteConfirm) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // Delete or Backspace to delete selected node(s)
      if (e.key === "Delete" || e.key === "Backspace") {
        // Get all selected nodes (including OLTs)
        const selectedNodes = nodes.filter((n) => n.selected);

        if (selectedNodes.length > 0) {
          e.preventDefault();
          // Delete each selected node
          for (const node of selectedNodes) {
            handleNodeDelete(node.id);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nodes, editDialog, addDialog, gpsDialog, deleteConfirm, handleNodeDelete]);

  // Handle duplicate from toolbar
  const handleNodeDuplicate = useCallback(async (nodeId: string, nodeType: string) => {
    if (!projectId) return;

    const parts = nodeId.split("-");
    const dbId = parseInt(parts[parts.length - 1]);

    try {
      if (nodeType === "olt") {
        const original = await db.olts.get(dbId);
        if (original) {
          await db.olts.add({
            ...original,
            id: undefined,
            name: `${original.name}-copy`,
            canvasX: (original.canvasX || 0) + 50,
            canvasY: (original.canvasY || 0) + 50,
            createdAt: new Date(),
          });
        }
      } else if (nodeType === "odf") {
        const original = await db.odfs.get(dbId);
        if (original) {
          await db.odfs.add({
            ...original,
            id: undefined,
            name: `${original.name}-copy`,
            canvasX: (original.canvasX || 0) + 50,
            canvasY: (original.canvasY || 0) + 50,
            createdAt: new Date(),
          });
        }
      } else if (["closure", "lcp", "nap"].includes(nodeType)) {
        const original = await db.enclosures.get(dbId);
        if (original) {
          await db.enclosures.add({
            ...original,
            id: undefined,
            name: `${original.name}-copy`,
            canvasX: (original.canvasX || 0) + 50,
            canvasY: (original.canvasY || 0) + 50,
            createdAt: new Date(),
          });
        }
      }
    } catch (err) {
      console.error("Failed to duplicate:", err);
      alert("Failed to duplicate node");
    }
  }, [projectId]);

  // Handle set GPS location from toolbar
  const handleNodeSetLocation = useCallback(async (nodeId: string, nodeType: string) => {
    // Extract dbId from nodeId (format: "type-id")
    const parts = nodeId.split("-");
    const dbId = parseInt(parts[parts.length - 1]);

    // Fetch current GPS coordinates
    let lat: number | undefined;
    let lng: number | undefined;

    try {
      if (nodeType === "olt") {
        const olt = await db.olts.get(dbId);
        lat = olt?.gpsLat;
        lng = olt?.gpsLng;
      } else if (nodeType === "odf") {
        const odf = await db.odfs.get(dbId);
        lat = odf?.gpsLat;
        lng = odf?.gpsLng;
      } else {
        const enclosure = await db.enclosures.get(dbId);
        lat = enclosure?.gpsLat;
        lng = enclosure?.gpsLng;
      }
    } catch (err) {
      console.error("Failed to fetch GPS coordinates:", err);
    }

    setGpsDialog({ nodeId, nodeType, dbId, lat, lng });
  }, []);

  // Handle open splice editor for an edge
  const handleOpenSpliceEditor = useCallback((edgeId: string) => {
    // Find the edge and extract info
    const edge = edges.find(e => e.id === edgeId);
    if (!edge) return;

    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);

    setSplicePanel({
      edgeId,
      cableAName: sourceNode?.data?.label || "Cable A",
      cableBName: targetNode?.data?.label || "Cable B",
      fiberCountA: edge.data?.cable?.fiberCount || 12,
      fiberCountB: edge.data?.cable?.fiberCount || 12,
      connections: edge.data?.connections || [],
    });
  }, [edges, nodes]);

  // Save splice connections
  const handleSaveSplices = useCallback((connections: Array<{
    fiberA: number;
    fiberB: number;
    colorA: string;
    colorB: string;
    status: "completed" | "pending" | "failed";
  }>) => {
    if (!splicePanel) return;

    // Update the edge data with new connections
    setEdges(eds => eds.map(e => {
      if (e.id === splicePanel.edgeId) {
        return {
          ...e,
          data: {
            ...e.data,
            connections,
          },
        };
      }
      return e;
    }));

    setSplicePanel(null);
  }, [splicePanel, setEdges]);

  // Filter nodes by search AND inject action callbacks into node data
  const filteredNodes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        // Inject action callbacks into each node's data
        onAddChild: handleNodeAddChild,
        onEdit: handleNodeEdit,
        onDelete: handleNodeDelete,
        onDuplicate: handleNodeDuplicate,
        onSetLocation: handleNodeSetLocation,
      },
      style: query
        ? {
            ...node.style,
            opacity: node.data.label.toLowerCase().includes(query) ? 1 : 0.3,
          }
        : node.style,
    }));
  }, [nodes, searchQuery, handleNodeAddChild, handleNodeEdit, handleNodeDelete, handleNodeDuplicate, handleNodeSetLocation]);

  // Inject action callbacks into edge data
  const edgesWithCallbacks = useMemo(() => {
    return edges.map((edge) => ({
      ...edge,
      data: {
        ...edge.data,
        onOpenSpliceEditor: handleOpenSpliceEditor,
      },
    }));
  }, [edges, handleOpenSpliceEditor]);

  const typeIcons: Record<string, React.ReactNode> = {
    odf: <Box className="w-4 h-4" />,
    closure: <Link2 className="w-4 h-4" />,
    lcp: <GitBranch className="w-4 h-4" />,
    nap: <Network className="w-4 h-4" />,
  };

  return (
    <div ref={containerRef} className="w-full h-full min-h-[500px] bg-gray-50 overflow-hidden relative">
      {/* Floating Palette for drag-and-drop node creation */}
      <FloatingPalette
        onDragStart={onPaletteDragStart}
        onClose={() => setShowPalette(false)}
        isOpen={showPalette}
      />

      <div ref={reactFlowWrapper} className="w-full h-full">
        <NodeActionsProvider
          actions={{
            onAddChild: handleNodeAddChild,
            onEdit: handleNodeEdit,
            onDelete: handleNodeDelete,
            onDuplicate: handleNodeDuplicate,
            onSetLocation: handleNodeSetLocation,
            onOpenSpliceEditor: handleOpenSpliceEditor,
          }}
        >
        <ReactFlow
          nodes={filteredNodes}
          edges={edgesWithCallbacks}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeContextMenu={onNodeContextMenu}
          onNodeDragStop={onNodeDragStop}
          onDragOver={onDragOver}
          onDrop={onDrop}
          nodeTypes={expandableNodeTypes}
          edgeTypes={edgeTypes}
          fitView
          minZoom={0.1}
          maxZoom={2}
          defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
          proOptions={{ hideAttribution: true }}
          selectionOnDrag
          selectNodesOnDrag
          panOnDrag={[1, 2]}
          selectionMode={SelectionMode.Partial}
        >
        {/* Toolbar Panel */}
        <Panel position="top-left" className="flex gap-2">
          <div className="bg-white rounded-lg shadow-lg border p-2 flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search nodes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-sm border rounded-md w-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="w-px h-6 bg-gray-200" />

            {/* Undo */}
            <button
              onClick={() => undoCommand()}
              disabled={!canUndoCommand}
              className="p-2 hover:bg-gray-100 rounded-md text-gray-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="w-4 h-4" />
            </button>

            {/* Redo */}
            <button
              onClick={() => redoCommand()}
              disabled={!canRedoCommand}
              className="p-2 hover:bg-gray-100 rounded-md text-gray-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Redo (Ctrl+Y)"
            >
              <Redo2 className="w-4 h-4" />
            </button>

            <div className="w-px h-6 bg-gray-200" />

            {/* Auto Layout */}
            <button
              onClick={handleAutoLayout}
              className="p-2 hover:bg-gray-100 rounded-md text-gray-600 transition-colors"
              title="Auto Layout"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>

            {/* Fit View */}
            <button
              onClick={handleFitView}
              className="p-2 hover:bg-gray-100 rounded-md text-gray-600 transition-colors"
              title="Fit to View"
            >
              <Maximize2 className="w-4 h-4" />
            </button>

            {/* Toggle Minimap */}
            <button
              onClick={() => setShowMinimap(!showMinimap)}
              className={`p-2 rounded-md transition-colors ${
                showMinimap ? "bg-blue-100 text-blue-600" : "hover:bg-gray-100 text-gray-600"
              }`}
              title="Toggle Minimap"
            >
              <MapPin className="w-4 h-4" />
            </button>

            {/* Toggle Palette */}
            <button
              onClick={() => setShowPalette(!showPalette)}
              className={`p-2 rounded-md transition-colors ${
                showPalette ? "bg-purple-100 text-purple-600" : "hover:bg-gray-100 text-gray-600"
              }`}
              title="Toggle Component Palette"
            >
              <Palette className="w-4 h-4" />
            </button>
          </div>
        </Panel>

        {/* Legend */}
        <Panel position="top-right" className="bg-white rounded-lg shadow-lg border p-3">
          <div className="text-xs font-medium text-gray-500 mb-2">Node Types</div>
          <div className="space-y-1.5">
            {[
              { type: "olt", label: "OLT", color: "bg-teal-400" },
              { type: "odf", label: "ODF", color: "bg-cyan-400" },
              { type: "closure", label: "Closure", color: "bg-purple-400" },
              { type: "lcp", label: "LCP", color: "bg-orange-400" },
              { type: "nap", label: "NAP", color: "bg-blue-400" },
            ].map((item) => (
              <div key={item.type} className="flex items-center gap-2 text-xs text-gray-600">
                <div className={`w-3 h-3 rounded ${item.color}`} />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Controls
          showZoom={true}
          showFitView={false}
          showInteractive={false}
          className="!bg-white !shadow-lg !border !rounded-lg"
        />

        {showMinimap && (
          <MiniMap
            nodeColor={(node) => {
              const colors: Record<string, string> = {
                olt: "#14b8a6",
                odf: "#06b6d4",
                closure: "#a855f7",
                lcp: "#f97316",
                nap: "#3b82f6",
              };
              return colors[node.data?.type] || "#94a3b8";
            }}
            maskColor="rgba(0, 0, 0, 0.1)"
            className="!bg-white !shadow-lg !border !rounded-lg"
          />
        )}

        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e2e8f0" />
      </ReactFlow>
      </NodeActionsProvider>
      </div>

      {/* Floating Splice Panel */}
      {splicePanel && (
        <FloatingSplicePanel
          isOpen={true}
          onClose={() => setSplicePanel(null)}
          edgeId={splicePanel.edgeId}
          cableAName={splicePanel.cableAName}
          cableBName={splicePanel.cableBName}
          fiberCountA={splicePanel.fiberCountA}
          fiberCountB={splicePanel.fiberCountB}
          connections={splicePanel.connections}
          onSave={handleSaveSplices}
        />
      )}

      {/* Node Edit Dialog */}
      {editDialog && (
        <NodeEditDialog
          nodeId={editDialog.nodeId}
          nodeType={editDialog.nodeType}
          dbId={editDialog.dbId}
          onClose={() => setEditDialog(null)}
        />
      )}

      {/* GPS Location Dialog */}
      {gpsDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <MapPin className="w-5 h-5 text-indigo-600" />
                Set GPS Location
              </h3>
              <button
                onClick={() => setGpsDialog(null)}
                className="p-1 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-600 mb-4 text-sm">
              Setting location for: <span className="font-medium">{gpsDialog.nodeType.toUpperCase()}</span>
            </p>

            <LocationPicker
              latitude={gpsDialog.lat}
              longitude={gpsDialog.lng}
              onLocationChange={(lat, lng) => {
                setGpsDialog({ ...gpsDialog, lat, lng });
              }}
            />

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setGpsDialog(null)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!gpsDialog.lat || !gpsDialog.lng) {
                    alert("Please set a location first");
                    return;
                  }
                  try {
                    if (gpsDialog.nodeType === "olt") {
                      await db.olts.update(gpsDialog.dbId, { gpsLat: gpsDialog.lat, gpsLng: gpsDialog.lng });
                    } else if (gpsDialog.nodeType === "odf") {
                      await db.odfs.update(gpsDialog.dbId, { gpsLat: gpsDialog.lat, gpsLng: gpsDialog.lng });
                    } else {
                      await db.enclosures.update(gpsDialog.dbId, { gpsLat: gpsDialog.lat, gpsLng: gpsDialog.lng });
                    }
                    setGpsDialog(null);
                  } catch (err) {
                    console.error("Failed to save GPS location:", err);
                    alert("Failed to save GPS location");
                  }
                }}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Save Location
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-white rounded-lg shadow-xl border py-1 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {getAllowedChildTypes(contextMenu.nodeType).length > 0 && (
            <button
              onClick={handleAddChild}
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
            >
              <Plus className="w-4 h-4 text-green-600" />
              Add Child
            </button>
          )}
          <button
            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
            onClick={() => {
              if (contextMenu) {
                handleNodeEdit(contextMenu.nodeId, contextMenu.nodeType);
              }
              setContextMenu(null);
            }}
          >
            <Edit className="w-4 h-4 text-blue-600" />
            Edit Details
          </button>
          <button
            onClick={handleDelete}
            className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      )}

      {/* Add Node Dialog */}
      {addDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Add Child Node</h3>
              <button
                onClick={() => setAddDialog(null)}
                className="p-1 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Node Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {addDialog.allowedTypes.map((type) => (
                    <button
                      key={type}
                      onClick={() => setNewNodeType(type)}
                      className={`p-3 rounded-lg border-2 flex items-center gap-2 transition-all ${
                        newNodeType === type
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      {typeIcons[type]}
                      <span className="capitalize font-medium">{type}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={newNodeName}
                  onChange={(e) => setNewNodeName(e.target.value)}
                  placeholder={`Enter ${newNodeType} name...`}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setAddDialog(null)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateNode}
                  disabled={!newNodeName.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-full">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold">Delete Node?</h3>
            </div>

            <p className="text-gray-600 mb-6">
              This will delete this node and{" "}
              <span className="font-semibold text-red-600">
                {deleteConfirm.childCount} child node{deleteConfirm.childCount > 1 ? "s" : ""}
              </span>
              . This action cannot be undone.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => performDelete(deleteConfirm.nodeId)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Wrap with ReactFlowProvider
export default function TopologyCanvas(props: TopologyCanvasProps) {
  return (
    <ReactFlowProvider>
      <TopologyCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
