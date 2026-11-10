import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import { 
  Map as GoogleMap, 
  AdvancedMarker, 
  InfoWindow, 
  useMap as useGoogleMap 
} from '@vis.gl/react-google-maps';
import { School, getRouteColor } from '../types';
import { 
  Navigation, 
  ExternalLink, 
  Layers, 
  Crosshair, 
  Maximize2,
  Map as MapIcon,
  Globe,
  Info
} from 'lucide-react';

interface MapComponentProps {
  schools: School[];
  selectedSchool: School | null;
  onSelectSchool: (school: School) => void;
  activeRoute: string; // 'ALL' or route name
  theme?: 'dark' | 'light';
  googleMapsApiKey?: string;
}

// -------------------------------------------------------------
// 1. LEAFLET / OPENSTREETMAP IMPLEMENTATION (Zero API Key, Free & Reliable)
// -------------------------------------------------------------
interface LeafletMapViewProps {
  schools: School[];
  selectedSchool: School | null;
  onSelectSchool: (school: School) => void;
  activeRoute: string;
  isLight: boolean;
  onUserLocation: (pos: { lat: number; lng: number }) => void;
  userLocation: { lat: number; lng: number } | null;
}

const LeafletMapView: React.FC<LeafletMapViewProps> = ({
  schools,
  selectedSchool,
  onSelectSchool,
  activeRoute,
  isLight,
  onUserLocation,
  userLocation,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const prevSelectedIdRef = useRef<number | null>(null);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [26.4499, 80.3319],
      zoom: 12,
      zoomControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    // Invalidate map size after mount for perfect rendering
    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update Markers
  useEffect(() => {
    const map = mapRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    schools.forEach((school) => {
      if (!school.lat || !school.lon) return;
      const isSelected = selectedSchool?.id === school.id;
      const color = getRouteColor(school.routeName);

      const markerHtml = `
        <div style="position: relative; display: flex; align-items: center; justify-content: center; cursor: pointer;">
          ${
            isSelected
              ? `<span style="position: absolute; inset: -6px; border-radius: 9999px; background-color: ${color}; opacity: 0.65; animation: ping 1.2s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>`
              : ''
          }
          <div style="
            width: ${isSelected ? '32px' : '24px'};
            height: ${isSelected ? '32px' : '24px'};
            border-radius: 9999px;
            background-color: ${isLight ? '#ffffff' : '#12211a'};
            border: 2.5px solid ${color};
            box-shadow: 0 4px 10px rgba(0,0,0,0.35);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.15s ease-out;
          ">
            <div style="
              width: ${isSelected ? '14px' : '9px'};
              height: ${isSelected ? '14px' : '9px'};
              border-radius: 9999px;
              background-color: ${color};
            "></div>
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'leaflet-custom-marker',
        html: markerHtml,
        iconSize: [isSelected ? 32 : 24, isSelected ? 32 : 24],
        iconAnchor: [isSelected ? 16 : 12, isSelected ? 16 : 12],
      });

      const marker = L.marker([school.lat, school.lon], {
        icon: customIcon,
        title: school.schoolName,
        zIndexOffset: isSelected ? 1000 : 100,
      });

      marker.on('click', () => {
        onSelectSchool(school);
      });

      // Bind custom popup
      const popupContent = `
        <div style="font-family: inherit; font-size: 12px; max-width: 260px; color: ${isLight ? '#1e293b' : '#f2ede0'};">
          <div style="display: flex; gap: 6px; align-items: center; margin-bottom: 6px; flex-wrap: wrap;">
            <span style="background-color: ${color}; color: white; padding: 2px 8px; border-radius: 9999px; font-weight: bold; font-size: 10px;">${school.routeName}</span>
            ${school.nodeCode ? `<span style="font-family: monospace; font-size: 10px; background: ${isLight ? '#e2e8f0' : '#263f32'}; color: ${isLight ? '#334155' : '#7fb298'}; padding: 2px 6px; border-radius: 4px;">${school.nodeCode}</span>` : ''}
          </div>
          <h4 style="font-weight: bold; font-size: 13px; margin: 0 0 4px 0; line-height: 1.3;">${school.schoolName}</h4>
          ${school.address ? `<p style="font-size: 11px; color: ${isLight ? '#64748b' : '#a4b3ab'}; margin: 0 0 6px 0; line-height: 1.3;">${school.address}</p>` : ''}
          <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid ${isLight ? '#e2e8f0' : '#2c4436'}; font-size: 11px; display: flex; flex-direction: column; gap: 2px;">
            ${school.spocContact ? `<div><strong>SPOC:</strong> ${school.spocName || 'Incharge'} (${school.spocContact})</div>` : ''}
            ${school.driverContact ? `<div><strong>Driver:</strong> ${school.driverName || 'Driver'} (${school.driverContact})</div>` : ''}
          </div>
          <div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid ${isLight ? '#e2e8f0' : '#2c4436'}; display: flex; justify-content: space-between; align-items: center;">
            <a href="https://www.google.com/maps/dir/?api=1&destination=${school.lat},${school.lon}" target="_blank" rel="noopener noreferrer" style="color: #10b981; font-weight: bold; text-decoration: none; font-size: 11px; display: inline-flex; align-items: center; gap: 4px;">
              🧭 Directions
            </a>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent, {
        className: 'custom-leaflet-popup',
        offset: [0, -10],
      });

      marker.addTo(layer);
    });
  }, [schools, selectedSchool, isLight, onSelectSchool]);

  // Update Route Polyline
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    if (activeRoute !== 'ALL') {
      const points: [number, number][] = schools
        .filter((s) => s.lat && s.lon)
        .map((s) => [s.lat, s.lon]);

      if (points.length >= 2) {
        polylineRef.current = L.polyline(points, {
          color: getRouteColor(activeRoute),
          weight: 4,
          opacity: 0.85,
          dashArray: '6, 8',
        }).addTo(map);
      }
    }
  }, [schools, activeRoute]);

  // Pan to selected school
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedSchool || !selectedSchool.lat || !selectedSchool.lon) return;

    if (selectedSchool.id !== prevSelectedIdRef.current) {
      prevSelectedIdRef.current = selectedSchool.id;
      map.setView([selectedSchool.lat, selectedSchool.lon], Math.max(map.getZoom(), 15), {
        animate: true,
      });
    }
  }, [selectedSchool]);

  // Fit bounds when school list changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || schools.length === 0 || selectedSchool) return;

    const points = schools
      .filter((s) => s.lat && s.lon)
      .map((s) => [s.lat, s.lon] as [number, number]);

    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [schools, selectedSchool]);

  // User Location Marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    if (userLocation) {
      const userIcon = L.divIcon({
        className: 'user-location-marker',
        html: `
          <div style="position: relative; display: flex; align-items: center; justify-content: center;">
            <span style="position: absolute; inset: -8px; border-radius: 9999px; background-color: #3b82f6; opacity: 0.5; animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
            <div style="width: 18px; height: 18px; border-radius: 9999px; background-color: #2563eb; border: 2.5px solid #ffffff; box-shadow: 0 4px 10px rgba(0,0,0,0.4);"></div>
          </div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });

      userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], {
        icon: userIcon,
        zIndexOffset: 2000,
      }).addTo(map);
    }
  }, [userLocation]);

  const handleFitAll = () => {
    const map = mapRef.current;
    if (!map || schools.length === 0) return;
    const points = schools
      .filter((s) => s.lat && s.lon)
      .map((s) => [s.lat, s.lon] as [number, number]);
    if (points.length > 0) {
      map.fitBounds(L.latLngBounds(points), { padding: [50, 50] });
    }
  };

  const handleLocateMe = () => {
    const map = mapRef.current;
    if (!map) return;
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          map.setView([lat, lng], 15, { animate: true });
          onUserLocation({ lat, lng });
        },
        (err) => {
          console.warn('GPS location error:', err);
        },
        { enableHighAccuracy: true }
      );
    }
  };

  return (
    <div className={`relative w-full h-full ${!isLight ? 'leaflet-dark-mode' : ''}`}>
      <div ref={containerRef} className="w-full h-full" />

      {/* Floating Action Buttons */}
      <div className="absolute right-3 bottom-8 sm:bottom-6 flex flex-col gap-2 z-[1000] pointer-events-auto">
        <button
          onClick={handleFitAll}
          className={`w-10 h-10 rounded-xl border shadow-xl backdrop-blur-md flex items-center justify-center transition-all active:scale-95 ${
            isLight
              ? 'bg-white/95 hover:bg-slate-50 border-slate-200 text-slate-700'
              : 'bg-[#16271e]/90 hover:bg-[#1e3428] border-[#2c4436] text-amber-300'
          }`}
          title="Fit All Route Stops"
        >
          <Maximize2 className="w-5 h-5" />
        </button>

        <button
          onClick={handleLocateMe}
          className={`w-10 h-10 rounded-xl border shadow-xl backdrop-blur-md flex items-center justify-center transition-all active:scale-95 ${
            isLight
              ? 'bg-white/95 hover:bg-slate-50 border-slate-200 text-blue-600'
              : 'bg-[#16271e]/90 hover:bg-[#1e3428] border-[#2c4436] text-emerald-400'
          }`}
          title="Show My Live GPS Location"
        >
          <Crosshair className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// 2. GOOGLE MAPS CONTROLLER HELPERS
// -------------------------------------------------------------
function GoogleRoutePolyline({ schools, activeRoute }: { schools: School[]; activeRoute: string }) {
  const map = useGoogleMap();
  const polylineRef = useRef<google.maps.Polyline | null>(null);

  const routePath = useMemo(() => {
    if (activeRoute === 'ALL') return [];
    return schools.filter((s) => s.lat && s.lon).map((s) => ({ lat: s.lat, lng: s.lon }));
  }, [schools, activeRoute]);

  const routeColor = useMemo(() => getRouteColor(activeRoute), [activeRoute]);

  useEffect(() => {
    if (!map) return;
    if (routePath.length < 2) {
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }
      return;
    }

    if (!polylineRef.current) {
      polylineRef.current = new google.maps.Polyline({
        path: routePath,
        geodesic: true,
        strokeColor: routeColor,
        strokeOpacity: 0.9,
        strokeWeight: 4,
        icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 }, offset: '0', repeat: '16px' }],
        map,
      });
    } else {
      polylineRef.current.setPath(routePath);
      polylineRef.current.setOptions({ strokeColor: routeColor });
      polylineRef.current.setMap(map);
    }

    return () => {
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }
    };
  }, [map, routePath, routeColor]);

  return null;
}

