import { getFiberInfo, type FiberLookupResult } from "./fiberColors";
import type { Splice, SpliceType, SpliceComplianceResult } from "@/types";

// ============================================
// SPLICE LOSS THRESHOLDS (TIA-568)
// ============================================

export const SPLICE_LOSS_THRESHOLDS = {
  fusion: {
    good: 0.1, // dB - excellent
    acceptable: 0.15, // dB - typical
    max: 0.3, // dB - maximum allowed
  },
  mechanical: {
    good: 0.2, // dB - excellent
    acceptable: 0.3, // dB - typical
    max: 0.5, // dB - maximum allowed
  },
};

// ============================================
// SPLICE VALIDATION
// ============================================

export function validateSpliceLoss(
  loss: number | undefined,
  type: SpliceType
): { status: "good" | "acceptable" | "high" | "failed" | "missing"; message: string } {
  if (loss === undefined || loss === null) {
    return { status: "missing", message: "No loss measurement recorded" };
  }

  const thresholds = SPLICE_LOSS_THRESHOLDS[type];

  if (loss <= thresholds.good) {
    return { status: "good", message: `Excellent (${loss.toFixed(2)} dB)` };
  }
  if (loss <= thresholds.acceptable) {
    return { status: "acceptable", message: `Acceptable (${loss.toFixed(2)} dB)` };
  }
  if (loss <= thresholds.max) {
    return { status: "high", message: `High but within spec (${loss.toFixed(2)} dB)` };
  }
  return { status: "failed", message: `Exceeds maximum (${loss.toFixed(2)} dB > ${thresholds.max} dB)` };
}

export function getSpliceComplianceStatus(splice: Splice): SpliceComplianceResult {
  const issues: string[] = [];
  let hasFail = false;
  let hasWarn = false;

  // Check loss
  const lossResult = validateSpliceLoss(splice.loss, splice.spliceType);
  if (lossResult.status === "failed") {
    issues.push(`Loss exceeds maximum: ${splice.loss?.toFixed(2)} dB`);
    hasFail = true;
  } else if (lossResult.status === "high") {
    issues.push(`Loss is high: ${splice.loss?.toFixed(2)} dB`);
    hasWarn = true;
  } else if (lossResult.status === "missing") {
    issues.push("No loss measurement recorded");
    hasWarn = true;
  }

  // Check OTDR trace
  if (!splice.otdrTraceId) {
    issues.push("No OTDR trace attached");
    hasWarn = true;
  }

  // Check technician sign-off
  if (!splice.technicianName || splice.technicianName.trim() === "") {
    issues.push("No technician sign-off");
    hasWarn = true;
  }

  // Check status
  if (splice.status === "needs-review") {
    issues.push("Marked for review");
    hasWarn = true;
  } else if (splice.status === "failed") {
    issues.push("Splice marked as failed");
    hasFail = true;
  }

  // Determine final status
  const status: "pass" | "warn" | "fail" = hasFail ? "fail" : hasWarn ? "warn" : "pass";

  return {
    status,
    issues,
    lossStatus: lossResult.status === "missing" ? undefined : lossResult.status,
  };
}

// ============================================
// SPLICE COLOR HELPERS
// ============================================

export function getSpliceColorInfo(
  fiberNumber: number,
  cableCount: number
): FiberLookupResult | null {
  return getFiberInfo(fiberNumber, cableCount);
}

export function formatFiberColor(fiber: FiberLookupResult): string {
  return `${fiber.tubeColor.name}/${fiber.fiberColor.name}`;
}

// ============================================
// BATCH SPLICE GENERATION
// ============================================

export interface BatchSpliceInput {
  trayId: number;
  cableAId: number;
  cableAName: string;
  cableACount: number;
  cableBId: number;
  cableBName: string;
  cableBCount: number;
  startFiberA: number;
  startFiberB: number;
  count: number;
  spliceType: SpliceType;
  technicianName: string;
}

export function generateBatchSplices(input: BatchSpliceInput): Omit<Splice, "id">[] {
  const splices: Omit<Splice, "id">[] = [];

  for (let i = 0; i < input.count; i++) {
    const fiberA = input.startFiberA + i;
    const fiberB = input.startFiberB + i;

    // Skip if fiber numbers exceed cable counts
    if (fiberA > input.cableACount || fiberB > input.cableBCount) {
      continue;
    }

    const colorInfoA = getSpliceColorInfo(fiberA, input.cableACount);
    const colorInfoB = getSpliceColorInfo(fiberB, input.cableBCount);

    if (!colorInfoA || !colorInfoB) {
      continue;
    }

    splices.push({
      trayId: input.trayId,
      cableAId: input.cableAId,
      cableAName: input.cableAName,
      fiberA,
      tubeAColor: colorInfoA.tubeColor.name,
      fiberAColor: colorInfoA.fiberColor.name,
      cableBId: input.cableBId,
      cableBName: input.cableBName,
      fiberB,
      tubeBColor: colorInfoB.tubeColor.name,
      fiberBColor: colorInfoB.fiberColor.name,
      spliceType: input.spliceType,
      technicianName: input.technicianName,
      timestamp: new Date(),
      status: "pending",
    });
  }

  return splices;
}

