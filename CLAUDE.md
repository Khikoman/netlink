# NetLink - FTTH Network Management System

## Project Overview

NetLink is a **canvas-centric fiber optic network management tool** built with Next.js 16, React Flow, and Dexie.js (IndexedDB). The application enables ISPs and network engineers to visually design, manage, and document their Fiber-to-the-Home (FTTH) infrastructure.

### Core Concept
The topology canvas IS the main interface - users create and manage network infrastructure by dragging, dropping, and connecting visual nodes representing physical network equipment.

## Technology Stack

| Technology | Purpose |
|------------|---------|
| **Next.js 16** | React framework with App Router |
| **React Flow** | Interactive node-based canvas |
| **Dexie.js** | IndexedDB wrapper for local storage |
| **Tailwind CSS** | Styling |
| **TypeScript** | Type safety |
| **Lucide React** | Icons |

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   └── page.tsx           # Main canvas page
├── components/
│   ├── topology/          # Canvas components
│   │   ├── TopologyCanvas.tsx       # Main React Flow canvas
│   │   ├── FloatingPalette.tsx      # Drag-and-drop component palette
│   │   ├── UnifiedSpliceEditor/     # Fiber Fusion Studio - visual splice editor
│   │   │   ├── index.tsx            # Main floating panel
│   │   │   ├── CableCrossSection.tsx # Visual cable end with tubes
│   │   │   ├── TubeRow.tsx          # Buffer tube with 12 colored fibers
│   │   │   ├── FiberDot.tsx         # Clickable fiber dot
│   │   │   ├── ConnectionLine.tsx   # SVG bezier path with gradient
│   │   │   ├── SparkleEffect.tsx    # Particle animation on connect
│   │   │   └── MetadataPanel.tsx    # Loss, method, status, technician
│   │   ├── nodes/
│   │   │   └── ExpandableNodes.tsx  # All node types (OLT, ODF, Closure, LCP, NAP)
│   │   └── edges/
│   │       └── FiberEdge.tsx        # Custom fiber connection edge
│   └── ...
├── contexts/
│   ├── NetworkContext.tsx           # Project/network state
│   └── NodeActionsContext.tsx       # Node action handlers (legacy - see notes)
├── lib/
│   ├── db/
│   │   ├── index.ts                 # Dexie database schema
│   │   ├── hooks.ts                 # React hooks for DB queries
│   │   └── spliceService.ts         # Edge-based splice CRUD operations
│   ├── fiberColors.ts               # Fiber color standards
│   └── topology/
│       └── layoutUtils.ts           # Auto-layout algorithms
└── types/
    └── index.ts                     # TypeScript type definitions
```

## Network Hierarchy

The FTTH network follows this hierarchy:

```
OLT (Optical Line Terminal)
 └── ODF (Optical Distribution Frame)
      └── Closure (Splice Closure / Handhole / Pedestal)
           └── LCP (Local Convergence Point) / FDT
                └── NAP (Network Access Point) / FAT
                     └── Customer (ONT/ONU)
```

### Node Types

| Type | Description | Can Parent |
|------|-------------|------------|
| **OLT** | Central office equipment | ODF, Closure, LCP |
| **ODF** | Fiber patch panel | Closure |
| **Closure** | Splice enclosure (cascadable) | Closure, LCP |
| **LCP** | Distribution point with splitter | NAP |
| **NAP** | Customer access point | Customer |

## Database Schema (Dexie/IndexedDB)

```typescript
// Key tables (v7)
olts: "++id, projectId, name, canvasX, canvasY"
odfs: "++id, projectId, oltId, name, canvasX, canvasY"
enclosures: "++id, projectId, type, parentType, parentId, canvasX, canvasY, expanded"
trays: "++id, enclosureId, number"
splices: "++id, trayId, edgeId, cableAId, cableBId, fiberA, fiberB, status, timestamp"
cables: "++id, projectId, name, fiberCount, fiberType"
ports: "++id, enclosureId, portNumber, status, customerName"
```

### Edge-Based Splice Storage

Splices are stored with an `edgeId` field linking them to React Flow edges:

```typescript
// Query splices for an edge
const splices = await db.splices.where("edgeId").equals(edgeId).toArray();

