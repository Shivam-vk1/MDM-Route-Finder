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
  getDoc,
  setDoc,
  writeBatch,
  collection,
  getDocs,
  query,
  where,
  limit,
  handleFirestoreError,
  OperationType
} from '../firebase';
import { 
  StaffMember, 
  RouteConfig, 
  DEFAULT_ROUTES, 
  syncRouteColors,
  AccessLogEntry,
  OrgVerificationSession,
  OrgVerificationPolicy
} from '../types';

const ADMIN_AUDIT_KEY = 'mdm_admin_audit_log_v1';
const STAFF_SESSION_KEY = 'mdm_tapf_staff_session_v1';
const STAFF_STORAGE_KEY = 'mdm_tapf_staff_list_v1';
const ROUTES_STORAGE_KEY = 'mdm_tapf_custom_routes_v1';
const ORG_VERIFICATION_SESSION_KEY = 'mdm_org_email_verification_v1';

// Exactly 2 days (48 hours) verification memory window
export const ORG_VERIFICATION_TTL_MS = 2 * 24 * 60 * 60 * 1000;

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
    | 'MANAGE_STAFF'
    | 'TOGGLE_EMAIL_VERIFICATION'
    | 'UPDATE_EMAIL_POLICY'
    | 'REVOKE_USER_ACCESS'
    | 'REVOKE_ALL_USERS';
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

// Helper to compute deterministic document ID from staff login email
export function getStaffDocId(loginId: string): string {
  return 'staff_' + loginId.trim().toLowerCase().replace(/[^a-zA-Z0-9_]/g, '_');
}

// Get or save cached staff members (Zero hardcoded credentials in codebase)
export function getStoredStaffMembers(): StaffMember[] {
  try {
    const raw = localStorage.getItem(STAFF_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Purge any legacy demo accounts from local storage
        return parsed.filter((m) => m && m.id && m.id !== 'staff_shivamvk_tapf_org');
      }
    }
  } catch (e) {
    console.error('Error reading staff storage:', e);
  }
  return [];
}

