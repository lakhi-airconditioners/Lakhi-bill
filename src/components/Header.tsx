import React from 'react';
import {
  Shield,
  UserCheck,
  LogIn,
  LogOut,
  Clock,
  ShoppingBag,
  Sun,
  Moon,
  Lock,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { LakhiLogo } from './common/LakhiLogo';

interface HeaderProps {
  onOpenClaimsModal?: () => void;
  onOpenAiAssistant?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenClaimsModal, onOpenAiAssistant }) => {
  const {
    currentUser,
    isAdmin,
    signInWithGoogle,
    logOut,
    viewMode,
    setViewMode,
    activeCustomer,
    logoutCustomer,
    claims,
    theme,
    toggleTheme,
  } = useApp();

  const pendingClaimsCount = claims.filter((c) => c.status === 'PENDING').length;

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 shadow-xs transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-20 gap-1.5 sm:gap-4">
          {/* Brand & Lakhi Airconditioners Logo (SINGLE instance, auto-responsive) */}
          <div className="flex items-center shrink-0">
            <LakhiLogo size="responsive" themeInvert={theme === 'dark'} />
          </div>

          {/* Portal Switcher - Staff Portal is strictly visible only for authorized Admins */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-0.5 sm:p-1 rounded-2xl border border-slate-200 dark:border-slate-800 shrink-0">
            {isAdmin ? (
              <>
                <button
                  onClick={() => setViewMode('STAFF')}
                  className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all ${
                    viewMode === 'STAFF'
                      ? 'bg-red-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Staff Operations</span>
                  <span className="sm:hidden">Staff</span>
                </button>
                <button
                  onClick={() => setViewMode('CUSTOMER')}
                  className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all ${
                    viewMode === 'CUSTOMER'
                      ? 'bg-red-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Storefront View</span>
                  <span className="sm:hidden">Store</span>
                  {activeCustomer && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse ml-0.5" />
                  )}
                </button>
              </>
            ) : (
              <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-300">
                <ShoppingBag className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                <span className="hidden sm:inline">Customer Storefront</span>
                <span className="sm:hidden">Storefront</span>
                {activeCustomer && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse ml-0.5" />
                )}
              </div>
            )}
          </div>

          {/* Right Action Icons & Theme Toggle */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Lakhi AI ERP Assistant Button (Strictly for Staff Access Admin only) */}
            {isAdmin && viewMode === 'STAFF' && onOpenAiAssistant && (
              <button
                onClick={onOpenAiAssistant}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold bg-linear-to-r from-red-600 via-rose-600 to-indigo-600 hover:from-red-700 hover:to-indigo-700 text-white shadow-xs shadow-red-500/20 transition-all hover:scale-105 active:scale-95"
                title="Lakhi AI (Staff Admin Access Only: Type or Speak to create quotes, invoices, check stock & deliveries)"
              >
                <Sparkles className="w-3.5 h-3.5 animate-pulse text-amber-300" />
                <span className="hidden sm:inline">Lakhi AI</span>
                <span className="sm:hidden">AI</span>
                <span className="text-[10px] bg-white/20 px-1 py-0.2 rounded font-mono hidden md:inline">Admin</span>
              </button>
            )}

            {/* Theme Toggle (Light / Dark Mode) */}
            <button
              onClick={toggleTheme}
              className="flex items-center justify-center w-8 h-8 sm:w-auto sm:h-auto sm:px-3 sm:py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 transition-colors shadow-xs"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle Theme Mode"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span className="hidden sm:inline ml-1 text-[11px] font-bold">Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                  <span className="hidden sm:inline ml-1 text-[11px] font-bold">Dark</span>
                </>
              )}
            </button>

            {/* 72h Claims Alert Badge (Visible only to admins) */}
            {isAdmin && onOpenClaimsModal && (
              <button
                onClick={onOpenClaimsModal}
                className="relative flex items-center justify-center w-8 h-8 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-colors"
                title="72-Hour Customer Claim Approvals"
              >
                <Clock className="w-4 h-4 text-amber-500" />
                {pendingClaimsCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full animate-bounce">
                    {pendingClaimsCount}
                  </span>
                )}
              </button>
            )}

            {/* Active Customer Badge */}
            {activeCustomer && (
              <div className="hidden lg:flex items-center gap-2 bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[120px]">
                  {activeCustomer.externalName}
                </span>
                <button
                  onClick={logoutCustomer}
                  className="text-slate-400 hover:text-red-500 ml-1"
                  title="Switch customer"
                >
                  <LogOut className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Google Firebase Auth */}
            {currentUser ? (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">
                    {currentUser.displayName || currentUser.email?.split('@')[0]}
                  </p>
                  <p className="text-[10px] leading-tight font-mono font-semibold">
                    {isAdmin ? (
                      <span className="text-red-600 dark:text-red-400">Admin Authorized</span>
                    ) : (
                      <span className="text-slate-400">Public User</span>
                    )}
                  </p>
                </div>
                <button
                  onClick={logOut}
                  className="flex items-center justify-center w-8 h-8 sm:w-auto sm:h-auto sm:p-2 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 text-slate-600 dark:text-slate-300 transition-colors border border-slate-200 dark:border-slate-800"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={signInWithGoogle}
                className="flex items-center gap-1 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors shrink-0"
                title="Sign in with Admin Google Account"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Admin Login</span>
                <span className="sm:hidden">Login</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
