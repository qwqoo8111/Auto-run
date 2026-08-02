import React from 'react';
import { Palette, Check, X, Sparkles, Moon, Sun, Shield, Layers } from 'lucide-react';

export type AppTheme = 'dark' | 'emerald' | 'ocean' | 'ruby' | 'light';

interface ThemeOption {
  id: AppTheme;
  name: string;
  badge: string;
  description: string;
  bgGradient: string;
  previewBg: string;
  accentColor: string;
  textColor: string;
  cardBg: string;
  borderColor: string;
  icon: React.ReactNode;
}

const THEMES: ThemeOption[] = [
  {
    id: 'dark',
    name: 'بنفش و نیلی سایبر (تاریک - اصلی)',
    badge: 'پیش‌فرض محبوب',
    description: 'تم کلاسیک سایبرپانک با تنالیته بنفش تیره، نیلی و جلوه‌های نئونی درخشان',
    bgGradient: 'from-purple-900/40 via-indigo-900/30 to-slate-900',
    previewBg: '#0F172A',
    cardBg: '#1E293B',
    accentColor: '#8B5CF6',
    textColor: '#F8FAFC',
    borderColor: '#334155',
    icon: <Moon className="w-5 h-5 text-purple-400" />,
  },
  {
    id: 'emerald',
    name: 'زمردی سایبر (سبز انرژی)',
    badge: 'پویا و پرانرژی',
    description: 'تم زنده و شاداب با زمینه زمردی تیره، سبز فسفری و لهجه‌های الکتریسیته',
    bgGradient: 'from-emerald-900/40 via-teal-900/30 to-slate-950',
    previewBg: '#061C14',
    cardBg: '#0B291E',
    accentColor: '#10B981',
    textColor: '#ECFDF5',
    borderColor: '#164E3D',
    icon: <Sparkles className="w-5 h-5 text-emerald-400" />,
  },
  {
    id: 'ocean',
    name: 'آبی نئون اقیانوسی (عمق فضا)',
    badge: 'شیک و اداری',
    description: 'زمینه سرمه‌ای عمیق با هایلایتهای فیروزه‌ای، سیانی و حس آرامش‌بخش عالی',
    bgGradient: 'from-sky-900/40 via-blue-900/30 to-slate-950',
    previewBg: '#0A1128',
    cardBg: '#1C2541',
    accentColor: '#00B4D8',
    textColor: '#F0F8FF',
    borderColor: '#2A385B',
    icon: <Shield className="w-5 h-5 text-sky-400" />,
  },
  {
    id: 'ruby',
    name: 'یاقوتی لوکس (ارغوانی گلمور)',
    badge: 'خاص و پرمیوم',
    description: 'تم لوکس با زمینه عنابی-زرشکی تیره، لهجه‌های یاقوتی و رزگلد چشم‌نواز',
    bgGradient: 'from-rose-900/40 via-pink-900/30 to-slate-950',
    previewBg: '#1A0910',
    cardBg: '#2B111D',
    accentColor: '#E11D48',
    textColor: '#FFF1F2',
    borderColor: '#4C1D32',
    icon: <Layers className="w-5 h-5 text-rose-400" />,
  },
  {
    id: 'light',
    name: 'سفید شفاف SaaS (روشن - مینیمال)',
    badge: 'مخصوص روز و کار در نور زیاد',
    description: 'تم روشن، تمیز و خوانا با رنگ‌های ملایم، کنتراست بالا و ظاهری استاندارد',
    bgGradient: 'from-slate-100 via-sky-50 to-white',
    previewBg: '#F5F8FC',
    cardBg: '#FFFFFF',
    accentColor: '#229ED9',
    textColor: '#1E293B',
    borderColor: '#CBD5E1',
    icon: <Sun className="w-5 h-5 text-amber-500" />,
  },
];

interface ThemeSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTheme: AppTheme;
  onSelectTheme: (theme: AppTheme) => void;
}

export const ThemeSelectorModal: React.FC<ThemeSelectorModalProps> = ({
  isOpen,
  onClose,
  currentTheme,
  onSelectTheme,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl neu-flat bg-slate-900 border border-purple-500/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-black/30">
          <div className="flex items-center gap-3">
            <div className="p-2.5 neu-inset rounded-xl text-purple-400">
              <Palette className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <span>انتخاب قالب و تم ظاهری برنامه (AUTO RUN)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                یکی از قالب‌های گرافیکی پیشرفته زیر را برای تغییر ظاهر رابط کاربری انتخاب کنید
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 neu-inset rounded-xl text-slate-400 hover:text-white hover:border-red-500/40 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Theme List Grid */}
        <div className="p-5 overflow-y-auto space-y-4 max-h-[calc(90vh-130px)]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {THEMES.map((item) => {
              const isSelected = currentTheme === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => onSelectTheme(item.id)}
                  className={`relative p-4 rounded-2xl border cursor-pointer transition-all duration-300 flex flex-col justify-between overflow-hidden group ${
                    isSelected
                      ? 'bg-purple-600/20 border-purple-400 shadow-lg shadow-purple-500/20 scale-[1.02]'
                      : 'bg-black/30 border-white/10 hover:border-purple-400/50 hover:bg-white/5'
                  }`}
                >
                  {/* Decorative Background Glow */}
                  <div
                    className={`absolute -top-10 -right-10 w-28 h-28 rounded-full blur-2xl opacity-30 pointer-events-none bg-gradient-to-br ${item.bgGradient}`}
                  />

                  <div>
                    {/* Header Row */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-black/40 border border-white/10">
                          {item.icon}
                        </div>
                        <span className="text-sm font-black text-white">
                          {item.name}
                        </span>
                      </div>
                      {isSelected ? (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          فعال
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-white/5 text-slate-400 text-[10px] font-bold">
                          {item.badge}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed mb-4">
                      {item.description}
                    </p>
                  </div>

                  {/* Mini Visual Preview Box */}
                  <div
                    className="w-full p-3 rounded-xl border flex items-center justify-between shadow-inner"
                    style={{
                      backgroundColor: item.previewBg,
                      borderColor: item.borderColor,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full animate-pulse"
                        style={{ backgroundColor: item.accentColor }}
                      />
                      <div
                        className="h-2 w-16 rounded-full opacity-80"
                        style={{ backgroundColor: item.textColor }}
                      />
                    </div>
                    <div
                      className="px-2 py-1 rounded-lg text-[10px] font-bold"
                      style={{
                        backgroundColor: item.cardBg,
                        color: item.textColor,
                        border: `1px solid ${item.borderColor}`,
                      }}
                    >
                      نمونه کارت
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-black/40 flex items-center justify-between text-xs text-slate-400">
          <span>تنظیمات قالب به طور خودکار در مرورگر ذخیره می‌شوند</span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl neu-btn-primary text-xs font-bold"
          >
            تأیید و بستن
          </button>
        </div>
      </div>
    </div>
  );
};
