# NetLink Implementation Plan

**Created by:** NetLink Architect Agent
**Date:** 2025-12-10
**Status:** Active

## Current State Analysis

### Build Status: PASSING
- TypeScript compilation: OK
- Next.js build: OK
- Static pages generated: OK

### Code Quality Issues

| Category | Count | Severity |
|----------|-------|----------|
| ESLint Errors | 15 | HIGH |
| ESLint Warnings | 99 | MEDIUM |
| Build Errors | 0 | - |

### Critical Issues (P0 - Fix Immediately)

| File | Issue | Root Cause |
|------|-------|------------|
| `SpliceMatrix.tsx` | setState in useEffect | Anti-pattern causing cascading renders |
| `SpliceMatrixPanel.tsx` | setState in useEffect | Same anti-pattern |
| `FiberPathPanel.tsx` | Explicit `any` type | Type safety issue |
| `TopologyCanvas.tsx` | setState in useEffect | Same anti-pattern |
| `FloatingSplicePanel.tsx` | setState in useEffect | Same anti-pattern |

### Medium Issues (P1 - Fix Soon)

| Category | Count | Files Affected |
|----------|-------|----------------|
| Unused imports/variables | 99 | Multiple |
| Unescaped entities | 2 | Dashboard components |
| Missing alt text | 1 | PortConnectionModal |

---

## Phase 1: Critical Bug Fixes (P0)

### Task 1.1: Fix setState in useEffect Anti-patterns

**Problem:** Multiple components call `setState` directly inside `useEffect`, causing cascading renders.

**Affected Files:**
1. `src/components/splice/SpliceMatrix.tsx` (lines 67, 76, 81)
2. `src/components/topology/SpliceMatrixPanel.tsx` (line 254)
3. `src/components/topology/FiberPathPanel.tsx` (line 143)
4. `src/components/topology/TopologyCanvas.tsx` (lines 63, 282)
5. `src/components/topology/FloatingSplicePanel.tsx` (line 63)

**Solution Pattern:**
```typescript
// WRONG: setState in useEffect body
useEffect(() => {
  setPosition(JSON.parse(saved)); // BAD
}, []);

// CORRECT: Initialize state with lazy initializer
const [position, setPosition] = useState(() => {
  const saved = localStorage.getItem("key");
  return saved ? JSON.parse(saved) : defaultValue;
});
```

| Task | Agent | Priority | Complexity |
|------|-------|----------|------------|
| Fix SpliceMatrix.tsx setState issues | react-flow-specialist | P0 | Simple |
| Fix SpliceMatrixPanel.tsx setState | react-flow-specialist | P0 | Simple |
| Fix FiberPathPanel.tsx setState | react-flow-specialist | P0 | Simple |
| Fix TopologyCanvas.tsx setState | react-flow-specialist | P0 | Simple |
| Fix FloatingSplicePanel.tsx setState | react-flow-specialist | P0 | Simple |

### Task 1.2: Fix Type Safety Issues

| Task | Agent | Priority | Complexity |
|------|-------|----------|------------|
| Replace `any` type in FiberPathPanel | react-flow-specialist | P0 | Simple |
| Fix variable declaration order in SpliceMatrixPanel | react-flow-specialist | P0 | Simple |

---

## Phase 2: Code Cleanup (P1)

### Task 2.1: Remove Unused Imports and Variables

**Strategy:** Run ESLint with `--fix` flag for auto-fixable issues, then manually review remainder.

| Task | Agent | Priority | Complexity |
|------|-------|----------|------------|
| Run ESLint auto-fix | netlink-reviewer | P1 | Simple |
| Review and clean remaining warnings | netlink-reviewer | P1 | Medium |

### Task 2.2: Fix Accessibility Issues

| Task | Agent | Priority | Complexity |
|------|-------|----------|------------|
| Add alt text to images | react-flow-specialist | P1 | Simple |
| Fix unescaped entities | react-flow-specialist | P1 | Simple |

---

## Phase 3: Feature Completion (P2)

Based on the OPERATIONS_ROADMAP.md and SPLICE_MATRIX_IMPROVEMENT_PLAN.md:

### 3.1 Splice Matrix Improvements

| Task | Agent | Priority | Complexity |
|------|-------|----------|------------|
| Validate current splice matrix works end-to-end | test-architect | P2 | Medium |
| Add splice loss tracking and totals | dexie-database-specialist | P2 | Medium |
| Improve tube-level visualization | react-flow-specialist | P2 | Complex |

### 3.2 Operations Foundation (Phase 1 from Roadmap)

| Task | Agent | Priority | Complexity |
|------|-------|----------|------------|
| Design customer management schema | dexie-database-specialist | P2 | Medium |
| Create customer list component | react-flow-specialist | P2 | Medium |
| Add customer to NAP port workflow | ftth-operations-manager | P2 | Medium |

---

## Phase 4: Testing & Documentation (P3)

| Task | Agent | Priority | Complexity |
|------|-------|----------|------------|
| Create unit tests for fiberColors.ts | test-architect | P3 | Simple |
| Create unit tests for useFiberPathTracing | test-architect | P3 | Medium |
| Add E2E test for splice workflow | test-architect | P3 | Complex |
| Update README with setup instructions | report-generator | P3 | Simple |

---

## Agent Delegation Summary

| Agent | Total Tasks | P0 | P1 | P2 | P3 |
|-------|-------------|----|----|----|----|
| react-flow-specialist | 9 | 6 | 2 | 1 | 0 |
| netlink-reviewer | 2 | 0 | 2 | 0 | 0 |
| dexie-database-specialist | 2 | 0 | 0 | 2 | 0 |
| test-architect | 4 | 0 | 0 | 1 | 3 |
| ftth-operations-manager | 1 | 0 | 0 | 1 | 0 |
| report-generator | 1 | 0 | 0 | 0 | 1 |

---

## Execution Order

### Immediate (Today)
1. Fix all P0 setState anti-patterns
2. Fix type safety issues
3. Run ESLint --fix for auto-fixes

### This Week
1. Review and clean remaining warnings
2. Fix accessibility issues
3. Validate splice matrix end-to-end

### Next Sprint
1. Begin operations foundation work
2. Add test coverage
3. Update documentation

---

## Success Criteria

### Phase 1 Complete When:
- [ ] `npm run lint` shows 0 errors
- [ ] All setState-in-effect anti-patterns resolved
- [ ] Build passes with no warnings

### Phase 2 Complete When:
- [ ] ESLint warnings reduced to < 20
- [ ] All accessibility issues fixed
- [ ] Code review shows no critical patterns

### Phase 3 Complete When:
- [ ] Splice matrix works end-to-end with real data
- [ ] Customer can be added to NAP port
- [ ] Fiber path tracing shows customer at endpoint

### Phase 4 Complete When:
- [ ] Test coverage > 60%
- [ ] E2E tests pass for core workflows
- [ ] Documentation complete and accurate

---

## Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| setState fixes break existing functionality | High | Medium | Run full manual test after each fix |
| Type changes cause cascade of updates | Medium | Low | Use gradual typing, start with `unknown` |
| Operations features scope creep | High | High | Stick to Phase 1 roadmap items only |

---

## Next Steps

1. **Architect** assigns Phase 1 tasks to react-flow-specialist
2. **react-flow-specialist** fixes all P0 issues
3. **netlink-reviewer** validates fixes and runs ESLint
4. **Architect** reviews and approves for commit
5. Deploy and verify in production

---

*This plan will be updated as tasks are completed. Use `git log` to track implementation progress.*
