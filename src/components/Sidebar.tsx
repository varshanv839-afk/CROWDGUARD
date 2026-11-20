import React from 'react';
import {
  LayoutDashboard,
  Video,
  Activity,
  Route,
  ShieldAlert,
  Sliders,
  BookOpen,
  Bot,
  LogOut,
  Shield,
  Users,
  UserCircle2,
  X,
} from 'lucide-react';
import type { NavSection, UserAccountRecord } from '../types/crowguard';

interface SidebarProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  activeAlertCount: number;
  pendingGateCount: number;
  profile: UserAccountRecord | null;
  onSignOut: () => void;
  onOpenAssistant: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

interface NavConfigItem {
  id: NavSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavConfigItem[] = [
  { id: 'overview', label: 'Overview Command', icon: LayoutDashboard },
  { id: 'cctv', label: 'Multi-Camera CCTV', icon: Video },
  { id: 'analytics', label: 'Density & Risk', icon: Activity },
  { id: 'evacuation', label: 'Evacuation Planner', icon: Route },
  { id: 'alerts', label: 'Emergency & Gates', icon: ShieldAlert },
  { id: 'simulation', label: 'Digital Twin Lab', icon: Sliders },
  { id: 'admin', label: 'Admin Management', icon: Users, adminOnly: true },
  { id: 'profile', label: 'My Profile', icon: UserCircle2 },
  { id: 'setup', label: 'Setup & Architecture', icon: BookOpen },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSelectSection,
  activeAlertCount,
  pendingGateCount,
  profile,
  onSignOut,
  onOpenAssistant,
  mobileOpen,
  onCloseMobile,
}) => {
  const isAdmin = profile?.role === 'admin';
  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  const content = (
    <aside className="w-[248px] h-full bg-[#0A101D] border-r border-slate-800/80 flex flex-col justify-between shrink-0 overflow-y-auto">
      <div>
        <div className="h-16 px-5 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Shield className="w-4 h-4" />
            </div>
            <span className="font-display font-bold text-base tracking-tight text-white whitespace-nowrap">
              CROWGUARD
            </span>
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
            aria-label="Close navigation"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="p-3 space-y-1" aria-label="Primary Navigation">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            const showCount = item.id === 'alerts' && (activeAlertCount > 0 || pendingGateCount > 0);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectSection(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 border border-transparent'
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {showCount && (
                  <span className="font-mono text-xs tabular-nums text-red-400">
                    {activeAlertCount + pendingGateCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="px-3 pt-2">
          <button
            type="button"
            onClick={() => {
              onOpenAssistant();
              onCloseMobile();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium bg-[#0E172A] hover:bg-slate-800 text-blue-300 border border-blue-500/30 transition-colors whitespace-nowrap"
          >
            <Bot className="w-4 h-4 text-blue-400 shrink-0" />
            <span>AI Safety Assistant</span>
          </button>
        </div>
      </div>

      {profile && (
        <div className="p-4 border-t border-slate-800/80 space-y-2.5">
          <button
            type="button"
            onClick={() => {
              onSelectSection('profile');
              onCloseMobile();
            }}
            className="w-full flex items-center gap-2.5 text-left hover:bg-slate-800/50 p-1.5 -m-1.5 rounded-lg transition-colors"
          >
            {profile.photoURL ? (
              <img
                src={profile.photoURL}
                alt={profile.displayName}
                referrerPolicy="no-referrer"
                className="w-8 h-8 rounded-full border border-slate-700 object-cover shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-blue-600/25 border border-blue-500/40 flex items-center justify-center text-xs font-semibold text-blue-300 shrink-0">
                {profile.displayName[0]?.toUpperCase() || 'O'}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-100 truncate">
                {profile.displayName}
              </p>
              <p className="text-[11px] font-mono text-blue-400 truncate">
                {profile.role === 'admin' ? 'ADMIN' : 'SECURITY OPERATOR'}
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={onSignOut}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800/70 hover:bg-slate-800 border border-slate-700/80 transition-colors whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5" />
            Logout
          </button>
        </div>
      )}
    </aside>
  );

  return (
    <>
      <div className="hidden lg:block h-full">{content}</div>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full">{content}</div>
        </div>
      )}
    </>
  );
};
