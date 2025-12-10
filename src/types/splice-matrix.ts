// Fiber Path Tracing Types for End-to-End visibility

export type FiberPathNodeType = "olt" | "odf" | "closure" | "lcp" | "nap" | "customer";

export interface SpliceConnection {
  id?: number;
  fiberA: number;
  tubeA: number;
  fiberB: number;
  tubeB: number;
  colorA?: string;
  colorB?: string;
  status: "available" | "connected" | "pending" | "faulty" | "completed";
  loss?: number;
}

export interface FiberInfo {
  number: number;
  color: string;
  tube: string;
  tubeColor?: string;
}

export interface PathSegment {
  order: number;
  nodeId: string;
  nodeType: FiberPathNodeType;
  nodeName: string;
  dbId: number;

  // Fiber info at this point
  fiberIn?: FiberInfo;
  fiberOut?: FiberInfo;

  // Splice info (if applicable)
  spliceInfo?: {
    spliceId: number;
    trayId: number;
    trayNumber: number;
    loss: number;
    status: "completed" | "pending" | "failed";
  };

  // Cable info leading to this segment
  cableInfo?: {
    cableId: number;
    name: string;
    fiberCount: number;
    distance?: number;
  };

  // Splitter info (for LCP)
  splitterInfo?: {
    splitterId: number;
    type: string;
    inputPort: number;
    outputPort: number;
  };

  // Port info (for ODF, NAP)
  portInfo?: {
    portId: number;
    portNumber: number;
    status: string;
    customerName?: string;
    customerAddress?: string;
    serviceId?: string;
  };
}

export interface FiberPath {
  id: string;
  projectId: number;

  // Start point (typically OLT)
  startNodeType: FiberPathNodeType;
  startNodeId: string;
  startDbId: number;
  startDescription: string;

  // End point (typically customer)
  endNodeType: FiberPathNodeType;
  endNodeId: string;
  endDbId: number;
  endDescription: string;

  // Path segments
  segments: PathSegment[];

  // Path metrics
  totalLoss: number;
  totalDistance: number;
  spliceCount: number;
  connectorCount: number;

  // Status
  status: "complete" | "partial" | "disconnected";
  missingLinks: string[];
}

export interface FiberPathTraceResult {
  success: boolean;
  path?: FiberPath;
  error?: string;
  highlightedNodeIds: string[];
  highlightedEdgeIds: string[];
}

// For canvas highlighting
export interface PathHighlight {
  isActive: boolean;
  pathId?: string;
  nodeIds: Set<string>;
  edgeIds: Set<string>;
  direction: "upstream" | "downstream" | "both";
}

// Export existing connection type for splice matrix panel
export interface ExistingConnection {
  fiberA: number;
  fiberB: number;
  colorA?: string;
  colorB?: string;
  status: "completed" | "pending";
}
