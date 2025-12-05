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
} from "lucide-react";
import { db } from "@/lib/db";
import {
  useOLTs,
  useODFsByOLT,
  useEnclosures,
} from "@/lib/db/hooks";
import { nodeTypes } from "./nodes/CustomNodes";
import { getLayoutedElements } from "@/lib/topology/layoutUtils";
import type { OLT, ODF, Enclosure } from "@/types";

interface TopologyCanvasProps {
  projectId: number;
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
  enclosures: Enclosure[]
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Add OLT nodes
  olts.forEach((olt, idx) => {
    nodes.push({
      id: `olt-${olt.id}`,
      type: "olt",
      position: { x: idx * 250, y: 0 },
      data: {
        label: olt.name,
        type: "olt",
        portCount: olt.totalPonPorts,
        hasGps: !!(olt.gpsLat && olt.gpsLng),
        dbId: olt.id,
      },
    });
  });

  // Add ODF nodes
  odfs.forEach((odf, idx) => {
    nodes.push({
      id: `odf-${odf.id}`,
      type: "odf",
      position: { x: idx * 200, y: 100 },
      data: {
        label: odf.name,
        type: "odf",
        portCount: odf.portCount,
        hasGps: !!(odf.gpsLat && odf.gpsLng),
        dbId: odf.id,
      },
    });
    // Edge from OLT to ODF
    edges.push({
      id: `e-olt-${odf.oltId}-odf-${odf.id}`,
      source: `olt-${odf.oltId}`,
      target: `odf-${odf.id}`,
      type: "smoothstep",
      style: { stroke: "#f97316", strokeWidth: 2 },
      animated: false,
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
    nodes.push({
      id: `closure-${enc.id}`,
      type: "closure",
      position: { x: idx * 200, y: 200 },
      data: {
        label: enc.name,
        type: "closure",
        hasGps: !!(enc.gpsLat && enc.gpsLng),
        dbId: enc.id,
      },
    });

    // Edge from parent
    if (enc.parentType === "odf" && enc.parentId) {
      edges.push({
        id: `e-odf-${enc.parentId}-closure-${enc.id}`,
        source: `odf-${enc.parentId}`,
        target: `closure-${enc.id}`,
        type: "smoothstep",
        style: { stroke: "#a855f7", strokeWidth: 2 },
      });
    } else if (enc.parentType === "olt" && enc.parentId) {
      edges.push({
        id: `e-olt-${enc.parentId}-closure-${enc.id}`,
        source: `olt-${enc.parentId}`,
        target: `closure-${enc.id}`,
        type: "smoothstep",
        style: { stroke: "#a855f7", strokeWidth: 2 },
      });
    } else if (enc.parentType === "closure" && enc.parentId) {
      // Cascading closure
      edges.push({
        id: `e-closure-${enc.parentId}-closure-${enc.id}`,
        source: `closure-${enc.parentId}`,
        target: `closure-${enc.id}`,
        type: "smoothstep",
        style: { stroke: "#a855f7", strokeWidth: 2 },
      });
    }
  });

  // Add LCP nodes
  lcps.forEach((enc, idx) => {
    nodes.push({
      id: `lcp-${enc.id}`,
      type: "lcp",
      position: { x: idx * 180, y: 300 },
      data: {
        label: enc.name,
        type: "lcp",
        hasGps: !!(enc.gpsLat && enc.gpsLng),
        dbId: enc.id,
      },
    });

    // Edge from parent (closure or olt)
    if (enc.parentType === "closure" && enc.parentId) {
      edges.push({
        id: `e-closure-${enc.parentId}-lcp-${enc.id}`,
        source: `closure-${enc.parentId}`,
        target: `lcp-${enc.id}`,
        type: "smoothstep",
        style: { stroke: "#f97316", strokeWidth: 2 },
      });
    } else if (enc.parentType === "olt" && enc.parentId) {
      edges.push({
        id: `e-olt-${enc.parentId}-lcp-${enc.id}`,
        source: `olt-${enc.parentId}`,
        target: `lcp-${enc.id}`,
        type: "smoothstep",
        style: { stroke: "#f97316", strokeWidth: 2 },
      });
    }
  });

  // Add NAP nodes
  naps.forEach((enc, idx) => {
    nodes.push({
      id: `nap-${enc.id}`,
      type: "nap",
      position: { x: idx * 160, y: 400 },
      data: {
        label: enc.name,
        type: "nap",
        hasGps: !!(enc.gpsLat && enc.gpsLng),
        dbId: enc.id,
      },
    });

    // Edge from parent LCP
    if (enc.parentType === "lcp" && enc.parentId) {
      edges.push({
        id: `e-lcp-${enc.parentId}-nap-${enc.id}`,
        source: `lcp-${enc.parentId}`,
        target: `nap-${enc.id}`,
        type: "smoothstep",
        style: { stroke: "#3b82f6", strokeWidth: 2 },
      });
    }
  });

  return { nodes, edges };
}

function TopologyCanvasInner({ projectId }: TopologyCanvasProps) {
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
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch data
  const olts = useOLTs(projectId);
  const enclosures = useEnclosures(projectId);

  // Get all ODFs for project
  const [odfs, setOdfs] = useState<ODF[]>([]);
  useEffect(() => {
    if (projectId) {
      db.odfs.where("projectId").equals(projectId).toArray().then(setOdfs);
    }
  }, [projectId]);

  // Build flow data when data changes
  useEffect(() => {
    if (olts && enclosures) {
      const { nodes: newNodes, edges: newEdges } = buildFlowData(
        olts,
        odfs,
        enclosures
      );
      // Apply auto-layout if this is first load
      if (nodes.length === 0 && newNodes.length > 0) {
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
      }
    }
  }, [olts, odfs, enclosures]);

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
    if (!addDialog || !newNodeName.trim() || !newNodeType) return;

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
  const countChildren = (nodeId: string): number => {
    return edges.filter((e) => e.source === nodeId).length;
  };

  // Handle delete
  const handleDelete = () => {
    if (!contextMenu) return;
    const childCount = countChildren(contextMenu.nodeId);
    if (childCount > 0) {
      setDeleteConfirm({ nodeId: contextMenu.nodeId, childCount });
    } else {
      performDelete(contextMenu.nodeId);
    }
    setContextMenu(null);
  };

  // Perform delete with cascade
  const performDelete = async (nodeId: string) => {
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

      // Delete from database
      for (const id of allNodeIds) {
        const [t, idStr] = id.split("-");
        const dbIdToDelete = parseInt(idStr);
        if (t === "odf") {
          await db.odfs.delete(dbIdToDelete);
        } else if (t === "closure" || t === "lcp" || t === "nap") {
          await db.enclosures.delete(dbIdToDelete);
        }
      }

      setDeleteConfirm(null);
    } catch (err) {
      console.error("Failed to delete:", err);
      alert("Failed to delete node");
    }
  };

  // Filter nodes by search
  const filteredNodes = useMemo(() => {
    if (!searchQuery.trim()) return nodes;
    const query = searchQuery.toLowerCase();
    return nodes.map((node) => ({
      ...node,
      style: {
        ...node.style,
        opacity: node.data.label.toLowerCase().includes(query) ? 1 : 0.3,
      },
    }));
  }, [nodes, searchQuery]);

  const typeIcons: Record<string, React.ReactNode> = {
    odf: <Box className="w-4 h-4" />,
    closure: <Link2 className="w-4 h-4" />,
    lcp: <GitBranch className="w-4 h-4" />,
    nap: <Network className="w-4 h-4" />,
  };

  return (
    <div ref={containerRef} className="w-full h-[700px] bg-gray-50 rounded-xl overflow-hidden border">
      <ReactFlow
        nodes={filteredNodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeContextMenu={onNodeContextMenu}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
        proOptions={{ hideAttribution: true }}
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
            onClick={() => setContextMenu(null)}
          >
            <Edit className="w-4 h-4 text-blue-600" />
            Edit Details
          </button>
          {contextMenu.nodeType !== "olt" && (
            <button
              onClick={handleDelete}
              className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          )}
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
