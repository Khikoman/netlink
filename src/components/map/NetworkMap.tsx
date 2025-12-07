"use client";

import { useState, useRef, useEffect } from "react";
import { Stage, Layer, Circle, Line, Text, Group, Rect } from "react-konva";
import Konva from "konva";
import { useLiveQuery } from "dexie-react-hooks";
import dynamic from "next/dynamic";
import {
  db,
  createMapNode,
  createMapRoute,
  updateMapNode,
  deleteMapNode,
  deleteMapRoute,
} from "@/lib/db";
import { useNetwork } from "@/contexts/NetworkContext";
import type { MapNode, MapRoute, MapNodeType } from "@/types";
import { MapPin, Grid3X3, Loader2 } from "lucide-react";

// Dynamically import GpsMap to avoid SSR issues
const GpsMap = dynamic(() => import("@/components/map/GpsMap"), {
  ssr: false,
  loading: () => (
    <div className="h-[500px] bg-gray-100 rounded-lg flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  ),
});

const NODE_TYPES: { value: MapNodeType; label: string; color: string }[] = [
  { value: "enclosure", label: "Enclosure", color: "#3b82f6" },
  { value: "handhole", label: "Handhole", color: "#22c55e" },
  { value: "building", label: "Building", color: "#f59e0b" },
  { value: "pole", label: "Pole", color: "#8b5cf6" },
  { value: "splitter", label: "Splitter", color: "#ec4899" },
  { value: "olt", label: "OLT", color: "#14b8a6" },
  { value: "ont", label: "ONT", color: "#f97316" },
];

export default function NetworkMap() {
  // Get project from context
  const { projectId, projects, selectProject } = useNetwork();

  const [selectedNode, setSelectedNode] = useState<MapNode | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<MapRoute | null>(null);
  const [editMode, setEditMode] = useState<"select" | "node" | "route">("select");
  const [nodeType, setNodeType] = useState<MapNodeType>("enclosure");
  const [routeStartNode, setRouteStartNode] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"gps" | "schematic">("gps");

  // Form state
  const [showNodeForm, setShowNodeForm] = useState(false);
  const [nodeLabel, setNodeLabel] = useState("");
  const [nodeNotes, setNodeNotes] = useState("");

  // Stage dimensions
  const containerRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });

  // Pan and zoom
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [stageScale, setStageScale] = useState(1);

  // Data - map nodes and routes
  const nodes = useLiveQuery(
    () =>
      projectId
        ? db.mapNodes.where("projectId").equals(projectId).toArray()
        : [],
    [projectId]
  );
  const routes = useLiveQuery(
    () =>
      projectId
        ? db.mapRoutes.where("projectId").equals(projectId).toArray()
        : [],
    [projectId]
  );

  // Handle resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setStageSize({
          width: containerRef.current.offsetWidth,
          height: 500,
        });
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Get node color
  const getNodeColor = (type: MapNodeType) => {
    return NODE_TYPES.find((t) => t.value === type)?.color || "#6b7280";
  };

  // Handle stage click
  const handleStageClick = async (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!projectId) return;

    // Get click position relative to stage
    const stage = e.target.getStage();
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;
    const x = (pos.x - stagePos.x) / stageScale;
    const y = (pos.y - stagePos.y) / stageScale;

    if (editMode === "node") {
      // Create new node
      const id = await createMapNode({
        projectId: projectId,
        type: nodeType,
        label: `${NODE_TYPES.find((t) => t.value === nodeType)?.label || "Node"} ${(nodes?.length || 0) + 1}`,
        x,
        y,
        color: getNodeColor(nodeType),
      });
      setEditMode("select");
    } else if (editMode === "select") {
      // Deselect if clicking on empty space
      if (e.target === stage) {
        setSelectedNode(null);
        setSelectedRoute(null);
      }
    }
  };

  // Handle node click
  const handleNodeClick = async (node: MapNode) => {
    if (editMode === "route") {
      if (routeStartNode === null) {
        setRouteStartNode(node.id!);
      } else if (routeStartNode !== node.id) {
        // Create route
        await createMapRoute({
          projectId: projectId!,
          fromNodeId: routeStartNode,
          toNodeId: node.id!,
          color: "#6b7280",
        });
        setRouteStartNode(null);
        setEditMode("select");
      }
    } else {
      setSelectedNode(node);
      setSelectedRoute(null);
      setNodeLabel(node.label);
      setNodeNotes(node.notes || "");
    }
  };

  // Handle node drag
  const handleNodeDrag = async (node: MapNode, x: number, y: number) => {
    if (node.id) {
      await updateMapNode(node.id, { x, y });
    }
  };

  // Handle route click
  const handleRouteClick = (route: MapRoute) => {
    setSelectedRoute(route);
    setSelectedNode(null);
  };

  // Update selected node
  const handleUpdateNode = async () => {
    if (!selectedNode?.id) return;
    await updateMapNode(selectedNode.id, {
      label: nodeLabel,
      notes: nodeNotes,
    });
    setSelectedNode(null);
  };

  // Delete selected node
  const handleDeleteNode = async () => {
    if (!selectedNode?.id) return;
    await deleteMapNode(selectedNode.id);
    setSelectedNode(null);
  };

  // Delete selected route
  const handleDeleteRoute = async () => {
    if (!selectedRoute?.id) return;
    await deleteMapRoute(selectedRoute.id);
    setSelectedRoute(null);
  };

  // Handle wheel zoom
  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const scaleBy = 1.1;
    const stage = e.target.getStage();
    if (!stage) return;
    const oldScale = stageScale;
    const pointerPosition = stage.getPointerPosition();
    if (!pointerPosition) return;

    const mousePointTo = {
      x: (pointerPosition.x - stagePos.x) / oldScale,
      y: (pointerPosition.y - stagePos.y) / oldScale,
    };

    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
    const clampedScale = Math.max(0.2, Math.min(5, newScale));

    setStageScale(clampedScale);
    setStagePos({
      x: pointerPosition.x - mousePointTo.x * clampedScale,
      y: pointerPosition.y - mousePointTo.y * clampedScale,
    });
  };

  // Get route points
  const getRoutePoints = (route: MapRoute): number[] => {
    const fromNode = nodes?.find((n) => n.id === route.fromNodeId);
    const toNode = nodes?.find((n) => n.id === route.toNodeId);
    if (!fromNode || !toNode) return [];
    return [fromNode.x, fromNode.y, toNode.x, toNode.y];
  };

  return (
    <div className="space-y-4">
      {/* Project Selection & View Toggle */}
      <div className="bg-white rounded-2xl shadow-lg p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
            <select
              value={projectId || ""}
              onChange={(e) => selectProject(parseInt(e.target.value) || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800"
            >
              <option value="">Select a project...</option>
              {projects?.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          {/* View Mode Toggle */}
          {projectId && (
            <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
              <button
                onClick={() => setViewMode("gps")}
                className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors ${
                  viewMode === "gps"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <MapPin className="w-4 h-4" />
                GPS Map
              </button>
              <button
                onClick={() => setViewMode("schematic")}
                className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors ${
                  viewMode === "schematic"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <Grid3X3 className="w-4 h-4" />
                Schematic
              </button>
            </div>
          )}

          {/* Schematic Edit Tools - Only show in schematic view */}
          {projectId && viewMode === "schematic" && (
            <>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setEditMode("select");
                    setRouteStartNode(null);
                  }}
                  className={`px-4 py-2 rounded-lg font-medium ${
                    editMode === "select"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Select
                </button>
                <button
                  onClick={() => {
                    setEditMode("node");
                    setRouteStartNode(null);
                  }}
                  className={`px-4 py-2 rounded-lg font-medium ${
                    editMode === "node"
                      ? "bg-green-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Add Node
                </button>
                <button
                  onClick={() => {
                    setEditMode("route");
                    setRouteStartNode(null);
                  }}
                  className={`px-4 py-2 rounded-lg font-medium ${
                    editMode === "route"
                      ? "bg-purple-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Draw Route
                </button>
              </div>

              {editMode === "node" && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Type:</span>
                  <select
                    value={nodeType}
                    onChange={(e) => setNodeType(e.target.value as MapNodeType)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-gray-800"
                  >
                    {NODE_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {editMode === "route" && routeStartNode && (
                <div className="text-sm text-purple-600">
                  Click destination node to complete route
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Map Content */}
      {projectId ? (
        <>
          {/* GPS Map View */}
          {viewMode === "gps" && (
            <div className="bg-white rounded-2xl shadow-lg p-4">
              <div className="h-[500px]">
                <GpsMap projectId={projectId} />
              </div>
              <div className="mt-3 text-sm text-gray-500">
                Enclosures with GPS coordinates are shown on the map. Add GPS to enclosures in the Enclosures tab.
              </div>
            </div>
          )}

          {/* Schematic Canvas View */}
          {viewMode === "schematic" && (
            <div className="bg-white rounded-2xl shadow-lg p-4">
              <div
                ref={containerRef}
                className="border-2 border-gray-200 rounded-xl overflow-hidden bg-gray-50"
              >
                <Stage
                  width={stageSize.width}
                  height={stageSize.height}
                  onClick={handleStageClick}
                  onWheel={handleWheel}
                  draggable
                  x={stagePos.x}
                  y={stagePos.y}
                  scaleX={stageScale}
                  scaleY={stageScale}
                  onDragEnd={(e) => {
                    setStagePos({ x: e.target.x(), y: e.target.y() });
                  }}
                >
                  <Layer>
                    {/* Grid */}
                    {Array.from({ length: 20 }).map((_, i) => (
                      <Line
                        key={`h-${i}`}
                        points={[0, i * 50, 1000, i * 50]}
                        stroke="#e5e7eb"
                        strokeWidth={1}
                      />
                    ))}
                    {Array.from({ length: 20 }).map((_, i) => (
                      <Line
                        key={`v-${i}`}
                        points={[i * 50, 0, i * 50, 1000]}
                        stroke="#e5e7eb"
                        strokeWidth={1}
                      />
                    ))}

                    {/* Routes */}
                    {routes?.map((route) => {
                      const points = getRoutePoints(route);
                      if (points.length < 4) return null;
                      return (
                        <Line
                          key={route.id}
                          points={points}
                          stroke={selectedRoute?.id === route.id ? "#3b82f6" : route.color || "#6b7280"}
                          strokeWidth={selectedRoute?.id === route.id ? 4 : 3}
                          onClick={() => handleRouteClick(route)}
                          onTap={() => handleRouteClick(route)}
                        />
                      );
                    })}

                    {/* Nodes */}
                    {nodes?.map((node) => (
                      <Group
                        key={node.id}
                        x={node.x}
                        y={node.y}
                        draggable={editMode === "select"}
                        onDragEnd={(e) => handleNodeDrag(node, e.target.x(), e.target.y())}
                        onClick={() => handleNodeClick(node)}
                        onTap={() => handleNodeClick(node)}
                      >
                        <Circle
                          radius={selectedNode?.id === node.id ? 22 : 20}
                          fill={node.color || getNodeColor(node.type)}
                          stroke={selectedNode?.id === node.id ? "#1d4ed8" : "#fff"}
                          strokeWidth={selectedNode?.id === node.id ? 4 : 2}
                          shadowColor="black"
                          shadowBlur={5}
                          shadowOpacity={0.3}
                        />
                        <Text
                          text={node.label}
                          fontSize={11}
                          fill="#374151"
                          y={25}
                          offsetX={node.label.length * 2.5}
                          fontStyle="bold"
                        />
                      </Group>
                    ))}

                    {/* Route start indicator */}
                    {editMode === "route" && routeStartNode && (
                      <>
                        {(() => {
                          const startNode = nodes?.find((n) => n.id === routeStartNode);
                          if (!startNode) return null;
                          return (
                            <Circle
                              x={startNode.x}
                              y={startNode.y}
                              radius={28}
                              stroke="#8b5cf6"
                              strokeWidth={3}
                              dash={[5, 5]}
                            />
                          );
                        })()}
                      </>
                    )}
                  </Layer>
                </Stage>
              </div>

              {/* Instructions */}
              <div className="mt-3 text-sm text-gray-500">
                {editMode === "select" && "Click and drag nodes to move them. Scroll to zoom."}
                {editMode === "node" && "Click on the canvas to place a new node."}
                {editMode === "route" && "Click on two nodes to create a route between them."}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-blue-50 rounded-2xl p-8 text-center">
          <h3 className="font-semibold text-blue-900 mb-2">Network Map</h3>
          <p className="text-blue-700">Select a project to view and edit its network diagram.</p>
          <p className="text-sm text-blue-600 mt-2">
            Create a project in the Enclosures tab first if you haven&apos;t already.
          </p>
        </div>
      )}

      {/* Selected Node Panel - Only in schematic mode */}
      {selectedNode && viewMode === "schematic" && (
        <div className="bg-white rounded-2xl shadow-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-4">Edit Node</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
              <input
                type="text"
                value={nodeLabel}
                onChange={(e) => setNodeLabel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={nodeNotes}
                onChange={(e) => setNodeNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800"
                rows={2}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleDeleteNode}
                className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
              >
                Delete
              </button>
              <div className="flex-1"></div>
              <button
                onClick={() => setSelectedNode(null)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateNode}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selected Route Panel - Only in schematic mode */}
      {selectedRoute && viewMode === "schematic" && (
        <div className="bg-white rounded-2xl shadow-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-4">Route</h3>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-600">
              From: {nodes?.find((n) => n.id === selectedRoute.fromNodeId)?.label}
              <br />
              To: {nodes?.find((n) => n.id === selectedRoute.toNodeId)?.label}
            </div>
            <div className="flex-1"></div>
            <button
              onClick={handleDeleteRoute}
              className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
            >
              Delete Route
            </button>
          </div>
        </div>
      )}

      {/* Legend - Only in schematic mode */}
      {projectId && viewMode === "schematic" && (
        <div className="bg-white rounded-2xl shadow-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-3">Legend</h3>
          <div className="flex flex-wrap gap-4">
            {NODE_TYPES.map((type) => (
              <div key={type.value} className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: type.color }}
                ></div>
                <span className="text-sm text-gray-600">{type.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