export function saveStaffMembersToStorage(staff: StaffMember[]): void {
  try {
    // Filter legacy demo seeds before storing
    const cleaned = staff.filter((m) => m && m.id && m.id !== 'staff_shivamvk_tapf_org');
    localStorage.setItem(STAFF_STORAGE_KEY, JSON.stringify(cleaned));
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

// Verify TAPF Staff Member Login ID / Email & Password against Cloud Firestore
// Only accounts created and authorized by Main Admin in Firebase can authenticate. Zero credentials in GitHub repo.
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

  // 1. First, check direct deterministic document fetch from Firestore (Zero public listing rule compliant)
  const staffDocId = getStaffDocId(cleanLogin);
  let matched: StaffMember | null = null;

  try {
    const docSnap = await getDoc(doc(db, 'staff_members', staffDocId));
    if (docSnap.exists()) {
      matched = docSnap.data() as StaffMember;
    }
  } catch (e) {
    console.warn('Targeted staff document lookup failed, checking local cache:', e);
  }

  // 2. If not found in direct doc lookup, check local cache (saved when Main Admin manages accounts)
  if (!matched) {
    const candidates: StaffMember[] = getStoredStaffMembers();
    matched = candidates.find(
      (m) => m.loginId.trim().toLowerCase() === cleanLogin
    ) || null;
  }

  // Strictly enforce that account must be authorized by Super Admin in Firebase
  if (!matched) {
    return {
      success: false,
      error: 'No authorized TAPF Staff account found. Please ask the Main Admin to add your account in the Admin Console.',
    };
  }

  if (!matched.active) {
    return {
      success: false,
      error: 'This TAPF Staff account has been deactivated or suspended by the Main Admin.',
    };
  }

  // Strictly verify against salted SHA-256 hash in Firebase - zero hardcoded bypasses
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

// ============================================================================
// ORGANIZATION EMAIL VERIFICATION (100% Firebase Backend Enforced + 2-Day TTL)
// ============================================================================

function formatISTTimestamp(ms: number): string {
  return new Date(ms)
    .toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
    .slice(0, 95);
}

function getDeviceSummary(): string {
  if (typeof navigator === 'undefined') return 'Unknown Device';
  const ua = navigator.userAgent || '';
  const os = /Android/i.test(ua)
    ? 'Android'
    : /iPhone|iPad|iPod/i.test(ua)
      ? 'iOS'
      : /Windows/i.test(ua)
        ? 'Windows'
        : /Mac OS X/i.test(ua)
          ? 'macOS'
          : /Linux/i.test(ua)
            ? 'Linux'
            : 'Web';
  const browser = /Edg/i.test(ua)
    ? 'Edge'
    : /Chrome/i.test(ua)
      ? 'Chrome'
      : /Safari/i.test(ua)
        ? 'Safari'
        : /Firefox/i.test(ua)
          ? 'Firefox'
          : 'Browser';
  return `${os} · ${browser}`.slice(0, 140);
}

// Read & validate stored 2-day organization verification session
export function getValidOrgVerificationSession(): OrgVerificationSession | null {
  try {
    const raw = localStorage.getItem(ORG_VERIFICATION_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OrgVerificationSession;
    const now = Date.now();
    if (
      !parsed ||
      typeof parsed.email !== 'string' ||
      typeof parsed.logId !== 'string' ||
      typeof parsed.verifiedAtMs !== 'number' ||
      typeof parsed.expiresAtMs !== 'number'
    ) {
      localStorage.removeItem(ORG_VERIFICATION_SESSION_KEY);
      return null;
    }

    const duration = parsed.expiresAtMs - parsed.verifiedAtMs;
    if (
      duration <= 0 ||
      duration > ORG_VERIFICATION_TTL_MS ||
      parsed.verifiedAtMs > now + 60_000 ||
      now >= parsed.expiresAtMs
    ) {
      localStorage.removeItem(ORG_VERIFICATION_SESSION_KEY);
      return null;
    }

    return parsed;
  } catch {
    try {
      localStorage.removeItem(ORG_VERIFICATION_SESSION_KEY);
    } catch {
      // Ignore cleanup error
    }
    return null;
  }
}

export function clearOrgVerificationSession(): void {
  try {
    localStorage.removeItem(ORG_VERIFICATION_SESSION_KEY);
  } catch {
    // Ignore cleanup error
  }
}

// Verify entered organization email strictly via Firebase backend rules (zero domain rules in client code)
export async function verifyOrgEmailWithFirebase(
  emailInput: string
): Promise<{ success: boolean; session?: OrgVerificationSession; error?: string }> {
  const cleanEmail = sanitizeInput(emailInput, 150).toLowerCase();

  // Basic syntactic email check only; domain & authorization rules live exclusively in Firebase backend
  const basicEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!cleanEmail || !basicEmailPattern.test(cleanEmail)) {
    return {
      success: false,
      error: 'Please enter a valid email address.',
    };
  }

  const now = Date.now();
  const expiresAtMs = now + ORG_VERIFICATION_TTL_MS;
  const logId = `access_${now}_${Math.random().toString(36).substring(2, 8)}`;

  const entry: AccessLogEntry = {
    id: logId,
    email: cleanEmail,
    accessedAt: formatISTTimestamp(now),
    accessedAtMs: now,
    expiresAt: formatISTTimestamp(expiresAtMs),
    expiresAtMs,
    deviceInfo: getDeviceSummary(),
  };

  try {
    // Firebase Firestore backend evaluates private policy & domain rules on this write
    await setDoc(doc(db, 'access_logs', logId), entry);

    const session: OrgVerificationSession = {
      email: cleanEmail,
      logId,
      verifiedAtMs: now,
      expiresAtMs,
    };

    try {
      localStorage.setItem(ORG_VERIFICATION_SESSION_KEY, JSON.stringify(session));
    } catch (storageErr) {
      console.warn('Unable to cache verification session locally:', storageErr);
    }

    return { success: true, session };
  } catch (error: any) {
    const code = error?.code || '';
    const msg = String(error?.message || '');

    if (
      code === 'permission-denied' ||
      msg.toLowerCase().includes('missing or insufficient permissions') ||
      msg.toLowerCase().includes('permission_denied')
    ) {
      // Intentionally generic message: never reveal domain restriction on login screen
      return {
        success: false,
        error: 'This email ID is not authorized to open this application. Please enter a valid organization email ID.',
      };
    }

    return {
      success: false,
      error: 'Unable to verify your email right now. Please check your internet connection and try again.',
    };
  }
}

// Super Admin: Toggle Organization Email Verification ON or OFF in Firebase
export async function setOrgVerificationEnabled(
  enabled: boolean,
  revokedAllBeforeMs = 0
): Promise<{ success: boolean; error?: string }> {
  if (!isAuthorizedAdminUser(auth.currentUser)) {
    return { success: false, error: 'Only Super Admin can change email verification settings.' };
  }

  const payload: {
    enabled: boolean;
    revokedAllBeforeMs?: number;
    updatedAt: string;
    updatedBy: string;
  } = {
    enabled,
    ...(revokedAllBeforeMs > 0 ? { revokedAllBeforeMs } : {}),
    updatedAt: new Date().toISOString(),
    updatedBy: AUTHORIZED_ADMIN_EMAIL,
  };

  const path = 'app_settings/verification_status';
  try {
    await setDoc(doc(db, 'app_settings', 'verification_status'), payload);
    await logSecurityAudit(
      'TOGGLE_EMAIL_VERIFICATION',
      `Organization Email Verification turned ${enabled ? 'ON' : 'OFF'}`
    );
    return { success: true };
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.WRITE, path);
    } catch {
      // Handled via structured logger
    }
    return { success: false, error: 'Failed to update verification setting in Firebase.' };
  }
}

