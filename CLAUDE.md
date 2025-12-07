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
│   │   ├── FloatingSplicePanel.tsx  # Splice editing panel
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
│   │   └── hooks.ts                 # React hooks for DB queries
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
// Key tables
olts: "++id, projectId, name, canvasX, canvasY"
odfs: "++id, projectId, oltId, name, canvasX, canvasY"
enclosures: "++id, projectId, type, parentType, parentId, canvasX, canvasY, expanded"
trays: "++id, enclosureId, number"
splices: "++id, trayId, fiberA, fiberB, fiberAColor, fiberBColor"
ports: "++id, enclosureId, portNumber, status, customerName"
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

### Completed (Phase 1 & 2)
- [x] Canvas-centric layout
- [x] Position persistence (canvasX/canvasY)
- [x] Expandable nodes (Closure shows trays/splices, NAP shows ports)
- [x] FiberEdge with gradient colors and glow effects
- [x] Floating component palette (drag-to-create)
- [x] Connection validation (hierarchy rules)
- [x] NodeToolbar with quick actions (Add, Edit, Delete, Location, Duplicate)
- [x] Splice panel for fiber connections

### Pending (Phase 2 continued)
- [ ] Full undo/redo system (`useUndoRedo` hook exists but not integrated)
- [ ] Keyboard shortcuts (Delete, Ctrl+Z, etc.)
- [ ] GPS location picker integration
- [ ] Full edit dialog for node properties
- [ ] Customer nodes as visual elements

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

## AI Development Environment

### Available Subagents

NetLink has custom Claude Code agents in `.claude/agents/`. Use them for specialized tasks:

| Agent | When to Use | Invoke With |
|-------|-------------|-------------|
| `react-flow-specialist` | Canvas work, nodes, edges, callbacks | "Use the react-flow-specialist to..." |
| `dexie-database-specialist` | DB schema, migrations, CRUD, hooks | "Use the dexie-database-specialist to..." |
| `ftth-domain-expert` | Fiber standards, hierarchy, splices | "Use the ftth-domain-expert to..." |
| `netlink-reviewer` | Code review, pattern violations | "Use the netlink-reviewer to..." |
| `test-architect` | Testing strategy, Jest, Playwright | "Use the test-architect to..." |

### Example Agent Invocations

```
# Creating new node types
"Use the react-flow-specialist to create a new Cabinet node type"

# Database changes
"Use the dexie-database-specialist to add a new table for work orders"

# Validate fiber design
"Use the ftth-domain-expert to verify this network hierarchy is correct"

# Code review
"Use the netlink-reviewer to check TopologyCanvas.tsx for pattern violations"

# Testing
"Use the test-architect to create tests for the fiber color utilities"
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
