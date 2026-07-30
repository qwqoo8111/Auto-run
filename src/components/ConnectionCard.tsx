import React, { useState } from 'react';
import { 
  Pause, Play, Trash2, FileText, Send, RefreshCw, Activity, 
  ArrowLeft, Clock, MessageSquare, Bot, AlertTriangle, CheckCircle2,
  List, Sliders, Replace, CopyCheck, Twitter, Globe, Layers, Link
} from 'lucide-react';
import { TelegramConnection } from '../types';

interface ConnectionCardProps {
  connection: TelegramConnection;
  onPause: (id: string) => Promise<void>;
  onResume: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onOpenLogs: (conn: TelegramConnection) => void;
  onOpenMessages: (conn: TelegramConnection) => void;
  onOpenSettings: (conn: TelegramConnection) => void;
  onSendTest: (id: string) => Promise<void>;
  onManualSync: (id: string) => Promise<void>;
}

export const ConnectionCard: React.FC<ConnectionCardProps> = ({
  connection,
  onPause,
  onResume,
  onDelete,
  onOpenLogs,
  onOpenMessages,
  onOpenSettings,
  onSendTest,
  onManualSync,
}) => {
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [testSentSuccess, setTestSentSuccess] = useState(false);

  const handlePause = async () => {
    setIsActionLoading(true);
    try {
      await onPause(connection.id);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleResume = async () => {
    setIsActionLoading(true);
    try {
      await onResume(connection.id);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm(`آیا از حذف اتصال بین ${connection.sourceChannel} و ${connection.targetChannel} اطمینان دارید؟`)) {
      setIsActionLoading(true);
      try {
        await onDelete(connection.id);
      } finally {
        setIsActionLoading(false);
      }
    }
  };

  const handleTest = async () => {
    setIsActionLoading(true);
    try {
      await onSendTest(connection.id);
      setTestSentSuccess(true);
      setTimeout(() => setTestSentSuccess(false), 3000);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleSync = async () => {
    setIsActionLoading(true);
    try {
      await onManualSync(connection.id);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Format Persian Date
  const formatPersianDate = (isoString: string | null) => {
    if (!isoString) return 'هنوز پیامی دریافت نشده';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + 
             ' - ' + 
             d.toLocaleDateString('fa-IR');
    } catch {
      return isoString;
    }
  };

  const rulesCount = connection.settings?.replacements?.length || 0;
  const hasCustomSettings = rulesCount > 0 || !!connection.settings?.appendFooter || !!connection.settings?.prependHeader || !!connection.settings?.removeLinks || !!connection.settings?.removeUsernames;
  const isBaleActive = connection.enableBale || connection.settings?.enableBale;
  const baleTarget = connection.baleTargetChannel || connection.settings?.baleTargetChannel;

  const isXActive = connection.enableX || connection.settings?.enableX;
  const xHandles = connection.xTargetHandles || connection.settings?.xTargetHandles;

  const isWebActive = connection.enableWeb || connection.settings?.enableWeb;
  const webTarget = connection.webTargetUrl || connection.settings?.webTargetUrl;

  const isTwitterSource = connection.sourceType === 'twitter' || connection.sourceChannel.toLowerCase().includes('x.com') || connection.sourceChannel.toLowerCase().includes('twitter.com');
  const isWebsiteSource = connection.sourceType === 'website' || connection.sourceChannel.startsWith('http');

  return (
    <div className="neu-flat p-6 border border-white/5 transition-all hover:border-yellow-400/20 rounded-3xl">
      
      {/* Top Header Row: Source -> Target & Status */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/5">
        
        {/* Source and Target Bridge */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="neu-inset px-3 py-1.5 flex items-center gap-2 text-sm font-bold text-white">
            <span className="w-2 h-2 rounded-full bg-yellow-400 animate-ping"></span>
            {isTwitterSource ? (
              <span className="flex items-center gap-1.5 text-sky-400">
                <Twitter className="w-4 h-4 shrink-0" />
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-bold">𝕏 ایکس</span>
              </span>
            ) : isWebsiteSource ? (
              <span className="flex items-center gap-1.5 text-purple-400">
                <Globe className="w-4 h-4 shrink-0" />
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold">🌐 وب‌سایت</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-blue-400">
                <Send className="w-4 h-4 shrink-0" />
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold">✈️ تلگرام</span>
              </span>
            )}
            <span className="dir-ltr text-right text-yellow-400">{connection.sourceChannel}</span>
          </div>

          <ArrowLeft className="w-5 h-5 text-blue-400 shrink-0" />

          <div className="neu-inset px-3 py-1.5 flex items-center gap-2 text-sm font-bold text-white">
            <Bot className="w-4 h-4 text-blue-400" />
            <span className="dir-ltr text-right text-blue-400">{connection.targetChannel}</span>
          </div>
        </div>

        {/* Status Badge & Settings Indicator */}
        <div className="flex items-center gap-2 flex-wrap">
          {isBaleActive && (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 shadow-sm" title={`ارسال همزمان به کانال بله (${baleTarget})`}>
              <span className="text-emerald-400 font-extrabold">🇮🇷 بله:</span>
              <span className="dir-ltr">{baleTarget || 'فعال'}</span>
              {(connection.baleReplaceId || connection.settings?.baleReplaceId) && (
                <span className="text-[10px] text-emerald-400/80 dir-ltr">(جایگزین: {connection.baleReplaceId || connection.settings?.baleReplaceId})</span>
              )}
            </span>
          )}

          {isXActive && (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-sky-500/10 text-sky-300 border border-sky-500/30 flex items-center gap-1.5 shadow-sm" title={`ارسال همزمان به پیج‌های ایکس (${xHandles})`}>
              <Twitter className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-sky-400 font-extrabold">𝕏 ایکس:</span>
              <span className="dir-ltr truncate max-w-[140px]">{xHandles || 'فعال'}</span>
            </span>
          )}

          {isWebActive && (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-500/10 text-purple-300 border border-purple-500/30 flex items-center gap-1.5 shadow-sm" title={`اتصال به وب‌سایت (${webTarget})`}>
              <Globe className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-purple-400 font-extrabold">🌐 سایت:</span>
              <span className="dir-ltr truncate max-w-[120px]">{webTarget || 'فعال'}</span>
            </span>
          )}

          {!isTwitterSource && !isWebsiteSource && (
            connection.settings?.preventDuplicates !== false ? (
              <button
                onClick={() => onOpenSettings(connection)}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                  connection.settings?.duplicateAction === 'delete_existing'
                    ? 'bg-rose-500/10 text-rose-300 border border-rose-500/30 hover:bg-rose-500/20'
                    : 'bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20'
                }`}
                title={
                  connection.settings?.duplicateAction === 'delete_existing'
                    ? "سیستم جایگزینی خودکار پست‌های تکراری با آستانه " + (connection.settings?.duplicateSimilarityThreshold ?? 80) + "% فعال است"
                    : "سیستم هوشمند جلوگیری از ارسال پست‌های تکراری با آستانه " + (connection.settings?.duplicateSimilarityThreshold ?? 80) + "% فعال است"
                }
              >
                <CopyCheck className={`w-3.5 h-3.5 ${connection.settings?.duplicateAction === 'delete_existing' ? 'text-rose-400' : 'text-amber-400'}`} />
                <span>
                  {connection.settings?.duplicateAction === 'delete_existing' ? 'ضد تکرار و جایگزینی (' : 'ضد تکرار فعال ('}
                  {(connection.settings?.duplicateSimilarityThreshold ?? 80).toLocaleString('fa-IR')}٪)
                </span>
              </button>
            ) : (
              <button
                onClick={() => onOpenSettings(connection)}
                className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800/80 text-slate-400 border border-slate-700/60 flex items-center gap-1 hover:bg-slate-700/50 transition-colors cursor-pointer"
                title="سیستم جلوگیری از پست‌های تکراری غیرفعال است"
              >
                <CopyCheck className="w-3.5 h-3.5 text-slate-500" />
                <span>ضد تکرار غیرفعال</span>
              </button>
            )
          )}

          {hasCustomSettings && (
            <button
              onClick={() => onOpenSettings(connection)}
              className="px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-400/10 text-yellow-400 border border-yellow-400/30 flex items-center gap-1 hover:bg-yellow-400/20 transition-colors"
              title="تنظیمات پیشرفته برای این اتصال فعال است"
            >
              <Replace className="w-3.5 h-3.5" />
              <span>تنظیمات پیشرفته ({rulesCount} قانون)</span>
            </button>
          )}

          {connection.status === 'active' && (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              وضعیت: فعال
            </span>
          )}

          {connection.status === 'paused' && (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1.5">
              <Pause className="w-3.5 h-3.5" />
              وضعیت: متوقف شده
            </span>
          )}

          {connection.status === 'error' && (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/30 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              وضعیت: دارای خطا
            </span>
          )}

          {connection.botName && (
            <span className="hidden sm:inline-block text-xs neu-pill px-3 py-1 text-slate-400 font-mono">
              {connection.botName}
            </span>
          )}
        </div>

      </div>

      {/* Info Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 my-5">
        
        {/* Last Message Time */}
        <div className="neu-inset p-3.5 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 neu-inset">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">زمان آخرین دریافت پیام</div>
            <div className="text-xs font-bold text-white mt-1">
              {formatPersianDate(connection.lastMessageTime)}
            </div>
          </div>
        </div>

        {/* Transferred Messages Counter */}
        <div className="neu-inset p-3.5 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-yellow-400/10 text-yellow-400 neu-inset">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">تعداد پیام‌های منتقل‌شده</div>
            <div className="text-base font-black text-yellow-400 mt-0.5">
              {connection.transferredCount.toLocaleString('fa-IR')} <span className="text-xs text-slate-400 font-normal">پست</span>
            </div>
          </div>
        </div>

        {/* Last Message ID / Source Title */}
        <div className="neu-inset p-3.5 flex items-center gap-3 sm:col-span-2 lg:col-span-1">
          <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 neu-inset">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">آخرین ID پیام / عنوان کانال</div>
            <div className="text-xs font-bold text-white mt-1 flex items-center gap-2">
              <span>{connection.sourceTitle || connection.sourceChannel}</span>
              {connection.lastMessageId && (
                <span className="text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded font-mono text-[11px]">
                  #{connection.lastMessageId}
                </span>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Multi-Channel Destinations Breakdown Box */}
      <div className="mb-4 p-3.5 rounded-2xl neu-inset bg-slate-900/60 border border-white/5 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
            <Layers className="w-4 h-4 text-yellow-400" />
            <span>کانال‌ها و مقصد‌های متصل به این مانیتورینگ:</span>
          </div>
          <button
            onClick={() => onOpenSettings(connection)}
            className="text-[11px] text-yellow-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>+ ویرایش مقاصد</span>
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs">
          {/* Telegram Destination */}
          <div className="px-2.5 py-1 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300 flex items-center gap-1.5 font-mono">
            <Bot className="w-3.5 h-3.5 text-blue-400" />
            <span>تلگرام:</span>
            <span className="font-bold text-white">{connection.targetChannel}</span>
          </div>

          {/* Bale Destination */}
          {isBaleActive && (
            <div className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center gap-1.5 font-mono">
              <span className="text-emerald-400 font-extrabold">🇮🇷 بله:</span>
              <span className="font-bold text-white">{baleTarget || 'فعال'}</span>
            </div>
          )}

          {/* X (Twitter) Destinations */}
          {isXActive && xHandles && (
            xHandles.split(',').map((h, idx) => {
              const handleClean = h.trim();
              if (!handleClean) return null;
              return (
                <div key={idx} className="px-2.5 py-1 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-300 flex items-center gap-1.5 font-mono">
                  <Twitter className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span>ایکس 𝕏:</span>
                  <span className="font-bold text-white dir-ltr">{handleClean}</span>
                </div>
              );
            })
          )}

          {/* Web Destination */}
          {isWebActive && webTarget && (
            <div className="px-2.5 py-1 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-300 flex items-center gap-1.5 font-mono">
              <Globe className="w-3.5 h-3.5 text-purple-400" />
              <span>وب‌سایت:</span>
              <span className="font-bold text-white dir-ltr truncate max-w-[200px]">{webTarget}</span>
            </div>
          )}
        </div>
      </div>

      {/* Error Message if any */}
      {connection.lastError && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{connection.lastError}</span>
        </div>
      )}

      {/* Action Buttons Row */}
      <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/5 flex-wrap">
        
        {/* Left Side Actions: Pause / Resume & Delete */}
        <div className="flex items-center gap-2 flex-wrap">
          {connection.status === 'active' ? (
            <button
              onClick={handlePause}
              disabled={isActionLoading}
              className="neu-btn-secondary px-4 py-2 text-xs font-bold flex items-center gap-2 text-amber-400 hover:text-amber-300"
              title="توقف موقت مانیتورینگ کانال"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>توقف</span>
            </button>
          ) : (
            <button
              onClick={handleResume}
              disabled={isActionLoading}
              className="neu-btn-primary px-4 py-2 text-xs font-bold flex items-center gap-2"
              title="شروع مجدد مانیتورینگ"
            >
              <Play className="w-3.5 h-3.5 fill-black" />
              <span>شروع مجدد</span>
            </button>
          )}

          <button
            onClick={() => onOpenSettings(connection)}
            className="neu-btn-secondary px-3.5 py-2 text-xs font-bold flex items-center gap-2 text-yellow-400 hover:text-yellow-300 border border-yellow-400/20"
            title="تنظیمات پیشرفته و فیلترها"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>تنظیمات پیشرفته</span>
          </button>

          <button
            onClick={handleDelete}
            disabled={isActionLoading}
            className="neu-btn-danger px-3.5 py-2 text-xs font-bold flex items-center gap-2"
            title="حذف کامل این اتصال"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>حذف</span>
          </button>
        </div>

        {/* Right Side Tools: Logs, Messages Preview, Sync, Test */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => onOpenLogs(connection)}
            className="neu-btn-secondary px-3 py-2 text-xs font-medium flex items-center gap-1.5 text-slate-300"
            title="مشاهده لاگ‌های سیستم"
          >
            <FileText className="w-3.5 h-3.5 text-yellow-400" />
            <span>لاگ‌ها</span>
          </button>

          <button
            onClick={() => onOpenMessages(connection)}
            className="neu-btn-secondary px-3 py-2 text-xs font-medium flex items-center gap-1.5 text-slate-300"
            title="مشاهده پیام‌های منتقل‌شده"
          >
            <List className="w-3.5 h-3.5 text-blue-400" />
            <span>پیام‌ها</span>
          </button>

          <button
            onClick={handleSync}
            disabled={isActionLoading}
            className="neu-btn-secondary px-3 py-2 text-xs font-medium flex items-center gap-1.5 text-slate-300"
            title="بررسی فوری پست‌های جدید"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isActionLoading ? 'animate-spin' : ''}`} />
            <span>بررسی آنلاین</span>
          </button>

          <button
            onClick={handleTest}
            disabled={isActionLoading}
            className="neu-btn-secondary px-3 py-2 text-xs font-medium flex items-center gap-1.5 text-yellow-400 hover:text-yellow-300"
            title="ارسال پیام تست به کانال مقصد"
          >
            {testSentSuccess ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">ارسال شد</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>تست ارسال</span>
              </>
            )}
          </button>
        </div>

      </div>

    </div>
  );
};
