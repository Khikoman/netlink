"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import type { Enclosure, MapRoute, OLT, Port } from "@/types";
import { MapPin, Loader2, AlertCircle, Layers, Users, Navigation, Signal, Phone, Search, Filter, X, Home, Radio, Box } from "lucide-react";

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

interface SearchResult {
  id: number;
  type: "olt" | "closure" | "lcp" | "nap" | "customer";
  name: string;
  address?: string;
  lat: number;
  lng: number;
  signalLevel?: "good" | "fair" | "poor" | "critical";
}

export default function GpsMap({ projectId, onEnclosureClick }: GpsMapProps) {
  const [MapComponents, setMapComponents] = useState<{
    MapContainer: typeof import("react-leaflet").MapContainer;
    TileLayer: typeof import("react-leaflet").TileLayer;
    Marker: typeof import("react-leaflet").Marker;
    Popup: typeof import("react-leaflet").Popup;
    Polyline: typeof import("react-leaflet").Polyline;
    useMap: typeof import("react-leaflet").useMap;
    MarkerClusterGroup: typeof import("react-leaflet-cluster").default;
  } | null>(null);
  const [L, setL] = useState<typeof import("leaflet") | null>(null);
  const [showLegend, setShowLegend] = useState(true);
  const [showCustomers, setShowCustomers] = useState(true);
  const [showLayerPanel, setShowLayerPanel] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [signalFilter, setSignalFilter] = useState<string | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  // Layer visibility state
  const [layers, setLayers] = useState({
    olts: true,
    closures: true,
    lcps: true,
    naps: true,
    customers: true,
    networkLines: true,
    dropLines: true,
  });

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

  // Load customer ports with GPS coordinates
  const customerPorts = useLiveQuery(async () => {
    // Get all enclosures for this project to filter ports
    const projectEnclosures = await db.enclosures
      .where("projectId")
      .equals(projectId)
      .toArray();
    const enclosureIds = projectEnclosures.map((e) => e.id!);

    // Get all ports for these enclosures that have customer GPS
    const allPorts = await db.ports.toArray();
    return allPorts.filter(
      (p) =>
        enclosureIds.includes(p.enclosureId) &&
        p.customerGpsLat !== undefined &&
        p.customerGpsLng !== undefined &&
        p.customerName
    );
  }, [projectId]);

  // Calculate center and bounds (include OLTs and customers)
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

    // Add customer points
    customerPorts?.filter((p) => p.customerGpsLat && p.customerGpsLng).forEach((p) => {
      allPoints.push({ lat: p.customerGpsLat!, lng: p.customerGpsLng! });
    });

    if (allPoints.length === 0) {
      return { lat: 14.5995, lng: 120.9842 }; // Default to Philippines
    }

    const avgLat = allPoints.reduce((sum, p) => sum + p.lat, 0) / allPoints.length;
    const avgLng = allPoints.reduce((sum, p) => sum + p.lng, 0) / allPoints.length;

    return { lat: avgLat, lng: avgLng };
  }, [enclosures, olts, customerPorts]);

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

  // Calculate NAP → Customer drop lines
  const customerDropLines = useMemo(() => {
    if (!customerPorts || !enclosures) return [];

    return customerPorts
      .filter((p) => p.customerGpsLat && p.customerGpsLng)
      .map((port) => {
        const napEnclosure = enclosures.find((e) => e.id === port.enclosureId);
        if (!napEnclosure?.gpsLat || !napEnclosure?.gpsLng) return null;

        return {
          from: [napEnclosure.gpsLat, napEnclosure.gpsLng] as [number, number],
          to: [port.customerGpsLat!, port.customerGpsLng!] as [number, number],
          customerId: port.id,
          customerName: port.customerName,
          signalLevel: getSignalLevel(port.onuRxPower),
        };
      })
      .filter(Boolean) as {
        from: [number, number];
        to: [number, number];
        customerId?: number;
        customerName?: string;
        signalLevel?: "good" | "fair" | "poor" | "critical";
      }[];
  }, [customerPorts, enclosures]);

  // Filter customers by signal level
  const filteredCustomers = useMemo(() => {
    if (!signalFilter || !customerPorts) return customerPorts;

    const levels: Record<string, string[]> = {
      critical: ["critical"],
      poor: ["critical", "poor"],
      fair: ["critical", "poor", "fair"],
    };

    return customerPorts.filter((p) => {
      const level = getSignalLevel(p.onuRxPower);
      return level && levels[signalFilter]?.includes(level);
    });
  }, [customerPorts, signalFilter]);

  // Filter enclosures by type and layer visibility
  const filteredEnclosures = useMemo(() => {
    if (!enclosures) return [];
    return enclosures.filter((e) => {
      if (e.type === "splice-closure" && !layers.closures) return false;
      if ((e.type === "lcp" || e.type === "fdt") && !layers.lcps) return false;
      if ((e.type === "nap" || e.type === "fat") && !layers.naps) return false;
      return true;
    });
  }, [enclosures, layers]);

  // Search functionality
  const performSearch = useCallback(
    async (query: string) => {
      if (query.length < 2) {
        setSearchResults([]);
        return;
      }

      const results: SearchResult[] = [];
      const lowerQ = query.toLowerCase();

      // Search OLTs
      const allOlts = await db.olts.where("projectId").equals(projectId).toArray();
      allOlts
        .filter((o) => o.name.toLowerCase().includes(lowerQ) && o.gpsLat && o.gpsLng)
        .forEach((o) =>
          results.push({
            id: o.id!,
            type: "olt",
            name: o.name,
            address: o.address,
            lat: o.gpsLat!,
            lng: o.gpsLng!,
          })
        );

      // Search Enclosures
      const allEnclosures = await db.enclosures.where("projectId").equals(projectId).toArray();
      allEnclosures
        .filter(
          (e) =>
            (e.name.toLowerCase().includes(lowerQ) || e.address?.toLowerCase().includes(lowerQ)) &&
            e.gpsLat &&
            e.gpsLng
        )
        .forEach((e) => {
          let type: "closure" | "lcp" | "nap" = "closure";
          if (e.type === "lcp" || e.type === "fdt") type = "lcp";
          if (e.type === "nap" || e.type === "fat") type = "nap";
          results.push({
            id: e.id!,
            type,
            name: e.name,
            address: e.address,
            lat: e.gpsLat!,
            lng: e.gpsLng!,
          });
        });

      // Search Customers
      const allPorts = await db.ports.toArray();
      allPorts
        .filter(
          (p) =>
            p.customerGpsLat &&
            p.customerGpsLng &&
            (p.customerName?.toLowerCase().includes(lowerQ) ||
              p.customerAddress?.toLowerCase().includes(lowerQ) ||
              p.serviceId?.toLowerCase().includes(lowerQ) ||
              p.customerPhone?.includes(query))
        )
        .forEach((p) =>
          results.push({
            id: p.id!,
            type: "customer",
            name: p.customerName || "Unknown",
            address: p.customerAddress,
            lat: p.customerGpsLat!,
            lng: p.customerGpsLng!,
            signalLevel: getSignalLevel(p.onuRxPower),
          })
        );

      setSearchResults(results.slice(0, 20));
    },
    [projectId]
  );

  // Handle search select - fly to location
  const handleSearchSelect = useCallback((result: SearchResult) => {
    if (mapRef.current) {
      mapRef.current.flyTo([result.lat, result.lng], 18, { duration: 1 });
    }
    setShowSearch(false);
    setSearchQuery("");
    setSearchResults([]);
  }, []);

  // Get signal level from ONU Rx power (moved up for use in useMemo)
  function getSignalLevel(rxPower?: number): "good" | "fair" | "poor" | "critical" | undefined {
    if (rxPower === undefined) return undefined;
    if (rxPower > -25) return "good";
    if (rxPower > -27) return "fair";
    if (rxPower > -28) return "poor";
    return "critical";
  }

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

    Promise.all([
      import("react-leaflet"),
      import("react-leaflet-cluster"),
    ]).then(([reactLeaflet, cluster]) => {
      setMapComponents({
        MapContainer: reactLeaflet.MapContainer,
        TileLayer: reactLeaflet.TileLayer,
        Marker: reactLeaflet.Marker,
        Popup: reactLeaflet.Popup,
        Polyline: reactLeaflet.Polyline,
        useMap: reactLeaflet.useMap,
        MarkerClusterGroup: cluster.default,
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

  // Create customer icon (house style)
  const createCustomerIcon = (signalLevel?: "good" | "fair" | "poor" | "critical") => {
    if (!L) return undefined;

    const colors = {
      good: "#22c55e", // green
      fair: "#eab308", // yellow
      poor: "#f97316", // orange
      critical: "#ef4444", // red
    };
    const color = signalLevel ? colors[signalLevel] : "#6b7280"; // gray if no signal data

    return L.divIcon({
      className: "customer-marker",
      html: `
        <div style="
          position: relative;
          width: 28px;
          height: 28px;
        ">
          <div style="
            background-color: ${color};
            width: 28px;
            height: 20px;
            border-radius: 4px 4px 0 0;
            border: 2px solid white;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            position: absolute;
            bottom: 0;
          "></div>
          <div style="
            width: 0;
            height: 0;
            border-left: 16px solid transparent;
            border-right: 16px solid transparent;
            border-bottom: 14px solid ${color};
            position: absolute;
            top: 0;
            left: -2px;
            filter: drop-shadow(0 -1px 1px rgba(0,0,0,0.2));
          "></div>
          <div style="
            background-color: white;
            width: 8px;
            height: 10px;
            position: absolute;
            bottom: 2px;
            left: 10px;
            border-radius: 1px;
          "></div>
        </div>
      `,
      iconSize: [28, 34],
      iconAnchor: [14, 34],
      popupAnchor: [0, -34],
    });
  };

  // Create cluster icon for customer markers
  const createClusterCustomIcon = (cluster: { getChildCount: () => number }) => {
    if (!L) return L!.divIcon({ html: "", className: "" });

    const count = cluster.getChildCount();
    let size = 40;
    let bgColor = "#3b82f6"; // blue default

    if (count >= 100) {
      size = 60;
      bgColor = "#ef4444"; // red for large clusters
    } else if (count >= 50) {
      size = 55;
      bgColor = "#f97316"; // orange
    } else if (count >= 20) {
      size = 50;
      bgColor = "#eab308"; // yellow
    } else if (count >= 10) {
      size = 45;
      bgColor = "#22c55e"; // green
    }

    return L.divIcon({
      html: `<div style="
        background-color: ${bgColor};
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: ${size > 50 ? "14px" : "12px"};
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      ">${count}</div>`,
      className: "customer-cluster-icon",
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  };

  // Open navigation in external app
  const openNavigation = (lat: number, lng: number, name?: string) => {
    const label = encodeURIComponent(name || "Customer Location");
    // Use Google Maps URL which works on both iOS and Android
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${label}`;
    window.open(url, "_blank");
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

  const { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, MarkerClusterGroup } = MapComponents;

  // Component to capture map reference
  function MapRefSetter() {
    const map = useMap();
    useEffect(() => {
      mapRef.current = map;
    }, [map]);
    return null;
  }

  // Get type icon for search results
  const getTypeIcon = (type: string) => {
    switch (type) {
      case "olt":
        return <Radio className="w-4 h-4 text-teal-600" />;
      case "closure":
        return <Box className="w-4 h-4 text-green-600" />;
      case "lcp":
        return <Box className="w-4 h-4 text-orange-600" />;
      case "nap":
        return <Box className="w-4 h-4 text-cyan-600" />;
      case "customer":
        return <Home className="w-4 h-4 text-blue-600" />;
      default:
        return <MapPin className="w-4 h-4 text-gray-600" />;
    }
  };

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
        <MapRefSetter />

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

        {/* Draw NAP → Customer drop lines */}
        {layers.dropLines && layers.customers && customerDropLines.map((line, idx) => (
          <Polyline
            key={`drop-${idx}`}
            positions={[line.from, line.to]}
            pathOptions={{
              color:
                line.signalLevel === "critical"
                  ? "#ef4444"
                  : line.signalLevel === "poor"
                  ? "#f97316"
                  : line.signalLevel === "fair"
                  ? "#eab308"
                  : "#10b981",
              weight: 2,
              opacity: 0.6,
              dashArray: "4, 4",
            }}
          />
        ))}

        {/* Draw OLT markers */}
        {layers.olts && olts?.map((olt) => (
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
        {filteredEnclosures?.map((enc) => (
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
                    ↑ Parent: {enclosures?.find((e) => e.id === enc.parentId)?.name || "Closure"}
                  </p>
                )}
                {enc.parentType === "lcp" && enc.parentId && (
                  <p className="text-xs text-orange-600 mt-1">
                    ↑ Parent: {enclosures?.find((e) => e.id === enc.parentId)?.name || "LCP"}
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

        {/* Draw customer markers with clustering */}
        {layers.customers && (
          <MarkerClusterGroup
            chunkedLoading
            maxClusterRadius={50}
            spiderfyOnMaxZoom={true}
            showCoverageOnHover={false}
            zoomToBoundsOnClick={true}
            iconCreateFunction={createClusterCustomIcon}
          >
            {filteredCustomers?.map((port) => {
              const signalLevel = getSignalLevel(port.onuRxPower);
              const signalColors = {
                good: "text-green-600",
                fair: "text-yellow-600",
                poor: "text-orange-600",
                critical: "text-red-600",
              };

              return (
                <Marker
                  key={`customer-${port.id}`}
                  position={[port.customerGpsLat!, port.customerGpsLng!]}
                  icon={createCustomerIcon(signalLevel)}
                >
                  <Popup>
                    <div className="min-w-[180px]">
                      <h4 className="font-bold text-gray-800">{port.customerName}</h4>
                      <p className="text-xs text-gray-500 mt-1">
                        {port.customerAddress || "No address"}
                      </p>
                      {port.serviceId && (
                        <p className="text-xs text-blue-600 mt-1">
                          ID: {port.serviceId}
                        </p>
                      )}

                      {/* Signal Status */}
                      {port.onuRxPower !== undefined && (
                        <div className={`text-xs mt-2 ${signalLevel ? signalColors[signalLevel] : "text-gray-500"}`}>
                          <Signal className="w-3 h-3 inline mr-1" />
                          {port.onuRxPower.toFixed(1)} dBm
                          {signalLevel && (
                            <span className="ml-1 capitalize">
                              ({signalLevel === "good" ? "Good" : signalLevel === "fair" ? "Fair" : signalLevel === "poor" ? "Poor" : "Critical"})
                            </span>
                          )}
                        </div>
                      )}

                      {/* Service Status */}
                      {port.serviceStatus && (
                        <div className="mt-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            port.serviceStatus === "active"
                              ? "bg-green-100 text-green-700"
                              : port.serviceStatus === "pending"
                              ? "bg-yellow-100 text-yellow-700"
                              : port.serviceStatus === "suspended"
                              ? "bg-red-100 text-red-700"
                              : "bg-gray-100 text-gray-700"
                          }`}>
                            {port.serviceStatus.charAt(0).toUpperCase() + port.serviceStatus.slice(1)}
                          </span>
                        </div>
                      )}

                      {/* Contact Info */}
                      {port.customerPhone && (
                        <a
                          href={`tel:${port.customerPhone}`}
                          className="text-xs text-blue-600 hover:underline mt-2 flex items-center gap-1"
                        >
                          <Phone className="w-3 h-3" />
                          {port.customerPhone}
                        </a>
                      )}

                      {/* Navigation Button */}
                      <button
                        onClick={() => openNavigation(port.customerGpsLat!, port.customerGpsLng!, port.customerName)}
                        className="mt-2 w-full text-xs bg-blue-600 text-white px-3 py-1.5 rounded flex items-center justify-center gap-1 hover:bg-blue-700"
                      >
                        <Navigation className="w-3 h-3" />
                        Navigate
                      </button>

                      <p className="text-xs text-gray-400 mt-2">
                        {port.customerGpsLat?.toFixed(6)}, {port.customerGpsLng?.toFixed(6)}
                      </p>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MarkerClusterGroup>
        )}
      </MapContainer>

      {/* Search Bar */}
      <div className="absolute top-4 left-4 z-[1000]">
        {showSearch ? (
          <div className="bg-white rounded-lg shadow-lg w-80">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search OLT, LCP, NAP, Customer..."
                className="w-full pl-10 pr-10 py-2 rounded-lg border-none focus:ring-2 focus:ring-blue-500"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  performSearch(e.target.value);
                }}
                autoFocus
              />
              <button
                onClick={() => {
                  setShowSearch(false);
                  setSearchQuery("");
                  setSearchResults([]);
                }}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {searchResults.length > 0 && (
              <div className="border-t max-h-80 overflow-auto">
                {searchResults.map((r) => (
                  <button
                    key={`${r.type}-${r.id}`}
                    className="w-full px-4 py-2 flex items-center gap-3 hover:bg-gray-50 text-left border-b border-gray-100 last:border-b-0"
                    onClick={() => handleSearchSelect(r)}
                  >
                    {getTypeIcon(r.type)}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{r.name}</div>
                      <div className="text-xs text-gray-500 truncate">
                        {r.address || r.type.toUpperCase()}
                      </div>
                    </div>
                    {r.signalLevel && (
                      <div
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          r.signalLevel === "good"
                            ? "bg-green-100 text-green-700"
                            : r.signalLevel === "fair"
                            ? "bg-yellow-100 text-yellow-700"
                            : r.signalLevel === "poor"
                            ? "bg-orange-100 text-orange-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {r.signalLevel}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}

            {searchQuery.length >= 2 && searchResults.length === 0 && (
              <div className="p-4 text-center text-gray-500 text-sm border-t">
                No results found
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => setShowSearch(true)}
            className="p-2 bg-white rounded-lg shadow-md hover:bg-gray-50"
            title="Search"
          >
            <Search className="w-5 h-5 text-gray-600" />
          </button>
        )}
      </div>

      {/* Layer Controls */}
      <div className="absolute top-4 left-16 z-[1000]">
        {!showSearch && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowLayerPanel(!showLayerPanel)}
              className={`p-2 rounded-lg shadow-md ${
                showLayerPanel ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
              title="Layer Controls"
            >
              <Filter className="w-5 h-5" />
            </button>
          </div>
        )}

        {showLayerPanel && !showSearch && (
          <div className="mt-2 bg-white rounded-lg shadow-lg p-3 text-sm w-48">
            <div className="font-medium text-gray-700 mb-2">Layers</div>
            <div className="space-y-2">
              {[
                { key: "olts", label: "OLTs", color: "teal" },
                { key: "closures", label: "Closures", color: "green" },
                { key: "lcps", label: "LCPs", color: "orange" },
                { key: "naps", label: "NAPs", color: "cyan" },
                { key: "customers", label: "Customers", color: "blue" },
                { key: "networkLines", label: "Network Lines", color: "purple" },
                { key: "dropLines", label: "Drop Lines", color: "emerald" },
              ].map(({ key, label, color }) => (
                <label
                  key={key}
                  className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded"
                >
                  <input
                    type="checkbox"
                    checked={layers[key as keyof typeof layers]}
                    onChange={() =>
                      setLayers((l) => ({ ...l, [key]: !l[key as keyof typeof layers] }))
                    }
                    className={`rounded text-${color}-600`}
                  />
                  <span className="text-gray-700">{label}</span>
                </label>
              ))}
            </div>

            {/* Signal Filter */}
            <div className="mt-3 pt-3 border-t">
              <div className="text-xs font-medium text-gray-500 mb-2">Signal Filter</div>
              <select
                className="w-full text-sm border rounded p-1.5"
                value={signalFilter || ""}
                onChange={(e) => setSignalFilter(e.target.value || null)}
              >
                <option value="">All Signals</option>
                <option value="critical">🔴 Critical Only</option>
                <option value="poor">🟠 Poor & Critical</option>
                <option value="fair">🟡 Fair & Below</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Legend and Controls */}
      <div className="absolute top-4 right-4 z-[1000]">
        <button
          onClick={() => setShowLegend(!showLegend)}
          className="p-2 bg-white rounded-lg shadow-md hover:bg-gray-50"
          title="Toggle Legend"
        >
          <Layers className="w-5 h-5 text-gray-600" />
        </button>

        {showLegend && (
          <div className="mt-2 bg-white rounded-lg shadow-md p-3 text-sm max-h-[60vh] overflow-y-auto w-48">
            <div className="font-medium text-gray-700 mb-2">Network Points</div>
            <div className="space-y-1">
              {[
                { type: "olt", label: "OLT" },
                { type: "splice-closure", label: "Closure" },
                { type: "lcp", label: "LCP" },
                { type: "nap", label: "NAP" },
              ].map(({ type, label }) => (
                <div key={type} className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: ENCLOSURE_COLORS[type] }}
                  />
                  <span className="text-gray-600">{label}</span>
                </div>
              ))}
            </div>

            {/* Customer Legend */}
            {customerPorts && customerPorts.length > 0 && (
              <div className="mt-2 pt-2 border-t space-y-1">
                <div className="text-xs font-medium text-gray-500 mb-1">Customers (Signal)</div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-green-500" />
                  <span className="text-gray-600 text-xs">Good</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-yellow-500" />
                  <span className="text-gray-600 text-xs">Fair</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-orange-500" />
                  <span className="text-gray-600 text-xs">Poor</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-red-500" />
                  <span className="text-gray-600 text-xs">Critical</span>
                </div>
              </div>
            )}

            {/* Connection Legend */}
            <div className="mt-2 pt-2 border-t space-y-1">
              <div className="text-xs font-medium text-gray-500 mb-1">Connections</div>
              <div className="flex items-center gap-2">
                <div className="w-4 border-t-2 border-teal-600" />
                <span className="text-gray-600 text-xs">Feeder</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 border-t-2 border-purple-500" />
                <span className="text-gray-600 text-xs">Distribution</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 border-t-2 border-dashed border-orange-500" />
                <span className="text-gray-600 text-xs">LCP → NAP</span>
              </div>
              {customerDropLines.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-4 border-t-2 border-dashed border-green-500" />
                  <span className="text-gray-600 text-xs">NAP → Customer</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Point Count */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-white rounded-lg shadow-md px-3 py-2 text-sm">
        <span className="text-gray-600">
          <MapPin className="w-4 h-4 inline mr-1" />
          {(layers.olts ? olts?.length || 0 : 0) + (filteredEnclosures?.length || 0)} network points
          {layers.customers && filteredCustomers && filteredCustomers.length > 0 && (
            <span className="text-blue-600 ml-2">
              <Users className="w-3 h-3 inline mr-1" />
              {filteredCustomers.length} customer{filteredCustomers.length !== 1 ? "s" : ""}
            </span>
          )}
          {signalFilter && (
            <span className="ml-2 text-orange-600">
              (filtered)
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
