import React from 'react';
import { 
  Home, 
  Send, 
  Bot, 
  Twitter, 
  Sparkles, 
  Crown, 
  ShieldCheck, 
  Palette, 
  X, 
  LogOut, 
  LogIn, 
  UserPlus, 
  Zap, 
  SlidersHorizontal,
  Radio
} from 'lucide-react';
import { User } from '../types';

interface NavigationProps {
  isOpen: boolean;
  onClose: () => void;
  activeCount: number;
  totalTransferred: number;
  currentUser: User | null;
  onOpenAuth: (mode?: 'login' | 'register') => void;
  onLogout: () => void;
  onOpenAdminPanel: () => void;
  onOpenSubscriptions: () => void;
  onOpenGlobalSupervisor: () => void;
  onOpenSocialWebImporter: () => void;
  onOpenAiSettings: () => void;
  theme: string;
  onToggleTheme: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  isOpen,
  onClose,
  activeCount,
  totalTransferred,
  currentUser,
  onOpenAuth,
  onLogout,
  onOpenAdminPanel,
  onOpenSubscriptions,
  onOpenGlobalSupervisor,
  onOpenSocialWebImporter,
  onOpenAiSettings,
  theme,
  onToggleTheme,
}) => {
  const menuItems = [
    {
      id: 'home',
      label: 'خانه و ساخت اتصال',
      icon: Home,
      action: () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        onClose();
      },
      color: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
      badge: null,
    },
    {
      id: 'supervisor',
      label: 'ربات ناظر سراسری',
      icon: Bot,
      action: () => {
        onOpenGlobalSupervisor();
        onClose();
      },
      color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
      badge: 'هوشمند',
    },
    {
      id: 'social',
      label: 'استخراج X (توییتر) و وب',
      icon: Twitter,
      action: () => {
        onOpenSocialWebImporter();
        onClose();
      },
      color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
      badge: 'بتا',
    },
    {
      id: 'ai',
      label: 'تنظیمات هوش مصنوعی',
      icon: Sparkles,
      action: () => {
        onOpenAiSettings();
        onClose();
      },
      color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
      badge: 'اصلی',
    },
    {
      id: 'subscriptions',
      label: 'اشتراک‌ها و ارتقا',
      icon: Crown,
      action: () => {
        onOpenSubscriptions();
        onClose();
      },
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      badge: currentUser?.plan?.toUpperCase() || 'FREE',
    },
  ];

  if (currentUser?.role === 'admin') {
    menuItems.push({
      id: 'admin',
      label: 'پنل مدیریت سیستم',
      icon: ShieldCheck,
      action: () => {
        onOpenAdminPanel();
        onClose();
      },
      color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
      badge: 'مدیر',
    });
  }

  return (
    <>
      {/* 1. Mobile Drawer Overlay Backdrop */}
      {isOpen && (
        <div 
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 lg:hidden animate-fadeIn"
        />
      )}

      {/* 2. Mobile Drawer Panel (Slide-in from right in RTL) */}
      <aside 
        className={`fixed top-0 right-0 h-full w-80 bg-[#0B1220] border-l border-white/10 z-50 p-5 flex flex-col justify-between shadow-2xl transition-transform duration-300 transform lg:hidden ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div>
          {/* Mobile Drawer Header */}
          <div className="flex items-center justify-between pb-4 mb-5 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl overflow-hidden shadow-md border border-sky-500/30 shrink-0 bg-[#0B1220]">
                <img src="/logo.jpg" alt="AUTO RUN Logo" className="w-full h-full object-cover" />
              </div>
              <div>
                <h2 className="text-base font-black text-white">AUTO RUN</h2>
                <p className="text-[10px] text-slate-400">منوی دسترسی سریع</p>
              </div>
            </div>

            <button 
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800/80 text-slate-400 hover:text-white border border-white/10"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Stats Summary Badge */}
          <div className="mb-5 p-3 rounded-xl bg-[#111C2F] border border-white/10 grid grid-cols-2 gap-2 text-center">
            <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/20">
              <div className="text-[10px] text-slate-400">اتصالات فعال</div>
              <div className="text-xs font-black text-sky-400 mt-0.5">{activeCount}</div>
            </div>
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <div className="text-[10px] text-slate-400">پیام‌های منتقل‌شده</div>
              <div className="text-xs font-black text-emerald-400 mt-0.5">{totalTransferred.toLocaleString('fa-IR')}</div>
            </div>
          </div>

          {/* Navigation Menu Links */}
          <nav className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={item.action}
                  className="w-full p-3 rounded-xl bg-[#111C2F] hover:bg-slate-800 border border-white/5 hover:border-sky-500/30 text-right flex items-center justify-between transition-all group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${item.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-slate-200 group-hover:text-sky-300">
                      {item.label}
                    </span>
                  </div>

                  {item.badge && (
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/10 text-slate-300 font-extrabold border border-white/10">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Drawer Bottom Actions: User Account & Logout */}
        <div className="pt-4 border-t border-white/10 space-y-3">
          <button
            onClick={onToggleTheme}
            className="w-full p-2.5 rounded-xl bg-[#111C2F] hover:bg-slate-800 border border-white/10 flex items-center justify-between text-xs font-bold text-slate-300"
          >
            <span>تغییر حالت تم ({theme === 'dark' ? 'تاریک' : 'روشن'})</span>
            <Palette className="w-4 h-4 text-purple-400" />
          </button>

          {currentUser ? (
            <div className="p-3 rounded-xl bg-[#111C2F] border border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-sky-500 text-white font-black flex items-center justify-center text-xs">
                  {currentUser.fullName ? currentUser.fullName.charAt(0) : currentUser.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-xs font-bold text-white max-w-[120px] truncate">{currentUser.fullName || currentUser.username}</p>
                  <p className="text-[10px] text-sky-400 dir-ltr text-right">@{currentUser.username}</p>
                </div>
              </div>

              <button
                onClick={() => {
                  onLogout();
                  onClose();
                }}
                className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30"
                title="خروج"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  onOpenAuth('login');
                  onClose();
                }}
                className="p-2.5 rounded-xl bg-sky-500/20 text-sky-300 border border-sky-500/40 text-xs font-bold text-center"
              >
                ورود
              </button>
              <button
                onClick={() => {
                  onOpenAuth('register');
                  onClose();
                }}
                className="p-2.5 rounded-xl bg-sky-500 text-white font-bold text-xs text-center shadow-lg shadow-sky-500/20"
              >
                ثبت‌نام
              </button>
            </div>
          )}
        </div>
      </aside>

    </>
  );
};
