import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  linkWithCredential,
  reauthenticateWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import type {
  AccountStatus,
  ActivityActionType,
  ActivityLogRecord,
  AlertStatus,
  ApprovalStatus,
  CrowdAlertRecord,
  DangerLevel,
  GateRecommendationRecord,
  MonitoringSessionRecord,
  NotificationRecord,
  UserAccountRecord,
  UserRole,
} from '../types/crowguard';

const primaryApp = getApps().some((a) => a.name === '[DEFAULT]')
  ? getApp()
  : initializeApp(firebaseConfig);

export const db = getFirestore(primaryApp, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(primaryApp);
const googleProvider = new GoogleAuthProvider();

function getAdminCreatorAuth() {
  const creatorName = 'crowguard-admin-creator';
  const existing = getApps().find((a) => a.name === creatorName);
  const creatorApp = existing || initializeApp(firebaseConfig, creatorName);
  return getAuth(creatorApp);
}

const BOOTSTRAPPED_ADMIN_EMAIL = 'varshanv839@gmail.com';
export const FIREBASE_AUTH_CONSOLE_URL = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/providers`;

export const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
} as const;

export type OperationTypeValue = (typeof OperationType)[keyof typeof OperationType];

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationTypeValue;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationTypeValue,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function mapFirebaseAuthError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const codeMatch = raw.match(/\((auth\/[^)]+)\)/);
  const code = codeMatch ? codeMatch[1] : '';

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password. Please verify your credentials or reset your password.';
    case 'auth/email-already-in-use':
      return 'An account with this email address already exists.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters long.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is not yet enabled in Firebase Console (Authentication → Sign-in method → Email/Password).';
    case 'auth/too-many-requests':
      return 'Too many attempts detected. Please wait a moment before retrying.';
    case 'auth/requires-recent-login':
      return 'For security, please verify your current password or sign in again before changing your password.';
    case 'auth/popup-closed-by-user':
      return 'Google sign-in popup was closed before completing authentication.';
    case 'auth/user-disabled':
      return 'This authentication account has been disabled.';
    default:
      return raw || 'Authentication failed. Please try again.';
  }
}

export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
      return false;
    }
    return true;
  }
}

function sanitizeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128) || 'id_default';
}

function clip(value: string, maxLen: number): string {
  return value.trim().slice(0, maxLen) || 'N/A';
}

function clipPhoto(value: string | null | undefined): string {
  return (value || '').trim().slice(0, 500);
}

function tsMillis(ts: unknown): number {
  if (ts && typeof ts === 'object' && 'toMillis' in ts && typeof (ts as { toMillis: () => number }).toMillis === 'function') {
    return (ts as { toMillis: () => number }).toMillis();
  }
  return 0;
}

function formatDateTime(ts: unknown): string {
  if (ts && typeof ts === 'object' && 'toDate' in ts && typeof (ts as { toDate: () => Date }).toDate === 'function') {
    return (ts as { toDate: () => Date }).toDate().toLocaleString([], {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return new Date().toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTs(ts: unknown): string {
  if (ts && typeof ts === 'object' && 'toDate' in ts && typeof (ts as { toDate: () => Date }).toDate === 'function') {
    return (ts as { toDate: () => Date }).toDate().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function normalizeDangerLevel(val: unknown): DangerLevel {
  if (val === 'LOW' || val === 'MEDIUM' || val === 'HIGH' || val === 'CRITICAL') {
    return val;
  }
  if (val === 'MODERATE') return 'MEDIUM';
  return 'LOW';
}

function normalizeAlertStatus(val: unknown): AlertStatus {
  if (val === 'new' || val === 'acknowledged' || val === 'responding' || val === 'resolved') {
    return val;
  }
  if (val === 'active') return 'new';
  return 'new';
}

export async function verifyServerSession(user: User): Promise<{
  verified: boolean;
  bootstrappedAdmin: boolean;
}> {
  try {
    const token = await user.getIdToken();
    const res = await fetch('/api/auth/session', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { verified: false, bootstrappedAdmin: false };
    const data = await res.json();
    return {
      verified: Boolean(data.verified),
      bootstrappedAdmin: Boolean(data.bootstrappedAdmin),
    };
  } catch {
    return { verified: false, bootstrappedAdmin: false };
  }
}

async function authorizeAdminOnServer(user: User, claimedRole: UserRole): Promise<void> {
  const token = await user.getIdToken();
  const res = await fetch('/api/admin/authorize-action', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ claimedRole }),
  });
  const data = await res.json();
  if (!res.ok || !data.authorized) {
    throw new Error(data.error || 'Server authorization denied: Admin privileges required.');
  }
}

export async function logUserActivity(params: {
  userId: string;
  userName: string;
  userEmail: string;
  actionType: ActivityActionType;
  details: string;
}): Promise<void> {
  const logId = `log_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  try {
    await setDoc(doc(db, 'activityLogs', logId), {
      userId: sanitizeId(params.userId),
      userName: clip(params.userName, 100),
      userEmail: (params.userEmail || '').trim().slice(0, 200),
      actionType: params.actionType,
      details: clip(params.details, 300),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Activity log write failed:', error);
  }
}

export async function ensureAndLoadUserProfile(
  user: User,
  options?: { recordLogin?: boolean; explicitName?: string }
): Promise<UserAccountRecord> {
  const uid = sanitizeId(user.uid);
  const profileRef = doc(db, 'users', uid);
  const contactRef = doc(db, 'users', uid, 'private', 'contact');
  const adminRef = doc(db, 'admins', uid);

  const isBootstrappedAdmin =
    user.email === BOOTSTRAPPED_ADMIN_EMAIL && user.emailVerified;

  let resolvedRole: UserRole = isBootstrappedAdmin ? 'admin' : 'operator';
  let resolvedStatus: AccountStatus = 'active';

  try {
    const [snap, adminSnap] = await Promise.all([
      getDoc(profileRef),
      getDoc(adminRef).catch(() => null),
    ]);

    const hasAdminDoc = Boolean(adminSnap && adminSnap.exists());
    const displayName = clip(
      options?.explicitName || user.displayName || user.email?.split('@')[0] || 'Operator',
      100
    );
    const photoURL = clipPhoto(user.photoURL);

    if (!snap.exists()) {
      resolvedRole = isBootstrappedAdmin || hasAdminDoc ? 'admin' : 'operator';
      resolvedStatus = 'active';
      await setDoc(profileRef, {
        uid,
        displayName,
        photoURL,
        role: resolvedRole,
        status: resolvedStatus,
        lastLoginAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const data = snap.data();
      resolvedStatus = data.status === 'inactive' ? 'inactive' : 'active';
      resolvedRole =
        isBootstrappedAdmin || hasAdminDoc || data.role === 'admin' ? 'admin' : 'operator';

      if (resolvedStatus === 'active') {
        const updatePayload: Record<string, unknown> = {
          displayName: data.displayName || displayName,
          photoURL: data.photoURL !== undefined ? data.photoURL : photoURL,
          status: 'active',
          lastLoginAt: options?.recordLogin ? serverTimestamp() : data.lastLoginAt || serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        if (isBootstrappedAdmin && data.role !== 'admin') {
          updatePayload.role = 'admin';
        }
        await updateDoc(profileRef, updatePayload);
      }
    }

    const email = clip(user.email || `${uid}@operator.local`, 200);
    const contactSnap = await getDoc(contactRef);
    if (!contactSnap.exists()) {
      await setDoc(contactRef, {
        uid,
        email,
        updatedAt: serverTimestamp(),
      });
    } else if (contactSnap.data().email !== email) {
      await updateDoc(contactRef, {
        email,
        updatedAt: serverTimestamp(),
      });
    }

    const freshSnap = await getDoc(profileRef);
    const fresh = freshSnap.data() || {};

    return {
      uid,
      displayName: String(fresh.displayName || displayName),
      email: user.email || '',
      photoURL: String(fresh.photoURL || photoURL),
      role: resolvedRole,
      status: resolvedStatus,
      emailVerified: user.emailVerified,
      createdAtLabel: formatDateTime(fresh.createdAt),
      lastLoginAtLabel: formatDateTime(fresh.lastLoginAt),
      updatedAtLabel: formatDateTime(fresh.updatedAt),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
  }
}

export async function loginWithEmailPassword(
  email: string,
  password: string
): Promise<UserAccountRecord> {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  const profile = await ensureAndLoadUserProfile(cred.user, { recordLogin: true });
  if (profile.status === 'inactive') {
    await signOut(auth);
    throw new Error('Your account has been deactivated by an administrator. Contact your CROWGUARD Admin.');
  }
  await verifyServerSession(cred.user);
  await logUserActivity({
    userId: cred.user.uid,
    userName: profile.displayName,
    userEmail: profile.email,
    actionType: 'LOGIN',
    details: `Signed in via Email & Password (${profile.role === 'admin' ? 'ADMIN' : 'SECURITY OPERATOR'}).`,
  });
  return profile;
}

export async function registerWithEmailPassword(params: {
  displayName: string;
  email: string;
  password: string;
}): Promise<UserAccountRecord> {
  const cred = await createUserWithEmailAndPassword(
    auth,
    params.email.trim(),
    params.password
  );
  await updateProfile(cred.user, {
    displayName: params.displayName.trim(),
  });
  try {
    await sendEmailVerification(cred.user);
  } catch {
    // Verification email send is best-effort
  }

  const profile = await ensureAndLoadUserProfile(cred.user, {
    recordLogin: true,
    explicitName: params.displayName.trim(),
  });
  await verifyServerSession(cred.user);
  await logUserActivity({
    userId: cred.user.uid,
    userName: profile.displayName,
    userEmail: profile.email,
    actionType: 'REGISTER',
    details: 'New Security Operator registered via Email & Password.',
  });
  return profile;
}

export async function signInWithGoogle(): Promise<UserAccountRecord> {
  const result = await signInWithPopup(auth, googleProvider);
  const profile = await ensureAndLoadUserProfile(result.user, { recordLogin: true });
  if (profile.status === 'inactive') {
    await signOut(auth);
    throw new Error('Your account has been deactivated by an administrator. Contact your CROWGUARD Admin.');
  }
  await verifyServerSession(result.user);
  await logUserActivity({
    userId: result.user.uid,
    userName: profile.displayName,
    userEmail: profile.email,
    actionType: 'LOGIN',
    details: `Signed in via Google OAuth (${profile.role === 'admin' ? 'ADMIN' : 'SECURITY OPERATOR'}).`,
  });
  return profile;
}

export async function resetOperatorPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

export async function resendVerificationEmail(user: User): Promise<void> {
  await sendEmailVerification(user);
}

export async function updateOperatorProfile(
  user: User,
  currentProfile: UserAccountRecord,
  updates: { displayName: string; photoURL: string }
): Promise<UserAccountRecord> {
  const uid = sanitizeId(user.uid);
  const nextName = clip(updates.displayName, 100);
  const nextPhoto = clipPhoto(updates.photoURL);

  await updateProfile(user, {
    displayName: nextName,
    photoURL: nextPhoto || null,
  });

  try {
    await updateDoc(doc(db, 'users', uid), {
      displayName: nextName,
      photoURL: nextPhoto,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }

  await logUserActivity({
    userId: user.uid,
    userName: nextName,
    userEmail: currentProfile.email,
    actionType: 'PROFILE_UPDATE',
    details: 'Updated operator display name / profile avatar.',
  });

  return {
    ...currentProfile,
    displayName: nextName,
    photoURL: nextPhoto,
    updatedAtLabel: formatDateTime(null),
  };
}

export async function changeOperatorPassword(
  user: User,
  currentProfile: UserAccountRecord,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  if (!user.email) {
    throw new Error('No email address associated with this account.');
  }
  const hasPasswordProvider = user.providerData.some((p) => p.providerId === 'password');
  if (!hasPasswordProvider) {
    throw new Error('This account uses Google Sign-In. Manage your password in your Google Account security settings.');
  }

  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);

  await logUserActivity({
    userId: user.uid,
    userName: currentProfile.displayName,
    userEmail: currentProfile.email,
    actionType: 'PASSWORD_CHANGE',
    details: 'Account password changed after re-authentication.',
  });
}

export async function linkEmailPasswordToAccount(
  user: User,
  currentProfile: UserAccountRecord,
  newPassword: string
): Promise<void> {
  if (!user.email) {
    throw new Error('No email address associated with this account.');
  }
  const credential = EmailAuthProvider.credential(user.email, newPassword);
  await linkWithCredential(user, credential);
  await logUserActivity({
    userId: user.uid,
    userName: currentProfile.displayName,
    userEmail: currentProfile.email,
    actionType: 'PASSWORD_CHANGE',
    details: 'Linked Email & Password sign-in credential to account.',
  });
}

export async function signOutOperator(profile?: UserAccountRecord | null): Promise<void> {
  const currentUser = auth.currentUser;
  if (currentUser && profile) {
    await logUserActivity({
      userId: currentUser.uid,
      userName: profile.displayName,
      userEmail: profile.email,
      actionType: 'LOGOUT',
      details: 'Operator signed out securely.',
    });
  }
  await signOut(auth);
}

// --- Admin Management Operations (Protected by Server Token Check + Firestore Rules) ---
export async function adminCreateUser(params: {
  adminUser: User;
  adminProfile: UserAccountRecord;
  displayName: string;
  email: string;
  temporaryPassword: string;
  role: UserRole;
}): Promise<void> {
  await authorizeAdminOnServer(params.adminUser, params.adminProfile.role);

  const secondaryAuth = getAdminCreatorAuth();
  const createdCred = await createUserWithEmailAndPassword(
    secondaryAuth,
    params.email.trim(),
    params.temporaryPassword
  );
  const newUid = sanitizeId(createdCred.user.uid);
  const cleanName = clip(params.displayName, 100);
  const cleanEmail = clip(params.email, 200);

  try {
    await updateProfile(createdCred.user, { displayName: cleanName });
    try {
      await sendEmailVerification(createdCred.user);
    } catch {
      // Best-effort verification email
    }
  } finally {
    await signOut(secondaryAuth);
  }

  try {
    await setDoc(doc(db, 'users', newUid), {
      uid: newUid,
      displayName: cleanName,
      photoURL: '',
      role: params.role,
      status: 'active',
      lastLoginAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await setDoc(doc(db, 'users', newUid, 'private', 'contact'), {
      uid: newUid,
      email: cleanEmail,
      updatedAt: serverTimestamp(),
    });

    if (params.role === 'admin') {
      await setDoc(doc(db, 'admins', newUid), {
        uid: newUid,
        assignedBy: sanitizeId(params.adminUser.uid),
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `users/${newUid}`);
  }

  await logUserActivity({
    userId: params.adminUser.uid,
    userName: params.adminProfile.displayName,
    userEmail: params.adminProfile.email,
    actionType: 'USER_CREATED',
    details: `Admin created user ${cleanName} (${cleanEmail}) with role ${params.role === 'admin' ? 'ADMIN' : 'SECURITY OPERATOR'}.`,
  });
}

export async function adminUpdateUserRole(
  adminUser: User,
  adminProfile: UserAccountRecord,
  targetUser: UserAccountRecord,
  newRole: UserRole
): Promise<void> {
  if (targetUser.uid === sanitizeId(adminUser.uid)) {
    throw new Error('Administrators cannot demote their own active session.');
  }
  await authorizeAdminOnServer(adminUser, adminProfile.role);

  const targetUid = sanitizeId(targetUser.uid);
  try {
    await updateDoc(doc(db, 'users', targetUid), {
      role: newRole,
      updatedAt: serverTimestamp(),
    });
    if (newRole === 'admin') {
      await setDoc(doc(db, 'admins', targetUid), {
        uid: targetUid,
        assignedBy: sanitizeId(adminUser.uid),
        createdAt: serverTimestamp(),
      });
    } else {
      await deleteDoc(doc(db, 'admins', targetUid)).catch(() => undefined);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${targetUid}`);
  }

  await logUserActivity({
    userId: adminUser.uid,
    userName: adminProfile.displayName,
    userEmail: adminProfile.email,
    actionType: 'ROLE_CHANGE',
    details: `Changed ${targetUser.displayName} (${targetUser.email}) role to ${newRole === 'admin' ? 'ADMIN' : 'SECURITY OPERATOR'}.`,
  });
}

export async function adminToggleUserStatus(
  adminUser: User,
  adminProfile: UserAccountRecord,
  targetUser: UserAccountRecord,
  newStatus: AccountStatus
): Promise<void> {
  if (targetUser.uid === sanitizeId(adminUser.uid)) {
    throw new Error('Administrators cannot deactivate their own active account.');
  }
  await authorizeAdminOnServer(adminUser, adminProfile.role);

  const targetUid = sanitizeId(targetUser.uid);
  try {
    await updateDoc(doc(db, 'users', targetUid), {
      status: newStatus,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${targetUid}`);
  }

  await logUserActivity({
    userId: adminUser.uid,
    userName: adminProfile.displayName,
    userEmail: adminProfile.email,
    actionType: 'STATUS_CHANGE',
    details: `${newStatus === 'active' ? 'Activated' : 'Deactivated'} account for ${targetUser.displayName} (${targetUser.email}).`,
  });
}

export function subscribeAllUsersForAdmin(
  onUsers: (users: UserAccountRecord[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'users'),
    async (snap) => {
      const records = await Promise.all(
        snap.docs.map(async (d) => {
          const data = d.data();
          let email = '';
          try {
            const contactSnap = await getDoc(doc(db, 'users', d.id, 'private', 'contact'));
            if (contactSnap.exists()) {
              email = String(contactSnap.data().email || '');
            }
          } catch {
            email = '';
          }
          return {
            uid: d.id,
            displayName: String(data.displayName || 'Operator'),
            email,
            photoURL: String(data.photoURL || ''),
            role: data.role === 'admin' ? 'admin' : 'operator',
            status: data.status === 'inactive' ? 'inactive' : 'active',
            emailVerified: true,
            createdAtLabel: formatDateTime(data.createdAt),
            lastLoginAtLabel: formatDateTime(data.lastLoginAt || data.updatedAt),
            updatedAtLabel: formatDateTime(data.updatedAt),
          } satisfies UserAccountRecord;
        })
      );
      onUsers(records);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'users')
  );
}

export function subscribeActivityLogs(
  user: User,
  role: UserRole,
  onLogs: (logs: ActivityLogRecord[]) => void
): Unsubscribe {
  const uid = sanitizeId(user.uid);
  const logsQuery =
    role === 'admin'
      ? query(collection(db, 'activityLogs'), orderBy('createdAt', 'desc'), limit(60))
      : query(
          collection(db, 'activityLogs'),
          where('userId', '==', uid),
          limit(40)
        );

  return onSnapshot(
    logsQuery,
    (snap) => {
      const items: ActivityLogRecord[] = snap.docs
        .slice()
        .sort((a, b) => tsMillis(b.data().createdAt) - tsMillis(a.data().createdAt))
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            userId: String(data.userId || uid),
            userName: String(data.userName || 'Operator'),
            userEmail: String(data.userEmail || ''),
            actionType: data.actionType || 'LOGIN',
            details: String(data.details || ''),
            createdAtLabel: formatDateTime(data.createdAt),
          };
        });
      onLogs(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'activityLogs')
  );
}

export async function saveSessionAlertsAndGatesToFirestore(params: {
  user: User;
  session: Omit<MonitoringSessionRecord, 'ownerId' | 'createdAtLabel' | 'persistedToFirestore'>;
  alerts: Omit<CrowdAlertRecord, 'ownerId' | 'sessionId' | 'createdAtLabel' | 'persistedToFirestore'>[];
  gates: Omit<GateRecommendationRecord, 'ownerId' | 'alertId' | 'createdAtLabel' | 'persistedToFirestore'>[];
}): Promise<void> {
  const uid = sanitizeId(params.user.uid);
  const sessionId = sanitizeId(params.session.id);

  try {
    await setDoc(doc(db, 'monitoringSessions', sessionId), {
      ownerId: uid,
      title: clip(params.session.title, 140),
      sourceType: params.session.sourceType,
      analysisMode: params.session.analysisMode,
      totalPeopleDetected: Math.max(0, Math.round(params.session.totalPeopleDetected)),
      peakDensity: Math.max(0, Math.min(50, Number(params.session.peakDensity.toFixed(2)))),
      dangerScore: Math.max(0, Math.min(100, Number(params.session.dangerScore.toFixed(1)))),
      safetyStatus: params.session.safetyStatus,
      movementPattern: clip(params.session.movementPattern, 120),
      anomalyFlags: params.session.anomalyFlags.slice(0, 10).map((f) => clip(f, 64)),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `monitoringSessions/${sessionId}`);
  }

  const createdAlertIds: string[] = [];
  for (const alert of params.alerts) {
    const alertId = sanitizeId(alert.id);
    const historyArr = (
      alert.actionHistory.length > 0
        ? alert.actionHistory
        : [`[${new Date().toLocaleTimeString()}] Incident logged (${alert.dangerLevel})`]
    )
      .slice(0, 20)
      .map((entry) => clip(entry, 220));

    try {
      await setDoc(doc(db, 'alerts', alertId), {
        ownerId: uid,
        sessionId,
        location: clip(alert.location, 120),
        zoneName: clip(alert.zoneName, 80),
        densityLevel: alert.densityLevel,
        peoplePerSqm: Math.max(0, Math.min(50, Number(alert.peoplePerSqm.toFixed(2)))),
        dangerScore: Math.max(0, Math.min(100, Number(alert.dangerScore.toFixed(1)))),
        dangerLevel: alert.dangerLevel,
        status: 'new',
        assignedTeam: clip(alert.assignedTeam || 'Unassigned', 80),
        actionHistory: historyArr,
        suggestedAction: clip(alert.suggestedAction, 300),
        sourceKind: alert.sourceKind,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      createdAlertIds.push(alertId);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `alerts/${alertId}`);
    }
  }

  const parentAlertId = createdAlertIds[0];
  if (!parentAlertId) return;

  for (const gate of params.gates) {
    const recId = sanitizeId(gate.id);
    try {
      await setDoc(doc(db, 'gateRecommendations', recId), {
        ownerId: uid,
        alertId: parentAlertId,
        gateName: clip(gate.gateName, 80),
        recommendedAction: gate.recommendedAction,
        reason: clip(gate.reason, 300),
        projectedDensityDrop: Math.max(0, Math.min(100, Number(gate.projectedDensityDrop.toFixed(1)))),
        approvalStatus: 'pending',
        reviewedBy: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `gateRecommendations/${recId}`);
    }
  }
}

export async function updateIncidentInFirestore(
  alertId: string,
  updates: {
    status: AlertStatus;
    assignedTeam: string;
    actionHistory: string[];
  }
): Promise<void> {
  const safeId = sanitizeId(alertId);
  try {
    await updateDoc(doc(db, 'alerts', safeId), {
      status: updates.status,
      assignedTeam: clip(updates.assignedTeam, 80),
      actionHistory: updates.actionHistory.slice(-20).map((e) => clip(e, 220)),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `alerts/${safeId}`);
  }
}

export async function reviewGateRecommendationInFirestore(
  recId: string,
  approvalStatus: Exclude<ApprovalStatus, 'pending'>,
  reviewerUid: string
): Promise<void> {
  const safeId = sanitizeId(recId);
  try {
    await updateDoc(doc(db, 'gateRecommendations', safeId), {
      approvalStatus,
      reviewedBy: sanitizeId(reviewerUid),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `gateRecommendations/${safeId}`);
  }
}

export async function createNotificationInFirestore(
  user: User,
  notif: Omit<NotificationRecord, 'ownerId' | 'createdAtLabel' | 'persistedToFirestore'>
): Promise<void> {
  const uid = sanitizeId(user.uid);
  const safeId = sanitizeId(notif.id);
  try {
    await setDoc(doc(db, 'notifications', safeId), {
      ownerId: uid,
      title: clip(notif.title, 120),
      message: clip(notif.message, 300),
      severity: notif.severity,
      zoneName: clip(notif.zoneName, 80),
      read: false,
      sourceKind: notif.sourceKind,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `notifications/${safeId}`);
  }
}

export async function markNotificationReadInFirestore(
  notifId: string,
  read: boolean
): Promise<void> {
  const safeId = sanitizeId(notifId);
  try {
    await updateDoc(doc(db, 'notifications', safeId), {
      read,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `notifications/${safeId}`);
  }
}

export function subscribeOperatorData(
  user: User,
  role: UserRole,
  callbacks: {
    onSessions: (sessions: MonitoringSessionRecord[]) => void;
    onAlerts: (alerts: CrowdAlertRecord[]) => void;
    onGates: (gates: GateRecommendationRecord[]) => void;
    onNotifications: (notifications: NotificationRecord[]) => void;
  }
): Unsubscribe {
  const uid = sanitizeId(user.uid);
  const isAdminRole = role === 'admin';

  const sessionsQuery = isAdminRole
    ? query(collection(db, 'monitoringSessions'), orderBy('createdAt', 'desc'), limit(30))
    : query(collection(db, 'monitoringSessions'), where('ownerId', '==', uid), limit(25));

  const alertsQuery = isAdminRole
    ? query(collection(db, 'alerts'), orderBy('createdAt', 'desc'), limit(40))
    : query(collection(db, 'alerts'), where('ownerId', '==', uid), limit(30));

  const gatesQuery = isAdminRole
    ? query(collection(db, 'gateRecommendations'), orderBy('createdAt', 'desc'), limit(30))
    : query(collection(db, 'gateRecommendations'), where('ownerId', '==', uid), limit(30));

  const notificationsQuery = isAdminRole
    ? query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(30))
    : query(collection(db, 'notifications'), where('ownerId', '==', uid), limit(30));

  const unsubSessions = onSnapshot(
    sessionsQuery,
    (snap) => {
      const items: MonitoringSessionRecord[] = snap.docs
        .slice()
        .sort((a, b) => tsMillis(b.data().createdAt) - tsMillis(a.data().createdAt))
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ownerId: String(data.ownerId || uid),
            title: String(data.title || 'Untitled Session'),
            sourceType:
              data.sourceType === 'uploaded_video'
                ? 'uploaded_video'
                : data.sourceType === 'manual_report'
                ? 'manual_report'
                : 'simulation_sample',
            analysisMode:
              data.analysisMode === 'real_opencv'
                ? 'real_opencv'
                : data.analysisMode === 'operator_report'
                ? 'operator_report'
                : 'simulated_scenario',
            totalPeopleDetected: Number(data.totalPeopleDetected || 0),
            peakDensity: Number(data.peakDensity || 0),
            dangerScore: Number(data.dangerScore || 0),
            safetyStatus: data.safetyStatus || 'SAFE',
            movementPattern: String(data.movementPattern || 'Normal Flow'),
            anomalyFlags: Array.isArray(data.anomalyFlags) ? data.anomalyFlags.map(String) : [],
            createdAtLabel: formatTs(data.createdAt),
            persistedToFirestore: true,
          };
        });
      callbacks.onSessions(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'monitoringSessions')
  );

  const unsubAlerts = onSnapshot(
    alertsQuery,
    (snap) => {
      const items: CrowdAlertRecord[] = snap.docs
        .slice()
        .sort((a, b) => tsMillis(b.data().createdAt) - tsMillis(a.data().createdAt))
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ownerId: String(data.ownerId || uid),
            sessionId: String(data.sessionId || ''),
            location: String(data.location || ''),
            zoneName: String(data.zoneName || ''),
            densityLevel: data.densityLevel || 'LOW',
            peoplePerSqm: Number(data.peoplePerSqm || 0),
            dangerScore: Number(data.dangerScore || 0),
            dangerLevel: normalizeDangerLevel(data.dangerLevel),
            status: normalizeAlertStatus(data.status),
            assignedTeam: String(data.assignedTeam || 'Unassigned'),
            actionHistory: Array.isArray(data.actionHistory) ? data.actionHistory.map(String) : [],
            suggestedAction: String(data.suggestedAction || ''),
            sourceKind: data.sourceKind || 'real_video_analysis',
            createdAtLabel: formatTs(data.createdAt),
            persistedToFirestore: true,
          };
        });
      callbacks.onAlerts(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'alerts')
  );

  const unsubGates = onSnapshot(
    gatesQuery,
    (snap) => {
      const items: GateRecommendationRecord[] = snap.docs
        .slice()
        .sort((a, b) => tsMillis(b.data().createdAt) - tsMillis(a.data().createdAt))
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ownerId: String(data.ownerId || uid),
            alertId: String(data.alertId || ''),
            gateName: String(data.gateName || ''),
            recommendedAction: data.recommendedAction || 'HOLD_CURRENT',
            reason: String(data.reason || ''),
            projectedDensityDrop: Number(data.projectedDensityDrop || 0),
            approvalStatus: data.approvalStatus || 'pending',
            reviewedBy: String(data.reviewedBy || ''),
            createdAtLabel: formatTs(data.createdAt),
            persistedToFirestore: true,
          };
        });
      callbacks.onGates(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'gateRecommendations')
  );

  const unsubNotifications = onSnapshot(
    notificationsQuery,
    (snap) => {
      const items: NotificationRecord[] = snap.docs
        .slice()
        .sort((a, b) => tsMillis(b.data().createdAt) - tsMillis(a.data().createdAt))
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ownerId: String(data.ownerId || uid),
            title: String(data.title || 'Safety Notification'),
            message: String(data.message || ''),
            severity: normalizeDangerLevel(data.severity),
            zoneName: String(data.zoneName || 'Operations'),
            read: Boolean(data.read),
            sourceKind: data.sourceKind || 'system_action',
            createdAtLabel: formatTs(data.createdAt),
            persistedToFirestore: true,
          };
        });
      callbacks.onNotifications(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'notifications')
  );

  return () => {
    unsubSessions();
    unsubAlerts();
    unsubGates();
    unsubNotifications();
  };
}
