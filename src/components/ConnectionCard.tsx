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
    <div className="neu-flat p-5 md:p-6 border border-white/10 transition-all duration-300 hover:border-sky-500/40 hover:shadow-2xl hover:shadow-sky-500/10 rounded-2xl bg-[#111C2F]/80 backdrop-blur-xl">
      
      {/* Top Header Row: Source -> Target & Status */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
        
        {/* Source and Target Bridge */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="bg-[#0B1220] border border-white/10 px-3 py-1.5 rounded-xl flex items-center gap-2 text-xs font-bold text-white shadow-inner">
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping"></span>
            {isTwitterSource ? (
              <span className="flex items-center gap-1 text-sky-400">
                <Twitter className="w-3.5 h-3.5 shrink-0" />
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 font-extrabold">𝕏 ایکس</span>
              </span>
            ) : isWebsiteSource ? (
              <span className="flex items-center gap-1 text-purple-400">
                <Globe className="w-3.5 h-3.5 shrink-0" />
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-extrabold">🌐 وب</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-blue-400">
                <Send className="w-3.5 h-3.5 shrink-0" />
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 font-extrabold">✈️ تلگرام</span>
              </span>
            )}
            <span className="dir-ltr text-right text-sky-300">{connection.sourceChannel}</span>
          </div>

          <ArrowLeft className="w-4 h-4 text-sky-400 shrink-0" />

          <div className="bg-[#0B1220] border border-white/10 px-3 py-1.5 rounded-xl flex items-center gap-2 text-xs font-bold text-white shadow-inner">
            <Bot className="w-3.5 h-3.5 text-sky-400" />
            <span className="dir-ltr text-right text-sky-400">{connection.targetChannel}</span>
          </div>
        </div>

        {/* Status Badge & Settings Indicator */}
        <div className="flex items-center gap-2 flex-wrap">
          {isBaleActive && (
            <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 flex items-center gap-1" title={`ارسال به بله (${baleTarget})`}>
              <span className="text-emerald-400">🇮🇷 بله:</span>
              <span className="dir-ltr">{baleTarget || 'فعال'}</span>
            </span>
          )}

          {isXActive && (
            <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-sky-500/10 text-sky-300 border border-sky-500/30 flex items-center gap-1" title={`ارسال به ایکس (${xHandles})`}>
              <Twitter className="w-3 h-3 text-sky-400" />
              <span>𝕏: {xHandles || 'فعال'}</span>
            </span>
          )}

          {connection.status === 'active' && (
            <span className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              فعال
            </span>
          )}

          {connection.status === 'paused' && (
            <span className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1.5">
              <Pause className="w-3 h-3" />
              متوقف
            </span>
          )}

          {connection.status === 'error' && (
            <span className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-red-500/15 text-red-400 border border-red-500/30 flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3" />
              خطا
            </span>
          )}
        </div>

      </div>

      {/* Info Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 my-4">
        
        {/* Last Message Time */}
        <div className="bg-[#0B1220]/70 border border-white/5 p-3 rounded-xl flex items-center gap-3">
          <div className="p-2 rounded-lg bg-sky-500/15 text-sky-400 border border-sky-500/20">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-slate-400 font-bold">زمان آخرین پیام</div>
            <div className="text-xs font-bold text-white mt-0.5">
              {formatPersianDate(connection.lastMessageTime)}
            </div>
          </div>
        </div>

        {/* Transferred Messages Counter */}
        <div className="bg-[#0B1220]/70 border border-white/5 p-3 rounded-xl flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-slate-400 font-bold">تعداد پیام‌های منتقل‌شده</div>
            <div className="text-sm font-black text-emerald-400 mt-0.5">
              {connection.transferredCount.toLocaleString('fa-IR')} <span className="text-[10px] text-slate-400 font-normal">پست</span>
            </div>
          </div>
        </div>

        {/* Last Message ID / Source Title */}
        <div className="bg-[#0B1220]/70 border border-white/5 p-3 rounded-xl flex items-center gap-3 sm:col-span-2 lg:col-span-1">
          <div className="p-2 rounded-lg bg-purple-500/15 text-purple-400 border border-purple-500/20">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-slate-400 font-bold">عنوان کانال مبدأ</div>
            <div className="text-xs font-bold text-white mt-0.5 flex items-center gap-2">
              <span className="truncate max-w-[130px]">{connection.sourceTitle || connection.sourceChannel}</span>
              {connection.lastMessageId && (
                <span className="text-slate-400 bg-slate-800 px-1.5 py-0.2 rounded font-mono text-[10px]">
                  #{connection.lastMessageId}
                </span>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Error Message if any */}
      {connection.lastError && (
        <div className="mb-3 p-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-200 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{connection.lastError}</span>
        </div>
      )}

      {/* Action Buttons Row */}
      <div className="flex items-center justify-between gap-2 pt-3 border-t border-white/10 flex-wrap">
        
        {/* Left Side Actions: Pause / Resume & Delete */}
        <div className="flex items-center gap-2 flex-wrap">
          {connection.status === 'active' ? (
            <button
              onClick={handlePause}
              disabled={isActionLoading}
              className="px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              title="توقف موقت"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>توقف</span>
            </button>
          ) : (
            <button
              onClick={handleResume}
              disabled={isActionLoading}
              className="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              title="شروع مجدد"
            >
              <Play className="w-3.5 h-3.5 fill-emerald-300" />
              <span>ادامه</span>
            </button>
          )}

          <button
            onClick={() => onOpenSettings(connection)}
            className="px-3 py-1.5 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-300 hover:bg-sky-500/25 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            title="تنظیمات پیشرفته"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>تنظیمات</span>
          </button>

          <button
            onClick={handleDelete}
            disabled={isActionLoading}
            className="px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 hover:bg-red-500/25 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            title="حذف اتصال"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>حذف</span>
          </button>
        </div>

        {/* Right Side Tools: Logs, Messages Preview, Sync, Test */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => onOpenLogs(connection)}
            className="px-2.5 py-1.5 rounded-lg bg-[#0B1220] border border-white/10 text-slate-300 hover:text-white hover:border-white/20 text-xs font-medium flex items-center gap-1 transition-all cursor-pointer"
            title="لاگ‌ها"
          >
            <FileText className="w-3.5 h-3.5 text-amber-400" />
            <span>لاگ‌ها</span>
          </button>

          <button
            onClick={() => onOpenMessages(connection)}
            className="px-2.5 py-1.5 rounded-lg bg-[#0B1220] border border-white/10 text-slate-300 hover:text-white hover:border-white/20 text-xs font-medium flex items-center gap-1 transition-all cursor-pointer"
            title="پیام‌ها"
          >
            <List className="w-3.5 h-3.5 text-sky-400" />
            <span>پیام‌ها</span>
          </button>

          <button
            onClick={handleSync}
            disabled={isActionLoading}
            className="px-2.5 py-1.5 rounded-lg bg-[#0B1220] border border-white/10 text-slate-300 hover:text-white hover:border-white/20 text-xs font-medium flex items-center gap-1 transition-all cursor-pointer"
            title="همگام‌سازی آنلاین"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isActionLoading ? 'animate-spin' : ''}`} />
            <span>همگام‌سازی</span>
          </button>

          <button
            onClick={handleTest}
            disabled={isActionLoading}
            className="px-2.5 py-1.5 rounded-lg bg-[#0B1220] border border-white/10 text-slate-300 hover:text-white hover:border-white/20 text-xs font-medium flex items-center gap-1 transition-all cursor-pointer"
            title="تست ارسال"
          >
            {testSentSuccess ? (
              <span className="text-emerald-400 font-bold">ارسال شد ✓</span>
            ) : (
              <>
                <Send className="w-3.5 h-3.5 text-purple-400" />
                <span>تست</span>
              </>
            )}
          </button>
        </div>

      </div>

    </div>
  );
};
