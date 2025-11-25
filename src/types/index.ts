// NetLink OSP Fiber Management - TypeScript Types

// ============================================
// PROJECT & LOCATION TYPES
// ============================================

export interface Project {
  id?: number;
  name: string;
  location: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  status: "active" | "completed" | "archived";
}

export interface Enclosure {
  id?: number;
  projectId: number;
  name: string;
  type: "splice-closure" | "handhole" | "pedestal" | "building" | "pole" | "cabinet";
  gpsLat?: number;
  gpsLng?: number;
  address?: string;
  notes?: string;
  createdAt: Date;
}

export interface Tray {
  id?: number;
  enclosureId: number;
  number: number;
  capacity: number; // Max splices per tray (typically 12, 24)
  notes?: string;
}

// ============================================
// CABLE & SPLICE TYPES
// ============================================

export interface Cable {
  id?: number;
  projectId?: number;
  name: string;
  fiberCount: 12 | 24 | 48 | 96 | 144 | 216 | 288;
  fiberType: "singlemode" | "multimode";
  lengthMeters?: number;
  reelNumber?: string;
  manufacturer?: string;
  notes?: string;
}

export type SpliceType = "fusion" | "mechanical";

export interface Splice {
  id?: number;
  trayId: number;
  // Cable A (source)
  cableAId: number;
  cableAName: string;
  fiberA: number;
  tubeAColor: string;
  fiberAColor: string;
  // Cable B (destination)
  cableBId: number;
  cableBName: string;
  fiberB: number;
  tubeBColor: string;
  fiberBColor: string;
  // Splice details
  spliceType: SpliceType;
  loss?: number; // dB
  lossDirection?: "a-to-b" | "b-to-a" | "bidirectional";
  // Documentation
  technicianName: string;
  timestamp: Date;
  notes?: string;
  otdrTraceId?: number;
  // Status
  status: "pending" | "completed" | "needs-review" | "failed";
}

export interface SpliceComplianceResult {
  status: "pass" | "warn" | "fail";
  issues: string[];
  lossStatus?: "good" | "acceptable" | "high" | "failed";
}

// ============================================
// OTDR TYPES
// ============================================

export interface OtdrTrace {
  id?: number;
  spliceId?: number;
  filename: string;
  wavelength: number; // nm (1310, 1550, 850, 1300)
  pulseWidth?: number; // ns
  range?: number; // meters
  data: Blob;
  parsedEvents?: OtdrEvent[];
  uploadedAt: Date;
}

export interface OtdrEvent {
  distance: number; // meters
  loss: number; // dB
  reflectance?: number; // dB
  type: "splice" | "connector" | "bend" | "break" | "end";
  notes?: string;
}

export interface OtdrTraceData {
  distances: number[]; // x-axis values in meters
  powers: number[]; // y-axis values in dB
  events: OtdrEvent[];
  metadata: {
    wavelength: number;
    pulseWidth: number;
    range: number;
    resolution: number;
    refractiveIndex: number;
    manufacturer?: string;
    model?: string;
  };
}

// ============================================
// INVENTORY TYPES
// ============================================

export type InventoryCategory =
  | "cable"
  | "enclosure"
  | "connector"
  | "splice-tray"
  | "splice-sleeve"
  | "tools"
  | "consumables"
  | "other";

export interface InventoryItem {
  id?: number;
  category: InventoryCategory;
  name: string;
  partNumber?: string;
  manufacturer?: string;
  quantity: number;
  unit: string; // "meters", "pcs", "rolls", "boxes"
  minStock: number; // Alert threshold
  unitCost?: number;
  location?: string; // Storage location
  notes?: string;
}

export interface InventoryUsage {
  id?: number;
  inventoryId: number;
  projectId: number;
  quantity: number;
  date: Date;
  usedBy?: string;
  notes?: string;
}

// ============================================
// LOSS BUDGET TYPES
// ============================================

export type FiberType = "singlemode" | "multimode";
export type Wavelength = 850 | 1300 | 1310 | 1550;

export type ConnectorType = "LC" | "SC" | "FC" | "ST" | "MPO" | "MTP";

export interface LossBudgetInput {
  name: string;
  fiberType: FiberType;
  wavelength: Wavelength;
  distanceKm: number;
  fusionSplices: number;
  mechanicalSplices: number;
  connectorPairs: number;
  connectorType: ConnectorType;
  marginDb: number;
}

export interface LossBudgetResult {
  id?: number;
  input: LossBudgetInput;
  fiberLoss: number;
  fusionLoss: number;
  mechanicalLoss: number;
  connectorLoss: number;
  marginLoss: number;
  totalLoss: number;
  createdAt: Date;
}

// ============================================
// NETWORK MAP TYPES
// ============================================

export type MapNodeType = "enclosure" | "handhole" | "building" | "pole" | "splitter" | "olt" | "ont";

export interface MapNode {
  id?: number;
  projectId: number;
  type: MapNodeType;
  label: string;
  x: number;
  y: number;
  gpsLat?: number;
  gpsLng?: number;
  enclosureId?: number; // Link to enclosure record
  color?: string;
  notes?: string;
}

export interface MapRoute {
  id?: number;
  projectId: number;
  fromNodeId: number;
  toNodeId: number;
  cableId?: number;
  label?: string;
  fiberCount?: number;
  color?: string;
  points?: { x: number; y: number }[]; // Intermediate points for curves
}

export interface NetworkMapData {
  nodes: MapNode[];
  routes: MapRoute[];
}

// ============================================
// SYNC QUEUE (for future cloud sync)
// ============================================

export interface SyncQueueItem {
  id?: number;
  table: string;
  recordId: number;
  action: "create" | "update" | "delete";
  data: string; // JSON stringified
  timestamp: Date;
  synced: boolean;
}
