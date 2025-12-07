---
description: Generate tests for a NetLink component or function
---

Create comprehensive tests for: $ARGUMENTS

## Test file location:

Based on the target:
- Utility function → `__tests__/unit/lib/[name].test.ts`
- Database operation → `__tests__/unit/db/[name].test.ts`
- React hook → `__tests__/hooks/[name].test.ts`
- Component → `__tests__/components/[path]/[name].test.tsx`
- Integration → `__tests__/integration/[name].test.tsx`
- E2E → `e2e/[name].spec.ts`

## Test templates:

### Unit test (utility function)

```typescript
import { functionName } from '@/lib/moduleName';

describe('functionName', () => {
  it('handles normal input', () => {
    const result = functionName(input);
    expect(result).toBe(expected);
  });

  it('handles edge case', () => {
    const result = functionName(edgeInput);
    expect(result).toBe(edgeExpected);
  });

  it('throws on invalid input', () => {
    expect(() => functionName(invalidInput)).toThrow();
  });
});
```

### Database test

```typescript
import 'fake-indexeddb/auto';
import { db, addItem, getItem, deleteItem } from '@/lib/db';

describe('Item CRUD', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    await db.delete();
  });

  it('creates and retrieves item', async () => {
    const id = await addItem({ name: 'Test' });
    const item = await getItem(id);
    expect(item?.name).toBe('Test');
  });

  it('cascades delete to children', async () => {
    const parentId = await addParent({ name: 'Parent' });
    await addChild({ parentId, name: 'Child' });

    await deleteParent(parentId);

    const children = await db.children.where('parentId').equals(parentId).toArray();
    expect(children).toHaveLength(0);
  });
});
```

### Component test

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { ReactFlowProvider } from 'reactflow';
import { ComponentName } from '@/components/path/ComponentName';

function renderWithProviders(component: React.ReactElement) {
  return render(
    <ReactFlowProvider>
      {component}
    </ReactFlowProvider>
  );
}

describe('ComponentName', () => {
  const mockProps = {
    id: 'test-1',
    data: {
      label: 'Test',
      onEdit: jest.fn(),
      onDelete: jest.fn(),
    },
    selected: false,
  };

  it('renders correctly', () => {
    renderWithProviders(<ComponentName {...mockProps} />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('calls callback on action', () => {
    renderWithProviders(<ComponentName {...mockProps} selected />);
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(mockProps.data.onEdit).toHaveBeenCalled();
  });
});
```

### React hook test

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { useItems } from '@/lib/db/hooks';
import { db, addItem } from '@/lib/db';

describe('useItems', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    await db.delete();
  });

  it('returns empty array when no items', async () => {
    const { result } = renderHook(() => useItems(1));
    await waitFor(() => {
      expect(result.current).toEqual([]);
    });
  });

  it('returns items for project', async () => {
    await addItem({ projectId: 1, name: 'Test' });

    const { result } = renderHook(() => useItems(1));
    await waitFor(() => {
      expect(result.current).toHaveLength(1);
      expect(result.current[0].name).toBe('Test');
    });
  });
});
```

## Test categories to cover:

1. **Happy path** - Normal expected usage
2. **Edge cases** - Boundary conditions, empty inputs
3. **Error handling** - Invalid inputs, failure scenarios
4. **Integration** - Components working together
5. **Regression** - Specific bugs that were fixed

## For NetLink specifically:

- Test fiber color lookup with various positions
- Test database cascade deletes
- Test callback injection pattern works
- Test node expansion state persistence
- Test connection validation (hierarchy rules)
