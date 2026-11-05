import React from 'react';
import { School, getRouteColor } from '../types';
import { X, Navigation, Phone, MapPin, Building, Route, Edit3, ExternalLink } from 'lucide-react';

interface SchoolDrawerProps {
  school: School | null;
  onClose: () => void;
  onEdit?: (school: School) => void;
  theme?: 'dark' | 'light';
}

export const SchoolDrawer: React.FC<SchoolDrawerProps> = ({
  school,
  onClose,
  onEdit,
  theme = 'light',
}) => {
  if (!school) return null;

  const isLight = theme === 'light';
  const routeColor = getRouteColor(school.routeName);
  const gmapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${school.lat},${school.lon}`;

  // Safe phone link sanitizer
  const getCleanTel = (contact: string) => {
    return contact.replace(/[^0-9+]/g, '');
  };

  return (
    <>
      {/* Backdrop overlay */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
        style={{ zIndex: 5100 }}
      />

      {/* Drawer Container: Mobile = Bottom Sheet (max 85dvh), Desktop = Right Side Panel (w-[440px] h-full) */}
      <div
        className={`fixed bottom-0 left-0 right-0 md:top-0 md:left-auto md:w-[440px] max-h-[85dvh] md:max-h-full h-auto md:h-full border-t md:border-t-0 md:border-l rounded-t-3xl md:rounded-none shadow-2xl flex flex-col z-[5200] overflow-hidden animate-in slide-in-from-bottom md:slide-in-from-right duration-200 ${
          isLight
            ? 'bg-white border-slate-200 text-slate-900'
            : 'bg-[#1a2e24] border-[#2c4436] text-[#f2ede0]'
        }`}
        style={{ zIndex: 5200 }}
      >
        {/* Mobile handle indicator */}
        <div
          className={`w-12 h-1.5 rounded-full mx-auto my-2 md:hidden ${
            isLight ? 'bg-slate-300' : 'bg-[#2c4436]'
          }`}
        />

        {/* Drawer Header */}
        <div
          className={`p-4 sm:p-5 border-b flex items-start justify-between gap-3 shrink-0 ${
            isLight
              ? 'border-slate-200 bg-slate-50/80'
              : 'border-[#2c4436] bg-[#15251d]'
          }`}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold"
                style={{
                  backgroundColor: `${routeColor}20`,
                  color: routeColor,
                  borderColor: `${routeColor}4d`,
                  borderWidth: '1px',
                }}
              >
                <span
                  className="w-2 h-2 rounded-full inline-block"
                  style={{ backgroundColor: routeColor }}
                />
                {school.routeName || 'Route N/A'}
              </span>

              {school.nodeCode && (
                <span
                  className={`font-mono-code text-xs px-2 py-0.5 rounded border ${
                    isLight
                      ? 'bg-white text-slate-700 border-slate-200'
                      : 'bg-[#12211a] text-[#7fb298] border-[#2c4436]'
                  }`}
                >
                  {school.nodeCode}
                </span>
              )}
            </div>
            <h2
              className={`text-lg sm:text-xl font-heading font-bold leading-snug ${
                isLight ? 'text-slate-900' : 'text-[#f2ede0]'
              }`}
            >
              {school.schoolName}
            </h2>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {onEdit && (
              <button
                onClick={() => onEdit(school)}
                className={`p-1.5 rounded-xl transition-colors ${
                  isLight
                    ? 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200'
                    : 'bg-[#21382b] text-[#e8a33d] hover:bg-[#2c4436]'
                }`}
                title="Edit this school"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className={`p-1.5 rounded-xl transition-colors ${
                isLight
                  ? 'bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200'
                  : 'bg-[#21382b] text-slate-400 hover:text-white hover:bg-[#2c4436]'
              }`}
              title="Close Drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action Buttons Bar */}
        <div
          className={`p-4 border-b grid grid-cols-3 gap-2 shrink-0 ${
            isLight
              ? 'bg-white border-slate-200'
              : 'bg-[#12211a] border-[#2c4436]'
          }`}
        >
          {/* Directions */}
          <a
            href={gmapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex flex-col items-center justify-center p-2.5 rounded-xl font-semibold text-xs shadow-sm transition-all active:scale-95 text-center ${
              isLight
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-[#e8a33d] hover:bg-[#d6932e] text-[#12211a]'
            }`}
          >
            <Navigation className="w-4 h-4 mb-1" />
            <span>Directions</span>
          </a>

          {/* Call School (SPOC number) */}
          {school.spocContact ? (
            <a
              href={`tel:${getCleanTel(school.spocContact)}`}
              className={`flex flex-col items-center justify-center p-2.5 rounded-xl font-semibold text-xs border transition-all active:scale-95 text-center ${
                isLight
                  ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                  : 'bg-[#21382b] hover:bg-[#2c4436] text-[#7fb298] border-[#2c4436]'
              }`}
            >
              <Phone className="w-4 h-4 mb-1" />
              <span>Call School</span>
            </a>
          ) : (
            <div
              className={`flex flex-col items-center justify-center p-2.5 rounded-xl text-xs border text-center cursor-not-allowed ${
                isLight
                  ? 'bg-slate-50 text-slate-400 border-slate-200'
                  : 'bg-[#1a2e24] text-slate-500 border-[#2c4436]/50'
              }`}
            >
              <Phone className="w-4 h-4 mb-1 opacity-50" />
              <span>No School #</span>
            </div>
          )}

          {/* Call Driver */}
          {school.driverContact ? (
            <a
              href={`tel:${getCleanTel(school.driverContact)}`}
              className={`flex flex-col items-center justify-center p-2.5 rounded-xl font-semibold text-xs border transition-all active:scale-95 text-center ${
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                  : 'bg-[#21382b] hover:bg-[#2c4436] text-[#7c9ee0] border-[#2c4436]'
              }`}
            >
              <Phone className="w-4 h-4 mb-1" />
              <span>Call Driver</span>
            </a>
          ) : (
            <div
              className={`flex flex-col items-center justify-center p-2.5 rounded-xl text-xs border text-center cursor-not-allowed ${
                isLight
                  ? 'bg-slate-50 text-slate-400 border-slate-200'
                  : 'bg-[#1a2e24] text-slate-500 border-[#2c4436]/50'
              }`}
            >
              <Phone className="w-4 h-4 mb-1 opacity-50" />
              <span>No Driver #</span>
            </div>
          )}
        </div>

        {/* Scrollable details */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5 text-sm">
          {/* Section 1: School Information */}
          <div className="space-y-2.5">
            <div
              className={`flex items-center gap-2 text-xs font-mono uppercase tracking-wider font-semibold ${
                isLight ? 'text-blue-600' : 'text-[#e8a33d]'
              }`}
            >
              <Building className="w-4 h-4" />
              <span>School Information</span>
            </div>

            <div
              className={`rounded-xl p-3.5 border space-y-2 text-xs ${
                isLight
                  ? 'bg-slate-50 border-slate-200'
                  : 'bg-[#12211a] border-[#2c4436]'
              }`}
            >
              <div
                className={`flex items-center justify-between py-1 border-b ${
                  isLight ? 'border-slate-200' : 'border-[#2c4436]/50'
                }`}
              >
                <span className={isLight ? 'text-slate-500' : 'text-[#a4b3ab]'}>UDISE Code</span>
                <span className={`font-mono-code font-medium ${isLight ? 'text-slate-900' : 'text-[#f2ede0]'}`}>
                  {school.udise || '—'}
                </span>
              </div>
              <div
                className={`flex items-center justify-between py-1 border-b ${
                  isLight ? 'border-slate-200' : 'border-[#2c4436]/50'
                }`}
              >
                <span className={isLight ? 'text-slate-500' : 'text-[#a4b3ab]'}>Category</span>
                <span className={`font-medium ${isLight ? 'text-emerald-700' : 'text-[#7fb298]'}`}>
                  {school.category || '—'}
                </span>
              </div>
              <div
                className={`flex items-center justify-between py-1 border-b ${
                  isLight ? 'border-slate-200' : 'border-[#2c4436]/50'
                }`}
              >
                <span className={isLight ? 'text-slate-500' : 'text-[#a4b3ab]'}>Node Group</span>
                <span className={`font-medium ${isLight ? 'text-slate-900' : 'text-[#f2ede0]'}`}>
                  {school.nodeGroup || '—'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className={isLight ? 'text-slate-500' : 'text-[#a4b3ab]'}>Cluster / Node Group Name</span>
                <span
                  className={`font-medium text-right truncate max-w-[200px] ${
                    isLight ? 'text-slate-900' : 'text-[#f2ede0]'
                  }`}
                >
                  {school.nodeGroupName || '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Route & Node */}
          <div className="space-y-2.5">
            <div
              className={`flex items-center gap-2 text-xs font-mono uppercase tracking-wider font-semibold ${
                isLight ? 'text-emerald-600' : 'text-[#7fb298]'
              }`}
            >
              <Route className="w-4 h-4" />
              <span>Delivery Route Details</span>
            </div>

            <div
              className={`rounded-xl p-3.5 border space-y-2 text-xs ${
                isLight
                  ? 'bg-slate-50 border-slate-200'
                  : 'bg-[#12211a] border-[#2c4436]'
              }`}
            >
              <div
                className={`flex items-center justify-between py-1 border-b ${
                  isLight ? 'border-slate-200' : 'border-[#2c4436]/50'
                }`}
              >
                <span className={isLight ? 'text-slate-500' : 'text-[#a4b3ab]'}>Route Name</span>
                <span className="font-bold" style={{ color: routeColor }}>
                  {school.routeName || '—'}
                </span>
              </div>
              <div
                className={`flex items-center justify-between py-1 border-b ${
                  isLight ? 'border-slate-200' : 'border-[#2c4436]/50'
                }`}
              >
                <span className={isLight ? 'text-slate-500' : 'text-[#a4b3ab]'}>Route Code</span>
                <span className={`font-mono-code ${isLight ? 'text-slate-900' : 'text-[#f2ede0]'}`}>
                  {school.routeCode || '—'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className={isLight ? 'text-slate-500' : 'text-[#a4b3ab]'}>Node Code</span>
                <span className={`font-mono-code font-semibold ${isLight ? 'text-emerald-700' : 'text-[#7fb298]'}`}>
                  {school.nodeCode || '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Section 3: Address & Coordinates */}
          <div className="space-y-2.5">
            <div
              className={`flex items-center gap-2 text-xs font-mono uppercase tracking-wider font-semibold ${
                isLight ? 'text-indigo-600' : 'text-[#7c9ee0]'
              }`}
            >
              <MapPin className="w-4 h-4" />
              <span>Location & Address</span>
            </div>

            <div
              className={`rounded-xl p-3.5 border space-y-2.5 text-xs ${
                isLight
                  ? 'bg-slate-50 border-slate-200'
                  : 'bg-[#12211a] border-[#2c4436]'
              }`}
            >
              <div>
                <span className={`text-[11px] block mb-0.5 ${isLight ? 'text-slate-500' : 'text-[#a4b3ab]'}`}>
                  Physical Address:
                </span>
                <p className={`leading-relaxed ${isLight ? 'text-slate-900 font-medium' : 'text-[#f2ede0]'}`}>
                  {school.address || 'Address not listed'}
                </p>
              </div>

              <div
                className={`flex items-center justify-between pt-2 border-t ${
                  isLight ? 'border-slate-200' : 'border-[#2c4436]/50'
                }`}
              >
                <span className={isLight ? 'text-slate-500' : 'text-[#a4b3ab]'}>Pincode</span>
                <span className={`font-mono-code ${isLight ? 'text-slate-900' : 'text-[#f2ede0]'}`}>
                  {school.pincode || '208001'}
                </span>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className={isLight ? 'text-slate-500' : 'text-[#a4b3ab]'}>Coordinates (Lat, Lon)</span>
                <a
                  href={gmapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`font-mono-code text-[11px] hover:underline flex items-center gap-1 ${
                    isLight ? 'text-blue-600 font-semibold' : 'text-[#e8a33d]'
                  }`}
                >
                  {school.lat.toFixed(6)}, {school.lon.toFixed(6)}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>

          {/* Section 4: Key Contacts */}
          <div className="space-y-2.5">
            <div
              className={`flex items-center gap-2 text-xs font-mono uppercase tracking-wider font-semibold ${
                isLight ? 'text-amber-600' : 'text-amber-300'
              }`}
            >
              <Phone className="w-4 h-4" />
              <span>Contact Directory</span>
            </div>

            <div className="space-y-2">
              {/* School SPOC */}
              <div
                className={`rounded-xl p-3 border flex items-center justify-between ${
                  isLight
                    ? 'bg-slate-50 border-slate-200'
                    : 'bg-[#12211a] border-[#2c4436]'
                }`}
              >
                <div>
                  <span
                    className={`text-[10px] uppercase font-mono tracking-wider font-semibold block ${
                      isLight ? 'text-emerald-700' : 'text-[#7fb298]'
                    }`}
                  >
                    School SPOC / Principal
                  </span>
                  <p className={`font-semibold text-xs mt-0.5 ${isLight ? 'text-slate-900' : 'text-[#f2ede0]'}`}>
                    {school.spocName || 'Headmaster / Incharge'}
                  </p>
                  <p className={`font-mono-code text-[11px] mt-0.5 ${isLight ? 'text-slate-500' : 'text-[#a4b3ab]'}`}>
                    {school.spocContact || 'No phone registered'}
                  </p>
                </div>
                {school.spocContact && (
                  <a
                    href={`tel:${getCleanTel(school.spocContact)}`}
                    className={`p-2 rounded-xl transition-all border ${
                      isLight
                        ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border-emerald-200'
                        : 'bg-[#21382b] text-[#7fb298] hover:bg-[#7fb298] hover:text-[#12211a] border-[#2c4436]'
                    }`}
                    title="Call School SPOC"
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                )}
              </div>

              {/* Delivery Driver */}
              <div
                className={`rounded-xl p-3 border flex items-center justify-between ${
                  isLight
                    ? 'bg-slate-50 border-slate-200'
                    : 'bg-[#12211a] border-[#2c4436]'
                }`}
              >
                <div>
                  <span
                    className={`text-[10px] uppercase font-mono tracking-wider font-semibold block ${
                      isLight ? 'text-blue-700' : 'text-[#7c9ee0]'
                    }`}
                  >
                    Meal Delivery Driver
                  </span>
                  <p className={`font-semibold text-xs mt-0.5 ${isLight ? 'text-slate-900' : 'text-[#f2ede0]'}`}>
                    {school.driverName || 'Designated Kitchen Driver'}
                  </p>
                  <p className={`font-mono-code text-[11px] mt-0.5 ${isLight ? 'text-slate-500' : 'text-[#a4b3ab]'}`}>
                    {school.driverContact || 'No driver contact'}
                  </p>
                </div>
                {school.driverContact && (
                  <a
                    href={`tel:${getCleanTel(school.driverContact)}`}
                    className={`p-2 rounded-xl transition-all border ${
                      isLight
                        ? 'bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white border-blue-200'
                        : 'bg-[#21382b] text-[#7c9ee0] hover:bg-[#7c9ee0] hover:text-[#12211a] border-[#2c4436]'
                    }`}
                    title="Call Driver"
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                )}
              </div>

              {/* Route Executive */}
              <div
                className={`rounded-xl p-3 border flex items-center justify-between ${
                  isLight
                    ? 'bg-slate-50 border-slate-200'
                    : 'bg-[#12211a] border-[#2c4436]'
                }`}
              >
                <div>
                  <span
                    className={`text-[10px] uppercase font-mono tracking-wider font-semibold block ${
                      isLight ? 'text-purple-700' : 'text-[#c99be0]'
                    }`}
                  >
                    Route Executive / Supervisor
                  </span>
                  <p className={`font-semibold text-xs mt-0.5 ${isLight ? 'text-slate-900' : 'text-[#f2ede0]'}`}>
                    {school.routeExecutive || 'Area Operations Lead'}
                  </p>
                  <p className={`font-mono-code text-[11px] mt-0.5 ${isLight ? 'text-slate-500' : 'text-[#a4b3ab]'}`}>
                    {school.routeExecutiveContact || 'Contact Kitchen'}
                  </p>
                </div>
                {school.routeExecutiveContact && (
                  <a
                    href={`tel:${getCleanTel(school.routeExecutiveContact)}`}
                    className={`p-2 rounded-xl transition-all border ${
                      isLight
                        ? 'bg-purple-50 text-purple-700 hover:bg-purple-600 hover:text-white border-purple-200'
                        : 'bg-[#21382b] text-[#c99be0] hover:bg-[#c99be0] hover:text-[#12211a] border-[#2c4436]'
                    }`}
                    title="Call Route Executive"
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

