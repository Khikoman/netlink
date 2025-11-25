"use client";

import { FIBER_COLORS } from "@/lib/fiberColors";

export default function ColorReference() {
  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-4">
        TIA-598 Color Reference
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {FIBER_COLORS.map((color, index) => (
          <div
            key={color.name}
            className="flex items-center gap-3 p-3 rounded-lg bg-gray-50"
          >
            <div className="flex items-center justify-center w-10 h-10">
              <div
                className="w-8 h-8 rounded-full shadow-inner border-2 border-gray-200"
                style={{ backgroundColor: color.hex }}
              />
            </div>
            <div>
              <div className="font-semibold text-gray-800">{index + 1}</div>
              <div className="text-sm text-gray-600">{color.name}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-medium text-blue-900 mb-2">Quick Reference</h3>
        <p className="text-sm text-blue-800">
          The TIA-598 standard defines a 12-color sequence for fiber optic
          cables. This sequence is used for both buffer tubes and individual
          fiber strands within each tube. For cables with more than 12 tubes,
          the color sequence repeats.
        </p>
      </div>
    </div>
  );
}
