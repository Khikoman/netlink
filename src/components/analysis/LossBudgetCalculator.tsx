"use client";

import { useState } from "react";
import {
  calculateLossBudget,
  WAVELENGTH_OPTIONS,
  CONNECTOR_TYPES,
  CONNECTOR_LOSS,
  FIBER_ATTENUATION,
  SPLICE_LOSS,
  POWER_BUDGETS,
  checkPowerBudget,
  type PowerBudgetType,
  type LossBudgetBreakdown,
} from "@/lib/lossConstants";
import { saveLossBudget } from "@/lib/db";
import { useLossBudgets } from "@/lib/db/hooks";
import type { FiberType, Wavelength, ConnectorType } from "@/types";

export default function LossBudgetCalculator() {
  // Input state
  const [name, setName] = useState("");
  const [fiberType, setFiberType] = useState<FiberType>("singlemode");
  const [wavelength, setWavelength] = useState<Wavelength>(1310);
  const [distanceKm, setDistanceKm] = useState("1");
  const [fusionSplices, setFusionSplices] = useState("2");
  const [mechanicalSplices, setMechanicalSplices] = useState("0");
  const [connectorPairs, setConnectorPairs] = useState("2");
  const [connectorType, setConnectorType] = useState<ConnectorType>("LC");
  const [useMaxValues, setUseMaxValues] = useState(false);
  const [marginDb, setMarginDb] = useState("1");

  // Power budget check
  const [selectedPowerBudget, setSelectedPowerBudget] = useState<PowerBudgetType | "">("gpon_classBplus");

  // View state
  const [showSaved, setShowSaved] = useState(false);

  // Get saved budgets
  const savedBudgets = useLossBudgets();

  // Calculate result
  const result: LossBudgetBreakdown = calculateLossBudget({
    fiberType,
    wavelength,
    distanceKm: parseFloat(distanceKm) || 0,
    fusionSplices: parseInt(fusionSplices) || 0,
    mechanicalSplices: parseInt(mechanicalSplices) || 0,
    connectorPairs: parseInt(connectorPairs) || 0,
    connectorType,
    useMaxValues,
    marginDb: parseFloat(marginDb) || 0,
  });

  // Power budget check
  const powerCheck = selectedPowerBudget
    ? checkPowerBudget(result.totalLoss, selectedPowerBudget)
    : null;

  // Handle fiber type change
  const handleFiberTypeChange = (type: FiberType) => {
    setFiberType(type);
    // Set default wavelength for this fiber type
    setWavelength(WAVELENGTH_OPTIONS[type][0]);
  };

  // Save budget
  const handleSave = async () => {
    if (!name.trim()) {
      alert("Please enter a name for this budget");
      return;
    }

    await saveLossBudget({
      input: {
        name,
        fiberType,
        wavelength,
        distanceKm: parseFloat(distanceKm) || 0,
        fusionSplices: parseInt(fusionSplices) || 0,
        mechanicalSplices: parseInt(mechanicalSplices) || 0,
        connectorPairs: parseInt(connectorPairs) || 0,
        connectorType,
        marginDb: parseFloat(marginDb) || 0,
      },
      fiberLoss: result.fiberLoss,
      fusionLoss: result.fusionSpliceLoss,
      mechanicalLoss: result.mechanicalSpliceLoss,
      connectorLoss: result.connectorLoss,
      marginLoss: result.marginLoss,
      totalLoss: result.totalLoss,
    });

    setName("");
    alert("Budget saved!");
  };

  return (
    <div className="space-y-6">
      {/* Calculator Card */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-800">Loss Budget Calculator</h2>
          <button
            onClick={() => setShowSaved(!showSaved)}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            {showSaved ? "Hide Saved" : "View Saved"}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Section */}
          <div className="space-y-4">
            {/* Fiber Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Fiber Type</label>
              <div className="flex gap-2">
                <button
                  onClick={() => handleFiberTypeChange("singlemode")}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                    fiberType === "singlemode"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Singlemode
                </button>
                <button
                  onClick={() => handleFiberTypeChange("multimode")}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                    fiberType === "multimode"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Multimode
                </button>
              </div>
            </div>

            {/* Wavelength */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Wavelength</label>
              <div className="flex gap-2">
                {WAVELENGTH_OPTIONS[fiberType].map((wl) => (
                  <button
                    key={wl}
                    onClick={() => setWavelength(wl)}
                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                      wavelength === wl
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {wl} nm
                  </button>
                ))}
              </div>
            </div>

            {/* Distance */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Distance (km)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={distanceKm}
                onChange={(e) => setDistanceKm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-800"
              />
              <div className="text-xs text-gray-500 mt-1">
                Attenuation: {FIBER_ATTENUATION[fiberType][wavelength]} dB/km
              </div>
            </div>

            {/* Splices */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fusion Splices
                </label>
                <input
                  type="number"
                  min="0"
                  value={fusionSplices}
                  onChange={(e) => setFusionSplices(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-800"
                />
                <div className="text-xs text-gray-500 mt-1">
                  {useMaxValues ? SPLICE_LOSS.fusion.max : SPLICE_LOSS.fusion.typical} dB each
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mechanical Splices
                </label>
                <input
                  type="number"
                  min="0"
                  value={mechanicalSplices}
                  onChange={(e) => setMechanicalSplices(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-800"
                />
                <div className="text-xs text-gray-500 mt-1">
                  {useMaxValues ? SPLICE_LOSS.mechanical.max : SPLICE_LOSS.mechanical.typical} dB
                  each
                </div>
              </div>
            </div>

            {/* Connectors */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Connector Pairs
                </label>
                <input
                  type="number"
                  min="0"
                  value={connectorPairs}
                  onChange={(e) => setConnectorPairs(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-800"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Connector Type
                </label>
                <select
                  value={connectorType}
                  onChange={(e) =>
                    setConnectorType(e.target.value as ConnectorType)
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-800"
                >
                  {CONNECTOR_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type} ({useMaxValues ? CONNECTOR_LOSS[type].max : CONNECTOR_LOSS[type].typical} dB)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Margin */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Safety Margin (dB)
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={marginDb}
                onChange={(e) => setMarginDb(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-800"
              />
            </div>

            {/* Use Max Values Toggle */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="useMax"
                checked={useMaxValues}
                onChange={(e) => setUseMaxValues(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300"
              />
              <label htmlFor="useMax" className="text-sm text-gray-700">
                Use maximum (worst-case) values instead of typical
              </label>
            </div>
          </div>

          {/* Results Section */}
          <div className="space-y-4">
            {/* Loss Breakdown */}
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="font-semibold text-gray-800 mb-4">Loss Breakdown</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Fiber Loss</span>
                  <span className="font-medium text-gray-800">{result.fiberLoss.toFixed(2)} dB</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Fusion Splice Loss</span>
                  <span className="font-medium text-gray-800">
                    {result.fusionSpliceLoss.toFixed(2)} dB
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Mechanical Splice Loss</span>
                  <span className="font-medium text-gray-800">
                    {result.mechanicalSpliceLoss.toFixed(2)} dB
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Connector Loss</span>
                  <span className="font-medium text-gray-800">
                    {result.connectorLoss.toFixed(2)} dB
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Safety Margin</span>
                  <span className="font-medium text-gray-800">{result.marginLoss.toFixed(2)} dB</span>
                </div>
                <div className="border-t pt-3 flex justify-between items-center">
                  <span className="font-semibold text-gray-800">Total Loss</span>
                  <span className="text-2xl font-bold text-blue-600">
                    {result.totalLoss.toFixed(2)} dB
                  </span>
                </div>
              </div>
            </div>

            {/* Power Budget Check */}
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="font-semibold text-gray-800 mb-4">Power Budget Check</h3>
              <select
                value={selectedPowerBudget}
                onChange={(e) => setSelectedPowerBudget(e.target.value as PowerBudgetType | "")}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-800 mb-4"
              >
                <option value="">Select equipment type...</option>
                <optgroup label="GPON">
                  <option value="gpon_classB">GPON Class B (28 dB)</option>
                  <option value="gpon_classBplus">GPON Class B+ (28 dB)</option>
                  <option value="gpon_classC">GPON Class C (30 dB)</option>
                  <option value="gpon_classCplus">GPON Class C+ (32 dB)</option>
                </optgroup>
                <optgroup label="XGS-PON">
                  <option value="xgspon_n1">XGS-PON N1 (29 dB)</option>
                  <option value="xgspon_n2">XGS-PON N2 (31 dB)</option>
                </optgroup>
                <optgroup label="Gigabit Ethernet">
                  <option value="gigabit_sx">1000BASE-SX (7.5 dB)</option>
                  <option value="gigabit_lx">1000BASE-LX (11 dB)</option>
                  <option value="gigabit_zx">1000BASE-ZX (23 dB)</option>
                </optgroup>
                <optgroup label="10 Gigabit Ethernet">
                  <option value="ten_gig_sr">10GBASE-SR (6.5 dB)</option>
                  <option value="ten_gig_lr">10GBASE-LR (9.4 dB)</option>
                  <option value="ten_gig_er">10GBASE-ER (15.6 dB)</option>
                </optgroup>
              </select>

              {powerCheck && (
                <div
                  className={`p-4 rounded-lg ${
                    powerCheck.pass ? "bg-green-100" : "bg-red-100"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {powerCheck.pass ? (
                      <svg
                        className="w-6 h-6 text-green-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-6 h-6 text-red-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    )}
                    <span
                      className={`font-semibold ${
                        powerCheck.pass ? "text-green-700" : "text-red-700"
                      }`}
                    >
                      {powerCheck.pass ? "PASS" : "FAIL"}
                    </span>
                  </div>
                  <div className={powerCheck.pass ? "text-green-700" : "text-red-700"}>
                    <div>Equipment Budget: {powerCheck.budgetDb} dB</div>
                    <div>Your Loss: {result.totalLoss.toFixed(2)} dB</div>
                    <div>
                      Remaining Margin: {powerCheck.margin.toFixed(2)} dB
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Save Section */}
            <div className="flex gap-3">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Budget name..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-800"
              />
              <button
                onClick={handleSave}
                className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Saved Budgets */}
      {showSaved && savedBudgets && savedBudgets.length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Saved Budgets</h3>
          <div className="space-y-3">
            {savedBudgets.map((budget) => (
              <div
                key={budget.id}
                className="p-4 bg-gray-50 rounded-xl flex justify-between items-center"
              >
                <div>
                  <div className="font-medium text-gray-800">{budget.input.name}</div>
                  <div className="text-sm text-gray-500">
                    {budget.input.fiberType} @ {budget.input.wavelength}nm |{" "}
                    {budget.input.distanceKm}km | {budget.totalLoss.toFixed(2)} dB total
                  </div>
                </div>
                <div className="text-xl font-bold text-blue-600">
                  {budget.totalLoss.toFixed(2)} dB
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reference Card */}
      <div className="bg-blue-50 rounded-2xl p-6">
        <h3 className="font-semibold text-blue-900 mb-4">TIA-568 Reference Values</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <h4 className="font-medium text-blue-800 mb-2">Fiber Attenuation</h4>
            <ul className="space-y-1 text-blue-700">
              <li>SM 1310nm: 0.5 dB/km</li>
              <li>SM 1550nm: 0.4 dB/km</li>
              <li>MM 850nm: 3.5 dB/km</li>
              <li>MM 1300nm: 1.5 dB/km</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-blue-800 mb-2">Splice Loss</h4>
            <ul className="space-y-1 text-blue-700">
              <li>Fusion: 0.1 dB typical</li>
              <li>Fusion: 0.3 dB max</li>
              <li>Mechanical: 0.3 dB typical</li>
              <li>Mechanical: 0.5 dB max</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-blue-800 mb-2">Connector Loss</h4>
            <ul className="space-y-1 text-blue-700">
              <li>LC/SC/FC: 0.5 dB max</li>
              <li>MPO/MTP: 0.75 dB max</li>
              <li>Reference grade: 0.2 dB</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
