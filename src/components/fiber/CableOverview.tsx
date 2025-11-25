"use client";

import { useState } from "react";
import {
  CABLE_CONFIGS,
  FIBER_COLORS,
  getTubeInfo,
  getFibersInTube,
} from "@/lib/fiberColors";

export default function CableOverview() {
  const [cableCount, setCableCount] = useState(144);
  const [expandedTube, setExpandedTube] = useState<number | null>(null);

  const tubes = getTubeInfo(cableCount);

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-4">
        Cable Overview
      </h2>

      <div className="space-y-4">
        {/* Cable Count Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Cable Count
          </label>
          <div className="flex flex-wrap gap-2">
            {CABLE_CONFIGS.map((config) => (
              <button
                key={config.count}
                onClick={() => {
                  setCableCount(config.count);
                  setExpandedTube(null);
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  cableCount === config.count
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {config.count}F
              </button>
            ))}
          </div>
        </div>

        {/* Cable Summary */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-gray-800">
                {cableCount}
              </div>
              <div className="text-sm text-gray-500">Total Fibers</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-800">
                {tubes.length}
              </div>
              <div className="text-sm text-gray-500">Buffer Tubes</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-800">12</div>
              <div className="text-sm text-gray-500">Fibers/Tube</div>
            </div>
          </div>
        </div>

        {/* Tubes Grid */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Click a tube to expand
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {tubes.map((tube) => (
              <div key={tube.tubeNumber}>
                <button
                  onClick={() =>
                    setExpandedTube(
                      expandedTube === tube.tubeNumber ? null : tube.tubeNumber
                    )
                  }
                  className={`w-full p-4 rounded-xl transition-all ${
                    expandedTube === tube.tubeNumber
                      ? "ring-2 ring-blue-500"
                      : ""
                  }`}
                  style={{ backgroundColor: tube.tubeColor.hex }}
                >
                  <div
                    className="flex justify-between items-center"
                    style={{ color: tube.tubeColor.textColor }}
                  >
                    <div>
                      <div className="font-semibold">
                        Tube {tube.tubeNumber}
                        {tube.tubeGroup && tube.tubeGroup > 1 && (
                          <span className="ml-2 text-xs opacity-75">
                            (Group {tube.tubeGroup})
                          </span>
                        )}
                      </div>
                      <div className="text-sm opacity-75">
                        {tube.tubeColor.name}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm">
                        F{tube.startFiber}-{tube.endFiber}
                      </div>
                    </div>
                  </div>
                </button>

                {/* Expanded Fiber List */}
                {expandedTube === tube.tubeNumber && (
                  <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                    <div className="grid grid-cols-4 gap-2">
                      {getFibersInTube(tube.tubeNumber, cableCount).map(
                        (fiber) => (
                          <div
                            key={fiber.fiberNumber}
                            className="p-2 rounded-lg text-center text-sm"
                            style={{
                              backgroundColor: fiber.fiberColor.hex,
                              color: fiber.fiberColor.textColor,
                            }}
                          >
                            <div className="font-bold">#{fiber.fiberNumber}</div>
                            <div className="text-xs opacity-75">
                              {fiber.fiberColor.name}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
