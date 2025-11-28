"use client";

import { useState, useEffect, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import type { Enclosure, MapRoute, OLT } from "@/types";
import { MapPin, Loader2, AlertCircle, Layers, Network } from "lucide-react";

// Enclosure type colors
const ENCLOSURE_COLORS: Record<string, string> = {
  "splice-closure": "#22c55e", // green
  "handhole": "#3b82f6", // blue
  "pedestal": "#8b5cf6", // purple
  "building": "#f59e0b", // amber
  "pole": "#ec4899", // pink
  "cabinet": "#14b8a6", // teal
  "lcp": "#f97316", // orange - Local Convergence Point
  "nap": "#06b6d4", // cyan - Network Access Point
  "fdt": "#f97316", // orange - Fiber Distribution Terminal (same as LCP)
  "fat": "#06b6d4", // cyan - Fiber Access Terminal (same as NAP)
  "olt": "#0d9488", // teal-600 - Optical Line Terminal
};

const ENCLOSURE_LABELS: Record<string, string> = {
  "splice-closure": "SC",
  "handhole": "HH",
  "pedestal": "PD",
  "building": "BD",
  "pole": "PL",
  "cabinet": "CB",
  "lcp": "LCP",
  "nap": "NAP",
  "fdt": "FDT",
  "fat": "FAT",
  "olt": "OLT",
};

interface GpsMapProps {
  projectId: number;
  onEnclosureClick?: (enclosure: Enclosure) => void;
}

export default function GpsMap({ projectId, onEnclosureClick }: GpsMapProps) {
  const [MapComponents, setMapComponents] = useState<{
    MapContainer: typeof import("react-leaflet").MapContainer;
    TileLayer: typeof import("react-leaflet").TileLayer;
    Marker: typeof import("react-leaflet").Marker;
    Popup: typeof import("react-leaflet").Popup;
    Polyline: typeof import("react-leaflet").Polyline;
    useMap: typeof import("react-leaflet").useMap;
  } | null>(null);
  const [L, setL] = useState<typeof import("leaflet") | null>(null);
  const [showLegend, setShowLegend] = useState(true);

  // Load enclosures with GPS coordinates
  const enclosures = useLiveQuery(
    () =>
      db.enclosures
        .where("projectId")
        .equals(projectId)
        .filter((enc) => enc.gpsLat !== undefined && enc.gpsLng !== undefined)
        .toArray(),
    [projectId]
  );

  // Load OLTs with GPS coordinates
  const olts = useLiveQuery(
    () =>
      db.olts
        .where("projectId")
        .equals(projectId)
        .filter((olt) => olt.gpsLat !== undefined && olt.gpsLng !== undefined)
        .toArray(),
    [projectId]
  );

  // Load ALL enclosures (even without GPS) to get hierarchy info
  const allEnclosures = useLiveQuery(
    () => db.enclosures.where("projectId").equals(projectId).toArray(),
    [projectId]
  );

  // Load routes from map data
  const mapRoutes = useLiveQuery(
    () => db.mapRoutes.where("projectId").equals(projectId).toArray(),
    [projectId]
  );

  // Load map nodes to get enclosure connections
  const mapNodes = useLiveQuery(
    () => db.mapNodes.where("projectId").equals(projectId).toArray(),
    [projectId]
  );

  // Calculate center and bounds (include OLTs)
  const mapCenter = useMemo(() => {
    const allPoints: { lat: number; lng: number }[] = [];

    // Add enclosure points
    enclosures?.filter((e) => e.gpsLat && e.gpsLng).forEach((e) => {
      allPoints.push({ lat: e.gpsLat!, lng: e.gpsLng! });
    });

    // Add OLT points
    olts?.filter((o) => o.gpsLat && o.gpsLng).forEach((o) => {
      allPoints.push({ lat: o.gpsLat!, lng: o.gpsLng! });
    });

    if (allPoints.length === 0) {
      return { lat: 14.5995, lng: 120.9842 }; // Default to Philippines
    }

    const avgLat = allPoints.reduce((sum, p) => sum + p.lat, 0) / allPoints.length;
    const avgLng = allPoints.reduce((sum, p) => sum + p.lng, 0) / allPoints.length;

    return { lat: avgLat, lng: avgLng };
  }, [enclosures, olts]);

  // Calculate routes between enclosures (including hierarchy connections)
  const routeLines = useMemo(() => {
    const lines: {
      from: [number, number];
      to: [number, number];
      label?: string;
      type: "route" | "hierarchy-olt-closure" | "hierarchy-closure-lcp" | "hierarchy-olt-lcp" | "hierarchy-lcp-nap";
    }[] = [];

    // 1. Add hierarchy connections (OLT → Closure → LCP → NAP)
    if (enclosures && olts && allEnclosures) {
      // OLT → Closure connections (new hierarchy)
      enclosures.forEach((enc) => {
        if (
          enc.type === "splice-closure" &&
          enc.parentType === "olt" &&
          enc.parentId &&
          enc.gpsLat &&
          enc.gpsLng
        ) {
          const parentOLT = olts.find((o) => o.id === enc.parentId);
          if (parentOLT?.gpsLat && parentOLT?.gpsLng) {
            lines.push({
              from: [parentOLT.gpsLat, parentOLT.gpsLng],
              to: [enc.gpsLat, enc.gpsLng],
              label: "Feeder",
              type: "hierarchy-olt-closure",
            });
          }
        }
      });

      // Closure → LCP connections (new hierarchy)
      enclosures.forEach((enc) => {
        if (
          (enc.type === "lcp" || enc.type === "fdt") &&
          enc.parentType === "closure" &&
          enc.parentId &&
          enc.gpsLat &&
          enc.gpsLng
        ) {
          const parentClosure = enclosures.find((e) => e.id === enc.parentId);
          if (parentClosure?.gpsLat && parentClosure?.gpsLng) {
            lines.push({
              from: [parentClosure.gpsLat, parentClosure.gpsLng],
              to: [enc.gpsLat, enc.gpsLng],
              label: "Distribution",
              type: "hierarchy-closure-lcp",
            });
          }
        }
      });

      // OLT → LCP connections (legacy direct connection)
      enclosures.forEach((enc) => {
        if (
          (enc.type === "lcp" || enc.type === "fdt") &&
          enc.parentType === "olt" &&
          enc.parentId &&
          enc.gpsLat &&
          enc.gpsLng
        ) {
          const parentOLT = olts.find((o) => o.id === enc.parentId);
          if (parentOLT?.gpsLat && parentOLT?.gpsLng) {
            lines.push({
              from: [parentOLT.gpsLat, parentOLT.gpsLng],
              to: [enc.gpsLat, enc.gpsLng],
              label: "Legacy Feeder",
              type: "hierarchy-olt-lcp",
            });
          }
        }
      });

      // LCP → NAP connections
      enclosures.forEach((enc) => {
        if (
          (enc.type === "nap" || enc.type === "fat") &&
          enc.parentType === "lcp" &&
          enc.parentId &&
          enc.gpsLat &&
          enc.gpsLng
        ) {
          const parentLCP = enclosures.find((e) => e.id === enc.parentId);
          if (parentLCP?.gpsLat && parentLCP?.gpsLng) {
            lines.push({
              from: [parentLCP.gpsLat, parentLCP.gpsLng],
              to: [enc.gpsLat, enc.gpsLng],
              label: "Drop",
              type: "hierarchy-lcp-nap",
            });
          }
        }
      });
    }

    // 2. Add manual routes from map data
    if (enclosures && mapRoutes && mapNodes) {
      // Create a map of mapNode ID to enclosure
      const nodeToEnclosure = new Map<number, Enclosure>();
      mapNodes.forEach((node) => {
        if (node.enclosureId) {
          const enc = enclosures.find((e) => e.id === node.enclosureId);
          if (enc && enc.gpsLat && enc.gpsLng) {
            nodeToEnclosure.set(node.id!, enc);
          }
        }
      });

      // Create lines from routes
      mapRoutes.forEach((route) => {
        const fromEnc = nodeToEnclosure.get(route.fromNodeId);
        const toEnc = nodeToEnclosure.get(route.toNodeId);

        if (fromEnc && toEnc && fromEnc.gpsLat && fromEnc.gpsLng && toEnc.gpsLat && toEnc.gpsLng) {
          lines.push({
            from: [fromEnc.gpsLat, fromEnc.gpsLng],
            to: [toEnc.gpsLat, toEnc.gpsLng],
            label: route.label || (route.fiberCount ? `${route.fiberCount}F` : undefined),
            type: "route",
          });
        }
      });
    }

    return lines;
  }, [enclosures, olts, allEnclosures, mapRoutes, mapNodes]);

  // Load Leaflet and react-leaflet
  useEffect(() => {
    import("leaflet").then((leaflet) => {
      // Fix default icon issue
      delete (leaflet.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
      leaflet.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
      });
      setL(leaflet);
    });

    import("react-leaflet").then((mod) => {
      setMapComponents({
        MapContainer: mod.MapContainer,
        TileLayer: mod.TileLayer,
        Marker: mod.Marker,
        Popup: mod.Popup,
        Polyline: mod.Polyline,
        useMap: mod.useMap,
      });
    });
  }, []);

  // Create custom icons for each enclosure type
  const createIcon = (type: string) => {
    if (!L) return undefined;

    const color = ENCLOSURE_COLORS[type] || "#6b7280";

    return L.divIcon({
      className: "custom-marker",
      html: `
        <div style="
          background-color: ${color};
          width: 32px;
          height: 32px;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          border: 3px solid white;
          box-shadow: 0 2px 5px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <span style="
            transform: rotate(45deg);
            color: white;
            font-size: 10px;
            font-weight: bold;
          ">${ENCLOSURE_LABELS[type] || "?"}</span>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32],
    });
  };

  if (!MapComponents || !L) {
    return (
      <div className="h-full min-h-[400px] bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
          <p className="text-gray-600">Loading map...</p>
        </div>
      </div>
    );
  }

  const { MapContainer, TileLayer, Marker, Popup, Polyline } = MapComponents;

  const hasOLTs = olts && olts.length > 0;
  const hasEnclosures = enclosures && enclosures.length > 0;

  if (!hasOLTs && !hasEnclosures) {
    return (
      <div className="h-full min-h-[400px] bg-gray-50 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
        <div className="text-center p-6">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-700 mb-2">No GPS Data</h3>
          <p className="text-gray-500 max-w-sm">
            Add GPS coordinates to your OLTs, LCPs, or NAPs to see them on the map.
            Use the Hierarchy tab to manage your network structure.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[400px] rounded-lg overflow-hidden">
      <MapContainer
        center={[mapCenter.lat, mapCenter.lng]}
        zoom={15}
        style={{ height: "100%", width: "100%", minHeight: "400px" }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Draw route lines */}
        {routeLines.map((line, idx) => {
          // Different styles for different connection types
          const pathOptions = {
            "hierarchy-olt-closure": {
              color: "#0d9488", // teal for OLT→Closure (feeder)
              weight: 5,
              opacity: 0.9,
              dashArray: undefined,
            },
            "hierarchy-closure-lcp": {
              color: "#8b5cf6", // purple for Closure→LCP (distribution)
              weight: 4,
              opacity: 0.85,
              dashArray: undefined,
            },
            "hierarchy-olt-lcp": {
              color: "#0d9488", // teal for legacy OLT→LCP (feeder)
              weight: 4,
              opacity: 0.7,
              dashArray: "12, 6",
            },
            "hierarchy-lcp-nap": {
              color: "#f97316", // orange for LCP→NAP (drop)
              weight: 3,
              opacity: 0.8,
              dashArray: "8, 4",
            },
            route: {
              color: "#3b82f6", // blue for manual routes
              weight: 3,
              opacity: 0.8,
              dashArray: "5, 10",
            },
          }[line.type];

          return (
            <Polyline
              key={idx}
              positions={[line.from, line.to]}
              pathOptions={pathOptions}
            />
          );
        })}

        {/* Draw OLT markers */}
        {olts?.map((olt) => (
          <Marker
            key={`olt-${olt.id}`}
            position={[olt.gpsLat!, olt.gpsLng!]}
            icon={createIcon("olt")}
          >
            <Popup>
              <div className="min-w-[150px]">
                <h4 className="font-bold text-gray-800">{olt.name}</h4>
                <p className="text-sm text-teal-600 font-medium">OLT (Central Office)</p>
                {olt.model && (
                  <p className="text-xs text-gray-500 mt-1">{olt.model}</p>
                )}
                {olt.address && (
                  <p className="text-xs text-gray-500">{olt.address}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  {olt.gpsLat?.toFixed(6)}, {olt.gpsLng?.toFixed(6)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {olt.totalPonPorts} PON ports
                </p>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Draw enclosure markers */}
        {enclosures?.map((enc) => (
          <Marker
            key={enc.id}
            position={[enc.gpsLat!, enc.gpsLng!]}
            icon={createIcon(enc.type)}
            eventHandlers={{
              click: () => onEnclosureClick?.(enc),
            }}
          >
            <Popup>
              <div className="min-w-[150px]">
                <h4 className="font-bold text-gray-800">{enc.name}</h4>
                <p className="text-sm text-gray-600 capitalize">
                  {enc.type.replace("-", " ")}
                </p>
                {enc.address && (
                  <p className="text-xs text-gray-500 mt-1">{enc.address}</p>
                )}
                {/* Show parent info */}
                {enc.parentType === "olt" && enc.parentId && (
                  <p className="text-xs text-teal-600 mt-1">
                    ↑ Parent: {olts?.find((o) => o.id === enc.parentId)?.name || "OLT"}
                  </p>
                )}
                {enc.parentType === "closure" && enc.parentId && (
                  <p className="text-xs text-purple-600 mt-1">
                    ↑ Parent: {enclosures.find((e) => e.id === enc.parentId)?.name || "Closure"}
                  </p>
                )}
                {enc.parentType === "lcp" && enc.parentId && (
                  <p className="text-xs text-orange-600 mt-1">
                    ↑ Parent: {enclosures.find((e) => e.id === enc.parentId)?.name || "LCP"}
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  {enc.gpsLat?.toFixed(6)}, {enc.gpsLng?.toFixed(6)}
                </p>
                {onEnclosureClick && (
                  <button
                    onClick={() => onEnclosureClick(enc)}
                    className="mt-2 text-xs text-blue-600 hover:underline"
                  >
                    View Details →
                  </button>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Legend */}
      <div className="absolute top-4 right-4 z-[1000]">
        <button
          onClick={() => setShowLegend(!showLegend)}
          className="p-2 bg-white rounded-lg shadow-md hover:bg-gray-50"
          title="Toggle Legend"
        >
          <Layers className="w-5 h-5 text-gray-600" />
        </button>

        {showLegend && (
          <div className="mt-2 bg-white rounded-lg shadow-md p-3 text-sm">
            <div className="font-medium text-gray-700 mb-2">Legend</div>
            <div className="space-y-1">
              {Object.entries(ENCLOSURE_COLORS).map(([type, color]) => (
                <div key={type} className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-gray-600 capitalize">
                    {type.replace("-", " ")}
                  </span>
                </div>
              ))}
            </div>
            {routeLines.length > 0 && (
              <div className="mt-2 pt-2 border-t space-y-1">
                <div className="text-xs font-medium text-gray-500 mb-1">Connections</div>
                {routeLines.some((l) => l.type === "hierarchy-olt-closure") && (
                  <div className="flex items-center gap-2">
                    <div className="w-4 border-t-2 border-teal-600" />
                    <span className="text-gray-600 text-xs">OLT → Closure</span>
                  </div>
                )}
                {routeLines.some((l) => l.type === "hierarchy-closure-lcp") && (
                  <div className="flex items-center gap-2">
                    <div className="w-4 border-t-2 border-purple-500" />
                    <span className="text-gray-600 text-xs">Closure → LCP</span>
                  </div>
                )}
                {routeLines.some((l) => l.type === "hierarchy-olt-lcp") && (
                  <div className="flex items-center gap-2">
                    <div className="w-4 border-t-2 border-dashed border-teal-600" />
                    <span className="text-gray-600 text-xs">OLT → LCP (Legacy)</span>
                  </div>
                )}
                {routeLines.some((l) => l.type === "hierarchy-lcp-nap") && (
                  <div className="flex items-center gap-2">
                    <div className="w-4 border-t-2 border-dashed border-orange-500" />
                    <span className="text-gray-600 text-xs">LCP → NAP (Drop)</span>
                  </div>
                )}
                {routeLines.some((l) => l.type === "route") && (
                  <div className="flex items-center gap-2">
                    <div className="w-4 border-t-2 border-dashed border-blue-500" />
                    <span className="text-gray-600 text-xs">Manual Route</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Point Count */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-white rounded-lg shadow-md px-3 py-2 text-sm">
        <span className="text-gray-600">
          <MapPin className="w-4 h-4 inline mr-1" />
          {(olts?.length || 0) + (enclosures?.length || 0)} point{(olts?.length || 0) + (enclosures?.length || 0) !== 1 ? "s" : ""} with GPS
          {olts && olts.length > 0 && (
            <span className="text-teal-600 ml-2">({olts.length} OLT{olts.length !== 1 ? "s" : ""})</span>
          )}
        </span>
      </div>
    </div>
  );
}
