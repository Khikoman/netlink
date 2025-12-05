import dagre from "dagre";
import { Node, Edge } from "reactflow";

export interface LayoutOptions {
  direction?: "TB" | "LR" | "BT" | "RL";
  nodeWidth?: number;
  nodeHeight?: number;
  rankSep?: number;
  nodeSep?: number;
}

/**
 * Apply dagre hierarchical layout to React Flow nodes and edges
 */
export function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {}
): { nodes: Node[]; edges: Edge[] } {
  const {
    direction = "TB",
    nodeWidth = 180,
    nodeHeight = 60,
    rankSep = 80,
    nodeSep = 50,
  } = options;

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: direction,
    ranksep: rankSep,
    nodesep: nodeSep,
  });

  // Add nodes to dagre
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  // Add edges to dagre
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // Run layout algorithm
  dagre.layout(dagreGraph);

  // Apply positions back to nodes
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

/**
 * Node type colors matching the existing design
 */
export const nodeColors: Record<string, { bg: string; border: string; text: string }> = {
  olt: { bg: "bg-teal-100", border: "border-teal-500", text: "text-teal-700" },
  odf: { bg: "bg-cyan-100", border: "border-cyan-500", text: "text-cyan-700" },
  closure: { bg: "bg-purple-100", border: "border-purple-500", text: "text-purple-700" },
  lcp: { bg: "bg-orange-100", border: "border-orange-500", text: "text-orange-700" },
  nap: { bg: "bg-blue-100", border: "border-blue-500", text: "text-blue-700" },
};

/**
 * Edge colors by type
 */
export const edgeColors: Record<string, string> = {
  feeder: "#f97316", // orange
  distribution: "#3b82f6", // blue
  drop: "#22c55e", // green
  default: "#94a3b8", // slate
};
