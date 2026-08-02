import React, { useState } from 'react';
import { Send, Loader2, AlertCircle, Bot, CheckCircle2, Crown, Sparkles, SlidersHorizontal, Lock, Zap, Link as LinkIcon, AtSign } from 'lucide-react';
import { CreateConnectionDTO, User } from '../types';
import { testBaleBot } from '../services/api';

interface CreateConnectionFormProps {
  onSubmit: (dto: CreateConnectionDTO) => Promise<void>;
  isLoading: boolean;
  currentUser?: User | null;
  onOpenSubscriptions?: () => void;
  onOpenAiSettings?: () => void;
}

export const CreateConnectionForm: React.FC<CreateConnectionFormProps> = ({
  onSubmit,
  isLoading,
  currentUser,
  onOpenSubscriptions,
}) => {
  const isSubscribed = currentUser?.role === 'admin' || (currentUser?.plan !== 'free' && currentUser?.subscriptionStatus === 'active');

  const [sourceChannel, setSourceChannel] = useState('');
  const [targetChannel, setTargetChannel] = useState('');
  const [botToken, setBotToken] = useState('');

  // Bale Integration State
  const [enableBale, setEnableBale] = useState(false);
  const [baleTargetChannel, setBaleTargetChannel] = useState('');
  const [baleBotToken, setBaleBotToken] = useState('');
  const [baleReplaceId, setBaleReplaceId] = useState('');
  const [testingBale, setTestingBale] = useState(false);
  const [baleStatusMsg, setBaleStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [error, setError] = useState<string | null>(null);

  const handleTestBale = async () => {
    if (!baleBotToken.trim() || !baleTargetChannel.trim()) {
      setBaleStatusMsg({ type: 'error', text: 'لطفاً ابتدا توکن ربات بله و آیدی کانال بله را وارد کنید.' });
      return;
    }

    setTestingBale(true);
    setBaleStatusMsg(null);
    try {
      const res = await testBaleBot(baleBotToken.trim(), baleTargetChannel.trim());
      setBaleStatusMsg({ type: 'success', text: res.message });
    } catch (err: any) {
      setBaleStatusMsg({ type: 'error', text: err.message || 'خطا در تست اتصال ربات بله.' });
    } finally {
      setTestingBale(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!sourceChannel.trim()) {
      setError('لطفاً فیلد کانال مبدأ تلگرام را وارد کنید.');
      return;
    }
    if (!targetChannel.trim()) {
      setError('لطفاً فیلد کانال مقصد تلگرام را وارد کنید.');
      return;
    }
    if (!botToken.trim()) {
      setError('لطفاً توکن ربات تلگرام را وارد کنید.');
      return;
    }

    if (enableBale) {
      if (!baleTargetChannel.trim()) {
        setError('لطفاً آیدی کانال مقصد در بله را وارد کنید.');
        return;
      }
      if (!baleBotToken.trim()) {
        setError('لطفاً توکن ربات بله را وارد کنید.');
        return;
      }
    }

    try {
      await onSubmit({
        sourceType: 'telegram',
        sourceChannel: sourceChannel.trim(),
        targetChannel: targetChannel.trim(),
        botToken: botToken.trim(),
        enableBale,
        baleTargetChannel: enableBale ? baleTargetChannel.trim() : undefined,
        baleBotToken: enableBale ? baleBotToken.trim() : undefined,
        baleReplaceId: enableBale && baleReplaceId.trim() ? baleReplaceId.trim() : undefined,
      });
      // Clear fields upon success
      setSourceChannel('');
      setTargetChannel('');
      setBotToken('');
      setEnableBale(false);
      setBaleTargetChannel('');
      setBaleBotToken('');
      setBaleReplaceId('');
      setBaleStatusMsg(null);
    } catch (err: any) {
      setError(err.message || 'خطا در ثبت و برقراری اتصال');
    }
  };

  return (
    <div className="w-full mb-6">
      <div className="neu-flat p-5 md:p-6 border border-white/10 relative overflow-hidden rounded-2xl bg-[#111C2F]/80 backdrop-blur-xl shadow-2xl">
        
        {/* Subtle Cyber Neon Accents */}
        <div className="absolute top-0 left-1/4 w-64 h-32 bg-sky-500/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Form Title */}
        <div className="flex items-center justify-between gap-3 mb-5 pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
              <Zap className="w-5 h-5 fill-sky-400/20" />
            </div>
            <div>
              <h2 className="text-sm md:text-base font-black text-white">
                ساخت اتصال جدید و انتقال خودکار
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                کانال مبدأ، کانال مقصد و توکن ربات مدیریت خود را ثبت کنید
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* Error Banner */}
          {error && (
            <div className="p-3.5 rounded-xl bg-red-500/15 border border-red-500/40 text-red-200 text-xs flex items-center gap-2.5 animate-shake">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 3 Main Connection Fields matching Image 2 & Image 3 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Field 1: Source Channel */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-sky-400" />
                <span>کانال مبدأ (تلگرام)</span>
              </label>
              <div className="relative flex items-center bg-[#0B1220] border border-white/10 rounded-xl focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/20 transition-all">
                <input
                  type="text"
                  value={sourceChannel}
                  onChange={(e) => setSourceChannel(e.target.value)}
                  placeholder="مثال: channel_source@"
                  className="w-full bg-transparent px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none dir-ltr text-right"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Field 2: Target Channel */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <LinkIcon className="w-3.5 h-3.5 text-purple-400" />
                <span>کانال مقصد (تلگرام)</span>
              </label>
              <div className="relative flex items-center bg-[#0B1220] border border-white/10 rounded-xl focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/20 transition-all">
                <input
                  type="text"
                  value={targetChannel}
                  onChange={(e) => setTargetChannel(e.target.value)}
                  placeholder="مثال: channel_target@"
                  className="w-full bg-transparent px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none dir-ltr text-right"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Field 3: Bot Token */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <AtSign className="w-3.5 h-3.5 text-emerald-400" />
                <span>توکن ربات تلگرام</span>
              </label>
              <div className="relative flex items-center bg-[#0B1220] border border-white/10 rounded-xl focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/20 transition-all">
                <input
                  type="text"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder="123456789:ABCdefGHIjkl..."
                  className="w-full bg-transparent px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none dir-ltr text-left font-mono"
                  disabled={isLoading}
                />
              </div>
            </div>

          </div>

          {/* Dual Forwarding to Bale Section */}
          <div className="p-4 rounded-xl bg-[#0B1220]/60 border border-emerald-500/20 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={enableBale}
                  onChange={(e) => {
                    if (!isSubscribed && e.target.checked) {
                      setError('قابلیت ارسال همزمان به پیام‌رسان بله مخصوص مشترکین پرو (PRO) و ویژه (VIP) است. لطفاً ابتدا اشتراک خود را ارتقا دهید.');
                    } else {
                      setError(null);
                    }
                    setEnableBale(e.target.checked);
                  }}
                  className="w-4 h-4 rounded text-sky-500 focus:ring-sky-400 bg-slate-900 border-white/20 cursor-pointer"
                />
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-emerald-300">ارسال همزمان پیام‌ها به بله (ایران) 🇮🇷</span>
                  {isSubscribed ? (
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-extrabold border border-emerald-500/30">
                      پرو / VIP
                    </span>
                  ) : (
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 font-extrabold border border-amber-500/30 flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5 text-amber-400" />
                      <span>ویژه مشترکین</span>
                    </span>
                  )}
                </div>
              </label>

              {!isSubscribed && onOpenSubscriptions && (
                <button
                  type="button"
                  onClick={onOpenSubscriptions}
                  className="px-2.5 py-1 bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[11px] font-bold rounded-lg hover:bg-amber-500/30 transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Crown className="w-3 h-3 text-amber-400" />
                  <span>ارتقا به PRO</span>
                </button>
              )}
            </div>

            {enableBale && (
              <div className="space-y-3 pt-3 border-t border-white/10 animate-fadeIn">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-300">کانال مقصد بله</label>
                    <input
                      type="text"
                      value={baleTargetChannel}
                      onChange={(e) => setBaleTargetChannel(e.target.value)}
                      placeholder="my_bale_channel@"
                      className="w-full bg-[#0B1220] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none dir-ltr text-right"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-300">جایگزین آیدی بله</label>
                    <input
                      type="text"
                      value={baleReplaceId}
                      onChange={(e) => setBaleReplaceId(e.target.value)}
                      placeholder="my_bale_id@"
                      className="w-full bg-[#0B1220] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none dir-ltr text-right"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-300">توکن ربات بله</label>
                    <input
                      type="text"
                      value={baleBotToken}
                      onChange={(e) => setBaleBotToken(e.target.value)}
                      placeholder="123456789:ABC..."
                      className="w-full bg-[#0B1220] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none dir-ltr text-left font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleTestBale}
                    disabled={testingBale}
                    className="px-3 py-1.5 bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {testingBale ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5 text-emerald-400" />}
                    <span>تست ربات بله</span>
                  </button>

                  {baleStatusMsg && (
                    <span className={`text-xs font-bold ${baleStatusMsg.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {baleStatusMsg.text}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Submit Button matching Telegram Blue #229ED9 in Image 2 & Image 3 */}
          <div className="pt-1 flex justify-center">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-8 rounded-xl bg-gradient-to-r from-[#229ED9] to-[#0088CC] hover:from-[#0088CC] hover:to-[#0077B5] text-white font-black text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-sky-500/30 hover:shadow-sky-500/40 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>در حال راه اندازی اتصال...</span>
                </>
              ) : (
                <>
                  <span>شروع اتصال خودکار</span>
                  <Send className="w-4 h-4 text-white transform -rotate-12" />
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

