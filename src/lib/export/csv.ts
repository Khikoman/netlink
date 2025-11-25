// CSV Export Utilities

export function arrayToCSV<T extends object>(
  data: T[],
  columns?: { key: keyof T; header: string }[]
): string {
  if (data.length === 0) return "";

  // Get headers
  const headers = columns
    ? columns.map((col) => col.header)
    : Object.keys(data[0]);

  // Get keys
  const keys = columns ? columns.map((col) => col.key) : (Object.keys(data[0]) as (keyof T)[]);

  // Build CSV content
  const csvRows: string[] = [];

  // Add header row
  csvRows.push(headers.map(escapeCSVValue).join(","));

  // Add data rows
  for (const row of data) {
    const values = keys.map((key) => {
      const value = row[key];
      return escapeCSVValue(formatValue(value));
    });
    csvRows.push(values.join(","));
  }

  return csvRows.join("\n");
}

function escapeCSVValue(value: string): string {
  // If value contains comma, quote, or newline, wrap in quotes and escape quotes
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Export specific data types

import type { Splice, InventoryItem, LossBudgetResult } from "@/types";

export function exportSplicesToCSV(splices: Splice[]): void {
  const columns: { key: keyof Splice; header: string }[] = [
    { key: "id", header: "ID" },
    { key: "cableAName", header: "Cable A" },
    { key: "fiberA", header: "Fiber A" },
    { key: "tubeAColor", header: "Tube A Color" },
    { key: "fiberAColor", header: "Fiber A Color" },
    { key: "cableBName", header: "Cable B" },
    { key: "fiberB", header: "Fiber B" },
    { key: "tubeBColor", header: "Tube B Color" },
    { key: "fiberBColor", header: "Fiber B Color" },
    { key: "spliceType", header: "Splice Type" },
    { key: "loss", header: "Loss (dB)" },
    { key: "technicianName", header: "Technician" },
    { key: "timestamp", header: "Date" },
    { key: "status", header: "Status" },
    { key: "notes", header: "Notes" },
  ];

  const csv = arrayToCSV(splices, columns);
  downloadCSV(csv, `splices_${new Date().toISOString().split("T")[0]}.csv`);
}

export function exportInventoryToCSV(items: InventoryItem[]): void {
  const columns: { key: keyof InventoryItem; header: string }[] = [
    { key: "id", header: "ID" },
    { key: "category", header: "Category" },
    { key: "name", header: "Name" },
    { key: "partNumber", header: "Part Number" },
    { key: "manufacturer", header: "Manufacturer" },
    { key: "quantity", header: "Quantity" },
    { key: "unit", header: "Unit" },
    { key: "minStock", header: "Min Stock" },
    { key: "unitCost", header: "Unit Cost" },
    { key: "location", header: "Location" },
    { key: "notes", header: "Notes" },
  ];

  const csv = arrayToCSV(items, columns);
  downloadCSV(csv, `inventory_${new Date().toISOString().split("T")[0]}.csv`);
}

export function exportLossBudgetsToCSV(budgets: LossBudgetResult[]): void {
  // Flatten the nested structure
  const flatData = budgets.map((budget) => ({
    id: budget.id,
    name: budget.input.name,
    fiberType: budget.input.fiberType,
    wavelength: budget.input.wavelength,
    distanceKm: budget.input.distanceKm,
    fusionSplices: budget.input.fusionSplices,
    mechanicalSplices: budget.input.mechanicalSplices,
    connectorPairs: budget.input.connectorPairs,
    connectorType: budget.input.connectorType,
    marginDb: budget.input.marginDb,
    fiberLoss: budget.fiberLoss,
    fusionLoss: budget.fusionLoss,
    mechanicalLoss: budget.mechanicalLoss,
    connectorLoss: budget.connectorLoss,
    totalLoss: budget.totalLoss,
    createdAt: budget.createdAt,
  }));

  const columns = [
    { key: "id" as const, header: "ID" },
    { key: "name" as const, header: "Name" },
    { key: "fiberType" as const, header: "Fiber Type" },
    { key: "wavelength" as const, header: "Wavelength (nm)" },
    { key: "distanceKm" as const, header: "Distance (km)" },
    { key: "fusionSplices" as const, header: "Fusion Splices" },
    { key: "mechanicalSplices" as const, header: "Mechanical Splices" },
    { key: "connectorPairs" as const, header: "Connector Pairs" },
    { key: "connectorType" as const, header: "Connector Type" },
    { key: "marginDb" as const, header: "Margin (dB)" },
    { key: "fiberLoss" as const, header: "Fiber Loss (dB)" },
    { key: "fusionLoss" as const, header: "Fusion Loss (dB)" },
    { key: "mechanicalLoss" as const, header: "Mechanical Loss (dB)" },
    { key: "connectorLoss" as const, header: "Connector Loss (dB)" },
    { key: "totalLoss" as const, header: "Total Loss (dB)" },
    { key: "createdAt" as const, header: "Created At" },
  ];

  const csv = arrayToCSV(flatData, columns);
  downloadCSV(csv, `loss_budgets_${new Date().toISOString().split("T")[0]}.csv`);
}