function GoogleMapBoundsController({ schools, selectedSchool }: { schools: School[]; selectedSchool: School | null }) {
  const map = useGoogleMap();
  const prevSelectedIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!map || !selectedSchool) return;
    if (selectedSchool.id !== prevSelectedIdRef.current) {
      prevSelectedIdRef.current = selectedSchool.id;
      if (selectedSchool.lat && selectedSchool.lon) {
        map.panTo({ lat: selectedSchool.lat, lng: selectedSchool.lon });
        const currentZoom = map.getZoom() || 12;
        if (currentZoom < 14) map.setZoom(15);
      }
    }
  }, [map, selectedSchool]);

  useEffect(() => {
    if (!map || schools.length === 0 || selectedSchool) return;
    const bounds = new google.maps.LatLngBounds();
    let count = 0;
    schools.forEach((s) => {
      if (s.lat && s.lon) {
        bounds.extend({ lat: s.lat, lng: s.lon });
        count++;
      }
    });
    if (count > 0) {
      map.fitBounds(bounds, { top: 60, bottom: 60, left: 60, right: 60 });
    }
  }, [map, schools, selectedSchool]);

  return null;
}

function GoogleMapActionButtons({
  schools,
  onUserLocation,
  isLight,
}: {
  schools: School[];
  onUserLocation: (pos: { lat: number; lng: number }) => void;
  isLight: boolean;
}) {
  const map = useGoogleMap();

  const handleFitAll = () => {
    if (!map || schools.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    schools.forEach((s) => {
      if (s.lat && s.lon) bounds.extend({ lat: s.lat, lng: s.lon });
    });
    map.fitBounds(bounds, { top: 60, bottom: 60, left: 60, right: 60 });
  };

  const handleLocateMe = () => {
    if (!map) return;
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          map.panTo({ lat, lng });
          map.setZoom(15);
          onUserLocation({ lat, lng });
        },
        (err) => console.warn('GPS Location error:', err.message),
        { enableHighAccuracy: true }
      );
    }
  };

  return (
    <div className="absolute right-3 bottom-8 sm:bottom-6 flex flex-col gap-2 z-[100] pointer-events-auto">
      <button
        onClick={handleFitAll}
        className={`w-10 h-10 rounded-xl border shadow-xl backdrop-blur-md flex items-center justify-center transition-all active:scale-95 ${
          isLight
            ? 'bg-white/95 hover:bg-slate-50 border-slate-200 text-slate-700'
            : 'bg-[#16271e]/90 hover:bg-[#1e3428] border-[#2c4436] text-amber-300'
        }`}
        title="Fit All Route Stops"
      >
        <Maximize2 className="w-5 h-5" />
      </button>

      <button
        onClick={handleLocateMe}
        className={`w-10 h-10 rounded-xl border shadow-xl backdrop-blur-md flex items-center justify-center transition-all active:scale-95 ${
          isLight
            ? 'bg-white/95 hover:bg-slate-50 border-slate-200 text-blue-600'
            : 'bg-[#16271e]/90 hover:bg-[#1e3428] border-[#2c4436] text-emerald-400'
        }`}
        title="Show My Live GPS Location"
      >
        <Crosshair className="w-5 h-5" />
      </button>
    </div>
  );
}

