import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  X, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  ShieldAlert, 
  Megaphone, 
  Trash2, 
  Check, 
  Send, 
  RefreshCw,
  Sparkles,
  Bot
} from 'lucide-react';
import { TelegramConnection, User, BroadcastMessage } from '../types';
import { fetchUserNotifications } from '../services/api';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  connections: TelegramConnection[];
  currentUser: User | null;
}

export interface NotificationItem {
  id: string;
  type: 'error' | 'admin' | 'info' | 'success' | 'warning';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  source?: string;
  isImportant?: boolean;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  connections,
  currentUser,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'errors' | 'admin'>('all');
  const [loading, setLoading] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const serverBroadcasts = await fetchUserNotifications(currentUser?.token);
      
      const mappedBroadcasts: NotificationItem[] = serverBroadcasts.map((b) => ({
        id: b.id,
        type: b.type,
        title: b.title,
        message: b.message,
        timestamp: new Date(b.createdAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }) + ' - ' + new Date(b.createdAt).toLocaleDateString('fa-IR'),
        read: false,
        source: `${b.senderName} (${b.senderRole || 'مدیریت'})`,
        isImportant: b.isImportant,
      }));

      const connectionErrors: NotificationItem[] = connections
        .filter((c) => c.status === 'error' || c.lastError)
        .map((c) => ({
          id: `err-${c.id}`,
          type: 'error' as const,
          title: `خطا در اتصال: ${c.sourceChannel} ← ${c.targetChannel}`,
          message: c.lastError || 'ارتباط با ربات تلگرام قطع شده است. لطفا توکن ربات و دسترسی ادمین را بررسی نمایید.',
          timestamp: c.lastMessageTime ? new Date(c.lastMessageTime).toLocaleTimeString('fa-IR') : 'امروز',
          read: false,
          source: `کانال: ${c.sourceChannel}`,
        }));

      setNotifications([...mappedBroadcasts, ...connectionErrors]);
    } catch (err) {
      // Fallback if fetch fails
      setNotifications([
        {
          id: 'admin-1',
          type: 'admin',
          title: 'پیام مدیریت سیستم',
          message: 'نسخه جدید سامانه AUTO RUN فعال شد. الگوریتم‌های هوش مصنوعی و مانیتورینگ خودکار به‌روزرسانی شدند.',
          timestamp: '۱۰ دقیقه پیش',
          read: false,
          source: 'مدیریت کل',
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen, connections.length, currentUser?.id]);

  if (!isOpen) return null;

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleClearAll = () => {
    setNotifications([]);
  };

  const handleDeleteItem = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const filteredNotifications = notifications.filter((item) => {
    if (activeTab === 'errors') return item.type === 'error';
    if (activeTab === 'admin') return item.type === 'admin' || item.type === 'info';
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div 
        className="relative w-full max-w-2xl bg-[#0B1220] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] dir-rtl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 md:p-5 border-b border-white/10 bg-[#111C2F]/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white">اعلا‌ن‌ها و اطلاعیه‌ها</h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30 text-[10px] font-bold">
                    {unreadCount} خوانده نشده
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                لیست خطاهای سیستم و پیام‌های ارسال‌شده توسط مدیریت
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800/80 text-slate-400 hover:text-white border border-white/10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Filters & Action Bar */}
        <div className="px-4 pt-3 pb-2 border-b border-white/10 bg-[#111C2F]/50 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 bg-[#0B1220] p-1 rounded-xl border border-white/10">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'all'
                  ? 'bg-sky-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              همه ({notifications.length})
            </button>
            <button
              onClick={() => setActiveTab('errors')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                activeTab === 'errors'
                  ? 'bg-red-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-red-400'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>خطاها ({notifications.filter((n) => n.type === 'error').length})</span>
            </button>
            <button
              onClick={() => setActiveTab('admin')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                activeTab === 'admin'
                  ? 'bg-purple-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-purple-400'
              }`}
            >
              <Megaphone className="w-3.5 h-3.5" />
              <span>پیام مدیریت ({notifications.filter((n) => n.type === 'admin' || n.type === 'info').length})</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[11px] font-bold text-sky-400 hover:text-sky-300 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500/10 border border-sky-500/20 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>علامت‌گذاری به عنوان خوانده‌شده</span>
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={handleClearAll}
                className="text-[11px] font-bold text-slate-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-800 cursor-pointer"
                title="پاکسازی همه"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Notifications List */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1 scrollbar-thin">
          {filteredNotifications.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-3">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-800/60 border border-white/10 flex items-center justify-center text-slate-500">
                <Bell className="w-7 h-7" />
              </div>
              <p className="text-xs font-bold text-slate-300">هیچ اعلانی در این بخش وجود ندارد</p>
              <p className="text-[11px] text-slate-500">پیام‌های خطا و اطلاعیه‌های مدیریت به محض انتشار در اینجا قرار می‌گیرند.</p>
            </div>
          ) : (
            filteredNotifications.map((item) => (
              <div
                key={item.id}
                className={`p-3.5 rounded-xl border transition-all flex items-start gap-3 ${
                  item.type === 'error'
                    ? 'bg-red-500/10 border-red-500/30 text-red-200'
                    : item.type === 'warning'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                    : item.type === 'admin'
                    ? 'bg-purple-500/10 border-purple-500/30 text-purple-200'
                    : 'bg-[#111C2F] border-white/10 text-slate-200'
                } ${!item.read ? 'ring-1 ring-sky-500/50' : 'opacity-90'}`}
              >
                {/* Notification Type Icon */}
                <div className="shrink-0 mt-0.5">
                  {item.type === 'error' ? (
                    <div className="p-2 rounded-lg bg-red-500/20 text-red-400 border border-red-500/40">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                  ) : item.type === 'warning' ? (
                    <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40">
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                  ) : item.type === 'admin' ? (
                    <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/40">
                      <Megaphone className="w-4 h-4" />
                    </div>
                  ) : (
                    <div className="p-2 rounded-lg bg-sky-500/20 text-sky-400 border border-sky-500/40">
                      <Info className="w-4 h-4" />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="text-xs font-black text-white truncate">{item.title}</h4>
                      {item.isImportant && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-red-500 text-white font-bold animate-pulse">
                          مهم
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0 dir-rtl">{item.timestamp}</span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed break-words">{item.message}</p>

                  {item.source && (
                    <div className="mt-2 text-[10px] text-slate-400 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                      <span>منبع: <strong className="text-slate-200">{item.source}</strong></span>
                    </div>
                  )}
                </div>

                {/* Single Delete button */}
                <button
                  onClick={() => handleDeleteItem(item.id)}
                  className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-colors cursor-pointer"
                  title="حذف این اعلان"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-white/10 bg-[#111C2F]/80 flex justify-between items-center text-xs">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>سیستم مانیتورینگ خودکار فعال است</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-white/10 cursor-pointer"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  );
};
