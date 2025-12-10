# NetLink: Splice Matrix & End-to-End Fiber Tracing Improvement Plan

## Research Summary

### Industry Leaders Analyzed
- **[Splice.me](https://splice.me/)** - Web-based splice diagram creation
- **[cvFiber/CircuitVision](https://www.circuitvision.com/products/cvfiber/)** - OSP mapping with strand-level tracing
- **[FNT Software](https://www.fntsoftware.com/en/use-cases/telco/cable-and-outside-plant-management)** - Enterprise fiber management with cassette views
- **[Geoschematics/Continuum](https://cadmath.com/case-study-splice-matrix.html)** - Advanced splice matrix visualization
- **[FIBKIT.COM](https://help.fibkit.com/63505399-Splice-Schematics)** - Auto-generated splice schematics
- **[OZmap](https://ozmap.com/en/)** - Network mapping with splice diagrams
- **[netTerrain OSP](https://graphicalnetworks.com/blog-manage-your-outside-plant-mapping-fiber-strands-in-a-splice-box/)** - Hierarchical fiber strand visualization

### Key Industry Patterns

1. **Splice Matrix Visualization**
   - "Fiber bubbles" to consolidate consecutive splice connections
   - Color-coded rectangles representing buffer tubes
   - Abbreviated annotations for paired splices
   - Scalable designs supporting 2000+ fibers

2. **End-to-End Fiber Tracing**
   - Click-to-trace from any fiber to OLT and customer
   - Visual path highlighting across all splice points
   - Dual views: schematic + geographic

3. **Schematic Types**
   - All fiber connections at a splice point
   - Selected cable to other cables
   - Various fibers to selected cable

---

## Current NetLink State

### What We Have
- `FloatingSplicePanel.tsx` - Basic splice editor with dropdown fiber selection
- `FiberEdge.tsx` - Gradient-colored edges with splice count indicators
- `fiberColors.ts` - TIA-598 color standards (12 colors)
- Per-edge splice management (no cross-network view)

### Gaps
1. **No visual splice matrix** - Only list-based connections
2. **No end-to-end fiber path tracing** - Can't trace fiber from OLT to customer
3. **Splices stored per-tray, not per-edge** - Data model mismatch
4. **No tube-level visualization** - Fibers shown as flat list
5. **No cross-splice-point continuity** - Each edge isolated

---

## Proposed Architecture

### Data Model Enhancement

```typescript
// Enhanced Splice model in types/index.ts
interface Splice {
  id: number;
  trayId: number;

  // Source fiber
  cableAId: number;
  fiberA: number;
  tubeA: number;
  colorA: string;

  // Destination fiber
  cableBId: number;
  fiberB: number;
  tubeB: number;
  colorB: string;

  // Status tracking
  status: "completed" | "pending" | "failed";
  loss?: number; // dB

  // Fiber path continuity
  upstreamSpliceId?: number;  // Previous splice in the chain
  downstreamSpliceId?: number; // Next splice in the chain

  // NEW: For end-to-end tracing
  pathId?: string; // Unique ID for full fiber path (OLT port → customer port)
  fiberPathPosition?: number; // Position in the path (0 = OLT side)
}

// New: Fiber Path for tracing
interface FiberPath {
  id: string;
  projectId: number;

  // Start point (OLT)
  oltId: number;
  ponPortId: number;
  startFiber: number;

  // End point (Customer)
  napId?: number;
  napPortId?: number;
  customerName?: string;

  // Path segments
  segments: FiberPathSegment[];

  // Calculated values
  totalLoss: number;
  spliceCount: number;
  status: "complete" | "partial" | "disconnected";
}

interface FiberPathSegment {
  order: number;
  nodeId: string; // e.g., "olt-1", "closure-5", "nap-3"
  nodeType: "olt" | "odf" | "closure" | "lcp" | "nap";
  enclosureId?: number;
  trayId?: number;
  spliceId?: number;

  // Fiber info at this point
  cableId: number;
  fiberNumber: number;
  tubeNumber: number;
  fiberColor: string;
  tubeColor: string;
}
```

### New Components

```
src/components/topology/
├── SpliceMatrixPanel.tsx       # NEW: Visual splice matrix
├── FiberPathTracer.tsx         # NEW: End-to-end path tracing
├── TubeGridView.tsx            # NEW: Buffer tube visualization
├── FloatingSplicePanel.tsx     # ENHANCED: Add matrix view toggle
└── edges/
    └── FiberEdge.tsx           # ENHANCED: Path highlighting
```

---

## Implementation Plan

### Phase 1: Visual Splice Matrix (HIGH PRIORITY)

**Goal:** Replace dropdown fiber selection with interactive visual matrix

**UI Design:**
```
┌─────────────────────────────────────────────────────────────┐
│ [≡] Splice Matrix: Closure-A                         [×]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   CABLE A (Feeder-48F)              CABLE B (Drop-24F)     │
│   ┌──────────────────┐              ┌──────────────────┐    │
│   │ T1  T2  T3  T4   │              │ T1  T2           │    │
│   │ ●●● ●●● ●●● ●●●  │   ═══════   │ ●●● ●●●          │    │
│   │ ●●● ●●● ●●● ●●●  │   ═══════   │ ●●● ●●●          │    │
│   │ ●●● ●●● ●●● ●●●  │   ═══════   │                   │    │
│   │ ●●● ●●● ●●● ●●●  │              │                   │    │
│   └──────────────────┘              └──────────────────┘    │
│                                                             │
│   Legend: ● Available  ○ Connected  ⊗ Pending  ✕ Faulty   │
├─────────────────────────────────────────────────────────────┤
│   Selected: T1-F3 (Green) ↔ T1-F3 (Green)                  │
│   [Connect] [Auto-Match Tube] [Auto-Match All]             │
└─────────────────────────────────────────────────────────────┘
```

**Features:**
1. Visual tube grid showing all fibers
2. Click fiber on side A, click fiber on side B to connect
3. Color-coded fiber dots (following TIA-598)
4. Tube grouping with tube color indicators
5. Hover to show fiber info tooltip
6. Drag-select multiple fibers for bulk operations
7. Connection lines drawn between connected fibers

**Implementation:**
```typescript
// src/components/topology/SpliceMatrixPanel.tsx

interface SpliceMatrixProps {
  isOpen: boolean;
  onClose: () => void;
  closureId: number;
  trayId: number;
  cableA: { id: number; name: string; fiberCount: number };
  cableB: { id: number; name: string; fiberCount: number };
  existingSplices: Splice[];
  onSpliceChange: (splices: Splice[]) => void;
}

// Visual fiber dot component
function FiberDot({
  fiber,
  tube,
  color,
  status,
  isSelected,
  onClick
}: FiberDotProps) {
  return (
    <button
      className={cn(
        "w-4 h-4 rounded-full border-2 transition-all",
        status === "available" && "bg-opacity-100",
        status === "connected" && "ring-2 ring-green-400",
        status === "pending" && "ring-2 ring-amber-400 animate-pulse",
        isSelected && "ring-2 ring-blue-500 scale-125"
      )}
      style={{ backgroundColor: color }}
      onClick={onClick}
      title={`Tube ${tube}, Fiber ${fiber}`}
    />
  );
}
```

---

### Phase 2: End-to-End Fiber Tracing (HIGH PRIORITY)

**Goal:** Trace any fiber from OLT to customer through all splice points

**UI Design:**
```
┌─────────────────────────────────────────────────────────────┐
│ [≡] Fiber Path: OLT-1 Port 3 → Customer "John Doe"   [×]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   🏢 OLT-1                                                  │
│   └─ PON Port 3, Fiber 7 (Blue)                            │
│         │                                                   │
│         ▼ 48F Feeder Cable (2.3 km)                        │
│                                                             │
│   📦 Closure-A (Tray 1)                                    │
│   └─ Splice: F7-Blue → F7-Blue                             │
│         │                                                   │
│         ▼ 24F Distribution (800m)                          │
│                                                             │
│   🔀 LCP-1 (1:8 Splitter, Port 3)                          │
│         │                                                   │
│         ▼ 12F Drop (200m)                                  │
│                                                             │
│   📍 NAP-A (Port 5)                                        │
│   └─ Customer: John Doe                                    │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│   Total Loss: 12.4 dB | Splices: 3 | Distance: 3.3 km     │
│   [Highlight Path on Canvas] [Export Report]               │
└─────────────────────────────────────────────────────────────┘
```

**Features:**
1. Click any node or edge to start tracing
2. Auto-discover path upstream (to OLT) and downstream (to customer)
3. Show all splice points with fiber colors at each stage
4. Calculate cumulative loss budget
5. Highlight entire path on canvas with glowing effect
6. Export path as documentation

**Canvas Integration:**
- Traced edges glow with animated particles
- Non-traced elements fade to 30% opacity
- Traced nodes get highlight ring
- Show fiber color at each segment on hover

---

### Phase 3: Tube-Level Visualization (MEDIUM)

**Goal:** Show buffer tubes as visual groups on canvas

**Implementation:**
- Expand closure node to show tray cassette view
- Visual tube rectangles with fiber dots inside
- Connection lines between tubes across cables
- Tube color indicators

---

### Phase 4: Enhanced Edge Labels (MEDIUM)

**Goal:** Show splice status and fiber utilization on edges

**Design:**
```
Current: [48F | ✓12 ⏳3]   (fiber count, completed, pending)
Enhanced: Show mini tube diagram on hover
```

---

### Phase 5: Path Auto-Discovery (LOW)

**Goal:** Automatically build fiber paths when splices are created

**Implementation:**
- When splice created, look for upstream/downstream connections
- Build `FiberPath` record linking all segments
- Update path when any splice in chain changes

---

## Database Changes Required

```typescript
// Add to db/index.ts version 7

// New table for fiber paths
fiberPaths: "++id, projectId, oltId, ponPortId, status"

// Enhanced splice indexes for path traversal
splices: "++id, trayId, cableAId, cableBId, fiberA, fiberB, pathId, status"
```

---

## UI Component Library (shadcn)

Recommended components to adopt:

1. **Dialog** - For confirmation modals
2. **Popover** - For fiber info tooltips
3. **Tooltip** - For quick info on hover
4. **Select** - Improved dropdowns
5. **Badge** - Status indicators
6. **Command** - Command palette (Cmd+K)
7. **Tabs** - Switch between matrix/list view
8. **ScrollArea** - Smooth scrolling in panels
9. **Separator** - Visual dividers
10. **Toggle** - View mode switches

---

## Implementation Order

| Priority | Phase | Estimated Effort |
|----------|-------|------------------|
| 1 | Visual Splice Matrix Panel | 4-6 hours |
| 2 | End-to-End Fiber Tracing | 4-6 hours |
| 3 | Canvas Path Highlighting | 2-3 hours |
| 4 | Tube-Level Visualization | 3-4 hours |
| 5 | Enhanced Edge Labels | 2 hours |
| 6 | Path Auto-Discovery | 3-4 hours |
| 7 | shadcn Integration | 2-3 hours |

---

## Color Coding Strategy: OLT to Customer

### Visual Hierarchy by Segment

```
OLT → ODF        : Use OLT accent color (Teal)
ODF → Closure    : Use fiber's tube color as gradient start
Closure → LCP    : Gradient from incoming to outgoing fiber color
LCP → NAP        : Splitter output - use output fiber color
NAP → Customer   : Customer status color (green=active, gray=inactive)
```

### Edge Gradient Strategy

```typescript
// Enhanced FiberEdge color logic

function getEdgeColors(edge: Edge, splices: Splice[]) {
  const { sourceNode, targetNode } = edge;

  // Get first and last fiber colors in this edge's splices
  const firstFiber = splices[0];
  const lastFiber = splices[splices.length - 1];

  return {
    sourceColor: getFiberHex(firstFiber.colorA),
    targetColor: getFiberHex(lastFiber.colorB),
    // For traced paths, add glow
    glowColor: isTraced ? "#60a5fa" : undefined,
  };
}
```

### Fiber Color on Nodes

Show fiber entering/exiting each node:
- **Closure expanded view**: Show incoming/outgoing fiber colors per tray
- **LCP expanded view**: Show input fiber color, output colors per splitter port
- **NAP expanded view**: Show fiber color serving each customer port

---

## Sources

- [Splice.me](https://splice.me/) - Fiber diagram creation
- [cvFiber](https://www.circuitvision.com/products/cvfiber/) - OSP management
- [FNT Software](https://www.fntsoftware.com/) - Cable management
- [Geoschematics](https://cadmath.com/case-study-splice-matrix.html) - Splice matrix visualization
- [FIBKIT.COM](https://help.fibkit.com/) - Splice schematics
- [OZmap](https://ozmap.com/en/) - Network mapping
- [netTerrain](https://graphicalnetworks.com/) - Fiber strand documentation
- [FOA Color Codes](https://www.thefoa.org/tech/ColCodes.htm) - TIA-598 standard
