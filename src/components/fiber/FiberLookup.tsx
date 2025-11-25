"use client";

import { useState } from "react";
import {
  CABLE_CONFIGS,
  getFiberInfo,
  FiberLookupResult,
} from "@/lib/fiberColors";

export default function FiberLookup() {
  const [cableCount, setCableCount] = useState(144);
  const [fiberNumber, setFiberNumber] = useState("");
  const [result, setResult] = useState<FiberLookupResult | null>(null);
  const [error, setError] = useState("");

  const handleLookup = () => {
    setError("");
    setResult(null);

    const num = parseInt(fiberNumber);
    if (isNaN(num) || num < 1) {
      setError("Please enter a valid fiber number");
      return;
    }

    if (num > cableCount) {
      setError(`Fiber number must be between 1 and ${cableCount}`);
      return;
    }

    const info = getFiberInfo(num, cableCount);
    if (info) {
      setResult(info);
    } else {
      setError("Could not find fiber information");
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-4">
        Fiber Number → Color
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
                  setResult(null);
                  setError("");
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

        {/* Fiber Number Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Fiber Number (1-{cableCount})
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              min="1"
              max={cableCount}
              value={fiberNumber}
              onChange={(e) => setFiberNumber(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLookup()}
              placeholder="Enter fiber number"
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg text-gray-800"
            />
            <button
              onClick={handleLookup}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Find
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Result Display */}
        {result && (
          <div className="mt-6 p-6 bg-gray-50 rounded-xl">
            <div className="text-center mb-4">
              <span className="text-4xl font-bold text-gray-800">
                Fiber #{result.fiberNumber}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Tube Info */}
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="text-sm text-gray-500 mb-2">Buffer Tube</div>
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-full shadow-inner border-2 border-gray-200"
                    style={{ backgroundColor: result.tubeColor.hex }}
                  />
                  <div>
                    <div className="font-semibold text-gray-800">
                      Tube {result.tubeNumber}
                    </div>
                    <div className="text-sm text-gray-600">
                      {result.tubeColor.name}
                    </div>
                  </div>
                </div>
              </div>

              {/* Fiber Info */}
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="text-sm text-gray-500 mb-2">Fiber Strand</div>
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-full shadow-inner border-2 border-gray-200"
                    style={{ backgroundColor: result.fiberColor.hex }}
                  />
                  <div>
                    <div className="font-semibold text-gray-800">
                      Position {result.fiberPosition}
                    </div>
                    <div className="text-sm text-gray-600">
                      {result.fiberColor.name}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Combined Display */}
            <div className="mt-4 p-4 bg-white rounded-xl shadow-sm">
              <div className="text-sm text-gray-500 mb-2 text-center">
                Color Combination
              </div>
              <div className="flex items-center justify-center gap-2">
                <div
                  className="px-4 py-2 rounded-lg font-medium"
                  style={{
                    backgroundColor: result.tubeColor.hex,
                    color: result.tubeColor.textColor,
                  }}
                >
                  {result.tubeColor.name}
                </div>
                <span className="text-gray-400">→</span>
                <div
                  className="px-4 py-2 rounded-lg font-medium"
                  style={{
                    backgroundColor: result.fiberColor.hex,
                    color: result.fiberColor.textColor,
                  }}
                >
                  {result.fiberColor.name}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