// Save splices via spliceService
import { saveSplicesForEdge } from "@/lib/db/spliceService";
await saveSplicesForEdge({ edgeId, trayId, cableAId, cableBId, connections });
```

## Key Implementation Patterns

### 1. Passing Callbacks to React Flow Nodes/Edges

**CRITICAL LESSON LEARNED:**

React Flow custom nodes/edges may NOT receive React Context properly. The context's default values get used instead of the actual provided values.

**WRONG (doesn't work reliably):**
```typescript
// In node component
const { onEdit, onDelete } = useNodeActions(); // Gets default no-op handlers!
```

**CORRECT (guaranteed to work):**
```typescript
// In TopologyCanvas.tsx - inject callbacks via data prop
const filteredNodes = useMemo(() => {
  return nodes.map(node => ({
    ...node,
    data: {
      ...node.data,
      onAddChild: handleNodeAddChild,
      onEdit: handleNodeEdit,
      onDelete: handleNodeDelete,
      // ... other callbacks
    }
  }));
}, [nodes, handleNodeAddChild, handleNodeEdit, handleNodeDelete]);

// In node component - read from data prop
function MyNode({ data, id }: NodeProps<MyNodeData>) {
  const { onEdit, onDelete } = data;
  // Use optional chaining: onEdit?.(id, data.type);
}
```

### 2. Node Position Persistence

Nodes save their canvas position to IndexedDB on drag:
```typescript
const onNodeDragStop = useCallback(async (event, node) => {
  await updateNodePosition(node.data.nodeType, node.data.dbId, node.position.x, node.position.y);
}, []);
```

### 3. Expandable Nodes

Some nodes (Closure, NAP) can expand inline to show details:
- Closure: Shows trays and splices
- NAP: Shows ports and connected customers

Use `toggleEnclosureExpanded(id, expanded)` to persist state.

### 4. Edge Styling

FiberEdge uses SVG gradients for color transitions and filter effects for glow:
```typescript
<linearGradient id={gradientId}>
  <stop offset="0%" stopColor={sourceColor} />
  <stop offset="100%" stopColor={targetColor} />
</linearGradient>
```

## Current Implementation Status

### Completed
- [x] Canvas-centric layout
- [x] Position persistence (canvasX/canvasY)
- [x] Expandable nodes (Closure shows trays/splices, NAP shows ports)
- [x] FiberEdge with gradient colors and glow effects
- [x] Floating component palette (drag-to-create)
- [x] Connection validation (hierarchy rules)
- [x] NodeToolbar with quick actions (Add, Edit, Delete, Location, Duplicate)
- [x] **UnifiedSpliceEditor** - "Fiber Fusion Studio" visual splice editor
- [x] Keyboard shortcuts (Delete, E for edit, G for GPS, S for splices, T for trace)
- [x] GPS location picker integration
- [x] Full edit dialog for node properties
- [x] Fiber path tracing with canvas highlighting

### Pending
- [ ] Full undo/redo system (`useUndoRedo` hook exists but not integrated)
- [ ] Customer nodes as visual elements

## UnifiedSpliceEditor ("Fiber Fusion Studio")

The UnifiedSpliceEditor is the **canvas-only** splice editing experience that replaces all sidebar splice components.

### Features
- **Visual Fiber Colors**: TIA-598 standard colors for buffer tubes and fibers
- **Click-to-Connect**: Click fiber A → Click fiber B → Spark animation
- **Batch Operations**: Auto-match 1:1 with cascading animation
- **Full Metadata**: Loss (dB), method (fusion/mechanical), status, technician
- **Draggable Panel**: Position saved per session

### Opening the Splice Editor
```typescript
// From FiberEdge (click Edit Splices button)
onOpenSpliceEditor={handleOpenSpliceEditor}

