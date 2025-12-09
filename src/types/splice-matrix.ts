export interface SpliceConnection {
  id?: number;
  fiberA: number;
  tubeA: number;
  fiberB: number;
  tubeB: number;
  status: 'available' | 'connected' | 'pending' | 'faulty';
  loss?: number;
}

export interface FiberPath {
  segments: PathSegment[];
  totalLoss: number;
  totalDistance: number;
  spliceCount: number;
}

export interface PathSegment {
  nodeId: string;
  nodeType: string;
  nodeName: string;
  dbId: number;
  fiberIn?: { number: number; color: string; tube: string };
  fiberOut?: { number: number; color: string; tube: string };
  spliceInfo?: { trayId: number; loss: number };
  cableInfo?: { name: string; fiberCount: number; distance: number };
}
