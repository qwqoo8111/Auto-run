import React, { useEffect, useState } from 'react';
import { 
  X, Bot, ShieldCheck, CheckCircle2, RefreshCw, Key, ShieldAlert, Activity, Save, Sparkles, Layers, Globe
} from 'lucide-react';
import { GlobalSupervisorConfig, TelegramConnection } from '../types';
import { 
  fetchGlobalSupervisorConfig, 
  updateGlobalSupervisorConfig, 
  testGlobalSupervisorBot, 
  scanGlobalSupervisorChannels 
} from '../services/api';

interface GlobalSupervisorModalProps {
  isOpen: boolean;
  onClose: () => void;
  connections: TelegramConnection[];
}

export const GlobalSupervisorModal: React.FC<GlobalSupervisorModalProps> = ({
  isOpen,
  onClose,
  connections,
}) => {
  const [config, setConfig] = useState<GlobalSupervisorConfig>({
    enabled: true,
    botToken: '',
    autoDelete: false,
    scanDepth: 50,
    platform: 'telegram',
  });

  const [stats, setStats] = useState<{
    totalBufferedFingerprints: number;
    monitoredChannelsCount: number;
    lastUpdated: string | null;
    bufferStatus: string;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ ok: boolean; message: string } | null>(null);

  const loadSupervisorData = async () => {
    setLoading(true);
    try {
      const data = await fetchGlobalSupervisorConfig();
      if (data && data.config) {
        setConfig({
          enabled: data.config.enabled !== undefined ? !!data.config.enabled : true,
          botToken: data.config.botToken || '',
          autoDelete: !!data.config.autoDelete,
          scanDepth: data.config.scanDepth || 50,
          platform: data.config.platform || 'telegram',
        });
      }
      if (data && data.stats) {
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Failed to load global supervisor data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadSupervisorData();
      setTestResult(null);
      setScanResult(null);
      setSavedSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveConfig = async () => {
    setSaving(true);
    setSavedSuccess(false);
    try {
      await updateGlobalSupervisorConfig(config);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    } catch (err: any) {
      alert(err.message || 'خطا در ذخیره تنظیمات ربات ناظر');
    } finally {
      setSaving(false);
    }
  };

  const handleTestBot = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const sampleTarget = connections.length > 0 ? connections[0].targetChannel : '';
      const res = await testGlobalSupervisorBot({
        botToken: config.botToken.trim(),
        targetChannel: sampleTarget,
      });
      setTestResult({ ok: res.ok, message: res.message });
    } catch (err: any) {
      setTestResult({ ok: false, message: err.message || 'خطا در تست ربات ناظر' });
    } finally {
      setTesting(false);
    }
  };

  const handleScanChannels = async () => {
    setScanning(true);
    setScanResult(null);
    try {
      const res = await scanGlobalSupervisorChannels({
        botToken: config.botToken.trim(),
      });
      setScanResult({ ok: res.ok, message: res.message });
      await loadSupervisorData();
    } catch (err: any) {
      setScanResult({ ok: false, message: err.message || 'خطا در اسکن کانال‌های مقصد' });
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-cyan-500/30 rounded-3xl p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto my-auto text-slate-100 font-sans">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Bot className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <span>ربات ناظر سراسری و بازرس کانال‌ها</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  اختیاری / هماهنگ‌کننده
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                تنظیم یک ربات متمرکز جهت بازرسی زنده تمامی کانال‌های مقصد، جلوگیری از انتشار پست تکراری و پاک‌سازی خودکار
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-cyan-400">
            <RefreshCw className="w-8 h-8 animate-spin" />
            <span className="text-xs font-bold">در حال دریافت تنظیمات ناظر سراسری...</span>
          </div>
        ) : (
          <div className="space-y-5">
            
            {/* Enable Toggle & Explanation Box */}
            <div className="p-4 rounded-2xl neu-inset bg-cyan-500/5 border border-cyan-500/20 space-y-3">
              <label className="flex items-center justify-between cursor-pointer select-none">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-5 h-5 text-cyan-400 shrink-0" />
                  <div>
                    <span className="text-sm font-bold text-cyan-200 block">
                      فعال‌سازی سیستم ناظر سراسری (Global Channel Supervisor)
                    </span>
                    <span className="text-xs text-slate-400 block mt-0.5">
                      نظارت هوشمند و خودکار بر تمام پست‌های متنی، تصویری، ویدیویی و آلبوم در کانال‌های مقصد
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={config.enabled}
                  onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                  className="w-5 h-5 rounded accent-cyan-500 cursor-pointer"
                />
              </label>
            </div>

            {config.enabled && (
              <div className="space-y-4 text-xs">
                
                {/* Bot Token Input (Optional) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-200 flex items-center gap-2">
                      <Key className="w-4 h-4 text-cyan-400" />
                      <span>توکن ربات ناظر سراسری (Supervisor Bot Token):</span>
                    </label>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      اختیاری (Optional)
                    </span>
                  </div>
                  <div className="neu-inset p-2.5 rounded-xl border border-white/10 flex items-center gap-2">
                    <input
                      type="password"
                      value={config.botToken}
                      onChange={(e) => setConfig({ ...config, botToken: e.target.value })}
                      placeholder="123456789:ABCdefGHIjklMNOpqrSTUvwxYZ... (اختیاری)"
                      className="w-full bg-transparent text-xs text-cyan-200 font-mono placeholder-slate-500 focus:outline-none dir-ltr text-left"
                    />
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-900/90 border-2 border-cyan-400/80 text-cyan-100 shadow-xl space-y-2">
                    <div className="flex items-center gap-2 font-black text-xs text-cyan-300">
                      <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span>راهنمای کارکرد ناظر سراسری و جلوگبری آنی از انتشار:</span>
                    </div>
                    <p className="text-xs text-blue-400 font-bold leading-relaxed bg-blue-950/60 p-3 rounded-xl border border-blue-400/40">
                      💡 <strong>استفاده از ربات ناظر برای تمام کانال‌ها کاملاً اختیاری است.</strong> اگر می‌خواهید برای تمام کانال‌های مقصد یک ربات ناظر واحد اختصاص دهید، توکن آن را وارد کنید. در غیر این صورت (اگر خالی باشد)، سیستم به طور خودکار از توکن اصلی ربات هر اتصال استفاده خواهد کرد.
                    </p>
                    <div className="pt-2 border-t border-cyan-500/30 text-[11px] text-cyan-200/90 space-y-1">
                      <p>
                        ⚡ <strong>چگونه جلوی ارسال گرفته می‌شود؟</strong> قبل از اینکه پست یا ویدیویی در کانال آپلود شود، اثرانگشت دیجیتال آن در کمتر از ۱ میلی‌ثانیه سنجیده می‌شود. اگر تکراری باشد، <strong>فرایند ارسال کاملاً لغو شده</strong> و حتی برای یک ثانیه هم در کانال قرار نمی‌گیرد.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Test & Scan Action Buttons */}
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={handleTestBot}
                    disabled={testing}
                    className="neu-btn-secondary px-4 py-2.5 text-xs font-bold text-cyan-200 hover:text-white border border-cyan-500/30 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    <ShieldCheck className={`w-4 h-4 text-cyan-400 ${testing ? 'animate-spin' : ''}`} />
                    <span>{testing ? 'در حال تست ربات ناظر...' : 'تست اتصال و دسترسی ادمین ربات ناظر'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleScanChannels}
                    disabled={scanning}
                    className="neu-btn-secondary px-4 py-2.5 text-xs font-bold text-purple-200 hover:text-white border border-purple-500/30 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw className={`w-4 h-4 text-purple-400 ${scanning ? 'animate-spin' : ''}`} />
                    <span>{scanning ? 'در حال اسکن تمام کانال‌ها...' : 'اسکن زنده اثرانگشت تمام کانال‌های مقصد'}</span>
                  </button>
                </div>

                {/* Test Result Message */}
                {testResult && (
                  <div className={`p-3 rounded-xl text-xs font-bold border flex items-start gap-2.5 ${
                    testResult.ok ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-red-500/10 border-red-500/30 text-red-300'
                  }`}>
                    {testResult.ok ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" /> : <ShieldAlert className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />}
                    <span>{testResult.message}</span>
                  </div>
                )}

                {/* Scan Result Message */}
                {scanResult && (
                  <div className={`p-3 rounded-xl text-xs font-bold border flex items-start gap-2.5 ${
                    scanResult.ok ? 'bg-purple-500/10 border-purple-500/30 text-purple-300' : 'bg-red-500/10 border-red-500/30 text-red-300'
                  }`}>
                    {scanResult.ok ? <CheckCircle2 className="w-4 h-4 shrink-0 text-purple-400 mt-0.5" /> : <ShieldAlert className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />}
                    <span>{scanResult.message}</span>
                  </div>
                )}

                {/* Options Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  <label className="neu-inset p-3 rounded-xl border border-white/5 flex items-center justify-between cursor-pointer hover:border-cyan-500/30 transition-all">
                    <div>
                      <span className="font-bold text-white block">حذف خودکار پیام‌های تکراری:</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">پاک‌سازی مستقیم پیام تکراری اگر از قبل ارسال شده باشد</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.autoDelete}
                      onChange={(e) => setConfig({ ...config, autoDelete: e.target.checked })}
                      className="w-4 h-4 accent-cyan-500 cursor-pointer"
                    />
                  </label>

                  <div className="neu-inset p-3 rounded-xl border border-cyan-500/20 bg-cyan-950/20 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-cyan-200 block">بررسی پیشگیرانه در لحظه (Real-Time):</span>
                      <span className="text-[10px] text-emerald-400 block mt-0.5">جلوگیری از آپلود قبل از ارسال به تلگرام (&lt; ۱ms)</span>
                    </div>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-extrabold px-2 py-1 rounded-lg border border-emerald-500/30">
                      فعال و آنلاین
                    </span>
                  </div>
                </div>

                {/* Supervisor Live Stats Panel */}
                {stats && (
                  <div className="p-4 rounded-2xl neu-inset bg-slate-950/80 border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-cyan-300 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
                        <span>آمار زنده ناظر سراسری:</span>
                      </span>
                      <button
                        type="button"
                        onClick={loadSupervisorData}
                        className="text-[11px] font-bold text-slate-300 hover:text-white flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>به‌روزرسانی آمار</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-center">
                      <div className="p-2.5 rounded-xl bg-slate-900 border border-white/5">
                        <span className="text-[10px] text-slate-400 block">اثرانگشت‌های ثبت‌شده</span>
                        <span className="text-sm font-black text-cyan-300">{stats.totalBufferedFingerprints.toLocaleString('fa-IR')}</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-900 border border-white/5">
                        <span className="text-[10px] text-slate-400 block">کانال‌های تحت نظارت</span>
                        <span className="text-sm font-black text-purple-300">{stats.monitoredChannelsCount.toLocaleString('fa-IR')}</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-900 border border-white/5 col-span-2 md:col-span-1">
                        <span className="text-[10px] text-slate-400 block">وضعیت ناظر</span>
                        <span className="text-xs font-bold text-emerald-400">{stats.bufferStatus || 'فعال'}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Save Button */}
            <div className="pt-4 border-t border-white/10 flex items-center justify-between flex-wrap gap-3">
              {savedSuccess ? (
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/30">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>تنظیمات ناظر سراسری با موفقیت ذخیره شد!</span>
                </div>
              ) : (
                <span className="text-[11px] text-slate-400">
                  تغییرات به تمام اتصالات فعال اعمال می‌گردد.
                </span>
              )}

              <div className="flex items-center gap-2 mr-auto">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={handleSaveConfig}
                  disabled={saving}
                  className="neu-btn-primary px-5 py-2 rounded-xl text-xs font-black text-white bg-cyan-600 hover:bg-cyan-500 border border-cyan-400/40 flex items-center gap-2 shadow-lg shadow-cyan-500/20 disabled:opacity-50 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'در حال ذخیره...' : 'ذخیره تنظیمات ناظر سراسری'}</span>
                </button>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
