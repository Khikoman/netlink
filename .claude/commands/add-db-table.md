---
description: Add a new table to the Dexie database with proper migrations
---

Add a new Dexie database table: $ARGUMENTS

## Steps to implement:

### 1. Add TypeScript interface (`src/types/index.ts`)

```typescript
export interface NewTable {
  id?: number;
  projectId: number;
  name: string;
  // ... other fields
  createdAt?: Date;
}
```

### 2. Add table declaration (`src/lib/db/index.ts`)

In the `NetLinkDB` class:

```typescript
class NetLinkDB extends Dexie {
  // ... existing tables
  newTable!: Table<NewTable, number>;

  constructor() {
    super("netlink-db");
    // schema versions...
  }
}
```

### 3. Add schema migration

**CRITICAL: Copy ALL existing stores and increment version:**

```typescript
this.version(7).stores({
  // Copy ALL existing stores from version 6
  projects: "++id, name, status, createdAt",
  olts: "++id, projectId, name, canvasX, canvasY",
  odfs: "++id, projectId, oltId, name, canvasX, canvasY",
  enclosures: "++id, projectId, type, parentType, parentId, canvasX, canvasY, expanded",
  trays: "++id, enclosureId, number",
  splices: "++id, trayId, position, fiberA, fiberB, fiberAColor, fiberBColor, cableAId, cableBId, status, lossDb, method",
  ports: "++id, enclosureId, splitterId, portNumber, status, customerName, customerAddress, ontSerialNumber, signalStrength, lastReading",
  cables: "++id, projectId, name, type, fiberCount, sourceType, sourceId, targetType, targetId",
  splitters: "++id, enclosureId, ratio, inputPort, manufacturer, model",
  otdrTraces: "++id, spliceId, testDate, wavelength, distance, loss, reflectance, eventType",
  inventory: "++id, projectId, category, itemName, partNumber, quantity, unit, minStock, location, supplier, unitCost, lastUpdated",
  lossBudgets: "++id, projectId, [sourceType+sourceId], [targetType+targetId]",
  mapNodes: "++id, projectId, refType, refId, lat, lng, address",
  mapRoutes: "++id, projectId, name, cableId",
  customerAttachments: "++id, portId, type, name, data, createdAt",
  // NEW TABLE
  newTable: "++id, projectId, name, createdAt",
});
```

### 4. Create CRUD functions

```typescript
// Create
export async function addNewTable(data: Omit<NewTable, "id">) {
  return db.newTable.add({ ...data, createdAt: new Date() });
}

// Read
export async function getNewTable(id: number) {
  return db.newTable.get(id);
}

export async function getNewTablesByProject(projectId: number) {
  return db.newTable.where("projectId").equals(projectId).toArray();
}

// Update
export async function updateNewTable(id: number, updates: Partial<NewTable>) {
  return db.newTable.update(id, updates);
}

// Delete
export async function deleteNewTable(id: number) {
  return db.newTable.delete(id);
}
```

### 5. Create React hook (`src/lib/db/hooks.ts`)

```typescript
export function useNewTable(projectId: number | undefined) {
  return useLiveQuery(
    () => (projectId
      ? db.newTable.where("projectId").equals(projectId).toArray()
      : []),
    [projectId]
  );
}
```

### 6. Handle cascading deletes if needed

If this table has children or parents, update the cascade logic.

## Index syntax reference:

| Syntax | Meaning |
|--------|---------|
| `++id` | Auto-increment primary key |
| `field` | Indexed field |
| `[a+b]` | Compound index |
| `*tags` | Multi-entry index (array) |
| `&email` | Unique index |
