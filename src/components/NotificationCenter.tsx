import React from 'react';
import { Bell, CheckCheck, Volume2, VolumeX, X, AlertTriangle } from 'lucide-react';
import type { NotificationRecord } from '../types/crowguard';

interface NotificationCenterProps {
  open: boolean;
  onClose: () => void;
  notifications: NotificationRecord[];
  muted: boolean;
  onToggleMute: () => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  open,
  onClose,
  notifications,
  muted,
  onToggleMute,
  onMarkRead,
  onMarkAllRead,
}) => {
  if (!open) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="fixed top-16 right-4 sm:right-6 z-40 w-[340px] sm:w-[400px] max-h-[75vh] bg-[#0A101D] border border-slate-800 rounded-xl shadow-2xl flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-semibold text-white">Notifications</span>
          <span className="text-xs font-mono text-slate-400">({unreadCount} unread)</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleMute}
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
            title={muted ? 'Unmute Alert Sound' : 'Mute Alert Sound'}
          >
            {muted ? <VolumeX className="w-4 h-4 text-slate-500" /> : <Volume2 className="w-4 h-4 text-blue-400" />}
          </button>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={onMarkAllRead}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-blue-400 hover:bg-slate-800"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Read All
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
            aria-label="Close notifications"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/80">
        {notifications.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No notifications recorded yet.
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => !n.read && onMarkRead(n.id)}
              className={`p-3.5 space-y-1 transition-colors cursor-pointer ${
                n.read ? 'bg-[#0A101D] opacity-75' : 'bg-[#0E172A] hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <span
                  className={`inline-flex items-center gap-1.5 font-semibold ${
                    n.severity === 'CRITICAL'
                      ? 'text-red-400'
                      : n.severity === 'HIGH'
                      ? 'text-amber-400'
                      : 'text-blue-400'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  {n.title}
                </span>
                {!n.read && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">{n.message}</p>
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-0.5">
                <span>{n.zoneName}</span>
                <span>
                  {n.createdAtLabel} · {n.persistedToFirestore ? 'Firestore' : 'Local'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
