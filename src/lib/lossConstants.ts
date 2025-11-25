// TIA-568 Standard Loss Values for Fiber Optic Systems

import type { FiberType, Wavelength } from "@/types";

// ============================================
// FIBER ATTENUATION (dB/km)
// ============================================

export const FIBER_ATTENUATION: Record<FiberType, Record<Wavelength, number>> = {
  singlemode: {
    850: 0, // Not used for singlemode
    1300: 0, // Not used for singlemode
    1310: 0.5, // dB/km - TIA-568 OSP max
    1550: 0.4, // dB/km - TIA-568 OSP max
  },
  multimode: {
    850: 3.5, // dB/km - OM3/OM4 max
    1300: 1.5, // dB/km - OM3/OM4 max
    1310: 0, // Not typically used
    1550: 0, // Not typically used
  },
};

// Typical values (for reference/comparison)
export const FIBER_ATTENUATION_TYPICAL: Record<FiberType, Record<Wavelength, number>> = {
  singlemode: {
    850: 0,
    1300: 0,
    1310: 0.35, // dB/km typical
    1550: 0.25, // dB/km typical
  },
  multimode: {
    850: 2.5, // dB/km typical
    1300: 0.8, // dB/km typical
    1310: 0,
    1550: 0,
  },
};

// ============================================
// SPLICE LOSS (dB per splice)
// ============================================

export const SPLICE_LOSS = {
  fusion: {
    typical: 0.1, // dB - well-made fusion splice
    max: 0.3, // dB - TIA-568 maximum
  },
  mechanical: {
    typical: 0.3, // dB - typical mechanical splice
    max: 0.5, // dB - maximum acceptable
  },
};

// ============================================
// CONNECTOR LOSS (dB per mated pair)
// ============================================

export const CONNECTOR_LOSS: Record<string, { typical: number; max: number }> = {
  LC: {
    typical: 0.2, // dB - reference grade
    max: 0.5, // dB - TIA-568 max
  },
  SC: {
    typical: 0.25,
    max: 0.5,
  },
  FC: {
    typical: 0.25,
    max: 0.5,
  },
  ST: {
    typical: 0.3,
    max: 0.5,
  },
  MPO: {
    typical: 0.35, // dB per fiber
    max: 0.75,
  },
  MTP: {
    typical: 0.35,
    max: 0.75,
  },
};

// ============================================
// ADDITIONAL LOSSES
// ============================================

export const ADDITIONAL_LOSSES = {
  // Bend loss (dB) - typically added as safety margin
  macrobend: 0.1, // Per significant bend
  // Patch panel loss
  patchPanel: 0.3, // Per panel (2 connector pairs)
  // WDM/splitter insertion loss
  wdm_1x2: 3.5, // 1x2 splitter
  wdm_1x4: 7.0, // 1x4 splitter
  wdm_1x8: 10.5, // 1x8 splitter
  wdm_1x16: 14.0, // 1x16 splitter
  wdm_1x32: 17.5, // 1x32 splitter
};

// ============================================
// LOSS BUDGET CALCULATION
// ============================================

export interface LossBudgetParams {
  fiberType: FiberType;
  wavelength: Wavelength;
  distanceKm: number;
  fusionSplices: number;
  mechanicalSplices: number;
  connectorPairs: number;
  connectorType: keyof typeof CONNECTOR_LOSS;
  useMaxValues?: boolean; // Use max instead of typical
  marginDb?: number; // Safety margin
}

export interface LossBudgetBreakdown {
  fiberLoss: number;
  fusionSpliceLoss: number;
  mechanicalSpliceLoss: number;
  connectorLoss: number;
  marginLoss: number;
  totalLoss: number;
  details: {
    fiberAttenuation: number;
    spliceValue: { fusion: number; mechanical: number };
    connectorValue: number;
  };
}

export function calculateLossBudget(params: LossBudgetParams): LossBudgetBreakdown {
  const {
    fiberType,
    wavelength,
    distanceKm,
    fusionSplices,
    mechanicalSplices,
    connectorPairs,
    connectorType,
    useMaxValues = false,
    marginDb = 0,
  } = params;

  // Get attenuation value
  const fiberAttenuation = FIBER_ATTENUATION[fiberType][wavelength];

  // Get splice values
  const fusionValue = useMaxValues ? SPLICE_LOSS.fusion.max : SPLICE_LOSS.fusion.typical;
  const mechanicalValue = useMaxValues
    ? SPLICE_LOSS.mechanical.max
    : SPLICE_LOSS.mechanical.typical;

  // Get connector value
  const connectorValue = useMaxValues
    ? CONNECTOR_LOSS[connectorType].max
    : CONNECTOR_LOSS[connectorType].typical;

  // Calculate individual losses
  const fiberLoss = distanceKm * fiberAttenuation;
  const fusionSpliceLoss = fusionSplices * fusionValue;
  const mechanicalSpliceLoss = mechanicalSplices * mechanicalValue;
  const connectorLoss = connectorPairs * connectorValue;
  const marginLoss = marginDb;

  // Total
  const totalLoss =
    fiberLoss + fusionSpliceLoss + mechanicalSpliceLoss + connectorLoss + marginLoss;

  return {
    fiberLoss: Math.round(fiberLoss * 100) / 100,
    fusionSpliceLoss: Math.round(fusionSpliceLoss * 100) / 100,
    mechanicalSpliceLoss: Math.round(mechanicalSpliceLoss * 100) / 100,
    connectorLoss: Math.round(connectorLoss * 100) / 100,
    marginLoss: Math.round(marginLoss * 100) / 100,
    totalLoss: Math.round(totalLoss * 100) / 100,
    details: {
      fiberAttenuation,
      spliceValue: { fusion: fusionValue, mechanical: mechanicalValue },
      connectorValue,
    },
  };
}

// ============================================
// WAVELENGTH OPTIONS
// ============================================

export const WAVELENGTH_OPTIONS: Record<FiberType, Wavelength[]> = {
  singlemode: [1310, 1550],
  multimode: [850, 1300],
};

// ============================================
// CONNECTOR TYPE OPTIONS
// ============================================

export const CONNECTOR_TYPES = Object.keys(CONNECTOR_LOSS) as (keyof typeof CONNECTOR_LOSS)[];

// ============================================
// TRANSMITTER/RECEIVER POWER BUDGETS
// Reference values for common equipment
// ============================================

export const POWER_BUDGETS = {
  // GPON
  gpon_classB: 28, // dB
  gpon_classBplus: 28, // dB
  gpon_classC: 30, // dB
  gpon_classCplus: 32, // dB
  // XGS-PON
  xgspon_n1: 29, // dB
  xgspon_n2: 31, // dB
  // Ethernet
  gigabit_sx: 7.5, // dB (850nm, multimode)
  gigabit_lx: 11, // dB (1310nm, singlemode)
  gigabit_zx: 23, // dB (1550nm, singlemode)
  ten_gig_sr: 6.5, // dB (850nm, multimode)
  ten_gig_lr: 9.4, // dB (1310nm, singlemode)
  ten_gig_er: 15.6, // dB (1550nm, singlemode)
};

export type PowerBudgetType = keyof typeof POWER_BUDGETS;

export function checkPowerBudget(
  totalLoss: number,
  powerBudgetType: PowerBudgetType
): { pass: boolean; margin: number; budgetDb: number } {
  const budgetDb = POWER_BUDGETS[powerBudgetType];
  const margin = budgetDb - totalLoss;
  return {
    pass: margin >= 0,
    margin: Math.round(margin * 100) / 100,
    budgetDb,
  };
}
