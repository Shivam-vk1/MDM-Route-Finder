import React, { useState, useMemo, useEffect } from 'react';
import { 
  School, 
  RouteConfig, 
  StaffMember, 
  ROUTE_COLOR_PALETTE, 
  TAPF_LOGO_URL,
  getRouteColor 
} from '../types';
import { 
  X, 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  FileSpreadsheet, 
  RotateCcw, 
  ShieldCheck,
  LogOut,
  History,
  Layers,
  CheckCircle2,
  Users,
  Route as RouteIcon,
  Key,
  Mail,
  UserPlus,
  Copy,
  Check,
  Eye,
  EyeOff,
  Sun,
  Moon
} from 'lucide-react';
import { 
  logoutAdmin, 
  fetchCloudAuditLogs, 
  logSecurityAudit, 
  AuditLogEntry,
  hashStaffPassword,
  sanitizeInput
} from '../utils/security';
import { User } from '../firebase';

interface AdminPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  schools: School[];
  routes: RouteConfig[];
  staffMembers: StaffMember[];
  onAddSchoolClick: () => void;
  onEditSchoolClick: (school: School) => void;
  onDeleteSchool: (schoolId: number) => void;
  onResetToDefault: () => void;
  onSaveRoute: (route: RouteConfig) => void;
  onDeleteRoute: (routeId: string) => void;
  onSaveStaffMember: (member: StaffMember) => void;
  onDeleteStaffMember: (memberId: string) => void;
  currentUser: User | null;
  activeStaff: StaffMember | null;
  isSuperAdmin: boolean;
  initialTab?: 'schools' | 'routes' | 'staff' | 'audit';
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
}

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({
  isOpen,
  onClose,
  schools,
  routes,
  staffMembers,
  onAddSchoolClick,
  onEditSchoolClick,
  onDeleteSchool,
  onResetToDefault,
  onSaveRoute,
  onDeleteRoute,
  onSaveStaffMember,
  onDeleteStaffMember,
  currentUser,
  activeStaff,
  isSuperAdmin,
  initialTab = 'schools',
  theme = 'light',
  onToggleTheme
}) => {
  const isLight = theme === 'light';

  const [activeTab, setActiveTab] = useState<'schools' | 'routes' | 'staff' | 'audit'>(initialTab);
  const [adminSearch, setAdminSearch] = useState('');
  const [adminRouteFilter, setAdminRouteFilter] = useState('ALL');
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  // Route Management Form State
  const [editingRoute, setEditingRoute] = useState<RouteConfig | null>(null);
  const [routeNameInput, setRouteNameInput] = useState('');
  const [routeCodeInput, setRouteCodeInput] = useState('');
  const [routeColorInput, setRouteColorInput] = useState(ROUTE_COLOR_PALETTE[0]);
  const [routeExecInput, setRouteExecInput] = useState('Ayush Gupta');
  const [routeExecPhoneInput, setRouteExecPhoneInput] = useState('8299485052');
  const [routeFormError, setRouteFormError] = useState<string | null>(null);
  const [confirmDeleteRouteId, setConfirmDeleteRouteId] = useState<string | null>(null);

  // TAPF Staff Management Form State (Super Admin Only)
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [staffNameInput, setStaffNameInput] = useState('');
  const [staffLoginIdInput, setStaffLoginIdInput] = useState('');
  const [staffPasswordInput, setStaffPasswordInput] = useState('');
  const [showStaffPass, setShowStaffPass] = useState(false);
  const [staffRoleInput, setStaffRoleInput] = useState('TAPF Route Coordinator');
  const [staffCanEdit, setStaffCanEdit] = useState(true);
  const [staffActive, setStaffActive] = useState(true);
  const [staffFormError, setStaffFormError] = useState<string | null>(null);
  const [copiedStaffId, setCopiedStaffId] = useState<string | null>(null);
  const [confirmDeleteStaffId, setConfirmDeleteStaffId] = useState<string | null>(null);

  // Security Audit Logs
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (isOpen) {
      fetchCloudAuditLogs()
        .then(setLogs)
        .catch((err) => console.warn('Audit log load error:', err));
    }
  }, [isOpen, activeTab]);

  // Filter schools for admin list (MUST be called before early return to obey React Rules of Hooks)
  const filteredSchools = useMemo(() => {
    const q = adminSearch.trim().toLowerCase();
    return schools.filter((s) => {
      if (adminRouteFilter !== 'ALL' && s.routeName?.toLowerCase() !== adminRouteFilter.toLowerCase()) {
        return false;
      }
      if (q) {
        const pool = [
          s.schoolName,
          s.udise,
          s.nodeCode,
          s.routeName,
          s.spocName,
          s.driverName,
          s.address
        ].filter(Boolean).join(' ').toLowerCase();
        if (!pool.includes(q)) return false;
      }
      return true;
    });
  }, [schools, adminSearch, adminRouteFilter]);

  if (!isOpen) return null;

  // Reset Route Form
  const resetRouteForm = () => {
    setEditingRoute(null);
    setRouteNameInput('');
    setRouteCodeInput(`RC0000${routes.length + 1}`);
    setRouteColorInput(ROUTE_COLOR_PALETTE[routes.length % ROUTE_COLOR_PALETTE.length]);
    setRouteExecInput('Ayush Gupta');
    setRouteExecPhoneInput('8299485052');
    setRouteFormError(null);
  };

  const handleStartEditRoute = (r: RouteConfig) => {
    setEditingRoute(r);
    setRouteNameInput(r.routeName);
    setRouteCodeInput(r.routeCode || '');
    setRouteColorInput(r.color || ROUTE_COLOR_PALETTE[0]);
    setRouteExecInput(r.routeExecutive || 'Ayush Gupta');
    setRouteExecPhoneInput(r.routeExecutiveContact || '8299485052');
    setRouteFormError(null);
  };

  const handleRouteFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = sanitizeInput(routeNameInput, 90);
    if (!cleanName) {
      setRouteFormError('Route name is required.');
      return;
    }

    const duplicate = routes.find(
      (r) =>
        r.routeName.toLowerCase() === cleanName.toLowerCase() &&
        (!editingRoute || r.id !== editingRoute.id)
    );
    if (duplicate) {
      setRouteFormError(`Route "${cleanName}" already exists.`);
      return;
    }

    const savedRoute: RouteConfig = {
      id:
        editingRoute?.id ||
        `route_${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now().toString(36)}`,
      routeName: cleanName,
      routeCode: sanitizeInput(routeCodeInput, 40) || `RC0000${routes.length + 1}`,
      color: routeColorInput || '#e8a33d',
      routeExecutive: sanitizeInput(routeExecInput, 140) || 'Ayush Gupta',
      routeExecutiveContact: sanitizeInput(routeExecPhoneInput, 35) || '8299485052',
      createdAt: editingRoute?.createdAt || new Date().toISOString()
    };

    onSaveRoute(savedRoute);
    resetRouteForm();
  };

  // Reset Staff Form
  const resetStaffForm = () => {
    setEditingStaff(null);
    setStaffNameInput('');
    setStaffLoginIdInput('');
    setStaffPasswordInput('');
    setStaffRoleInput('TAPF Route Coordinator');
    setStaffCanEdit(true);
    setStaffActive(true);
    setStaffFormError(null);
  };

  const handleStartEditStaff = (member: StaffMember) => {
    setEditingStaff(member);
    setStaffNameInput(member.name);
    setStaffLoginIdInput(member.loginId);
    setStaffPasswordInput(member.passwordHint || '');
    setStaffRoleInput(member.role || 'TAPF Route Coordinator');
    setStaffCanEdit(member.canEdit);
    setStaffActive(member.active);
    setStaffFormError(null);
  };

  const handleStaffFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffFormError(null);

    const cleanName = sanitizeInput(staffNameInput, 140);
    const cleanLogin = sanitizeInput(staffLoginIdInput, 140).toLowerCase();
    const cleanRole = sanitizeInput(staffRoleInput, 90) || 'TAPF Member';
    const rawPass = staffPasswordInput.trim();

    if (!cleanName || !cleanLogin) {
      setStaffFormError('Member Name and Login ID / Email are required.');
      return;
    }

    if (!editingStaff && rawPass.length < 4) {
      setStaffFormError('Please set a password of at least 4 characters for the new member.');
      return;
    }

    const duplicate = staffMembers.find(
      (m) =>
        m.loginId.toLowerCase() === cleanLogin &&
        (!editingStaff || m.id !== editingStaff.id)
    );
    if (duplicate) {
      setStaffFormError(`Login ID "${cleanLogin}" is already assigned to ${duplicate.name}.`);
      return;
    }

    let finalHash = editingStaff?.passwordHash || '';
    let finalHint = editingStaff?.passwordHint || '';

    if (rawPass.length > 0) {
      finalHash = await hashStaffPassword(rawPass);
      finalHint = sanitizeInput(rawPass, 140);
    }

    const savedMember: StaffMember = {
      id: editingStaff?.id || `staff_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: cleanName,
      loginId: cleanLogin,
      passwordHash: finalHash,
      passwordHint: finalHint,
      role: cleanRole,
      canEdit: staffCanEdit,
      active: staffActive,
      createdAt: editingStaff?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    onSaveStaffMember(savedMember);
    resetStaffForm();
  };

  const handleCopyStaffCredentials = (member: StaffMember) => {
    const text = `TAPF Kanpur Route Portal Login:\nLogin ID: ${member.loginId}\nPassword: ${member.passwordHint || '(Contact Admin)'}`;
    navigator.clipboard?.writeText(text);
    setCopiedStaffId(member.id);
    setTimeout(() => {
      setCopiedStaffId((prev) => (prev === member.id ? null : prev));
    }, 2500);
  };

  // Export as CSV
  const handleExportCSV = () => {
    const headers = [
      'NODE_GROUP',
      'NODE  GROUP NAME',
      'SCHOOL_NAME',
      'UDISE-CODE',
      'ROUTE CODE',
      'NODE CODE',
      'ROUTE NAME',
      'latitude',
      'longitude',
      'Driver Name',
      'Contact number',
      'Route Executive Name',
      'Contact Number',
      'Address',
      'Pincode',
      'School SPOC name',
      'School SPOC number',
      'School Category'
    ];

    const escapeCsv = (val: any) => {
      const str = String(val ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvRows = [
      headers.join(','),
      ...schools.map(s => [
        escapeCsv(s.nodeGroup),
        escapeCsv(s.nodeGroupName),
        escapeCsv(s.schoolName),
        escapeCsv(s.udise),
        escapeCsv(s.routeCode),
        escapeCsv(s.nodeCode),
        escapeCsv(s.routeName),
        s.lat,
        s.lon,
        escapeCsv(s.driverName),
        escapeCsv(s.driverContact),
        escapeCsv(s.routeExecutive),
        escapeCsv(s.routeExecutiveContact),
        escapeCsv(s.address),
        escapeCsv(s.pincode),
        escapeCsv(s.spocName),
        escapeCsv(s.spocContact),
        escapeCsv(s.category)
      ].join(','))
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `OS1_detail_updated_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    logSecurityAudit('IMPORT_DATA', `Exported full CSV database backup (${schools.length} schools)`);
  };

  const handleLogout = async () => {
    await logoutAdmin();
    onClose();
  };

  const inputBaseClass = isLight
    ? 'bg-white border-slate-200 focus:border-blue-500 text-slate-900 placeholder-slate-400'
    : 'bg-[#16271e] border-[#2c4436] focus:border-amber-400 text-[#f2ede0] placeholder-[#6d8076]';

  const cardBaseClass = isLight
    ? 'bg-white border-slate-200 shadow-2xs'
    : 'bg-[#111f18] border-[#2c4436]';

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center p-0 sm:p-4"
      style={{
        zIndex: 6000,
        backgroundColor: isLight ? 'rgba(15, 23, 42, 0.55)' : 'rgba(7, 14, 10, 0.92)',
        backdropFilter: 'blur(8px)'
      }}
    >
      <div
        className={`relative w-full max-w-5xl border-0 sm:border rounded-none sm:rounded-2xl shadow-2xl h-dvh sm:h-auto sm:max-h-[94dvh] flex flex-col overflow-hidden transition-colors ${
          isLight
            ? 'bg-[#f8fafc] border-slate-200 text-slate-900'
            : 'bg-[#16271e] border-[#2c4436] text-[#f2ede0]'
        }`}
      >
        {/* Top Header */}
        <div
          className={`p-3 sm:p-5 border-b flex flex-col gap-2.5 shrink-0 ${
            isLight
              ? 'bg-white border-slate-200'
              : 'bg-[#122119] border-[#2c4436]'
          }`}
        >
          {/* Row 1: Brand Title + Theme Switcher & Close (X) */}
          <div className="flex items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <img
                src={TAPF_LOGO_URL}
                alt="The Akshaya Patra Foundation"
                className={`h-8 sm:h-10 w-auto max-w-[95px] sm:max-w-[140px] rounded-lg sm:rounded-xl object-contain bg-white px-1.5 sm:px-2 py-0.5 sm:py-1 shrink-0 shadow-2xs border ${
                  isLight ? 'border-slate-200' : 'border-amber-500/40'
                }`}
                referrerPolicy="no-referrer"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h2
                    className={`text-sm sm:text-lg font-heading font-bold truncate leading-tight ${
                      isLight ? 'text-slate-900' : 'text-[#f2ede0]'
                    }`}
                  >
                    TAPF Admin Console
                  </h2>
                  <span
                    className={`text-[11px] sm:text-xs font-mono font-semibold ${
                      isLight ? 'text-blue-600' : 'text-amber-400'
                    }`}
                  >
                    · {schools.length} Schools · {routes.length} Routes
                  </span>
                </div>
                <p
                  className={`text-[11px] flex items-center gap-1 mt-0.5 font-medium truncate ${
                    isLight ? 'text-emerald-700' : 'text-[#7fb298]'
                  }`}
                >
                  <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`} />
                  {isSuperAdmin ? (
                    <span className="truncate">
                      Super Admin ({currentUser?.displayName || 'Main Admin'})
                    </span>
                  ) : (
                    <span className="truncate">
                      Staff:{' '}
                      <strong className={isLight ? 'text-slate-900' : 'text-[#f2ede0]'}>
                        {activeStaff?.name}
                      </strong>
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Right Top Controls: Theme Switcher + Close Button */}
            <div className="flex items-center gap-1.5 shrink-0">
              {onToggleTheme && (
                <button
                  type="button"
                  onClick={onToggleTheme}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                    isLight
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                      : 'bg-[#21382b] hover:bg-[#2c4436] text-amber-300 border-[#2c4436]'
                  }`}
                  title={isLight ? 'Switch to Dark Theme' : 'Switch to Light Theme'}
                >
                  {isLight ? (
                    <>
                      <Moon className="w-3.5 h-3.5 text-slate-700" />
                      <span className="hidden sm:inline">Dark</span>
                    </>
                  ) : (
                    <>
                      <Sun className="w-3.5 h-3.5 text-amber-400" />
                      <span className="hidden sm:inline">Light</span>
                    </>
                  )}
                </button>
              )}

              <button
                onClick={onClose}
                className={`p-1.5 rounded-xl border transition-colors ${
                  isLight
                    ? 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                    : 'bg-[#21382b] border-[#2c4436] text-slate-300 hover:text-white hover:bg-[#2c4436]'
                }`}
                title="Close Admin Console"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Row 2: Quick Action Toolbar (Responsive on Mobile & Desktop) */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <button
              onClick={onAddSchoolClick}
              className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-xl font-bold text-xs shadow-xs transition-all active:scale-95 ${
                isLight
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-amber-500 hover:bg-amber-400 text-[#12211a]'
              }`}
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>Add School</span>
            </button>

            <button
              onClick={() => {
                resetRouteForm();
                setActiveTab('routes');
              }}
              className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                isLight
                  ? 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                  : 'bg-[#21382b] hover:bg-[#2c4436] text-amber-300 border-[#2c4436]'
              }`}
            >
              <RouteIcon className="w-3.5 h-3.5 shrink-0" />
              <span>+ Route</span>
            </button>

            <button
              onClick={handleExportCSV}
              className={`inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-2 sm:py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                isLight
                  ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                  : 'bg-[#21382b] hover:bg-[#2c4436] text-[#7fb298] border-[#2c4436]'
              }`}
              title="Export complete 18-column CSV"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
              <span>CSV</span>
            </button>

            <button
              onClick={handleLogout}
              className={`inline-flex items-center justify-center gap-1 px-2.5 sm:px-3 py-2 sm:py-1.5 rounded-xl border text-xs font-semibold transition-colors sm:ml-auto ${
                isLight
                  ? 'bg-red-50 hover:bg-red-100 text-red-600 border-red-200'
                  : 'bg-red-950/40 hover:bg-red-900/60 text-red-300 border-red-800/60'
              }`}
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs — 2x2 Grid on Mobile (All Tabs 100% Visible Without Scrolling), Row on Desktop */}
        <div
          className={`px-3 sm:px-4 py-2 border-b grid ${
            isSuperAdmin ? 'grid-cols-2' : 'grid-cols-3'
          } sm:flex sm:items-center gap-1.5 sm:gap-2 text-xs shrink-0 ${
            isLight
              ? 'bg-white border-slate-200'
              : 'bg-[#111f18] border-[#2c4436]'
          }`}
        >
          <button
            onClick={() => setActiveTab('schools')}
            className={`px-2.5 sm:px-3.5 py-2 sm:py-1.5 rounded-xl font-semibold transition-colors flex items-center justify-center sm:justify-start gap-1.5 ${
              activeTab === 'schools'
                ? isLight
                  ? 'bg-[#0f172a] text-white shadow-xs'
                  : 'bg-[#21382b] text-amber-300 border border-[#2c4436]'
                : isLight
                  ? 'bg-slate-100/80 sm:bg-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  : 'bg-[#16271e] sm:bg-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Schools ({schools.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('routes')}
            className={`px-2.5 sm:px-3.5 py-2 sm:py-1.5 rounded-xl font-semibold transition-colors flex items-center justify-center sm:justify-start gap-1.5 ${
              activeTab === 'routes'
                ? isLight
                  ? 'bg-[#0f172a] text-white shadow-xs'
                  : 'bg-[#21382b] text-amber-300 border border-[#2c4436]'
                : isLight
                  ? 'bg-slate-100/80 sm:bg-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  : 'bg-[#16271e] sm:bg-transparent text-slate-400 hover:text-white'
            }`}
          >
            <RouteIcon className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Routes ({routes.length})</span>
          </button>

          {isSuperAdmin && (
            <button
              onClick={() => setActiveTab('staff')}
              className={`px-2.5 sm:px-3.5 py-2 sm:py-1.5 rounded-xl font-semibold transition-colors flex items-center justify-center sm:justify-start gap-1.5 ${
                activeTab === 'staff'
                  ? isLight
                    ? 'bg-[#0f172a] text-white shadow-xs'
                    : 'bg-[#21382b] text-amber-300 border border-[#2c4436]'
                  : isLight
                    ? 'bg-slate-100/80 sm:bg-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    : 'bg-[#16271e] sm:bg-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">TAPF Staff ({staffMembers.length})</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('audit')}
            className={`px-2.5 sm:px-3.5 py-2 sm:py-1.5 rounded-xl font-semibold transition-colors flex items-center justify-center sm:justify-start gap-1.5 ${
              activeTab === 'audit'
                ? isLight
                  ? 'bg-[#0f172a] text-white shadow-xs'
                  : 'bg-[#21382b] text-amber-300 border border-[#2c4436]'
                : isLight
                  ? 'bg-slate-100/80 sm:bg-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  : 'bg-[#16271e] sm:bg-transparent text-slate-400 hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Audit Log ({logs.length})</span>
          </button>
        </div>

        {/* TAB 1: SCHOOLS DIRECTORY */}
        {activeTab === 'schools' && (
          <div className="flex-1 flex flex-col min-h-0 p-3 sm:p-4 overflow-hidden">
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between pb-3 shrink-0">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={adminSearch}
                  onChange={(e) => setAdminSearch(e.target.value)}
                  placeholder="Filter by school name, UDISE, node code, SPOC, driver..."
                  className={`w-full pl-9 pr-8 py-2 border rounded-xl text-xs outline-hidden ${inputBaseClass}`}
                />
                {adminSearch && (
                  <button
                    onClick={() => setAdminSearch('')}
                    className={`absolute right-2.5 top-2.5 ${
                      isLight ? 'text-slate-400 hover:text-slate-700' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 overflow-x-auto">
                <select
                  value={adminRouteFilter}
                  onChange={(e) => setAdminRouteFilter(e.target.value)}
                  className={`px-3 py-2 border rounded-xl text-xs outline-hidden font-semibold ${inputBaseClass}`}
                >
                  <option value="ALL">All Routes ({schools.length})</option>
                  {routes.map((r) => (
                    <option key={r.id || r.routeName} value={r.routeName}>
                      {r.routeName} ({schools.filter(s => s.routeName?.toLowerCase() === r.routeName.toLowerCase()).length})
                    </option>
                  ))}
                </select>

                {isSuperAdmin && (
                  confirmReset ? (
                    <div
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[11px] shrink-0 ${
                        isLight
                          ? 'bg-red-50 border-red-200 text-red-700'
                          : 'bg-red-950 border-red-800 text-red-200'
                      }`}
                    >
                      <span>Reset to 129 default?</span>
                      <button
                        onClick={() => {
                          onResetToDefault();
                          setConfirmReset(false);
                        }}
                        className="px-2 py-0.5 bg-red-600 text-white rounded font-bold hover:bg-red-500"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setConfirmReset(false)}
                        className={`px-1 ${isLight ? 'text-slate-500 hover:text-slate-900' : 'text-slate-300 hover:text-white'}`}
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmReset(true)}
                      className={`inline-flex items-center gap-1 px-2.5 py-2 rounded-xl border text-xs transition-colors shrink-0 ${
                        isLight
                          ? 'bg-white hover:bg-slate-50 text-slate-600 hover:text-red-600 border-slate-200'
                          : 'bg-[#111f18] hover:bg-[#21382b] text-slate-400 hover:text-amber-400 border-[#2c4436]'
                      }`}
                      title="Reset to original 129 schools"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span className="hidden md:inline">Reset Default</span>
                    </button>
                  )
                )}
              </div>
            </div>

            <div
              className={`flex-1 overflow-y-auto border rounded-xl divide-y ${
                isLight
                  ? 'bg-white border-slate-200 divide-slate-200'
                  : 'bg-[#111f18] border-[#2c4436] divide-[#2c4436]'
              }`}
            >
              {filteredSchools.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No schools found matching your search.
                </div>
              ) : (
                filteredSchools.map((school) => {
                  const color = getRouteColor(school.routeName);
                  const canStaffEdit = isSuperAdmin || (activeStaff?.canEdit ?? true);
                  return (
                    <div
                      key={school.id}
                      className={`p-3 sm:p-4 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                        isLight ? 'hover:bg-slate-50/80' : 'hover:bg-[#16271e]'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1 text-[11px]">
                          <span className="font-bold uppercase" style={{ color }}>
                            {school.routeName}
                          </span>
                          {school.nodeCode && (
                            <span className={`font-mono ${isLight ? 'text-slate-600 font-semibold' : 'text-[#7fb298]'}`}>
                              · {school.nodeCode}
                            </span>
                          )}
                          {school.udise && (
                            <span className={`font-mono ${isLight ? 'text-slate-500' : 'text-[#a4b3ab]'}`}>
                              · UDISE: {school.udise}
                            </span>
                          )}
                          <span className={isLight ? 'text-emerald-700 font-medium' : 'text-[#7fb298]'}>
                            · {school.category || 'Parishadiya'}
                          </span>
                        </div>

                        <h4
                          className={`font-bold text-sm leading-snug ${
                            isLight ? 'text-slate-900' : 'text-[#f2ede0]'
                          }`}
                        >
                          {school.schoolName}
                        </h4>

                        <p
                          className={`text-[11px] mt-0.5 line-clamp-1 ${
                            isLight ? 'text-slate-500' : 'text-[#a4b3ab]'
                          }`}
                        >
                          {school.address || 'Kanpur'} {school.pincode ? `(${school.pincode})` : ''}
                        </p>

                        <div
                          className={`mt-1.5 flex items-center gap-3 text-[11px] flex-wrap ${
                            isLight ? 'text-slate-600' : 'text-[#90a297]'
                          }`}
                        >
                          {school.spocContact && (
                            <span>
                              <strong className={isLight ? 'text-emerald-700 font-semibold' : 'text-amber-400 font-medium'}>
                                SPOC:
                              </strong>{' '}
                              {school.spocName || 'Incharge'} ({school.spocContact})
                            </span>
                          )}
                          {school.driverContact && (
                            <span>
                              <strong className={isLight ? 'text-blue-700 font-semibold' : 'text-[#7c9ee0] font-medium'}>
                                Driver:
                              </strong>{' '}
                              {school.driverName || 'Driver'} ({school.driverContact})
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        {canStaffEdit && (
                          <button
                            onClick={() => onEditSchoolClick(school)}
                            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border transition-colors font-semibold text-xs active:scale-95 ${
                              isLight
                                ? 'bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-200'
                                : 'bg-[#21382b] hover:bg-[#2c4436] text-amber-300 border-[#2c4436]'
                            }`}
                            title="Edit school information"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                        )}

                        {isSuperAdmin && (
                          confirmDeleteId === school.id ? (
                            <div
                              className={`flex items-center gap-1 p-1 rounded-xl border ${
                                isLight
                                  ? 'bg-red-50 border-red-200'
                                  : 'bg-red-950 border-red-800'
                              }`}
                            >
                              <button
                                onClick={() => {
                                  onDeleteSchool(school.id);
                                  setConfirmDeleteId(null);
                                }}
                                className="px-2.5 py-1 bg-red-600 text-white rounded-lg font-bold text-[10px]"
                              >
                                Delete
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className={`px-1 text-[10px] ${
                                  isLight ? 'text-slate-600' : 'text-slate-300'
                                }`}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteId(school.id)}
                              className={`p-1.5 rounded-xl border transition-colors ${
                                isLight
                                  ? 'bg-white hover:bg-red-50 text-slate-400 hover:text-red-600 border-slate-200'
                                  : 'bg-[#111f18] hover:bg-red-950 text-slate-400 hover:text-red-400 border-[#2c4436]'
                              }`}
                              title="Delete this school"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 2: ROUTES MANAGER (ADD NEW ROUTE / EDIT ROUTES) */}
        {activeTab === 'routes' && (
          <div className="flex-1 p-4 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-4 text-xs">
            {/* Left Column: Add / Edit Route Form */}
            <div className={`lg:col-span-5 border rounded-2xl p-4 h-fit space-y-3.5 ${cardBaseClass}`}>
              <div className="flex items-center justify-between">
                <h3
                  className={`text-sm font-heading font-bold flex items-center gap-1.5 ${
                    isLight ? 'text-blue-600' : 'text-amber-400'
                  }`}
                >
                  <RouteIcon className="w-4 h-4" />
                  <span>{editingRoute ? `Edit Route: ${editingRoute.routeName}` : 'Add New Delivery Route'}</span>
                </h3>
                {editingRoute && (
                  <button
                    type="button"
                    onClick={resetRouteForm}
                    className={`text-[11px] underline ${
                      isLight ? 'text-slate-500 hover:text-slate-900' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Cancel Edit
                  </button>
                )}
              </div>

              {routeFormError && (
                <div
                  className={`p-2.5 rounded-xl border text-xs ${
                    isLight
                      ? 'bg-red-50 border-red-200 text-red-700'
                      : 'bg-red-950/70 border-red-800 text-red-200'
                  }`}
                >
                  {routeFormError}
                </div>
              )}

              <form onSubmit={handleRouteFormSubmit} className="space-y-3">
                <div>
                  <label className={`block mb-1 font-semibold ${isLight ? 'text-slate-700' : 'text-[#a4b3ab]'}`}>
                    Route Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={routeNameInput}
                    onChange={(e) => setRouteNameInput(e.target.value)}
                    placeholder="e.g. KALYANPUR or JAJMAU"
                    className={`w-full px-3 py-2 border rounded-xl outline-hidden ${inputBaseClass}`}
                  />
                </div>

                <div>
                  <label className={`block mb-1 font-semibold ${isLight ? 'text-slate-700' : 'text-[#a4b3ab]'}`}>
                    Route Code
                  </label>
                  <input
                    type="text"
                    value={routeCodeInput}
                    onChange={(e) => setRouteCodeInput(e.target.value)}
                    placeholder="e.g. RC00007"
                    className={`w-full px-3 py-2 border rounded-xl font-mono outline-hidden ${inputBaseClass}`}
                  />
                </div>

                <div>
                  <label className={`block mb-1.5 font-semibold ${isLight ? 'text-slate-700' : 'text-[#a4b3ab]'}`}>
                    Route Marker & Map Color
                  </label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {ROUTE_COLOR_PALETTE.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => setRouteColorInput(hex)}
                        className={`w-6 h-6 rounded-full transition-transform ${
                          routeColorInput === hex
                            ? isLight
                              ? 'scale-125 ring-2 ring-slate-900'
                              : 'scale-125 ring-2 ring-white'
                            : 'opacity-75 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: hex }}
                        title={hex}
                      />
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className={`block mb-1 font-semibold ${isLight ? 'text-slate-700' : 'text-[#a4b3ab]'}`}>
                      Default Route Executive
                    </label>
                    <input
                      type="text"
                      value={routeExecInput}
                      onChange={(e) => setRouteExecInput(e.target.value)}
                      placeholder="Ayush Gupta"
                      className={`w-full px-3 py-2 border rounded-xl outline-hidden ${inputBaseClass}`}
                    />
                  </div>
                  <div>
                    <label className={`block mb-1 font-semibold ${isLight ? 'text-slate-700' : 'text-[#a4b3ab]'}`}>
                      Executive Contact
                    </label>
                    <input
                      type="tel"
                      value={routeExecPhoneInput}
                      onChange={(e) => setRouteExecPhoneInput(e.target.value)}
                      placeholder="8299485052"
                      className={`w-full px-3 py-2 border rounded-xl font-mono outline-hidden ${inputBaseClass}`}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs shadow-md flex items-center justify-center gap-1.5 transition-all ${
                    isLight
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-amber-500 hover:bg-amber-400 text-[#12211a]'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  <span>{editingRoute ? 'Update Route Settings' : 'Create Delivery Route'}</span>
                </button>
              </form>
            </div>

            {/* Right Column: Existing Routes List */}
            <div className="lg:col-span-7 space-y-2.5">
              <h3
                className={`text-sm font-heading font-bold ${
                  isLight ? 'text-slate-900' : 'text-[#f2ede0]'
                }`}
              >
                Active Delivery Routes ({routes.length})
              </h3>
              <div
                className={`border rounded-2xl divide-y ${
                  isLight
                    ? 'bg-white border-slate-200 divide-slate-200'
                    : 'bg-[#111f18] border-[#2c4436] divide-[#2c4436]'
                }`}
              >
                {routes.map((r) => {
                  const count = schools.filter(
                    (s) => s.routeName?.toLowerCase() === r.routeName.toLowerCase()
                  ).length;

                  return (
                    <div
                      key={r.id || r.routeName}
                      className={`p-3.5 flex items-center justify-between gap-3 transition-colors ${
                        isLight ? 'hover:bg-slate-50' : 'hover:bg-[#16271e]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-4 h-10 rounded-full shrink-0"
                          style={{ backgroundColor: r.color || '#7fb298' }}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`font-bold text-sm ${
                                isLight ? 'text-slate-900' : 'text-[#f2ede0]'
                              }`}
                            >
                              {r.routeName}
                            </span>
                            <span
                              className={`font-mono text-[11px] ${
                                isLight ? 'text-slate-500' : 'text-[#7fb298]'
                              }`}
                            >
                              · {r.routeCode || 'RC'}
                            </span>
                            <span
                              className={`font-mono text-[11px] font-semibold ${
                                isLight ? 'text-blue-600' : 'text-amber-400'
                              }`}
                            >
                              · {count} Schools
                            </span>
                          </div>
                          <p
                            className={`text-[11px] mt-0.5 ${
                              isLight ? 'text-slate-500' : 'text-[#a4b3ab]'
                            }`}
                          >
                            Executive: {r.routeExecutive || 'Ayush Gupta'} ({r.routeExecutiveContact || '8299485052'})
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleStartEditRoute(r)}
                          className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1 ${
                            isLight
                              ? 'bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-200'
                              : 'bg-[#21382b] hover:bg-[#2c4436] text-amber-300 border-[#2c4436]'
                          }`}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>

                        {isSuperAdmin && (
                          confirmDeleteRouteId === r.id ? (
                            <div
                              className={`flex items-center gap-1 p-1 rounded-xl border ${
                                isLight
                                  ? 'bg-red-50 border-red-200'
                                  : 'bg-red-950 border-red-800'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  onDeleteRoute(r.id);
                                  setConfirmDeleteRouteId(null);
                                }}
                                className="px-2 py-1 bg-red-600 text-white rounded-lg font-bold text-[10px]"
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteRouteId(null)}
                                className={`px-1 text-[10px] ${
                                  isLight ? 'text-slate-600' : 'text-slate-300'
                                }`}
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteRouteId(r.id)}
                              className={`p-1.5 rounded-xl border ${
                                isLight
                                  ? 'bg-white hover:bg-red-50 text-slate-400 hover:text-red-600 border-slate-200'
                                  : 'bg-[#111f18] hover:bg-red-950 text-slate-400 hover:text-red-400 border-[#2c4436]'
                              }`}
                              title="Delete Route"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: TAPF STAFF MEMBERS (SUPER ADMIN ONLY) */}
        {activeTab === 'staff' && isSuperAdmin && (
          <div className="flex-1 p-4 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-4 text-xs">
            {/* Left Column: Create / Edit TAPF Member Credentials */}
            <div className={`lg:col-span-5 border rounded-2xl p-4 h-fit space-y-3.5 ${cardBaseClass}`}>
              <div className="flex items-center justify-between">
                <h3
                  className={`text-sm font-heading font-bold flex items-center gap-1.5 ${
                    isLight ? 'text-blue-600' : 'text-amber-400'
                  }`}
                >
                  <UserPlus className="w-4 h-4" />
                  <span>
                    {editingStaff ? `Edit Member: ${editingStaff.name}` : 'Create TAPF Member Login'}
                  </span>
                </h3>
                {editingStaff && (
                  <button
                    type="button"
                    onClick={resetStaffForm}
                    className={`text-[11px] underline ${
                      isLight ? 'text-slate-500 hover:text-slate-900' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Cancel Edit
                  </button>
                )}
              </div>

              <p className={`text-[11px] leading-relaxed ${isLight ? 'text-slate-500' : 'text-[#a4b3ab]'}`}>
                Generate an Office Staff Email/Login ID and Password for TAPF team members so they can sign in and add or update schools.
              </p>

              {staffFormError && (
                <div
                  className={`p-2.5 rounded-xl border text-xs ${
                    isLight
                      ? 'bg-red-50 border-red-200 text-red-700'
                      : 'bg-red-950/70 border-red-800 text-red-200'
                  }`}
                >
                  {staffFormError}
                </div>
              )}

              <form onSubmit={handleStaffFormSubmit} className="space-y-3">
                <div>
                  <label className={`block mb-1 font-semibold ${isLight ? 'text-slate-700' : 'text-[#a4b3ab]'}`}>
                    TAPF Member Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={staffNameInput}
                    onChange={(e) => setStaffNameInput(e.target.value)}
                    placeholder="e.g. Ayush Gupta"
                    className={`w-full px-3 py-2 border rounded-xl outline-hidden ${inputBaseClass}`}
                  />
                </div>

                <div>
                  <label className={`block mb-1 font-semibold ${isLight ? 'text-slate-700' : 'text-[#a4b3ab]'}`}>
                    Office Staff Email / Login ID *
                  </label>
                  <div className="relative">
                    <Mail className={`w-3.5 h-3.5 absolute left-3 top-2.5 ${isLight ? 'text-slate-400' : 'text-[#7fb298]'}`} />
                    <input
                      type="text"
                      required
                      value={staffLoginIdInput}
                      onChange={(e) => setStaffLoginIdInput(e.target.value)}
                      placeholder="e.g. ayush@kanpur-schools.org"
                      className={`w-full pl-8 pr-3 py-2 border rounded-xl font-mono outline-hidden ${inputBaseClass}`}
                    />
                  </div>
                </div>

                <div>
                  <label className={`block mb-1 font-semibold ${isLight ? 'text-slate-700' : 'text-[#a4b3ab]'}`}>
                    {editingStaff ? 'Password (Change or keep current)' : 'Assign Password *'}
                  </label>
                  <div className="relative">
                    <Key className={`w-3.5 h-3.5 absolute left-3 top-2.5 ${isLight ? 'text-slate-400' : 'text-[#7fb298]'}`} />
                    <input
                      type={showStaffPass ? 'text' : 'password'}
                      required={!editingStaff}
                      value={staffPasswordInput}
                      onChange={(e) => setStaffPasswordInput(e.target.value)}
                      placeholder={editingStaff ? 'Enter new password to change' : 'Create password'}
                      className={`w-full pl-8 pr-9 py-2 border rounded-xl font-mono outline-hidden ${inputBaseClass}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowStaffPass((prev) => !prev)}
                      className={`absolute right-2.5 top-2 ${
                        isLight ? 'text-slate-400 hover:text-slate-700' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {showStaffPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className={`block mb-1 font-semibold ${isLight ? 'text-slate-700' : 'text-[#a4b3ab]'}`}>
                    Role / Designation
                  </label>
                  <input
                    type="text"
                    value={staffRoleInput}
                    onChange={(e) => setStaffRoleInput(e.target.value)}
                    placeholder="e.g. TAPF Route Coordinator"
                    className={`w-full px-3 py-2 border rounded-xl outline-hidden ${inputBaseClass}`}
                  />
                </div>

                <div
                  className={`p-3 rounded-xl border space-y-2 ${
                    isLight
                      ? 'bg-slate-50 border-slate-200'
                      : 'bg-[#16271e] border-[#2c4436]'
                  }`}
                >
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className={`font-semibold ${isLight ? 'text-slate-800' : 'text-[#f2ede0]'}`}>
                      Allow Editing Existing Schools
                    </span>
                    <input
                      type="checkbox"
                      checked={staffCanEdit}
                      onChange={(e) => setStaffCanEdit(e.target.checked)}
                      className="accent-blue-600 w-4 h-4 rounded"
                    />
                  </label>

                  <label
                    className={`flex items-center justify-between cursor-pointer pt-2 border-t ${
                      isLight ? 'border-slate-200' : 'border-[#2c4436]/60'
                    }`}
                  >
                    <span className={`font-semibold ${isLight ? 'text-slate-800' : 'text-[#f2ede0]'}`}>
                      Account Active (Can Sign In)
                    </span>
                    <input
                      type="checkbox"
                      checked={staffActive}
                      onChange={(e) => setStaffActive(e.target.checked)}
                      className="accent-emerald-600 w-4 h-4 rounded"
                    />
                  </label>
                </div>

                <button
                  type="submit"
                  className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs shadow-md flex items-center justify-center gap-1.5 transition-all ${
                    isLight
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-amber-500 hover:bg-amber-400 text-[#12211a]'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{editingStaff ? 'Save Member Changes' : 'Create TAPF Member Account'}</span>
                </button>
              </form>
            </div>

            {/* Right Column: Existing TAPF Staff Accounts */}
            <div className="lg:col-span-7 space-y-2.5">
              <div className="flex items-center justify-between">
                <h3
                  className={`text-sm font-heading font-bold ${
                    isLight ? 'text-slate-900' : 'text-[#f2ede0]'
                  }`}
                >
                  Managed TAPF Office Staff ({staffMembers.length})
                </h3>
              </div>

              {staffMembers.length === 0 ? (
                <div className={`p-8 rounded-2xl border text-center space-y-2 ${cardBaseClass}`}>
                  <Users className={`w-8 h-8 mx-auto ${isLight ? 'text-blue-600/70' : 'text-amber-400/70'}`} />
                  <p className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-[#f2ede0]'}`}>
                    No TAPF Staff Accounts Yet
                  </p>
                  <p className={`text-xs max-w-sm mx-auto ${isLight ? 'text-slate-500' : 'text-[#a4b3ab]'}`}>
                    Use the form on the left to create an ID and Password for any TAPF team member so they can sign in and add schools.
                  </p>
                </div>
              ) : (
                <div
                  className={`border rounded-2xl divide-y ${
                    isLight
                      ? 'bg-white border-slate-200 divide-slate-200'
                      : 'bg-[#111f18] border-[#2c4436] divide-[#2c4436]'
                  }`}
                >
                  {staffMembers.map((member) => (
                    <div
                      key={member.id}
                      className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                        isLight ? 'hover:bg-slate-50' : 'hover:bg-[#16271e]'
                      }`}
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`font-bold text-sm ${
                              isLight ? 'text-slate-900' : 'text-[#f2ede0]'
                            }`}
                          >
                            {member.name}
                          </span>
                          <span className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-[#7fb298]'}`}>
                            · {member.role}
                          </span>
                          <span
                            className={`text-[11px] font-semibold ${
                              member.active
                                ? isLight
                                  ? 'text-emerald-600'
                                  : 'text-emerald-400'
                                : isLight
                                  ? 'text-red-600'
                                  : 'text-red-400'
                            }`}
                          >
                            · {member.active ? 'Active' : 'Suspended'}
                          </span>
                        </div>

                        <div
                          className={`font-mono text-xs flex items-center gap-3 flex-wrap ${
                            isLight ? 'text-slate-600' : 'text-[#a4b3ab]'
                          }`}
                        >
                          <span>
                            ID:{' '}
                            <strong className={isLight ? 'text-blue-600' : 'text-amber-300'}>
                              {member.loginId}
                            </strong>
                          </span>
                          {member.passwordHint && (
                            <span>
                              Password:{' '}
                              <strong className={isLight ? 'text-slate-900' : 'text-[#f2ede0]'}>
                                {member.passwordHint}
                              </strong>
                            </span>
                          )}
                        </div>

                        <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-[#6d8076]'}`}>
                          Permissions: {member.canEdit ? 'Can Add & Edit Schools + Routes' : 'Can Add New Schools Only'}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => handleCopyStaffCredentials(member)}
                          className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1 ${
                            isLight
                              ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                              : 'bg-[#16271e] hover:bg-[#21382b] text-[#7fb298] border-[#2c4436]'
                          }`}
                          title="Copy Login ID & Password to share with staff member"
                        >
                          {copiedStaffId === member.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy Login</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleStartEditStaff(member)}
                          className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1 ${
                            isLight
                              ? 'bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-200'
                              : 'bg-[#21382b] hover:bg-[#2c4436] text-amber-300 border-[#2c4436]'
                          }`}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit / Pass</span>
                        </button>

                        {confirmDeleteStaffId === member.id ? (
                          <div
                            className={`flex items-center gap-1 p-1 rounded-xl border ${
                              isLight
                                ? 'bg-red-50 border-red-200'
                                : 'bg-red-950 border-red-800'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteStaffMember(member.id);
                                setConfirmDeleteStaffId(null);
                              }}
                              className="px-2 py-1 bg-red-600 text-white rounded-lg font-bold text-[10px]"
                            >
                              Remove
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteStaffId(null)}
                              className={`px-1 text-[10px] ${
                                isLight ? 'text-slate-600' : 'text-slate-300'
                              }`}
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteStaffId(member.id)}
                            className={`p-1.5 rounded-xl border ${
                              isLight
                                ? 'bg-white hover:bg-red-50 text-slate-400 hover:text-red-600 border-slate-200'
                                : 'bg-[#111f18] hover:bg-red-950 text-slate-400 hover:text-red-400 border-[#2c4436]'
                            }`}
                            title="Delete Staff Account"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: SECURITY AUDIT LOGS */}
        {activeTab === 'audit' && (
          <div className="flex-1 p-4 overflow-y-auto space-y-3">
            <div>
              <h3
                className={`text-sm font-bold flex items-center gap-1.5 ${
                  isLight ? 'text-slate-900' : 'text-[#f2ede0]'
                }`}
              >
                <History className={`w-4 h-4 ${isLight ? 'text-blue-600' : 'text-amber-400'}`} />
                Cloud Security Audit Trail
              </h3>
              <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-[#a4b3ab]'}`}>
                Activity log of school additions, route updates, and staff modifications.
              </p>
            </div>

            <div
              className={`border rounded-xl divide-y text-xs ${
                isLight
                  ? 'bg-white border-slate-200 divide-slate-200'
                  : 'bg-[#111f18] border-[#2c4436] divide-[#2c4436]'
              }`}
            >
              {logs.length === 0 ? (
                <div className="p-6 text-center text-slate-400">
                  No modification logs recorded yet.
                </div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="p-3 flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap text-[11px] font-mono">
                        <span className={`font-bold ${isLight ? 'text-blue-600' : 'text-amber-400'}`}>
                          {log.action}
                        </span>
                        <span className="text-slate-400">· {log.timestamp}</span>
                        <span className={isLight ? 'text-emerald-700 font-semibold' : 'text-[#7fb298]'}>
                          · {log.adminEmail}
                        </span>
                      </div>
                      <p className={`text-xs ${isLight ? 'text-slate-800' : 'text-[#f2ede0]'}`}>
                        {log.summary}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Footer info */}
        <div
          className={`p-3 border-t flex items-center justify-between text-[11px] shrink-0 ${
            isLight
              ? 'bg-white border-slate-200 text-slate-500'
              : 'bg-[#122119] border-[#2c4436] text-[#a4b3ab]'
          }`}
        >
          <span>
            Total:{' '}
            <strong className={isLight ? 'text-blue-600' : 'text-amber-400'}>
              {schools.length}
            </strong>{' '}
            schools across{' '}
            <strong className={isLight ? 'text-emerald-600' : 'text-[#7fb298]'}>
              {routes.length}
            </strong>{' '}
            routes
          </span>
          <button
            onClick={onClose}
            className={`px-4 py-1.5 rounded-xl transition-colors font-semibold text-xs ${
              isLight
                ? 'bg-[#0f172a] hover:bg-slate-800 text-white'
                : 'bg-[#21382b] hover:bg-[#2c4436] text-white'
            }`}
          >
            Close Console
          </button>
        </div>
      </div>
    </div>
  );
};

