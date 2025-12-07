---
description: Review topology canvas code for NetLink-specific pattern violations
---

Review the NetLink topology canvas implementation for common issues and pattern violations.

## Review checklist:

### 1. TopologyCanvas.tsx

**Callback injection pattern:**
- [ ] All node handlers are in `filteredNodes` useMemo data injection
- [ ] All edge handlers are in `edgesWithCallbacks` useMemo data injection
- [ ] All handlers are wrapped in `useCallback`
- [ ] All handlers are in their respective useMemo dependency arrays

**Key handlers to verify:**
- `handleNodeAddChild`
- `handleNodeEdit`
- `handleNodeDelete`
- `handleNodeDuplicate`
- `handleNodeLocation`
- `handleOpenSpliceEditor` (for edges)

**Position persistence:**
- [ ] `onNodeDragStop` calls `updateNodePosition()`
- [ ] Node data includes `dbId` and `nodeType`

### 2. ExpandableNodes.tsx

**Callback usage:**
- [ ] Callbacks are read from `data` prop, NOT from context
- [ ] Optional chaining used on all callback invocations: `onEdit?.()`
- [ ] No imports of `useNodeActions` or similar context hooks

**Component patterns:**
- [ ] Handle styles use `handleBaseStyle` and `handleColors`
- [ ] All node types registered in `expandableNodeTypes`
- [ ] NodeToolbar has proper `isVisible={selected}` binding

### 3. FiberEdge.tsx

**Edge callbacks:**
- [ ] `onOpenSpliceEditor` read from `data?.onOpenSpliceEditor`
- [ ] Optional chaining used
- [ ] SVG gradients have unique IDs (use edge id)

### 4. FloatingPalette.tsx

**Drag and drop:**
- [ ] All node types have drag buttons
- [ ] `onDragStart` sets correct data transfer

### 5. Database operations

**CRUD patterns:**
- [ ] Uses hooks from `src/lib/db/hooks.ts` for reads
- [ ] Cascading deletes properly implemented
- [ ] Error handling present

## Files to check:

```
src/components/topology/TopologyCanvas.tsx
src/components/topology/nodes/ExpandableNodes.tsx
src/components/topology/edges/FiberEdge.tsx
src/components/topology/FloatingPalette.tsx
src/components/topology/FloatingSplicePanel.tsx
```

## Report any violations found with:
- File path and line number
- Current code
- What it should be
- Why it's a problem
