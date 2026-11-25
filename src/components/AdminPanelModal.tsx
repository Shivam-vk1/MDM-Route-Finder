import React, { useState, useMemo, useEffect } from 'react';
import {
  School,
  RouteConfig,
  StaffMember,
  AccessLogEntry,
  OrgVerificationPolicy,
  OrgVerificationSession,
  ROUTE_COLOR_PALETTE,
  TAPF_LOGO_URL,
  getRouteColor,
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
  Moon,
  Truck,
  Phone,
  RefreshCw,
  Clock,
  Globe,
  UserX,
  AlertTriangle,
} from 'lucide-react';
import {
  logoutAdmin,
  fetchCloudAuditLogs,
  fetchCloudAccessLogs,
  subscribeToCloudAccessLogs,
  verifyOrgEmailWithFirebase,
  fetchOrgVerificationPolicy,
  saveOrgVerificationPolicy,
  revokeSingleOrgUserSession,
  revokeAllActiveOrgUsers,
  clearOldOrgAccessRecords,
  clearAllAuditLogs,
  logSecurityAudit,
  AuditLogEntry,
  hashStaffPassword,
  sanitizeInput,
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
  onSaveRoute: (route: RouteConfig, syncSchools?: boolean) => void;
  onDeleteRoute: (routeId: string) => void;
  onSaveStaffMember: (member: StaffMember) => void;
  onDeleteStaffMember: (memberId: string) => void;
  currentUser: User | null;
  activeStaff: StaffMember | null;
  isSuperAdmin: boolean;
  initialTab?: 'schools' | 'routes' | 'staff' | 'access' | 'audit';
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
  orgVerificationEnabled: boolean;
  onToggleOrgVerification: (enabled: boolean) => Promise<void>;
  isTogglingOrgVerification?: boolean;
  revokedAllBeforeMs?: number;
  currentOrgSession?: OrgVerificationSession | null;
  onOrgSessionUpdated?: (session: OrgVerificationSession | null) => void;
  onNotify?: (message: string) => void;
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
  onToggleTheme,
  orgVerificationEnabled,
  onToggleOrgVerification,
  isTogglingOrgVerification = false,
  revokedAllBeforeMs = 0,
  currentOrgSession = null,
  onOrgSessionUpdated,
  onNotify,
}) => {
  const isLight = theme === 'light';

  const [activeTab, setActiveTab] = useState<'schools' | 'routes' | 'staff' | 'access' | 'audit'>(initialTab);
  const [accessSubTab, setAccessSubTab] = useState<'active' | 'history' | 'policy'>('active');
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
  const [routeDriverInput, setRouteDriverInput] = useState('');
  const [routeDriverPhoneInput, setRouteDriverPhoneInput] = useState('');
  const [routeSyncSchoolsWithDriver, setRouteSyncSchoolsWithDriver] = useState(true);
  const [routeFormError, setRouteFormError] = useState<string | null>(null);
  const [confirmDeleteRouteId, setConfirmDeleteRouteId] = useState<string | null>(null);

  // Quick Driver Change Modal State
  const [quickDriverRoute, setQuickDriverRoute] = useState<RouteConfig | null>(null);
  const [quickDriverName, setQuickDriverName] = useState('');
  const [quickDriverPhone, setQuickDriverPhone] = useState('');
  const [quickDriverSync, setQuickDriverSync] = useState(true);
  const [quickDriverFeedback, setQuickDriverFeedback] = useState<string | null>(null);

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
  const [showClearAuditModal, setShowClearAuditModal] = useState(false);
  const [isClearingAudit, setIsClearingAudit] = useState(false);
  const [auditFeedback, setAuditFeedback] = useState<string | null>(null);

  // Organization Access Logs & Firebase Verification Policy (Super Admin Only)
  const [accessLogs, setAccessLogs] = useState<AccessLogEntry[]>([]);
  const [loadingAccessLogs, setLoadingAccessLogs] = useState(false);
  const [accessLogSearch, setAccessLogSearch] = useState('');
  const [accessLogFilter, setAccessLogFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [orgPolicy, setOrgPolicy] = useState<OrgVerificationPolicy | null>(null);
  const [newDomainInput, setNewDomainInput] = useState('');
  const [newEmailInput, setNewEmailInput] = useState('');
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [policyStatusMsg, setPolicyStatusMsg] = useState<string | null>(null);
  const [revokingEntryId, setRevokingEntryId] = useState<string | null>(null);
  const [showRevokeAllModal, setShowRevokeAllModal] = useState(false);
  const [isRevokingAll, setIsRevokingAll] = useState(false);
  const [showClearOldModal, setShowClearOldModal] = useState(false);
  const [isClearingOld, setIsClearingOld] = useState(false);
  const [revokeFeedback, setRevokeFeedback] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  // Inline quick organization email verification for testing / registering current device
  const [quickVerifyEmailInput, setQuickVerifyEmailInput] = useState('');
  const [isQuickVerifying, setIsQuickVerifying] = useState(false);

  // Live clock tick every 30s to keep 48h countdown timers accurate
  useEffect(() => {
    if (!isOpen) return;
    setNowMs(Date.now());
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [isOpen]);

  const loadAccessLogsAndPolicy = async () => {
    if (!isSuperAdmin) return;
    setLoadingAccessLogs(true);
    try {
      const [fetchedLogs, fetchedPolicy] = await Promise.all([
        fetchCloudAccessLogs(),
        fetchOrgVerificationPolicy(),
      ]);
      setAccessLogs(fetchedLogs);
      if (fetchedPolicy) {
        setOrgPolicy(fetchedPolicy);
      }
    } catch (err) {
      console.warn('Access logs / policy load error:', err);
    } finally {
      setLoadingAccessLogs(false);
    }
  };

  // Real-time Firestore subscription for access_logs whenever Super Admin is logged in
  useEffect(() => {
    if (!isSuperAdmin) return;
    setLoadingAccessLogs(true);
    const unsub = subscribeToCloudAccessLogs((liveLogs) => {
      setAccessLogs(liveLogs);
      setLoadingAccessLogs(false);
    });
    return () => unsub();
  }, [isSuperAdmin, currentOrgSession?.logId]);

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
      if (isSuperAdmin) {
        loadAccessLogsAndPolicy();
      }
    }
  }, [isOpen, activeTab, isSuperAdmin]);

  const isEntryRevoked = (entry: AccessLogEntry) =>
    Boolean(entry.revoked) || (revokedAllBeforeMs > 0 && entry.accessedAtMs < revokedAllBeforeMs);

  const isEntryActive = (entry: AccessLogEntry) =>
    !isEntryRevoked(entry) && nowMs < entry.expiresAtMs;

  const formatRemaining48h = (expiresAtMs: number): string => {
    const diff = expiresAtMs - nowMs;
    if (diff <= 0) return '0m left';
    const totalMinutes = Math.ceil(diff / 60_000);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m left`;
    }
    return `${mins}m left`;
  };

  const activeAccessLogs = useMemo(
    () =>
      accessLogs.filter(
        (entry) =>
          !entry.revoked &&
          !(revokedAllBeforeMs > 0 && entry.accessedAtMs < revokedAllBeforeMs) &&
          nowMs < entry.expiresAtMs
      ),
    [accessLogs, revokedAllBeforeMs, nowMs]
  );

  const oldAccessLogs = useMemo(
    () =>
      accessLogs.filter(
        (entry) =>
          Boolean(entry.revoked) ||
          (revokedAllBeforeMs > 0 && entry.accessedAtMs < revokedAllBeforeMs) ||
          nowMs >= entry.expiresAtMs
      ),
    [accessLogs, revokedAllBeforeMs, nowMs]
  );

  const filteredAccessLogs = useMemo(() => {
    const q = accessLogSearch.trim().toLowerCase();
    return accessLogs.filter((entry) => {
      const active =
        !entry.revoked &&
        !(revokedAllBeforeMs > 0 && entry.accessedAtMs < revokedAllBeforeMs) &&
        nowMs < entry.expiresAtMs;
      if (accessLogFilter === 'ACTIVE' && !active) return false;
      if (accessLogFilter === 'INACTIVE' && active) return false;
      if (!q) return true;
      return (
        entry.email.toLowerCase().includes(q) ||
        (entry.accessedAt || '').toLowerCase().includes(q) ||
        (entry.deviceInfo || '').toLowerCase().includes(q) ||
        (entry.id || '').toLowerCase().includes(q)
      );
    });
  }, [accessLogs, accessLogSearch, accessLogFilter, revokedAllBeforeMs, nowMs]);

  const uniqueAccessEmailsCount = useMemo(() => {
    return new Set(accessLogs.map((l) => l.email.toLowerCase())).size;
  }, [accessLogs]);

  const handleQuickVerifyInAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickVerifyEmailInput.trim()) return;
    setIsQuickVerifying(true);
    setRevokeFeedback(null);
    const res = await verifyOrgEmailWithFirebase(quickVerifyEmailInput);
    setIsQuickVerifying(false);
    if (res.success && res.session) {
      setQuickVerifyEmailInput('');
      onOrgSessionUpdated?.(res.session);
      await loadAccessLogsAndPolicy();
      const msg = `Verified & added active 48h session for ${res.session.email}`;
      setRevokeFeedback(msg);
      onNotify?.(msg);
    } else {
      setRevokeFeedback(res.error || 'Could not verify email.');
    }
  };

  const handleRevokeSingleUser = async (entry: AccessLogEntry) => {
    setRevokingEntryId(entry.id);
    setRevokeFeedback(null);
    const res = await revokeSingleOrgUserSession(entry);
    setRevokingEntryId(null);
    if (res.success) {
      if (currentOrgSession && currentOrgSession.logId === entry.id) {
        onOrgSessionUpdated?.(null);
      }
      setAccessLogs((prev) =>
        prev.map((item) =>
          item.id === entry.id
            ? {
                ...item,
                revoked: true,
                revokedAt: res.revokedAt,
                revokedAtMs: res.revokedAtMs,
              }
            : item
        )
      );
      fetchCloudAuditLogs().then(setLogs).catch(() => {});
      const msg = `Removed active session for ${entry.email}.`;
      setRevokeFeedback(msg);
      onNotify?.(msg);
    } else {
      setRevokeFeedback(res.error || 'Could not remove user session.');
    }
  };

  const handleRevokeAllActiveUsers = async () => {
    setIsRevokingAll(true);
    setRevokeFeedback(null);
    const res = await revokeAllActiveOrgUsers(orgVerificationEnabled, activeAccessLogs);
    setIsRevokingAll(false);
    setShowRevokeAllModal(false);
    if (res.success) {
      onOrgSessionUpdated?.(null);
      const revokedIds = new Set(activeAccessLogs.map((e) => e.id));
      setAccessLogs((prev) =>
        prev.map((item) =>
          revokedIds.has(item.id)
            ? {
                ...item,
                revoked: true,
                revokedAt: res.revokedAt,
                revokedAtMs: res.revokedAllBeforeMs,
              }
            : item
        )
      );
      fetchCloudAuditLogs().then(setLogs).catch(() => {});
      const msg = `Removed all ${res.count ?? activeAccessLogs.length} active user session(s).`;
      setRevokeFeedback(msg);
      onNotify?.(msg);
    } else {
      setRevokeFeedback(res.error || 'Could not remove all active user sessions.');
    }
  };

  const handleClearAllOldRecords = async () => {
    setIsClearingOld(true);
    setRevokeFeedback(null);
    const res = await clearOldOrgAccessRecords(oldAccessLogs, revokedAllBeforeMs);
    setIsClearingOld(false);
    setShowClearOldModal(false);
    if (res.success) {
      const clearedSet = new Set(res.clearedIds || []);
      setAccessLogs((prev) => prev.filter((item) => !clearedSet.has(item.id)));
      fetchCloudAuditLogs().then(setLogs).catch(() => {});
      const count = res.clearedCount ?? clearedSet.size;
      const msg =
        count > 0
          ? `Permanently cleared ${count} old/revoked record${count === 1 ? '' : 's'}. Active users unaffected.`
          : 'No old records found to clear.';
      setRevokeFeedback(msg);
      onNotify?.(msg);
    } else {
      setRevokeFeedback(res.error || 'Could not clear old access records.');
    }
  };

  const handleClearAllAuditLogs = async () => {
    if (!isSuperAdmin) return;
    setIsClearingAudit(true);
    setAuditFeedback(null);
    const previousCount = logs.length;
    const res = await clearAllAuditLogs();
    setIsClearingAudit(false);
    setShowClearAuditModal(false);
    if (res.success) {
      setLogs([]);
      const count = res.clearedCount && res.clearedCount > 0 ? res.clearedCount : previousCount;
      const msg =
        count > 0
          ? `Permanently cleared ${count} security audit record${count === 1 ? '' : 's'} from Firebase.`
          : 'Audit log is already empty.';
      setAuditFeedback(msg);
      onNotify?.(msg);
    } else {
      setAuditFeedback(res.error || 'Could not clear audit data.');
    }
  };

  const handleAddPolicyDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = sanitizeInput(newDomainInput, 100).toLowerCase().replace(/^@+/, '');
    if (!cleaned || !cleaned.includes('.') || cleaned.includes('@') || cleaned.includes(' ')) {
      setPolicyStatusMsg('Please enter a valid domain name (without @).');
      return;
    }
    setSavingPolicy(true);
    setPolicyStatusMsg(null);
    const currentDomains = orgPolicy?.allowedDomains || [];
    const currentEmails = orgPolicy?.authorizedEmails || [];
    const res = await saveOrgVerificationPolicy([...currentDomains, cleaned], currentEmails);
    setSavingPolicy(false);
    if (res.success && res.policy) {
      setOrgPolicy(res.policy);
      setNewDomainInput('');
      setPolicyStatusMsg('Authorized domain saved in Firebase.');
    } else {
      setPolicyStatusMsg(res.error || 'Could not save domain.');
    }
  };

  const handleRemovePolicyDomain = async (domain: string) => {
    setSavingPolicy(true);
    setPolicyStatusMsg(null);
    const nextDomains = (orgPolicy?.allowedDomains || []).filter((d) => d !== domain);
    const currentEmails = orgPolicy?.authorizedEmails || [];
    const res = await saveOrgVerificationPolicy(nextDomains, currentEmails);
    setSavingPolicy(false);
    if (res.success && res.policy) {
      setOrgPolicy(res.policy);
      setPolicyStatusMsg('Domain removed from Firebase policy.');
    }
  };

  const handleAddPolicyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = sanitizeInput(newEmailInput, 150).toLowerCase();
    if (!cleaned || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) {
      setPolicyStatusMsg('Please enter a valid email address.');
      return;
    }
    setSavingPolicy(true);
    setPolicyStatusMsg(null);
    const currentDomains = orgPolicy?.allowedDomains || [];
    const currentEmails = orgPolicy?.authorizedEmails || [];
    const res = await saveOrgVerificationPolicy(currentDomains, [...currentEmails, cleaned]);
    setSavingPolicy(false);
    if (res.success && res.policy) {
      setOrgPolicy(res.policy);
      setNewEmailInput('');
      setPolicyStatusMsg('Authorized email saved in Firebase.');
    } else {
      setPolicyStatusMsg(res.error || 'Could not save email.');
    }
  };

  const handleRemovePolicyEmail = async (email: string) => {
    setSavingPolicy(true);
    setPolicyStatusMsg(null);
    const currentDomains = orgPolicy?.allowedDomains || [];
    const nextEmails = (orgPolicy?.authorizedEmails || []).filter((em) => em !== email);
    const res = await saveOrgVerificationPolicy(currentDomains, nextEmails);
    setSavingPolicy(false);
    if (res.success && res.policy) {
      setOrgPolicy(res.policy);
      setPolicyStatusMsg('Email removed from Firebase policy.');
    }
  };

  const handleExportAccessLogsCSV = () => {
    const headers = ['Email ID', 'Status', 'Accessed At (IST)', 'Session Expires At (IST)', 'Revoked At (IST)', 'Device'];
    const escapeCell = (val: string) => `"${String(val || '').replace(/"/g, '""')}"`;
    const rows = accessLogs.map((l) => {
      const status = isEntryRevoked(l)
        ? 'Removed'
        : Date.now() < l.expiresAtMs
          ? 'Active (48h)'
          : 'Expired';
      return [
        escapeCell(l.email),
        escapeCell(status),
        escapeCell(l.accessedAt),
        escapeCell(l.expiresAt),
        escapeCell(l.revokedAt || ''),
        escapeCell(l.deviceInfo || ''),
      ];
    });
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MDM_Org_Access_Logs_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Helper to resolve route driver info from route config or matching schools
  const getRouteDriverInfo = (routeName: string, explicitDriver?: string, explicitContact?: string) => {
    if (explicitDriver && explicitDriver.trim()) {
      return { driverName: explicitDriver.trim(), driverContact: (explicitContact || '').trim() };
    }
    const school = schools.find(
      (s) => s.routeName?.toLowerCase() === routeName.toLowerCase() && s.driverName?.trim()
    );
    return {
      driverName: school?.driverName?.trim() || '',
      driverContact: (explicitContact || school?.driverContact || '').trim(),
    };
  };

  // Filter schools for admin list (MUST be called before early return)
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
          s.address,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
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
    setRouteDriverInput('');
    setRouteDriverPhoneInput('');
    setRouteSyncSchoolsWithDriver(true);
    setRouteFormError(null);
  };

  const handleStartEditRoute = (r: RouteConfig) => {
    setEditingRoute(r);
    setRouteNameInput(r.routeName);
    setRouteCodeInput(r.routeCode || '');
    setRouteColorInput(r.color || ROUTE_COLOR_PALETTE[0]);
    setRouteExecInput(r.routeExecutive || 'Ayush Gupta');
    setRouteExecPhoneInput(r.routeExecutiveContact || '8299485052');
    const driverInfo = getRouteDriverInfo(r.routeName, r.driverName, r.driverContact);
    setRouteDriverInput(driverInfo.driverName);
    setRouteDriverPhoneInput(driverInfo.driverContact);
    setRouteSyncSchoolsWithDriver(true);
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
      driverName: sanitizeInput(routeDriverInput, 140) || undefined,
      driverContact: sanitizeInput(routeDriverPhoneInput, 35) || undefined,
      createdAt: editingRoute?.createdAt || new Date().toISOString(),
    };

    onSaveRoute(savedRoute, routeSyncSchoolsWithDriver);
    resetRouteForm();
  };

  // Quick Driver Change handlers
  const handleOpenQuickDriver = (r: RouteConfig) => {
    const info = getRouteDriverInfo(r.routeName, r.driverName, r.driverContact);
    setQuickDriverRoute(r);
    setQuickDriverName(info.driverName);
    setQuickDriverPhone(info.driverContact);
    setQuickDriverSync(true);
    setQuickDriverFeedback(null);
  };

  const handleQuickDriverSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickDriverRoute) return;
    const cleanDriverName = sanitizeInput(quickDriverName, 140);
    const cleanDriverPhone = sanitizeInput(quickDriverPhone, 35);

    const updatedRoute: RouteConfig = {
      ...quickDriverRoute,
      driverName: cleanDriverName,
      driverContact: cleanDriverPhone,
    };

    onSaveRoute(updatedRoute, quickDriverSync);
    setQuickDriverFeedback(`Driver for "${quickDriverRoute.routeName}" updated to ${cleanDriverName || 'None'}.`);
    setTimeout(() => {
      setQuickDriverRoute(null);
      setQuickDriverFeedback(null);
    }, 1000);
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
    setStaffPasswordInput('');
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
    if (rawPass.length > 0) {
      finalHash = await hashStaffPassword(rawPass);
    }

    const savedMember: StaffMember = {
      id: editingStaff?.id || `staff_${cleanLogin.replace(/[^a-zA-Z0-9_]/g, '_')}`,
      name: cleanName,
      loginId: cleanLogin,
      passwordHash: finalHash,
      role: cleanRole,
      canEdit: staffCanEdit,
      active: staffActive,
      createdAt: editingStaff?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSaveStaffMember(savedMember);
    resetStaffForm();
  };

  const handleCopyStaffCredentials = (member: StaffMember) => {
    const text = `TAPF Kanpur Route Portal:\nLogin Email: ${member.loginId}\nRole: ${member.role}`;
    navigator.clipboard?.writeText(text);
    setCopiedStaffId(member.id);
    setTimeout(() => {
      setCopiedStaffId((prev) => (prev === member.id ? null : prev));
    }, 2500);
  };

  // Export Schools as CSV
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
      'School Category',
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
      ...schools.map((s) =>
        [
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
          escapeCsv(s.category),
        ].join(',')
      ),
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

  // Unified Design Tokens (60-30-10 neutral canvas, hairline borders, crisp legibility)
  const borderCol = isLight ? 'border-slate-200' : 'border-[#253b2f]';
  const dividerCol = isLight ? 'divide-slate-200' : 'divide-[#253b2f]';
  const mutedText = isLight ? 'text-slate-500' : 'text-[#9ab0a3]';
  const primaryText = isLight ? 'text-slate-900' : 'text-[#f2ede0]';
  const surfaceBg = isLight ? 'bg-white' : 'bg-[#13221a]';
  const subtleBg = isLight ? 'bg-slate-50' : 'bg-[#0f1b14]';
  const inputBaseClass = isLight
    ? 'bg-white border-slate-300 focus:border-blue-600 text-slate-900 placeholder-slate-400'
    : 'bg-[#0f1b14] border-[#2c4436] focus:border-amber-400 text-[#f2ede0] placeholder-[#688073]';
  const secondaryBtnClass = isLight
    ? 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
    : 'bg-[#192c22] hover:bg-[#223a2d] text-[#dce5df] border-[#2c4436]';
  const primaryBtnClass = isLight
    ? 'bg-slate-900 hover:bg-slate-800 text-white'
    : 'bg-amber-500 hover:bg-amber-400 text-[#12211a]';

  const navItems: {
    id: 'schools' | 'routes' | 'staff' | 'access' | 'audit';
    label: string;
    mobileLabel: string;
    count: number;
    icon: React.ReactNode;
    visible: boolean;
  }[] = [
    {
      id: 'schools',
      label: 'Schools',
      mobileLabel: 'Schools',
      count: schools.length,
      icon: <Layers className="w-4 h-4 shrink-0" />,
      visible: true,
    },
    {
      id: 'routes',
      label: 'Delivery Routes',
      mobileLabel: 'Routes',
      count: routes.length,
      icon: <RouteIcon className="w-4 h-4 shrink-0" />,
      visible: true,
    },
    {
      id: 'staff',
      label: 'TAPF Staff',
      mobileLabel: 'Staff',
      count: staffMembers.length,
      icon: <Users className="w-4 h-4 shrink-0" />,
      visible: isSuperAdmin,
    },
    {
      id: 'access',
      label: 'Email Access',
      mobileLabel: 'Access',
      count: activeAccessLogs.length,
      icon: <Mail className="w-4 h-4 shrink-0" />,
      visible: isSuperAdmin,
    },
    {
      id: 'audit',
      label: 'Audit Log',
      mobileLabel: 'Audit',
      count: logs.length,
      icon: <History className="w-4 h-4 shrink-0" />,
      visible: true,
    },
  ];

  const tabMeta: Record<'schools' | 'routes' | 'staff' | 'access' | 'audit', { title: string; subtitle: string }> = {
    schools: {
      title: 'Schools Directory',
      subtitle: `${schools.length} schools · ${routes.length} delivery routes`,
    },
    routes: {
      title: 'Delivery Routes',
      subtitle: `${routes.length} configured routes · Manage drivers and route assignments`,
    },
    staff: {
      title: 'TAPF Office Staff',
      subtitle: `${staffMembers.length} staff account${staffMembers.length === 1 ? '' : 's'} managed by Super Admin`,
    },
    access: {
      title: 'Email Access & Sessions',
      subtitle: `${activeAccessLogs.length} active (48h) · ${oldAccessLogs.length} old/revoked · ${uniqueAccessEmailsCount} unique emails`,
    },
    audit: {
      title: 'Security Audit Log',
      subtitle: `${logs.length} recorded administrative actions`,
    },
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-0 sm:p-4 lg:p-6"
      style={{
        zIndex: 6000,
        backgroundColor: isLight ? 'rgba(15, 23, 42, 0.52)' : 'rgba(6, 12, 9, 0.88)',
        backdropFilter: 'blur(6px)',
      }}
    >
      <div
        className={`relative w-full max-w-6xl h-dvh sm:h-[90dvh] sm:rounded-2xl border-0 sm:border shadow-2xl flex flex-col lg:flex-row overflow-hidden ${surfaceBg} ${borderCol} ${primaryText}`}
      >
        {/* DESKTOP LEFT SIDEBAR */}
        <aside className={`hidden lg:flex w-60 shrink-0 flex-col border-r ${subtleBg} ${borderCol}`}>
          {/* Brand Lockup */}
          <div className={`px-5 py-4 border-b flex items-center gap-3 ${borderCol}`}>
            <img
              src={TAPF_LOGO_URL}
              alt="The Akshaya Patra Foundation"
              className={`h-8 w-auto max-w-[84px] rounded-lg object-contain bg-white px-1.5 py-0.5 shrink-0 border ${
                isLight ? 'border-slate-200' : 'border-amber-500/30'
              }`}
              referrerPolicy="no-referrer"
            />
            <span className="font-heading font-bold text-sm tracking-tight whitespace-nowrap truncate">
              Admin Console
            </span>
          </div>

          {/* Primary Navigation */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {navItems
              .filter((item) => item.visible)
              .map((item) => {
                const isSelected = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-colors whitespace-nowrap ${
                      isSelected
                        ? isLight
                          ? 'bg-slate-900 text-white'
                          : 'bg-[#1f3629] text-amber-300'
                        : isLight
                          ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                          : 'text-[#a4b8ac] hover:text-white hover:bg-[#182b20]'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      {item.icon}
                      <span className="truncate">{item.label}</span>
                    </span>
                    <span
                      className={`text-xs font-mono tabular-nums ${
                        isSelected
                          ? isLight
                            ? 'text-slate-300'
                            : 'text-amber-300/90'
                          : mutedText
                      }`}
                    >
                      {item.count}
                    </span>
                  </button>
                );
              })}
          </nav>

          {/* Sidebar Account & Utility Footer */}
          <div className={`p-3.5 border-t space-y-3 ${borderCol}`}>
            <div className="px-1.5">
              <p className={`text-xs font-semibold truncate ${primaryText}`}>
                {isSuperAdmin ? currentUser?.displayName || 'Super Admin' : activeStaff?.name || 'Staff'}
              </p>
              <p className={`text-[11px] truncate ${mutedText}`}>
                {isSuperAdmin ? 'Super Admin' : activeStaff?.role || 'Office Staff'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {onToggleTheme && (
                <button
                  type="button"
                  onClick={onToggleTheme}
                  className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-colors whitespace-nowrap ${secondaryBtnClass}`}
                  title={isLight ? 'Switch to Dark Theme' : 'Switch to Light Theme'}
                >
                  {isLight ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5 text-amber-400" />}
                  <span>{isLight ? 'Dark' : 'Light'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleLogout}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-colors whitespace-nowrap ${
                  isLight
                    ? 'bg-white hover:bg-red-50 text-red-600 border-slate-200 hover:border-red-200'
                    : 'bg-[#192c22] hover:bg-red-950/60 text-red-300 border-[#2c4436]'
                }`}
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </aside>

        {/* MAIN WORKSPACE COLUMN */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* MOBILE TOP BAR + CONSISTENT RECTANGULAR ACTION BUTTONS & NAV TABS */}
          <div className={`lg:hidden shrink-0 border-b ${surfaceBg} ${borderCol}`}>
            <div className="px-3.5 pt-3 pb-2.5 space-y-2.5">
              {/* Brand Row */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={TAPF_LOGO_URL}
                    alt="The Akshaya Patra Foundation"
                    className={`h-7 w-auto max-w-[78px] rounded-md object-contain bg-white px-1 py-0.5 shrink-0 border ${
                      isLight ? 'border-slate-200' : 'border-amber-500/30'
                    }`}
                    referrerPolicy="no-referrer"
                  />
                  <div className="min-w-0">
                    <h2 className="font-heading font-bold text-sm leading-tight truncate">Admin Console</h2>
                    <p className={`text-[11px] truncate ${mutedText}`}>
                      {isSuperAdmin ? 'Super Admin' : activeStaff?.name}
                    </p>
                  </div>
                </div>
              </div>

              {/* Consistent Rectangular Top Action Buttons (Icon + Text Label) */}
              <div className={`grid gap-2 ${onToggleTheme ? 'grid-cols-3' : 'grid-cols-2'}`}>
                {onToggleTheme && (
                  <button
                    type="button"
                    onClick={onToggleTheme}
                    className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap ${secondaryBtnClass}`}
                    aria-label="Toggle Theme"
                  >
                    {isLight ? (
                      <Moon className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <Sun className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                    )}
                    <span>{isLight ? 'Dark' : 'Light'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap ${
                    isLight
                      ? 'bg-white text-red-600 border-red-200 hover:bg-red-50'
                      : 'bg-[#192c22] text-red-300 border-red-900/60 hover:bg-red-950/60'
                  }`}
                  aria-label="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5 shrink-0" />
                  <span>Sign Out</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap ${secondaryBtnClass}`}
                  aria-label="Close Admin Console"
                >
                  <X className="w-3.5 h-3.5 shrink-0" />
                  <span>Close</span>
                </button>
              </div>
            </div>

            {/* Consistent Rectangular Navigation Tabs on Mobile (Icon + Text Label + Count) */}
            <div className={`px-3.5 py-2 border-t flex items-center gap-2 overflow-x-auto no-scrollbar ${subtleBg} ${borderCol}`}>
              {navItems
                .filter((item) => item.visible)
                .map((item) => {
                  const isSelected = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveTab(item.id)}
                      className={`px-3 py-2 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                        isSelected
                          ? isLight
                            ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                            : 'bg-[#21382b] text-amber-300 border-amber-500/40 shadow-2xs'
                          : isLight
                            ? 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            : 'bg-[#13221a] text-[#b4c7bc] border-[#2c4436] hover:bg-[#1a2e23]'
                      }`}
                    >
                      {item.icon}
                      <span>{item.mobileLabel}</span>
                      <span
                        className={`font-mono text-[11px] tabular-nums ${
                          isSelected ? 'opacity-85' : mutedText
                        }`}
                      >
                        ({item.count})
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>

          {/* CONTEXTUAL WORKSPACE HEADER (Desktop & Mobile) */}
          <div className={`px-4 sm:px-6 py-3.5 border-b flex flex-wrap items-center justify-between gap-3 shrink-0 ${surfaceBg} ${borderCol}`}>
            <div className="min-w-0">
              <h3 className="font-heading font-bold text-base sm:text-lg leading-tight truncate">
                {tabMeta[activeTab].title}
              </h3>
              <p className={`text-xs mt-0.5 truncate tabular-nums ${mutedText}`}>
                {tabMeta[activeTab].subtitle}
              </p>
            </div>

            {/* Contextual Primary Actions (Consistent Rectangular Boxes with Icons & Text Labels) */}
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {activeTab === 'schools' && (
                <>
                  <button
                    type="button"
                    onClick={handleExportCSV}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap ${secondaryBtnClass}`}
                    title="Export complete 18-column CSV"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
                    <span>Export CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={onAddSchoolClick}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-transparent text-xs font-semibold transition-colors whitespace-nowrap ${primaryBtnClass}`}
                  >
                    <Plus className="w-3.5 h-3.5 shrink-0" />
                    <span>Add School</span>
                  </button>
                </>
              )}

              {activeTab === 'access' && isSuperAdmin && (
                <button
                  type="button"
                  role="switch"
                  aria-checked={orgVerificationEnabled}
                  disabled={isTogglingOrgVerification}
                  onClick={() => onToggleOrgVerification(!orgVerificationEnabled)}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap disabled:opacity-60 ${
                    orgVerificationEnabled
                      ? isLight
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700'
                        : 'bg-emerald-700 hover:bg-emerald-600 text-white border-emerald-600'
                      : secondaryBtnClass
                  }`}
                  title="Toggle Organization Email Verification Gate ON or OFF"
                >
                  <span
                    className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
                      orgVerificationEnabled ? 'bg-white/30' : isLight ? 'bg-slate-300' : 'bg-slate-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                        orgVerificationEnabled ? 'translate-x-3.5' : 'translate-x-0.5'
                      }`}
                    />
                  </span>
                  <span>Gate: {orgVerificationEnabled ? 'ON' : 'OFF'}</span>
                </button>
              )}

              {activeTab === 'audit' && isSuperAdmin && (
                <button
                  type="button"
                  disabled={logs.length === 0 || isClearingAudit}
                  onClick={() => setShowClearAuditModal(true)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap disabled:opacity-45 disabled:cursor-not-allowed ${
                    isLight
                      ? 'bg-red-600 hover:bg-red-700 text-white border-red-700'
                      : 'bg-red-700 hover:bg-red-600 text-white border-red-600'
                  }`}
                  title="Permanently clear all security audit logs (Super Admin only)"
                >
                  <Trash2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Clear Audit Data</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className={`hidden lg:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors ${secondaryBtnClass}`}
                title="Close Admin Console"
                aria-label="Close Admin Console"
              >
                <X className="w-3.5 h-3.5" />
                <span>Close</span>
              </button>
            </div>
          </div>

          {/* ================================================================
              TAB 1: SCHOOLS DIRECTORY
             ================================================================ */}
          {activeTab === 'schools' && (
            <div className="flex-1 flex flex-col min-h-0 px-4 sm:px-6 py-4 overflow-hidden">
              {/* Filter & Search Toolbar */}
              <div className="flex flex-col sm:flex-row gap-2.5 pb-4 shrink-0">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={adminSearch}
                    onChange={(e) => setAdminSearch(e.target.value)}
                    placeholder="Search school name, UDISE, node code, SPOC, or driver..."
                    className={`w-full pl-9 pr-8 py-2 border rounded-xl text-xs outline-hidden ${inputBaseClass}`}
                  />
                  {adminSearch && (
                    <button
                      type="button"
                      onClick={() => setAdminSearch('')}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 overflow-x-auto">
                  <select
                    value={adminRouteFilter}
                    onChange={(e) => setAdminRouteFilter(e.target.value)}
                    className={`px-3 py-2 border rounded-xl text-xs outline-hidden font-medium ${inputBaseClass}`}
                  >
                    <option value="ALL">All Routes ({schools.length})</option>
                    {routes.map((r) => (
                      <option key={r.id || r.routeName} value={r.routeName}>
                        {r.routeName} (
                        {schools.filter((s) => s.routeName?.toLowerCase() === r.routeName.toLowerCase()).length})
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={handleExportCSV}
                    className={`sm:hidden inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium shrink-0 ${secondaryBtnClass}`}
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>CSV</span>
                  </button>

                  {isSuperAdmin &&
                    (confirmReset ? (
                      <div
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs shrink-0 ${
                          isLight
                            ? 'bg-red-50 border-red-200 text-red-700'
                            : 'bg-red-950/60 border-red-800 text-red-200'
                        }`}
                      >
                        <span>Reset 129?</span>
                        <button
                          type="button"
                          onClick={() => {
                            onResetToDefault();
                            setConfirmReset(false);
                          }}
                          className="px-2 py-0.5 bg-red-600 text-white rounded-md font-semibold text-[11px]"
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmReset(false)}
                          className="px-1 text-[11px] opacity-80 hover:opacity-100"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmReset(true)}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium shrink-0 transition-colors ${secondaryBtnClass}`}
                        title="Reset to original 129 schools"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span className="hidden md:inline">Reset Default</span>
                      </button>
                    ))}
                </div>
              </div>

              {/* Clean Hairline List */}
              <div className={`flex-1 overflow-y-auto border rounded-xl divide-y ${borderCol} ${dividerCol}`}>
                {filteredSchools.length === 0 ? (
                  <div className={`p-10 text-center text-xs ${mutedText}`}>
                    No schools match your current filter.
                  </div>
                ) : (
                  filteredSchools.map((school) => {
                    const color = getRouteColor(school.routeName);
                    const canStaffEdit = isSuperAdmin || (activeStaff?.canEdit ?? true);
                    return (
                      <div
                        key={school.id}
                        className={`px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                          isLight ? 'hover:bg-slate-50/70' : 'hover:bg-[#172a20]'
                        }`}
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap text-xs">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: color }}
                            />
                            <span className="font-semibold" style={{ color }}>
                              {school.routeName}
                            </span>
                            {school.nodeCode && (
                              <span className={`font-mono tabular-nums ${mutedText}`}>
                                · {school.nodeCode}
                              </span>
                            )}
                            {school.udise && (
                              <span className={`font-mono tabular-nums ${mutedText}`}>
                                · UDISE {school.udise}
                              </span>
                            )}
                            <span className={mutedText}>· {school.category || 'Parishadiya'}</span>
                          </div>

                          <h4 className={`font-semibold text-sm leading-snug ${primaryText}`}>
                            {school.schoolName}
                          </h4>

                          <p className={`text-xs line-clamp-1 ${mutedText}`}>
                            {school.address || 'Kanpur'}
                            {school.pincode ? ` (${school.pincode})` : ''}
                          </p>

                          {(school.spocContact || school.driverContact) && (
                            <div className={`flex items-center gap-3 flex-wrap text-xs tabular-nums ${mutedText}`}>
                              {school.spocContact && (
                                <span>
                                  SPOC: <span className={primaryText}>{school.spocName || 'Incharge'}</span> ({school.spocContact})
                                </span>
                              )}
                              {school.driverContact && (
                                <span>
                                  Driver: <span className={primaryText}>{school.driverName || 'Driver'}</span> ({school.driverContact})
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          {canStaffEdit && (
                            <button
                              type="button"
                              onClick={() => onEditSchoolClick(school)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap ${secondaryBtnClass}`}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>
                          )}

                          {isSuperAdmin &&
                            (confirmDeleteId === school.id ? (
                              <div
                                className={`flex items-center gap-1 px-2 py-1 rounded-lg border ${
                                  isLight ? 'bg-red-50 border-red-200' : 'bg-red-950/60 border-red-800'
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    onDeleteSchool(school.id);
                                    setConfirmDeleteId(null);
                                  }}
                                  className="px-2 py-0.5 bg-red-600 text-white rounded text-[11px] font-semibold"
                                >
                                  Delete
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className={`px-1.5 text-[11px] ${mutedText}`}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(school.id)}
                                className={`p-2 rounded-lg border transition-colors ${
                                  isLight
                                    ? 'bg-white hover:bg-red-50 text-slate-400 hover:text-red-600 border-slate-200'
                                    : 'bg-[#192c22] hover:bg-red-950/60 text-slate-400 hover:text-red-400 border-[#2c4436]'
                                }`}
                                title="Delete school"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ================================================================
              TAB 2: DELIVERY ROUTES MANAGER
             ================================================================ */}
          {activeTab === 'routes' && (
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Form Column */}
                <div className={`lg:col-span-5 border rounded-xl p-4 sm:p-5 h-fit space-y-4 ${borderCol} ${subtleBg}`}>
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-heading font-bold">
                      {editingRoute ? `Edit ${editingRoute.routeName}` : 'Add Delivery Route'}
                    </h4>
                    {editingRoute && (
                      <button
                        type="button"
                        onClick={resetRouteForm}
                        className={`text-xs underline ${mutedText} hover:opacity-100`}
                      >
                        Cancel Edit
                      </button>
                    )}
                  </div>

                  {routeFormError && (
                    <div
                      className={`p-3 rounded-xl border text-xs ${
                        isLight ? 'bg-red-50 border-red-200 text-red-700' : 'bg-red-950/60 border-red-800 text-red-200'
                      }`}
                    >
                      {routeFormError}
                    </div>
                  )}

                  <form onSubmit={handleRouteFormSubmit} className="space-y-3.5 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className={`block mb-1 font-medium ${mutedText}`}>Route Name *</label>
                        <input
                          type="text"
                          required
                          value={routeNameInput}
                          onChange={(e) => setRouteNameInput(e.target.value)}
                          placeholder="e.g. KALYANPUR"
                          className={`w-full px-3 py-2 border rounded-xl outline-hidden ${inputBaseClass}`}
                        />
                      </div>
                      <div>
                        <label className={`block mb-1 font-medium ${mutedText}`}>Route Code</label>
                        <input
                          type="text"
                          value={routeCodeInput}
                          onChange={(e) => setRouteCodeInput(e.target.value)}
                          placeholder="RC00007"
                          className={`w-full px-3 py-2 border rounded-xl font-mono outline-hidden ${inputBaseClass}`}
                        />
                      </div>
                    </div>

                    <div>
                      <label className={`block mb-1.5 font-medium ${mutedText}`}>Map Pin Color</label>
                      <div className="flex items-center gap-2 flex-wrap">
                        {ROUTE_COLOR_PALETTE.map((hex) => (
                          <button
                            key={hex}
                            type="button"
                            onClick={() => setRouteColorInput(hex)}
                            className={`w-6 h-6 rounded-full transition-transform ${
                              routeColorInput === hex
                                ? isLight
                                  ? 'scale-115 ring-2 ring-offset-2 ring-slate-900'
                                  : 'scale-115 ring-2 ring-offset-2 ring-offset-[#0f1b14] ring-white'
                                : 'opacity-75 hover:opacity-100'
                            }`}
                            style={{ backgroundColor: hex }}
                            title={hex}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className={`block mb-1 font-medium ${mutedText}`}>Route Executive</label>
                        <input
                          type="text"
                          value={routeExecInput}
                          onChange={(e) => setRouteExecInput(e.target.value)}
                          placeholder="Ayush Gupta"
                          className={`w-full px-3 py-2 border rounded-xl outline-hidden ${inputBaseClass}`}
                        />
                      </div>
                      <div>
                        <label className={`block mb-1 font-medium ${mutedText}`}>Executive Phone</label>
                        <input
                          type="tel"
                          value={routeExecPhoneInput}
                          onChange={(e) => setRouteExecPhoneInput(e.target.value)}
                          placeholder="8299485052"
                          className={`w-full px-3 py-2 border rounded-xl font-mono outline-hidden ${inputBaseClass}`}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className={`block mb-1 font-medium ${mutedText}`}>Driver Name</label>
                        <input
                          type="text"
                          value={routeDriverInput}
                          onChange={(e) => setRouteDriverInput(e.target.value)}
                          placeholder="e.g. Rajesh"
                          className={`w-full px-3 py-2 border rounded-xl outline-hidden ${inputBaseClass}`}
                        />
                      </div>
                      <div>
                        <label className={`block mb-1 font-medium ${mutedText}`}>Driver Phone</label>
                        <input
                          type="tel"
                          value={routeDriverPhoneInput}
                          onChange={(e) => setRouteDriverPhoneInput(e.target.value)}
                          placeholder="9559796624"
                          className={`w-full px-3 py-2 border rounded-xl font-mono outline-hidden ${inputBaseClass}`}
                        />
                      </div>
                    </div>

                    <label className={`flex items-start gap-2.5 pt-1 text-xs cursor-pointer ${mutedText}`}>
                      <input
                        type="checkbox"
                        checked={routeSyncSchoolsWithDriver}
                        onChange={(e) => setRouteSyncSchoolsWithDriver(e.target.checked)}
                        className="mt-0.5 rounded accent-emerald-600 w-4 h-4 shrink-0"
                      />
                      <span>
                        Sync driver name &amp; phone to all schools in{' '}
                        {routeNameInput ? `"${routeNameInput}"` : 'this route'}.
                      </span>
                    </label>

                    <button
                      type="submit"
                      className={`w-full py-2.5 px-4 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors ${primaryBtnClass}`}
                    >
                      <Plus className="w-4 h-4" />
                      <span>{editingRoute ? 'Save Route Changes' : 'Create Route'}</span>
                    </button>
                  </form>
                </div>

                {/* Routes List Column */}
                <div className="lg:col-span-7 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-heading font-bold">Configured Routes ({routes.length})</h4>
                    <span className={`text-xs ${mutedText}`}>Click Change Driver for quick updates</span>
                  </div>

                  <div className={`border rounded-xl divide-y ${borderCol} ${dividerCol}`}>
                    {routes.map((r) => {
                      const count = schools.filter(
                        (s) => s.routeName?.toLowerCase() === r.routeName.toLowerCase()
                      ).length;
                      const driverInfo = getRouteDriverInfo(r.routeName, r.driverName, r.driverContact);

                      return (
                        <div
                          key={r.id || r.routeName}
                          className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                            isLight ? 'hover:bg-slate-50/70' : 'hover:bg-[#172a20]'
                          }`}
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            <span
                              className="w-3 h-3 rounded-full mt-1.5 shrink-0"
                              style={{ backgroundColor: r.color || '#7fb298' }}
                            />
                            <div className="min-w-0 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-sm">{r.routeName}</span>
                                <span className={`font-mono text-xs tabular-nums ${mutedText}`}>
                                  · {r.routeCode || 'RC'} · {count} schools
                                </span>
                              </div>
                              <div className={`text-xs flex flex-wrap items-center gap-x-3 gap-y-0.5 tabular-nums ${mutedText}`}>
                                <span>
                                  Driver:{' '}
                                  <strong className={primaryText}>{driverInfo.driverName || 'Not assigned'}</strong>
                                  {driverInfo.driverContact ? ` (${driverInfo.driverContact})` : ''}
                                </span>
                                <span>
                                  · Exec: {r.routeExecutive || 'Ayush Gupta'}
                                  {r.routeExecutiveContact ? ` (${r.routeExecutiveContact})` : ''}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                            <button
                              type="button"
                              onClick={() => handleOpenQuickDriver(r)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                                isLight
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                  : 'bg-emerald-700 hover:bg-emerald-600 text-white'
                              }`}
                            >
                              <Truck className="w-3.5 h-3.5" />
                              <span>Change Driver</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleStartEditRoute(r)}
                              className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1 whitespace-nowrap ${secondaryBtnClass}`}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>

                            {isSuperAdmin &&
                              (confirmDeleteRouteId === r.id ? (
                                <div
                                  className={`flex items-center gap-1 px-2 py-1 rounded-lg border ${
                                    isLight ? 'bg-red-50 border-red-200' : 'bg-red-950/60 border-red-800'
                                  }`}
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onDeleteRoute(r.id);
                                      setConfirmDeleteRouteId(null);
                                    }}
                                    className="px-2 py-0.5 bg-red-600 text-white rounded text-[11px] font-semibold"
                                  >
                                    Delete
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteRouteId(null)}
                                    className={`px-1 text-[11px] ${mutedText}`}
                                  >
                                    No
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteRouteId(r.id)}
                                  className={`p-2 rounded-lg border transition-colors ${
                                    isLight
                                      ? 'bg-white hover:bg-red-50 text-slate-400 hover:text-red-600 border-slate-200'
                                      : 'bg-[#192c22] hover:bg-red-950/60 text-slate-400 hover:text-red-400 border-[#2c4436]'
                                  }`}
                                  title="Delete Route"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================
              TAB 3: TAPF STAFF MEMBERS (SUPER ADMIN ONLY)
             ================================================================ */}
          {activeTab === 'staff' && isSuperAdmin && (
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Create / Edit Form */}
                <div className={`lg:col-span-5 border rounded-xl p-4 sm:p-5 h-fit space-y-4 ${borderCol} ${subtleBg}`}>
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-heading font-bold">
                      {editingStaff ? `Edit ${editingStaff.name}` : 'Create Staff Account'}
                    </h4>
                    {editingStaff && (
                      <button
                        type="button"
                        onClick={resetStaffForm}
                        className={`text-xs underline ${mutedText}`}
                      >
                        Cancel Edit
                      </button>
                    )}
                  </div>

                  {staffFormError && (
                    <div
                      className={`p-3 rounded-xl border text-xs ${
                        isLight ? 'bg-red-50 border-red-200 text-red-700' : 'bg-red-950/60 border-red-800 text-red-200'
                      }`}
                    >
                      {staffFormError}
                    </div>
                  )}

                  <form onSubmit={handleStaffFormSubmit} className="space-y-3.5 text-xs">
                    <div>
                      <label className={`block mb-1 font-medium ${mutedText}`}>Member Name *</label>
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
                      <label className={`block mb-1 font-medium ${mutedText}`}>Login Email / ID *</label>
                      <input
                        type="text"
                        required
                        value={staffLoginIdInput}
                        onChange={(e) => setStaffLoginIdInput(e.target.value)}
                        placeholder="e.g. ayush@kanpur-schools.org"
                        className={`w-full px-3 py-2 border rounded-xl font-mono outline-hidden ${inputBaseClass}`}
                      />
                    </div>

                    <div>
                      <label className={`block mb-1 font-medium ${mutedText}`}>
                        {editingStaff ? 'New Password (leave blank to keep current)' : 'Password *'}
                      </label>
                      <div className="relative">
                        <input
                          type={showStaffPass ? 'text' : 'password'}
                          required={!editingStaff}
                          value={staffPasswordInput}
                          onChange={(e) => setStaffPasswordInput(e.target.value)}
                          placeholder={editingStaff ? 'Enter new password' : 'Create password'}
                          className={`w-full pl-3 pr-9 py-2 border rounded-xl font-mono outline-hidden ${inputBaseClass}`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowStaffPass((prev) => !prev)}
                          className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700"
                        >
                          {showStaffPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className={`block mb-1 font-medium ${mutedText}`}>Role / Designation</label>
                      <input
                        type="text"
                        value={staffRoleInput}
                        onChange={(e) => setStaffRoleInput(e.target.value)}
                        placeholder="TAPF Route Coordinator"
                        className={`w-full px-3 py-2 border rounded-xl outline-hidden ${inputBaseClass}`}
                      />
                    </div>

                    <div className={`pt-2 border-t space-y-2.5 ${borderCol}`}>
                      <label className="flex items-center justify-between cursor-pointer">
                        <span className="font-medium">Allow editing existing schools</span>
                        <input
                          type="checkbox"
                          checked={staffCanEdit}
                          onChange={(e) => setStaffCanEdit(e.target.checked)}
                          className="accent-blue-600 w-4 h-4 rounded"
                        />
                      </label>
                      <label className="flex items-center justify-between cursor-pointer">
                        <span className="font-medium">Account active (can sign in)</span>
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
                      className={`w-full py-2.5 px-4 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors ${primaryBtnClass}`}
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>{editingStaff ? 'Save Member Changes' : 'Create Staff Account'}</span>
                    </button>
                  </form>
                </div>

                {/* Staff List */}
                <div className="lg:col-span-7 space-y-3">
                  <h4 className="text-sm font-heading font-bold">Managed Accounts ({staffMembers.length})</h4>

                  {staffMembers.length === 0 ? (
                    <div className={`p-10 rounded-xl border text-center space-y-1.5 ${borderCol} ${subtleBg}`}>
                      <p className="text-sm font-semibold">No staff accounts yet</p>
                      <p className={`text-xs ${mutedText}`}>
                        Create an account on the left to allow TAPF office staff to add or edit schools.
                      </p>
                    </div>
                  ) : (
                    <div className={`border rounded-xl divide-y ${borderCol} ${dividerCol}`}>
                      {staffMembers.map((member) => (
                        <div
                          key={member.id}
                          className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                            isLight ? 'hover:bg-slate-50/70' : 'hover:bg-[#172a20]'
                          }`}
                        >
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm">{member.name}</span>
                              <span className={`text-xs ${mutedText}`}>· {member.role}</span>
                              <span
                                className={`text-xs font-semibold ${
                                  member.active
                                    ? isLight
                                      ? 'text-emerald-700'
                                      : 'text-emerald-400'
                                    : isLight
                                      ? 'text-red-600'
                                      : 'text-red-400'
                                }`}
                              >
                                · {member.active ? 'Active' : 'Suspended'}
                              </span>
                            </div>
                            <div className={`text-xs font-mono flex items-center gap-2 flex-wrap ${mutedText}`}>
                              <span className={primaryText}>{member.loginId}</span>
                              <span>· {member.canEdit ? 'Can edit schools' : 'Add only'}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                            <button
                              type="button"
                              onClick={() => handleCopyStaffCredentials(member)}
                              className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1 whitespace-nowrap ${secondaryBtnClass}`}
                            >
                              {copiedStaffId === member.id ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                                  <span>Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleStartEditStaff(member)}
                              className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1 whitespace-nowrap ${secondaryBtnClass}`}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>

                            {confirmDeleteStaffId === member.id ? (
                              <div
                                className={`flex items-center gap-1 px-2 py-1 rounded-lg border ${
                                  isLight ? 'bg-red-50 border-red-200' : 'bg-red-950/60 border-red-800'
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    onDeleteStaffMember(member.id);
                                    setConfirmDeleteStaffId(null);
                                  }}
                                  className="px-2 py-0.5 bg-red-600 text-white rounded text-[11px] font-semibold"
                                >
                                  Remove
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteStaffId(null)}
                                  className={`px-1 text-[11px] ${mutedText}`}
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteStaffId(member.id)}
                                className={`p-2 rounded-lg border transition-colors ${
                                  isLight
                                    ? 'bg-white hover:bg-red-50 text-slate-400 hover:text-red-600 border-slate-200'
                                    : 'bg-[#192c22] hover:bg-red-950/60 text-slate-400 hover:text-red-400 border-[#2c4436]'
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
            </div>
          )}

          {/* ================================================================
              TAB 4: ORGANIZATION EMAIL ACCESS, ACTIVE USERS & CLEANUP (SUPER ADMIN)
             ================================================================ */}
          {activeTab === 'access' && isSuperAdmin && (
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-5">
              {/* Clean Flat Summary Strip (Single Elevation, Hairline Dividers) */}
              <div
                className={`grid grid-cols-2 sm:grid-cols-4 border rounded-xl divide-y sm:divide-y-0 sm:divide-x ${borderCol} ${dividerCol} ${subtleBg}`}
              >
                <div className="px-4 py-3">
                  <p className={`text-xs font-medium ${mutedText}`}>Active Users (48h)</p>
                  <p className={`text-xl font-heading font-bold mt-0.5 tabular-nums ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                    {activeAccessLogs.length}
                  </p>
                </div>
                <div className="px-4 py-3">
                  <p className={`text-xs font-medium ${mutedText}`}>Total Verifications</p>
                  <p className="text-xl font-heading font-bold mt-0.5 tabular-nums">
                    {accessLogs.length}
                  </p>
                </div>
                <div className="px-4 py-3">
                  <p className={`text-xs font-medium ${mutedText}`}>Unique Org Emails</p>
                  <p className="text-xl font-heading font-bold mt-0.5 tabular-nums">
                    {uniqueAccessEmailsCount}
                  </p>
                </div>
                <div className="px-4 py-3">
                  <p className={`text-xs font-medium ${mutedText}`}>Old / Removed</p>
                  <p className={`text-xl font-heading font-bold mt-0.5 tabular-nums ${mutedText}`}>
                    {oldAccessLogs.length}
                  </p>
                </div>
              </div>

              {/* Feedback Banner */}
              {revokeFeedback && (
                <div
                  className={`px-4 py-2.5 rounded-xl border text-xs font-medium flex items-center justify-between gap-2 ${
                    isLight
                      ? 'bg-slate-50 border-slate-300 text-slate-800'
                      : 'bg-[#192c22] border-[#2c4436] text-[#dce5df]'
                  }`}
                >
                  <span>{revokeFeedback}</span>
                  <button
                    type="button"
                    onClick={() => setRevokeFeedback(null)}
                    className="opacity-65 hover:opacity-100 shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Consistent Rectangular Sub-Navigation Tabs + Quick Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar max-w-full">
                  <button
                    type="button"
                    onClick={() => setAccessSubTab('active')}
                    className={`px-3 py-2 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                      accessSubTab === 'active'
                        ? isLight
                          ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                          : 'bg-[#21382b] text-amber-300 border-amber-500/40 shadow-2xs'
                        : secondaryBtnClass
                    }`}
                  >
                    <Users className="w-3.5 h-3.5 shrink-0" />
                    <span>Active Users ({activeAccessLogs.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccessSubTab('history')}
                    className={`px-3 py-2 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                      accessSubTab === 'history'
                        ? isLight
                          ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                          : 'bg-[#21382b] text-amber-300 border-amber-500/40 shadow-2xs'
                        : secondaryBtnClass
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    <span>Session History ({accessLogs.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccessSubTab('policy')}
                    className={`px-3 py-2 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                      accessSubTab === 'policy'
                        ? isLight
                          ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                          : 'bg-[#21382b] text-amber-300 border-amber-500/40 shadow-2xs'
                        : secondaryBtnClass
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5 shrink-0" />
                    <span>Firebase Policy</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={loadAccessLogsAndPolicy}
                    disabled={loadingAccessLogs}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors whitespace-nowrap ${secondaryBtnClass}`}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingAccessLogs ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>

                  {accessSubTab === 'active' && (
                    <button
                      type="button"
                      disabled={activeAccessLogs.length === 0 || isRevokingAll}
                      onClick={() => setShowRevokeAllModal(true)}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap disabled:opacity-45 disabled:cursor-not-allowed ${
                        isLight
                          ? 'bg-red-600 hover:bg-red-700 text-white'
                          : 'bg-red-700 hover:bg-red-600 text-white'
                      }`}
                    >
                      <UserX className="w-3.5 h-3.5" />
                      <span>Remove All Active ({activeAccessLogs.length})</span>
                    </button>
                  )}

                  {accessSubTab === 'history' && (
                    <>
                      {accessLogs.length > 0 && (
                        <button
                          type="button"
                          onClick={handleExportAccessLogsCSV}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors whitespace-nowrap ${secondaryBtnClass}`}
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                          <span>Export CSV</span>
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={oldAccessLogs.length === 0 || isClearingOld}
                        onClick={() => setShowClearOldModal(true)}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap disabled:opacity-45 disabled:cursor-not-allowed ${
                          isLight
                            ? 'bg-red-600 hover:bg-red-700 text-white'
                            : 'bg-red-700 hover:bg-red-600 text-white'
                        }`}
                        title="Permanently delete all previously removed and expired records without affecting active users"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Clear All Old Records ({oldAccessLogs.length})</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* SUB-VIEW 1: CURRENTLY ACTIVE USERS */}
              {accessSubTab === 'active' && (
                <div className="space-y-4">
                  <div className={`border rounded-xl divide-y ${borderCol} ${dividerCol}`}>
                    {loadingAccessLogs && accessLogs.length === 0 ? (
                      <div className={`p-8 text-center text-xs ${mutedText}`}>
                        Loading active user sessions from Firebase...
                      </div>
                    ) : activeAccessLogs.length === 0 ? (
                      <div className="p-8 text-center space-y-3">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold">No active 48-hour sessions right now</p>
                          <p className={`text-xs max-w-md mx-auto ${mutedText}`}>
                            When users verify their organization email, their active session appears here in real time. You can also verify this device below.
                          </p>
                        </div>
                        <form onSubmit={handleQuickVerifyInAdmin} className="max-w-sm mx-auto flex gap-2 pt-1">
                          <input
                            type="email"
                            value={quickVerifyEmailInput}
                            onChange={(e) => setQuickVerifyEmailInput(e.target.value)}
                            placeholder="Verify organization email..."
                            className={`flex-1 px-3 py-2 border rounded-xl text-xs outline-hidden ${inputBaseClass}`}
                          />
                          <button
                            type="submit"
                            disabled={isQuickVerifying}
                            className={`px-4 py-2 rounded-xl font-semibold text-xs shrink-0 whitespace-nowrap ${primaryBtnClass}`}
                          >
                            {isQuickVerifying ? 'Verifying...' : 'Verify'}
                          </button>
                        </form>
                      </div>
                    ) : (
                      activeAccessLogs.map((entry) => {
                        const isRemovingThis = revokingEntryId === entry.id;
                        const isCurrentBrowser = currentOrgSession?.logId === entry.id;
                        return (
                          <div
                            key={`active_${entry.id}`}
                            className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                              isLight ? 'hover:bg-slate-50/70' : 'hover:bg-[#172a20]'
                            }`}
                          >
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono font-semibold text-sm break-all">
                                  {entry.email}
                                </span>
                                <span
                                  className={`text-xs font-semibold tabular-nums ${
                                    isLight ? 'text-emerald-700' : 'text-emerald-400'
                                  }`}
                                >
                                  · Active ({formatRemaining48h(entry.expiresAtMs)})
                                </span>
                                {isCurrentBrowser && (
                                  <span className={`text-xs font-medium ${isLight ? 'text-blue-600' : 'text-amber-400'}`}>
                                    · This device
                                  </span>
                                )}
                              </div>

                              <div className={`text-xs flex flex-wrap items-center gap-x-3 gap-y-0.5 tabular-nums ${mutedText}`}>
                                <span>Verified: {entry.accessedAt}</span>
                                <span>· Expires: {entry.expiresAt}</span>
                                <span>· {entry.deviceInfo || 'Web Browser'}</span>
                              </div>
                            </div>

                            <button
                              type="button"
                              disabled={isRemovingThis || isRevokingAll}
                              onClick={() => handleRevokeSingleUser(entry)}
                              className={`shrink-0 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap disabled:opacity-50 ${
                                isLight
                                  ? 'bg-white hover:bg-red-50 text-red-600 border-red-200'
                                  : 'bg-[#192c22] hover:bg-red-950/60 text-red-300 border-red-900/60'
                              }`}
                            >
                              <UserX className="w-3.5 h-3.5" />
                              <span>{isRemovingThis ? 'Removing...' : 'Remove'}</span>
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Quick shortcut to clear old records if any exist while viewing Active tab */}
                  {oldAccessLogs.length > 0 && (
                    <div className={`px-4 py-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${subtleBg} ${borderCol}`}>
                      <p className={`text-xs tabular-nums ${mutedText}`}>
                        You have <strong className={primaryText}>{oldAccessLogs.length}</strong> old or removed record{oldAccessLogs.length === 1 ? '' : 's'} in history.
                      </p>
                      <button
                        type="button"
                        disabled={isClearingOld}
                        onClick={() => setShowClearOldModal(true)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap self-start sm:self-auto ${
                          isLight
                            ? 'bg-white hover:bg-red-50 text-red-600 border-red-200'
                            : 'bg-[#192c22] hover:bg-red-950/60 text-red-300 border-red-900/60'
                        }`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Clear All Old Records ({oldAccessLogs.length})</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* SUB-VIEW 2: COMPLETE SESSION HISTORY & OLD RECORD CLEANUP */}
              {accessSubTab === 'history' && (
                <div className="space-y-3.5">
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <div className={`inline-flex p-1 rounded-xl border shrink-0 self-start ${subtleBg} ${borderCol}`}>
                      {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((filterKey) => {
                        const label =
                          filterKey === 'ALL'
                            ? `All (${accessLogs.length})`
                            : filterKey === 'ACTIVE'
                              ? `Active (${activeAccessLogs.length})`
                              : `Old / Removed (${oldAccessLogs.length})`;
                        return (
                          <button
                            key={filterKey}
                            type="button"
                            onClick={() => setAccessLogFilter(filterKey)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                              accessLogFilter === filterKey
                                ? isLight
                                  ? 'bg-white text-slate-900 shadow-2xs'
                                  : 'bg-[#21382b] text-amber-300'
                                : mutedText
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="relative flex-1">
                      <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        value={accessLogSearch}
                        onChange={(e) => setAccessLogSearch(e.target.value)}
                        placeholder="Search by email ID, date, or device..."
                        className={`w-full pl-9 pr-3 py-2 border rounded-xl text-xs outline-hidden ${inputBaseClass}`}
                      />
                    </div>
                  </div>

                  <div className={`border rounded-xl divide-y ${borderCol} ${dividerCol}`}>
                    {loadingAccessLogs && accessLogs.length === 0 ? (
                      <div className={`p-8 text-center text-xs ${mutedText}`}>
                        Loading Firebase access history...
                      </div>
                    ) : filteredAccessLogs.length === 0 ? (
                      <div className={`p-8 text-center text-xs ${mutedText}`}>
                        No session records match your filter.
                      </div>
                    ) : (
                      filteredAccessLogs.map((entry) => {
                        const revoked = isEntryRevoked(entry);
                        const active = isEntryActive(entry);
                        const isRemovingThis = revokingEntryId === entry.id;
                        return (
                          <div
                            key={entry.id}
                            className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                              isLight ? 'hover:bg-slate-50/70' : 'hover:bg-[#172a20]'
                            }`}
                          >
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono font-semibold text-sm break-all">
                                  {entry.email}
                                </span>
                                <span
                                  className={`text-xs font-semibold tabular-nums ${
                                    revoked
                                      ? isLight
                                        ? 'text-red-600'
                                        : 'text-red-400'
                                      : active
                                        ? isLight
                                          ? 'text-emerald-700'
                                          : 'text-emerald-400'
                                        : mutedText
                                  }`}
                                >
                                  ·{' '}
                                  {revoked
                                    ? 'Removed'
                                    : active
                                      ? `Active (${formatRemaining48h(entry.expiresAtMs)})`
                                      : 'Expired'}
                                </span>
                              </div>

                              <div className={`text-xs flex flex-wrap items-center gap-x-3 gap-y-0.5 tabular-nums ${mutedText}`}>
                                <span>Accessed: {entry.accessedAt}</span>
                                <span>
                                  ·{' '}
                                  {revoked
                                    ? entry.revokedAt
                                      ? `Removed: ${entry.revokedAt}`
                                      : 'Removed before 48h expiry'
                                    : `Valid until: ${entry.expiresAt}`}
                                </span>
                                {entry.deviceInfo && <span>· {entry.deviceInfo}</span>}
                              </div>
                            </div>

                            {active && (
                              <button
                                type="button"
                                disabled={isRemovingThis || isRevokingAll}
                                onClick={() => handleRevokeSingleUser(entry)}
                                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap self-end sm:self-center disabled:opacity-50 ${
                                  isLight
                                    ? 'bg-white hover:bg-red-50 text-red-600 border-red-200'
                                    : 'bg-[#192c22] hover:bg-red-950/60 text-red-300 border-red-900/60'
                                }`}
                              >
                                <UserX className="w-3.5 h-3.5" />
                                <span>{isRemovingThis ? 'Removing...' : 'Remove'}</span>
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* SUB-VIEW 3: PRIVATE FIREBASE VERIFICATION POLICY */}
              {accessSubTab === 'policy' && (
                <div className="space-y-4">
                  <div className={`p-4 rounded-xl border ${subtleBg} ${borderCol}`}>
                    <div className="flex items-center gap-2">
                      <Globe className={`w-4 h-4 ${isLight ? 'text-blue-600' : 'text-amber-400'}`} />
                      <h4 className="text-sm font-heading font-bold">Private Firebase Backend Allowlist</h4>
                    </div>
                    <p className={`text-xs mt-1 leading-relaxed ${mutedText}`}>
                      Rules and authorized email entries are stored privately in Firebase backend and are never exposed in public source code. The default organization backend rule stays active automatically unless custom domains are added below.
                    </p>
                  </div>

                  {policyStatusMsg && (
                    <div
                      className={`px-4 py-2.5 rounded-xl border text-xs font-medium ${
                        isLight
                          ? 'bg-blue-50 border-blue-200 text-blue-800'
                          : 'bg-emerald-950/50 border-emerald-800 text-emerald-200'
                      }`}
                    >
                      {policyStatusMsg}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Custom Allowed Domains */}
                    <div className={`border rounded-xl p-4 space-y-3 ${borderCol}`}>
                      <div>
                        <h5 className="text-xs font-bold">Custom Allowed Domains</h5>
                        <p className={`text-[11px] mt-0.5 ${mutedText}`}>
                          Optional override domains evaluated in Firebase backend rules.
                        </p>
                      </div>

                      <form onSubmit={handleAddPolicyDomain} className="flex gap-2">
                        <input
                          type="text"
                          value={newDomainInput}
                          onChange={(e) => setNewDomainInput(e.target.value)}
                          placeholder="e.g. organization.org"
                          className={`flex-1 px-3 py-2 border rounded-xl text-xs font-mono outline-hidden ${inputBaseClass}`}
                        />
                        <button
                          type="submit"
                          disabled={savingPolicy}
                          className={`px-3.5 py-2 rounded-xl font-semibold text-xs shrink-0 ${primaryBtnClass}`}
                        >
                          Add
                        </button>
                      </form>

                      <div className={`border rounded-xl divide-y ${borderCol} ${dividerCol}`}>
                        {(orgPolicy?.allowedDomains || []).length === 0 ? (
                          <p className={`p-3 text-xs ${mutedText}`}>
                            Using default Firebase backend organization domain rule.
                          </p>
                        ) : (
                          (orgPolicy?.allowedDomains || []).map((domain) => (
                            <div key={domain} className="px-3 py-2 flex items-center justify-between gap-2 text-xs font-mono">
                              <span className="truncate">@{domain}</span>
                              <button
                                type="button"
                                onClick={() => handleRemovePolicyDomain(domain)}
                                className="text-red-500 hover:text-red-700 p-1"
                                title="Remove domain"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Additional Authorized Individual Emails */}
                    <div className={`border rounded-xl p-4 space-y-3 ${borderCol}`}>
                      <div>
                        <h5 className="text-xs font-bold">Additional Authorized Email IDs</h5>
                        <p className={`text-[11px] mt-0.5 ${mutedText}`}>
                          Grant access to specific individual emails without opening their entire domain.
                        </p>
                      </div>

                      <form onSubmit={handleAddPolicyEmail} className="flex gap-2">
                        <input
                          type="email"
                          value={newEmailInput}
                          onChange={(e) => setNewEmailInput(e.target.value)}
                          placeholder="Enter specific email address"
                          className={`flex-1 px-3 py-2 border rounded-xl text-xs font-mono outline-hidden ${inputBaseClass}`}
                        />
                        <button
                          type="submit"
                          disabled={savingPolicy}
                          className={`px-3.5 py-2 rounded-xl font-semibold text-xs shrink-0 ${
                            isLight
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              : 'bg-emerald-700 hover:bg-emerald-600 text-white'
                          }`}
                        >
                          Add
                        </button>
                      </form>

                      <div className={`border rounded-xl divide-y max-h-52 overflow-y-auto ${borderCol} ${dividerCol}`}>
                        {(orgPolicy?.authorizedEmails || []).length === 0 ? (
                          <p className={`p-3 text-xs ${mutedText}`}>
                            No extra individual emails added.
                          </p>
                        ) : (
                          (orgPolicy?.authorizedEmails || []).map((email) => (
                            <div key={email} className="px-3 py-2 flex items-center justify-between gap-2 text-xs font-mono">
                              <span className="truncate">{email}</span>
                              <button
                                type="button"
                                onClick={() => handleRemovePolicyEmail(email)}
                                className="text-red-500 hover:text-red-700 p-1 shrink-0"
                                title="Remove email"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================================================================
              TAB 5: SECURITY AUDIT LOGS
             ================================================================ */}
          {activeTab === 'audit' && (
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-4">
              {auditFeedback && (
                <div
                  className={`px-4 py-2.5 rounded-xl border text-xs font-medium flex items-center justify-between gap-2 ${
                    isLight
                      ? 'bg-slate-50 border-slate-300 text-slate-800'
                      : 'bg-[#192c22] border-[#2c4436] text-[#dce5df]'
                  }`}
                >
                  <span>{auditFeedback}</span>
                  <button
                    type="button"
                    onClick={() => setAuditFeedback(null)}
                    className="opacity-65 hover:opacity-100 shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className={`border rounded-xl divide-y ${borderCol} ${dividerCol}`}>
                {logs.length === 0 ? (
                  <div className={`p-10 text-center text-xs ${mutedText}`}>
                    No administrative actions recorded yet.
                  </div>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="px-4 py-3.5 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap text-xs font-mono tabular-nums">
                        <span className={`font-semibold ${isLight ? 'text-blue-700' : 'text-amber-400'}`}>
                          {log.action.replace(/_/g, ' ')}
                        </span>
                        <span className={mutedText}>· {log.timestamp}</span>
                        <span className={mutedText}>· {log.adminEmail}</span>
                      </div>
                      <p className="text-xs leading-relaxed">{log.summary}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ====================================================================
          CONFIRMATION POPUP: CLEAR ALL AUDIT DATA (SUPER ADMIN ONLY)
         ==================================================================== */}
      {showClearAuditModal && isSuperAdmin && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs"
          style={{ zIndex: 6200 }}
        >
          <div
            className={`w-full max-w-md rounded-2xl border shadow-2xl p-6 space-y-4 ${surfaceBg} ${borderCol} ${primaryText}`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`p-2.5 rounded-xl shrink-0 ${
                  isLight ? 'bg-red-50 text-red-600' : 'bg-red-950/70 text-red-400'
                }`}
              >
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1 min-w-0">
                <h4 className="font-heading font-bold text-base">Clear All Audit Data?</h4>
                <p className={`text-xs leading-relaxed ${mutedText}`}>
                  This will permanently delete{' '}
                  <strong className={primaryText}>
                    {logs.length} security audit record{logs.length === 1 ? '' : 's'}
                  </strong>{' '}
                  from Firebase. This Super Admin action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={isClearingAudit}
                onClick={() => setShowClearAuditModal(false)}
                className={`px-4 py-2 rounded-lg border text-xs font-semibold transition-colors ${secondaryBtnClass}`}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isClearingAudit}
                onClick={handleClearAllAuditLogs}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-60"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isClearingAudit ? 'Clearing...' : 'Permanently Clear'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          CONFIRMATION POPUP: CLEAR ALL OLD RECORDS
         ==================================================================== */}
      {showClearOldModal && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs"
          style={{ zIndex: 6200 }}
        >
          <div
            className={`w-full max-w-md rounded-2xl border shadow-2xl p-6 space-y-4 ${surfaceBg} ${borderCol} ${primaryText}`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`p-2.5 rounded-xl shrink-0 ${
                  isLight ? 'bg-red-50 text-red-600' : 'bg-red-950/70 text-red-400'
                }`}
              >
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1 min-w-0">
                <h4 className="font-heading font-bold text-base">Clear All Old Records?</h4>
                <p className={`text-xs leading-relaxed ${mutedText}`}>
                  This will permanently delete{' '}
                  <strong className={primaryText}>
                    {oldAccessLogs.length} previously removed / expired record{oldAccessLogs.length === 1 ? '' : 's'}
                  </strong>{' '}
                  and their session history from Firebase. This action cannot be undone.
                </p>
              </div>
            </div>

            <div
              className={`px-3.5 py-2.5 rounded-xl border text-xs ${
                isLight
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800'
                  : 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
              }`}
            >
              <strong className="tabular-nums">{activeAccessLogs.length}</strong> currently active user
              {activeAccessLogs.length === 1 ? '' : 's'} will remain signed in and will NOT be affected.
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={isClearingOld}
                onClick={() => setShowClearOldModal(false)}
                className={`px-4 py-2 rounded-xl border text-xs font-semibold transition-colors ${secondaryBtnClass}`}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isClearingOld}
                onClick={handleClearAllOldRecords}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-60"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isClearingOld ? 'Clearing...' : 'Permanently Clear'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          CONFIRMATION POPUP: REMOVE ALL ACTIVE USERS
         ==================================================================== */}
      {showRevokeAllModal && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs"
          style={{ zIndex: 6200 }}
        >
          <div
            className={`w-full max-w-md rounded-2xl border shadow-2xl p-6 space-y-4 ${surfaceBg} ${borderCol} ${primaryText}`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`p-2.5 rounded-xl shrink-0 ${
                  isLight ? 'bg-red-50 text-red-600' : 'bg-red-950/70 text-red-400'
                }`}
              >
                <UserX className="w-5 h-5" />
              </div>
              <div className="space-y-1 min-w-0">
                <h4 className="font-heading font-bold text-base">Remove All Active Users?</h4>
                <p className={`text-xs leading-relaxed ${mutedText}`}>
                  All <strong className={primaryText}>{activeAccessLogs.length} active user{activeAccessLogs.length === 1 ? '' : 's'}</strong>{' '}
                  will be signed out immediately before their 48-hour verification window expires and will need to re-verify their organization email to open the app.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={isRevokingAll}
                onClick={() => setShowRevokeAllModal(false)}
                className={`px-4 py-2 rounded-xl border text-xs font-semibold transition-colors ${secondaryBtnClass}`}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isRevokingAll}
                onClick={handleRevokeAllActiveUsers}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-60"
              >
                <UserX className="w-3.5 h-3.5" />
                <span>{isRevokingAll ? 'Removing...' : 'Remove All Active'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          QUICK DRIVER CHANGE MODAL OVERLAY
         ==================================================================== */}
      {quickDriverRoute && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs"
          style={{ zIndex: 6200 }}
        >
          <div
            className={`w-full max-w-md rounded-2xl border shadow-2xl p-5 space-y-4 ${surfaceBg} ${borderCol} ${primaryText}`}
          >
            <div className={`flex items-center justify-between pb-3 border-b ${borderCol}`}>
              <div className="flex items-center gap-2.5">
                <span
                  className="w-3 h-6 rounded-full shrink-0"
                  style={{ backgroundColor: quickDriverRoute.color || '#10b981' }}
                />
                <div>
                  <h4 className="font-heading font-bold text-sm">Change Route Driver</h4>
                  <p className={`text-xs ${mutedText}`}>
                    {quickDriverRoute.routeName} ·{' '}
                    {schools.filter((s) => s.routeName?.toLowerCase() === quickDriverRoute.routeName.toLowerCase()).length}{' '}
                    schools
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setQuickDriverRoute(null);
                  setQuickDriverFeedback(null);
                }}
                className={`p-1.5 rounded-lg border ${secondaryBtnClass}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {quickDriverFeedback && (
              <div
                className={`p-2.5 rounded-xl border text-xs font-medium flex items-center gap-2 ${
                  isLight
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-emerald-950/50 border-emerald-800 text-emerald-300'
                }`}
              >
                <Check className="w-4 h-4 shrink-0" />
                <span>{quickDriverFeedback}</span>
              </div>
            )}

            <form onSubmit={handleQuickDriverSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className={`block mb-1 font-medium ${mutedText}`}>Driver Full Name *</label>
                <input
                  type="text"
                  required
                  value={quickDriverName}
                  onChange={(e) => setQuickDriverName(e.target.value)}
                  placeholder="e.g. Rajesh, Ankush, Vimlesh"
                  className={`w-full px-3 py-2 border rounded-xl outline-hidden ${inputBaseClass}`}
                  autoFocus
                />
              </div>

              <div>
                <label className={`block mb-1 font-medium ${mutedText}`}>Driver Contact Number</label>
                <input
                  type="tel"
                  value={quickDriverPhone}
                  onChange={(e) => setQuickDriverPhone(e.target.value)}
                  placeholder="e.g. 9559796624"
                  className={`w-full px-3 py-2 border rounded-xl font-mono outline-hidden ${inputBaseClass}`}
                />
              </div>

              <label className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer ${subtleBg} ${borderCol}`}>
                <input
                  type="checkbox"
                  checked={quickDriverSync}
                  onChange={(e) => setQuickDriverSync(e.target.checked)}
                  className="mt-0.5 rounded accent-emerald-600 w-4 h-4 shrink-0"
                />
                <span className={`leading-relaxed ${mutedText}`}>
                  Sync driver name and phone across all{' '}
                  {schools.filter((s) => s.routeName?.toLowerCase() === quickDriverRoute.routeName.toLowerCase()).length}{' '}
                  schools in &ldquo;{quickDriverRoute.routeName}&rdquo;.
                </span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setQuickDriverRoute(null);
                    setQuickDriverFeedback(null);
                  }}
                  className={`px-4 py-2 rounded-xl border font-semibold ${secondaryBtnClass}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 rounded-xl font-semibold text-white inline-flex items-center gap-1.5 ${
                    isLight ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-emerald-700 hover:bg-emerald-600'
                  }`}
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>Save &amp; Sync</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
