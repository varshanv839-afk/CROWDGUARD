import React, { useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  Users,
  UserPlus,
  Search,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  UserX,
  Clock,
  Lock,
  AlertTriangle,
  X,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import {
  adminCreateUser,
  adminToggleUserStatus,
  adminUpdateUserRole,
  mapFirebaseAuthError,
} from '../lib/firebase';
import type {
  AccountStatus,
  ActivityLogRecord,
  CrowdAlertRecord,
  UserAccountRecord,
  UserRole,
} from '../types/crowguard';

interface AdminManagementViewProps {
  currentUser: User | null;
  currentProfile: UserAccountRecord | null;
  users: UserAccountRecord[];
  activityLogs: ActivityLogRecord[];
  alerts: CrowdAlertRecord[];
  onReturnOperator: () => void;
  onInspectIncidents: () => void;
}

export const AdminManagementView: React.FC<AdminManagementViewProps> = ({
  currentUser,
  currentProfile,
  users,
  activityLogs,
  alerts,
  onReturnOperator,
  onInspectIncidents,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | AccountStatus>('all');
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Add New User Modal State
  const [showAddUser, setShowAddUser] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newTempPassword, setNewTempPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('operator');
  const [creatingUser, setCreatingUser] = useState(false);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (statusFilter !== 'all' && u.status !== statusFilter) return false;
      if (!q) return true;
      return (
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.uid.toLowerCase().includes(q)
      );
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  // Hard Frontend + Server Gate: Unauthorized non-admins are explicitly blocked
  if (!currentUser || !currentProfile || currentProfile.role !== 'admin') {
    return (
      <div className="max-w-xl mx-auto mt-12 bg-[#0D1424] border border-red-500/40 rounded-2xl p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-red-950/60 border border-red-500/40 flex items-center justify-center text-red-400 mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-display font-bold text-white">
          Unauthorized Access Blocked (403)
        </h2>
        <p className="text-sm text-slate-400">
          Admin Management requires an authorized Administrator account verified by Firebase Authentication and Firestore Security Rules.
        </p>
        <button
          type="button"
          onClick={onReturnOperator}
          className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
        >
          Return to Security Operator Dashboard
        </button>
      </div>
    );
  }

  const adminCount = users.filter((u) => u.role === 'admin').length;
  const operatorCount = users.filter((u) => u.role === 'operator').length;
  const activeCount = users.filter((u) => u.status === 'active').length;
  const openAlerts = alerts.filter((a) => a.status !== 'resolved');

  const handleRoleChange = async (target: UserAccountRecord, nextRole: UserRole) => {
    if (target.role === nextRole) return;
    setFeedback(null);
    setBusyUid(target.uid);
    try {
      await adminUpdateUserRole(currentUser, currentProfile, target, nextRole);
      setFeedback({
        type: 'success',
        text: `Updated ${target.displayName} role to ${nextRole === 'admin' ? 'ADMIN' : 'SECURITY OPERATOR'}.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to update user role.',
      });
    } finally {
      setBusyUid(null);
    }
  };

  const handleToggleStatus = async (target: UserAccountRecord) => {
    const nextStatus: AccountStatus = target.status === 'active' ? 'inactive' : 'active';
    setFeedback(null);
    setBusyUid(target.uid);
    try {
      await adminToggleUserStatus(currentUser, currentProfile, target, nextStatus);
      setFeedback({
        type: 'success',
        text: `${nextStatus === 'active' ? 'Activated' : 'Deactivated'} account for ${target.displayName}.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to update account status.',
      });
    } finally {
      setBusyUid(null);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (newName.trim().length < 2) {
      setFeedback({ type: 'error', text: 'Full name must be at least 2 characters.' });
      return;
    }
    if (newTempPassword.length < 6) {
      setFeedback({ type: 'error', text: 'Temporary password must be at least 6 characters.' });
      return;
    }

    setCreatingUser(true);
    try {
      await adminCreateUser({
        adminUser: currentUser,
        adminProfile: currentProfile,
        displayName: newName.trim(),
        email: newEmail.trim(),
        temporaryPassword: newTempPassword,
        role: newRole,
      });
      setFeedback({
        type: 'success',
        text: `Created ${newRole === 'admin' ? 'ADMIN' : 'SECURITY OPERATOR'} account for ${newEmail.trim()}.`,
      });
      setNewName('');
      setNewEmail('');
      setNewTempPassword('');
      setNewRole('operator');
      setShowAddUser(false);
    } catch (err) {
      setFeedback({ type: 'error', text: mapFirebaseAuthError(err) });
    } finally {
      setCreatingUser(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Admin KPI Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-[#0D1424] border border-slate-800/80 rounded-xl p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Registered Personnel</span>
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-2xl font-mono font-bold text-white">{users.length}</p>
          <p className="text-xs text-slate-400">{activeCount} active accounts</p>
        </div>

        <div className="bg-[#0D1424] border border-slate-800/80 rounded-xl p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Administrators</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-mono font-bold text-white">{adminCount}</p>
          <p className="text-xs text-slate-400">Full RBAC &amp; audit privilege</p>
        </div>

        <div className="bg-[#0D1424] border border-slate-800/80 rounded-xl p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Security Operators</span>
            <UserCheck className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-2xl font-mono font-bold text-white">{operatorCount}</p>
          <p className="text-xs text-slate-400">CCTV &amp; incident responders</p>
        </div>

        <div className="bg-[#0D1424] border border-slate-800/80 rounded-xl p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Open Safety Incidents</span>
            <ShieldAlert className="w-4 h-4 text-red-400" />
          </div>
          <p className="text-2xl font-mono font-bold text-white">{openAlerts.length}</p>
          <p className="text-xs text-slate-400">{alerts.length} total recorded alerts</p>
        </div>
      </section>

      {feedback && (
        <div
          className={`rounded-xl px-4 py-3 border flex items-center gap-2.5 text-xs ${
            feedback.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
              : 'bg-red-950/40 border-red-500/40 text-red-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* User Directory & RBAC Controls */}
      <section className="bg-[#0D1424] border border-slate-800/80 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">User Accounts &amp; Role Management</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Assign ADMIN or SECURITY OPERATOR roles, activate or deactivate accounts, and provision new personnel
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAddUser((v) => !v)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors whitespace-nowrap"
          >
            {showAddUser ? <X className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
            {showAddUser ? 'Close Form' : 'Add New User'}
          </button>
        </div>

        {/* Add User Inline Form */}
        {showAddUser && (
          <form
            onSubmit={handleCreateUser}
            className="p-5 bg-[#0A101D] border-b border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end"
          >
            <div className="space-y-1">
              <label className="block text-xs text-slate-400">Full Name</label>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Jordan Vance"
                className="w-full bg-[#070B14] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs text-slate-400">Email Address</label>
              <input
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="operator@venue.org"
                className="w-full bg-[#070B14] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs text-slate-400">Temporary Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={newTempPassword}
                onChange={(e) => setNewTempPassword(e.target.value)}
                placeholder="Min 6 chars"
                className="w-full bg-[#070B14] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs text-slate-400">Assign Role</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as UserRole)}
                className="w-full bg-[#070B14] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="operator">SECURITY OPERATOR</option>
                <option value="admin">ADMIN</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={creatingUser}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-medium transition-colors whitespace-nowrap"
            >
              {creatingUser ? 'Creating...' : 'Create Account'}
            </button>
          </form>
        )}

        {/* Search and Filters */}
        <div className="px-5 py-3.5 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 bg-[#0A101D]/60">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full bg-[#070B14] border border-slate-800 focus:border-blue-500 focus:outline-none rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-[#070B14] border border-slate-800 rounded-lg">
              {(['all', 'admin', 'operator'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRoleFilter(r)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                    roleFilter === r ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {r === 'all' ? 'All Roles' : r === 'admin' ? 'Admins' : 'Operators'}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 p-1 bg-[#070B14] border border-slate-800 rounded-lg">
              {(['all', 'active', 'inactive'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-colors whitespace-nowrap ${
                    statusFilter === s ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {s === 'all' ? 'All Status' : s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800/80 text-[11px] font-mono text-slate-400 bg-[#0A101D]/40">
                <th className="py-3 px-4">Operator / Admin</th>
                <th className="py-3 px-4">Role Assignment</th>
                <th className="py-3 px-4">Account Status</th>
                <th className="py-3 px-4">Registered</th>
                <th className="py-3 px-4">Last Sign-In</th>
                <th className="py-3 px-4 text-right">Account Control</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-xs">
              {filteredUsers.map((u) => {
                const isSelf = u.uid === currentProfile.uid;
                return (
                  <tr key={u.uid} className="hover:bg-slate-900/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        {u.photoURL ? (
                          <img
                            src={u.photoURL}
                            alt={u.displayName}
                            referrerPolicy="no-referrer"
                            className="w-8 h-8 rounded-full border border-slate-700 object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-xs font-semibold text-blue-300 shrink-0">
                            {u.displayName[0]?.toUpperCase() || 'U'}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-white truncate">
                            {u.displayName} {isSelf && <span className="text-blue-400">(You)</span>}
                          </p>
                          <p className="text-[11px] text-slate-400 truncate">{u.email || 'Private email synced'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <select
                        disabled={busyUid === u.uid || isSelf}
                        value={u.role}
                        onChange={(e) => handleRoleChange(u, e.target.value as UserRole)}
                        className="bg-[#070B14] border border-slate-700 rounded-md px-2.5 py-1 text-xs font-mono text-slate-100 focus:border-blue-500 focus:outline-none disabled:opacity-60"
                      >
                        <option value="operator">SECURITY OPERATOR</option>
                        <option value="admin">ADMIN</option>
                      </select>
                    </td>
                    <td className="py-3 px-4 font-mono">
                      <span className={u.status === 'active' ? 'text-emerald-400' : 'text-red-400'}>
                        {u.status === 'active' ? 'ACTIVE' : 'DEACTIVATED'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400 whitespace-nowrap">
                      {u.createdAtLabel}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400 whitespace-nowrap">
                      {u.lastLoginAtLabel}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {isSelf ? (
                        <span className="text-[11px] font-mono text-slate-500">Current Session</span>
                      ) : (
                        <button
                          type="button"
                          disabled={busyUid === u.uid}
                          onClick={() => handleToggleStatus(u)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                            u.status === 'active'
                              ? 'bg-red-950/50 hover:bg-red-900/60 text-red-300 border border-red-500/40'
                              : 'bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-500/40'
                          }`}
                        >
                          {u.status === 'active' ? (
                            <>
                              <UserX className="w-3.5 h-3.5" />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <UserCheck className="w-3.5 h-3.5" />
                              Activate
                            </>
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-slate-400">
                    No registered users match the active search or filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Bottom Grid: Activity / Login History & Global Incidents Oversight */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-6 bg-[#0D1424] border border-slate-800/80 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-semibold text-white">User Activity &amp; Login History</h3>
            </div>
            <span className="text-xs font-mono text-slate-400">{activityLogs.length} events</span>
          </div>
          <div className="divide-y divide-slate-800/70 max-h-[360px] overflow-y-auto">
            {activityLogs.map((log) => (
              <div key={log.id} className="px-5 py-3 space-y-1 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-white">
                    {log.userName} · <span className="font-mono text-blue-400">{log.actionType}</span>
                  </span>
                  <span className="font-mono text-[11px] text-slate-500 whitespace-nowrap">
                    {log.createdAtLabel}
                  </span>
                </div>
                <p className="text-slate-400">{log.details}</p>
              </div>
            ))}
            {activityLogs.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-400">
                No activity logs recorded yet. Logins, profile updates, and role changes appear here in real time.
              </div>
            )}
          </div>
        </div>

        <div className="xl:col-span-6 bg-[#0D1424] border border-slate-800/80 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <h3 className="text-sm font-semibold text-white">All Crowd Safety Incidents &amp; Alerts</h3>
            </div>
            <button
              type="button"
              onClick={onInspectIncidents}
              className="text-xs text-blue-400 hover:text-blue-300 font-medium"
            >
              Open Incident Queue
            </button>
          </div>
          <div className="divide-y divide-slate-800/70 max-h-[360px] overflow-y-auto">
            {alerts.slice(0, 15).map((alert) => (
              <div key={alert.id} className="px-5 py-3 space-y-1 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-white">
                    <span
                      className={`font-mono mr-2 ${
                        alert.dangerLevel === 'CRITICAL'
                          ? 'text-red-400'
                          : alert.dangerLevel === 'HIGH'
                          ? 'text-amber-400'
                          : 'text-blue-400'
                      }`}
                    >
                      [{alert.dangerLevel}]
                    </span>
                    {alert.location}
                  </span>
                  <span className="font-mono text-slate-400">{alert.status.toUpperCase()}</span>
                </div>
                <p className="text-slate-400">
                  {alert.peoplePerSqm.toFixed(2)} p/m² · Score {alert.dangerScore}/100 · {alert.assignedTeam}
                </p>
              </div>
            ))}
            {alerts.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-400">
                No crowd safety incidents recorded.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
