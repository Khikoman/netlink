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
import { useUndoRedo, createCommand } from "@/hooks/useUndoRedo";
import { FloatingNodeEditor } from "./FloatingNodeEditor";
import { FloatingGPSPicker } from "./FloatingGPSPicker";
import { FloatingPortManager } from "./FloatingPortManager";
import NodeInfoDropdown from "./NodeInfoDropdown";
import { SpliceMatrixPanel } from "./SpliceMatrixPanel";
import FiberPathPanel from "./FiberPathPanel";
import { CableConfigPopover } from "./CableConfigPopover";
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
  const [infoDropdown, setInfoDropdown] = useState<{ nodeId: string; nodeType: string; dbId: number; nodeName?: string; gpsLat?: number; gpsLng?: number } | null>(null);
  // Quick type picker for instant child creation (when multiple types allowed)
  const [quickTypePicker, setQuickTypePicker] = useState<{
    parentId: string;
    parentType: string;
    allowedTypes: string[];
    position: { x: number; y: number };
  } | null>(null);
  // Port manager for NAP nodes
  const [portManager, setPortManager] = useState<{
    napId: number;
    napName?: string;
  } | null>(null);
  // Splice Matrix Panel state
  const [spliceMatrixPanel, setSpliceMatrixPanel] = useState<{
    closureId: number;
    closureName: string;
    trayId: number;
    nodeId: string;  // Track which node for edge updates
    incomingEdgeId?: string;  // Track connected edges
    outgoingEdgeId?: string;
    cableA: { id: number; name: string; fiberCount: number };
    cableB: { id: number; name: string; fiberCount: number };
    existingConnections: Array<{ fiberA: number; fiberB: number; colorA?: string; colorB?: string; status: "completed" | "pending" }>;
  } | null>(null);
  // Fiber Path Panel state
  const [fiberPathPanel, setFiberPathPanel] = useState<{
    startNodeId: string;
    startNodeType: string;
    startDbId: number;
    startFiber?: number;
  } | null>(null);
  // Highlighted path nodes (for fiber path tracing)
  const [highlightedNodes, setHighlightedNodes] = useState<Set<string>>(new Set());
  // Cable config popover state
  const [cableConfigPanel, setCableConfigPanel] = useState<{
    edgeId: string;
    config: { name: string; fiberCount: number; length?: number };
  } | null>(null);
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

  // Generate auto-name for new node based on existing counts
  const generateAutoName = useCallback((type: string): string => {
    const prefix = type.toUpperCase();
    if (type === "odf") {
      const count = odfs?.length || 0;
      return `${prefix}-${count + 1}`;
    }
    // For enclosures (closure, lcp, nap)
    const typeMapping: Record<string, string[]> = {
      "closure": ["splice-closure", "closure"],
      "lcp": ["lcp", "fdt"],
      "nap": ["nap", "fat"],
    };
    const matchTypes = typeMapping[type] || [type];
    const count = enclosures?.filter(e => matchTypes.includes(e.type))?.length || 0;
    return `${prefix}-${count + 1}`;
  }, [odfs, enclosures]);

  // Instant create node with auto-name, then open editor
  const instantCreateNode = useCallback(async (
    parentId: string,
    parentType: string,
    childType: string
  ) => {
    if (!projectId) return null;

    const parentParts = parentId.split("-");
    const parentDbId = parseInt(parentParts[parentParts.length - 1]);
    const autoName = generateAutoName(childType);

    try {
      let newDbId: number | undefined;

      if (childType === "odf") {
        newDbId = await db.odfs.add({
          projectId,
          oltId: parentDbId,
          name: autoName,
          portCount: 48,
          createdAt: new Date(),
        }) as number;
      } else if (childType === "closure") {
        const dbParentType = parentType === "odf" ? "odf" :
                            parentType === "olt" ? "olt" : "closure";
        newDbId = await db.enclosures.add({
          projectId,
          name: autoName,
          type: "splice-closure",
          parentType: dbParentType as "odf" | "olt" | "closure",
          parentId: parentDbId,
          createdAt: new Date(),
        }) as number;
      } else if (childType === "lcp") {
        const dbParentType = parentType === "olt" ? "olt" : "closure";
        newDbId = await db.enclosures.add({
          projectId,
          name: autoName,
          type: "lcp",
          parentType: dbParentType as "olt" | "closure",
          parentId: parentDbId,
          createdAt: new Date(),
        }) as number;
      } else if (childType === "nap") {
        newDbId = await db.enclosures.add({
          projectId,
          name: autoName,
          type: "nap",
          parentType: "lcp",
          parentId: parentDbId,
          createdAt: new Date(),
        }) as number;
      }

      if (newDbId) {
        // Open the editor for the newly created node
        const nodeType = childType === "closure" ? "closure" : childType;
        setEditDialog({
          nodeId: `${nodeType}-${newDbId}`,
          nodeType,
          dbId: newDbId
        });
        return newDbId;
      }
    } catch (err) {
      console.error("Failed to create node:", err);
      alert("Failed to create node");
    }
    return null;
  }, [projectId, generateAutoName]);

  // Handle add child from context menu - use instant creation
  const handleAddChild = () => {
    if (!contextMenu) return;
    const allowedTypes = getAllowedChildTypes(contextMenu.nodeType);
    if (allowedTypes.length === 0) {
      alert("This node type cannot have children");
      return;
    }

    // If only one type allowed, create instantly
    if (allowedTypes.length === 1) {
      instantCreateNode(contextMenu.nodeId, contextMenu.nodeType, allowedTypes[0]);
      setContextMenu(null);
      return;
    }

    // Multiple types - show quick type picker at context menu position
    setQuickTypePicker({
      parentId: contextMenu.nodeId,
      parentType: contextMenu.nodeType,
      allowedTypes,
      position: { x: contextMenu.x, y: contextMenu.y },
    });
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

  // Handle add child from toolbar - INSTANT creation (no dialog for name)
  const handleNodeAddChild = useCallback((nodeId: string, nodeType: string, event?: React.MouseEvent) => {
    const allowedTypes = getAllowedChildTypes(nodeType);
    if (allowedTypes.length === 0) {
      alert("This node type cannot have children");
      return;
    }

    // If only one type allowed, create instantly
    if (allowedTypes.length === 1) {
      instantCreateNode(nodeId, nodeType, allowedTypes[0]);
      return;
    }

    // Multiple types allowed - show quick type picker
    // Position near the click or center of screen
    const position = event
      ? { x: event.clientX, y: event.clientY }
      : { x: window.innerWidth / 2, y: window.innerHeight / 2 };

    setQuickTypePicker({
      parentId: nodeId,
      parentType: nodeType,
      allowedTypes,
      position,
    });
  }, [instantCreateNode]);

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

  // Handle node info button click - opens info dropdown
  const handleNodeInfo = useCallback(async (nodeId: string, nodeType: string, dbId: number) => {
    // Fetch node details including GPS and name
    let nodeName: string | undefined;
    let gpsLat: number | undefined;
    let gpsLng: number | undefined;

    try {
      if (nodeType === "olt") {
        const olt = await db.olts.get(dbId);
        nodeName = olt?.name;
        gpsLat = olt?.gpsLat;
        gpsLng = olt?.gpsLng;
      } else if (nodeType === "odf") {
        const odf = await db.odfs.get(dbId);
        nodeName = odf?.name;
        gpsLat = odf?.gpsLat;
        gpsLng = odf?.gpsLng;
      } else {
        const enclosure = await db.enclosures.get(dbId);
        nodeName = enclosure?.name;
        gpsLat = enclosure?.gpsLat;
        gpsLng = enclosure?.gpsLng;
      }
    } catch (err) {
      console.error("Failed to fetch node info:", err);
    }

    setInfoDropdown({ nodeId, nodeType, dbId, nodeName, gpsLat, gpsLng });
  }, []);

  // Handle open port manager for NAP nodes
  const handleOpenPortManager = useCallback(async (nodeId: string, nodeType: string, dbId: number) => {
    if (nodeType !== "nap") return;

    try {
      const enclosure = await db.enclosures.get(dbId);
      setPortManager({
        napId: dbId,
        napName: enclosure?.name,
      });
    } catch (err) {
      console.error("Failed to open port manager:", err);
    }
  }, []);

  // Handle open splice matrix for nodes (closure, odf, lcp)
  const handleOpenSpliceMatrix = useCallback(async (nodeId: string, nodeType: string, dbId: number) => {
    // Support closures, ODF, and LCP
    if (!["closure", "odf", "lcp"].includes(nodeType)) return;

    try {
      let nodeName: string;

      if (nodeType === "odf") {
        const odf = await db.odfs.get(dbId);
        if (!odf) return;
        nodeName = odf.name;
      } else {
        const enclosure = await db.enclosures.get(dbId);
        if (!enclosure) return;
        nodeName = enclosure.name;
      }

      // Get trays for this node (closures use enclosureId, odf/lcp use same)
      const trays = await db.trays.where("enclosureId").equals(dbId).toArray();
      const tray = trays[0]; // Use first tray or create one if needed

      // Get connected edges to determine cables
      const incomingEdge = edges.find(e => e.target === nodeId);
      const outgoingEdge = edges.find(e => e.source === nodeId);

      // Get node names for better labeling
      const sourceNode = incomingEdge ? nodes.find(n => n.id === incomingEdge.source) : null;
      const targetNode = outgoingEdge ? nodes.find(n => n.id === outgoingEdge.target) : null;

      // Default cable info (would be enhanced with real cable data)
      const cableA = {
        id: incomingEdge ? parseInt(incomingEdge.source.split("-")[1]) : 1,
        name: incomingEdge?.data?.cable?.name || (sourceNode?.data?.label ? `From ${sourceNode.data.label}` : "Incoming Cable"),
        fiberCount: incomingEdge?.data?.cable?.fiberCount || 48,
      };
      const cableB = {
        id: outgoingEdge ? parseInt(outgoingEdge.target.split("-")[1]) : 2,
        name: outgoingEdge?.data?.cable?.name || (targetNode?.data?.label ? `To ${targetNode.data.label}` : "Outgoing Cable"),
        fiberCount: outgoingEdge?.data?.cable?.fiberCount || 24,
      };

      // Get existing splices if tray exists
      let existingConnections: Array<{ fiberA: number; fiberB: number; colorA?: string; colorB?: string; status: "completed" | "pending" }> = [];
      if (tray) {
        const splices = await db.splices.where("trayId").equals(tray.id!).toArray();
        existingConnections = splices.map(s => ({
          fiberA: s.fiberA,
          fiberB: s.fiberB,
          colorA: s.fiberAColor,
          colorB: s.fiberBColor,
          status: (s.status as "completed" | "pending") || "completed",
        }));
      }

      setSpliceMatrixPanel({
        closureId: dbId,
        closureName: nodeName,
        trayId: tray?.id || 0,
        nodeId,
        incomingEdgeId: incomingEdge?.id,
        outgoingEdgeId: outgoingEdge?.id,
        cableA,
        cableB,
        existingConnections,
      });
    } catch (err) {
      console.error("Failed to open splice matrix:", err);
    }
  }, [edges, nodes]);

  // Handle save splice matrix connections
  const handleSaveSpliceMatrix = useCallback(async (connections: Array<{
    fiberA: number;
    fiberB: number;
    tubeA: number;
    tubeB: number;
    colorA: string;
    colorB: string;
    status: "completed" | "pending";
  }>) => {
    if (!spliceMatrixPanel) return;

    try {
      // Ensure tray exists
      let trayId = spliceMatrixPanel.trayId;
      if (!trayId) {
        trayId = await db.trays.add({
          enclosureId: spliceMatrixPanel.closureId,
          number: 1,
          capacity: 24,
        }) as number;
      }

      // Clear existing splices for this tray
      await db.splices.where("trayId").equals(trayId).delete();

      // Add new splices
      for (const conn of connections) {
        await db.splices.add({
          trayId,
          cableAId: spliceMatrixPanel.cableA.id,
          cableAName: spliceMatrixPanel.cableA.name,
          fiberA: conn.fiberA,
          tubeAColor: conn.colorA,
          fiberAColor: conn.colorA,
          cableBId: spliceMatrixPanel.cableB.id,
          cableBName: spliceMatrixPanel.cableB.name,
          fiberB: conn.fiberB,
          tubeBColor: conn.colorB,
          fiberBColor: conn.colorB,
          status: conn.status === "completed" ? "completed" : "pending",
          spliceType: "fusion",
          technicianName: "System",
          timestamp: new Date(),
        });
      }

      // Update edge UI with new splice connections
      const edgeConnections = connections.map(c => ({
        fiberA: c.fiberA,
        fiberB: c.fiberB,
        colorA: c.colorA,
        colorB: c.colorB,
        status: c.status,
      }));

      setEdges(eds => eds.map(e => {
        // Update both incoming and outgoing edges connected to this node
        if (e.id === spliceMatrixPanel.incomingEdgeId || e.id === spliceMatrixPanel.outgoingEdgeId) {
          return {
            ...e,
            data: {
              ...e.data,
              connections: edgeConnections,
            },
          };
        }
        return e;
      }));

      setSpliceMatrixPanel(null);
    } catch (err) {
      console.error("Failed to save splice matrix:", err);
    }
  }, [spliceMatrixPanel, setEdges]);

  // Handle open fiber path tracer
  const handleOpenFiberPath = useCallback((nodeId: string, nodeType: string, dbId: number) => {
    setFiberPathPanel({
      startNodeId: nodeId,
      startNodeType: nodeType,
      startDbId: dbId,
    });
  }, []);

  // Handle highlight path on canvas
  const handleHighlightPath = useCallback((nodeIds: string[]) => {
    setHighlightedNodes(new Set(nodeIds));
  }, []);

  // Handle clear path highlight
  const handleClearHighlight = useCallback(() => {
    setHighlightedNodes(new Set());
  }, []);

  // Handle open splice editor for an edge - loads from database
  const handleOpenSpliceEditor = useCallback(async (edgeId: string) => {
    // Find the edge and extract info
    const edge = edges.find(e => e.id === edgeId);
    if (!edge) return;

    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);

    // Try to load existing splice data from database
    let existingConnections: Array<{
      fiberA: number;
      fiberB: number;
      colorA: string;
      colorB: string;
      status: "completed" | "pending" | "failed";
    }> = [];

    try {
      // Find cable record for this edge
      const cables = await db.cables.where("projectId").equals(projectId!).toArray();
      const cable = cables.find(c => {
        if (!c.notes) return false;
        try {
          const notesData = JSON.parse(c.notes);
          return notesData.edgeId === edgeId;
        } catch {
          return c.notes === `edge:${edgeId}`;
        }
      });

      if (cable?.notes) {
        try {
          const notesData = JSON.parse(cable.notes);
          if (notesData.splices && Array.isArray(notesData.splices)) {
            existingConnections = notesData.splices;
          }
        } catch {
          // Not JSON format, ignore
        }
      }
    } catch (err) {
      console.error("Failed to load splice data:", err);
    }

    // Fall back to edge data if no database data
    if (existingConnections.length === 0 && edge.data?.connections) {
      existingConnections = edge.data.connections;
    }

    setSplicePanel({
      edgeId,
      cableAName: sourceNode?.data?.label || "Cable A",
      cableBName: targetNode?.data?.label || "Cable B",
      fiberCountA: edge.data?.cable?.fiberCount || 12,
      fiberCountB: edge.data?.cable?.fiberCount || 12,
      connections: existingConnections,
    });
  }, [edges, nodes, projectId]);

  // Handle open cable config popover for an edge - loads from database
  const handleOpenCableConfig = useCallback(async (edgeId: string) => {
    const edge = edges.find(e => e.id === edgeId);
    if (!edge) return;

    // Try to load cable config from database
    let cableConfig = {
      name: edge.data?.cable?.name || "Cable",
      fiberCount: edge.data?.cable?.fiberCount || 48,
      length: edge.data?.cable?.length,
    };

    try {
      // Find cable record for this edge
      const cables = await db.cables.where("projectId").equals(projectId!).toArray();
      const cable = cables.find(c => {
        if (!c.notes) return false;
        try {
          const notesData = JSON.parse(c.notes);
          return notesData.edgeId === edgeId;
        } catch {
          return c.notes === `edge:${edgeId}` || c.notes?.startsWith(`edge:${edgeId}`);
        }
      });

      if (cable) {
        cableConfig = {
          name: cable.name,
          fiberCount: cable.fiberCount,
          length: cable.lengthMeters,
        };
      }
    } catch (err) {
      console.error("Failed to load cable config:", err);
    }

    setCableConfigPanel({
      edgeId,
      config: cableConfig,
    });
  }, [edges, projectId]);

  // Save cable config - persists to database
  const handleSaveCableConfig = useCallback(async (edgeId: string, config: { name: string; fiberCount: number; length?: number }) => {
    try {
      // Find cable record for this edge
      const cables = await db.cables.where("projectId").equals(projectId!).toArray();
      const existingCable = cables.find(c => {
        if (!c.notes) return false;
        try {
          const notesData = JSON.parse(c.notes);
          return notesData.edgeId === edgeId;
        } catch {
          return c.notes === `edge:${edgeId}` || c.notes?.startsWith(`edge:${edgeId}`);
        }
      });

      if (existingCable?.id) {
        // Preserve existing splice data when updating
        const notesData: { edgeId: string; splices?: unknown[] } = { edgeId };
        try {
          if (existingCable.notes) {
            const parsed = JSON.parse(existingCable.notes);
            if (parsed.splices) {
              notesData.splices = parsed.splices;
            }
          }
        } catch {
          // Not JSON, start fresh
        }

        // Update existing cable
        await db.cables.update(existingCable.id, {
          name: config.name,
          fiberCount: config.fiberCount as 12 | 24 | 48 | 96 | 144 | 216 | 288,
          lengthMeters: config.length,
          notes: JSON.stringify(notesData),
        });
      } else {
        // Create new cable for this edge
        await db.cables.add({
          projectId: projectId!,
          name: config.name,
          fiberCount: config.fiberCount as 12 | 24 | 48 | 96 | 144 | 216 | 288,
          fiberType: "singlemode",
          lengthMeters: config.length,
          notes: JSON.stringify({ edgeId }), // Store edgeId in notes field for lookup
        });
      }

      // Update edge data in React state
      setEdges(eds => eds.map(e => {
        if (e.id === edgeId) {
          return {
            ...e,
            data: {
              ...e.data,
              cable: {
                ...e.data?.cable,
                name: config.name,
                fiberCount: config.fiberCount,
                length: config.length,
              },
            },
          };
        }
        return e;
      }));

      setCableConfigPanel(null);
    } catch (err) {
      console.error("Failed to save cable config:", err);
    }
  }, [setEdges, projectId]);

  // Save splice connections - persists to database
  const handleSaveSplices = useCallback(async (connections: Array<{
    fiberA: number;
    fiberB: number;
    colorA: string;
    colorB: string;
    status: "completed" | "pending" | "failed";
  }>) => {
    if (!splicePanel) return;

    try {
      // Find cable record for this edge
      const cables = await db.cables.where("projectId").equals(projectId!).toArray();
      const cable = cables.find(c => {
        if (!c.notes) return false;
        try {
          const notesData = JSON.parse(c.notes);
          return notesData.edgeId === splicePanel.edgeId;
        } catch {
          return c.notes?.includes(splicePanel.edgeId);
        }
      });

      // Prepare the notes field with edge ID and splice data
      const notesData = {
        edgeId: splicePanel.edgeId,
        splices: connections.map(c => ({
          fiberA: c.fiberA,
          fiberB: c.fiberB,
          colorA: c.colorA,
          colorB: c.colorB,
          status: c.status,
        })),
      };

      if (cable?.id) {
        // Update existing cable with splice data
        await db.cables.update(cable.id, {
          notes: JSON.stringify(notesData),
        });
      } else {
        // Create new cable for this edge with splice data
        await db.cables.add({
          projectId: projectId!,
          name: splicePanel.cableAName + " → " + splicePanel.cableBName,
          fiberCount: splicePanel.fiberCountA as 12 | 24 | 48 | 96 | 144 | 216 | 288,
          fiberType: "singlemode",
          notes: JSON.stringify(notesData),
        });
      }

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
    } catch (err) {
      console.error("Failed to save splices:", err);
    }
  }, [splicePanel, setEdges, projectId]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // Escape - close any open panel
      if (e.key === "Escape") {
        if (editDialog) { setEditDialog(null); return; }
        if (gpsDialog) { setGpsDialog(null); return; }
        if (splicePanel) { setSplicePanel(null); return; }
        if (infoDropdown) { setInfoDropdown(null); return; }
        if (quickTypePicker) { setQuickTypePicker(null); return; }
        if (portManager) { setPortManager(null); return; }
        if (addDialog) { setAddDialog(null); return; }
        if (deleteConfirm) { setDeleteConfirm(null); return; }
        return;
      }

      // Don't handle other shortcuts if a dialog/panel is open
      if (editDialog || addDialog || gpsDialog || deleteConfirm || quickTypePicker || portManager) return;

      // Get selected node (for node-specific shortcuts)
      const selectedNodes = nodes.filter((n) => n.selected);
      const selectedNode = selectedNodes.length === 1 ? selectedNodes[0] : null;

      // Delete or Backspace to delete selected node(s)
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedNodes.length > 0) {
          e.preventDefault();
          for (const node of selectedNodes) {
            handleNodeDelete(node.id);
          }
        }
        return;
      }

      // E - Edit selected node
      if (e.key === "e" || e.key === "E") {
        if (selectedNode && selectedNode.data.dbId) {
          e.preventDefault();
          handleNodeEdit(selectedNode.id, selectedNode.data.type);
        }
        return;
      }

      // G - GPS picker for selected node
      if (e.key === "g" || e.key === "G") {
        if (selectedNode && selectedNode.data.dbId) {
          e.preventDefault();
          handleNodeSetLocation(selectedNode.id, selectedNode.data.type);
        }
        return;
      }

      // A - Add child to selected node
      if (e.key === "a" || e.key === "A") {
        if (selectedNode) {
          e.preventDefault();
          handleNodeAddChild(selectedNode.id, selectedNode.data.type);
        }
        return;
      }

      // I - Info dropdown for selected node
      if (e.key === "i" || e.key === "I") {
        if (selectedNode && selectedNode.data.dbId) {
          e.preventDefault();
          handleNodeInfo(selectedNode.id, selectedNode.data.type, selectedNode.data.dbId);
        }
        return;
      }

      // P - Manage ports (for NAP nodes)
      if (e.key === "p" || e.key === "P") {
        if (selectedNode && selectedNode.data.type === "nap" && selectedNode.data.dbId) {
          e.preventDefault();
          handleOpenPortManager(selectedNode.id, selectedNode.data.type, selectedNode.data.dbId);
        }
        return;
      }

      // S - Open Splice Matrix (for closure, odf, lcp nodes)
      if (e.key === "s" || e.key === "S") {
        if (selectedNode && ["closure", "odf", "lcp"].includes(selectedNode.data.type) && selectedNode.data.dbId) {
          e.preventDefault();
          handleOpenSpliceMatrix(selectedNode.id, selectedNode.data.type, selectedNode.data.dbId);
        }
        return;
      }

      // T - Trace fiber path from selected node
      if (e.key === "t" || e.key === "T") {
        if (selectedNode && selectedNode.data.dbId) {
          e.preventDefault();
          handleOpenFiberPath(selectedNode.id, selectedNode.data.type, selectedNode.data.dbId);
        }
        return;
      }

      // Ctrl/Cmd+Z - Undo
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        if (canUndoCommand) {
          e.preventDefault();
          undoCommand();
        }
        return;
      }

      // Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z - Redo
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        if (canRedoCommand) {
          e.preventDefault();
          redoCommand();
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    nodes, editDialog, addDialog, gpsDialog, deleteConfirm, quickTypePicker, portManager, splicePanel, infoDropdown,
    handleNodeDelete, handleNodeEdit, handleNodeSetLocation, handleNodeAddChild, handleNodeInfo, handleOpenPortManager,
    handleOpenSpliceMatrix, handleOpenFiberPath,
    canUndoCommand, canRedoCommand, undoCommand, redoCommand
  ]);

  // Filter nodes by search AND inject action callbacks into node data
  const filteredNodes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const hasHighlight = highlightedNodes.size > 0;
    return nodes.map((node) => {
      const isHighlighted = highlightedNodes.has(node.id);
      return {
        ...node,
        data: {
          ...node.data,
          // Inject action callbacks into each node's data
          onAddChild: handleNodeAddChild,
          onEdit: handleNodeEdit,
          onDelete: handleNodeDelete,
          onDuplicate: handleNodeDuplicate,
          onSetLocation: handleNodeSetLocation,
          onInfo: handleNodeInfo,
          onManagePorts: handleOpenPortManager,
          onOpenSpliceMatrix: handleOpenSpliceMatrix,
          onTracePath: handleOpenFiberPath,
          isHighlighted,
        },
        style: {
          ...node.style,
          // Apply search filter opacity
          ...(query && {
            opacity: node.data.label.toLowerCase().includes(query) ? 1 : 0.3,
          }),
          // Apply path highlight opacity
          ...(hasHighlight && !isHighlighted && {
            opacity: 0.3,
          }),
        },
      };
    });
  }, [nodes, searchQuery, highlightedNodes, handleNodeAddChild, handleNodeEdit, handleNodeDelete, handleNodeDuplicate, handleNodeSetLocation, handleNodeInfo, handleOpenPortManager, handleOpenSpliceMatrix, handleOpenFiberPath]);

  // Inject action callbacks into edge data
  const edgesWithCallbacks = useMemo(() => {
    return edges.map((edge) => ({
      ...edge,
      data: {
        ...edge.data,
        onOpenSpliceEditor: handleOpenSpliceEditor,
        onOpenCableConfig: handleOpenCableConfig,
      },
    }));
  }, [edges, handleOpenSpliceEditor, handleOpenCableConfig]);

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

      {/* Floating Node Editor */}
      {editDialog && (
        <FloatingNodeEditor
          isOpen={true}
          nodeId={editDialog.nodeId}
          nodeType={editDialog.nodeType}
          dbId={editDialog.dbId}
          onClose={() => setEditDialog(null)}
          onOpenGPSPicker={(nodeId, nodeType, dbId) => {
            setGpsDialog({
              nodeId,
              nodeType,
              dbId,
              lat: undefined,
              lng: undefined,
            });
          }}
        />
      )}

      {/* Floating GPS Picker */}
      {gpsDialog && (
        <FloatingGPSPicker
          isOpen={true}
          nodeId={gpsDialog.nodeId}
          nodeType={gpsDialog.nodeType}
          dbId={gpsDialog.dbId}
          initialLat={gpsDialog.lat}
          initialLng={gpsDialog.lng}
          onClose={() => setGpsDialog(null)}
        />
      )}

      {/* Node Info Dropdown */}
      {infoDropdown && (
        <NodeInfoDropdown
          nodeId={infoDropdown.nodeId}
          nodeType={infoDropdown.nodeType}
          dbId={infoDropdown.dbId}
          isOpen={true}
          onClose={() => setInfoDropdown(null)}
          nodeName={infoDropdown.nodeName}
          gpsLat={infoDropdown.gpsLat}
          gpsLng={infoDropdown.gpsLng}
          onOpenGpsDialog={() => {
            // Open GPS dialog for this node
            setGpsDialog({
              nodeId: infoDropdown.nodeId,
              nodeType: infoDropdown.nodeType,
              dbId: infoDropdown.dbId,
              lat: infoDropdown.gpsLat,
              lng: infoDropdown.gpsLng,
            });
          }}
          position="fixed"
        />
      )}

      {/* Port Manager for NAP nodes */}
      {portManager && (
        <FloatingPortManager
          isOpen={true}
          napId={portManager.napId}
          napName={portManager.napName}
          onClose={() => setPortManager(null)}
        />
      )}

      {/* Splice Matrix Panel */}
      {spliceMatrixPanel && (
        <SpliceMatrixPanel
          isOpen={true}
          onClose={() => setSpliceMatrixPanel(null)}
          closureId={spliceMatrixPanel.closureId}
          closureName={spliceMatrixPanel.closureName}
          trayId={spliceMatrixPanel.trayId}
          cableA={spliceMatrixPanel.cableA}
          cableB={spliceMatrixPanel.cableB}
          existingConnections={spliceMatrixPanel.existingConnections}
          onSave={handleSaveSpliceMatrix}
        />
      )}

      {/* Fiber Path Panel */}
      {fiberPathPanel && (
        <FiberPathPanel
          isOpen={true}
          onClose={() => setFiberPathPanel(null)}
          startNodeId={fiberPathPanel.startNodeId}
          startNodeType={fiberPathPanel.startNodeType}
          startDbId={fiberPathPanel.startDbId}
          startFiber={fiberPathPanel.startFiber}
          onHighlightPath={handleHighlightPath}
          onClearHighlight={handleClearHighlight}
        />
      )}

      {/* Cable Config Popover */}
      {cableConfigPanel && (
        <CableConfigPopover
          isOpen={true}
          onClose={() => setCableConfigPanel(null)}
          edgeId={cableConfigPanel.edgeId}
          initialConfig={cableConfigPanel.config}
          onSave={handleSaveCableConfig}
        />
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

      {/* Quick Type Picker (for instant child creation with multiple types) */}
      {quickTypePicker && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setQuickTypePicker(null)}
          />
          {/* Picker popup */}
          <div
            className="fixed z-50 bg-white rounded-xl shadow-2xl border border-gray-200 p-2 min-w-[140px]"
            style={{
              left: Math.min(quickTypePicker.position.x, window.innerWidth - 160),
              top: Math.min(quickTypePicker.position.y, window.innerHeight - 200),
            }}
          >
            <p className="text-xs text-gray-500 px-2 py-1 mb-1">Select type:</p>
            <div className="space-y-1">
              {quickTypePicker.allowedTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => {
                    instantCreateNode(
                      quickTypePicker.parentId,
                      quickTypePicker.parentType,
                      type
                    );
                    setQuickTypePicker(null);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-blue-50 text-left transition-colors"
                >
                  {typeIcons[type] || <Box className="w-4 h-4" />}
                  <span className="capitalize font-medium text-sm">{type}</span>
                </button>
              ))}
            </div>
          </div>
        </>
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