// ============================================
// SPLICE MATRIX HELPERS
// ============================================

export interface SpliceMatrixCell {
  fiberA: number;
  fiberB: number;
  splice?: Splice;
  colorInfoA: FiberLookupResult;
  colorInfoB: FiberLookupResult;
}

export function generateSpliceMatrix(
  cableACount: number,
  cableBCount: number,
  existingSplices: Splice[]
): SpliceMatrixCell[][] {
  const matrix: SpliceMatrixCell[][] = [];

  // Create a map for quick splice lookup
  const spliceMap = new Map<string, Splice>();
  existingSplices.forEach((splice) => {
    const key = `${splice.fiberA}-${splice.fiberB}`;
    spliceMap.set(key, splice);
  });

  for (let fiberA = 1; fiberA <= cableACount; fiberA++) {
    const row: SpliceMatrixCell[] = [];
    const colorInfoA = getSpliceColorInfo(fiberA, cableACount);

    if (!colorInfoA) continue;

    for (let fiberB = 1; fiberB <= cableBCount; fiberB++) {
      const colorInfoB = getSpliceColorInfo(fiberB, cableBCount);

      if (!colorInfoB) continue;

      const key = `${fiberA}-${fiberB}`;
      const splice = spliceMap.get(key);

      row.push({
        fiberA,
        fiberB,
        splice,
        colorInfoA,
        colorInfoB,
      });
    }

    matrix.push(row);
  }

  return matrix;
}

// ============================================
// SPLICE STATISTICS
// ============================================

export interface SpliceStats {
  total: number;
  completed: number;
  pending: number;
  needsReview: number;
  failed: number;
  withLoss: number;
  avgLoss: number;
  maxLoss: number;
  minLoss: number;
  passRate: number;
}

export function calculateSpliceStats(splices: Splice[]): SpliceStats {
  const total = splices.length;
  const completed = splices.filter((s) => s.status === "completed").length;
  const pending = splices.filter((s) => s.status === "pending").length;
  const needsReview = splices.filter((s) => s.status === "needs-review").length;
  const failed = splices.filter((s) => s.status === "failed").length;

  const splicesWithLoss = splices.filter((s) => s.loss !== undefined && s.loss !== null);
  const withLoss = splicesWithLoss.length;

  let avgLoss = 0;
  let maxLoss = 0;
  let minLoss = Infinity;

  if (withLoss > 0) {
    const losses = splicesWithLoss.map((s) => s.loss!);
    avgLoss = losses.reduce((a, b) => a + b, 0) / withLoss;
    maxLoss = Math.max(...losses);
    minLoss = Math.min(...losses);
  }

  // Calculate pass rate based on compliance
  const passCount = splices.filter((s) => {
    const compliance = getSpliceComplianceStatus(s);
    return compliance.status === "pass";
  }).length;

  const passRate = total > 0 ? (passCount / total) * 100 : 0;

  return {
    total,
    completed,
    pending,
    needsReview,
    failed,
    withLoss,
    avgLoss,
    maxLoss,
    minLoss: minLoss === Infinity ? 0 : minLoss,
    passRate,
  };
}

// ============================================
// LOSS STATUS COLORS
// ============================================

export function getLossStatusColor(
  status: "good" | "acceptable" | "high" | "failed" | "missing" | undefined
): { bg: string; text: string } {
  switch (status) {
    case "good":
      return { bg: "bg-green-100", text: "text-green-700" };
    case "acceptable":
      return { bg: "bg-blue-100", text: "text-blue-700" };
    case "high":
      return { bg: "bg-yellow-100", text: "text-yellow-700" };
    case "failed":
      return { bg: "bg-red-100", text: "text-red-700" };
    case "missing":
    default:
      return { bg: "bg-gray-100", text: "text-gray-500" };
  }
}

export function getComplianceStatusColor(
  status: "pass" | "warn" | "fail"
): { bg: string; text: string; border: string } {
  switch (status) {
    case "pass":
      return { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" };
    case "warn":
      return { bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200" };
    case "fail":
      return { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" };
  }
}
