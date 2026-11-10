import React, { useEffect, useRef, useState, useMemo } from 'react';
import { 
  Map, 
  AdvancedMarker, 
  InfoWindow, 
  useMap 
} from '@vis.gl/react-google-maps';
import { School, getRouteColor } from '../types';
import { 
  Navigation, 
  ExternalLink, 
  Layers, 
  Crosshair, 
  Maximize2 
} from 'lucide-react';

interface MapComponentProps {
  schools: School[];
  selectedSchool: School | null;
  onSelectSchool: (school: School) => void;
  activeRoute: string; // 'ALL' or route name
  theme?: 'dark' | 'light';
  googleMapsApiKey?: string;
}

// Component to dynamically draw connecting route polyline on Google Map
function RoutePolyline({ 
  schools, 
  activeRoute 
}: { 
  schools: School[]; 
  activeRoute: string; 
}) {
  const map = useMap();
  const polylineRef = useRef<google.maps.Polyline | null>(null);

  const routePath = useMemo(() => {
    if (activeRoute === 'ALL') return [];
    return schools
      .filter((s) => s.lat && s.lon)
      .map((s) => ({ lat: s.lat, lng: s.lon }));
  }, [schools, activeRoute]);

  const routeColor = useMemo(() => {
    return getRouteColor(activeRoute);
  }, [activeRoute]);

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
        icons: [
          {
            icon: {
              path: 'M 0,-1 0,1',
              strokeOpacity: 1,
              scale: 3,
            },
            offset: '0',
            repeat: '16px',
          },
        ],
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

// Component to automatically fit bounds to schools or pan to selected school
function MapBoundsController({
  schools,
  selectedSchool,
}: {
  schools: School[];
  selectedSchool: School | null;
}) {
  const map = useMap();
  const prevSelectedIdRef = useRef<number | null>(null);

  // Pan to selected school when selected
  useEffect(() => {
    if (!map || !selectedSchool) return;
    if (selectedSchool.id !== prevSelectedIdRef.current) {
      prevSelectedIdRef.current = selectedSchool.id;
      if (selectedSchool.lat && selectedSchool.lon) {
        map.panTo({ lat: selectedSchool.lat, lng: selectedSchool.lon });
        const currentZoom = map.getZoom() || 12;
        if (currentZoom < 14) {
          map.setZoom(15);
        }
      }
    }
  }, [map, selectedSchool]);

  // Fit bounds when school list changes or initial load
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

// Action trigger buttons on the map: Fit All & Locate Me
function MapActionButtons({
  schools,
  onUserLocation,
  isLight,
}: {
  schools: School[];
  onUserLocation: (pos: { lat: number; lng: number }) => void;
  isLight: boolean;
}) {
  const map = useMap();

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
        (err) => {
          console.warn('GPS Location error:', err.message);
        },
        { enableHighAccuracy: true }
      );
    }
  };

  return (
    <div className="absolute right-3 bottom-8 sm:bottom-6 flex flex-col gap-2 z-[100] pointer-events-auto">
      {/* Fit all route bounds */}
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

      {/* GPS Current Location button */}
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

export const MapComponent: React.FC<MapComponentProps> = ({
  schools,
  selectedSchool,
  onSelectSchool,
  activeRoute,
  theme = 'light',
}) => {
  const [mapTypeId, setMapTypeId] = useState<string>('roadmap');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const isLight = theme === 'light';

  return (
    <div className={`relative w-full h-full overflow-hidden ${isLight ? 'bg-slate-100' : 'bg-[#111e17]'}`}>
      <Map
        mapId="DEMO_MAP_ID"
        defaultCenter={{ lat: 26.4499, lng: 80.3319 }}
        defaultZoom={12}
        gestureHandling="greedy"
        disableDefaultUI={false}
        mapTypeId={mapTypeId}
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        className="w-full h-full"
      >
        <MapBoundsController
          schools={schools}
          selectedSchool={selectedSchool}
        />

        <RoutePolyline
          schools={schools}
          activeRoute={activeRoute}
        />

        <MapActionButtons
          schools={schools}
          onUserLocation={setUserLocation}
          isLight={isLight}
        />

        {/* User GPS Location Marker */}
        {userLocation && (
          <AdvancedMarker
            position={userLocation}
            title="Your Current Location"
            zIndex={10000}
          >
            <div className="relative flex items-center justify-center">
              <span className="absolute -inset-2 rounded-full bg-blue-500/40 animate-ping" />
              <div className="w-5 h-5 rounded-full bg-blue-500 border-2 border-white shadow-lg flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-white" />
              </div>
            </div>
          </AdvancedMarker>
        )}

        {/* Render markers for each school */}
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
                {/* Glowing ring for active selection */}
                {isSelected && (
                  <span
                    className="absolute -inset-2 rounded-full animate-ping opacity-75"
                    style={{ backgroundColor: color }}
                  />
                )}

                {/* Outer badge */}
                <div
                  className={`flex items-center justify-center rounded-full transition-transform duration-200 shadow-lg ${
                    isSelected ? 'scale-125 ring-2 ring-white' : 'group-hover:scale-115'
                  }`}
                  style={{
                    backgroundColor: isLight ? '#ffffff' : '#12211a',
                    border: `2.5px solid ${color}`,
                    width: isSelected ? '34px' : '26px',
                    height: isSelected ? '34px' : '26px',
                    boxShadow: isLight
                      ? '0 4px 10px rgba(15,23,42,0.28)'
                      : '0 4px 12px rgba(0,0,0,0.6)',
                  }}
                >
                  {/* Inner dot */}
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

              <h4 className="font-bold text-sm text-slate-900 leading-snug">
                {selectedSchool.schoolName}
              </h4>

              {selectedSchool.address && (
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {selectedSchool.address}
                </p>
              )}

              {/* SPOC & Driver Quick info */}
              <div className="mt-2 pt-2 border-t border-slate-200 text-[11px] space-y-0.5 text-slate-600">
                {selectedSchool.spocContact && (
                  <div>
                    <span className="font-semibold text-slate-700">SPOC:</span>{' '}
                    {selectedSchool.spocName || 'Incharge'} ({selectedSchool.spocContact})
                  </div>
                )}
                {selectedSchool.driverContact && (
                  <div>
                    <span className="font-semibold text-slate-700">Driver:</span>{' '}
                    {selectedSchool.driverName || 'Driver'} ({selectedSchool.driverContact})
                  </div>
                )}
              </div>

              {/* Actions */}
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
      </Map>

      {/* Floating Info & Map Layer Controls */}
      <div className="absolute top-3 left-3 z-[100] flex items-center gap-2 pointer-events-auto">
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
              backgroundColor:
                activeRoute === 'ALL' ? '#10b981' : getRouteColor(activeRoute),
            }}
          />
          <span className={isLight ? 'text-white font-semibold' : 'text-slate-300'}>
            {activeRoute === 'ALL' ? (
              <>
                Showing{' '}
                <strong className={isLight ? 'text-white' : 'text-amber-400'}>
                  {schools.length}
                </strong>{' '}
                Locations
              </>
            ) : (
              <>
                Showing <strong className="font-bold">{activeRoute}</strong> ({schools.length} stops)
              </>
            )}
          </span>
        </div>

        {/* Satellite / Roadmap Toggle */}
        <button
          onClick={() => setMapTypeId(prev => prev === 'roadmap' ? 'hybrid' : 'roadmap')}
          className={`px-3 py-1.5 rounded-full border shadow-lg backdrop-blur-md text-xs flex items-center gap-1.5 transition-colors font-semibold ${
            isLight
              ? 'bg-white/95 hover:bg-slate-50 border-slate-200 text-slate-700'
              : 'bg-[#14231b]/95 hover:bg-[#1e3428] border-[#2c4436] text-slate-300 hover:text-white'
          }`}
          title="Toggle Satellite / Hybrid view"
        >
          <Layers className={`w-3.5 h-3.5 ${isLight ? 'text-blue-600' : 'text-amber-400'}`} />
          <span className="hidden sm:inline">
            {mapTypeId === 'roadmap' ? 'Satellite' : 'Roadmap'}
          </span>
        </button>
      </div>
    </div>
  );
};