// From TopologyCanvas - opens UnifiedSpliceEditor
const handleOpenSpliceEditor = useCallback(async (edgeId: string) => {
  // Finds/creates cable and tray, then opens editor
  setSpliceEditor({ edgeId, trayId, cableA, cableB });
}, [edges, nodes, projectId]);
```

### Component Structure
```
UnifiedSpliceEditor/
├── index.tsx          # Main floating panel with drag support
├── CableCrossSection  # Cable end with expandable tubes
├── TubeRow            # 12 fiber dots with TIA-598 colors
├── FiberDot           # Clickable/selectable fiber
├── ConnectionLine     # SVG bezier curve with gradient
├── SparkleEffect      # Particle burst on connection
└── MetadataPanel      # Loss/method/status/technician form
```

### Animations
- **Spark Burst**: 8-12 particles on connection (400ms)
- **Fiber Pulse**: Connected fibers glow with CSS animation
- **Flow Line**: SVG `animateMotion` for "light traveling" effect

## Common Tasks

### Adding a New Node Type
1. Add type to `enclosures.type` enum in `src/lib/db/index.ts`
2. Create node component in `ExpandableNodes.tsx`
3. Add to `expandableNodeTypes` registry
4. Update `buildFlowData()` in `TopologyCanvas.tsx`
5. Update `getAllowedChildTypes()` for hierarchy rules

### Adding a New Action to Nodes
1. Add handler in `TopologyCanvas.tsx` (use `useCallback`)
2. Add to `filteredNodes` useMemo data injection
3. Add to `BaseNodeData` interface in `ExpandableNodes.tsx`
4. Destructure from `data` in node component
5. Use with optional chaining: `onNewAction?.(id, data.type)`

### Adding Edge Actions
1. Add handler in `TopologyCanvas.tsx`
2. Add to `edgesWithCallbacks` useMemo
3. Add to `FiberEdgeData` interface
4. Read from `data?.onNewAction` in FiberEdge component

## Debugging Tips

1. **Buttons not working?** Check if callbacks are being injected via `data` prop, not context
2. **Node not rendering?** Check `expandableNodeTypes` registry
3. **Database issues?** Check Dexie schema version and indexes
4. **Position not saving?** Verify `dbId` and `nodeType` in node data

## Environment

- Node.js 18+
- npm
- Local development: `npm run dev` (port 3000)
- Build: `npm run build`

## Files to Read First

When starting work on this project, read these files in order:
1. This file (`CLAUDE.md`)
2. `src/components/topology/TopologyCanvas.tsx` - Main canvas logic
3. `src/components/topology/nodes/ExpandableNodes.tsx` - Node components
4. `src/lib/db/index.ts` - Database schema
5. `src/types/index.ts` - Type definitions

## Session History & Learnings

### Session: Node Toolbar Fix (2024)
**Problem:** NodeToolbar buttons (Add, Edit, Delete, etc.) appeared but did nothing when clicked.

**Root Cause:** React Context (`NodeActionsContext`) was not propagating to React Flow custom nodes. Nodes received the default no-op handlers instead of actual handlers.

**Solution:** Inject callbacks directly into `node.data` via a `useMemo` transformation before passing nodes to React Flow. Same pattern applied to edges.

**Key Insight:** Always pass functions to React Flow nodes/edges via the `data` prop, never rely on React Context.

---

### Session: Unified Splice Editor (2024)
**Goal:** Consolidate 5 redundant splice editors into ONE canvas-only visual experience.

**Components Removed:**
- `FloatingSplicePanel.tsx`
- `EdgeSpliceEditor.tsx`
- `src/components/splice/SpliceMatrix.tsx` (sidebar)
- `src/components/splice/EnclosureManager.tsx` (sidebar)

**New Components Created:**
- `UnifiedSpliceEditor/` - Full visual fiber splice editor with:
  - TIA-598 color-coded fibers
  - Click-to-connect workflow
  - Spark animation on connection
  - Batch auto-match operations
  - Full metadata editing (loss, method, status, technician)

**Database Changes:**
- Added `edgeId` field to `Splice` interface (v7 schema)
- Created `spliceService.ts` for edge-based CRUD
- Added `useSplicesByEdge` hook

**Key Pattern:** Edge-based splice storage - splices are linked to React Flow edges via `edgeId` rather than only via `trayId`.

---

## AI Development Environment

### Available Subagents

NetLink has custom Claude Code agents in `.claude/agents/`. Use them for specialized tasks:

#### Lead Agent

| Agent | When to Use | Invoke With |
|-------|-------------|-------------|
| `netlink-architect` | Planning, coordination, task delegation | "Use the netlink-architect to..." |

The **Architect** is the lead agent that coordinates all other agents. Use it for:
- Creating implementation plans for complex features
- Breaking down large tasks into smaller agent-assignable work
- Reviewing and prioritizing bugs and improvements
- Making architectural decisions

#### Development Agents

| Agent | When to Use | Invoke With |
|-------|-------------|-------------|
| `react-flow-specialist` | Canvas work, nodes, edges, callbacks | "Use the react-flow-specialist to..." |
| `dexie-database-specialist` | DB schema, migrations, CRUD, hooks | "Use the dexie-database-specialist to..." |
| `ftth-domain-expert` | Fiber standards, hierarchy, splices | "Use the ftth-domain-expert to..." |
| `netlink-reviewer` | Code review, pattern violations | "Use the netlink-reviewer to..." |
| `test-architect` | Testing strategy, Jest, Playwright | "Use the test-architect to..." |

#### Operations Agents (Real-Life FTTH Operations)

| Agent | When to Use | Invoke With |
|-------|-------------|-------------|
| `ftth-operations-manager` | Work orders, field scheduling, SLA tracking | "Use the ftth-operations-manager to..." |
| `field-technician-assistant` | Splice procedures, OTDR testing, troubleshooting | "Use the field-technician-assistant to..." |
| `network-planner` | PON design, loss budgets, split ratios | "Use the network-planner to..." |
| `report-generator` | As-built docs, splice reports, exports | "Use the report-generator to..." |
| `customer-service-agent` | Provisioning, support, customer workflows | "Use the customer-service-agent to..." |
| `inventory-manager` | Material tracking, equipment lifecycle | "Use the inventory-manager to..." |

### Example Agent Invocations

```
# Development Tasks
"Use the react-flow-specialist to create a new Cabinet node type"
"Use the dexie-database-specialist to add a new table for work orders"
"Use the ftth-domain-expert to verify this network hierarchy is correct"
"Use the netlink-reviewer to check TopologyCanvas.tsx for pattern violations"
"Use the test-architect to create tests for the fiber color utilities"

