"use client";

import { useState, useCallback, useRef, useEffect, memo } from "react";
import {
  X,
  GripVertical,
  Save,
  MapPin,
  Crosshair,
  Minimize2,
  Maximize2,
  Loader2,
  Navigation,
} from "lucide-react";
import { db } from "@/lib/db";

interface FloatingGPSPickerProps {
  isOpen: boolean;
  nodeId: string;
  nodeType: string;
  dbId: number;
  nodeName?: string;
  initialLat?: number;
  initialLng?: number;
  onClose: () => void;
  onSave?: (lat: number, lng: number) => void;
}

// Clickable map component
function ClickableMap({
  lat,
  lng,
  onLocationChange,
}: {
  lat: number;
  lng: number;
  onLocationChange: (lat: number, lng: number) => void;
}) {
  const [MapComponents, setMapComponents] = useState<{
    MapContainer: typeof import("react-leaflet").MapContainer;
    TileLayer: typeof import("react-leaflet").TileLayer;
    Marker: typeof import("react-leaflet").Marker;
    useMapEvents: typeof import("react-leaflet").useMapEvents;
  } | null>(null);

  useEffect(() => {
    // Fix leaflet default icon issue
    import("leaflet").then((L) => {
      delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
      });
    });

    import("react-leaflet").then((mod) => {
      setMapComponents({
        MapContainer: mod.MapContainer,
        TileLayer: mod.TileLayer,
        Marker: mod.Marker,
        useMapEvents: mod.useMapEvents,
      });
    });
  }, []);

  if (!MapComponents) {
    return (
      <div className="h-48 bg-gray-100 rounded-lg flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const { MapContainer, TileLayer, Marker, useMapEvents } = MapComponents;

  // Component to handle map clicks
  function MapClickHandler() {
    useMapEvents({
      click: (e) => {
        onLocationChange(e.latlng.lat, e.latlng.lng);
      },
    });
    return null;
  }

  return (
    <MapContainer
      key={`map-${lat}-${lng}`}
      center={[lat, lng]}
      zoom={15}
      style={{ height: "192px", width: "100%" }}
      scrollWheelZoom={true}
      attributionControl={false}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Marker position={[lat, lng]} />
      <MapClickHandler />
    </MapContainer>
  );
}

export const FloatingGPSPicker = memo(function FloatingGPSPicker({
  isOpen,
  nodeId,
  nodeType,
  dbId,
  nodeName,
  initialLat,
  initialLng,
  onClose,
  onSave,
}: FloatingGPSPickerProps) {
  const defaultLat = 14.5995; // Philippines default
  const defaultLng = 120.9842;

  const [position, setPosition] = useState({ x: 150, y: 150 });
  const [isDragging, setIsDragging] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lat, setLat] = useState(initialLat ?? defaultLat);
  const [lng, setLng] = useState(initialLng ?? defaultLng);
  const [hasChanges, setHasChanges] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  // Update coordinates when props change
  useEffect(() => {
    if (initialLat !== undefined) setLat(initialLat);
    if (initialLng !== undefined) setLng(initialLng);
    setHasChanges(false);
  }, [initialLat, initialLng]);

  // Load position from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("netlink:gpsPickerPosition");
    if (saved) {
      try {
        setPosition(JSON.parse(saved));
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  // Save position to localStorage
  useEffect(() => {
    localStorage.setItem("netlink:gpsPickerPosition", JSON.stringify(position));
  }, [position]);

  // Handle panel dragging
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest("[data-no-drag]")) return;
      setIsDragging(true);
      dragOffset.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      };
    },
    [position]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      const newX = Math.max(0, e.clientX - dragOffset.current.x);
      const newY = Math.max(0, e.clientY - dragOffset.current.y);
      setPosition({ x: newX, y: newY });
    },
    [isDragging]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Handle location change from map click or manual input
  const handleLocationChange = useCallback((newLat: number, newLng: number) => {
    setLat(newLat);
    setLng(newLng);
    setHasChanges(true);
  }, []);

  // Get current location
  const handleGetCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }

    setIsGettingLocation(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        handleLocationChange(position.coords.latitude, position.coords.longitude);
        setIsGettingLocation(false);
      },
      (err) => {
        setError(
          err.code === 1
            ? "Location access denied"
            : err.code === 2
            ? "Location unavailable"
            : "Request timed out"
        );
        setIsGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, [handleLocationChange]);

  // Save to database
  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      if (nodeType === "olt") {
        await db.olts.update(dbId, { gpsLat: lat, gpsLng: lng });
      } else if (nodeType === "odf") {
        await db.odfs.update(dbId, { gpsLat: lat, gpsLng: lng });
      } else {
        await db.enclosures.update(dbId, { gpsLat: lat, gpsLng: lng });
      }

      setHasChanges(false);
      onSave?.(lat, lng);
      onClose();
    } catch (err) {
      console.error("Failed to save location:", err);
      setError("Failed to save location");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const hasCoordinates = lat !== defaultLat || lng !== defaultLng || initialLat !== undefined;

  return (
    <div
      ref={panelRef}
      className={`
        fixed z-50 bg-white rounded-xl shadow-2xl border border-gray-200
        transition-all duration-200 select-none
        ${isDragging ? "cursor-grabbing shadow-3xl" : "cursor-grab"}
      `}
      style={{
        left: position.x,
        top: position.y,
        width: isMinimized ? 280 : 320,
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-gradient-to-r from-indigo-50 to-blue-50 rounded-t-xl">
        <div className="flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-gray-400" />
          <MapPin className="w-4 h-4 text-indigo-500" />
          <span className="text-sm font-semibold text-gray-700 truncate max-w-[150px]">
            {nodeName || `${nodeType.toUpperCase()}-${dbId}`}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            data-no-drag
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 hover:bg-white/50 rounded transition-colors"
          >
            {isMinimized ? (
              <Maximize2 className="w-4 h-4 text-gray-500" />
            ) : (
              <Minimize2 className="w-4 h-4 text-gray-500" />
            )}
          </button>
          <button
            data-no-drag
            onClick={onClose}
            className="p-1 hover:bg-white/50 rounded transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Map */}
          <div className="p-2" data-no-drag>
            <div className="rounded-lg overflow-hidden border border-gray-200">
              <ClickableMap
                lat={lat}
                lng={lng}
                onLocationChange={handleLocationChange}
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1 text-center">
              Click on map to set location
            </p>
          </div>

          {/* Coordinate inputs */}
          <div className="px-3 pb-2 space-y-2" data-no-drag>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-0.5">
                  Latitude
                </label>
                <input
                  type="number"
                  step="any"
                  value={lat}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) handleLocationChange(val, lng);
                  }}
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="14.5995"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-0.5">
                  Longitude
                </label>
                <input
                  type="number"
                  step="any"
                  value={lng}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) handleLocationChange(lat, val);
                  }}
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="120.9842"
                />
              </div>
            </div>

            {/* Get current location button */}
            <button
              onClick={handleGetCurrentLocation}
              disabled={isGettingLocation}
              className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100 disabled:opacity-50 transition-colors"
            >
              {isGettingLocation ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Getting location...
                </>
              ) : (
                <>
                  <Crosshair className="w-3 h-3" />
                  Get Current Location
                </>
              )}
            </button>

            {/* Error */}
            {error && (
              <div className="text-[10px] text-red-600 bg-red-50 px-2 py-1 rounded">
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-3 py-2 border-t bg-gray-50 rounded-b-xl flex justify-between items-center">
            <div className="flex items-center gap-1 text-[10px] text-gray-500">
              {hasCoordinates && (
                <>
                  <Navigation className="w-3 h-3" />
                  {lat.toFixed(6)}, {lng.toFixed(6)}
                </>
              )}
            </div>
            <button
              data-no-drag
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-1"
            >
              {saving ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Save className="w-3 h-3" />
              )}
              Save
            </button>
          </div>
        </>
      )}

      {isMinimized && (
        <div className="px-3 py-2 text-xs text-gray-500">
          {hasCoordinates
            ? `${lat.toFixed(4)}, ${lng.toFixed(4)}`
            : "No location set"}
          {hasChanges && " • Unsaved"}
        </div>
      )}
    </div>
  );
});

export default FloatingGPSPicker;
