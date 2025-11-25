// Simplified SOR File Parser
// Note: Full SOR parsing requires handling the Telcordia SR-4731 binary format
// This is a simplified version that handles common SOR file structures

import type { OtdrTraceData, OtdrEvent } from "@/types";

export interface SorFileInfo {
  filename: string;
  fileSize: number;
  isValid: boolean;
  errorMessage?: string;
}

// Check if file appears to be a valid SOR file
export function validateSorFile(file: File): SorFileInfo {
  const info: SorFileInfo = {
    filename: file.name,
    fileSize: file.size,
    isValid: false,
  };

  // Check file extension
  if (!file.name.toLowerCase().endsWith(".sor")) {
    info.errorMessage = "File must have .sor extension";
    return info;
  }

  // Check file size (SOR files are typically 10KB - 10MB)
  if (file.size < 1000) {
    info.errorMessage = "File is too small to be a valid SOR file";
    return info;
  }

  if (file.size > 50 * 1024 * 1024) {
    info.errorMessage = "File is too large (max 50MB)";
    return info;
  }

  info.isValid = true;
  return info;
}

// Parse SOR file header to get basic info
// Note: This is a simplified parser - real SOR files have complex binary structure
export async function parseSorHeader(file: File): Promise<{
  manufacturer?: string;
  model?: string;
  wavelength?: number;
  range?: number;
  pulseWidth?: number;
} | null> {
  try {
    const buffer = await file.arrayBuffer();
    const view = new DataView(buffer);

    // SOR files start with "Map" block identifier
    // Check for common OTDR manufacturer signatures
    const header = new Uint8Array(buffer.slice(0, 100));
    const headerStr = String.fromCharCode(...header);

    // Try to extract wavelength from common locations
    // Different manufacturers put data in different locations
    let wavelength: number | undefined;
    let range: number | undefined;

    // Common wavelengths to look for in the file
    const wavelengths = [850, 1300, 1310, 1550, 1625];

    // This is a simplified approach - real parsing would use the SOR block structure
    for (let i = 0; i < Math.min(buffer.byteLength - 2, 1000); i++) {
      const value = view.getUint16(i, true);
      if (wavelengths.includes(value)) {
        wavelength = value;
        break;
      }
    }

    return {
      wavelength,
      range,
    };
  } catch (error) {
    console.error("Error parsing SOR header:", error);
    return null;
  }
}

// Generate demo trace data for visualization testing
export function generateDemoTraceData(
  length: number = 5000, // meters
  events: number = 3
): OtdrTraceData {
  const distances: number[] = [];
  const powers: number[] = [];
  const eventList: OtdrEvent[] = [];

  // Generate points every 10 meters
  const resolution = 10; // meters
  const points = Math.floor(length / resolution);
  const attenuation = 0.35 / 1000; // dB per meter (typical SM fiber)

  let currentPower = 0; // Start at 0 dB (reference)

  // Add connector at start
  eventList.push({
    distance: 0,
    loss: 0.5,
    reflectance: -45,
    type: "connector",
    notes: "Launch connector",
  });
  currentPower -= 0.5;

  // Generate random splice locations
  const spliceLocations: number[] = [];
  for (let i = 0; i < events - 1; i++) {
    const location = Math.floor((length * (i + 1)) / events) + Math.floor(Math.random() * 200 - 100);
    spliceLocations.push(Math.max(100, Math.min(length - 100, location)));
  }
  spliceLocations.sort((a, b) => a - b);

  // Generate trace data
  for (let i = 0; i < points; i++) {
    const distance = i * resolution;
    distances.push(distance);

    // Apply fiber attenuation
    currentPower -= attenuation * resolution;

    // Add noise
    const noise = (Math.random() - 0.5) * 0.1;
    powers.push(currentPower + noise);

    // Check for splice events
    for (const spliceDistance of spliceLocations) {
      if (Math.abs(distance - spliceDistance) < resolution) {
        const spliceLoss = 0.05 + Math.random() * 0.15; // 0.05 - 0.2 dB
        currentPower -= spliceLoss;
        eventList.push({
          distance: spliceDistance,
          loss: spliceLoss,
          type: "splice",
          notes: `Fusion splice at ${spliceDistance}m`,
        });
      }
    }
  }

  // Add end event
  eventList.push({
    distance: length,
    loss: 0,
    reflectance: -14,
    type: "end",
    notes: "End of fiber",
  });

  return {
    distances,
    powers,
    events: eventList,
    metadata: {
      wavelength: 1310,
      pulseWidth: 100,
      range: length,
      resolution,
      refractiveIndex: 1.4677,
      manufacturer: "Demo",
      model: "NetLink Demo OTDR",
    },
  };
}

// Extract events from trace data using simple peak detection
export function detectEvents(
  distances: number[],
  powers: number[],
  threshold: number = 0.1
): OtdrEvent[] {
  const events: OtdrEvent[] = [];

  for (let i = 1; i < powers.length - 1; i++) {
    const prevDiff = powers[i] - powers[i - 1];
    const nextDiff = powers[i + 1] - powers[i];

    // Detect sudden drops (splices/connectors)
    if (prevDiff < -threshold && Math.abs(nextDiff) < threshold) {
      events.push({
        distance: distances[i],
        loss: Math.abs(prevDiff),
        type: Math.abs(prevDiff) > 0.3 ? "connector" : "splice",
      });
    }

    // Detect reflective events (sharp spike then drop)
    if (prevDiff > 0.5 && nextDiff < -0.5) {
      events.push({
        distance: distances[i],
        loss: 0,
        reflectance: prevDiff * 10, // Approximate
        type: "connector",
      });
    }
  }

  return events;
}

// Calculate two-point loss
export function calculateTwoPointLoss(
  distances: number[],
  powers: number[],
  startDistance: number,
  endDistance: number
): { loss: number; startPower: number; endPower: number } | null {
  // Find indices closest to start and end distances
  let startIdx = 0;
  let endIdx = distances.length - 1;

  for (let i = 0; i < distances.length; i++) {
    if (distances[i] >= startDistance && startIdx === 0) {
      startIdx = i;
    }
    if (distances[i] >= endDistance) {
      endIdx = i;
      break;
    }
  }

  if (startIdx >= endIdx) return null;

  const startPower = powers[startIdx];
  const endPower = powers[endIdx];
  const loss = startPower - endPower;

  return {
    loss: Math.round(loss * 100) / 100,
    startPower: Math.round(startPower * 100) / 100,
    endPower: Math.round(endPower * 100) / 100,
  };
}
