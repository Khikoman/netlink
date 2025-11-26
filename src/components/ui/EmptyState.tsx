"use client";

import { type ReactNode } from "react";
import {
  FolderOpen,
  Package,
  Cable,
  Map,
  FileText,
  Database,
  type LucideIcon,
} from "lucide-react";
import { Button } from "./Button";

interface EmptyStateProps {
  icon?: ReactNode | LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon: IconProp,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  // Handle both ReactNode and LucideIcon
  const IconComponent = IconProp as LucideIcon;
  const iconElement =
    typeof IconProp === "function" ? (
      <IconComponent className="h-12 w-12 text-gray-300" />
    ) : (
      IconProp || <FolderOpen className="h-12 w-12 text-gray-300" />
    );

  return (
    <div
      className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}
    >
      <div className="mb-4">{iconElement}</div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      {description && (
        <p className="text-gray-500 max-w-sm mb-6">{description}</p>
      )}
      {action && (
        <Button onClick={action.onClick} variant="primary">
          {action.label}
        </Button>
      )}
    </div>
  );
}

// Preset empty states for common scenarios
export function NoProjectsEmpty({ onAction }: { onAction?: () => void }) {
  return (
    <EmptyState
      icon={FolderOpen}
      title="No projects yet"
      description="Create your first project to start documenting your fiber network."
      action={onAction ? { label: "Create Project", onClick: onAction } : undefined}
    />
  );
}

export function NoInventoryEmpty({ onAction }: { onAction?: () => void }) {
  return (
    <EmptyState
      icon={Package}
      title="Inventory is empty"
      description="Add items to track your cable, connectors, and equipment stock."
      action={onAction ? { label: "Add Item", onClick: onAction } : undefined}
    />
  );
}

export function NoCablesEmpty({ onAction }: { onAction?: () => void }) {
  return (
    <EmptyState
      icon={Cable}
      title="No cables defined"
      description="Add cables to your project to start creating splice documentation."
      action={onAction ? { label: "Add Cable", onClick: onAction } : undefined}
    />
  );
}

export function NoEnclosuresEmpty({ onAction }: { onAction?: () => void }) {
  return (
    <EmptyState
      icon={Database}
      title="No enclosures yet"
      description="Add enclosures like splice closures, handholes, or pedestals to your project."
      action={onAction ? { label: "Add Enclosure", onClick: onAction } : undefined}
    />
  );
}

export function NoMapDataEmpty({ onAction }: { onAction?: () => void }) {
  return (
    <EmptyState
      icon={Map}
      title="Network map is empty"
      description="Add nodes and routes to visualize your fiber network layout."
      action={onAction ? { label: "Add Node", onClick: onAction } : undefined}
    />
  );
}

export function NoSavedBudgetsEmpty({ onAction }: { onAction?: () => void }) {
  return (
    <EmptyState
      icon={FileText}
      title="No saved calculations"
      description="Calculate and save loss budgets to reference them later."
      action={onAction ? { label: "Calculate Now", onClick: onAction } : undefined}
    />
  );
}
