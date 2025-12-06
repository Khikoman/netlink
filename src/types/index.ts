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

// ============================================
// OLT (Optical Line Terminal) TYPES
// ============================================

export type OLTPonPortStatus = "available" | "active" | "reserved" | "faulty";

export interface OLT {
  id?: number;
  projectId: number;
  name: string; // e.g., "OLT-001"
  model?: string; // e.g., "Huawei MA5800"
  manufacturer?: string;
  totalPonPorts: number; // e.g., 16, 32, 64
  gpsLat?: number;
  gpsLng?: number;
  address?: string;
  notes?: string;
  createdAt: Date;
  // Canvas position for topology view
  canvasX?: number;
  canvasY?: number;
}

export interface OLTPonPort {
  id?: number;
  oltId: number;
  portNumber: number; // 1, 2, 3...
  label?: string; // e.g., "PON-01"
  status: OLTPonPortStatus;
  connectedCableId?: number; // Feeder cable
  maxSplitRatio: number; // e.g., 64, 128
  notes?: string;
}

// ============================================
// ODF (Optical Distribution Frame) TYPES
// ============================================

export interface ODF {
  id?: number;
  projectId: number;
  oltId: number;
  name: string; // e.g., "ODF-A", "ODF-001"
  portCount: number; // e.g., 48, 96, 144
  location?: string; // Physical location description
  gpsLat?: number;
  gpsLng?: number;
  notes?: string;
  createdAt: Date;
  // Canvas position for topology view
  canvasX?: number;
  canvasY?: number;
}

export type ODFPortStatus = "available" | "connected" | "reserved" | "faulty";

export interface ODFPort {
  id?: number;
  odfId: number;
  portNumber: number; // 1, 2, 3...
  label?: string; // e.g., "ODF-A-01"
  status: ODFPortStatus;
  ponPortId?: number; // Which PON port connects to this ODF port (input side)
  closureId?: number; // Which primary closure this ODF port feeds (output side)
  cableId?: number; // Feeder cable going to the closure
  notes?: string;
}

// ============================================
// ENCLOSURE TYPES
// ============================================

// Hierarchy levels for proper topology ordering
export type HierarchyLevel = "primary-closure" | "secondary-closure" | "lcp" | "nap";

export type EnclosureType =
  | "splice-closure"
  | "handhole"
  | "pedestal"
  | "building"
  | "pole"
  | "cabinet"
  | "lcp"  // Local Convergence Point (aggregation)
  | "nap"  // Network Access Point (customer drop)
  | "fdt"  // Fiber Distribution Terminal (alt for LCP)
  | "fat"; // Fiber Access Terminal (alt for NAP)

export type EnclosureParentType = "olt" | "odf" | "closure" | "lcp";

export interface Enclosure {
  id?: number;
  projectId: number;
  name: string;
  type: EnclosureType;

  // Parent hierarchy fields
  // Full Hierarchy: OLT -> ODF -> Primary Closure -> Secondary Closure -> LCP -> NAP
  parentType?: EnclosureParentType;
  parentId?: number; // ODF id for Primary Closure, Closure id for LCP, LCP id for NAP
  oltPonPortId?: number; // For LCPs: which PON port feeds this LCP
  odfPortId?: number; // For Primary Closures: which ODF port feeds this closure

  // Hierarchy level for topology ordering
  hierarchyLevel?: HierarchyLevel;

  gpsLat?: number;
  gpsLng?: number;
  address?: string;
  notes?: string;
  createdAt: Date;
  // Canvas position for topology view
  canvasX?: number;
  canvasY?: number;
  // Expanded state for inline editing on canvas
  expanded?: boolean;
}

export interface Tray {
  id?: number;
  enclosureId: number;
  number: number;
  capacity: number; // Max splices per tray (typically 12, 24)
  notes?: string;
}

// ============================================
// SPLITTER & PORT TYPES (LCP/NAP)
// ============================================

export type SplitterType = "1:2" | "1:4" | "1:8" | "1:16" | "1:32";

export interface Splitter {
  id?: number;
  enclosureId: number;
  name: string; // e.g., "SPL-01"
  type: SplitterType;
  inputCableId?: number; // Feeder cable
  inputFiber?: number; // Which fiber from feeder
  notes?: string;
  createdAt: Date;
}

export type PortType = "input" | "output" | "bidirectional";
export type PortStatus = "available" | "connected" | "reserved" | "faulty";
export type ConnectorType = "LC" | "SC" | "FC" | "ST" | "MPO" | "MTP";

export type ServiceStatus = "active" | "suspended" | "pending" | "terminated";

export interface Port {
  id?: number;
  enclosureId: number;
  splitterId?: number; // If part of a splitter
  portNumber: number; // 1, 2, 3... (position)
  label?: string; // Custom label like "P1", "C-101"
  type: PortType;
  status: PortStatus;
  connectorType: ConnectorType;

  // Connection info (if connected)
  connectedCableId?: number;
  connectedFiber?: number;

  // Customer info (for NAP ports)
  customerName?: string;
  customerAddress?: string;
  serviceId?: string; // Account/Service ID

  // Customer contact info
  customerPhone?: string;
  customerEmail?: string;

  // Customer GPS location
  customerGpsLat?: number;
  customerGpsLng?: number;

  // ONU Optical Readings
  onuRxPower?: number; // dBm - Signal ONU receives
  onuTxPower?: number; // dBm - Signal ONU transmits
  oltRxPower?: number; // dBm - Signal OLT receives from this ONU
  onuModel?: string; // ONU device model
  onuSerial?: string; // ONU serial number
  onuMac?: string; // ONU MAC address
  lastReadingDate?: Date; // When readings were taken

  // Service info
  serviceStatus?: ServiceStatus;
  installDate?: Date;
  planType?: string; // Service plan name

  notes?: string;
  createdAt: Date;
}

// ============================================
// CABLE & SPLICE TYPES
// ============================================

// Cable role in the network hierarchy
export type CableRole = "feeder-trunk" | "distribution" | "drop" | "patch";

export interface Cable {
  id?: number;
  projectId?: number;
  name: string;
  fiberCount: 12 | 24 | 48 | 96 | 144 | 216 | 288;
  fiberType: "singlemode" | "multimode";
  lengthMeters?: number;
  reelNumber?: string;
  manufacturer?: string;
  role?: CableRole; // Role in network hierarchy
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

// ConnectorType is defined in SPLITTER & PORT TYPES section above

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

// ============================================
// CUSTOMER ATTACHMENT TYPES
// ============================================

export type AttachmentType = "photo" | "document" | "signature" | "id" | "contract" | "other";

export interface CustomerAttachment {
  id?: number;
  portId: number; // Link to customer port
  projectId: number;
  filename: string;
  mimeType: string; // image/jpeg, application/pdf, etc.
  fileSize: number; // bytes
  blob: Blob; // The actual file data
  attachmentType: AttachmentType;
  description?: string;
  uploadedAt: Date;
}
