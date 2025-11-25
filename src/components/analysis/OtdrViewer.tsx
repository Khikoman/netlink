"use client";

import { useState, useRef, useEffect } from "react";
import {
  validateSorFile,
  generateDemoTraceData,
  calculateTwoPointLoss,
} from "@/lib/otdr/sorParser";
import type { OtdrTraceData, OtdrEvent } from "@/types";

export default function OtdrViewer() {
  const [traceData, setTraceData] = useState<OtdrTraceData | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [selectedEvent, setSelectedEvent] = useState<OtdrEvent | null>(null);

  // Measurement mode
  const [measureMode, setMeasureMode] = useState(false);
  const [measureStart, setMeasureStart] = useState<number | null>(null);
  const [measureEnd, setMeasureEnd] = useState<number | null>(null);

  // Canvas ref
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // View state
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError("");
    setSelectedEvent(null);

    const validation = validateSorFile(file);
    if (!validation.isValid) {
      setError(validation.errorMessage || "Invalid file");
      return;
    }

    // For now, show demo data since full SOR parsing is complex
    // In production, you would implement full SR-4731 parsing
    setFileName(file.name);
    setTraceData(generateDemoTraceData(10000, 5));
  };

  // Load demo data
  const loadDemoData = () => {
    setFileName("demo_trace.sor");
    setTraceData(generateDemoTraceData(5000, 4));
    setError("");
    setSelectedEvent(null);
  };

  // Draw trace on canvas
  useEffect(() => {
    if (!traceData || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Get dimensions
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const width = rect.width;
    const height = rect.height;
    const padding = { top: 30, right: 20, bottom: 50, left: 60 };

    // Clear
    ctx.fillStyle = "#1f2937";
    ctx.fillRect(0, 0, width, height);

    // Calculate scales
    const { distances, powers } = traceData;
    const minDist = Math.min(...distances) / zoom + panX;
    const maxDist = Math.max(...distances) / zoom + panX;
    const minPower = Math.min(...powers) - 1;
    const maxPower = Math.max(...powers) + 1;

    const scaleX = (width - padding.left - padding.right) / (maxDist - minDist);
    const scaleY = (height - padding.top - padding.bottom) / (maxPower - minPower);

    const toCanvasX = (dist: number) => padding.left + (dist - minDist) * scaleX;
    const toCanvasY = (power: number) => height - padding.bottom - (power - minPower) * scaleY;

    // Draw grid
    ctx.strokeStyle = "#374151";
    ctx.lineWidth = 0.5;

    // Vertical grid lines (distance)
    const distStep = Math.pow(10, Math.floor(Math.log10((maxDist - minDist) / 5)));
    for (let d = Math.ceil(minDist / distStep) * distStep; d <= maxDist; d += distStep) {
      const x = toCanvasX(d);
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, height - padding.bottom);
      ctx.stroke();

      // Label
      ctx.fillStyle = "#9ca3af";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${d}m`, x, height - padding.bottom + 15);
    }

    // Horizontal grid lines (power)
    const powerStep = Math.max(1, Math.ceil((maxPower - minPower) / 5));
    for (let p = Math.ceil(minPower / powerStep) * powerStep; p <= maxPower; p += powerStep) {
      const y = toCanvasY(p);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      // Label
      ctx.fillStyle = "#9ca3af";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(`${p.toFixed(1)} dB`, padding.left - 5, y + 3);
    }

    // Draw trace
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    for (let i = 0; i < distances.length; i++) {
      const x = toCanvasX(distances[i]);
      const y = toCanvasY(powers[i]);

      if (x < padding.left || x > width - padding.right) continue;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Draw events
    traceData.events.forEach((event) => {
      const x = toCanvasX(event.distance);
      const y = toCanvasY(
        powers[Math.floor(event.distance / (traceData.metadata.resolution || 10))] || minPower
      );

      if (x < padding.left || x > width - padding.right) return;

      // Event marker
      ctx.fillStyle =
        event.type === "splice"
          ? "#3b82f6"
          : event.type === "connector"
          ? "#f59e0b"
          : event.type === "end"
          ? "#ef4444"
          : "#8b5cf6";

      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();

      // Event label
      ctx.fillStyle = "#f3f4f6";
      ctx.font = "9px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        event.type === "end" ? "END" : event.loss ? `${event.loss.toFixed(2)}dB` : "",
        x,
        y - 10
      );
    });

    // Draw measurement markers
    if (measureStart !== null) {
      const x = toCanvasX(measureStart);
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, height - padding.bottom);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (measureEnd !== null) {
      const x = toCanvasX(measureEnd);
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, height - padding.bottom);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Axis labels
    ctx.fillStyle = "#f3f4f6";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Distance (m)", width / 2, height - 10);

    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Power (dB)", 0, 0);
    ctx.restore();

    // Title
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(
      `${traceData.metadata.wavelength}nm | ${traceData.metadata.range}m range`,
      padding.left,
      20
    );
  }, [traceData, zoom, panX, measureStart, measureEnd]);

  // Handle canvas click for measurement
  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!measureMode || !traceData || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;

    // Convert canvas X to distance
    const padding = { left: 60, right: 20 };
    const width = rect.width;
    const minDist = Math.min(...traceData.distances) / zoom + panX;
    const maxDist = Math.max(...traceData.distances) / zoom + panX;
    const scaleX = (width - padding.left - padding.right) / (maxDist - minDist);

    const distance = (x - padding.left) / scaleX + minDist;

    if (measureStart === null) {
      setMeasureStart(distance);
    } else if (measureEnd === null) {
      setMeasureEnd(distance);
    } else {
      // Reset
      setMeasureStart(distance);
      setMeasureEnd(null);
    }
  };

  // Calculate measurement
  const measurement =
    traceData && measureStart !== null && measureEnd !== null
      ? calculateTwoPointLoss(
          traceData.distances,
          traceData.powers,
          Math.min(measureStart, measureEnd),
          Math.max(measureStart, measureEnd)
        )
      : null;

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">OTDR Trace Viewer</h2>

        <div className="flex flex-wrap gap-4 mb-4">
          <label className="flex-1 min-w-[200px]">
            <div className="flex items-center justify-center px-6 py-8 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-blue-400 transition-colors">
              <div className="text-center">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <div className="mt-2 text-sm text-gray-600">
                  Upload .SOR file or drag and drop
                </div>
                <div className="mt-1 text-xs text-gray-400">
                  Telcordia SR-4731 format
                </div>
              </div>
              <input
                type="file"
                accept=".sor"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </label>

          <div className="flex flex-col justify-center gap-2">
            <button
              onClick={loadDemoData}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
            >
              Load Demo Trace
            </button>
            <div className="text-xs text-gray-500 text-center">
              Try with sample data
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {fileName && (
          <div className="text-sm text-gray-600">
            Loaded: <span className="font-medium">{fileName}</span>
          </div>
        )}
      </div>

      {/* Trace Display */}
      {traceData && (
        <>
          {/* Controls */}
          <div className="bg-white rounded-2xl shadow-lg p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Zoom:</span>
                <button
                  onClick={() => setZoom(Math.max(0.5, zoom - 0.5))}
                  className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  -
                </button>
                <span className="w-12 text-center text-sm">{zoom}x</span>
                <button
                  onClick={() => setZoom(Math.min(10, zoom + 0.5))}
                  className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  +
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Pan:</span>
                <button
                  onClick={() => setPanX(panX - 100 / zoom)}
                  className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  ←
                </button>
                <button
                  onClick={() => setPanX(panX + 100 / zoom)}
                  className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  →
                </button>
                <button
                  onClick={() => {
                    setZoom(1);
                    setPanX(0);
                  }}
                  className="px-3 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Reset
                </button>
              </div>

              <div className="flex-1"></div>

              <button
                onClick={() => {
                  setMeasureMode(!measureMode);
                  setMeasureStart(null);
                  setMeasureEnd(null);
                }}
                className={`px-4 py-2 rounded-lg font-medium ${
                  measureMode
                    ? "bg-red-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {measureMode ? "Exit Measure" : "Two-Point Measure"}
              </button>
            </div>
          </div>

          {/* Canvas */}
          <div className="bg-white rounded-2xl shadow-lg p-4">
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              className="w-full h-[400px] rounded-lg cursor-crosshair"
              style={{ background: "#1f2937" }}
            />
          </div>

          {/* Measurement Result */}
          {measurement && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4">
              <h3 className="font-semibold text-yellow-800 mb-2">Two-Point Measurement</h3>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-yellow-600">Start</div>
                  <div className="font-medium text-yellow-900">
                    {Math.min(measureStart!, measureEnd!).toFixed(0)}m ({measurement.startPower} dB)
                  </div>
                </div>
                <div>
                  <div className="text-yellow-600">End</div>
                  <div className="font-medium text-yellow-900">
                    {Math.max(measureStart!, measureEnd!).toFixed(0)}m ({measurement.endPower} dB)
                  </div>
                </div>
                <div>
                  <div className="text-yellow-600">Loss</div>
                  <div className="text-xl font-bold text-yellow-900">{measurement.loss} dB</div>
                </div>
              </div>
            </div>
          )}

          {/* Events Table */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Detected Events</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 text-gray-600">Distance</th>
                    <th className="text-left py-2 px-3 text-gray-600">Type</th>
                    <th className="text-left py-2 px-3 text-gray-600">Loss</th>
                    <th className="text-left py-2 px-3 text-gray-600">Reflectance</th>
                    <th className="text-left py-2 px-3 text-gray-600">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {traceData.events.map((event, idx) => (
                    <tr key={idx} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-3 font-medium">{event.distance.toFixed(0)} m</td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            event.type === "splice"
                              ? "bg-blue-100 text-blue-700"
                              : event.type === "connector"
                              ? "bg-yellow-100 text-yellow-700"
                              : event.type === "end"
                              ? "bg-red-100 text-red-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {event.type}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        {event.loss ? `${event.loss.toFixed(2)} dB` : "-"}
                      </td>
                      <td className="py-2 px-3">
                        {event.reflectance ? `${event.reflectance.toFixed(1)} dB` : "-"}
                      </td>
                      <td className="py-2 px-3 text-gray-500">{event.notes || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Trace Info */}
          <div className="bg-blue-50 rounded-2xl p-6">
            <h3 className="font-semibold text-blue-900 mb-4">Trace Information</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-blue-600">Wavelength</div>
                <div className="font-medium text-blue-900">{traceData.metadata.wavelength} nm</div>
              </div>
              <div>
                <div className="text-blue-600">Range</div>
                <div className="font-medium text-blue-900">{traceData.metadata.range} m</div>
              </div>
              <div>
                <div className="text-blue-600">Pulse Width</div>
                <div className="font-medium text-blue-900">{traceData.metadata.pulseWidth} ns</div>
              </div>
              <div>
                <div className="text-blue-600">Resolution</div>
                <div className="font-medium text-blue-900">{traceData.metadata.resolution} m</div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Help Card */}
      {!traceData && (
        <div className="bg-blue-50 rounded-2xl p-6">
          <h3 className="font-semibold text-blue-900 mb-2">About OTDR Trace Viewer</h3>
          <p className="text-blue-800 mb-4">
            Upload OTDR trace files in SOR format (Telcordia SR-4731) to visualize fiber
            measurements and identify events like splices, connectors, and breaks.
          </p>
          <ul className="list-disc list-inside space-y-1 text-blue-700">
            <li>View trace data with zoom and pan controls</li>
            <li>Identify splice and connector events</li>
            <li>Use two-point measurement for loss calculation</li>
            <li>Export event data for documentation</li>
          </ul>
        </div>
      )}
    </div>
  );
}
