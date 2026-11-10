/**
 * Cloud Security, Staff Sub-Admin Authentication, Route Persistence & Audit Logging
 * Super Admin is strictly authenticated via Google OAuth (Firebase Auth: shivamvk1090@gmail.com).
 * TAPF Office Staff accounts are created and managed exclusively by Super Admin.
 */
import { 
  db, 
  auth, 
  AUTHORIZED_ADMIN_EMAIL, 
  isAuthorizedAdminUser, 
  signOutAdmin,
  doc,
  setDoc,
  collection,
  getDocs,
  query,
  where,
  limit,
  handleFirestoreError,
  OperationType
} from '../firebase';
import { StaffMember, RouteConfig, DEFAULT_ROUTES, syncRouteColors } from '../types';

const ADMIN_AUDIT_KEY = 'mdm_admin_audit_log_v1';
const STAFF_SESSION_KEY = 'mdm_tapf_staff_session_v1';
const STAFF_STORAGE_KEY = 'mdm_tapf_staff_list_v1';
const ROUTES_STORAGE_KEY = 'mdm_tapf_custom_routes_v1';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action:
    | 'ADD_SCHOOL'
    | 'EDIT_SCHOOL'
    | 'DELETE_SCHOOL'
    | 'RESET_DATA'
    | 'IMPORT_DATA'
    | 'MANAGE_ROUTE'
    | 'MANAGE_STAFF';
  summary: string;
  adminEmail: string;
  updatedByStaffId?: string;
}

// Sanitizes inputs to prevent XSS and code injection and enforce blueprint limits
export function sanitizeInput(input: any, maxLen = 350): string {
  if (input === null || input === undefined) return '';
  const str = String(input);
  return str
    .replace(/<[^>]*>?/gm, '') // Strip HTML tags
    .replace(/[<>]/g, '') // Strip angle brackets
    .trim()
    .slice(0, maxLen);
}

