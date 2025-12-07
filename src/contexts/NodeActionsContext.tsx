"use client";

import { createContext, useContext, useCallback, ReactNode } from "react";

// Interface for node action handlers
export interface NodeActions {
  onAddChild: (nodeId: string, nodeType: string) => void;
  onEdit: (nodeId: string, nodeType: string) => void;
  onDelete: (nodeId: string) => void;
  onDuplicate: (nodeId: string, nodeType: string) => void;
  onSetLocation: (nodeId: string, nodeType: string) => void;
  onOpenSpliceEditor: (edgeId: string) => void;
}

// Default no-op handlers
const defaultActions: NodeActions = {
  onAddChild: () => console.warn("onAddChild not implemented"),
  onEdit: () => console.warn("onEdit not implemented"),
  onDelete: () => console.warn("onDelete not implemented"),
  onDuplicate: () => console.warn("onDuplicate not implemented"),
  onSetLocation: () => console.warn("onSetLocation not implemented"),
  onOpenSpliceEditor: () => console.warn("onOpenSpliceEditor not implemented"),
};

// Create context
const NodeActionsContext = createContext<NodeActions>(defaultActions);

// Provider props
interface NodeActionsProviderProps {
  children: ReactNode;
  actions: Partial<NodeActions>;
}

// Provider component
export function NodeActionsProvider({ children, actions }: NodeActionsProviderProps) {
  // Merge provided actions with defaults
  const mergedActions: NodeActions = {
    ...defaultActions,
    ...actions,
  };

  return (
    <NodeActionsContext.Provider value={mergedActions}>
      {children}
    </NodeActionsContext.Provider>
  );
}

// Hook to use node actions
export function useNodeActions(): NodeActions {
  const context = useContext(NodeActionsContext);
  if (!context) {
    throw new Error("useNodeActions must be used within a NodeActionsProvider");
  }
  return context;
}

export default NodeActionsContext;
