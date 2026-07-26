import React, { useState } from 'react';
import { Send, Loader2, AlertCircle, Sparkles, Bot, CheckCircle2, Lock, Crown } from 'lucide-react';
import { CreateConnectionDTO, User } from '../types';
import { testBaleBot } from '../services/api';

interface CreateConnectionFormProps {
  onSubmit: (dto: CreateConnectionDTO) => Promise<void>;
  isLoading: boolean;
  currentUser?: User | null;
  onOpenSubscriptions?: () => void;
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
      setError('لطفاً فیلد کانال مبدأ را وارد کنید.');
      return;
    }
    if (!targetChannel.trim()) {
      setError('لطفاً فیلد کانال مقصد را وارد کنید.');
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
    <div className="w-full max-w-5xl mx-auto px-4 mb-8">
      <div className="neu-flat p-6 md:p-8 border border-white/5 relative overflow-hidden rounded-3xl">
        
        {/* Subtle Neumorphic Background Accents */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-400/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Error Banner if any */}
          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-center gap-3 animate-shake">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 3 Required Telegram Fields */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            
            {/* Field 1: Source Channel */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-white pr-1">
                کانال مبدأ (تلگرام)
              </label>
              <div className="neu-inset p-1 flex items-center">
                <input
                  type="text"
                  value={sourceChannel}
                  onChange={(e) => setSourceChannel(e.target.value)}
                  placeholder="مثال: channel_source@"
                  className="w-full bg-transparent px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none text-sm dir-ltr text-right"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Field 2: Target Channel */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-white pr-1">
                کانال مقصد (تلگرام)
              </label>
              <div className="neu-inset p-1 flex items-center">
                <input
                  type="text"
                  value={targetChannel}
                  onChange={(e) => setTargetChannel(e.target.value)}
                  placeholder="مثال: channel_target@"
                  className="w-full bg-transparent px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none text-sm dir-ltr text-right"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Field 3: Bot Token */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-white pr-1">
                توکن ربات تلگرام
              </label>
              <div className="neu-inset p-1 flex items-center">
                <input
                  type="text"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder="123456789:ABCdefGHIjklMNO..."
                  className="w-full bg-transparent px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none text-sm dir-ltr text-left font-mono"
                  disabled={isLoading}
                />
              </div>
            </div>

          </div>

          {/* Optional Dual Forwarding to Bale Section */}
          <div className="p-5 rounded-2xl neu-inset bg-emerald-500/5 border border-emerald-500/20 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="flex items-center gap-3 cursor-pointer select-none">
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
                  className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-400 bg-slate-900 border-white/20 cursor-pointer"
                />
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-emerald-300">ارسال همزمان پیام‌ها به پیام‌رسان بله (ایران) 🇮🇷</span>
                  {isSubscribed ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-extrabold border border-emerald-500/30">
                      پرو / VIP
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-extrabold border border-amber-500/30 flex items-center gap-1">
                      <Lock className="w-3 h-3 text-amber-400" />
                      <span>ویژه نسخه اشتراکی</span>
                    </span>
                  )}
                </div>
              </label>

              {!isSubscribed && onOpenSubscriptions && (
                <button
                  type="button"
                  onClick={onOpenSubscriptions}
                  className="px-3 py-1 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 hover:from-amber-500/30 hover:to-yellow-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Crown className="w-3.5 h-3.5 text-amber-400" />
                  <span>ارتقا به نسخه پرو</span>
                </button>
              )}
            </div>

            {!isSubscribed && enableBale && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center justify-between gap-3 animate-fadeIn">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>این قابلیت نیازمند اشتراک <strong>PRO</strong> یا <strong>VIP</strong> می‌باشد.</span>
                </div>
                {onOpenSubscriptions && (
                  <button
                    type="button"
                    onClick={onOpenSubscriptions}
                    className="px-3 py-1 bg-amber-500 text-slate-950 font-black rounded-lg text-xs hover:bg-amber-400 transition-all cursor-pointer shrink-0"
                  >
                    خرید اشتراک
                  </button>
                )}
              </div>
            )}

            {enableBale && (
              <div className="space-y-4 pt-2 border-t border-white/10 animate-fadeIn">
                <p className="text-xs text-slate-300 leading-relaxed">
                  💡 راهنما: در پیام‌رسان بله ربات‌ساز <strong>BotFather@</strong> را باز کنید و یک ربات جدید بسازید. ربات را مدیر (Admin) کانال بله خود کرده و توکن آن را در زیر وارد کنید:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-200">
                      کانال یا گروه مقصد در بله
                    </label>
                    <div className="neu-inset p-1 flex items-center">
                      <input
                        type="text"
                        value={baleTargetChannel}
                        onChange={(e) => setBaleTargetChannel(e.target.value)}
                        placeholder="مثال: my_bale_channel@ یا id_channel"
                        className="w-full bg-transparent px-3 py-2 text-white placeholder-slate-500 focus:outline-none text-xs dir-ltr text-right"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-200 flex items-center justify-between">
                      <span>جایگزین آیدی در بله (اختیاری)</span>
                      <span className="text-[10px] text-emerald-400 font-normal">در متن پست‌ها</span>
                    </label>
                    <div className="neu-inset p-1 flex items-center">
                      <input
                        type="text"
                        value={baleReplaceId}
                        onChange={(e) => setBaleReplaceId(e.target.value)}
                        placeholder="مثال: my_bale_id@ یا ble.ir/id"
                        className="w-full bg-transparent px-3 py-2 text-white placeholder-slate-500 focus:outline-none text-xs dir-ltr text-right"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-200">
                      توکن ربات بله
                    </label>
                    <div className="neu-inset p-1 flex items-center">
                      <input
                        type="text"
                        value={baleBotToken}
                        onChange={(e) => setBaleBotToken(e.target.value)}
                        placeholder="مثال: 123456789:ABCdef..."
                        className="w-full bg-transparent px-3 py-2 text-white placeholder-slate-500 focus:outline-none text-xs dir-ltr text-left font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Bale Test Button */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleTestBale}
                    disabled={testingBale}
                    className="px-4 py-2 bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {testingBale ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5 text-emerald-400" />}
                    <span>ارسال پیام تست به بله</span>
                  </button>

                  {baleStatusMsg && (
                    <div className={`text-xs font-bold flex items-center gap-1.5 ${
                      baleStatusMsg.type === 'success' ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {baleStatusMsg.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                      <span>{baleStatusMsg.text}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="pt-2 flex justify-center">
            <button
              type="submit"
              disabled={isLoading}
              className="neu-btn-primary w-full md:w-auto px-10 py-3.5 text-base flex items-center justify-center gap-3 font-black cursor-pointer hover:shadow-yellow-400/20 active:scale-95 transition-all"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-black" />
                  <span>در حال ایجاد اتصال...</span>
                </>
              ) : (
                <>
                  <Send className="w-5 h-5 text-black" />
                  <span>شروع اتصال {enableBale && '(تلگرام + بله)'}</span>
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
