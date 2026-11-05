import React, { useState, useEffect } from 'react';
import { School, RouteConfig, ROUTE_COLOR_PALETTE, DEFAULT_ROUTES } from '../types';
import { 
  X, 
  Save, 
  Plus, 
  MapPin, 
  Building, 
  Route, 
  Phone, 
  Check, 
  Crosshair
} from 'lucide-react';
import { sanitizeInput, logSecurityAudit } from '../utils/security';

interface SchoolFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (school: School) => void;
  schoolToEdit?: School | null;
  existingCount: number;
  routes?: RouteConfig[];
  onAddRoute?: (route: RouteConfig) => void;
  theme?: 'dark' | 'light';
}

export const SchoolFormModal: React.FC<SchoolFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  schoolToEdit,
  existingCount,
  routes = DEFAULT_ROUTES,
  onAddRoute,
  theme = 'light'
}) => {
  const isEditing = Boolean(schoolToEdit);
  const isLight = theme === 'light';

  const [formData, setFormData] = useState<Partial<School>>({
    schoolName: '',
    nodeGroup: '',
    nodeGroupName: '',
    udise: '',
    routeCode: 'RC00001',
    nodeCode: 'NG00001',
    routeName: 'VIJAY NAGAR',
    lat: 26.46,
    lon: 80.30,
    driverName: '',
    driverContact: '',
    routeExecutive: 'Ayush Gupta',
    routeExecutiveContact: '8299485052',
    address: '',
    pincode: '208001',
    spocName: '',
    spocContact: '',
    category: 'Parishadiya'
  });

  // Inline Quick Add Route state
  const [showNewRouteBox, setShowNewRouteBox] = useState(false);
  const [newRouteName, setNewRouteName] = useState('');
  const [newRouteCode, setNewRouteCode] = useState(`RC0000${routes.length + 1}`);
  const [newRouteColor, setNewRouteColor] = useState(
    ROUTE_COLOR_PALETTE[routes.length % ROUTE_COLOR_PALETTE.length]
  );

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);

  useEffect(() => {
    if (schoolToEdit) {
      setFormData(schoolToEdit);
    } else {
      const defaultRoute = routes[0] || DEFAULT_ROUTES[0];
      setFormData({
        id: existingCount + 1,
        schoolName: '',
        nodeGroup: '',
        nodeGroupName: '',
        udise: '',
        routeCode: defaultRoute?.routeCode || 'RC00002',
        nodeCode: `NG00${String(existingCount + 1).padStart(3, '0')}`,
        routeName: defaultRoute?.routeName || 'VIJAY NAGAR',
        lat: 26.4590,
        lon: 80.2950,
        driverName: '',
        driverContact: '',
        routeExecutive: defaultRoute?.routeExecutive || 'Ayush Gupta',
        routeExecutiveContact: defaultRoute?.routeExecutiveContact || '8299485052',
        address: '',
        pincode: '208020',
        spocName: '',
        spocContact: '',
        category: 'Parishadiya'
      });
    }
    setErrors({});
    setGpsStatus(null);
    setShowNewRouteBox(false);
  }, [schoolToEdit, isOpen, existingCount, routes]);

  if (!isOpen) return null;

  const handleChange = (field: keyof School, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleRouteSelect = (selectedRouteName: string) => {
    const matchedRoute = routes.find(
      (r) => r.routeName.toLowerCase() === selectedRouteName.toLowerCase()
    );
    setFormData((prev) => ({
      ...prev,
      routeName: selectedRouteName,
      routeCode: matchedRoute?.routeCode || prev.routeCode || 'RC00001',
      routeExecutive: matchedRoute?.routeExecutive || prev.routeExecutive || 'Ayush Gupta',
      routeExecutiveContact: matchedRoute?.routeExecutiveContact || prev.routeExecutiveContact || '8299485052',
    }));
  };

  const handleCreateQuickRoute = () => {
    const cleanName = sanitizeInput(newRouteName, 90);
    if (!cleanName) return;

    const newRouteObj: RouteConfig = {
      id: `route_${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now().toString(36)}`,
      routeName: cleanName,
      routeCode: sanitizeInput(newRouteCode, 40) || `RC0000${routes.length + 1}`,
      color: newRouteColor,
      routeExecutive: formData.routeExecutive || 'Ayush Gupta',
      routeExecutiveContact: formData.routeExecutiveContact || '8299485052',
      createdAt: new Date().toISOString()
    };

    if (onAddRoute) {
      onAddRoute(newRouteObj);
    }

    setFormData((prev) => ({
      ...prev,
      routeName: newRouteObj.routeName,
      routeCode: newRouteObj.routeCode
    }));
    setNewRouteName('');
    setShowNewRouteBox(false);
  };

  const handleGetCurrentLocation = () => {
    if ('geolocation' in navigator) {
      setGpsStatus('Fetching live GPS coordinates...');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = parseFloat(pos.coords.latitude.toFixed(6));
          const lon = parseFloat(pos.coords.longitude.toFixed(6));
          handleChange('lat', lat);
          handleChange('lon', lon);
          setGpsStatus(`GPS detected: ${lat}, ${lon}`);
        },
        (err) => {
          setGpsStatus(`GPS Error: ${err.message}`);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setGpsStatus('Geolocation not supported by device');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    const cleanName = sanitizeInput(formData.schoolName, 195);
    if (!cleanName) {
      newErrors.schoolName = 'School name is required';
    }

    if (!formData.routeName?.trim()) {
      newErrors.routeName = 'Route name is required';
    }

    const latVal = Number(formData.lat);
    const lonVal = Number(formData.lon);

    if (isNaN(latVal) || latVal === 0) {
      newErrors.lat = 'Valid numeric latitude required';
    }
    if (isNaN(lonVal) || lonVal === 0) {
      newErrors.lon = 'Valid numeric longitude required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const savedSchool: School = {
      id: formData.id || existingCount + 1,
      schoolName: cleanName,
      nodeGroup: sanitizeInput(formData.nodeGroup, 145),
      nodeGroupName: sanitizeInput(formData.nodeGroupName, 195) || cleanName,
      udise: sanitizeInput(formData.udise, 45),
      routeCode: sanitizeInput(formData.routeCode, 45),
      nodeCode: sanitizeInput(formData.nodeCode, 45),
      routeName: sanitizeInput(formData.routeName, 95) || 'VIJAY NAGAR',
      lat: latVal,
      lon: lonVal,
      driverName: sanitizeInput(formData.driverName, 145),
      driverContact: sanitizeInput(formData.driverContact, 35),
      routeExecutive: sanitizeInput(formData.routeExecutive, 145) || 'Ayush Gupta',
      routeExecutiveContact: sanitizeInput(formData.routeExecutiveContact, 35) || '8299485052',
      address: sanitizeInput(formData.address, 340),
      pincode: sanitizeInput(formData.pincode, 18) || '208001',
      spocName: sanitizeInput(formData.spocName, 145),
      spocContact: sanitizeInput(formData.spocContact, 35),
      category: sanitizeInput(formData.category, 95) || 'Parishadiya'
    };

    if (isEditing) {
      logSecurityAudit('EDIT_SCHOOL', `Updated details for ${savedSchool.schoolName} (ID: ${savedSchool.id})`);
    } else {
      logSecurityAudit('ADD_SCHOOL', `Added new school ${savedSchool.schoolName} to ${savedSchool.routeName}`);
    }

    onSave(savedSchool);
    onClose();
  };

  const sectionCardClass = isLight
    ? 'bg-white p-4 rounded-xl border border-slate-200 space-y-3 shadow-2xs'
    : 'bg-[#111f18] p-4 rounded-xl border border-[#2c4436] space-y-3';

  const labelClass = isLight
    ? 'block text-slate-700 mb-1 font-semibold'
    : 'block text-[#a4b3ab] mb-1 font-medium';

  const inputClass = isLight
    ? 'w-full px-3 py-2 bg-white border border-slate-200 focus:border-blue-500 rounded-xl text-slate-900 placeholder-slate-400 outline-hidden text-xs'
    : 'w-full px-3 py-2 bg-[#16271e] border border-[#2c4436] focus:border-[#7fb298] rounded-xl text-[#f2ede0] placeholder-[#6d8076] outline-hidden text-xs';

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center p-2 sm:p-4"
      style={{
        zIndex: 6500,
        backgroundColor: isLight ? 'rgba(15, 23, 42, 0.55)' : 'rgba(7, 14, 10, 0.88)',
        backdropFilter: 'blur(6px)'
      }}
    >
      <div
        className={`relative w-full max-w-2xl border rounded-2xl shadow-2xl max-h-[95dvh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 ${
          isLight
            ? 'bg-[#f8fafc] border-slate-200 text-slate-900'
            : 'bg-[#16271e] border-[#2c4436] text-[#f2ede0]'
        }`}
      >
        {/* Sticky Header */}
        <div
          className={`p-4 sm:p-5 border-b flex items-center justify-between gap-3 shrink-0 ${
            isLight
              ? 'bg-white border-slate-200'
              : 'bg-[#122119] border-[#2c4436]'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl border ${
                isLight
                  ? 'bg-blue-50 text-blue-600 border-blue-200'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              }`}
            >
              {isEditing ? <Save className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            </div>
            <div>
              <span
                className={`text-[11px] font-mono uppercase tracking-wider font-semibold ${
                  isLight ? 'text-blue-600' : 'text-amber-400'
                }`}
              >
                TAPF Route Directory
              </span>
              <h2
                className={`text-base sm:text-lg font-heading font-bold ${
                  isLight ? 'text-slate-900' : 'text-[#f2ede0]'
                }`}
              >
                {isEditing ? `Edit: ${schoolToEdit?.schoolName}` : 'Add New Delivery School'}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${
              isLight
                ? 'text-slate-400 hover:text-slate-800 hover:bg-slate-100'
                : 'text-slate-400 hover:text-white hover:bg-[#21382b]'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs">
          {/* Section 1: School Identity */}
          <div className={sectionCardClass}>
            <div
              className={`flex items-center gap-1.5 text-xs font-mono uppercase font-semibold ${
                isLight ? 'text-blue-600' : 'text-amber-400'
              }`}
            >
              <Building className="w-4 h-4" />
              <span>School Identity & Details</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className={labelClass}>School Name *</label>
                <input
                  type="text"
                  required
                  value={formData.schoolName || ''}
                  onChange={(e) => handleChange('schoolName', e.target.value)}
                  placeholder="e.g. Primary School B S Bhausingh"
                  className={inputClass}
                />
                {errors.schoolName && <p className="text-red-500 text-[10px] mt-1">{errors.schoolName}</p>}
              </div>

              <div>
                <label className={labelClass}>UDISE Code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formData.udise || ''}
                  onChange={(e) => handleChange('udise', e.target.value)}
                  placeholder="e.g. 09342001129"
                  className={`${inputClass} font-mono`}
                />
              </div>

              <div>
                <label className={labelClass}>Category</label>
                <select
                  value={formData.category || 'Parishadiya'}
                  onChange={(e) => handleChange('category', e.target.value)}
                  className={inputClass}
                >
                  <option value="Parishadiya">Parishadiya</option>
                  <option value="Aided Gov.inter college">Aided Gov.inter college</option>
                  <option value="Aided by Basic Education">Aided by Basic Education</option>
                  <option value="Gov.inter college">Gov.inter college</option>
                  <option value="Local Body Inter College">Local Body Inter College</option>
                  <option value="Primary (1-5)">Primary (1-5)</option>
                  <option value="Upper Primary (6-8)">Upper Primary (6-8)</option>
                  <option value="Composite (1-8)">Composite (1-8)</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>Node Group / Cluster</label>
                <input
                  type="text"
                  value={formData.nodeGroup || ''}
                  onChange={(e) => handleChange('nodeGroup', e.target.value)}
                  placeholder="e.g. B S BHAUSINGH (1-8)"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Node Group Name</label>
                <input
                  type="text"
                  value={formData.nodeGroupName || ''}
                  onChange={(e) => handleChange('nodeGroupName', e.target.value)}
                  placeholder="e.g. B S BHAUSINGH (1-5)"
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Route & Codes + Quick Add New Route */}
          <div className={sectionCardClass}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div
                className={`flex items-center gap-1.5 text-xs font-mono uppercase font-semibold ${
                  isLight ? 'text-emerald-600' : 'text-[#7fb298]'
                }`}
              >
                <Route className="w-4 h-4" />
                <span>Route & Delivery Sequence</span>
              </div>

              {onAddRoute && (
                <button
                  type="button"
                  onClick={() => setShowNewRouteBox((prev) => !prev)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-colors ${
                    isLight
                      ? 'bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-200'
                      : 'bg-[#21382b] hover:bg-[#2c4436] text-amber-300 border-[#2c4436]'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{showNewRouteBox ? 'Cancel New Route' : 'Add New Route'}</span>
                </button>
              )}
            </div>

            {/* Inline Quick Create New Route Box */}
            {showNewRouteBox && (
              <div
                className={`p-3.5 rounded-xl border space-y-3 animate-in fade-in duration-150 ${
                  isLight
                    ? 'bg-blue-50/50 border-blue-200'
                    : 'bg-[#162920] border-amber-500/40'
                }`}
              >
                <p
                  className={`text-[11px] font-semibold ${
                    isLight ? 'text-blue-700' : 'text-amber-300'
                  }`}
                >
                  Create New Delivery Route
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className={`block text-[10px] mb-1 ${isLight ? 'text-slate-600' : 'text-[#a4b3ab]'}`}>
                      New Route Name *
                    </label>
                    <input
                      type="text"
                      value={newRouteName}
                      onChange={(e) => setNewRouteName(e.target.value)}
                      placeholder="e.g. KALYANPUR"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={`block text-[10px] mb-1 ${isLight ? 'text-slate-600' : 'text-[#a4b3ab]'}`}>
                      Route Code
                    </label>
                    <input
                      type="text"
                      value={newRouteCode}
                      onChange={(e) => setNewRouteCode(e.target.value)}
                      placeholder="RC00007"
                      className={`${inputClass} font-mono`}
                    />
                  </div>
                  <div>
                    <label className={`block text-[10px] mb-1 ${isLight ? 'text-slate-600' : 'text-[#a4b3ab]'}`}>
                      Marker Color
                    </label>
                    <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                      {ROUTE_COLOR_PALETTE.slice(0, 7).map((hex) => (
                        <button
                          key={hex}
                          type="button"
                          onClick={() => setNewRouteColor(hex)}
                          className={`w-5 h-5 rounded-full transition-transform ${
                            newRouteColor === hex
                              ? isLight
                                ? 'scale-125 ring-2 ring-slate-900'
                                : 'scale-125 ring-2 ring-white'
                              : 'opacity-75 hover:opacity-100'
                          }`}
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleCreateQuickRoute}
                    className={`px-3.5 py-1.5 rounded-lg font-bold text-xs transition-colors ${
                      isLight
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'bg-amber-500 hover:bg-amber-400 text-[#12211a]'
                    }`}
                  >
                    Save & Select Route
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>Assigned Route *</label>
                <select
                  value={formData.routeName || 'VIJAY NAGAR'}
                  onChange={(e) => handleRouteSelect(e.target.value)}
                  className={`${inputClass} font-semibold`}
                >
                  {routes.map((r) => (
                    <option key={r.id || r.routeName} value={r.routeName}>
                      {r.routeName}
                    </option>
                  ))}
                </select>
                {errors.routeName && <p className="text-red-500 text-[10px] mt-1">{errors.routeName}</p>}
              </div>

              <div>
                <label className={labelClass}>Route Code</label>
                <input
                  type="text"
                  value={formData.routeCode || ''}
                  onChange={(e) => handleChange('routeCode', e.target.value)}
                  placeholder="e.g. RC00002"
                  className={`${inputClass} font-mono`}
                />
              </div>

              <div>
                <label className={labelClass}>Node Code (Stop #)</label>
                <input
                  type="text"
                  value={formData.nodeCode || ''}
                  onChange={(e) => handleChange('nodeCode', e.target.value)}
                  placeholder="e.g. NG00029"
                  className={`${inputClass} font-mono`}
                />
              </div>
            </div>
          </div>

          {/* Section 3: GPS Coordinates & Physical Address */}
          <div className={sectionCardClass}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div
                className={`flex items-center gap-1.5 text-xs font-mono uppercase font-semibold ${
                  isLight ? 'text-indigo-600' : 'text-[#7c9ee0]'
                }`}
              >
                <MapPin className="w-4 h-4" />
                <span>GPS Location & Physical Address</span>
              </div>

              <button
                type="button"
                onClick={handleGetCurrentLocation}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors w-fit ${
                  isLight
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                    : 'bg-[#21382b] hover:bg-[#2c4436] text-amber-300 border-[#2c4436]'
                }`}
              >
                <Crosshair className={`w-3.5 h-3.5 ${isLight ? 'text-blue-600' : 'text-amber-400'}`} />
                <span>Grab Live Device GPS</span>
              </button>
            </div>

            {gpsStatus && (
              <div
                className={`p-2 rounded-lg text-[11px] border ${
                  isLight
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-[#16271e] text-[#7fb298] border-[#2c4436]'
                }`}
              >
                {gpsStatus}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Latitude * (e.g. 26.459049)</label>
                <input
                  type="number"
                  step="0.000001"
                  required
                  value={formData.lat ?? ''}
                  onChange={(e) => handleChange('lat', parseFloat(e.target.value))}
                  placeholder="26.459049"
                  className={`${inputClass} font-mono`}
                />
                {errors.lat && <p className="text-red-500 text-[10px] mt-1">{errors.lat}</p>}
              </div>

              <div>
                <label className={labelClass}>Longitude * (e.g. 80.223526)</label>
                <input
                  type="number"
                  step="0.000001"
                  required
                  value={formData.lon ?? ''}
                  onChange={(e) => handleChange('lon', parseFloat(e.target.value))}
                  placeholder="80.223526"
                  className={`${inputClass} font-mono`}
                />
                {errors.lon && <p className="text-red-500 text-[10px] mt-1">{errors.lon}</p>}
              </div>

              <div className="sm:col-span-2">
                <label className={labelClass}>Physical Address</label>
                <input
                  type="text"
                  value={formData.address || ''}
                  onChange={(e) => handleChange('address', e.target.value)}
                  placeholder="e.g. Panki Padav, Near Railway Crossing, Vijay Nagar"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Pincode</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formData.pincode || ''}
                  onChange={(e) => handleChange('pincode', e.target.value)}
                  placeholder="208020"
                  className={`${inputClass} font-mono`}
                />
              </div>
            </div>
          </div>

          {/* Section 4: Direct Contacts */}
          <div className={sectionCardClass}>
            <div
              className={`flex items-center gap-1.5 text-xs font-mono uppercase font-semibold ${
                isLight ? 'text-amber-600' : 'text-amber-300'
              }`}
            >
              <Phone className="w-4 h-4" />
              <span>Contact Directory & Phone Numbers</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>School SPOC / Headmaster Name</label>
                <input
                  type="text"
                  value={formData.spocName || ''}
                  onChange={(e) => handleChange('spocName', e.target.value)}
                  placeholder="e.g. ASHUTOSH DIXIT"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>School SPOC Mobile Number</label>
                <input
                  type="tel"
                  inputMode="tel"
                  value={formData.spocContact || ''}
                  onChange={(e) => handleChange('spocContact', e.target.value)}
                  placeholder="e.g. 7458947775"
                  className={`${inputClass} font-mono`}
                />
              </div>

              <div>
                <label className={labelClass}>Assigned Driver Name</label>
                <input
                  type="text"
                  value={formData.driverName || ''}
                  onChange={(e) => handleChange('driverName', e.target.value)}
                  placeholder="e.g. Rajesh"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Driver Contact Number</label>
                <input
                  type="tel"
                  inputMode="tel"
                  value={formData.driverContact || ''}
                  onChange={(e) => handleChange('driverContact', e.target.value)}
                  placeholder="e.g. 9559796624"
                  className={`${inputClass} font-mono`}
                />
              </div>

              <div>
                <label className={labelClass}>Route Executive Name</label>
                <input
                  type="text"
                  value={formData.routeExecutive || ''}
                  onChange={(e) => handleChange('routeExecutive', e.target.value)}
                  placeholder="e.g. Ayush Gupta"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Route Executive Contact</label>
                <input
                  type="tel"
                  inputMode="tel"
                  value={formData.routeExecutiveContact || ''}
                  onChange={(e) => handleChange('routeExecutiveContact', e.target.value)}
                  placeholder="e.g. 8299485052"
                  className={`${inputClass} font-mono`}
                />
              </div>
            </div>
          </div>

          {/* Sticky Bottom Form Action Bar */}
          <div
            className={`pt-3 pb-1 border-t flex items-center justify-between sticky bottom-0 -mx-4 sm:-mx-6 px-4 sm:px-6 ${
              isLight
                ? 'bg-[#f8fafc] border-slate-200'
                : 'bg-[#16271e] border-[#2c4436]'
            }`}
          >
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 text-xs font-semibold transition-colors ${
                isLight
                  ? 'text-slate-500 hover:text-slate-900'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Cancel
            </button>

            <button
              type="submit"
              className={`inline-flex items-center gap-2 px-6 py-2.5 font-bold text-xs rounded-xl shadow-lg transition-all active:scale-95 ${
                isLight
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20'
                  : 'bg-amber-500 hover:bg-amber-400 text-[#12211a] shadow-amber-500/20'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>{isEditing ? 'Save School Changes' : 'Add to Delivery Route'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

