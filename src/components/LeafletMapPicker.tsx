import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Loader2, MapPin, Search, X } from 'lucide-react';

interface LeafletMapPickerProps {
  latitude: number | null;
  longitude: number | null;
  initialSearchHint?: string;
  onChange: (coords: { latitude: number | null; longitude: number | null }) => void;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

const SILIGURI_DEFAULT: [number, number] = [26.7271, 88.4317];

function createPinIcon(): L.DivIcon {
  return L.divIcon({
    className: 'dr-leaflet-pin',
    html: `<div style="width:32px;height:40px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 3px 6px rgba(15,23,42,0.35));">
      <svg width="30" height="38" viewBox="0 0 30 38" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M15 1C7.82 1 2 6.82 2 14C2 23.75 15 36.5 15 36.5C15 36.5 28 23.75 28 14C28 6.82 22.18 1 15 1Z" fill="#1F4FD8" stroke="#FFFFFF" stroke-width="2"/>
        <circle cx="15" cy="14" r="5" fill="#FFFFFF"/>
      </svg>
    </div>`,
    iconSize: [32, 40],
    iconAnchor: [16, 38],
  });
}

function roundCoord(val: number): number {
  return Math.round(val * 1_000_000) / 1_000_000;
}

export const LeafletMapPicker: React.FC<LeafletMapPickerProps> = ({
  latitude,
  longitude,
  initialSearchHint = '',
  onChange,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<NominatimResult[]>([]);

  const placeOrMovePin = (lat: number, lng: number, zoom = 16) => {
    const map = mapRef.current;
    if (!map) return;

    const cleanLat = roundCoord(lat);
    const cleanLng = roundCoord(lng);

    if (!markerRef.current) {
      const marker = L.marker([cleanLat, cleanLng], {
        draggable: true,
        icon: createPinIcon(),
      }).addTo(map);
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        onChangeRef.current({
          latitude: roundCoord(pos.lat),
          longitude: roundCoord(pos.lng),
        });
      });
      markerRef.current = marker;
    } else {
      markerRef.current.setLatLng([cleanLat, cleanLng]);
    }

    map.setView([cleanLat, cleanLng], Math.max(map.getZoom(), zoom), {
      animate: true,
    });
  };

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const hasInitial =
      latitude != null &&
      longitude != null &&
      Number.isFinite(latitude) &&
      Number.isFinite(longitude);
    const startCenter: [number, number] = hasInitial
      ? [latitude as number, longitude as number]
      : SILIGURI_DEFAULT;

    const map = L.map(mapContainerRef.current, {
      center: startCenter,
      zoom: hasInitial ? 16 : 13,
      scrollWheelZoom: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      const lat = roundCoord(e.latlng.lat);
      const lng = roundCoord(e.latlng.lng);
      placeOrMovePin(lat, lng, map.getZoom());
      onChangeRef.current({ latitude: lat, longitude: lng });
    });

    mapRef.current = map;

    if (hasInitial) {
      placeOrMovePin(latitude as number, longitude as number, 16);
    }

