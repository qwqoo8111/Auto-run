import React from 'react';
import { Bot, Radio, Send, Zap, ShieldCheck, User as UserIcon, LogOut, LogIn, UserPlus, Crown, Sun, Moon, Twitter, Sparkles } from 'lucide-react';
import { User } from '../types';

interface HeaderProps {
  activeCount: number;
  totalTransferred: number;
  currentUser: User | null;
  onOpenAuth: (mode?: 'login' | 'register') => void;
  onLogout: () => void;
  onOpenAdminPanel?: () => void;
  onOpenSubscriptions?: () => void;
  onOpenGlobalSupervisor?: () => void;
  onOpenSocialWebImporter?: () => void;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeCount,
  totalTransferred,
  currentUser,
  onOpenAuth,
  onLogout,
  onOpenAdminPanel,
  onOpenSubscriptions,
  onOpenGlobalSupervisor,
  onOpenSocialWebImporter,
  theme = 'dark',
  onToggleTheme,
}) => {
  return (
    <header className="w-full max-w-5xl mx-auto mb-8 pt-6 px-4">
      <div className="neu-flat p-5 flex flex-col md:flex-row items-center justify-between gap-4 border border-white/5">
        
        {/* Brand & Domain */}
        <div className="flex items-center gap-3">
          <div className="relative p-1 neu-inset rounded-2xl flex items-center justify-center bg-slate-900/60 overflow-hidden w-12 h-12 border border-blue-500/30 shadow-lg">
            <img src="/logo.jpg" alt="Auto run Logo" className="w-full h-full object-cover rounded-xl" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-white tracking-wide">Auto run</h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold">
                ربات فروارد خودکار
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-1 dir-ltr text-right">
              <span className="text-slate-400">Telegram Channel Bridge Engine</span>
            </div>
          </div>
        </div>

        {/* Live Status Indicators & User Profile Bar */}
        <div className="flex items-center gap-3 flex-wrap justify-center md:justify-end">
          <div className="neu-inset px-3.5 py-2 flex items-center gap-2 text-xs font-semibold text-slate-200">
            <Radio className="w-4 h-4 text-emerald-400 animate-spin" style={{ animationDuration: '4s' }} />
            <span>اتصالات:</span>
            <span className="text-yellow-400 font-bold text-xs bg-yellow-400/10 px-2 py-0.5 rounded-md border border-yellow-400/20">
              {activeCount}
            </span>
          </div>

          <div className="neu-inset px-3.5 py-2 flex items-center gap-2 text-xs font-semibold text-slate-200">
            <Zap className="w-4 h-4 text-blue-400" />
            <span>انتقال:</span>
            <span className="text-blue-400 font-bold text-xs bg-blue-400/10 px-2 py-0.5 rounded-md border border-blue-400/20">
              {totalTransferred.toLocaleString('fa-IR')}
            </span>
          </div>

          {/* Global Supervisor Bot Button */}
          {onOpenGlobalSupervisor && (
            <button
              onClick={onOpenGlobalSupervisor}
              className="neu-button px-3.5 py-2 text-xs font-black text-cyan-300 bg-cyan-500/15 border border-cyan-500/40 hover:bg-cyan-500/25 rounded-xl transition-all flex items-center gap-1.5 shadow-lg shadow-cyan-500/10 cursor-pointer"
              title="تنظیمات ربات ناظر سراسری کانال‌ها"
            >
              <Bot className="w-4 h-4 text-cyan-400" />
              <span>ربات ناظر</span>
            </button>
          )}

          {/* Social/Web Importer & AI Trend Button */}
          {onOpenSocialWebImporter && (
            <button
              onClick={onOpenSocialWebImporter}
              className="neu-button px-3.5 py-2 text-xs font-black text-blue-300 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-400/50 hover:bg-blue-500/30 rounded-xl transition-all flex items-center gap-1.5 shadow-lg shadow-blue-500/15 cursor-pointer"
              title="استخراج از X (توییتر) و وب + کاوشگر ترندهای داغ با AI"
            >
              <Twitter className="w-4 h-4 text-blue-400" />
              <span>استخراج X & AI</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-blue-400/20 text-blue-300 font-black border border-blue-400/30">
                بتا
              </span>
            </button>
          )}


          {/* Subscriptions Panel Button */}
          {onOpenSubscriptions && (
            <button
              onClick={onOpenSubscriptions}
              className="neu-button px-3.5 py-2 text-xs font-black text-amber-300 bg-amber-500/15 border border-amber-500/40 hover:bg-amber-500/25 rounded-xl transition-all flex items-center gap-1.5 shadow-lg shadow-amber-500/10 cursor-pointer"
              title="تعرفه‌ها و ارتقای اشتراک"
            >
              <Crown className="w-4 h-4 text-amber-400 animate-bounce" />
              <span>اشتراک‌ها</span>
              {currentUser && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-400/20 text-amber-300 font-extrabold border border-amber-400/30">
                  {currentUser.role === 'admin' ? 'دسترسی طلایی' : (currentUser.plan?.toUpperCase() || 'FREE')}
                </span>
              )}
            </button>
          )}

          {/* Admin Panel Button */}
          {currentUser && currentUser.role === 'admin' && onOpenAdminPanel && (
            <button
              onClick={onOpenAdminPanel}
              className="neu-button px-3.5 py-2 text-xs font-black text-purple-300 bg-purple-500/15 border border-purple-500/40 hover:bg-purple-500/25 rounded-xl transition-all flex items-center gap-1.5 shadow-lg shadow-purple-500/10 cursor-pointer"
              title="پنل مدیریت کاربران و سیستم"
            >
              <ShieldCheck className="w-4 h-4 text-purple-400" />
              <span>مدیریت</span>
            </button>
          )}


          {/* Authentication Status / Profile Widget */}
          {currentUser ? (
            <div className="neu-inset p-1.5 px-3 flex items-center gap-2.5 rounded-xl border border-yellow-400/30 bg-yellow-400/5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-yellow-500 to-amber-300 text-black font-black flex items-center justify-center text-xs shadow-md">
                {currentUser.fullName ? currentUser.fullName.charAt(0) : currentUser.username.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col text-right">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold text-white max-w-[110px] truncate">
                    {currentUser.fullName || currentUser.username}
                  </span>
                  {currentUser.role === 'admin' && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-yellow-400/20 text-yellow-300 font-bold border border-yellow-400/30 flex items-center gap-0.5">
                      <ShieldCheck className="w-2.5 h-2.5 text-yellow-400" />
                      <span>مدیر</span>
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 font-mono dir-ltr text-right">
                  @{currentUser.username}
                </span>
              </div>

              <button
                onClick={onLogout}
                title="خروج از حساب کاربری"
                className="p-1.5 neu-button rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all border border-red-500/20 mr-1"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onOpenAuth('login')}
                className="neu-button px-3 py-2 text-xs font-bold text-yellow-400 bg-yellow-400/10 border border-yellow-400/30 hover:bg-yellow-400/20 rounded-xl transition-all flex items-center gap-1.5"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>ورود</span>
              </button>
              <button
                onClick={() => onOpenAuth('register')}
                className="neu-button px-3 py-2 text-xs font-bold text-purple-300 bg-purple-500/15 border border-purple-500/30 hover:bg-purple-500/25 rounded-xl transition-all flex items-center gap-1.5"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>ثبت‌نام</span>
              </button>
            </div>
          )}

          {/* Theme Switcher Button */}
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              title={theme === 'dark' ? 'تغییر به تم روشن (روز)' : 'تغییر به تم تاریک (شب)'}
              className="neu-inset p-2.5 rounded-xl text-slate-300 hover:text-yellow-400 hover:border-yellow-400/40 transition-all flex items-center justify-center gap-1.5 text-xs font-bold"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4 text-yellow-400" />
                  <span className="hidden sm:inline">تم روشن</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-purple-400" />
                  <span className="hidden sm:inline">تم تاریک</span>
                </>
              )}
            </button>
          )}

        </div>

      </div>
    </header>
  );
};
