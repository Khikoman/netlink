// TIA-598 Standard Fiber Color Code
export interface FiberColor {
  name: string;
  hex: string;
  textColor: string; // For contrast
}

export const FIBER_COLORS: FiberColor[] = [
  { name: "Blue", hex: "#0066CC", textColor: "#FFFFFF" },
  { name: "Orange", hex: "#FF6600", textColor: "#FFFFFF" },
  { name: "Green", hex: "#00AA00", textColor: "#FFFFFF" },
  { name: "Brown", hex: "#8B4513", textColor: "#FFFFFF" },
  { name: "Slate", hex: "#708090", textColor: "#FFFFFF" },
  { name: "White", hex: "#FFFFFF", textColor: "#000000" },
  { name: "Red", hex: "#CC0000", textColor: "#FFFFFF" },
  { name: "Black", hex: "#1A1A1A", textColor: "#FFFFFF" },
  { name: "Yellow", hex: "#FFCC00", textColor: "#000000" },
  { name: "Violet", hex: "#8800AA", textColor: "#FFFFFF" },
  { name: "Rose", hex: "#FF69B4", textColor: "#000000" },
  { name: "Aqua", hex: "#00CCCC", textColor: "#000000" },
];

// Buffer tube colors follow the same sequence
export const TUBE_COLORS = FIBER_COLORS;

// Cable configurations - standard industry fiber counts
export const CABLE_CONFIGS = [
  { count: 2, tubes: 1, fibersPerTube: 2 },
  { count: 4, tubes: 1, fibersPerTube: 4 },
  { count: 6, tubes: 1, fibersPerTube: 6 },
  { count: 8, tubes: 1, fibersPerTube: 8 },
  { count: 12, tubes: 1, fibersPerTube: 12 },
  { count: 24, tubes: 2, fibersPerTube: 12 },
  { count: 36, tubes: 3, fibersPerTube: 12 },
  { count: 48, tubes: 4, fibersPerTube: 12 },
  { count: 72, tubes: 6, fibersPerTube: 12 },
  { count: 96, tubes: 8, fibersPerTube: 12 },
  { count: 144, tubes: 12, fibersPerTube: 12 },
  { count: 216, tubes: 18, fibersPerTube: 12 },
  { count: 288, tubes: 24, fibersPerTube: 12 },
  { count: 432, tubes: 36, fibersPerTube: 12 },
  { count: 576, tubes: 48, fibersPerTube: 12 },
  { count: 864, tubes: 72, fibersPerTube: 12 },
];

export interface FiberLookupResult {
  fiberNumber: number;
  tubeNumber: number;
  tubeColor: FiberColor;
  fiberPosition: number; // Position within the tube (1-12)
  fiberColor: FiberColor;
}

// Get fiber info from fiber number
// Works with any fiber count, not just standard cable configs
export function getFiberInfo(fiberNumber: number, cableCount: number): FiberLookupResult | null {
  if (fiberNumber < 1 || fiberNumber > cableCount) return null;

  // Try to find a standard config, otherwise assume 12 fibers per tube
  const config = CABLE_CONFIGS.find(c => c.count === cableCount);
  const fibersPerTube = config?.fibersPerTube || 12;

  const tubeNumber = Math.ceil(fiberNumber / fibersPerTube);
  const fiberPosition = ((fiberNumber - 1) % fibersPerTube) + 1;

  // For cables with more than 12 tubes or fibers, colors repeat
  const tubeColorIndex = (tubeNumber - 1) % 12;
  const fiberColorIndex = (fiberPosition - 1) % 12;

  return {
    fiberNumber,
    tubeNumber,
    tubeColor: TUBE_COLORS[tubeColorIndex],
    fiberPosition,
    fiberColor: FIBER_COLORS[fiberColorIndex],
  };
}

// Get fiber number from tube and fiber position
export function getFiberNumber(
  tubeNumber: number,
  fiberPosition: number,
  cableCount: number
): number | null {
  const config = CABLE_CONFIGS.find(c => c.count === cableCount);
  if (!config) return null;

  if (tubeNumber < 1 || tubeNumber > config.tubes) return null;
  if (fiberPosition < 1 || fiberPosition > config.fibersPerTube) return null;

  return (tubeNumber - 1) * config.fibersPerTube + fiberPosition;
}

// Get all fibers in a specific tube
export function getFibersInTube(tubeNumber: number, cableCount: number): FiberLookupResult[] {
  const config = CABLE_CONFIGS.find(c => c.count === cableCount);
  if (!config) return [];

  if (tubeNumber < 1 || tubeNumber > config.tubes) return [];

  const fibers: FiberLookupResult[] = [];
  for (let i = 1; i <= config.fibersPerTube; i++) {
    const fiberNum = getFiberNumber(tubeNumber, i, cableCount);
    if (fiberNum) {
      const info = getFiberInfo(fiberNum, cableCount);
      if (info) fibers.push(info);
    }
  }
  return fibers;
}

// Get tube info for a cable
export function getTubeInfo(cableCount: number) {
  const config = CABLE_CONFIGS.find(c => c.count === cableCount);
  if (!config) return [];

  const tubes = [];
  for (let i = 1; i <= config.tubes; i++) {
    const tubeColorIndex = (i - 1) % 12;
    const tubeGroup = Math.floor((i - 1) / 12) + 1; // For cables > 144f
    tubes.push({
      tubeNumber: i,
      tubeColor: TUBE_COLORS[tubeColorIndex],
      tubeGroup: config.tubes > 12 ? tubeGroup : undefined,
      startFiber: (i - 1) * config.fibersPerTube + 1,
      endFiber: i * config.fibersPerTube,
    });
  }
  return tubes;
}