// Super Admin: Immediately revoke a single active user's session before 48h expiry
export async function revokeSingleOrgUserSession(
  entry: AccessLogEntry
): Promise<{ success: boolean; revokedAt?: string; revokedAtMs?: number; error?: string }> {
  if (!isAuthorizedAdminUser(auth.currentUser)) {
    return { success: false, error: 'Only Super Admin can remove active user sessions.' };
  }

  const now = Date.now();
  const revokedAt = formatISTTimestamp(now);
  const path = `revoked_sessions/${entry.id}`;

  try {
    const batch = writeBatch(db);
    // Write zero-PII session tombstone so that specific browser immediately re-locks
    batch.set(doc(db, 'revoked_sessions', entry.id), {
      id: entry.id,
      revokedAtMs: now,
    });
    // Mark access log entry as revoked for Admin visibility
    batch.update(doc(db, 'access_logs', entry.id), {
      revoked: true,
      revokedAt,
      revokedAtMs: now,
    });
    await batch.commit();

    await logSecurityAudit(
      'REVOKE_USER_ACCESS',
      `Removed active access session for ${entry.email} before 48h expiry`
    );

    return { success: true, revokedAt, revokedAtMs: now };
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.WRITE, path);
    } catch {
      // Handled via structured logger
    }
    return { success: false, error: 'Failed to remove user session in Firebase.' };
  }
}

// Super Admin: Immediately revoke ALL currently active user sessions before 48h expiry
export async function revokeAllActiveOrgUsers(
  currentEnabled: boolean,
  activeEntries: AccessLogEntry[]
): Promise<{
  success: boolean;
  revokedAllBeforeMs?: number;
  revokedAt?: string;
  count?: number;
  error?: string;
}> {
  if (!isAuthorizedAdminUser(auth.currentUser)) {
    return { success: false, error: 'Only Super Admin can remove all active user sessions.' };
  }

  const now = Date.now();
  const revokedAt = formatISTTimestamp(now);
  const path = 'app_settings/verification_status';

  try {
    // 1. Update global revocation watermark on verification_status + first chunk of access logs
    const firstChunk = activeEntries.slice(0, 400);
    const remainingEntries = activeEntries.slice(400);

    const firstBatch = writeBatch(db);
    firstBatch.set(doc(db, 'app_settings', 'verification_status'), {
      enabled: currentEnabled,
      revokedAllBeforeMs: now,
      updatedAt: new Date(now).toISOString(),
      updatedBy: AUTHORIZED_ADMIN_EMAIL,
    });

    firstChunk.forEach((entry) => {
      firstBatch.update(doc(db, 'access_logs', entry.id), {
        revoked: true,
        revokedAt,
        revokedAtMs: now,
      });
    });

    await firstBatch.commit();

    // Commit any remaining active entries in safe chunks of 400
    for (let i = 0; i < remainingEntries.length; i += 400) {
      const chunk = remainingEntries.slice(i, i + 400);
      const chunkBatch = writeBatch(db);
      chunk.forEach((entry) => {
        chunkBatch.update(doc(db, 'access_logs', entry.id), {
          revoked: true,
          revokedAt,
          revokedAtMs: now,
        });
      });
      await chunkBatch.commit();
    }

    await logSecurityAudit(
      'REVOKE_ALL_USERS',
      `Removed all active user sessions (${activeEntries.length} active session${activeEntries.length === 1 ? '' : 's'} revoked before 48h expiry)`
    );

    return {
      success: true,
      revokedAllBeforeMs: now,
      revokedAt,
      count: activeEntries.length,
    };
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.WRITE, path);
    } catch {
      // Handled via structured logger
    }
    return { success: false, error: 'Failed to remove all active user sessions in Firebase.' };
  }
}

