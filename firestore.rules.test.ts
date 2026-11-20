/**
 * Adversarial Security Rules Specification (Dirty Dozen Test Cases)
 * Verified against /security_spec.md and /firestore.rules.
 * Run with Firebase Emulator Suite (`@firebase/rules-unit-testing`) when testing locally.
 */
export interface DirtyDozenCase {
  id: string;
  name: string;
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  expected: 'PERMISSION_DENIED';
  payload?: Record<string, unknown>;
}

export const DIRTY_DOZEN_CASES: DirtyDozenCase[] = [
  {
    id: 'DD-01',
    name: 'Self-Assigned Admin on Registration',
    path: '/users/user_eve',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { uid: 'user_eve', displayName: 'Eve', role: 'admin', status: 'active' },
  },
  {
    id: 'DD-02',
    name: 'Profile Role Escalation Update',
    path: '/users/user_eve',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    payload: { role: 'admin' },
  },
  {
    id: 'DD-03',
    name: 'Self-Reactivation After Admin Deactivation',
    path: '/users/user_eve',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    payload: { status: 'active' },
  },
  {
    id: 'DD-04',
    name: 'Unauthorized Write to Admins Registry',
    path: '/admins/user_eve',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { uid: 'user_eve', assignedBy: 'user_eve' },
  },
  {
    id: 'DD-05',
    name: 'PII Cross-Read on Private Subcollection',
    path: '/users/user_alice/private/contact',
    operation: 'get',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-06',
    name: 'Unverified Email Admin Spoof Attempt',
    path: '/users',
    operation: 'list',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-07',
    name: 'Owner Spoofing on Session Create',
    path: '/monitoringSessions/sess_spoof',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { ownerId: 'user_alice', title: 'Spoofed' },
  },
  {
    id: 'DD-08',
    name: 'Orphaned Alert Without Valid Session',
    path: '/alerts/alert_orphan',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { ownerId: 'user_eve', sessionId: 'nonexistent_session' },
  },
  {
    id: 'DD-09',
    name: 'Shadow Ghost Field Injection',
    path: '/alerts/alert_ghost',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { ownerId: 'user_eve', isBypassed: true },
  },
  {
    id: 'DD-10',
    name: 'Activity Log Tampering / Delete Attempt',
    path: '/activityLogs/log_1',
    operation: 'delete',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-11',
    name: 'Terminal Gate Approval Reversal',
    path: '/gateRecommendations/rec_approved',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    payload: { approvalStatus: 'pending' },
  },
  {
    id: 'DD-12',
    name: 'Blanket List Scraping Across Owners',
    path: '/activityLogs',
    operation: 'list',
    expected: 'PERMISSION_DENIED',
  },
];
