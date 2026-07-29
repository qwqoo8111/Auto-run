import React, { useState, useEffect } from 'react';
import { X, Sparkles, Link as LinkIcon, Send, Twitter, Globe, RefreshCw, CheckCircle, AlertCircle, Flame, Clock, Settings, ListFilter, Zap } from 'lucide-react';
import { TelegramConnection } from '../types';
import { extractSocialLink, fetchAiXTrends, postExperimentalToTelegram, getAutoTrendConfig, saveAutoTrendConfig, AutoTrendConfig } from '../services/api';

interface SocialWebImporterModalProps {
  isOpen: boolean;
  onClose: () => void;
  connections: TelegramConnection[];
}

export const SocialWebImporterModal: React.FC<SocialWebImporterModalProps> = ({
  isOpen,
  onClose,
  connections,
}) => {
  const [activeTab, setActiveTab] = useState<'link' | 'trends'>('trends');

  // Tab 1: Link Extractor State
  const [urlInput, setUrlInput] = useState('');
  const [translateToPersian, setTranslateToPersian] = useState(true);
  const [customPrompt, setCustomPrompt] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<{
    type: string;
    author?: string;
    title?: string;
    rawText: string;
    telegramText: string;
    mediaUrls: string[];
    sourceUrl: string;
  } | null>(null);

  // Unified AI Trend Hunter State (Shared Live & Auto)
  const [trendTopic, setTrendTopic] = useState('اخبار فوری و ترندهای داغ جهان در X');
  const [trendCount, setTrendCount] = useState<number>(3);
  const [isSearchingTrends, setIsSearchingTrends] = useState(false);
  const [isInstantPosting, setIsInstantPosting] = useState(false);
  const [trendResults, setTrendResults] = useState<Array<{
    id: string;
    title: string;
    originalSummary: string;
    telegramText: string;
    hashtags: string[];
    sourceUrl?: string;
    topicCategory?: string;
  }>>([]);

  // Auto Trend Scheduler State
  const [autoConfig, setAutoConfig] = useState<AutoTrendConfig>({
    enabled: false,
    botToken: '',
    targetChannel: '',
    topic: 'اخبار فوری و ترندهای داغ جهان در X',
    intervalHours: 24,
    countPerRun: 3,
    logs: [],
  });
  const [customIntervalInput, setCustomIntervalInput] = useState<string>('24');
  const [isLoadingAuto, setIsLoadingAuto] = useState(false);
  const [isSavingAuto, setIsSavingAuto] = useState(false);

  // Destination Bot Token & Target Channel (For Manual & Auto Actions)
  const [selectedConnId, setSelectedConnId] = useState<string>(
    connections.find((c) => c.status === 'active')?.id || connections[0]?.id || ''
  );
  const [customBotToken, setCustomBotToken] = useState('');
  const [customTargetChannel, setCustomTargetChannel] = useState('');

  // Status & Feedback
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [postingIndex, setPostingIndex] = useState<number | null>(null);

  // Fetch Auto Trend Config on load
  useEffect(() => {
    if (isOpen) {
      loadAutoSettings();
    }
  }, [isOpen]);

  const loadAutoSettings = async () => {
    setIsLoadingAuto(true);
    try {
      const res = await getAutoTrendConfig();
      if (res.ok && res.config) {
        setAutoConfig(res.config);
        if (res.config.countPerRun) setTrendCount(res.config.countPerRun);
        if (res.config.topic) setTrendTopic(res.config.topic);
        if (res.config.intervalHours) setCustomIntervalInput(String(res.config.intervalHours));
      }
    } catch (err) {
      console.warn("Failed to load auto trend config:", err);
    } finally {
      setIsLoadingAuto(false);
    }
  };

  if (!isOpen) return null;

  // High-Contrast Preset Topics
  const presetTopics = [
    { label: '🌍 اخبار فوری جهان', topic: 'اخبار داغ و فوری مهم جهان در X (توییتر)' },
    { label: '🤖 هوش مصنوعی (AI)', topic: 'جدیدترین اخبار و ترندهای هوش مصنوعی AI در X' },
    { label: '⚽ فوتبال و ورزش', topic: 'ترندها و اتفاقات مهم فوتبالی و ورزشی جهان در X' },
    { label: '📱 تکنولوژی و گجت', topic: 'ترندهای تکنولوژی، موبایل و فناوری در ایکس' },
    { label: '🪙 کریپتو و بلاکچین', topic: 'اخبار و ترندهای داغ کریپتوکارنسی و بیت‌کوین در X' },
  ];

  // Resolve active Bot Token and Channel
  const getTargetCredentials = () => {
    if (selectedConnId === 'custom') {
      return {
        botToken: customBotToken.trim(),
        targetChannel: customTargetChannel.trim(),
      };
    }
    const found = connections.find((c) => c.id === selectedConnId);
    if (found) {
      return {
        botToken: found.botToken.trim(),
        targetChannel: found.targetChannel.trim(),
      };
    }
    return {
      botToken: customBotToken.trim(),
      targetChannel: customTargetChannel.trim(),
    };
  };

  // Sync count between Live & Auto
  const updateTrendCountShared = (cnt: number) => {
    const validCount = Math.max(1, Math.min(10, cnt));
    setTrendCount(validCount);
    setAutoConfig((prev) => ({ ...prev, countPerRun: validCount }));
  };

  // Sync topic between Live & Auto
  const updateTrendTopicShared = (topic: string) => {
    setTrendTopic(topic);
    setAutoConfig((prev) => ({ ...prev, topic }));
  };

  // Handle Extract Link
  const handleExtractLink = async () => {
    if (!urlInput.trim()) {
      setStatusMessage({ type: 'error', text: 'لطفاً لینک مورد نظر (ایکس X یا وب‌سایت) را وارد کنید.' });
      return;
    }
    setIsExtracting(true);
    setStatusMessage(null);
    setExtractedData(null);

    try {
      const res = await extractSocialLink({
        url: urlInput.trim(),
        translateToPersian,
        customPrompt: customPrompt.trim() || undefined,
      });

      if (res && res.extracted) {
        setExtractedData(res.extracted);
        setStatusMessage({ type: 'success', text: 'محتوا با موفقیت استخراج و با هوش مصنوعی بازنویسی شد!' });
      } else {
        setStatusMessage({ type: 'error', text: 'پاسخی از سرور دریافت نشد.' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'خطا در استخراج محتوای لینک.' });
    } finally {
      setIsExtracting(false);
    }
  };

  // 1. Search Manual Preview
  const handleSearchTrendsManual = async () => {
    setIsSearchingTrends(true);
    setStatusMessage(null);
    setTrendResults([]);

    try {
      const res = await fetchAiXTrends({
        topic: trendTopic.trim(),
        count: trendCount,
      });

      if (res && res.trends && res.trends.length > 0) {
        setTrendResults(res.trends);
        setStatusMessage({ type: 'success', text: `تعداد ${res.trends.length} ترند داغ استخراج شد. می‌توانید قبل از ارسال ویرایش کنید.` });
      } else {
        setStatusMessage({ type: 'error', text: 'ترندی برای این موضوع پیدا نشد. موضوع دیگری را امتحان کنید.' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'خطا در کاوش ترندهای X با هوش مصنوعی.' });
    } finally {
      setIsSearchingTrends(false);
    }
  };

  // 2. Search & Instant Auto-Post to Channel
  const handleSearchAndPostInstant = async () => {
    const { botToken, targetChannel } = getTargetCredentials();
    if (!botToken || !targetChannel) {
      setStatusMessage({ type: 'error', text: 'لطفاً یک اتصال فعال انتخاب کنید یا توکن ربات و کانال مقصد را وارد نمایید.' });
      return;
    }

    setIsInstantPosting(true);
    setStatusMessage(null);

    try {
      const res = await fetchAiXTrends({
        topic: trendTopic.trim(),
        count: trendCount,
      });

      if (res && res.trends && res.trends.length > 0) {
        setTrendResults(res.trends);
        let successCount = 0;

        for (const item of res.trends) {
          if (!item.telegramText) continue;
          const sendRes = await postExperimentalToTelegram({
            botToken,
            targetChannel,
            text: item.telegramText,
          });
          if (sendRes.ok) {
            successCount++;
          }
        }

        setStatusMessage({
          type: 'success',
          text: `⚡ تعداد ${successCount} ترند جدید به صورت زنده به کانال ${targetChannel} ارسال شد!`,
        });
      } else {
        setStatusMessage({ type: 'error', text: 'ترندی برای این موضوع پیدا نشد.' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'خطا در کاوش و ارسال زنده به کانال.' });
    } finally {
      setIsInstantPosting(false);
    }
  };

  // Handle Post Extracted Link to Telegram
  const handlePostExtracted = async () => {
    if (!extractedData) return;
    const { botToken, targetChannel } = getTargetCredentials();

    if (!botToken || !targetChannel) {
      setStatusMessage({ type: 'error', text: 'لطفاً یک اتصال فعال انتخاب کنید یا توکن ربات و کانال مقصد را وارد نمایید.' });
      return;
    }

    setIsExtracting(true);
    setStatusMessage(null);

    try {
      const res = await postExperimentalToTelegram({
        botToken,
        targetChannel,
        text: extractedData.telegramText,
        mediaUrls: extractedData.mediaUrls,
      });

      if (res.ok) {
        setStatusMessage({ type: 'success', text: `پست با موفقیت به کانال ${targetChannel} ارسال گردید!` });
      } else {
        setStatusMessage({ type: 'error', text: `خطا در ارسال به تلگرام: ${res.error || 'ناشناخته'}` });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'خطا در ارسال پست به کانال.' });
    } finally {
      setIsExtracting(false);
    }
  };

  // Handle Post Single Trend Item
  const handlePostTrendItem = async (trendIndex: number) => {
    const item = trendResults[trendIndex];
    if (!item) return;

    const { botToken, targetChannel } = getTargetCredentials();
    if (!botToken || !targetChannel) {
      setStatusMessage({ type: 'error', text: 'لطفاً یک اتصال فعال انتخاب کنید یا توکن ربات و کانال مقصد را وارد نمایید.' });
      return;
    }

    setPostingIndex(trendIndex);
    setStatusMessage(null);

    try {
      const res = await postExperimentalToTelegram({
        botToken,
        targetChannel,
        text: item.telegramText,
      });

      if (res.ok) {
        setStatusMessage({ type: 'success', text: `ترند "${item.title}" با موفقیت به ${targetChannel} ارسال شد!` });
      } else {
        setStatusMessage({ type: 'error', text: `خطا در ارسال: ${res.error || 'ناشناخته'}` });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'خطا در ارسال ترند به تلگرام.' });
    } finally {
      setPostingIndex(null);
    }
  };

  // Handle Save Auto Trend Config
  const handleSaveAutoSettings = async () => {
    const { botToken, targetChannel } = getTargetCredentials();

    if (autoConfig.enabled && (!botToken || !targetChannel)) {
      setStatusMessage({ type: 'error', text: 'برای فعال‌سازی ارسال خودکار زمان‌بندی‌شده، توکن ربات و کانال مقصد الزامی است.' });
      return;
    }

    const intervalVal = Math.max(0.05, parseFloat(customIntervalInput) || 24);

    setIsSavingAuto(true);
    setStatusMessage(null);

    try {
      const payload: AutoTrendConfig = {
        ...autoConfig,
        connId: selectedConnId,
        botToken: botToken || autoConfig.botToken,
        targetChannel: targetChannel || autoConfig.targetChannel,
        topic: trendTopic.trim(),
        countPerRun: trendCount,
        intervalHours: intervalVal,
      };

      const res = await saveAutoTrendConfig(payload);
      if (res.ok && res.config) {
        setAutoConfig(res.config);
        setStatusMessage({
          type: 'success',
          text: res.config.enabled
            ? `ربات ارسال خودکار فعال شد! هر ${intervalVal} ساعت تعداد ${trendCount} پست به ${targetChannel} ارسال می‌گردد.`
            : 'ارسال خودکار زمان‌بندی‌شده متوقف شد.',
        });
      } else {
        setStatusMessage({ type: 'error', text: 'خطا در ذخیره تنظیمات ارسال خودکار.' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'خطا در ارتباط با سرور.' });
    } finally {
      setIsSavingAuto(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto dir-rtl">
      <div className="relative w-full max-w-4xl neu-flat bg-slate-900/95 border border-blue-500/30 rounded-3xl p-5 sm:p-7 shadow-2xl my-8 text-slate-100">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 mb-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 neu-inset rounded-2xl bg-gradient-to-tr from-blue-600/30 to-purple-600/30 border border-blue-400/40 text-blue-400">
              <Twitter className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white">ابزار استخراج X و وب + کاوشگر هوشمند ترندها</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white font-black shadow-md">
                  بتا (Beta)
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 font-medium">
                استخراج لینک‌های مستقیم + کاوشگر زنده و سیستم ارسال خودکار زمان‌بندی‌شده به کانال تلگرام
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 neu-button rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Channel Selection Bar */}
        <div className="mb-6 p-4 neu-inset rounded-2xl border border-white/10 bg-slate-800/50">
          <label className="block text-xs font-bold text-slate-200 mb-2 flex items-center gap-1.5">
            <Send className="w-4 h-4 text-blue-400" />
            <span>انتخاب کانال تلگرام مقصد جهت ارسال (زنده یا خودکار):</span>
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select
              value={selectedConnId}
              onChange={(e) => setSelectedConnId(e.target.value)}
              className="md:col-span-1 p-2.5 text-xs font-bold bg-slate-900 border border-white/20 rounded-xl text-white focus:outline-none focus:border-blue-400"
            >
              {connections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.targetChannel} (از {c.sourceChannel})
                </option>
              ))}
              <option value="custom">⚙️ توکن ربات و کانال سفارشی...</option>
            </select>

            {selectedConnId === 'custom' && (
              <>
                <input
                  type="text"
                  placeholder="توکن ربات تلگرام (botToken)..."
                  value={customBotToken}
                  onChange={(e) => setCustomBotToken(e.target.value)}
                  className="p-2.5 text-xs font-mono bg-slate-900 border border-white/20 rounded-xl text-white dir-ltr text-left"
                />
                <input
                  type="text"
                  placeholder="آیدی کانال مقصد (@channel_id)..."
                  value={customTargetChannel}
                  onChange={(e) => setCustomTargetChannel(e.target.value)}
                  className="p-2.5 text-xs font-mono bg-slate-900 border border-white/20 rounded-xl text-white dir-ltr text-left"
                />
              </>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 mb-6 p-1.5 neu-inset rounded-2xl bg-slate-950/80 border border-white/10">
          <button
            onClick={() => setActiveTab('trends')}
            className={`flex-1 py-3 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'trends'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/20'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Flame className="w-4 h-4 text-amber-400 animate-pulse" />
            <span>۱. کاوشگر زنده و ارسال خودکار ترندهای داغ X</span>
          </button>

          <button
            onClick={() => setActiveTab('link')}
            className={`flex-1 py-3 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'link'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <LinkIcon className="w-4 h-4" />
            <span>۲. استخراج مستقیم از لینک (X / وب)</span>
          </button>
        </div>

        {/* Feedback Alert */}
        {statusMessage && (
          <div
            className={`mb-5 p-3.5 rounded-2xl border text-xs font-bold flex items-center gap-2.5 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200'
                : statusMessage.type === 'error'
                ? 'bg-rose-500/20 border-rose-500/50 text-rose-200'
                : 'bg-blue-500/20 border-blue-500/50 text-blue-200'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle className="w-5 h-5 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* TAB 1: AI Trend Hunter & Auto Poster (Unified) */}
        {activeTab === 'trends' && (
          <div className="space-y-6">
            
            {/* Main Topic & Count Controls */}
            <div className="p-5 neu-inset rounded-2xl border border-white/10 bg-slate-800/40 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-2 flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-400" />
                  <span>موضوع جهت کاوش و ارسال ترندهای داغ X (توییتر) و وب:</span>
                </label>
                <input
                  type="text"
                  value={trendTopic}
                  onChange={(e) => updateTrendTopicShared(e.target.value)}
                  className="w-full p-3 text-xs font-bold bg-slate-900 border border-white/20 rounded-xl text-white focus:outline-none focus:border-purple-400"
                  placeholder="موضوع ترند مورد نظر..."
                />
              </div>

              {/* Point 1: High Contrast Preset Topic Badges */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-200 block">موضوعات آماده جهت انتخاب سریع:</span>
                <div className="flex items-center gap-2 flex-wrap">
                  {presetTopics.map((pt, idx) => (
                    <button
                      key={idx}
                      onClick={() => updateTrendTopicShared(pt.topic)}
                      className="text-xs px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-950/90 to-indigo-950/90 hover:from-purple-600 hover:to-indigo-600 border border-purple-400/50 text-white font-black shadow-md hover:shadow-purple-500/20 transition-all cursor-pointer"
                    >
                      {pt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Point 3 & 4: Shared Post Count Selector */}
              <div className="pt-2 border-t border-white/10 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-200">تعداد پست ترند در هر بار (مشترک کاوش زنده و خودکار):</span>
                  {[1, 3, 5, 10, 15, 20, 24, 30].map((cnt) => (
                    <button
                      key={cnt}
                      onClick={() => updateTrendCountShared(cnt)}
                      className={`px-3 py-1.5 text-xs font-black rounded-xl transition-all cursor-pointer ${
                        trendCount === cnt
                          ? 'bg-purple-600 text-white shadow-md shadow-purple-500/30'
                          : 'bg-slate-900 text-slate-300 hover:text-white border border-white/10'
                      }`}
                    >
                      {cnt} پست
                    </button>
                  ))}

                  <div className="flex items-center gap-1.5 bg-slate-900 border border-white/20 rounded-xl px-3 py-1.5">
                    <span className="text-[11px] text-slate-300 font-bold">عدد سفارشی:</span>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={trendCount}
                      onChange={(e) => updateTrendCountShared(Math.min(30, Math.max(1, parseInt(e.target.value) || 1)))}
                      className="w-12 text-xs font-black bg-transparent text-amber-300 text-center focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-400 font-bold">پست</span>
                  </div>
                </div>
              </div>

              {/* Instant Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-white/10">
                <button
                  onClick={handleSearchAndPostInstant}
                  disabled={isInstantPosting || isSearchingTrends}
                  className="py-3.5 px-5 neu-button bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-xs rounded-xl shadow-lg shadow-emerald-500/20 hover:from-emerald-500 hover:to-teal-500 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isInstantPosting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>در حال کاوش و ارسال مستقیم به کانال...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 text-amber-300 fill-amber-300 animate-bounce" />
                      <span>⚡ کاوش و ارسال زنده به کانال (در لحظه)</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleSearchTrendsManual}
                  disabled={isSearchingTrends || isInstantPosting}
                  className="py-3.5 px-5 neu-button bg-gradient-to-r from-purple-600 to-pink-600 text-white font-black text-xs rounded-xl shadow-lg shadow-purple-500/20 hover:from-purple-500 hover:to-pink-500 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSearchingTrends ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>در حال کاوش ترندها...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>🔍 کاوش و پیش‌نمایش دستی قبل ارسال</span>
                    </>
                  )}
                </button>
              </div>

            </div>

            {/* AUTOMATIC SCHEDULER SECTION (Embedded inside Live Trend view) */}
            <div className="p-5 neu-flat bg-slate-950/80 border border-emerald-500/30 rounded-2xl space-y-4">
              
              <div className="flex items-center justify-between border-b border-white/10 pb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl border ${autoConfig.enabled ? 'bg-emerald-500/20 border-emerald-400 text-emerald-400' : 'bg-slate-800 border-white/10 text-slate-400'}`}>
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">ربات ارسال خودکار زمان‌بندی‌شده به کانال</h3>
                    <p className="text-xs text-slate-300">
                      پست‌گذاری اتوماتیک طبق فاصله زمانی سفارشی شما
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoConfig.enabled}
                    onChange={(e) => setAutoConfig({ ...autoConfig, enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>

              {/* Live Search Notice Banner */}
              <div className="p-3 bg-blue-950/60 border border-blue-500/40 rounded-xl text-xs text-blue-200 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold text-white block">🔍 تضمین کاوش لحظه‌ای قبل از هر ارسال خودکار:</span>
                  <p className="text-[11px] text-slate-300 leading-relaxed font-medium">
                    ربات پیش از ارسال، مطالب قدیمی را مجدداً استفاده نمی‌کند؛ بلکه دقیقاً سر رأس هر زمان‌بندی (مثلاً هر {customIntervalInput} ساعت)، سرچ زنده آنلاین انجام داده و اخبار، ترندها، جوک‌ها و میم‌های همان لحظه را استخراج، بازنویسی و مستقیماً به کانال ارسال می‌کند.
                  </p>
                </div>
              </div>

              {/* Point 3: Customizable Interval controls */}
              <div className="space-y-2">
                <label className="block text-xs font-black text-amber-300 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span>فاصله زمانی انتشار خودکار (چند ساعت یکبار):</span>
                </label>

                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    { label: '۳۰ دقیقه', hrs: 0.5 },
                    { label: '۱ ساعت', hrs: 1 },
                    { label: '۲ ساعت', hrs: 2 },
                    { label: '۴ ساعت', hrs: 4 },
                    { label: '۶ ساعت', hrs: 6 },
                    { label: '۱۲ ساعت', hrs: 12 },
                    { label: '۲۴ ساعت', hrs: 24 },
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setCustomIntervalInput(String(preset.hrs));
                        setAutoConfig({ ...autoConfig, intervalHours: preset.hrs });
                      }}
                      className={`px-3 py-1.5 text-xs font-black rounded-xl transition-all cursor-pointer ${
                        Number(customIntervalInput) === preset.hrs
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/30'
                          : 'bg-slate-900 text-slate-300 hover:text-white border border-white/10'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}

                  <div className="flex items-center gap-1.5 bg-slate-900 border border-white/20 rounded-xl px-3 py-1.5">
                    <span className="text-[11px] text-slate-300 font-bold">ساعات کاستوم:</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0.05"
                      value={customIntervalInput}
                      onChange={(e) => {
                        setCustomIntervalInput(e.target.value);
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val)) {
                          setAutoConfig({ ...autoConfig, intervalHours: val });
                        }
                      }}
                      className="w-16 text-xs font-black bg-transparent text-emerald-300 text-center focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-400">ساعت</span>
                  </div>
                </div>
              </div>

              {/* Status & Save Button */}
              <div className="flex items-center justify-between gap-3 pt-2 flex-wrap">
                <div className="text-xs text-slate-300 font-bold flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${autoConfig.enabled ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`}></span>
                  <span>وضعیت ارسال خودکار: {autoConfig.enabled ? `فعال (هر ${customIntervalInput} ساعت)` : 'غیرفعال'}</span>
                </div>

                <button
                  onClick={handleSaveAutoSettings}
                  disabled={isSavingAuto}
                  className="py-2.5 px-5 neu-button bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSavingAuto ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Settings className="w-4 h-4" />
                  )}
                  <span>ذخیره تنظیمات ارسال خودکار</span>
                </button>
              </div>

              {/* Logs Drawer if present */}
              {autoConfig.logs && autoConfig.logs.length > 0 && (
                <div className="pt-2 border-t border-white/10 space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                    <ListFilter className="w-3.5 h-3.5 text-blue-400" />
                    <span>آخرین لاگ‌های ارسال خودکار:</span>
                  </span>
                  <div className="max-h-24 overflow-y-auto space-y-1 p-2 bg-slate-900 rounded-xl border border-white/10 text-[11px]">
                    {autoConfig.logs.slice(0, 5).map((log, idx) => (
                      <div key={idx} className="flex items-center justify-between text-slate-300">
                        <span className={log.status === 'success' ? 'text-emerald-300 font-bold' : 'text-rose-300 font-bold'}>
                          {log.message}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(log.time).toLocaleTimeString('fa-IR')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>

            {/* Manual Results List */}
            {trendResults.length > 0 && (
              <div className="space-y-4 pt-2">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-400" />
                  <span>نتایج استخراج شده ترندهای X (قابل ویرایش و ارسال تک‌تک):</span>
                </h3>

                {trendResults.map((item, idx) => (
                  <div key={item.id || idx} className="p-4 neu-flat bg-slate-900 border border-purple-500/30 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-purple-500/30 border border-purple-400/40 text-purple-200 font-black flex items-center justify-center text-xs">
                          {idx + 1}
                        </span>
                        <h4 className="text-xs font-black text-white">{item.title}</h4>
                      </div>
                      {item.sourceUrl && (
                        <a
                          href={item.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-blue-400 hover:underline flex items-center gap-1 font-mono dir-ltr font-bold"
                        >
                          <LinkIcon className="w-3 h-3" />
                          <span>منبع</span>
                        </a>
                      )}
                    </div>

                    {/* Point 2: High Contrast Readability Source Summary */}
                    <div className="bg-slate-950/90 p-3.5 rounded-xl border border-amber-500/30 text-slate-100 space-y-1">
                      <div className="flex items-center gap-1.5 text-amber-300 font-black text-xs mb-1">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>خلاصه منبع اصلی (کاور شده از X و وب):</span>
                      </div>
                      <p className="text-xs font-sans text-slate-100 font-medium leading-relaxed bg-slate-900/80 p-2.5 rounded-lg border border-white/10">
                        {item.originalSummary}
                      </p>
                    </div>

                    {/* Editable Telegram Post */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-200 mb-1">
                        متن پست تلگرامی تولید شده (قابل ویرایش):
                      </label>
                      <textarea
                        rows={5}
                        value={item.telegramText}
                        onChange={(e) => {
                          const updated = [...trendResults];
                          updated[idx].telegramText = e.target.value;
                          setTrendResults(updated);
                        }}
                        className="w-full p-3 text-xs bg-slate-950 border border-white/20 rounded-xl text-slate-100 font-sans focus:outline-none focus:border-purple-400 leading-relaxed"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        onClick={() => handlePostTrendItem(idx)}
                        disabled={postingIndex === idx}
                        className="px-4 py-2.5 neu-button bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {postingIndex === idx ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                        <span>ارسال این ترند به کانال</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Direct Link Extractor */}
        {activeTab === 'link' && (
          <div className="space-y-5">
            <div className="p-4 neu-inset rounded-2xl border border-white/10 bg-slate-800/40 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1.5 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-blue-400" />
                  <span>آدرس مستقیم لینک X (توییتر) یا وب‌سایت خبری:</span>
                </label>
                <input
                  type="text"
                  placeholder="https://x.com/username/status/1880000000000000000 یا لینک مقاله سایت..."
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="w-full p-3 text-xs font-mono bg-slate-900 border border-white/20 rounded-xl text-white dir-ltr text-left focus:outline-none focus:border-blue-400"
                />
              </div>

              <div className="flex items-center gap-3 pt-1">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={translateToPersian}
                    onChange={(e) => setTranslateToPersian(e.target.checked)}
                    className="w-4 h-4 rounded border-white/20 text-blue-500 focus:ring-blue-400 bg-slate-900"
                  />
                  <Sparkles className="w-4 h-4 text-yellow-400" />
                  <span>ترجمه و بازنویسی حرفه‌ای به فارسی با هوش مصنوعی (Gemini)</span>
                </label>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  دستور سفارشی هوش مصنوعی (اختیاری):
                </label>
                <input
                  type="text"
                  placeholder="مثلا: لحن خبری رسمی باشد، با ۳ هشتگ و ۲ ایموجی همراه با خلاصه کوتاه..."
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  className="w-full p-2.5 text-xs bg-slate-900 border border-white/15 rounded-xl text-white focus:outline-none focus:border-purple-400"
                />
              </div>

              <button
                onClick={handleExtractLink}
                disabled={isExtracting}
                className="w-full py-3 px-5 neu-button bg-gradient-to-r from-blue-600 to-purple-600 text-white font-black text-xs rounded-xl shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-purple-500 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isExtracting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>در حال دریافت و تحلیل هوشمند لینک...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-yellow-300" />
                    <span>استخراج و بازنویسی محتوا با AI</span>
                  </>
                )}
              </button>
            </div>

            {/* Extracted Output Result Preview */}
            {extractedData && (
              <div className="p-5 neu-flat bg-slate-900 border border-emerald-500/30 rounded-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <span className="text-xs font-black text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4" />
                    <span>پیش‌نمایش محتوای آماده ارسال به تلگرام:</span>
                  </span>
                  {extractedData.author && (
                    <span className="text-xs text-slate-300 font-mono dir-ltr">
                      منبع: {extractedData.author}
                    </span>
                  )}
                </div>

                {/* Media Preview if present */}
                {extractedData.mediaUrls && extractedData.mediaUrls.length > 0 && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-2">
                    {extractedData.mediaUrls.map((m, idx) => (
                      <div key={idx} className="relative w-24 h-24 rounded-xl overflow-hidden border border-white/15 bg-slate-950 shrink-0">
                        <img src={m} alt={`رسانه ${idx}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}

                {/* Text Area to Edit before Post */}
                <div>
                  <textarea
                    rows={6}
                    value={extractedData.telegramText}
                    onChange={(e) => setExtractedData({ ...extractedData, telegramText: e.target.value })}
                    className="w-full p-3 text-xs bg-slate-950 border border-white/20 rounded-xl text-slate-100 font-sans focus:outline-none focus:border-blue-400 leading-relaxed"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    onClick={handlePostExtracted}
                    disabled={isExtracting}
                    className="px-6 py-3 neu-button bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    <span>ارسال به کانال تلگرام</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
