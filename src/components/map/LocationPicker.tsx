"use client";

import { useState, useEffect, useCallback } from "react";
import { MapPin, Crosshair, Loader2 } from "lucide-react";

interface LocationPickerProps {
  latitude?: number;
  longitude?: number;
  onLocationChange: (lat: number, lng: number) => void;
  showMiniMap?: boolean;
}

// Separate mini map component that will be dynamically imported
function MiniMapPreview({ lat, lng }: { lat: number; lng: number }) {
  const [MapComponents, setMapComponents] = useState<{
    MapContainer: typeof import("react-leaflet").MapContainer;
    TileLayer: typeof import("react-leaflet").TileLayer;
    Marker: typeof import("react-leaflet").Marker;
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

    // Import react-leaflet components
    import("react-leaflet").then((mod) => {
      setMapComponents({
        MapContainer: mod.MapContainer,
        TileLayer: mod.TileLayer,
        Marker: mod.Marker,
      });
    });
  }, []);

  if (!MapComponents) {
    return (
      <div className="h-40 bg-gray-100 rounded-lg flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const { MapContainer, TileLayer, Marker } = MapComponents;

  return (
    <MapContainer
      key={`${lat}-${lng}`}
      center={[lat, lng]}
      zoom={15}
      style={{ height: "160px", width: "100%" }}
      scrollWheelZoom={false}
      dragging={false}
      zoomControl={false}
      attributionControl={false}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Marker position={[lat, lng]} />
    </MapContainer>
  );
}

export default function LocationPicker({
  latitude,
  longitude,
  onLocationChange,
  showMiniMap = true,
}: LocationPickerProps) {
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Default to Philippines if no coordinates
  const defaultLat = 14.5995;
  const defaultLng = 120.9842;

  const currentLat = latitude ?? defaultLat;
  const currentLng = longitude ?? defaultLng;
  const hasCoordinates = latitude !== undefined && longitude !== undefined;

  const handleGetCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }

    setIsGettingLocation(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        onLocationChange(lat, lng);
        setIsGettingLocation(false);
      },
      (err) => {
        setError(
          err.code === 1
            ? "Location access denied. Please enable location permissions."
            : err.code === 2
            ? "Location unavailable. Please try again."
            : "Location request timed out. Please try again."
        );
        setIsGettingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  }, [onLocationChange]);

  return (
    <div className="space-y-3">
      {/* GPS Input Fields */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Latitude
          </label>
          <input
            type="number"
            step="any"
            value={latitude ?? ""}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (!isNaN(val)) {
                onLocationChange(val, longitude ?? defaultLng);
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800 text-sm"
            placeholder="e.g., 14.5995"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Longitude
          </label>
          <input
            type="number"
            step="any"
            value={longitude ?? ""}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (!isNaN(val)) {
                onLocationChange(latitude ?? defaultLat, val);
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800 text-sm"
            placeholder="e.g., 120.9842"
          />
        </div>
      </div>

      {/* Get Current Location Button */}
      <button
        type="button"
        onClick={handleGetCurrentLocation}
        disabled={isGettingLocation}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isGettingLocation ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Getting location...
          </>
        ) : (
          <>
            <Crosshair className="w-4 h-4" />
            Get Current Location
          </>
        )}
      </button>

      {/* Error Message */}
      {error && (
        <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
          {error}
        </div>
      )}

      {/* Mini Map Preview */}
      {showMiniMap && (
        <div className="relative rounded-lg overflow-hidden border border-gray-200">
          {hasCoordinates ? (
            <MiniMapPreview lat={currentLat} lng={currentLng} />
          ) : (
            <div className="h-40 flex items-center justify-center bg-gray-100 text-gray-500">
              <div className="text-center">
                <MapPin className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm">Enter coordinates or get current location</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Coordinate Display */}
      {hasCoordinates && (
        <div className="text-xs text-gray-500 flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          {currentLat.toFixed(6)}, {currentLng.toFixed(6)}
        </div>
      )}
    </div>
  );
}
