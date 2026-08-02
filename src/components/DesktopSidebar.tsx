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
  Radio, 
  Zap,
  Sliders,
  CheckCircle2,
  ExternalLink,
  Layers
} from 'lucide-react';
import { User } from '../types';

interface DesktopSidebarProps {
  activeCount: number;
  totalTransferred: number;
  currentUser: User | null;
  onOpenAdminPanel: () => void;
  onOpenSubscriptions: () => void;
  onOpenGlobalSupervisor: () => void;
  onOpenSocialWebImporter: () => void;
  onOpenAiSettings: () => void;
  onToggleTheme: () => void;
  theme: string;
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  activeCount,
  totalTransferred,
  currentUser,
  onOpenAdminPanel,
  onOpenSubscriptions,
  onOpenGlobalSupervisor,
  onOpenSocialWebImporter,
  onOpenAiSettings,
  onToggleTheme,
  theme,
}) => {
  return (
    <aside className="hidden lg:flex flex-col w-64 shrink-0 gap-4 sticky top-4 h-[calc(100vh-2rem)] overflow-y-auto scrollbar-none pb-6">
      
      {/* Brand Header Box */}
      <div className="neu-flat p-4 rounded-2xl border border-white/10 bg-[#111C2F]/80 backdrop-blur-xl shadow-xl flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl overflow-hidden shadow-md shadow-sky-500/20 border border-sky-400/40 shrink-0 bg-[#0B1220]">
          <img src="/logo.jpg" alt="AUTO RUN Logo" className="w-full h-full object-cover" />
        </div>
        <div>
          <h2 className="text-base font-black text-white tracking-wide">AUTO RUN</h2>
          <p className="text-[10px] text-sky-400 font-extrabold">ربات فروارد خودکار v3.5</p>
        </div>
      </div>

      {/* Navigation Buttons List */}
      <div className="neu-flat p-3 rounded-2xl border border-white/10 bg-[#111C2F]/80 backdrop-blur-xl shadow-xl space-y-1.5">
        <div className="px-3 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-wider">
          دسترسی‌های سریع
        </div>

        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="w-full p-2.5 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-300 font-bold text-xs flex items-center justify-between transition-all hover:bg-sky-500/25 cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <Home className="w-4 h-4 text-sky-400" />
            <span>داشبورد اصلی</span>
          </div>
          <span className="w-2 h-2 rounded-full bg-sky-400"></span>
        </button>

        <button
          onClick={onOpenGlobalSupervisor}
          className="w-full p-2.5 rounded-xl bg-[#0B1220]/60 hover:bg-cyan-500/15 border border-transparent hover:border-cyan-500/30 text-slate-300 hover:text-cyan-300 font-bold text-xs flex items-center justify-between transition-all cursor-pointer group"
        >
          <div className="flex items-center gap-2.5">
            <Bot className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
            <span>ربات ناظر سراسری</span>
          </div>
          <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-400/20 text-cyan-300 border border-cyan-400/30">
            AI
          </span>
        </button>

        <button
          onClick={onOpenSocialWebImporter}
          className="w-full p-2.5 rounded-xl bg-[#0B1220]/60 hover:bg-blue-500/15 border border-transparent hover:border-blue-500/30 text-slate-300 hover:text-blue-300 font-bold text-xs flex items-center justify-between transition-all cursor-pointer group"
        >
          <div className="flex items-center gap-2.5">
            <Twitter className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
            <span>استخراج X (توییتر) & وب</span>
          </div>
          <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-400/20 text-blue-300 border border-blue-400/30">
            𝕏
          </span>
        </button>

        <button
          onClick={onOpenAiSettings}
          className="w-full p-2.5 rounded-xl bg-[#0B1220]/60 hover:bg-purple-500/15 border border-transparent hover:border-purple-500/30 text-slate-300 hover:text-purple-300 font-bold text-xs flex items-center justify-between transition-all cursor-pointer group"
        >
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" />
            <span>تنظیمات هوش مصنوعی</span>
          </div>
          <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-400/20 text-purple-300 border border-purple-400/30">
            اصلی
          </span>
        </button>

        <button
          onClick={onOpenSubscriptions}
          className="w-full p-2.5 rounded-xl bg-[#0B1220]/60 hover:bg-amber-500/15 border border-transparent hover:border-amber-500/30 text-slate-300 hover:text-amber-300 font-bold text-xs flex items-center justify-between transition-all cursor-pointer group"
        >
          <div className="flex items-center gap-2.5">
            <Crown className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
            <span>تعرفه‌ها & اشتراک</span>
          </div>
          <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">
            {currentUser?.plan?.toUpperCase() || 'FREE'}
          </span>
        </button>

        {currentUser?.role === 'admin' && (
          <button
            onClick={onOpenAdminPanel}
            className="w-full p-2.5 rounded-xl bg-[#0B1220]/60 hover:bg-purple-500/15 border border-transparent hover:border-purple-500/30 text-slate-300 hover:text-purple-300 font-bold text-xs flex items-center justify-between transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" />
              <span>پنل مدیریت سیستم</span>
            </div>
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-400/20 text-purple-300 border border-purple-400/30">
              ADMIN
            </span>
          </button>
        )}
      </div>

      {/* Live System Stats Widget */}
      <div className="neu-flat p-4 rounded-2xl border border-white/10 bg-[#111C2F]/80 backdrop-blur-xl shadow-xl space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-slate-300">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>آمار لحظه‌ای سیستم</span>
          </span>
        </div>

        <div className="space-y-2">
          <div className="p-2.5 rounded-xl bg-[#0B1220] border border-white/5 flex items-center justify-between text-xs">
            <span className="text-slate-400">اتصالات آنلاین:</span>
            <span className="font-black text-sky-400">{activeCount.toLocaleString('fa-IR')}</span>
          </div>

          <div className="p-2.5 rounded-xl bg-[#0B1220] border border-white/5 flex items-center justify-between text-xs">
            <span className="text-slate-400">کل انتقال پیام‌ها:</span>
            <span className="font-black text-emerald-400">{totalTransferred.toLocaleString('fa-IR')}</span>
          </div>
        </div>
      </div>

      {/* Theme Switcher Card */}
      <div className="mt-auto neu-flat p-3 rounded-2xl border border-white/10 bg-[#111C2F]/80 backdrop-blur-xl shadow-xl">
        <button
          onClick={onToggleTheme}
          className="w-full p-2.5 rounded-xl bg-[#0B1220] hover:bg-slate-800 border border-white/10 text-slate-300 hover:text-white text-xs font-bold flex items-center justify-between transition-all cursor-pointer"
        >
          <span>تغییر پوسته ({theme === 'dark' ? 'تاریک' : 'روشن'})</span>
          <Palette className="w-4 h-4 text-amber-400" />
        </button>
      </div>

    </aside>
  );
};
