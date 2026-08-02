import React, { useState, useEffect } from 'react';
import { 
  X, 
  User, 
  Lock, 
  Mail, 
  Phone, 
  LogIn, 
  UserPlus, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  ShieldCheck, 
  KeyRound, 
  ArrowRight, 
  Send, 
  Check, 
  Eye, 
  EyeOff, 
  Sun, 
  Moon, 
  AtSign, 
  LockKeyhole,
  Zap
} from 'lucide-react';
import { loginUser, registerUser, forgotPassword, sendEmailOtp } from '../services/api';
import { User as UserType } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: UserType, token: string) => void;
  initialMode?: 'login' | 'register';
  isClosable?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  initialMode = 'register',
  isClosable = true
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(initialMode);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Password visibility states
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);

  // Theme state synced with html element
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return document.documentElement.classList.contains('light') ? 'light' : 'dark';
  });

  // Login Form State
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register Form State
  const [regFullName, setRegFullName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  // Forgot Password Form State
  const [forgotIdentifier, setForgotIdentifier] = useState('');

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  if (!isOpen) return null;

  const handleToggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('autorun_theme', nextTheme);
    if (nextTheme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  };

  // Password Strength Calculator
  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { score: 0, label: '', color: 'bg-slate-300 dark:bg-slate-700', text: 'text-slate-500', width: 'w-0' };
    let score = 0;
    if (pwd.length >= 8) score += 1;
    if (/[a-zA-Z\u0600-\u06FF]/.test(pwd) && /[0-9]/.test(pwd)) score += 1;
    if (pwd.length >= 10 && /[^a-zA-Z0-9\u0600-\u06FF]/.test(pwd)) score += 1;

    if (score === 1) return { score: 1, label: 'ضعیف', color: 'bg-red-500', text: 'text-red-500 dark:text-red-400', width: 'w-1/3' };
    if (score === 2) return { score: 2, label: 'متوسط', color: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', width: 'w-2/3' };
    return { score: 3, label: 'قوی', color: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', width: 'w-full' };
  };

  const pwdStrength = getPasswordStrength(regPassword);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!loginIdentifier.trim() || !loginPassword.trim()) {
      setErrorMsg('لطفاً نام کاربری و رمز عبور را وارد کنید.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await loginUser({
        identifier: loginIdentifier.trim(),
        password: loginPassword.trim(),
      });
      setSuccessMsg(`خوش آمدید، ${res.user.fullName || res.user.username}!`);
      setTimeout(() => {
        onSuccess(res.user, res.token);
        onClose();
      }, 600);
    } catch (err: any) {
      setErrorMsg(err.message || 'خطا در ورود به حساب کاربری.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanEmail = regEmail.trim();
    const cleanPassword = regPassword.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const allowedDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'proton.me', 'protonmail.com', 'live.com', 'yandex.com', 'zoho.com'];
    const emailDomain = cleanEmail.split('@')[1]?.toLowerCase();

    if (!regUsername.trim() || !cleanPassword) {
      setErrorMsg('نام کاربری و رمز عبور الزامی است.');
      return;
    }

    if (!cleanEmail || !emailRegex.test(cleanEmail) || !emailDomain || !allowedDomains.includes(emailDomain)) {
      setErrorMsg('ثبت‌نام فقط با سرویس‌های ایمیل معتبر (Gmail، Yahoo، Outlook) امکان‌پذیر است.');
      return;
    }

    const hasLetter = /[a-zA-Z\u0600-\u06FF]/.test(cleanPassword);
    const hasNumber = /[0-9]/.test(cleanPassword);
    if (cleanPassword.length < 8 || !hasLetter || !hasNumber) {
      setErrorMsg('رمز عبور باید حداقل ۸ کاراکتر و ترکیبی از حروف و اعداد باشد.');
      return;
    }

    if (cleanPassword !== regConfirmPassword.trim()) {
      setErrorMsg('رمز عبور و تکرار آن یکسان نیستند.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await registerUser({
        fullName: regFullName.trim(),
        username: regUsername.trim(),
        email: cleanEmail,
        phone: regPhone.trim(),
        password: cleanPassword,
      });
      setSuccessMsg('ثبت‌نام و ساخت حساب با موفقیت انجام شد! در حال انتقال...');
      setTimeout(() => {
        onSuccess(res.user, res.token);
        onClose();
      }, 800);
    } catch (err: any) {
      setErrorMsg(err.message || 'خطا در ثبت‌نام حساب.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!forgotIdentifier.trim()) {
      setErrorMsg('لطفاً ایمیل یا شماره موبایل را وارد کنید.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await forgotPassword(forgotIdentifier.trim());
      setSuccessMsg(res.message);
    } catch (err: any) {
      setErrorMsg(err.message || 'خطا در بازیابی رمز عبور.');
    } finally {
      setIsLoading(false);
    }
  };

  const isLight = theme === 'light';

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 backdrop-blur-2xl overflow-y-auto dir-rtl transition-all duration-300 ${
      isLight ? 'bg-slate-900/60' : 'bg-[#0B1220]/90'
    }`}>
      
      {/* Outer Cyber Glass Wrapper Box */}
      <div className={`relative w-full max-w-5xl rounded-3xl overflow-hidden my-auto flex flex-col transition-all border shadow-2xl ${
        isLight 
          ? 'bg-white border-slate-200 text-slate-900 shadow-slate-300/50' 
          : 'bg-[#0B1220] border-[#229ED9]/30 text-white shadow-[0_0_60px_rgba(34,158,217,0.15)]'
      }`}>
        
        {/* Top App Bar Header */}
        <div className={`p-4 md:p-5 border-b flex items-center justify-between backdrop-blur-md ${
          isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#111C2F]/80 border-white/10'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl overflow-hidden border shadow-lg shrink-0 ${
              isLight ? 'border-sky-300 shadow-sky-100 bg-white' : 'border-[#229ED9]/40 shadow-[#229ED9]/20 bg-[#0B1220]'
            }`}>
              <img src="/logo.jpg" alt="Auto Run Logo" className="w-full h-full object-cover" />
            </div>
            <div>
              <h2 className={`text-base font-black tracking-wide ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Auto Run
              </h2>
              <p className={`text-[11px] ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>سامانه مدیریت ربات</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Theme Switcher Button */}
            <button
              type="button"
              onClick={handleToggleTheme}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer shadow-sm ${
                isLight 
                  ? 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200' 
                  : 'bg-[#0B1220] border-white/10 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
              title="تغییر پوسته (تاریک / روشن)"
            >
              {isLight ? <Moon className="w-4 h-4 text-sky-600" /> : <Sun className="w-4 h-4 text-amber-400" />}
            </button>

            {isClosable && (
              <button
                type="button"
                onClick={onClose}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                  isLight 
                    ? 'bg-slate-100 border-slate-300 text-slate-500 hover:text-slate-900 hover:bg-slate-200' 
                    : 'bg-[#0B1220] border-white/10 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Main Content Split Layout */}
        <div className="p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          
          {/* LEFT SIDE: Branding & Security Card */}
          <div className={`hidden lg:flex lg:col-span-5 flex-col justify-between border rounded-2xl p-6 relative overflow-hidden shadow-xl backdrop-blur-xl ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#111C2F]/60 border-white/10'
          }`}>
            {/* Ambient Background Glows */}
            <div className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none ${
              isLight ? 'bg-sky-200/40' : 'bg-[#229ED9]/15'
            }`}></div>

            {/* Top Branding Section */}
            <div className="text-center space-y-3 relative z-10 my-2">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-[#229ED9] to-[#38BDF8] p-0.5 shadow-lg mx-auto mb-4 flex items-center justify-center overflow-hidden">
                <div className={`w-full h-full rounded-[22px] flex items-center justify-center overflow-hidden ${
                  isLight ? 'bg-white' : 'bg-[#0B1220]'
                }`}>
                  <img src="/logo.jpg" alt="Auto Run Airplane Logo" className="w-full h-full object-cover" />
                </div>
              </div>

              <h1 className={`text-2xl font-black tracking-wide ${isLight ? 'text-slate-900' : 'text-white'}`}>
                به <span className="text-[#0284C7] dark:text-[#38BDF8]">Auto Run</span> خوش آمدید
              </h1>

              <p className={`text-xs font-semibold ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                سامانه مدیریت پیشرفته ربات ها
              </p>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#229ED9]/15 border border-[#229ED9]/30 text-[#0284C7] dark:text-[#38BDF8] text-[11px] font-black">
                <Zap className="w-3.5 h-3.5" />
                <span>سریع ، امن و هوشمند</span>
              </div>
            </div>

            {/* Middle Graphic Window */}
            <div className={`relative my-6 rounded-2xl border p-5 shadow-inner overflow-hidden flex flex-col items-center justify-center min-h-[170px] ${
              isLight ? 'bg-white border-slate-200' : 'bg-[#0B1220]/80 border-[#229ED9]/30'
            }`}>
              <div className={`w-full flex items-center justify-between pb-3 border-b mb-4 ${
                isLight ? 'border-slate-200' : 'border-white/10'
              }`}>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                </div>
                <span className={`text-[10px] font-mono ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>AUTO RUN CONTROL</span>
              </div>

              <div className="relative flex items-center justify-center py-2">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#229ED9] to-purple-600 p-0.5 shadow-lg">
                  <div className={`w-full h-full rounded-[14px] flex items-center justify-center overflow-hidden ${
                    isLight ? 'bg-white' : 'bg-[#0B1220]'
                  }`}>
                    <img src="/logo.jpg" alt="Paper Plane" className="w-full h-full object-cover" />
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Security Info Card */}
            <div className={`p-4 rounded-xl border flex items-start gap-3 relative z-10 shadow-sm ${
              isLight ? 'bg-white border-slate-200' : 'bg-[#0B1220]/90 border-white/10'
            }`}>
              <div className="p-2.5 rounded-xl bg-[#229ED9]/20 text-[#0284C7] dark:text-[#38BDF8] border border-[#229ED9]/30 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className={`text-xs font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>امنیت اطلاعات شما در اولویت ماست</h4>
                <p className={`text-[11px] leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  اطلاعات شما به صورت رمزنگاری شده در سرور های امن ذخیره می‌شود.
                </p>
              </div>
            </div>

          </div>

          {/* RIGHT SIDE: Authentication Form Card */}
          <div className={`lg:col-span-7 border rounded-2xl p-4 sm:p-6 shadow-xl flex flex-col justify-between backdrop-blur-xl ${
            isLight ? 'bg-white border-slate-200' : 'bg-[#111C2F]/90 border-white/10'
          }`}>
            <div>
              
              {/* Tabs Switcher Bar */}
              {mode !== 'forgot' && (
                <div className={`p-1 rounded-2xl border grid grid-cols-2 gap-1 mb-6 shadow-inner ${
                  isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#0B1220] border-white/10'
                }`}>
                  <button
                    type="button"
                    onClick={() => { setMode('register'); setErrorMsg(null); setSuccessMsg(null); }}
                    className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      mode === 'register'
                        ? 'bg-[#229ED9] text-white shadow-md border border-[#38BDF8]/50'
                        : isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60' : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>ثبت‌نام حساب جدید</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setMode('login'); setErrorMsg(null); setSuccessMsg(null); }}
                    className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      mode === 'login'
                        ? 'bg-[#229ED9] text-white shadow-md border border-[#38BDF8]/50'
                        : isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60' : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <LogIn className="w-4 h-4" />
                    <span>ورود به حساب</span>
                  </button>
                </div>
              )}

              {/* Alert Messages Box */}
              {errorMsg && (
                <div className="mb-5 p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3 text-xs text-red-600 dark:text-red-300">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <span className="font-bold">{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="mb-5 p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-3 text-xs text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="font-bold">{successMsg}</span>
                </div>
              )}

              {/* 1. REGISTER FORM */}
              {mode === 'register' && (
                <form onSubmit={handleRegisterSubmit} className="space-y-4">
                  
                  {/* Full Name Input */}
                  <div className="space-y-1.5">
                    <label className={`block text-xs font-black ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                      نام و نام خانوادگی:
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={regFullName}
                        onChange={(e) => setRegFullName(e.target.value)}
                        placeholder="مثال: امیررضا انصاری"
                        className={`w-full border rounded-xl pr-3.5 pl-10 py-3 text-xs outline-none transition-all ${
                          isLight 
                            ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-[#229ED9]' 
                            : 'bg-[#0B1220] border-white/15 text-white placeholder-slate-500 focus:border-[#229ED9]'
                        }`}
                        required
                      />
                      <User className="w-4 h-4 text-[#229ED9] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  {/* Username (Tag ID) Input */}
                  <div className="space-y-1">
                    <label className={`block text-xs font-black ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                      نام کاربری (تگ آیدی):
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={regUsername}
                        onChange={(e) => setRegUsername(e.target.value)}
                        placeholder="مثال: amiran"
                        className={`w-full border rounded-xl pr-3.5 pl-10 py-3 text-xs outline-none transition-all font-mono dir-ltr text-right ${
                          isLight 
                            ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-[#229ED9]' 
                            : 'bg-[#0B1220] border-white/15 text-white placeholder-slate-500 focus:border-[#229ED9]'
                        }`}
                        required
                      />
                      <AtSign className="w-4 h-4 text-[#229ED9] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                    <p className={`text-[10px] pr-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      فقط حروف انگلیسی، اعداد و زیرخط (_)
                    </p>
                  </div>

                  {/* Phone Input */}
                  <div className="space-y-1.5">
                    <label className={`block text-xs font-black ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                      شماره همراه (اختیاری):
                    </label>
                    <div className="relative">
                      <input
                        type="tel"
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        placeholder="مثال: ۰۹۱۲۰۰۰۰۰۰۰"
                        className={`w-full border rounded-xl pr-3.5 pl-10 py-3 text-xs outline-none transition-all font-mono dir-ltr text-right ${
                          isLight 
                            ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-[#229ED9]' 
                            : 'bg-[#0B1220] border-white/15 text-white placeholder-slate-500 focus:border-[#229ED9]'
                        }`}
                      />
                      <Phone className="w-4 h-4 text-[#229ED9] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  {/* Email Input */}
                  <div className="space-y-1.5">
                    <label className={`block text-xs font-black ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                      ایمیل آدرس (فقط Gmail / Yahoo / Outlook):
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="مثال: name@gmail.com"
                        className={`w-full border rounded-xl pr-3.5 pl-10 py-3 text-xs outline-none transition-all font-mono dir-ltr text-right ${
                          isLight 
                            ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-[#229ED9]' 
                            : 'bg-[#0B1220] border-white/15 text-white placeholder-slate-500 focus:border-[#229ED9]'
                        }`}
                        required
                      />
                      <Mail className="w-4 h-4 text-[#229ED9] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  {/* Password Input & Password Strength Bar */}
                  <div className="space-y-1.5">
                    <label className={`block text-xs font-black ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                      رمز عبور (حداقل ۸ کاراکتر شامل حرف و عدد):
                    </label>
                    <div className="relative">
                      <input
                        type={showRegPassword ? 'text' : 'password'}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="••••••••"
                        className={`w-full border rounded-xl pr-10 pl-10 py-3 text-xs outline-none transition-all font-mono dir-ltr text-right ${
                          isLight 
                            ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-[#229ED9]' 
                            : 'bg-[#0B1220] border-white/15 text-white placeholder-slate-500 focus:border-[#229ED9]'
                        }`}
                        required
                      />
                      <Lock className="w-4 h-4 text-[#229ED9] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors cursor-pointer ${
                          isLight ? 'text-slate-400 hover:text-slate-800' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Password Strength Indicator */}
                    {regPassword && (
                      <div className="flex items-center justify-between pt-1 px-1 text-[11px]">
                        <span className={isLight ? 'text-slate-600' : 'text-slate-400'}>قدرت رمز عبور: <strong className={pwdStrength.text}>{pwdStrength.label}</strong></span>
                        <div className={`w-24 h-1.5 rounded-full overflow-hidden border ${isLight ? 'bg-slate-200 border-slate-300' : 'bg-[#0B1220] border-white/10'}`}>
                          <div className={`h-full transition-all duration-300 ${pwdStrength.color} ${pwdStrength.width}`}></div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Confirm Password Input */}
                  <div className="space-y-1.5">
                    <label className={`block text-xs font-black ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                      تکرار رمز عبور:
                    </label>
                    <div className="relative">
                      <input
                        type={showRegConfirmPassword ? 'text' : 'password'}
                        value={regConfirmPassword}
                        onChange={(e) => setRegConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className={`w-full border rounded-xl pr-10 pl-10 py-3 text-xs outline-none transition-all font-mono dir-ltr text-right ${
                          isLight 
                            ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-[#229ED9]' 
                            : 'bg-[#0B1220] border-white/15 text-white placeholder-slate-500 focus:border-[#229ED9]'
                        }`}
                        required
                      />
                      <Lock className="w-4 h-4 text-[#229ED9] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <button
                        type="button"
                        onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                        className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors cursor-pointer ${
                          isLight ? 'text-slate-400 hover:text-slate-800' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {showRegConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full mt-4 py-3.5 px-6 rounded-xl font-black text-xs sm:text-sm text-white bg-gradient-to-r from-[#229ED9] via-[#38BDF8] to-purple-600 hover:opacity-95 shadow-lg shadow-sky-500/20 transition-all duration-300 transform hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isLoading ? (
                      <span>در حال ثبت‌نام...</span>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        <span>تکمیل ثبت‌نام و ساخت حساب</span>
                      </>
                    )}
                  </button>

                </form>
              )}

              {/* 2. LOGIN FORM */}
              {mode === 'login' && (
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className={`block text-xs font-black ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                      نام کاربری / ایمیل / شماره موبایل:
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={loginIdentifier}
                        onChange={(e) => setLoginIdentifier(e.target.value)}
                        placeholder="مثال: amiran یا name@gmail.com"
                        className={`w-full border rounded-xl pr-3.5 pl-10 py-3 text-xs outline-none transition-all font-mono dir-ltr text-right ${
                          isLight 
                            ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-[#229ED9]' 
                            : 'bg-[#0B1220] border-white/15 text-white placeholder-slate-500 focus:border-[#229ED9]'
                        }`}
                        required
                      />
                      <User className="w-4 h-4 text-[#229ED9] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className={`block text-xs font-black ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                        رمز عبور:
                      </label>
                      <button
                        type="button"
                        onClick={() => { setMode('forgot'); setErrorMsg(null); setSuccessMsg(null); }}
                        className="text-[11px] text-[#0284C7] dark:text-[#38BDF8] hover:underline font-extrabold cursor-pointer"
                      >
                        فراموشی رمز عبور؟
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showLoginPassword ? 'text' : 'password'}
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••••••"
                        className={`w-full border rounded-xl pr-10 pl-10 py-3 text-xs outline-none transition-all font-mono dir-ltr text-right ${
                          isLight 
                            ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-[#229ED9]' 
                            : 'bg-[#0B1220] border-white/15 text-white placeholder-slate-500 focus:border-[#229ED9]'
                        }`}
                        required
                      />
                      <Lock className="w-4 h-4 text-[#229ED9] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                        className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors cursor-pointer ${
                          isLight ? 'text-slate-400 hover:text-slate-800' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full mt-4 py-3.5 px-6 rounded-xl font-black text-xs sm:text-sm text-white bg-gradient-to-r from-[#229ED9] via-[#38BDF8] to-purple-600 hover:opacity-95 shadow-lg shadow-sky-500/20 transition-all duration-300 transform hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isLoading ? (
                      <span>در حال ورود...</span>
                    ) : (
                      <>
                        <LogIn className="w-4 h-4" />
                        <span>ورود به حساب کاربری</span>
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* 3. FORGOT PASSWORD FORM */}
              {mode === 'forgot' && (
                <form onSubmit={handleForgotSubmit} className="space-y-4">
                  <p className={`text-xs leading-relaxed p-3 rounded-xl border ${
                    isLight ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-[#0B1220] border-white/10 text-slate-300'
                  }`}>
                    لطفاً ایمیل یا شماره همراه ثبت‌شده در حساب کاربری خود را وارد کنید تا لینک بازیابی ارسال شود:
                  </p>

                  <div className="space-y-1.5">
                    <label className={`block text-xs font-black ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                      ایمیل یا شماره همراه:
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={forgotIdentifier}
                        onChange={(e) => setForgotIdentifier(e.target.value)}
                        placeholder="ایمیل یا ۰۹۱۲..."
                        className={`w-full border rounded-xl pr-3.5 pl-10 py-3 text-xs outline-none transition-all font-mono dir-ltr text-right ${
                          isLight 
                            ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-[#229ED9]' 
                            : 'bg-[#0B1220] border-white/15 text-white placeholder-slate-500 focus:border-[#229ED9]'
                        }`}
                        required
                      />
                      <Mail className="w-4 h-4 text-[#229ED9] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => { setMode('login'); setErrorMsg(null); setSuccessMsg(null); }}
                      className={`px-4 py-3 border text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                        isLight ? 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200' : 'bg-[#0B1220] border-white/15 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                      <span>بازگشت به ورود</span>
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="flex-1 py-3 bg-[#229ED9] text-white font-bold text-xs rounded-xl hover:bg-[#38BDF8] transition-all flex items-center justify-center gap-2 shadow-md disabled:opacity-50 cursor-pointer"
                    >
                      {isLoading ? 'در حال ارسال...' : 'ارسال لینک بازیابی'}
                    </button>
                  </div>
                </form>
              )}

            </div>

            {/* Bottom Encryption Note */}
            <div className={`mt-6 p-3 rounded-xl border text-center text-[11px] font-bold flex items-center justify-center gap-2 shadow-inner ${
              isLight ? 'bg-slate-100 border-slate-200 text-slate-800' : 'bg-[#0B1220] border-white/10 text-slate-300'
            }`}>
              <LockKeyhole className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>تمامی اطلاعات شما به صورت رمزنگاری شده در سرور Auto run حفظ می‌شود.</span>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
