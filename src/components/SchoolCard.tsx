import React from 'react';
import { School, getRouteColor } from '../types';
import { MapPin, Navigation, Edit3, ChevronRight, Phone, Truck } from 'lucide-react';

interface SchoolCardProps {
  school: School;
  isSelected: boolean;
  onSelect: (school: School) => void;
  onEdit?: (school: School) => void;
  theme?: 'dark' | 'light';
}

export const SchoolCard: React.FC<SchoolCardProps> = ({
  school,
  isSelected,
  onSelect,
  onEdit,
  theme = 'light',
}) => {
  const routeColor = getRouteColor(school.routeName);
  const isLight = theme === 'light';

  const handleDirectionsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const gmapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${school.lat},${school.lon}`;
    window.open(gmapsUrl, '_blank', 'noopener,noreferrer');
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEdit) onEdit(school);
  };

  const cleanTel = (contact: string) => contact.replace(/[^0-9+]/g, '');

  if (isLight) {
    return (
      <div
        onClick={() => onSelect(school)}
        className={`group relative p-4 sm:p-4.5 rounded-2xl border transition-all cursor-pointer ${
          isSelected
            ? 'bg-blue-50/40 border-blue-500 shadow-md ring-1 ring-blue-500/80'
            : 'bg-white border-slate-200/90 hover:border-blue-300 hover:shadow-md shadow-xs'
        }`}
      >
        {/* Top row: ROUTE NAME · NODE CODE + Quick Actions */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            <span
              className="font-bold uppercase tracking-wide"
              style={{ color: routeColor }}
            >
              {school.routeName || 'NO ROUTE'}
            </span>
            {school.nodeCode && (
              <>
                <span className="text-slate-300 font-bold">·</span>
                <span className="font-mono-code text-slate-600 font-medium">
                  {school.nodeCode}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {onEdit && (
              <button
                onClick={handleEditClick}
                title="Edit school details"
                className="p-1.5 rounded-xl bg-slate-100 text-slate-600 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              onClick={handleDirectionsClick}
              title="Open in Google Maps"
              aria-label="Open in Google Maps directions"
              className="px-3 py-1 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 font-semibold transition-colors flex items-center gap-1.5 text-xs"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Route</span>
            </button>
          </div>
        </div>

        {/* School Name */}
        <h3
          className={`text-base font-bold transition-colors leading-snug ${
            isSelected
              ? 'text-blue-600'
              : 'text-slate-900 group-hover:text-blue-600'
          }`}
        >
          {school.schoolName}
        </h3>

        {/* Address + Pincode + Category */}
        <p className="mt-1.5 text-xs text-slate-500 line-clamp-2 leading-relaxed flex items-start gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
          <span>
            {school.address || 'Kanpur'}{' '}
            {school.pincode ? `(${school.pincode})` : ''}
            {school.category ? ` · ${school.category}` : ''}
          </span>
        </p>

        {/* Bottom 1-Tap Action Bar */}
        <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {school.spocContact && (
              <a
                href={`tel:${cleanTel(school.spocContact)}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-xs transition-colors"
                title={`Call SPOC: ${school.spocName || 'Incharge'} (${school.spocContact})`}
              >
                <Phone className="w-3.5 h-3.5 text-emerald-600" />
                <span className="truncate max-w-[100px] sm:max-w-none">SPOC</span>
              </a>
            )}

            {school.driverContact && (
              <a
                href={`tel:${cleanTel(school.driverContact)}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
                title={`Call Driver: ${school.driverName || 'Driver'} (${school.driverContact})`}
              >
                <Truck className="w-3.5 h-3.5 text-slate-600" />
                <span className="truncate max-w-[110px] sm:max-w-none">
                  {school.driverName || 'Driver'}
                </span>
              </a>
            )}
          </div>

          <div className="flex items-center gap-0.5 text-blue-600 font-semibold text-xs shrink-0 group-hover:translate-x-0.5 transition-transform">
            <span>Details</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => onSelect(school)}
      className={`group relative p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer ${
        isSelected
          ? 'bg-[#1e3428] border-amber-500 shadow-xl shadow-black/50 ring-1 ring-amber-500/80 scale-[1.01]'
          : 'bg-[#16271e] border-[#2c4436] hover:border-[#3d5a49] hover:bg-[#1a2e24]'
      }`}
    >
      {/* Top row: Route Badge + Node Code + Edit */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-white shadow-xs"
            style={{ 
              backgroundColor: `${routeColor}26`, 
              color: routeColor, 
              borderColor: `${routeColor}55`, 
              borderWidth: '1px' 
            }}
          >
            <span
              className="w-2 h-2 rounded-full inline-block shrink-0"
              style={{ backgroundColor: routeColor }}
            />
            {school.routeName || 'No Route'}
          </span>

          {school.nodeCode && (
            <span className="font-mono-code text-[11px] px-2 py-0.5 rounded-md bg-[#111e17] text-[#a4b3ab] border border-[#2c4436]">
              {school.nodeCode}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Quick Edit button */}
          {onEdit && (
            <button
              onClick={handleEditClick}
              title="Edit school details (Admin Authorization Required)"
              className="p-1.5 rounded-lg bg-[#111e17] text-slate-400 hover:text-amber-400 hover:bg-[#21382b] border border-[#2c4436] transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Small pin button for instant Google Maps directions */}
          <button
            onClick={handleDirectionsClick}
            title="Open in Google Maps"
            aria-label="Open in Google Maps directions"
            className="p-1.5 rounded-lg bg-[#111e17] text-[#7fb298] hover:text-amber-400 hover:bg-[#2c4436] border border-[#2c4436] transition-colors flex items-center gap-1 text-xs"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[11px] font-medium">Route</span>
          </button>
        </div>
      </div>

      {/* School Name */}
      <h3 className="text-base font-semibold text-[#f2ede0] group-hover:text-amber-300 transition-colors leading-snug">
        {school.schoolName}
      </h3>

      {/* UDISE & Category */}
      <div className="mt-1.5 flex items-center gap-2 text-xs text-[#a4b3ab] flex-wrap">
        {school.udise && (
          <span className="font-mono-code text-[11px] bg-[#111e17] px-1.5 py-0.5 rounded border border-[#2c4436]/40">
            UDISE: {school.udise}
          </span>
        )}
        {school.category && (
          <span className="text-[11px] text-[#7fb298] font-medium">• {school.category}</span>
        )}
      </div>

      {/* Address */}
      {school.address && (
        <p className="mt-2 text-xs text-[#90a297] line-clamp-2 leading-relaxed flex items-start gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
          <span>{school.address} {school.pincode ? `(${school.pincode})` : ''}</span>
        </p>
      )}

      {/* Mobile-Friendly 1-Tap Quick Action Bar */}
      <div className="mt-3 pt-2.5 border-t border-[#2c4436]/60 flex items-center justify-between text-xs gap-2">
        {/* Calling links directly on mobile */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {school.spocContact && (
            <a
              href={`tel:${cleanTel(school.spocContact)}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#21382b] hover:bg-[#2c4436] text-[#7fb298] hover:text-white border border-[#2c4436] text-[11px] font-medium transition-colors"
              title={`Call SPOC: ${school.spocName || 'Incharge'} (${school.spocContact})`}
            >
              <Phone className="w-3 h-3 text-[#7fb298]" />
              <span className="truncate max-w-[100px] sm:max-w-none">SPOC</span>
            </a>
          )}

          {school.driverContact && (
            <a
              href={`tel:${cleanTel(school.driverContact)}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#21382b] hover:bg-[#2c4436] text-[#7c9ee0] hover:text-white border border-[#2c4436] text-[11px] font-medium transition-colors"
              title={`Call Driver: ${school.driverName || 'Driver'} (${school.driverContact})`}
            >
              <Truck className="w-3 h-3 text-[#7c9ee0]" />
              <span className="truncate max-w-[100px] sm:max-w-none">{school.driverName || 'Driver'}</span>
            </a>
          )}
        </div>

        <div className="flex items-center gap-1 text-amber-400 font-semibold text-[11px] shrink-0 group-hover:translate-x-0.5 transition-transform">
          <span>Details</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </div>
      </div>
    </div>
  );
};

