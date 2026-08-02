import React, { useState } from 'react';
import { Search, Bell, Sun, Moon, Menu, LogOut, LogIn, UserPlus, ShieldCheck, Crown, Sparkles, Send, User as UserIcon } from 'lucide-react';
import { User } from '../types';

interface HeaderProps {
  activeCount?: number;
  totalTransferred?: number;
  currentUser?: User | null;
  onOpenAuth?: (mode?: 'login' | 'register') => void;
  onLogout?: () => void;
  onOpenAdminPanel?: () => void;
  onOpenSubscriptions?: () => void;
  onOpenNotifications?: () => void;
  onOpenGlobalSupervisor?: () => void;
  onOpenSocialWebImporter?: () => void;
  onOpenAiSettings?: () => void;
  onOpenThemeSelector?: () => void;
  theme?: string;
  onToggleTheme?: () => void;
  onToggleMobileMenu?: () => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onOpenAuth,
  onLogout,
  onOpenAdminPanel,
  onOpenSubscriptions,
  onOpenNotifications,
  theme = 'dark',
  onToggleTheme,
  onToggleMobileMenu,
  searchQuery = '',
  onSearchChange,
}) => {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  return (
    <header className="w-full mb-6 sticky top-2 z-30 transition-all duration-300">
      <div className="neu-flat p-3 md:p-4 flex items-center justify-between gap-3 border border-white/10 rounded-2xl bg-[#0B1220]/80 backdrop-blur-xl shadow-xl">
        
        {/* Right side (RTL): Brand Logo & Mobile Menu Toggle */}
        <div className="flex items-center gap-3">
          {/* Mobile Menu Toggle Button */}
          <button
            onClick={onToggleMobileMenu}
            className="lg:hidden p-2.5 rounded-xl bg-slate-800/60 text-slate-300 hover:text-white hover:bg-slate-700/60 transition-all border border-white/10 cursor-pointer"
            title="منوی برنامه"
          >
            <Menu className="w-5 h-5 text-sky-400" />
          </button>

          {/* Logo Badge */}
          <div className="flex items-center gap-3">
            <div className="relative rounded-2xl flex items-center justify-center overflow-hidden w-10 h-10 md:w-11 md:h-11 shadow-lg shadow-sky-500/20 border border-sky-400/40 bg-[#0B1220] shrink-0">
              <img src="/logo.jpg" alt="AUTO RUN Logo" className="w-full h-full object-cover" />
              <span className="absolute top-1 right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-400"></span>
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base md:text-lg font-black text-white tracking-wide">AUTO RUN</h1>
                <span className="hidden sm:inline-block text-[10px] px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-400 border border-sky-500/30 font-extrabold">
                  PRO
                </span>
              </div>
              <p className="text-[10px] md:text-xs text-slate-400 hidden sm:block">
                سامانه هوشمند فروارد و مدیریت کانال‌های تلگرام
              </p>
            </div>
          </div>
        </div>

        {/* Center: Search Bar (Desktop) matching Image 2 */}
        <div className="hidden md:flex items-center flex-1 max-w-md mx-4">
          <div className="w-full relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
              placeholder="جستجو در اتصالات، کانال‌ها، ربات‌ها..."
              className="w-full bg-[#111C2F]/80 border border-white/10 rounded-xl pr-10 pl-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all"
            />
          </div>
        </div>

        {/* Left side (RTL): Actions (Theme, Notification, Auth/Profile) */}
        <div className="flex items-center gap-2 md:gap-3">
          
          {/* Theme Toggle Button matching Image 2 & 3 */}
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              title={theme === 'dark' ? 'تغییر به حالت روشن' : 'تغییر به حالت تاریک'}
              className="p-2.5 rounded-xl bg-[#111C2F] text-slate-300 hover:text-amber-400 hover:bg-slate-800 transition-all border border-white/10 cursor-pointer shadow-inner"
            >
              {theme === 'light' ? (
                <Moon className="w-4 h-4 text-purple-400" />
              ) : (
                <Sun className="w-4 h-4 text-amber-400" />
              )}
            </button>
          )}

          {/* Notification Icon (System Error Logs & Admin Announcements) */}
          <button
            onClick={onOpenNotifications || onOpenSubscriptions}
            className="p-2.5 rounded-xl bg-[#111C2F] text-slate-300 hover:text-sky-400 hover:bg-slate-800 transition-all border border-white/10 cursor-pointer shadow-inner"
            title="اعلا‌ن‌ها، خطاهای سیستم و پیام‌های مدیریت"
          >
            <Bell className="w-4 h-4 text-sky-400" />
          </button>

          {/* User Profile / Auth Widget */}
          {currentUser ? (
            <div className="relative">
              <button
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="flex items-center gap-2 p-1.5 pr-2.5 rounded-xl bg-[#111C2F] hover:bg-slate-800 border border-white/10 transition-all cursor-pointer"
              >
                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-sky-500 to-blue-600 text-white font-black flex items-center justify-center text-xs shadow-md">
                  {currentUser.fullName ? currentUser.fullName.charAt(0) : currentUser.username.charAt(0).toUpperCase()}
                </div>
                <div className="hidden lg:flex flex-col text-right">
                  <span className="text-xs font-bold text-slate-200 max-w-[90px] truncate">
                    {currentUser.fullName || currentUser.username}
                  </span>
                  <span className="text-[9px] text-sky-400 font-extrabold dir-ltr text-right">
                    {currentUser.role === 'admin' ? '⚡ ADMIN' : (currentUser.plan?.toUpperCase() || 'FREE')}
                  </span>
                </div>
              </button>

              {/* Profile Dropdown Menu */}
              {isProfileMenuOpen && (
                <div className="absolute left-0 mt-2 w-48 rounded-xl bg-[#111C2F] border border-white/10 shadow-2xl p-2 z-50 animate-modal-scale dir-rtl">
                  <div className="p-2 border-b border-white/10 mb-1">
                    <p className="text-xs font-bold text-white truncate">{currentUser.fullName || currentUser.username}</p>
                    <p className="text-[10px] text-slate-400 dir-ltr text-right">@{currentUser.username}</p>
                  </div>

                  {currentUser.role === 'admin' && onOpenAdminPanel && (
                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        onOpenAdminPanel();
                      }}
                      className="w-full p-2 rounded-lg text-xs font-bold text-purple-300 hover:bg-purple-500/20 flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4 text-purple-400" />
                      <span>پنل مدیریت سیستم</span>
                    </button>
                  )}

                  {onOpenSubscriptions && (
                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        onOpenSubscriptions();
                      }}
                      className="w-full p-2 rounded-lg text-xs font-bold text-amber-300 hover:bg-amber-500/20 flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <Crown className="w-4 h-4 text-amber-400" />
                      <span>ارتقای اشتراک</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      onLogout && onLogout();
                    }}
                    className="w-full p-2 rounded-lg text-xs font-bold text-red-400 hover:bg-red-500/20 flex items-center gap-2 transition-all cursor-pointer mt-1 border-t border-white/5"
                  >
                    <LogOut className="w-4 h-4 text-red-400" />
                    <span>خروج از حساب</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onOpenAuth && onOpenAuth('login')}
                className="px-3 py-1.5 text-xs font-bold text-sky-400 bg-sky-500/10 border border-sky-500/30 hover:bg-sky-500/20 rounded-xl transition-all flex items-center gap-1 cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>ورود</span>
              </button>
              <button
                onClick={() => onOpenAuth && onOpenAuth('register')}
                className="px-3 py-1.5 text-xs font-bold text-white bg-sky-500 hover:bg-sky-600 rounded-xl transition-all flex items-center gap-1 cursor-pointer shadow-md shadow-sky-500/20"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>ثبت‌نام</span>
              </button>
            </div>
          )}

        </div>

      </div>
    </header>
  );
};