    // Ensure proper sizing inside wizard step transitions
    const resizeTimer = window.setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => {
      window.clearTimeout(resizeTimer);
      markerRef.current?.remove();
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (
      latitude != null &&
      longitude != null &&
      Number.isFinite(latitude) &&
      Number.isFinite(longitude)
    ) {
      const existing = markerRef.current?.getLatLng();
      if (
        !existing ||
        Math.abs(existing.lat - latitude) > 1e-6 ||
        Math.abs(existing.lng - longitude) > 1e-6
      ) {
        placeOrMovePin(latitude, longitude, 16);
      }
    } else if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
  }, [latitude, longitude]);

  const handleSearch = async () => {
    const raw = (searchQuery || initialSearchHint).trim();
    if (!raw) {
      setSearchError('Type an area, road, or landmark in Siliguri to search.');
      return;
    }

    setSearching(true);
    setSearchError(null);
    setResults([]);

    try {
      const queryWithCity = raw.toLowerCase().includes('siliguri')
        ? raw
        : `${raw}, Siliguri, West Bengal`;
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=in&q=${encodeURIComponent(
        queryWithCity
      )}`;
      const res = await fetch(url, {
        headers: {
          Accept: 'application/json',
        },
      });
      if (!res.ok) {
        throw new Error('Could not reach OpenStreetMap search right now.');
      }
      const data = (await res.json()) as NominatimResult[];
      if (!Array.isArray(data) || data.length === 0) {
        setSearchError(
          'No matching place found. Try a nearby landmark or drag the pin on the map.'
        );
        return;
      }

      setResults(data);
      const top = data[0];
      const lat = roundCoord(Number(top.lat));
      const lng = roundCoord(Number(top.lon));
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        placeOrMovePin(lat, lng, 16);
        onChangeRef.current({ latitude: lat, longitude: lng });
      }
    } catch (err) {
      setSearchError(
        err instanceof Error
          ? err.message
          : 'Could not search map right now. Tap the map or drag the pin directly.'
      );
    } finally {
      setSearching(false);
    }
  };

  const hasCoords =
    latitude != null &&
    longitude != null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude);

  return (
    <div
      data-testid="leaflet-map-picker"
      className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3.5 sm:p-4 space-y-3 min-w-0"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--text-primary)] inline-flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
            <span>Map location pin</span>
          </p>
          <p className="text-[13px] text-[var(--text-muted)]">
            Search an address or tap the map and drag the pin to mark the exact spot.
          </p>
        </div>

        {hasCoords && (
          <button
            type="button"
            onClick={() => {
              onChange({ latitude: null, longitude: null });
              setResults([]);
            }}
            className="min-h-[44px] px-3 rounded-lg border border-[var(--border-hairline)] text-[13px] font-medium text-[var(--text-secondary)] hover:text-rose-500 inline-flex items-center gap-1 cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
            <span>Clear pin</span>
          </button>
        )}
      </div>

      {/* Nominatim Search Box */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            aria-label="Search address or landmark on map"
            placeholder={
              initialSearchHint
                ? `Search e.g. ${initialSearchHint}`
                : 'Search Siliguri road or landmark...'
            }
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSearchError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleSearch();
              }
            }}
            className="w-full min-h-[44px] pl-9 pr-3 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-base text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)]"
          />
        </div>
        <button
          type="button"
          disabled={searching}
          onClick={() => void handleSearch()}
          className="min-h-[44px] px-4 rounded-xl bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-ink)] text-sm font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 shrink-0"
        >
          {searching ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          <span>{searching ? 'Finding...' : 'Find on map'}</span>
        </button>
      </div>

      {searchError && (
        <p role="alert" className="text-[13px] font-medium text-rose-500">
          {searchError}
        </p>
      )}

      {results.length > 1 && (
        <div className="flex flex-col gap-1 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-2">
          <p className="text-[13px] font-medium text-[var(--text-muted)] px-1.5">
            Matching places (tap to move pin):
          </p>
          {results.slice(0, 4).map((r) => (
            <button
              key={r.place_id}
              type="button"
              onClick={() => {
                const lat = roundCoord(Number(r.lat));
                const lng = roundCoord(Number(r.lon));
                if (Number.isFinite(lat) && Number.isFinite(lng)) {
                  placeOrMovePin(lat, lng, 16);
                  onChange({ latitude: lat, longitude: lng });
                }
              }}
              className="min-h-[44px] px-2.5 py-1.5 rounded-lg text-left text-[13px] text-[var(--text-primary)] hover:bg-[var(--bg-canvas)] transition-colors cursor-pointer break-anywhere"
            >
              {r.display_name}
            </button>
          ))}
        </div>
      )}

      {/* OpenStreetMap Leaflet Container */}
      <div
        ref={mapContainerRef}
        className="w-full h-[240px] sm:h-[280px] rounded-xl overflow-hidden border border-[var(--border-hairline)] relative z-0 bg-[var(--bg-surface-muted)]"
      />

      <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-[var(--text-secondary)]">
        {hasCoords ? (
          <span className="tabular-nums font-medium text-[var(--text-primary)]">
            Pinned: {Number(latitude).toFixed(5)}, {Number(longitude).toFixed(5)}
          </span>
        ) : (
          <span>No pin dropped yet (optional — tap map to drop a draggable pin).</span>
        )}
      </div>
    </div>
  );
};
