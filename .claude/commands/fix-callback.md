---
description: Debug and fix a callback not working in a React Flow component
---

Fix the callback issue in the NetLink topology canvas.

**Problem:** $ARGUMENTS

## Diagnostic steps:

### 1. Check if callback is being read from `data` prop

```typescript
// WRONG - Context doesn't work in React Flow nodes
function MyNode({ data }) {
  const { onEdit } = useNodeActions(); // Gets default no-ops!
}

// CORRECT - Read from data prop
function MyNode({ data }) {
  const { onEdit } = data;
}
```

### 2. Check if callback is injected in TopologyCanvas.tsx

Look for `filteredNodes` useMemo:

```typescript
const filteredNodes = useMemo(() => {
  return nodes.map(node => ({
    ...node,
    data: {
      ...node.data,
      onEdit: handleNodeEdit,  // Is the callback here?
      // ... other callbacks
    }
  }));
}, [nodes, handleNodeEdit, /* all handlers */]);
```

### 3. Check if handler is wrapped in useCallback

```typescript
// WRONG - unstable reference
const handleNodeEdit = (nodeId, nodeType) => { /* ... */ };

// CORRECT - stable reference
const handleNodeEdit = useCallback((nodeId: string, nodeType: string) => {
  // ...
}, [/* dependencies */]);
```

### 4. Check if handler is in useMemo dependencies

```typescript
const filteredNodes = useMemo(() => {
  // ...
}, [nodes, handleNodeEdit]); // Is the handler in this array?
```

### 5. Check if optional chaining is used

```typescript
// WRONG - will throw if undefined
onClick={() => onEdit(id)}

// CORRECT - safe call
onClick={() => onEdit?.(id)}
```

### 6. Check for edges too

For edge callbacks, check `edgesWithCallbacks` useMemo:

```typescript
const edgesWithCallbacks = useMemo(() => {
  return edges.map(edge => ({
    ...edge,
    data: {
      ...edge.data,
      onOpenSpliceEditor: handleOpenSpliceEditor,
    }
  }));
}, [edges, handleOpenSpliceEditor]);
```

## Common fixes:

1. Move callback from context to data prop injection
2. Add missing handler to filteredNodes/edgesWithCallbacks useMemo
3. Add missing handler to useMemo dependency array
4. Wrap handler in useCallback
5. Add optional chaining to callback invocation
