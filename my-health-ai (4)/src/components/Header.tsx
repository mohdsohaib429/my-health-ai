import React from 'react';
import { User } from 'firebase/auth';
import { Activity, RefreshCw, ExternalLink, CheckCircle2, AlertCircle, LogOut, Users, UserCheck } from 'lucide-react';
import { GoogleSheetFile } from '../types';

interface HeaderProps {
  user: User | null;
  activeUserEmail?: string | null;
  selectedSheet: GoogleSheetFile | null;
  isSyncing: boolean;
  isLoggingIn?: boolean;
  onRefresh: () => void;
  onLogin: () => void;
  onLogout: () => void;
  onOpenSheetSelector: () => void;
  onSwitchAccount?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  activeUserEmail,
  selectedSheet,
  isSyncing,
  isLoggingIn = false,
  onRefresh,
  onLogin,
  onLogout,
  onOpenSheetSelector,
  onSwitchAccount,
}) => {
  const displayEmail = user?.email || activeUserEmail || null;

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-stone-200">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-sm">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-base font-bold text-stone-900 leading-tight">
                My Health AI
              </h1>
              {displayEmail && (
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-md">
                  <UserCheck className="w-3 h-3" />
                  <span className="truncate max-w-[130px]">{displayEmail}</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-stone-700">
              {selectedSheet ? (
                <button
                  onClick={onOpenSheetSelector}
                  className="flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-medium transition-colors"
                  title="Click to switch or view connected Google Sheet"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-700 animate-pulse"></span>
                  <span className="truncate max-w-[140px] sm:max-w-[200px]">
                    {selectedSheet.name}
                  </span>
                </button>
              ) : (
                <button
                  onClick={onOpenSheetSelector}
                  className="flex items-center gap-1 text-amber-700 hover:text-amber-800 font-medium transition-colors text-left"
                  title="Click to connect a Google Sheet"
                >
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <span>Local Mode (No Sheet)</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          {/* Refresh / Sync button */}
          <button
            id="sync-refresh-button"
            onClick={onRefresh}
            disabled={isSyncing}
            className="p-2 text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors"
            title="Sync with Google Sheet"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-emerald-600' : ''}`} />
          </button>

          {/* Open Google Sheet link if connected */}
          {selectedSheet?.webViewLink && (
            <a
              id="open-google-sheet-link"
              href={selectedSheet.webViewLink}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-stone-500 hover:text-emerald-600 hover:bg-stone-100 rounded-lg transition-colors"
              title="Open Google Sheet in new tab"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}

          {/* User Auth */}
          {user ? (
            <div className="flex items-center gap-1.5 pl-1 border-l border-stone-200">
              {onSwitchAccount && (
                <button
                  onClick={onSwitchAccount}
                  className="hidden md:flex items-center gap-1 text-[11px] font-semibold text-stone-600 hover:text-emerald-700 bg-stone-100 hover:bg-emerald-50 px-2 py-1 rounded-lg transition-colors"
                  title="Switch between 3 Google accounts"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Switch</span>
                </button>
              )}

              <div
                className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-semibold overflow-hidden border border-emerald-300"
                title={user.email || user.displayName || 'Google Account'}
              >
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt="User"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  (user.displayName?.[0] || user.email?.[0] || 'U').toUpperCase()
                )}
              </div>
              <button
                id="sign-out-button"
                onClick={onLogout}
                className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              id="google-signin-button"
              onClick={onLogin}
              disabled={isLoggingIn}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 hover:bg-stone-800 disabled:opacity-75 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-all shadow-sm active:scale-95"
            >
              {isLoggingIn ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
              ) : (
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.6 14.8c-.3-.8-.4-1.8-.4-2.8s.1-2 .4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16c1.8 3.7 5.6 7 10.1 7z"
                  />
                </svg>
              )}
              <span>{isLoggingIn ? 'Connecting...' : 'Sign In with Google'}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

