import React, { useState, useMemo, useEffect } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { 
  School, 
  RouteConfig, 
  StaffMember, 
  DEFAULT_ROUTES, 
  TAPF_LOGO_URL, 
  getRouteColor, 
  syncRouteColors 
} from './types';
import { INITIAL_SCHOOLS, getStoredSchools, saveSchoolsToStorage, resetSchoolsToDefault } from './data/schoolsData';
import { SchoolCard } from './components/SchoolCard';
import { SchoolDrawer } from './components/SchoolDrawer';
import { MapComponent } from './components/MapComponent';
import { NoticeModal } from './components/NoticeModal';
import { ExcelUploadModal } from './components/ExcelUploadModal';
import { AdminPanelModal } from './components/AdminPanelModal';
import { SchoolFormModal } from './components/SchoolFormModal';
import { AdminLoginModal } from './components/AdminLoginModal';
import { 
  logSecurityAudit, 
  getStoredRoutes, 
  saveRoutesToStorage,
  getStoredStaffMembers,
  saveStaffMembersToStorage,
  getLoggedInStaff,
  setLoggedInStaff,
  logoutAdmin
} from './utils/security';
import { 
  db, 
  auth, 
  onAuthStateChanged, 
  isAuthorizedAdminUser, 
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  query,
  where,
  handleFirestoreError,
  OperationType,
  AUTHORIZED_ADMIN_EMAIL,
  User
} from './firebase';
import { 
  Search, 
  X, 
  Map as MapIcon, 
  List as ListIcon, 
  FileSpreadsheet, 
  Info, 
  RotateCcw,
  Plus, 
  CheckCircle, 
  Building2,
  Lock,
  ShieldCheck,
  LogOut,
  Route as RouteIcon,
  Users,
  Sun,
  Moon
} from 'lucide-react';