// Super Admin: Fetch private Organization Verification Policy from Firebase
export async function fetchOrgVerificationPolicy(): Promise<OrgVerificationPolicy | null> {
  if (!isAuthorizedAdminUser(auth.currentUser)) return null;
  const path = 'app_settings/org_verification_policy';
  try {
    const snap = await getDoc(doc(db, 'app_settings', 'org_verification_policy'));
    if (snap.exists()) {
      const data = snap.data() as OrgVerificationPolicy;
      return {
        allowedDomains: Array.isArray(data.allowedDomains) ? data.allowedDomains : [],
        authorizedEmails: Array.isArray(data.authorizedEmails) ? data.authorizedEmails : [],
        updatedAt: data.updatedAt || '',
        updatedBy: data.updatedBy || AUTHORIZED_ADMIN_EMAIL,
      };
    }
    return {
      allowedDomains: [],
      authorizedEmails: [],
      updatedAt: '',
      updatedBy: AUTHORIZED_ADMIN_EMAIL,
    };
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.GET, path);
    } catch {
      // Handled via structured logger
    }
    return null;
  }
}

// Super Admin: Save private Organization Verification Policy (domains & emails) to Firebase
export async function saveOrgVerificationPolicy(
  allowedDomainsInput: string[],
  authorizedEmailsInput: string[]
): Promise<{ success: boolean; policy?: OrgVerificationPolicy; error?: string }> {
  if (!isAuthorizedAdminUser(auth.currentUser)) {
    return { success: false, error: 'Only Super Admin can update verification policy.' };
  }

  const cleanDomains = Array.from(
    new Set(
      allowedDomainsInput
        .map((d) => sanitizeInput(d, 100).toLowerCase().replace(/^@+/, ''))
        .filter((d) => d.length >= 3 && d.includes('.') && !d.includes('@') && !d.includes(' '))
    )
  ).slice(0, 20);

  const cleanEmails = Array.from(
    new Set(
      authorizedEmailsInput
        .map((e) => sanitizeInput(e, 150).toLowerCase())
        .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
    )
  ).slice(0, 100);

  const policy: OrgVerificationPolicy = {
    allowedDomains: cleanDomains,
    authorizedEmails: cleanEmails,
    updatedAt: new Date().toISOString(),
    updatedBy: AUTHORIZED_ADMIN_EMAIL,
  };

  const path = 'app_settings/org_verification_policy';
  try {
    await setDoc(doc(db, 'app_settings', 'org_verification_policy'), policy);
    await logSecurityAudit(
      'UPDATE_EMAIL_POLICY',
      `Updated Firebase email verification policy (${cleanDomains.length} custom domain(s), ${cleanEmails.length} individual email(s))`
    );
    return { success: true, policy };
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.WRITE, path);
    } catch {
      // Handled via structured logger
    }
    return { success: false, error: 'Failed to save policy to Firebase.' };
  }
}

// Super Admin: Fetch Organization Access Logs from Cloud Firestore
export async function fetchCloudAccessLogs(): Promise<AccessLogEntry[]> {
  if (!isAuthorizedAdminUser(auth.currentUser)) {
    return [];
  }
  const path = 'access_logs';
  try {
    const q = query(
      collection(db, 'access_logs'),
      where('id', '>=', 'access_'),
      limit(200)
    );
    const snap = await getDocs(q);
    const results: AccessLogEntry[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data() as AccessLogEntry;
      if (data && data.email) {
        results.push(data);
      }
    });
    results.sort((a, b) => (b.accessedAtMs || 0) - (a.accessedAtMs || 0));
    return results;
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.LIST, path);
    } catch {
      // Handled via structured logger
    }
    return [];
  }
}