// -------------------------------------------------------------
// 3. MAIN MAP CONTAINER WITH SEAMLESS DUAL ENGINE SUPPORT
// -------------------------------------------------------------
export const MapComponent: React.FC<MapComponentProps> = ({
  schools,
  selectedSchool,
  onSelectSchool,
  activeRoute,
  theme = 'light',
}) => {
  const isLight = theme === 'light';
  // OpenStreetMap is our rock-solid default to prevent any "This page can't load Google Maps correctly" alerts
  const [mapEngine, setMapEngine] = useState<'osm' | 'google'>('osm');
  const [googleMapTypeId, setGoogleMapTypeId] = useState<string>('roadmap');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [googleMapsAuthError, setGoogleMapsAuthError] = useState(false);

  // Auto-fallback listener: If Google Maps API ever throws auth error / quota exceeded, switch to OpenStreetMap
  useEffect(() => {
    const handleGoogleMapsError = () => {
      setGoogleMapsAuthError(true);
      setMapEngine('osm');
    };
    window.addEventListener('gmp-quota-exceeded', handleGoogleMapsError);
    return () => window.removeEventListener('gmp-quota-exceeded', handleGoogleMapsError);
  }, []);

  return (
    <div className={`relative w-full h-full overflow-hidden ${isLight ? 'bg-slate-100' : 'bg-[#111e17]'}`}>
      {/* MAP ENGINE 1: OPENSTREETMAP (LEAFLET) */}
      {mapEngine === 'osm' ? (
        <LeafletMapView
          schools={schools}
          selectedSchool={selectedSchool}
          onSelectSchool={onSelectSchool}
          activeRoute={activeRoute}
          isLight={isLight}
          onUserLocation={setUserLocation}
          userLocation={userLocation}
        />
      ) : (
        /* MAP ENGINE 2: GOOGLE MAPS PLATFORM */
        <GoogleMap
          mapId="DEMO_MAP_ID"
          defaultCenter={{ lat: 26.4499, lng: 80.3319 }}
          defaultZoom={12}
          gestureHandling="greedy"
          disableDefaultUI={false}
          mapTypeId={googleMapTypeId}
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          className="w-full h-full"
        >
          <GoogleMapBoundsController schools={schools} selectedSchool={selectedSchool} />
          <GoogleRoutePolyline schools={schools} activeRoute={activeRoute} />
          <GoogleMapActionButtons schools={schools} onUserLocation={setUserLocation} isLight={isLight} />

          {/* User GPS Location Marker */}
          {userLocation && (
            <AdvancedMarker position={userLocation} title="Your Current Location" zIndex={10000}>
              <div className="relative flex items-center justify-center">
                <span className="absolute -inset-2 rounded-full bg-blue-500/40 animate-ping" />
                <div className="w-5 h-5 rounded-full bg-blue-500 border-2 border-white shadow-lg flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-white" />
                </div>
              </div>
            </AdvancedMarker>
          )}

          {/* School Markers */}
          {schools.map((school) => {
            if (!school.lat || !school.lon) return null;
            const isSelected = selectedSchool?.id === school.id;
            const color = getRouteColor(school.routeName);

            return (
              <AdvancedMarker
                key={school.id}
                position={{ lat: school.lat, lng: school.lon }}
                onClick={() => onSelectSchool(school)}
                title={school.schoolName}
                zIndex={isSelected ? 9999 : 100}
              >
                <div className="relative flex items-center justify-center cursor-pointer group">
                  {isSelected && (
                    <span
                      className="absolute -inset-2 rounded-full animate-ping opacity-75"
                      style={{ backgroundColor: color }}
                    />
                  )}
                  <div
                    className={`flex items-center justify-center rounded-full transition-transform duration-200 shadow-lg ${
                      isSelected ? 'scale-125 ring-2 ring-white' : 'group-hover:scale-115'
                    }`}
                    style={{
                      backgroundColor: isLight ? '#ffffff' : '#12211a',
                      border: `2.5px solid ${color}`,
                      width: isSelected ? '34px' : '26px',
                      height: isSelected ? '34px' : '26px',
                    }}
                  >
                    <div
                      className="rounded-full"
                      style={{
                        backgroundColor: color,
                        width: isSelected ? '14px' : '10px',
                        height: isSelected ? '14px' : '10px',
                      }}
                    />
                  </div>
                </div>
              </AdvancedMarker>
            );
          })}

          {/* Selected School InfoWindow */}
          {selectedSchool && selectedSchool.lat && selectedSchool.lon && (
            <InfoWindow
              position={{ lat: selectedSchool.lat, lng: selectedSchool.lon }}
              onCloseClick={() => onSelectSchool(null as any)}
              pixelOffset={[0, -20]}
            >
              <div className="p-1 max-w-[270px] text-slate-800 font-sans">
                <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white shadow-xs"
                    style={{ backgroundColor: getRouteColor(selectedSchool.routeName) }}
                  >
                    {selectedSchool.routeName}
                  </span>
                  {selectedSchool.nodeCode && (
                    <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-300">
                      {selectedSchool.nodeCode}
                    </span>
                  )}
                </div>

                <h4 className="font-bold text-sm text-slate-900 leading-snug">{selectedSchool.schoolName}</h4>
                {selectedSchool.address && (
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">{selectedSchool.address}</p>
                )}

                <div className="mt-2 pt-2 border-t border-slate-200 text-[11px] space-y-0.5 text-slate-600">
                  {selectedSchool.spocContact && (
                    <div>
                      <span className="font-semibold text-slate-700">SPOC:</span> {selectedSchool.spocName || 'Incharge'} ({selectedSchool.spocContact})
                    </div>
                  )}
                  {selectedSchool.driverContact && (
                    <div>
                      <span className="font-semibold text-slate-700">Driver:</span> {selectedSchool.driverName || 'Driver'} ({selectedSchool.driverContact})
                    </div>
                  )}
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-200 flex items-center justify-between gap-2">
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${selectedSchool.lat},${selectedSchool.lon}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    <span>Directions</span>
                  </a>

                  <button
                    onClick={() => onSelectSchool(selectedSchool)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900"
                  >
                    <span>Open Drawer</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      )}

      {/* Floating Info & Map Provider Toggle Controls */}
      <div className="absolute top-3 left-3 z-[1000] flex flex-wrap items-center gap-2 pointer-events-auto">
        {/* Route status badge */}
        <div
          className={`px-3.5 py-1.5 rounded-full shadow-lg backdrop-blur-md text-xs flex items-center gap-2 ${
            isLight
              ? 'bg-[#0f172a] text-white border border-slate-800'
              : 'bg-[#14231b]/95 border border-[#2c4436] text-[#f2ede0]'
          }`}
        >
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{
              backgroundColor: activeRoute === 'ALL' ? '#10b981' : getRouteColor(activeRoute),
            }}
          />
          <span className={isLight ? 'text-white font-semibold' : 'text-slate-300'}>
            {activeRoute === 'ALL' ? (
              <>
                Showing <strong className={isLight ? 'text-white' : 'text-amber-400'}>{schools.length}</strong> Locations
              </>
            ) : (
              <>
                Showing <strong className="font-bold">{activeRoute}</strong> ({schools.length} stops)
              </>
            )}
          </span>
        </div>

        {/* Dual Map Engine Switcher: OpenStreetMap vs Google Maps */}
        <div
          className={`p-0.5 rounded-full border shadow-lg backdrop-blur-md flex items-center text-xs font-semibold ${
            isLight ? 'bg-white/95 border-slate-200' : 'bg-[#14231b]/95 border-[#2c4436]'
          }`}
        >
          <button
            type="button"
            onClick={() => setMapEngine('osm')}
            className={`px-3 py-1 rounded-full flex items-center gap-1.5 transition-all ${
              mapEngine === 'osm'
                ? isLight
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-emerald-600 text-white shadow-xs'
                : isLight
                ? 'text-slate-600 hover:text-slate-900'
                : 'text-slate-400 hover:text-white'
            }`}
            title="OpenStreetMap: 100% Free, Fast & Zero Error Popups"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>OpenStreetMap</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (googleMapsAuthError) {
                alert('Google Maps has domain/billing restrictions on this website. OpenStreetMap is active and recommended.');
                return;
              }
              setMapEngine('google');
            }}
            className={`px-3 py-1 rounded-full flex items-center gap-1.5 transition-all ${
              mapEngine === 'google'
                ? isLight
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                : isLight
                ? 'text-slate-600 hover:text-slate-900'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Google Maps Platform"
          >
            <MapIcon className="w-3.5 h-3.5" />
            <span>Google Maps</span>
          </button>
        </div>

        {/* Satellite / Roadmap Toggle (Google Maps only) */}
        {mapEngine === 'google' && (
          <button
            onClick={() => setGoogleMapTypeId((prev) => (prev === 'roadmap' ? 'hybrid' : 'roadmap'))}
            className={`px-3 py-1.5 rounded-full border shadow-lg backdrop-blur-md text-xs flex items-center gap-1.5 transition-colors font-semibold ${
              isLight
                ? 'bg-white/95 hover:bg-slate-50 border-slate-200 text-slate-700'
                : 'bg-[#14231b]/95 hover:bg-[#1e3428] border-[#2c4436] text-slate-300 hover:text-white'
            }`}
            title="Toggle Satellite / Hybrid view"
          >
            <Layers className={`w-3.5 h-3.5 ${isLight ? 'text-blue-600' : 'text-amber-400'}`} />
            <span className="hidden sm:inline">
              {googleMapTypeId === 'roadmap' ? 'Satellite' : 'Roadmap'}
            </span>
          </button>
        )}
      </div>
    </div>
  );
};