const GOOGLE_MAPS_API_KEY =
  (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY || '';

const THEME_STORAGE_KEY = 'mdm_theme_mode_v1';

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; errorMessage: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMessage: error?.message || 'Unexpected UI error' };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Application Error Boundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-[#111e17] text-[#f2ede0] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#16271e] border border-[#2c4436] rounded-2xl p-6 shadow-2xl space-y-4 text-center">
            <h2 className="text-lg font-heading font-semibold text-amber-400">
              Interface Recovery Mode
            </h2>
            <p className="text-xs text-[#a4b3ab] break-words">
              {this.state.errorMessage}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, errorMessage: '' });
                window.location.reload();
              }}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#12211a] font-bold text-xs transition-all"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function MainApp() {
  const [schools, setSchools] = useState<School[]>(() => getStoredSchools());
  const [routes, setRoutes] = useState<RouteConfig[]>(() => getStoredRoutes());
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>(() => getStoredStaffMembers());

  // Theme state ('light' | 'dark') persisted in localStorage, defaulting to 'light'
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {
      // Fallback
    }
    return 'light';
  });

  const isLight = theme === 'light';

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        // Ignore storage error
      }
      return next;
    });
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [activeRoute, setActiveRoute] = useState<string>('ALL');
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  
  // Mobile active view tab: 'list' | 'map'
  const [mobileTab, setMobileTab] = useState<'list' | 'map'>('list');

  // Firebase Auth User State + TAPF Staff Session State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeStaff, setActiveStaff] = useState<StaffMember | null>(() => getLoggedInStaff());
  const [authReady, setAuthReady] = useState(false);

  const isSuperAdmin = useMemo(() => isAuthorizedAdminUser(currentUser), [currentUser]);
  const isAdmin = useMemo(() => isSuperAdmin || Boolean(activeStaff), [isSuperAdmin, activeStaff]);
  const canEditSchools = useMemo(
    () => isSuperAdmin || Boolean(activeStaff?.canEdit ?? true),
    [isSuperAdmin, activeStaff]
  );

  // Modals state
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [adminInitialTab, setAdminInitialTab] = useState<'schools' | 'routes' | 'staff' | 'audit'>('schools');
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [schoolToEdit, setSchoolToEdit] = useState<School | null>(null);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [showNoticeModal, setShowNoticeModal] = useState(false);

  // Google Auth / Staff Login Modal
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<'ADMIN' | 'ADD' | 'EDIT' | 'IMPORT' | 'ROUTES' | 'STAFF' | null>(null);
  const [pendingSchoolToEdit, setPendingSchoolToEdit] = useState<School | null>(null);

  // Quota exceeded state (Tier 2 in-app defense)
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  // Listen for Google Maps quota exceeded event
  useEffect(() => {
    const handleQuotaExceeded = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    return () => {
      window.removeEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    };
  }, []);

  // Listen to Firebase Auth state changes
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Real-time Firestore listener for schools (Public Read)
  useEffect(() => {
    if (!authReady) return;

    const schoolsQuery = query(collection(db, 'schools'), where('lat', '>=', -90));
    const unsub = onSnapshot(
      schoolsQuery,
      async (snapshot) => {
        if (!snapshot.empty) {
          const cloudSchools: School[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as School;
            if (data && data.schoolName) {
              cloudSchools.push(data);
            }
          });
          cloudSchools.sort((a, b) => (a.id || 0) - (b.id || 0));
          setSchools(cloudSchools);
          saveSchoolsToStorage(cloudSchools);
        } else if (isAuthorizedAdminUser(auth.currentUser)) {
          // Automatically seed initial 129 schools to Firestore when authorized Super Admin signs in
          try {
            const batch = writeBatch(db);
            INITIAL_SCHOOLS.forEach((school) => {
              const docRef = doc(db, 'schools', `school_${school.id}`);
              batch.set(docRef, {
                ...school,
                updatedBy: AUTHORIZED_ADMIN_EMAIL,
                updatedAt: new Date().toISOString(),
              });
            });
            await batch.commit();
          } catch (err) {
            console.warn('Initial Firestore seed skipped or failed:', err);
          }
        }
      },
      (error) => {
        console.warn('Firestore schools snapshot fallback to local cache:', error);
      }
    );

    return () => unsub();
  }, [authReady, currentUser]);

  // Real-time Firestore listener for routes (Public Read)
  useEffect(() => {
    if (!authReady) return;

    const routesQuery = query(collection(db, 'routes'), where('routeName', '>=', ''));
    const unsub = onSnapshot(
      routesQuery,
      async (snapshot) => {
        if (!snapshot.empty) {
          const cloudRoutes: RouteConfig[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as RouteConfig;
            if (data && data.routeName) {
              cloudRoutes.push(data);
            }
          });
          syncRouteColors(cloudRoutes);
          setRoutes(cloudRoutes);
          saveRoutesToStorage(cloudRoutes);
        } else if (isAuthorizedAdminUser(auth.currentUser)) {
          try {
            const batch = writeBatch(db);
            DEFAULT_ROUTES.forEach((r) => {
              batch.set(doc(db, 'routes', r.id), {
                ...r,
                createdAt: new Date().toISOString(),
              });
            });
            await batch.commit();
          } catch (err) {
            console.warn('Initial routes seed skipped:', err);
          }
        }
      },
      (error) => {
        console.warn('Firestore routes snapshot fallback to local cache:', error);
      }
    );

    return () => unsub();
  }, [authReady, currentUser]);

  // Real-time Firestore listener for TAPF Staff Members (when Super Admin is logged in)
  useEffect(() => {
    if (!authReady || !isSuperAdmin) return;

    const unsub = onSnapshot(
      collection(db, 'staff_members'),
      (snapshot) => {
        const list: StaffMember[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as StaffMember;
          if (data && data.id) {
            list.push(data);
          }
        });
        setStaffMembers(list);
        saveStaffMembersToStorage(list);
      },
      (error) => {
        console.warn('Firestore staff snapshot fallback to local cache:', error);
      }
    );

    return () => unsub();
  }, [authReady, isSuperAdmin]);

  // Compute available routes dynamically from both configured routes and school records
  const availableRoutes = useMemo(() => {
    const routeSet = new Set<string>();
    routes.forEach((r) => {
      if (r.routeName && r.routeName.trim()) {
        routeSet.add(r.routeName.trim());
      }
    });
    schools.forEach((s) => {
      if (s.routeName && s.routeName.trim()) {
        routeSet.add(s.routeName.trim());
      }
    });
    return Array.from(routeSet);
  }, [routes, schools]);

  // Route counts for badges
  const routeCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: schools.length };
    schools.forEach((s) => {
      const r = s.routeName?.trim() || 'Other';
      counts[r] = (counts[r] || 0) + 1;
    });
    return counts;
  }, [schools]);

  // Live filtered schools
  const filteredSchools = useMemo(() => {
    const queryStr = searchQuery.trim().toLowerCase();

    return schools.filter((school) => {
      if (activeRoute !== 'ALL') {
        const matchesRoute =
          school.routeName?.toLowerCase() === activeRoute.toLowerCase();
        if (!matchesRoute) return false;
      }

      if (queryStr) {
        const searchPool = [
          school.schoolName,
          school.nodeGroup,
          school.nodeGroupName,
          school.udise,
          school.nodeCode,
          school.routeCode,
          school.routeName,
          school.address,
          school.pincode,
          school.spocName,
          school.driverName,
          school.category
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        if (!searchPool.includes(queryStr)) {
          return false;
        }
      }

      return true;
    });
  }, [schools, searchQuery, activeRoute]);

  // Secure trigger for Admin Console
  const handleOpenAdmin = (tab: 'schools' | 'routes' | 'staff' | 'audit' = 'schools') => {
    setAdminInitialTab(tab);
    if (isAdmin) {
      setIsAdminModalOpen(true);
    } else {
      setPendingAction(tab === 'routes' ? 'ROUTES' : tab === 'staff' ? 'STAFF' : 'ADMIN');
      setIsLoginModalOpen(true);
    }
  };

  // Secure trigger for Add School
  const handleOpenAdd = () => {
    if (isAdmin) {
      setSchoolToEdit(null);
      setIsFormModalOpen(true);
    } else {
      setPendingAction('ADD');
      setIsLoginModalOpen(true);
    }
  };

  // Secure trigger for Edit School
  const handleOpenEdit = (school: School) => {
    if (isAdmin && canEditSchools) {
      setSchoolToEdit(school);
      setIsFormModalOpen(true);
    } else {
      setPendingAction('EDIT');
      setPendingSchoolToEdit(school);
      setIsLoginModalOpen(true);
    }
  };

  // Secure trigger for Import Sheet
  const handleOpenImport = () => {
    if (isAdmin) {
      setIsExcelModalOpen(true);
    } else {
      setPendingAction('IMPORT');
      setIsLoginModalOpen(true);
    }
  };

  // Callback when Super Admin (Google) or TAPF Staff Member signs in
  const handleLoginSuccess = (loggedStaff?: StaffMember) => {
    if (loggedStaff) {
      setActiveStaff(loggedStaff);
      showToast(`Signed in as TAPF Staff: ${loggedStaff.name}`);
    } else {
      showToast('Super Admin Verified');
    }

    setIsLoginModalOpen(false);
    if (pendingAction === 'ADMIN') {
      setAdminInitialTab('schools');
      setIsAdminModalOpen(true);
    } else if (pendingAction === 'ROUTES') {
      setAdminInitialTab('routes');
      setIsAdminModalOpen(true);
    } else if (pendingAction === 'STAFF') {
      setAdminInitialTab('staff');
      setIsAdminModalOpen(true);
    } else if (pendingAction === 'ADD') {
      setSchoolToEdit(null);
      setIsFormModalOpen(true);
    } else if (pendingAction === 'EDIT') {
      setSchoolToEdit(pendingSchoolToEdit);
      setIsFormModalOpen(true);
    } else if (pendingAction === 'IMPORT') {
      setIsExcelModalOpen(true);
    }
    setPendingAction(null);
    setPendingSchoolToEdit(null);
  };

  // Save/Update school in Cloud Firestore + Local State
  const handleSaveSchool = async (saved: School) => {
    const staff = getLoggedInStaff();
    const superAuth = isAuthorizedAdminUser(auth.currentUser);
    if (!superAuth && !staff) {
      setIsLoginModalOpen(true);
      return;
    }

    let updated: School[];
    const exists = schools.some(s => s.id === saved.id);

    if (exists) {
      updated = schools.map(s => (s.id === saved.id ? saved : s));
    } else {
      updated = [saved, ...schools];
    }

    setSchools(updated);
    saveSchoolsToStorage(updated);

    if (selectedSchool?.id === saved.id) {
      setSelectedSchool(saved);
    }

    const docId = `school_${saved.id}`;
    const payload: School = {
      ...saved,
      updatedBy: superAuth ? AUTHORIZED_ADMIN_EMAIL : staff?.loginId || 'staff',
      ...(staff && !superAuth ? { updatedByStaffId: staff.id } : {}),
      updatedAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'schools', docId), payload);
      showToast(exists ? `Saved "${saved.schoolName}"` : `Added "${saved.schoolName}"`);
    } catch (error) {
      try {
        handleFirestoreError(error, exists ? OperationType.UPDATE : OperationType.CREATE, `schools/${docId}`);
      } catch {
        showToast(`Saved "${saved.schoolName}" locally`);
      }
    }
  };

  // Delete school in Cloud Firestore + Local State (Super Admin Only)
  const handleDeleteSchool = async (id: number) => {
    if (!isAuthorizedAdminUser(auth.currentUser)) {
      setIsLoginModalOpen(true);
      return;
    }

    const target = schools.find(s => s.id === id);
    const updated = schools.filter(s => s.id !== id);
    setSchools(updated);
    saveSchoolsToStorage(updated);
    if (selectedSchool?.id === id) {
      setSelectedSchool(null);
    }

    const docId = `school_${id}`;
    try {
      await deleteDoc(doc(db, 'schools', docId));
      await logSecurityAudit('DELETE_SCHOOL', `Deleted school ${target?.schoolName || id}`);
      showToast(`Deleted "${target?.schoolName || 'School'}"`);
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.DELETE, `schools/${docId}`);
      } catch {
        // Handled
      }
    }
  };

  // Save or Update a Route in Cloud Firestore + Local State
  const handleSaveRoute = async (routeObj: RouteConfig, syncSchools = true) => {
    const staff = getLoggedInStaff();
    const superAuth = isAuthorizedAdminUser(auth.currentUser);
    if (!superAuth && !staff) {
      setIsLoginModalOpen(true);
      return;
    }

    const exists = routes.some((r) => r.id === routeObj.id);
    const updatedRoutes = exists
      ? routes.map((r) => (r.id === routeObj.id ? routeObj : r))
      : [...routes, routeObj];

    syncRouteColors(updatedRoutes);
    setRoutes(updatedRoutes);
    saveRoutesToStorage(updatedRoutes);

    const payload: RouteConfig = {
      ...routeObj,
      ...(staff && !superAuth ? { updatedByStaffId: staff.id } : {}),
    };

    // If driverName is updated and syncSchools is enabled, update all schools under this route
    let affectedSchoolCount = 0;
    if (syncSchools && routeObj.driverName) {
      const updatedSchools = schools.map((s) => {
        if (s.routeName?.trim().toLowerCase() === routeObj.routeName.trim().toLowerCase()) {
          affectedSchoolCount++;
          return {
            ...s,
            driverName: routeObj.driverName || s.driverName,
            driverContact: routeObj.driverContact !== undefined ? routeObj.driverContact : s.driverContact,
            routeExecutive: routeObj.routeExecutive || s.routeExecutive,
            routeExecutiveContact: routeObj.routeExecutiveContact !== undefined ? routeObj.routeExecutiveContact : s.routeExecutiveContact,
            updatedAt: new Date().toISOString(),
          };
        }
        return s;
      });

      if (affectedSchoolCount > 0) {
        setSchools(updatedSchools);
        saveSchoolsToStorage(updatedSchools);

        try {
          const batch = writeBatch(db);
          updatedSchools
            .filter((s) => s.routeName?.trim().toLowerCase() === routeObj.routeName.trim().toLowerCase())
            .forEach((s) => {
              batch.set(
                doc(db, 'schools', `school_${s.id}`),
                {
                  ...s,
                  ...(staff && !superAuth ? { updatedByStaffId: staff.id } : {}),
                },
                { merge: true }
              );
            });
          await batch.commit();
        } catch (err) {
          console.warn('Batch school driver sync error:', err);
        }
      }
    }

    try {
      await setDoc(doc(db, 'routes', routeObj.id), payload);
      await logSecurityAudit(
        'MANAGE_ROUTE',
        exists
          ? `Updated route "${routeObj.routeName}" (Driver: ${routeObj.driverName || 'N/A'}, ${affectedSchoolCount} schools synced)`
          : `Created new route "${routeObj.routeName}" (Driver: ${routeObj.driverName || 'N/A'})`
      );
      showToast(
        affectedSchoolCount > 0
          ? `Updated "${routeObj.routeName}" driver & ${affectedSchoolCount} schools!`
          : exists
          ? `Updated route "${routeObj.routeName}"`
          : `Added new route "${routeObj.routeName}"!`
      );
    } catch (error) {
      try {
        handleFirestoreError(error, exists ? OperationType.UPDATE : OperationType.CREATE, `routes/${routeObj.id}`);
      } catch {
        showToast(`Saved route "${routeObj.routeName}"`);
      }
    }
  };

  // Delete Route (Super Admin Only)
  const handleDeleteRoute = async (routeId: string) => {
    if (!isAuthorizedAdminUser(auth.currentUser)) {
      setIsLoginModalOpen(true);
      return;
    }
    const target = routes.find((r) => r.id === routeId);
    const updated = routes.filter((r) => r.id !== routeId);
    setRoutes(updated);
    saveRoutesToStorage(updated);
    if (target && activeRoute.toLowerCase() === target.routeName.toLowerCase()) {
      setActiveRoute('ALL');
    }

    try {
      await deleteDoc(doc(db, 'routes', routeId));
      await logSecurityAudit('MANAGE_ROUTE', `Deleted route "${target?.routeName || routeId}"`);
      showToast(`Deleted route "${target?.routeName || ''}"`);
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.DELETE, `routes/${routeId}`);
      } catch {
        // Handled
      }
    }
  };

  // Save or Update TAPF Staff Member (Super Admin Only)
  const handleSaveStaffMember = async (member: StaffMember) => {
    if (!isAuthorizedAdminUser(auth.currentUser)) {
      showToast('Only Super Admin can manage TAPF Staff accounts');
      return;
    }

    const exists = staffMembers.some((m) => m.id === member.id);
    const updated = exists
      ? staffMembers.map((m) => (m.id === member.id ? member : m))
      : [member, ...staffMembers];

    setStaffMembers(updated);
    saveStaffMembersToStorage(updated);

    try {
      await setDoc(doc(db, 'staff_members', member.id), member);
      await logSecurityAudit(
        'MANAGE_STAFF',
        exists
          ? `Updated TAPF Staff account: ${member.name} (${member.loginId})`
          : `Created TAPF Staff account: ${member.name} (${member.loginId})`
      );
      showToast(
        exists
          ? `Updated credentials for ${member.name}`
          : `Created TAPF Staff login for ${member.name}!`
      );
    } catch (error) {
      try {
        handleFirestoreError(error, exists ? OperationType.UPDATE : OperationType.CREATE, `staff_members/${member.id}`);
      } catch {
        showToast(`Saved TAPF Staff account for ${member.name}`);
      }
    }
  };

  // Delete TAPF Staff Member (Super Admin Only)
  const handleDeleteStaffMember = async (memberId: string) => {
    if (!isAuthorizedAdminUser(auth.currentUser)) return;

    const target = staffMembers.find((m) => m.id === memberId);
    const updated = staffMembers.filter((m) => m.id !== memberId);
    setStaffMembers(updated);
    saveStaffMembersToStorage(updated);

    try {
      await deleteDoc(doc(db, 'staff_members', memberId));
      await logSecurityAudit(
        'MANAGE_STAFF',
        `Removed TAPF Staff account: ${target?.name || memberId}`
      );
      showToast(`Removed TAPF Staff member "${target?.name || ''}"`);
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.DELETE, `staff_members/${memberId}`);
      } catch {
        // Handled
      }
    }
  };

  // Reset to original 129 schools in Cloud Firestore + Local State
  const handleResetToDefault = async () => {
    if (!isAuthorizedAdminUser(auth.currentUser)) {
      setIsLoginModalOpen(true);
      return;
    }

    const original = resetSchoolsToDefault();
    setSchools(original);
    setSelectedSchool(null);

    try {
      const batch = writeBatch(db);
      original.forEach((school) => {
        const ref = doc(db, 'schools', `school_${school.id}`);
        batch.set(ref, {
          ...school,
          updatedBy: AUTHORIZED_ADMIN_EMAIL,
          updatedAt: new Date().toISOString(),
        });
      });
      await batch.commit();
      await logSecurityAudit('RESET_DATA', 'Reset database to original 129 schools');
      showToast('Reset Cloud database to original 129 schools.');
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.WRITE, 'schools');
      } catch {
        // Handled
      }
    }
  };

  // Handle data loaded from Excel / JSON import
  const handleDataLoaded = async (newSchools: School[]) => {
    if (!isAdmin) {
      setIsLoginModalOpen(true);
      return;
    }

    setSchools(newSchools);
    saveSchoolsToStorage(newSchools);
    setSelectedSchool(null);

    const staff = getLoggedInStaff();
    const superAuth = isAuthorizedAdminUser(auth.currentUser);

    try {
      const batch = writeBatch(db);
      newSchools.slice(0, 450).forEach((school) => {
        const ref = doc(db, 'schools', `school_${school.id}`);
        batch.set(ref, {
          ...school,
          updatedBy: superAuth ? AUTHORIZED_ADMIN_EMAIL : staff?.loginId || 'staff',
          ...(staff && !superAuth ? { updatedByStaffId: staff.id } : {}),
          updatedAt: new Date().toISOString(),
        });
      });
      await batch.commit();
      await logSecurityAudit('IMPORT_DATA', `Imported ${newSchools.length} schools to Cloud database`);
      showToast(`Synced ${newSchools.length} schools to Cloud!`);
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.WRITE, 'schools');
      } catch {
        showToast(`Loaded ${newSchools.length} schools`);
      }
    }
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setActiveRoute('ALL');
  };

  const mainContent = (
    <div
      className={`flex flex-col h-[100dvh] w-full overflow-hidden font-sans select-none transition-colors duration-200 ${
        isLight
          ? 'bg-[#f8fafc] text-slate-900'
          : 'bg-[#111e17] text-[#f2ede0]'
      }`}
    >
        {/* Google Maps Quota Defense Banner */}
        {quotaExceeded && (
          <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm shrink-0">
            <span>
              Google Maps Platform quota reached. If you are the app owner, visit{' '}
              <a
                href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold text-amber-950 hover:text-amber-800"
              >
                maps developer site
              </a>{' '}
              for instructions to update your account.
            </span>
          </div>
        )}

        {/* Toast Notification Banner */}
        {toastMessage && (
          <div 
            className={`fixed top-3 left-1/2 -translate-x-1/2 z-[9999] px-4 py-2 rounded-xl border shadow-2xl flex items-center gap-2 text-xs font-semibold animate-in fade-in slide-in-from-top-4 duration-200 ${
              isLight
                ? 'bg-[#0f172a] border-slate-700 text-white'
                : 'bg-[#1e3428] border-[#7fb298] text-[#f2ede0]'
            }`}
          >
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Top Header */}
        <header
          className={`shrink-0 border-b px-3 sm:px-5 py-2 sm:py-2.5 z-20 transition-colors ${
            isLight
              ? 'bg-white border-slate-200 shadow-2xs'
              : 'bg-[#14231b] border-[#2c4436]'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            {/* Brand & Uncropped Wide TAPF Logo */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <img
                src={TAPF_LOGO_URL}
                alt="The Akshaya Patra Foundation - Kanpur"
                className={`h-8 sm:h-10 w-auto max-w-[92px] sm:max-w-[150px] rounded-lg sm:rounded-xl object-contain bg-white px-1.5 sm:px-2 py-0.5 sm:py-1 shrink-0 shadow-2xs border ${
                  isLight ? 'border-slate-200' : 'border-amber-500/40'
                }`}
                referrerPolicy="no-referrer"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h1
                    className={`font-bold text-sm sm:text-lg tracking-tight truncate leading-tight ${
                      isLight ? 'text-slate-900 font-sans' : 'text-[#f2ede0] font-heading'
                    }`}
                  >
                    MDM Route Finder
                  </h1>
                  <span
                    className={`hidden md:inline text-xs font-semibold ${
                      isLight ? 'text-blue-600' : 'text-[#7fb298]'
                    }`}
                  >
                    · Kanpur TAPF
                  </span>
                  {isAdmin && (
                    <span
                      className={`hidden sm:inline text-[11px] font-semibold ${
                        isLight ? 'text-emerald-600' : 'text-emerald-400'
                      }`}
                    >
                      · {isSuperAdmin ? 'Super Admin' : `Staff: ${activeStaff?.name}`}
                    </span>
                  )}
                </div>
                <p
                  className={`text-[10px] sm:text-[11px] truncate ${
                    isLight ? 'text-slate-500' : 'text-[#a4b3ab]'
                  }`}
                >
                  {schools.length} Schools · {availableRoutes.length} Routes
                </p>
              </div>
            </div>

            {/* Header Action Tools (Mobile: ONLY Dark/Light Mode + List/Map Toggle; Desktop: Full Toolbar) */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Theme Switch Button (Dark <-> Light) — Visible on Mobile & Desktop */}
              <button
                onClick={toggleTheme}
                className={`inline-flex items-center justify-center gap-1.5 p-2 sm:px-3 sm:py-1.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
                  isLight
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200'
                    : 'bg-[#1e3428] hover:bg-[#284435] text-amber-300 border-[#2c4436]'
                }`}
                title={isLight ? 'Switch to Dark Theme' : 'Switch to Light Theme'}
              >
                {isLight ? (
                  <>
                    <Moon className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-slate-700" />
                    <span className="hidden sm:inline">Dark</span>
                  </>
                ) : (
                  <>
                    <Sun className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-amber-400" />
                    <span className="hidden sm:inline">Light</span>
                  </>
                )}
              </button>

              {/* Mobile View Toggle: List vs Map — Visible on Mobile Only */}
              <div
                className={`flex lg:hidden p-0.5 rounded-xl border ${
                  isLight
                    ? 'bg-slate-100 border-slate-200'
                    : 'bg-[#111e17] border-[#2c4436]'
                }`}
              >
                <button
                  onClick={() => setMobileTab('list')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    mobileTab === 'list'
                      ? isLight
                        ? 'bg-white text-blue-600 shadow-xs'
                        : 'bg-[#1e3428] text-amber-400 shadow-xs'
                      : isLight
                        ? 'text-slate-500 hover:text-slate-900'
                        : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <ListIcon className="w-3.5 h-3.5" />
                  <span>List</span>
                </button>
                <button
                  onClick={() => setMobileTab('map')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    mobileTab === 'map'
                      ? isLight
                        ? 'bg-white text-blue-600 shadow-xs'
                        : 'bg-[#1e3428] text-amber-400 shadow-xs'
                      : isLight
                        ? 'text-slate-500 hover:text-slate-900'
                        : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <MapIcon className="w-3.5 h-3.5" />
                  <span>Map</span>
                </button>
              </div>

              {/* Desktop Only Action Buttons (Hidden on Mobile to keep header clean) */}
              <button
                onClick={handleOpenAdd}
                className={`hidden lg:inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95 ${
                  isLight
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-amber-500 hover:bg-amber-400 text-[#12211a]'
                }`}
                title="Add a new delivery school"
              >
                <Plus className="w-4 h-4" />
                <span>Add School</span>
              </button>

              {isAdmin && (
                <button
                  onClick={() => handleOpenAdmin('routes')}
                  className={`hidden lg:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                    isLight
                      ? 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                      : 'bg-[#1e3428] hover:bg-[#284435] text-amber-300 border-[#2c4436]'
                  }`}
                  title="Add or Manage Delivery Routes"
                >
                  <RouteIcon className="w-3.5 h-3.5" />
                  <span>+ Route</span>
                </button>
              )}

              {isSuperAdmin && (
                <button
                  onClick={() => handleOpenAdmin('staff')}
                  className={`hidden lg:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                    isLight
                      ? 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                      : 'bg-[#1e3428] hover:bg-[#284435] text-[#7fb298] border-[#2c4436]'
                  }`}
                  title="Create & Manage TAPF Staff Logins"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Staff Logins</span>
                </button>
              )}

              <button
                onClick={() => handleOpenAdmin('schools')}
                className={`hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                  isAdmin
                    ? isLight
                      ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                      : 'bg-emerald-950/70 hover:bg-emerald-900/80 text-emerald-300 border-emerald-700/60'
                    : isLight
                      ? 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                      : 'bg-[#1e3428] hover:bg-[#284435] text-amber-300 border-[#2c4436]'
                }`}
                title={isAdmin ? 'Open Admin Console' : 'Admin / Office Staff Sign In'}
              >
                {isAdmin ? (
                  <ShieldCheck className={`w-3.5 h-3.5 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`} />
                ) : (
                  <Lock className={`w-3.5 h-3.5 ${isLight ? 'text-slate-600' : 'text-amber-400'}`} />
                )}
                <span>{isAdmin ? 'Admin Console' : 'Admin Login'}</span>
              </button>

              {isAdmin && (
                <button
                  onClick={async () => {
                    await logoutAdmin();
                    setActiveStaff(null);
                    setIsAdminModalOpen(false);
                    showToast('Signed out of session');
                  }}
                  className={`hidden lg:inline-flex px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors items-center gap-1 ${
                    isLight
                      ? 'bg-red-50 hover:bg-red-100 text-red-600 border-red-200'
                      : 'bg-red-950/40 hover:bg-red-900/60 text-red-300 border-red-800/50'
                  }`}
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden xl:inline">Sign Out</span>
                </button>
              )}

              {isAdmin && (
                <button
                  onClick={handleOpenImport}
                  className={`hidden lg:inline-flex px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors items-center gap-1 ${
                    isLight
                      ? 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                      : 'bg-[#1e3428] hover:bg-[#284435] text-[#7fb298] border-[#2c4436]'
                  }`}
                  title="Upload Excel (OS1_detail.xlsx) or JSON"
                >
                  <FileSpreadsheet className={`w-4 h-4 ${isLight ? 'text-emerald-600' : 'text-[#7fb298]'}`} />
                  <span className="hidden xl:inline">Import</span>
                </button>
              )}

              <button
                onClick={() => setShowNoticeModal(true)}
                className={`hidden lg:inline-flex p-1.5 rounded-xl text-xs font-medium border transition-colors ${
                  isLight
                    ? 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'
                    : 'bg-[#1e3428] hover:bg-[#284435] text-slate-300 border-[#2c4436]'
                }`}
                title="Notice & Usage Guide"
              >
                <Info className={`w-4 h-4 ${isLight ? 'text-blue-600' : 'text-amber-400'}`} />
              </button>
            </div>
          </div>

          {/* Live Search Input Bar */}
          <div className="mt-2 relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search school name, UDISE, node code, route, SPOC..."
              className={`w-full pl-10 pr-9 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm border transition-all outline-hidden ${
                isLight
                  ? 'bg-white border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 text-slate-900 placeholder-slate-400 shadow-2xs'
                  : 'bg-[#111e17] border-[#2c4436] focus:border-[#7fb298] focus:ring-1 focus:ring-[#7fb298] text-[#f2ede0] placeholder-[#6d8076]'
              }`}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className={`absolute inset-y-0 right-0 pr-3 flex items-center ${
                  isLight ? 'text-slate-400 hover:text-slate-700' : 'text-slate-400 hover:text-white'
                }`}
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Horizontally Scrollable Route Filter Buttons */}
          <div className="mt-2 flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-0.5 scrollbar-none no-scrollbar text-xs">
            <button
              onClick={() => setActiveRoute('ALL')}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-xl transition-all border ${
                activeRoute === 'ALL'
                  ? isLight
                    ? 'bg-[#0f172a] border-[#0f172a] text-white font-bold shadow-xs'
                    : 'bg-amber-500 border-amber-500 text-[#12211a] font-bold shadow-xs'
                  : isLight
                    ? 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200 font-semibold'
                    : 'bg-[#16271e] text-slate-300 hover:bg-[#1e3428] border-[#2c4436] font-medium'
              }`}
            >
              <span>All Routes</span>
              <span
                className={`font-mono text-[11px] ${
                  activeRoute === 'ALL'
                    ? isLight
                      ? 'text-slate-300'
                      : 'opacity-85'
                    : isLight
                      ? 'text-slate-400'
                      : 'opacity-85'
                }`}
              >
                {routeCounts['ALL'] || schools.length}
              </span>
            </button>

            {availableRoutes.map((routeName) => {
              const color = getRouteColor(routeName);
              const isSelected = activeRoute === routeName;
              const count = routeCounts[routeName] || 0;

              if (isLight) {
                return (
                  <button
                    key={routeName}
                    onClick={() => setActiveRoute(routeName)}
                    className={`shrink-0 inline-flex items-center gap-2 px-3 sm:px-3.5 py-1.5 rounded-xl transition-all border ${
                      isSelected
                        ? 'bg-[#0f172a] border-[#0f172a] text-white font-bold shadow-xs'
                        : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200 font-semibold'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-xs shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span>{routeName}</span>
                    {!isSelected && (
                      <span className="font-mono text-[11px] text-slate-400">
                        {count}
                      </span>
                    )}
                  </button>
                );
              }

              return (
                <button
                  key={routeName}
                  onClick={() => setActiveRoute(routeName)}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all border ${
                    isSelected
                      ? 'border-transparent text-[#12211a] font-bold shadow-xs'
                      : 'bg-[#16271e] text-slate-300 hover:bg-[#1e3428] border-[#2c4436]'
                  }`}
                  style={{
                    backgroundColor: isSelected ? color : undefined,
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: isSelected ? '#12211a' : color }}
                  />
                  <span>{routeName}</span>
                  <span className="font-mono text-[11px] opacity-80">
                    ({count})
                  </span>
                </button>
              );
            })}

            <button
              onClick={() => handleOpenAdmin('routes')}
              className={`hidden sm:inline-flex shrink-0 items-center gap-1 px-3 py-1.5 rounded-xl font-semibold border border-dashed transition-colors ${
                isLight
                  ? 'bg-blue-50/60 hover:bg-blue-100/70 text-blue-600 border-blue-300'
                  : 'bg-[#16271e] hover:bg-[#1e3428] text-amber-400 border-amber-500/40'
              }`}
              title="Add a new delivery route"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Route</span>
            </button>
          </div>

          {/* Result Counter & Active Filter Bar */}
          <div
            className={`mt-1.5 flex items-center justify-between text-[11px] px-1 ${
              isLight ? 'text-slate-500' : 'text-[#a4b3ab]'
            }`}
          >
            <div className="truncate">
              <span>
                Showing{' '}
                <strong className={isLight ? 'text-slate-900' : 'text-[#f2ede0]'}>
                  {filteredSchools.length}
                </strong>{' '}
                of {schools.length}
              </span>
              <span className="mx-1">·</span>
              <span>
                Route:{' '}
                <strong className={isLight ? 'text-blue-600' : 'text-amber-400'}>
                  {activeRoute === 'ALL' ? `All (${availableRoutes.length})` : activeRoute}
                </strong>
              </span>
              {searchQuery && (
                <span className={`ml-1 truncate ${isLight ? 'text-emerald-600' : 'text-[#7fb298]'}`}>
                  · "{searchQuery}"
                </span>
              )}
            </div>

            {(searchQuery || activeRoute !== 'ALL') && (
              <button
                onClick={handleResetFilters}
                className={`hover:underline flex items-center gap-1 shrink-0 ml-2 font-semibold ${
                  isLight ? 'text-blue-600' : 'text-amber-400'
                }`}
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </header>

        {/* Main Workspace Body */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Left Side: School List */}
          <div
            className={`
              ${mobileTab === 'list' ? 'flex' : 'hidden'} 
              lg:flex flex-col 
              w-full lg:w-[440px] xl:w-[470px] shrink-0 
              h-full border-r overflow-y-auto transition-colors
              ${isLight ? 'bg-[#f8fafc] border-slate-200' : 'bg-[#111e17] border-[#2c4436]'}
            `}
          >
            {filteredSchools.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
                <div
                  className={`w-14 h-14 rounded-2xl border flex items-center justify-center mb-3 ${
                    isLight
                      ? 'bg-white border-slate-200 text-slate-400'
                      : 'bg-[#16271e] border-[#2c4436] text-slate-500'
                  }`}
                >
                  <Search className="w-6 h-6" />
                </div>
                <h3
                  className={`font-heading text-lg font-semibold ${
                    isLight ? 'text-slate-900' : 'text-[#f2ede0]'
                  }`}
                >
                  No schools found
                </h3>
                <p
                  className={`text-xs mt-1 max-w-xs ${
                    isLight ? 'text-slate-500' : 'text-[#a4b3ab]'
                  }`}
                >
                  No records matched "{searchQuery || activeRoute}".
                </p>
                <div className="flex items-center gap-2 mt-4">
                  <button
                    onClick={handleResetFilters}
                    className={`px-4 py-2 text-xs font-semibold rounded-xl border transition-colors ${
                      isLight
                        ? 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                        : 'bg-[#1e3428] hover:bg-[#284435] text-amber-400 border-[#2c4436]'
                    }`}
                  >
                    Reset Filters
                  </button>
                  <button
                    onClick={handleOpenAdd}
                    className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors ${
                      isLight
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'bg-amber-500 text-[#12211a]'
                    }`}
                  >
                    Add School
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3 sm:p-4 space-y-3 pb-20 lg:pb-4">
                {filteredSchools.map((school) => (
                  <SchoolCard
                    key={school.id}
                    school={school}
                    isSelected={selectedSchool?.id === school.id}
                    onSelect={(s) => {
                      setSelectedSchool(s);
                    }}
                    onEdit={isAdmin && canEditSchools ? handleOpenEdit : undefined}
                    theme={theme}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right Side: Google Map View */}
          <div
            className={`
              ${mobileTab === 'map' ? 'flex' : 'hidden'} 
              lg:flex flex-1 h-full relative pb-14 lg:pb-0
            `}
          >
            <MapComponent
              schools={filteredSchools}
              selectedSchool={selectedSchool}
              onSelectSchool={(s) => {
                setSelectedSchool(s);
              }}
              activeRoute={activeRoute}
              theme={theme}
              googleMapsApiKey={GOOGLE_MAPS_API_KEY}
            />
          </div>
        </div>

        {/* Mobile Touch Bottom Navigation Bar (3 Clean Options: Schools, Map, Admin Login/Console) */}
        <div
          className={`lg:hidden shrink-0 border-t px-3 py-2 grid grid-cols-3 gap-1 z-30 shadow-2xl ${
            isLight
              ? 'bg-white border-slate-200'
              : 'bg-[#14231b] border-[#2c4436]'
          }`}
        >
          <button
            onClick={() => setMobileTab('list')}
            className={`flex flex-col items-center justify-center gap-1 py-1.5 px-2 rounded-xl transition-all ${
              mobileTab === 'list'
                ? isLight
                  ? 'text-blue-600 bg-blue-50/70 font-bold'
                  : 'text-amber-400 bg-[#1e3428]/70 font-semibold'
                : isLight
                  ? 'text-slate-500 hover:text-slate-900'
                  : 'text-slate-400 hover:text-white'
            }`}
          >
            <ListIcon className="w-5 h-5" />
            <span className="text-[11px] leading-none">Schools ({filteredSchools.length})</span>
          </button>

          <button
            onClick={() => setMobileTab('map')}
            className={`flex flex-col items-center justify-center gap-1 py-1.5 px-2 rounded-xl transition-all ${
              mobileTab === 'map'
                ? isLight
                  ? 'text-blue-600 bg-blue-50/70 font-bold'
                  : 'text-amber-400 bg-[#1e3428]/70 font-semibold'
                : isLight
                  ? 'text-slate-500 hover:text-slate-900'
                  : 'text-slate-400 hover:text-white'
            }`}
          >
            <MapIcon className="w-5 h-5" />
            <span className="text-[11px] leading-none">Google Map</span>
          </button>

          <button
            onClick={() => handleOpenAdmin('schools')}
            className={`flex flex-col items-center justify-center gap-1 py-1.5 px-2 rounded-xl transition-all ${
              isAdmin
                ? isLight
                  ? 'text-emerald-600 bg-emerald-50/70 font-bold'
                  : 'text-emerald-400 bg-emerald-950/40 font-semibold'
                : isLight
                  ? 'text-slate-600 hover:text-slate-900'
                  : 'text-slate-300 hover:text-white'
            }`}
          >
            <Building2 className="w-5 h-5" />
            <span className="text-[11px] leading-none">{isAdmin ? 'Admin Console' : 'Admin Login'}</span>
          </button>
        </div>

        {/* School Detail Drawer */}
        <SchoolDrawer
          school={selectedSchool}
          onClose={() => setSelectedSchool(null)}
          onEdit={canEditSchools ? handleOpenEdit : undefined}
          theme={theme}
        />

        {/* Admin & Office Staff Login Modal */}
        <AdminLoginModal
          isOpen={isLoginModalOpen}
          onClose={() => {
            setIsLoginModalOpen(false);
            setPendingAction(null);
            setPendingSchoolToEdit(null);
          }}
          onSuccess={handleLoginSuccess}
          currentUser={currentUser}
          theme={theme}
        />

        {/* Admin Panel Modal */}
        <AdminPanelModal
          isOpen={isAdminModalOpen}
          onClose={() => setIsAdminModalOpen(false)}
          schools={schools}
          routes={routes}
          staffMembers={staffMembers}
          onAddSchoolClick={handleOpenAdd}
          onEditSchoolClick={handleOpenEdit}
          onDeleteSchool={handleDeleteSchool}
          onResetToDefault={handleResetToDefault}
          onSaveRoute={handleSaveRoute}
          onDeleteRoute={handleDeleteRoute}
          onSaveStaffMember={handleSaveStaffMember}
          onDeleteStaffMember={handleDeleteStaffMember}
          currentUser={currentUser}
          activeStaff={activeStaff}
          isSuperAdmin={isSuperAdmin}
          initialTab={adminInitialTab}
          theme={theme}
          onToggleTheme={toggleTheme}
        />

        {/* School Form Modal (Add / Edit) */}
        <SchoolFormModal
          isOpen={isFormModalOpen}
          onClose={() => {
            setIsFormModalOpen(false);
            setSchoolToEdit(null);
          }}
          onSave={handleSaveSchool}
          schoolToEdit={schoolToEdit}
          existingCount={schools.length}
          routes={routes}
          onAddRoute={handleSaveRoute}
          theme={theme}
        />

        {/* Excel / JSON Importer Modal */}
        <ExcelUploadModal
          isOpen={isExcelModalOpen}
          onClose={() => setIsExcelModalOpen(false)}
          onDataLoaded={handleDataLoaded}
          currentCount={schools.length}
          theme={theme}
        />

        {/* Notice & Quick Guide Modal */}
        <NoticeModal
          forceShow={showNoticeModal}
          onClose={() => setShowNoticeModal(false)}
          theme={theme}
        />
      </div>
  );

  if (GOOGLE_MAPS_API_KEY && GOOGLE_MAPS_API_KEY.trim()) {
    return (
      <APIProvider 
        apiKey={GOOGLE_MAPS_API_KEY} 
        libraries={['marker', 'maps']}
        language="en"
        region="IN"
      >
        {mainContent}
      </APIProvider>
    );
  }

  return mainContent;
}

export default function App() {
  return (
    <AppErrorBoundary>
      <MainApp />
    </AppErrorBoundary>
  );
}
