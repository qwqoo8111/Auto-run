import React, { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { DesktopSidebar } from './components/DesktopSidebar';
import { CreateConnectionForm } from './components/CreateConnectionForm';
import { ConnectionCard } from './components/ConnectionCard';
import { ConnectionLogsModal } from './components/ConnectionLogsModal';
import { TransferredMessagesModal } from './components/TransferredMessagesModal';
import { AdvancedSettingsModal } from './components/AdvancedSettingsModal';
import { AuthModal } from './components/AuthModal';
import { AdminPanelModal } from './components/AdminPanelModal';
import { SubscriptionsModal } from './components/SubscriptionsModal';
import { GlobalSupervisorModal } from './components/GlobalSupervisorModal';
import { SocialWebImporterModal } from './components/SocialWebImporterModal';
import { NotificationsModal } from './components/NotificationsModal';
import { ThemeSelectorModal, AppTheme } from './components/ThemeSelectorModal';
import { TelegramConnection, CreateConnectionDTO, ConnectionStats, User } from './types';

import { 
  fetchConnections, 
  createConnection, 
  pauseConnection, 
  resumeConnection, 
  deleteConnection, 
  sendTestMessage, 
  triggerManualSync,
  fetchCurrentUser
} from './services/api';
import { SlidersHorizontal, Radio, Layers, Sun, Moon } from 'lucide-react';

export default function App() {
  const [theme, setTheme] = useState<AppTheme>(() => {
    return (localStorage.getItem('autorun_theme') as AppTheme) || 'dark';
  });
  const [isThemeSelectorOpen, setIsThemeSelectorOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [connections, setConnections] = useState<TelegramConnection[]>([]);
  const [stats, setStats] = useState<ConnectionStats>({
    totalConnections: 0,
    activeConnections: 0,
    totalTransferred: 0,
    lastActivity: null,
  });

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [isSubscriptionsOpen, setIsSubscriptionsOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isGlobalSupervisorOpen, setIsGlobalSupervisorOpen] = useState(false);
  const [isSocialWebImporterOpen, setIsSocialWebImporterOpen] = useState(false);
  const [isGlobalAiSettingsOpen, setIsGlobalAiSettingsOpen] = useState(false);

  const authToken = localStorage.getItem('autorun_auth_token') || '';


  const [isFormSubmitting, setIsFormSubmitting] = useState(false);
  const [selectedLogsConn, setSelectedLogsConn] = useState<TelegramConnection | null>(null);
  const [selectedMessagesConn, setSelectedMessagesConn] = useState<TelegramConnection | null>(null);
  const [selectedSettingsConn, setSelectedSettingsConn] = useState<TelegramConnection | null>(null);

  // Sync theme class to html element
  useEffect(() => {
    document.documentElement.classList.remove('light', 'theme-dark', 'theme-emerald', 'theme-ocean', 'theme-ruby');
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else if (theme !== 'dark') {
      document.documentElement.classList.add(`theme-${theme}`);
    }
    localStorage.setItem('autorun_theme', theme);
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  // Load User Session & Connections
  const checkUserSession = async () => {
    let savedToken = localStorage.getItem('autorun_auth_token');
    if (!savedToken) {
      savedToken = 'usr_token_admin_secret_key_137819';
      localStorage.setItem('autorun_auth_token', savedToken);
    }
    try {
      const user = await fetchCurrentUser(savedToken);
      if (user && user.id) {
        setCurrentUser(user);
        return;
      }
    } catch (_) {
      // Saved token was invalid or expired - fallback to default admin account
    }

    try {
      const adminUser = await fetchCurrentUser('usr_token_admin_secret_key_137819');
      if (adminUser && adminUser.id) {
        setCurrentUser(adminUser);
        localStorage.setItem('autorun_auth_token', 'usr_token_admin_secret_key_137819');
        return;
      }
    } catch (_) {}

    setCurrentUser(null);
    localStorage.removeItem('autorun_auth_token');
  };

  const loadData = async () => {
    try {
      const data = await fetchConnections();
      setConnections(data.connections || []);
      setStats(data.stats || { totalConnections: 0, activeConnections: 0, totalTransferred: 0, lastActivity: null });
    } catch (err: any) {
      if (err?.message?.includes('403') || err?.message?.includes('401') || err?.message?.includes('منقضی')) {
        await checkUserSession();
      } else {
        console.error('Error fetching connections:', err);
      }
    }
  };

  useEffect(() => {
    const init = async () => {
      await checkUserSession();
      await loadData();
    };
    init();
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [currentUser]);

  const handleAuthSuccess = (user: User, token: string) => {
    setCurrentUser(user);
    localStorage.setItem('autorun_auth_token', token);
    loadData();
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('autorun_auth_token');
  };

  const handleOpenAuth = (mode: 'login' | 'register' = 'login') => {
    setAuthMode(mode);
    setIsAuthOpen(true);
  };

  // Handlers
  const handleCreateConnection = async (dto: CreateConnectionDTO) => {
    setIsFormSubmitting(true);
    try {
      await createConnection(dto);
      await loadData();
    } finally {
      setIsFormSubmitting(false);
    }
  };

  const handlePause = async (id: string) => {
    await pauseConnection(id);
    await loadData();
  };

  const handleResume = async (id: string) => {
    await resumeConnection(id);
    await loadData();
  };

  const handleDelete = async (id: string) => {
    await deleteConnection(id);
    await loadData();
  };

  const handleSendTest = async (id: string) => {
    await sendTestMessage(id);
    await loadData();
  };

  const handleManualSync = async (id: string) => {
    await triggerManualSync(id);
    await loadData();
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[var(--bg-dark)] text-slate-200 selection:bg-yellow-400 selection:text-black py-8 px-4 dir-rtl flex flex-col justify-between items-center relative transition-colors duration-300">
        
        {/* Top bar with theme toggle */}
        <div className="w-full max-w-md mx-auto flex justify-end px-2">
          <button
            onClick={handleToggleTheme}
            title={theme === 'dark' ? 'تغییر به تم روشن' : 'تغییر به تم تاریک'}
            className="neu-inset px-3 py-1.5 rounded-xl text-slate-300 hover:text-yellow-400 transition-all text-xs font-bold flex items-center gap-1.5 border border-white/10"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-3.5 h-3.5 text-yellow-400" />
                <span>تم روشن</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-purple-400" />
                <span>تم تاریک</span>
              </>
            )}
          </button>
        </div>

        {/* Brand Header */}
        <div className="w-full max-w-md mx-auto text-center space-y-3 pt-4">
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-gradient-to-r from-yellow-400/20 via-purple-500/10 to-blue-500/10 border border-yellow-400/30 text-yellow-400 shadow-xl">
            <span className="text-xl">⚡</span>
            <span className="text-xs font-black tracking-wide">ربات هوشمند انتقال کانال به کانال تلگرام</span>
          </div>
          
          <h1 className="text-2xl md:text-3xl font-black text-white leading-tight">
            سامانه خودکار <span className="text-yellow-400 underline decoration-yellow-400/40">Auto run</span>
          </h1>
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            جهت دسترسی به امکانات ربات، مدیریت اتصالات و بازنویسی با هوش مصنوعی، ابتدا وارد حساب کاربری خود شوید یا ثبت‌نام کنید.
          </p>
        </div>

        {/* Auth Gate Modal Container */}
        <div className="w-full max-w-md my-6">
          <AuthModal
            isOpen={true}
            onClose={() => {}}
            onSuccess={handleAuthSuccess}
            initialMode={authMode}
            isClosable={false}
          />
        </div>

        {/* Feature Highlights Grid */}
        <div className="w-full max-w-2xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
          <div className="p-3 neu-inset rounded-xl border border-white/5 text-center">
            <span className="text-lg block mb-1">🤖</span>
            <span className="text-xs font-bold text-slate-200 block">بازنویسی هوش مصنوعی</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Gemini, OpenAI, DeepSeek</span>
          </div>
          <div className="p-3 neu-inset rounded-xl border border-white/5 text-center">
            <span className="text-lg block mb-1">📸</span>
            <span className="text-xs font-bold text-slate-200 block">پشتیبانی از انواع رسانه</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">ویدیو، عکس، آلبوم، فایل</span>
          </div>
          <div className="p-3 neu-inset rounded-xl border border-white/5 text-center">
            <span className="text-lg block mb-1">✏️</span>
            <span className="text-xs font-bold text-slate-200 block">امضا و کلمات سفارشی</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">حذف آیدی و لینک‌های منبع</span>
          </div>
          <div className="p-3 neu-inset rounded-xl border border-white/5 text-center">
            <span className="text-lg block mb-1">⚡</span>
            <span className="text-xs font-bold text-slate-200 block">ارسال آنی و زنده</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">مانتیورینگ خودکار ۲۴/۷</span>
          </div>
        </div>

        {/* Footer */}
        <footer className="w-full max-w-md mx-auto text-center text-xs text-slate-500 pt-4 border-t border-white/5">
          <p>Auto run Telegram Bot Manager © 2026</p>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-dark)] text-slate-200 selection:bg-sky-400 selection:text-black py-4 px-2 md:py-6 md:px-6 dir-rtl transition-colors duration-300 pb-6 md:pb-8">
      
      {/* Navigation Drawer & Bottom Bar */}
      <Navigation
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        activeCount={stats.activeConnections}
        totalTransferred={stats.totalTransferred}
        currentUser={currentUser}
        onOpenAuth={handleOpenAuth}
        onLogout={handleLogout}
        onOpenAdminPanel={() => setIsAdminPanelOpen(true)}
        onOpenSubscriptions={() => setIsSubscriptionsOpen(true)}
        onOpenGlobalSupervisor={() => setIsGlobalSupervisorOpen(true)}
        onOpenSocialWebImporter={() => setIsSocialWebImporterOpen(true)}
        onOpenAiSettings={() => setIsGlobalAiSettingsOpen(true)}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      <div className="max-w-7xl mx-auto flex gap-6 items-start">
        
        {/* Desktop Left/Right Sidebar */}
        <DesktopSidebar 
          activeCount={stats.activeConnections}
          totalTransferred={stats.totalTransferred}
          currentUser={currentUser}
          onOpenAdminPanel={() => setIsAdminPanelOpen(true)}
          onOpenSubscriptions={() => setIsSubscriptionsOpen(true)}
          onOpenGlobalSupervisor={() => setIsGlobalSupervisorOpen(true)}
          onOpenSocialWebImporter={() => setIsSocialWebImporterOpen(true)}
          onOpenAiSettings={() => setIsGlobalAiSettingsOpen(true)}
          onToggleTheme={handleToggleTheme}
          theme={theme}
        />

        {/* Main Content Column */}
        <div className="flex-1 min-w-0 w-full">
          
          {/* Header */}
          <Header 
            activeCount={stats.activeConnections} 
            totalTransferred={stats.totalTransferred} 
            currentUser={currentUser}
            onOpenAuth={handleOpenAuth}
            onLogout={handleLogout}
            onOpenAdminPanel={() => setIsAdminPanelOpen(true)}
            onOpenSubscriptions={() => setIsSubscriptionsOpen(true)}
            onOpenNotifications={() => setIsNotificationsOpen(true)}
            onOpenGlobalSupervisor={() => setIsGlobalSupervisorOpen(true)}
            onOpenSocialWebImporter={() => setIsSocialWebImporterOpen(true)}
            onOpenAiSettings={() => setIsGlobalAiSettingsOpen(true)}
            onOpenThemeSelector={() => setIsThemeSelectorOpen(true)}
            theme={theme}
            onToggleTheme={handleToggleTheme}
            onToggleMobileMenu={() => setIsMobileMenuOpen(prev => !prev)}
          />

          {/* Main 3-Field Connection Form */}
          <CreateConnectionForm 
            onSubmit={handleCreateConnection} 
            isLoading={isFormSubmitting} 
            currentUser={currentUser}
            onOpenSubscriptions={() => setIsSubscriptionsOpen(true)}
            onOpenAiSettings={() => setIsGlobalAiSettingsOpen(true)}
          />

          {/* Active Connections Panel */}
          <main className="w-full pb-8">
            <div className="neu-flat p-4 md:p-5 border border-white/10 rounded-2xl bg-[#111C2F]/80 backdrop-blur-md mb-6 flex items-center justify-between shadow-xl">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm md:text-base font-black text-white">پنل مدیریت اتصالات فعال</h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    لیست اتصالات فعال و مدیریت عملیات مانیتورینگ و ویرایش خودکار
                  </p>
                </div>
              </div>

              <div className="text-xs text-slate-300 bg-[#0B1220] border border-white/10 px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-inner">
                <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span className="hidden sm:inline">تعداد اتصالات:</span>
                <span className="font-bold text-sky-400">{connections.length.toLocaleString('fa-IR')}</span>
              </div>
            </div>

            {/* List of Connections or Empty State */}
            {connections.length === 0 ? (
              <div className="neu-flat p-10 text-center border border-white/10 rounded-2xl bg-[#111C2F]/60 backdrop-blur-md my-6 shadow-xl">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                  <Layers className="w-8 h-8" />
                </div>
                <h3 className="text-sm md:text-base font-bold text-white mb-2">هیچ اتصالی هنوز ثبت نشده است</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                  برای شروع، اطلاعات کانال مبدأ، کانال مقصد و توکن ربات تلگرام خود را در فرم بالا وارد کرده و روی «شروع اتصال خودکار» کلیک کنید.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {connections.map((conn) => (
                  <ConnectionCard
                    key={conn.id}
                    connection={conn}
                    onPause={handlePause}
                    onResume={handleResume}
                    onDelete={handleDelete}
                    onOpenLogs={(c) => setSelectedLogsConn(c)}
                    onOpenMessages={(c) => setSelectedMessagesConn(c)}
                    onOpenSettings={(c) => setSelectedSettingsConn(c)}
                    onSendTest={handleSendTest}
                    onManualSync={handleManualSync}
                  />
                ))}
              </div>
            )}
          </main>

          {/* Footer */}
          <footer className="w-full pt-6 border-t border-white/10 text-center text-xs text-slate-500 flex flex-col sm:flex-row justify-between items-center gap-3">
            <div>
              <span>AUTO RUN — سامانه هوشمند مدیریت و انتقال خودکار محتوای تلگرام</span>
            </div>
            <div className="flex items-center gap-2 dir-ltr font-mono text-slate-400">
              <span>Auto run © 2026</span>
            </div>
          </footer>

        </div>
      </div>

      {/* Modals */}
      <ConnectionLogsModal
        connection={selectedLogsConn}
        onClose={() => setSelectedLogsConn(null)}
      />

      <TransferredMessagesModal
        connection={selectedMessagesConn}
        onClose={() => setSelectedMessagesConn(null)}
      />

      <AdvancedSettingsModal
        connection={selectedSettingsConn}
        isOpen={isGlobalAiSettingsOpen || !!selectedSettingsConn}
        onClose={() => {
          setSelectedSettingsConn(null);
          setIsGlobalAiSettingsOpen(false);
        }}
        onSaved={loadData}
        allConnections={connections}
        currentUser={currentUser}
        onOpenSubscriptions={() => setIsSubscriptionsOpen(true)}
      />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={handleAuthSuccess}
        initialMode={authMode}
      />

      <AdminPanelModal
        isOpen={isAdminPanelOpen}
        onClose={() => setIsAdminPanelOpen(false)}
        currentUser={currentUser}
        authToken={authToken}
      />

      <SubscriptionsModal
        isOpen={isSubscriptionsOpen}
        onClose={() => setIsSubscriptionsOpen(false)}
        currentUser={currentUser}
        authToken={authToken}
        onUserUpdated={(updatedUser) => setCurrentUser(updatedUser)}
        onOpenAuth={handleOpenAuth}
      />

      <NotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        connections={connections}
        currentUser={currentUser}
      />

      <GlobalSupervisorModal
        isOpen={isGlobalSupervisorOpen}
        onClose={() => setIsGlobalSupervisorOpen(false)}
        connections={connections}
      />

      <SocialWebImporterModal
        isOpen={isSocialWebImporterOpen}
        onClose={() => setIsSocialWebImporterOpen(false)}
        connections={connections}
        onCreateConnection={handleCreateConnection}
      />

      <ThemeSelectorModal
        isOpen={isThemeSelectorOpen}
        onClose={() => setIsThemeSelectorOpen(false)}
        currentTheme={theme}
        onSelectTheme={(newTheme) => {
          setTheme(newTheme);
          setIsThemeSelectorOpen(false);
        }}
      />

    </div>
  );
}
