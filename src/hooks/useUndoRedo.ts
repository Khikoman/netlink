"use client";

import { useState, useCallback, useRef, useEffect } from "react";

// Command interface for undo/redo operations
export interface Command<T> {
  execute: () => Promise<void> | void;
  undo: () => Promise<void> | void;
  description: string;
  data?: T;
}

// State snapshot interface
interface HistoryState<T> {
  state: T;
  timestamp: number;
  description: string;
}

// Hook options
interface UseUndoRedoOptions {
  maxHistorySize?: number;
  debounceMs?: number;
}

/**
 * useUndoRedo - A hook for managing undo/redo functionality
 *
 * Supports two modes:
 * 1. Command pattern - execute/undo with custom logic
 * 2. State snapshots - automatic state change tracking
 */
export function useUndoRedo<T>(
  initialState: T,
  options: UseUndoRedoOptions = {}
) {
  const { maxHistorySize = 50, debounceMs = 300 } = options;

  // Current state
  const [state, setState] = useState<T>(initialState);

  // History stacks
  const [pastStates, setPastStates] = useState<HistoryState<T>[]>([]);
  const [futureStates, setFutureStates] = useState<HistoryState<T>[]>([]);

  // Command history for command pattern mode
  const [commandHistory, setCommandHistory] = useState<Command<T>[]>([]);
  const [commandIndex, setCommandIndex] = useState(-1);

  // Debounce timer
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const lastStateRef = useRef<T>(initialState);

  // Push a new state to history
  const pushState = useCallback(
    (newState: T, description: string = "State change") => {
      // Clear any pending debounce
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      // Debounce state changes to prevent too many history entries
      debounceTimer.current = setTimeout(() => {
        setPastStates((prev) => {
          const newHistory = [
            ...prev,
            {
              state: lastStateRef.current,
              timestamp: Date.now(),
              description,
            },
          ];
          // Limit history size
          if (newHistory.length > maxHistorySize) {
            return newHistory.slice(-maxHistorySize);
          }
          return newHistory;
        });

        // Clear future states when new change is made
        setFutureStates([]);
        lastStateRef.current = newState;
      }, debounceMs);

      setState(newState);
    },
    [maxHistorySize, debounceMs]
  );

  // Undo to previous state
  const undo = useCallback(() => {
    if (pastStates.length === 0) return false;

    const previous = pastStates[pastStates.length - 1];
    const remaining = pastStates.slice(0, -1);

    // Save current state to future
    setFutureStates((prev) => [
      ...prev,
      {
        state,
        timestamp: Date.now(),
        description: "Undo",
      },
    ]);

    setPastStates(remaining);
    setState(previous.state);
    lastStateRef.current = previous.state;

    return true;
  }, [pastStates, state]);

  // Redo to next state
  const redo = useCallback(() => {
    if (futureStates.length === 0) return false;

    const next = futureStates[futureStates.length - 1];
    const remaining = futureStates.slice(0, -1);

    // Save current state to past
    setPastStates((prev) => [
      ...prev,
      {
        state,
        timestamp: Date.now(),
        description: "Redo",
      },
    ]);

    setFutureStates(remaining);
    setState(next.state);
    lastStateRef.current = next.state;

    return true;
  }, [futureStates, state]);

  // Execute a command (command pattern mode)
  const executeCommand = useCallback(
    async (command: Command<T>) => {
      try {
        await command.execute();

        // Truncate any future commands if we're not at the end
        const newHistory = commandHistory.slice(0, commandIndex + 1);
        newHistory.push(command);

        // Limit history size
        if (newHistory.length > maxHistorySize) {
          newHistory.shift();
          setCommandHistory(newHistory);
          setCommandIndex(newHistory.length - 1);
        } else {
          setCommandHistory(newHistory);
          setCommandIndex(newHistory.length - 1);
        }

        return true;
      } catch (error) {
        console.error("Command execution failed:", error);
        return false;
      }
    },
    [commandHistory, commandIndex, maxHistorySize]
  );

  // Undo a command
  const undoCommand = useCallback(async () => {
    if (commandIndex < 0) return false;

    const command = commandHistory[commandIndex];
    try {
      await command.undo();
      setCommandIndex((prev) => prev - 1);
      return true;
    } catch (error) {
      console.error("Command undo failed:", error);
      return false;
    }
  }, [commandHistory, commandIndex]);

  // Redo a command
  const redoCommand = useCallback(async () => {
    if (commandIndex >= commandHistory.length - 1) return false;

    const command = commandHistory[commandIndex + 1];
    try {
      await command.execute();
      setCommandIndex((prev) => prev + 1);
      return true;
    } catch (error) {
      console.error("Command redo failed:", error);
      return false;
    }
  }, [commandHistory, commandIndex]);

  // Clear all history
  const clearHistory = useCallback(() => {
    setPastStates([]);
    setFutureStates([]);
    setCommandHistory([]);
    setCommandIndex(-1);
  }, []);

  // Reset to initial state
  const reset = useCallback(() => {
    setState(initialState);
    lastStateRef.current = initialState;
    clearHistory();
  }, [initialState, clearHistory]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl/Cmd + Z (undo) and Ctrl/Cmd + Y or Ctrl/Cmd + Shift + Z (redo)
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        if (e.key === "z" && !e.shiftKey) {
          e.preventDefault();
          if (commandHistory.length > 0) {
            undoCommand();
          } else {
            undo();
          }
        } else if (e.key === "y" || (e.key === "z" && e.shiftKey)) {
          e.preventDefault();
          if (commandHistory.length > 0) {
            redoCommand();
          } else {
            redo();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo, undoCommand, redoCommand, commandHistory.length]);

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  return {
    // State mode
    state,
    setState: pushState,
    undo,
    redo,
    canUndo: pastStates.length > 0,
    canRedo: futureStates.length > 0,
    historyLength: pastStates.length,
    futureLength: futureStates.length,

    // Command mode
    executeCommand,
    undoCommand,
    redoCommand,
    canUndoCommand: commandIndex >= 0,
    canRedoCommand: commandIndex < commandHistory.length - 1,
    commandHistoryLength: commandHistory.length,
    currentCommandIndex: commandIndex,

    // Utilities
    clearHistory,
    reset,
  };
}

// Helper to create a command
export function createCommand<T>(
  execute: () => Promise<void> | void,
  undo: () => Promise<void> | void,
  description: string,
  data?: T
): Command<T> {
  return { execute, undo, description, data };
}

export default useUndoRedo;
