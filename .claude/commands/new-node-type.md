---
description: Create a new React Flow node type for NetLink topology canvas
---

Create a new node type called "$ARGUMENTS" for the NetLink topology canvas.

## Steps to implement:

1. **Add type to TypeScript definitions** (`src/types/index.ts`)
   - Add to EnclosureType union if it's an enclosure type
   - Or create new interface if it's a different node category

2. **Create node component** (`src/components/topology/nodes/ExpandableNodes.tsx`)
   - Follow BasicNode pattern for simple nodes
   - Follow ExpandableClosureNode pattern if it needs inline expansion
   - Ensure callbacks are read from `data` prop, NOT context
   - Use optional chaining: `onEdit?.(id, data.type)`

3. **Register in node types registry**
   ```typescript
   export const expandableNodeTypes = {
     // ... existing types
     newType: NewTypeNode,
   };
   ```

4. **Add styling** (in ExpandableNodes.tsx)
   - Add entry to `nodeStyles` for background/border colors
   - Add entry to `handleColors` for connection handle colors

5. **Update hierarchy rules** (`src/components/topology/TopologyCanvas.tsx`)
   - Update `getAllowedChildTypes()` to define what this node can parent
   - Update parent nodes' allowed children if needed

6. **Add to FloatingPalette** (`src/components/topology/FloatingPalette.tsx`)
   - Add drag-and-drop button for creating this node type

7. **Update database if needed** (`src/lib/db/index.ts`)
   - If new enclosure type: just use existing enclosures table
   - If new node category: may need schema migration

## Critical reminders:
- NEVER use React Context in the node component
- Always inject callbacks via the `data` prop in TopologyCanvas.tsx
- Use optional chaining on all callback invocations
- Add the node to the `filteredNodes` useMemo in TopologyCanvas.tsx
