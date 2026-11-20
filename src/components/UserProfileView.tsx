import React, { useState } from 'react';
import type { User } from 'firebase/auth';
import {
  User as UserIcon,
  Mail,
  Shield,
  Calendar,
  Clock,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Save,
  Send,
} from 'lucide-react';
import {
  changeOperatorPassword,
  linkEmailPasswordToAccount,
  mapFirebaseAuthError,
  resendVerificationEmail,
  updateOperatorProfile,
} from '../lib/firebase';
import type { ActivityLogRecord, UserAccountRecord } from '../types/crowguard';

interface UserProfileViewProps {
  currentUser: User;
  profile: UserAccountRecord;
  activityLogs: ActivityLogRecord[];
  onProfileUpdated: (next: UserAccountRecord) => void;
}

export const UserProfileView: React.FC<UserProfileViewProps> = ({
  currentUser,
  profile,
  activityLogs,
  onProfileUpdated,
}) => {
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [photoURL, setPhotoURL] = useState(profile.photoURL);
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const [resendingVerification, setResendingVerification] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const hasPasswordProvider = currentUser.providerData.some((p) => p.providerId === 'password');

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (displayName.trim().length < 2) {
      setFeedback({ type: 'error', text: 'Display name must be at least 2 characters.' });
      return;
    }

    setSavingProfile(true);
    try {
      const updated = await updateOperatorProfile(currentUser, profile, {
        displayName: displayName.trim(),
        photoURL: photoURL.trim(),
      });
      onProfileUpdated(updated);
      setEditing(false);
      setFeedback({ type: 'success', text: 'Profile updated and synced to Firebase.' });
    } catch (err) {
      setFeedback({ type: 'error', text: mapFirebaseAuthError(err) });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (newPassword.length < 6) {
      setFeedback({ type: 'error', text: 'New password must be at least 6 characters.' });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setFeedback({ type: 'error', text: 'New password confirmation does not match.' });
      return;
    }

    setChangingPassword(true);
    try {
      await changeOperatorPassword(currentUser, profile, currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setFeedback({ type: 'success', text: 'Password updated successfully.' });
    } catch (err) {
      setFeedback({ type: 'error', text: mapFirebaseAuthError(err) });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleLinkPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (newPassword.length < 6) {
      setFeedback({ type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setFeedback({ type: 'error', text: 'Password confirmation does not match.' });
      return;
    }

    setChangingPassword(true);
    try {
      await linkEmailPasswordToAccount(currentUser, profile, newPassword);
      setNewPassword('');
      setConfirmNewPassword('');
      setFeedback({
        type: 'success',
        text: 'Email & Password login linked! You can now sign in with either Google or Email/Password.',
      });
    } catch (err) {
      setFeedback({ type: 'error', text: mapFirebaseAuthError(err) });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleResendVerification = async () => {
    setFeedback(null);
    setResendingVerification(true);
    try {
      await resendVerificationEmail(currentUser);
      setFeedback({
        type: 'success',
        text: `Verification email sent to ${profile.email}. Check your inbox and reload once verified.`,
      });
    } catch (err) {
      setFeedback({ type: 'error', text: mapFirebaseAuthError(err) });
    } finally {
      setResendingVerification(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
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

      {/* Profile Overview Card */}
      <section className="bg-[#0D1424] border border-slate-800/80 rounded-xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
          <div className="flex items-center gap-4">
            {profile.photoURL ? (
              <img
                src={profile.photoURL}
                alt={profile.displayName}
                referrerPolicy="no-referrer"
                className="w-16 h-16 rounded-full border border-slate-700 object-cover shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-xl font-display font-bold text-blue-300 shrink-0">
                {profile.displayName[0]?.toUpperCase() || 'U'}
              </div>
            )}
            <div className="space-y-1">
              <h2 className="text-lg font-display font-bold text-white">{profile.displayName}</h2>
              <p className="text-xs text-slate-400 flex items-center gap-2">
                <span>{profile.email}</span>
                <span>·</span>
                <span className="font-mono text-blue-400">
                  {profile.role === 'admin' ? 'ADMIN' : 'SECURITY OPERATOR'}
                </span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setDisplayName(profile.displayName);
              setPhotoURL(profile.photoURL);
              setEditing((v) => !v);
            }}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white border border-slate-700 transition-colors whitespace-nowrap"
          >
            {editing ? 'Cancel Editing' : 'Edit Profile'}
          </button>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="bg-[#0A101D] border border-slate-800/80 rounded-lg p-3.5 space-y-1">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Shield className="w-3.5 h-3.5 text-blue-400" />
              <span>Assigned Role</span>
            </div>
            <p className="font-mono font-semibold text-white">
              {profile.role === 'admin' ? 'ADMIN' : 'SECURITY OPERATOR'}
            </p>
          </div>

          <div className="bg-[#0A101D] border border-slate-800/80 rounded-lg p-3.5 space-y-1">
            <div className="flex items-center gap-1.5 text-slate-400">
              <UserIcon className="w-3.5 h-3.5 text-emerald-400" />
              <span>Account Status</span>
            </div>
            <p className="font-mono font-semibold text-emerald-400">
              {profile.status.toUpperCase()}
            </p>
          </div>

          <div className="bg-[#0A101D] border border-slate-800/80 rounded-lg p-3.5 space-y-1">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              <span>Registration Date</span>
            </div>
            <p className="font-mono text-slate-200">{profile.createdAtLabel}</p>
          </div>

          <div className="bg-[#0A101D] border border-slate-800/80 rounded-lg p-3.5 space-y-1">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Mail className="w-3.5 h-3.5 text-amber-400" />
              <span>Email Verification</span>
            </div>
            {currentUser.emailVerified ? (
              <p className="font-mono text-emerald-400">VERIFIED</p>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-amber-400">UNVERIFIED</span>
                <button
                  type="button"
                  disabled={resendingVerification}
                  onClick={handleResendVerification}
                  className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300"
                >
                  <Send className="w-3 h-3" />
                  Resend
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Edit Profile Form */}
        {editing && (
          <form
            onSubmit={handleSaveProfile}
            className="bg-[#0A101D] border border-slate-800 rounded-xl p-5 space-y-4"
          >
            <h3 className="text-sm font-semibold text-white">Edit Account Profile</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs text-slate-400">Full Name</label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-[#070B14] border border-slate-700 focus:border-blue-500 focus:outline-none rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs text-slate-400">Profile Photo URL (Optional)</label>
                <input
                  type="url"
                  value={photoURL}
                  onChange={(e) => setPhotoURL(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-[#070B14] border border-slate-700 focus:border-blue-500 focus:outline-none rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingProfile}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-xs font-medium"
              >
                <Save className="w-3.5 h-3.5" />
                {savingProfile ? 'Saving...' : 'Save Profile Changes'}
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Password Security + Personal Activity Log */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <section className="lg:col-span-5 bg-[#0D1424] border border-slate-800/80 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-white">Change Account Password</h3>
          </div>

          {hasPasswordProvider ? (
            <form onSubmit={handleChangePassword} className="space-y-3">
              <div className="space-y-1">
                <label className="block text-xs text-slate-400">Current Password</label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full bg-[#070B14] border border-slate-800 focus:border-blue-500 focus:outline-none rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs text-slate-400">New Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-[#070B14] border border-slate-800 focus:border-blue-500 focus:outline-none rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs text-slate-400">Confirm New Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  className="w-full bg-[#070B14] border border-slate-800 focus:border-blue-500 focus:outline-none rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>
              <button
                type="submit"
                disabled={changingPassword}
                className="w-full py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-xs font-medium transition-colors"
              >
                {changingPassword ? 'Updating Password...' : 'Update Password'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleLinkPassword} className="space-y-3">
              <p className="text-xs text-slate-400 leading-relaxed">
                Signed in with Google. Set a password below to also sign in with <span className="text-slate-200">{profile.email}</span> and password (requires Email/Password enabled in Firebase Console).
              </p>
              <div className="space-y-1">
                <label className="block text-xs text-slate-400">New Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-[#070B14] border border-slate-800 focus:border-blue-500 focus:outline-none rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs text-slate-400">Confirm Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  className="w-full bg-[#070B14] border border-slate-800 focus:border-blue-500 focus:outline-none rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>
              <button
                type="submit"
                disabled={changingPassword}
                className="w-full py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-xs font-medium transition-colors"
              >
                {changingPassword ? 'Linking Password...' : 'Set Email/Password Login'}
              </button>
            </form>
          )}
        </section>

        <section className="lg:col-span-7 bg-[#0D1424] border border-slate-800/80 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-semibold text-white">Recent Account Activity</h3>
            </div>
            <span className="text-xs font-mono text-slate-400">{activityLogs.length} records</span>
          </div>
          <div className="divide-y divide-slate-800/70 max-h-[280px] overflow-y-auto">
            {activityLogs.map((log) => (
              <div key={log.id} className="px-5 py-3 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-blue-400">{log.actionType}</span>
                  <span className="font-mono text-slate-500">{log.createdAtLabel}</span>
                </div>
                <p className="text-slate-300">{log.details}</p>
              </div>
            ))}
            {activityLogs.length === 0 && (
              <div className="p-6 text-center text-xs text-slate-400">
                No personal activity events logged yet.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