# Operations Tasks
"Use the ftth-operations-manager to design the work order system"
"Use the field-technician-assistant to create a splice procedure guide"
"Use the network-planner to calculate loss budget for a 1:64 split"
"Use the report-generator to design splice closure report format"
"Use the customer-service-agent to create a service provisioning workflow"
"Use the inventory-manager to design equipment tracking schema"
```

### Agent Pipeline (Feature Development)

For complex features, chain agents:

```
1. ftth-domain-expert    → Validate network design requirements
2. dexie-database-specialist → Create/update database schema
3. react-flow-specialist → Implement canvas components
4. netlink-reviewer      → Review for pattern compliance
5. test-architect        → Add test coverage
```

### Agent Pipeline (Operations Features)

For operations features (work orders, customers, inventory):

```
1. ftth-operations-manager   → Define workflows and requirements
2. customer-service-agent    → Define customer-facing processes
3. inventory-manager         → Define material tracking needs
4. dexie-database-specialist → Create database schema
5. report-generator          → Design documentation formats
6. react-flow-specialist     → Implement UI components
```

## Operations Roadmap

See [docs/OPERATIONS_ROADMAP.md](docs/OPERATIONS_ROADMAP.md) for the 6-phase plan to transform NetLink into a complete FTTH operations platform:

| Phase | Focus | Key Deliverables |
|-------|-------|------------------|
| Phase 1 | Foundation | Supabase migration, authentication, customers |
| Phase 2 | Work Orders | Work order system, mobile PWA, scheduling |
| Phase 3 | Inventory | Material tracking, equipment lifecycle |
| Phase 4 | Documentation | OTDR integration, reports, compliance |
| Phase 5 | Analytics | Dashboards, KPIs, predictive maintenance |
| Phase 6 | Integrations | API platform, billing, CRM, GIS |

### Available Slash Commands

| Command | Purpose |
|---------|---------|
| `/new-node-type [name]` | Create a new React Flow node type |
| `/add-db-table [name]` | Add a Dexie table with migrations |
| `/fix-callback [issue]` | Debug callback issues in nodes/edges |
| `/review-topology` | Review canvas code for violations |
| `/create-tests [target]` | Generate tests for component/function |

### MCP Servers Available

| MCP | Purpose | Use For |
|-----|---------|---------|
| **Context7** | Library documentation | React Flow, Next.js, Dexie.js, TypeScript docs |
| **GitHub** | Code search, PRs | Find examples, search issues, create PRs |
| **Supabase** | Database patterns | Reference for future cloud sync |
| **Playwright** | Browser automation | E2E testing canvas interactions |
| **ESLint** | Code quality | Lint checks, auto-fix suggestions |
| **npm-helper** | Package search | Find React Flow plugins, dependencies |
| **Brave Search** | Web research | MDN docs, Stack Overflow, specs |
| **Memory** | Persistent knowledge | Remember project context across sessions |
| **Filesystem** | File operations | Read/write project files |
| **Sequential Thinking** | Complex problems | Multi-step reasoning |

---

*This file is read by Claude Code agents to understand the project. Keep it updated with architectural decisions, lessons learned, and implementation patterns.*
