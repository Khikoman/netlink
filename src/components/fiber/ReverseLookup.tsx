"use client";

import { useState } from "react";
import {
  CABLE_CONFIGS,
  FIBER_COLORS,
  TUBE_COLORS,
  getFiberNumber,
  FiberColor,
} from "@/lib/fiberColors";

export default function ReverseLookup() {
  const [cableCount, setCableCount] = useState(144);
  const [selectedTube, setSelectedTube] = useState<number | null>(null);
  const [selectedFiber, setSelectedFiber] = useState<number | null>(null);
  const [result, setResult] = useState<number | null>(null);

  const config = CABLE_CONFIGS.find((c) => c.count === cableCount);
  const tubeCount = config?.tubes || 12;

  const handleTubeSelect = (tubeNum: number) => {
    setSelectedTube(tubeNum);
    setSelectedFiber(null);
    setResult(null);
  };

  const handleFiberSelect = (fiberPos: number) => {
    setSelectedFiber(fiberPos);
    if (selectedTube) {
      const fiberNum = getFiberNumber(selectedTube, fiberPos, cableCount);
      setResult(fiberNum);
    }
  };

  const getTubeColor = (tubeNum: number): FiberColor => {
    return TUBE_COLORS[(tubeNum - 1) % 12];
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-4">
        Color → Fiber Number
      </h2>

      <div className="space-y-4">
        {/* Cable Count Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Cable Count
          </label>
          <div className="flex flex-wrap gap-2">
            {CABLE_CONFIGS.map((cfg) => (
              <button
                key={cfg.count}
                onClick={() => {
                  setCableCount(cfg.count);
                  setSelectedTube(null);
                  setSelectedFiber(null);
                  setResult(null);
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  cableCount === cfg.count
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {cfg.count}F
              </button>
            ))}
          </div>
        </div>

        {/* Tube Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Step 1: Select Buffer Tube ({tubeCount} tubes)
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {Array.from({ length: tubeCount }, (_, i) => i + 1).map(
              (tubeNum) => {
                const tubeColor = getTubeColor(tubeNum);
                const isSelected = selectedTube === tubeNum;
                return (
                  <button
                    key={tubeNum}
                    onClick={() => handleTubeSelect(tubeNum)}
                    className={`relative p-2 rounded-lg transition-all ${
                      isSelected ? "ring-2 ring-blue-500 ring-offset-2" : ""
                    }`}
                    style={{ backgroundColor: tubeColor.hex }}
                  >
                    <span
                      className="font-medium text-sm"
                      style={{ color: tubeColor.textColor }}
                    >
                      T{tubeNum}
                    </span>
                    {tubeCount > 12 && (
                      <span
                        className="block text-xs opacity-75"
                        style={{ color: tubeColor.textColor }}
                      >
                        {tubeColor.name}
                      </span>
                    )}
                  </button>
                );
              }
            )}
          </div>
        </div>

        {/* Fiber Selection */}
        {selectedTube && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Step 2: Select Fiber Color (in Tube {selectedTube} -{" "}
              {getTubeColor(selectedTube).name})
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {FIBER_COLORS.map((color, index) => {
                const fiberPos = index + 1;
                const isSelected = selectedFiber === fiberPos;
                return (
                  <button
                    key={color.name}
                    onClick={() => handleFiberSelect(fiberPos)}
                    className={`p-3 rounded-lg transition-all ${
                      isSelected ? "ring-2 ring-blue-500 ring-offset-2" : ""
                    }`}
                    style={{ backgroundColor: color.hex }}
                  >
                    <span
                      className="font-medium"
                      style={{ color: color.textColor }}
                    >
                      {color.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Result Display */}
        {result && selectedTube && selectedFiber && (
          <div className="mt-6 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl">
            <div className="text-center">
              <div className="text-sm text-gray-500 mb-2">Fiber Number</div>
              <div className="text-6xl font-bold text-blue-600 mb-4">
                {result}
              </div>
              <div className="flex items-center justify-center gap-3">
                <div
                  className="px-4 py-2 rounded-lg font-medium"
                  style={{
                    backgroundColor: getTubeColor(selectedTube).hex,
                    color: getTubeColor(selectedTube).textColor,
                  }}
                >
                  Tube {selectedTube} ({getTubeColor(selectedTube).name})
                </div>
                <span className="text-gray-400">+</span>
                <div
                  className="px-4 py-2 rounded-lg font-medium"
                  style={{
                    backgroundColor: FIBER_COLORS[selectedFiber - 1].hex,
                    color: FIBER_COLORS[selectedFiber - 1].textColor,
                  }}
                >
                  {FIBER_COLORS[selectedFiber - 1].name}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