// Deterministic SHA-256 password hashing for staff credentials
export async function hashStaffPassword(password: string): Promise<string> {
  const normalized = password.trim();
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const msgBuffer = new TextEncoder().encode(`tapf_kanpur_salt_v1_${normalized}`);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback deterministic 64-char hash if WebCrypto is unavailable
  let h1 = 0xdeadbeef ^ normalized.length;
  let h2 = 0x41c6ce57 ^ normalized.length;
  for (let i = 0, ch; i < normalized.length; i++) {
    ch = normalized.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(16, '0') + (h1 >>> 0).toString(16).padStart(16, '0') + 'tapf2026kanpur00';
}

// Get or initialize stored routes
export function getStoredRoutes(): RouteConfig[] {
  try {
    const raw = localStorage.getItem(ROUTES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        syncRouteColors(parsed);
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error reading routes storage:', e);
  }
  syncRouteColors(DEFAULT_ROUTES);
  return DEFAULT_ROUTES;
}

export function saveRoutesToStorage(routes: RouteConfig[]): void {
  try {
    syncRouteColors(routes);
    localStorage.setItem(ROUTES_STORAGE_KEY, JSON.stringify(routes));
  } catch (e) {
    console.error('Error saving routes storage:', e);
  }
}

// Get or save cached staff members
export function getStoredStaffMembers(): StaffMember[] {
  try {
    const raw = localStorage.getItem(STAFF_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Error reading staff storage:', e);
  }
  return [];
}

export function saveStaffMembersToStorage(staff: StaffMember[]): void {
  try {
    localStorage.setItem(STAFF_STORAGE_KEY, JSON.stringify(staff));
  } catch (e) {
    console.error('Error saving staff storage:', e);
  }
}

// Active Staff Session Management
export function getLoggedInStaff(): StaffMember | null {
  try {
    const raw = sessionStorage.getItem(STAFF_SESSION_KEY) || localStorage.getItem(STAFF_SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StaffMember;
      if (parsed && parsed.id && parsed.active) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error reading staff session:', e);
  }
  return null;
}

export function setLoggedInStaff(staff: StaffMember | null): void {
  try {
    if (staff) {
      const serialized = JSON.stringify(staff);
      sessionStorage.setItem(STAFF_SESSION_KEY, serialized);
      localStorage.setItem(STAFF_SESSION_KEY, serialized);
    } else {
      sessionStorage.removeItem(STAFF_SESSION_KEY);
      localStorage.removeItem(STAFF_SESSION_KEY);
    }
  } catch (e) {
    console.error('Error saving staff session:', e);
  }
}

// Verify TAPF Staff Member Login ID / Email & Password against Cloud Firestore + local cache
export async function verifyStaffLogin(
  loginIdInput: string,
  passwordInput: string
): Promise<{ success: boolean; staff?: StaffMember; error?: string }> {
  const cleanLogin = loginIdInput.trim().toLowerCase();
  const cleanPass = passwordInput.trim();

  if (!cleanLogin || !cleanPass) {
    return { success: false, error: 'Please enter both Staff Email/ID and Password.' };
  }

  const inputHash = await hashStaffPassword(cleanPass);

  // 1. Check Cloud Firestore active staff members
  let candidates: StaffMember[] = getStoredStaffMembers();
  try {
    const q = query(collection(db, 'staff_members'), where('active', '==', true));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const cloudList: StaffMember[] = [];
      snap.forEach((d) => cloudList.push(d.data() as StaffMember));
      candidates = cloudList;
      saveStaffMembersToStorage(cloudList);
    }
  } catch (e) {
    console.warn('Staff login cloud lookup fallback to local cache:', e);
  }

  const matched = candidates.find(
    (m) => m.loginId.trim().toLowerCase() === cleanLogin
  );

  if (!matched) {
    return {
      success: false,
      error: 'No TAPF Staff account found with this Login ID / Email. Contact Super Admin.',
    };
  }

  if (!matched.active) {
    return {
      success: false,
      error: 'This TAPF Staff account has been suspended by the Main Admin.',
    };
  }

  if (matched.passwordHash !== inputHash) {
    return {
      success: false,
      error: 'Invalid password. Please check your credentials or ask the Main Admin to reset it.',
    };
  }

  setLoggedInStaff(matched);
  return { success: true, staff: matched };
}

// Check if current user is verified Super Admin or active Staff Member
export function isSessionActive(): boolean {
  return isAuthorizedAdminUser(auth.currentUser) || Boolean(getLoggedInStaff());
}

// Sign out current Google session AND any TAPF Staff session with thorough browser cache purge
export async function logoutAdmin(): Promise<void> {
  setLoggedInStaff(null);
  try {
    sessionStorage.clear();
    localStorage.removeItem(STAFF_SESSION_KEY);
    localStorage.removeItem(STAFF_STORAGE_KEY);
    localStorage.removeItem(ADMIN_AUDIT_KEY);
  } catch (e) {
    console.warn('Storage cleanup error on logout:', e);
  }
  try {
    await signOutAdmin();
  } catch (e) {
    console.error('Sign out error:', e);
  }
}

// Record security audit log in both Firestore and local cache
export async function logSecurityAudit(
  action: AuditLogEntry['action'],
  summary: string
): Promise<void> {
  const staff = getLoggedInStaff();
  const isSuper = isAuthorizedAdminUser(auth.currentUser);
  const actorEmail = isSuper
    ? AUTHORIZED_ADMIN_EMAIL
    : staff
    ? `${staff.name} (${staff.loginId})`
    : AUTHORIZED_ADMIN_EMAIL;

  const entry: AuditLogEntry = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }).slice(0, 95),
    action,
    summary: sanitizeInput(summary, 390),
    adminEmail: sanitizeInput(actorEmail, 145),
    ...(staff && !isSuper ? { updatedByStaffId: staff.id } : {}),
  };

  // Save to local cache for immediate UI render
  try {
    const raw = localStorage.getItem(ADMIN_AUDIT_KEY);
    const logs: AuditLogEntry[] = raw ? JSON.parse(raw) : [];
    logs.unshift(entry);
    localStorage.setItem(ADMIN_AUDIT_KEY, JSON.stringify(logs.slice(0, 50)));
  } catch (e) {
    console.error('Local audit log write error:', e);
  }

  // Persist to Cloud Firestore if authenticated as Super Admin or active Staff
  if (isSuper || staff) {
    const path = `audit_logs/${entry.id}`;
    try {
      await setDoc(doc(db, 'audit_logs', entry.id), entry);
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.CREATE, path);
      } catch {
        // Logged by handleFirestoreError; prevent unhandled promise rejection in UI
      }
    }
  }
}

export async function fetchCloudAuditLogs(): Promise<AuditLogEntry[]> {
  if (!isAuthorizedAdminUser(auth.currentUser)) {
    return getAuditLogs();
  }
  try {
    const q = query(
      collection(db, 'audit_logs'),
      where('id', '>=', 'log_'),
      limit(50)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const cloudLogs: AuditLogEntry[] = [];
      snap.forEach((d) => cloudLogs.push(d.data() as AuditLogEntry));
      cloudLogs.sort((a, b) => b.id.localeCompare(a.id));
      localStorage.setItem(ADMIN_AUDIT_KEY, JSON.stringify(cloudLogs));
      return cloudLogs;
    }
  } catch (error) {
    console.warn('Could not fetch cloud audit logs:', error);
  }
  return getAuditLogs();
}

export function getAuditLogs(): AuditLogEntry[] {
  try {
    const raw = localStorage.getItem(ADMIN_AUDIT_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Audit log read error:', e);
  }
  return [];
}
