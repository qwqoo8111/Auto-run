import React, { useState, useEffect, useRef } from 'react';
import { X, Sparkles, Link as LinkIcon, Send, Twitter, Globe, RefreshCw, CheckCircle, AlertCircle, Flame, Clock, Settings, ListFilter, Zap, Key, ArrowUp, PlusCircle } from 'lucide-react';
import { TelegramConnection, CreateConnectionDTO } from '../types';
import { extractSocialLink, fetchAiXTrends, postExperimentalToTelegram, getAutoTrendConfig, saveAutoTrendConfig, triggerAutoTrendRunNow, AutoTrendConfig } from '../services/api';

interface SocialWebImporterModalProps {
  isOpen: boolean;
  onClose: () => void;
  connections: TelegramConnection[];
  onCreateConnection?: (dto: CreateConnectionDTO) => Promise<void>;
}

export const SocialWebImporterModal: React.FC<SocialWebImporterModalProps> = ({
  isOpen,
  onClose,
  connections,
  onCreateConnection,
}) => {
  const [activeTab, setActiveTab] = useState<'twitter' | 'website' | 'trends'>('twitter');
  const modalContainerRef = useRef<HTMLDivElement>(null);

  const scrollToTop = () => {
    if (modalContainerRef.current) {
      modalContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

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
  const [combineIntoSinglePost, setCombineIntoSinglePost] = useState<boolean>(false);
  const [isSearchingTrends, setIsSearchingTrends] = useState(false);
  const [isInstantPosting, setIsInstantPosting] = useState(false);
  const [trendResults, setTrendResults] = useState<Array<{
    id: string;
    title: string;
    originalSummary: string;
    telegramText: string;
    hashtags: string[];
    sourceUrl?: string;
    mediaUrls?: string[];
    topicCategory?: string;
  }>>([]);

  // User AI API Key State (Required for X Trends)
  const [userAiApiKey, setUserAiApiKey] = useState<string>(() => {
    return localStorage.getItem('autorun_user_ai_api_key') || '';
  });
  const [userAiProvider, setUserAiProvider] = useState<string>('gemini');

  // Auto Trend Scheduler State
  const [autoConfig, setAutoConfig] = useState<AutoTrendConfig>({
    enabled: false,
    botToken: '',
    targetChannel: '',
    topic: 'اخبار فوری و ترندهای داغ جهان در X',
    intervalHours: 24,
    countPerRun: 3,
    combineIntoSinglePost: false,
    logs: [],
  });
  const [customIntervalInput, setCustomIntervalInput] = useState<string>('24');
  const [isLoadingAuto, setIsLoadingAuto] = useState(false);
  const [isSavingAuto, setIsSavingAuto] = useState(false);

  // Destination Bot Token & Target Channel (For Manual & Auto Actions)
  const [selectedConnId, setSelectedConnId] = useState<string>(
    connections.find((c) => c.status === 'active')?.id || connections[0]?.id || 'custom'
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
        if (res.config.combineIntoSinglePost !== undefined) {
          setCombineIntoSinglePost(Boolean(res.config.combineIntoSinglePost));
        }
        if (res.config.apiKey) {
          setUserAiApiKey(res.config.apiKey);
          localStorage.setItem('autorun_user_ai_api_key', res.config.apiKey);
        }
        if (res.config.provider) {
          setUserAiProvider(res.config.provider);
        }
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
    if (!selectedConnId || selectedConnId === 'custom') {
      return {
        botToken: customBotToken.trim(),
        targetChannel: customTargetChannel.trim(),
      };
    }
    const found = connections.find((c) => c.id === selectedConnId);
    if (found && found.botToken && found.targetChannel) {
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
    const validCount = Math.max(1, Math.min(30, cnt));
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
    if (!userAiApiKey.trim()) {
      setStatusMessage({ type: 'error', text: 'لطفاً ابتدا کلید API اختصاصی هوش مصنوعی خود را در کادر مربوطه وارد کنید.' });
      return;
    }

    setIsSearchingTrends(true);
    setStatusMessage(null);
    setTrendResults([]);

    try {
      const res = await fetchAiXTrends({
        topic: trendTopic.trim(),
        count: trendCount,
        apiKey: userAiApiKey.trim(),
        provider: userAiProvider,
      });

      if (res && res.trends && res.trends.length > 0) {
        setTrendResults(res.trends);
        setStatusMessage({
          type: 'success',
          text: `⚡ تعداد ${res.trends.length} ترند داغ استخراج گردید. نتایج در پایین نمایش داده شد؛ می‌توانید پیش‌نمایش را بررسی و به انتخاب خود ارسال نمایید.`,
        });
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
    if (!userAiApiKey.trim()) {
      setStatusMessage({ type: 'error', text: 'لطفاً ابتدا کلید API اختصاصی هوش مصنوعی خود را در کادر مربوطه وارد کنید.' });
      return;
    }

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
        apiKey: userAiApiKey.trim(),
        provider: userAiProvider,
      });

      if (res && res.trends && res.trends.length > 0) {
        setTrendResults(res.trends);

        if (combineIntoSinglePost && res.trends.length > 1) {
          const cleanTag = trendTopic.trim().replace(/[^\u0600-\u06FFa-zA-Z0-9]/g, '_');
          const header = `🔥 **خلاصه و جمع‌بندی داغ‌ترین ترندها (${res.trends.length} موضوع در ۱ پیام):**\n\n`;
          const itemsText = res.trends.map((item, idx) => {
            const tTitle = item.title || `موضوع ${idx + 1}`;
            const tSummary = item.originalSummary || item.telegramText || '';
            return `🔹 **${idx + 1}. ${tTitle}**\n${tSummary}`;
          }).join('\n\n---\n\n');

          const combinedText = `${header}📌 **موضوع:** ${trendTopic.trim()}\n\n${itemsText}\n\n⚡ **منبع: کاوشگر زنده X و وب** | #${cleanTag} #خلاصه_اخبار`;

          const sendRes = await postExperimentalToTelegram({
            botToken,
            targetChannel,
            text: combinedText,
          });

          if (sendRes.ok) {
            setStatusMessage({
              type: 'success',
              text: `⚡ تمام ${res.trends.length} ترند در قالب ۱ پیام خلاصه‌شده با موفقیت به کانال ${targetChannel} ارسال شد!`,
            });
          } else {
            setStatusMessage({ type: 'error', text: `خطا در ارسال: ${sendRes.error || 'ناشناخته'}` });
          }
        } else {
          let successCount = 0;
          for (const item of res.trends) {
            if (!item.telegramText) continue;
            const sendRes = await postExperimentalToTelegram({
              botToken,
              targetChannel,
              text: item.telegramText,
              mediaUrls: item.mediaUrls,
            });
            if (sendRes.ok) {
              successCount++;
            }
          }

          setStatusMessage({
            type: 'success',
            text: `⚡ تعداد ${successCount} ترند جدید به صورت زنده به کانال ${targetChannel} ارسال شد!`,
          });
        }
      } else {
        setStatusMessage({ type: 'error', text: 'ترندی برای این موضوع پیدا نشد.' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'خطا در کاوش و ارسال زنده به کانال.' });
    } finally {
      setIsInstantPosting(false);
    }
  };

  // Handle Post All Trends Combined into Single Message (Manual Mode)
  const handlePostAllCombined = async () => {
    if (trendResults.length === 0) return;
    const { botToken, targetChannel } = getTargetCredentials();
    if (!botToken || !targetChannel) {
      setStatusMessage({ type: 'error', text: 'لطفاً یک اتصال فعال انتخاب کنید یا توکن ربات و کانال مقصد را وارد نمایید.' });
      return;
    }

    setIsInstantPosting(true);
    setStatusMessage(null);

    try {
      const cleanTag = trendTopic.trim().replace(/[^\u0600-\u06FFa-zA-Z0-9]/g, '_');
      const header = `🔥 **خلاصه و جمع‌بندی داغ‌ترین ترندها (${trendResults.length} موضوع در ۱ پیام):**\n\n`;
      const itemsText = trendResults.map((item, idx) => {
        const tTitle = item.title || `موضوع ${idx + 1}`;
        const tSummary = item.originalSummary || item.telegramText || '';
        return `🔹 **${idx + 1}. ${tTitle}**\n${tSummary}`;
      }).join('\n\n---\n\n');

      const combinedText = `${header}📌 **موضوع:** ${trendTopic.trim()}\n\n${itemsText}\n\n⚡ **منبع: کاوشگر زنده X و وب** | #${cleanTag} #خلاصه_اخبار`;

      const sendRes = await postExperimentalToTelegram({
        botToken,
        targetChannel,
        text: combinedText,
      });

      if (sendRes.ok) {
        setStatusMessage({
          type: 'success',
          text: `⚡ تمامی ${trendResults.length} ترند به صورت ۱ پیام خلاصه‌شده واحد به کانال ${targetChannel} ارسال گردید!`,
        });
      } else {
        setStatusMessage({ type: 'error', text: `خطا در ارسال: ${sendRes.error || 'ناشناخته'}` });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'خطا در ارسال ترندهای خلاصه‌شده.' });
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

  // Create auto monitoring connection in Connection Management Panel
  const handleCreateMonitoringConnection = async (sourceUrlOrHandle: string) => {
    if (!sourceUrlOrHandle.trim()) return;
    const { botToken, targetChannel } = getTargetCredentials();
    if (!botToken || !targetChannel) {
      setStatusMessage({ type: 'error', text: 'لطفاً ابتدا توکن ربات تلگرام و کانال مقصد را وارد کنید تا این منبع به عنوان اتصال خودکار ثبت شود.' });
      return;
    }
    if (!onCreateConnection) {
      setStatusMessage({ type: 'error', text: 'قابلیت ایجاد اتصال در این بخش در دسترس نیست.' });
      return;
    }

    try {
      const isTwitter = sourceUrlOrHandle.toLowerCase().includes('twitter.com') || sourceUrlOrHandle.toLowerCase().includes('x.com') || (sourceUrlOrHandle.startsWith('@') && !sourceUrlOrHandle.includes('t.me'));
      await onCreateConnection({
        sourceType: isTwitter ? 'twitter' : 'website',
        sourceChannel: sourceUrlOrHandle.trim(),
        targetChannel: targetChannel.trim(),
        botToken: botToken.trim(),
      });
      setStatusMessage({
        type: 'success',
        text: `✅ منبع "${sourceUrlOrHandle.trim()}" با موفقیت به عنوان اتصال خودکار زنده در "پنل مدیریت اتصالات" اضافه شد!`,
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'خطا در افزودن منبع به پنل مدیریت اتصالات' });
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
        mediaUrls: item.mediaUrls,
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
        combineIntoSinglePost: combineIntoSinglePost,
        apiKey: userAiApiKey.trim(),
        provider: userAiProvider,
      };

      const res = await saveAutoTrendConfig(payload);
      if (res.ok && res.config) {
        setAutoConfig(res.config);
        setStatusMessage({
          type: 'success',
          text: res.config.enabled
            ? res.config.combineIntoSinglePost
              ? `ربات ارسال خودکار فعال شد! هر ${intervalVal} ساعت تمام ${trendCount} ترند به صورت ۱ پیام خلاصه به ${targetChannel} ارسال می‌گردد.`
              : `ربات ارسال خودکار فعال شد! هر ${intervalVal} ساعت تعداد ${trendCount} پست مجزا به ${targetChannel} ارسال می‌گردد.`
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

  const handleRunAutoNow = async () => {
    const { botToken, targetChannel } = getTargetCredentials();
    if (!botToken || !targetChannel) {
      setStatusMessage({ type: 'error', text: 'برای اجرا و تست فوری، توکن ربات و کانال مقصد الزامی است.' });
      return;
    }

    setIsSavingAuto(true);
    setStatusMessage(null);

    try {
      const intervalVal = Math.max(0.05, parseFloat(customIntervalInput) || 24);
      const payload: AutoTrendConfig = {
        ...autoConfig,
        enabled: true,
        connId: selectedConnId,
        botToken: botToken || autoConfig.botToken,
        targetChannel: targetChannel || autoConfig.targetChannel,
        topic: trendTopic.trim(),
        countPerRun: trendCount,
        intervalHours: intervalVal,
        combineIntoSinglePost: combineIntoSinglePost,
        apiKey: userAiApiKey.trim(),
        provider: userAiProvider,
      };

      await saveAutoTrendConfig(payload);

      const res = await triggerAutoTrendRunNow();
      if (res.ok) {
        if (res.config) setAutoConfig(res.config);
        setStatusMessage({
          type: 'success',
          text: `⚡ ${res.message || `ارسال فوری ترندها به کانال ${targetChannel} با موفقیت اجرا شد.`}`,
        });
      } else {
        setStatusMessage({ type: 'error', text: res.message || 'خطا در اجرای فوری ارسال ترندها.' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'خطا در ارتباط با سرور.' });
    } finally {
      setIsSavingAuto(false);
    }
  };

  return (
    <div ref={modalContainerRef} className="fixed inset-0 z-50 overflow-y-auto scroll-smooth bg-black/80 backdrop-blur-md p-3 sm:p-4 dir-rtl flex justify-center items-start min-h-full">
      <div className="relative w-full max-w-4xl neu-flat bg-slate-900/95 border border-blue-500/30 rounded-3xl p-5 sm:p-7 shadow-2xl my-auto sm:my-8 text-slate-100 shrink-0">
        
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

            {(selectedConnId === 'custom' || !selectedConnId || connections.length === 0) && (
              <>
                <input
                  type="text"
                  placeholder="توکن ربات تلگرام (botToken)..."
                  value={customBotToken}
                  onChange={(e) => setCustomBotToken(e.target.value)}
                  className="p-2.5 text-xs font-mono bg-slate-900 border border-white/20 rounded-xl text-white dir-ltr text-right focus:outline-none focus:border-blue-400"
                />
                <input
                  type="text"
                  placeholder="آیدی کانال مقصد (@channel_id)..."
                  value={customTargetChannel}
                  onChange={(e) => setCustomTargetChannel(e.target.value)}
                  className="p-2.5 text-xs font-mono bg-slate-900 border border-white/20 rounded-xl text-white dir-ltr text-right focus:outline-none focus:border-blue-400"
                />
              </>
            )}
          </div>
        </div>

        {/* Top 3 Navigation Tabs */}
        <div className="flex items-center gap-2 mb-6 p-1.5 neu-inset rounded-2xl bg-slate-950/80 border border-white/10 flex-wrap sm:flex-nowrap">
          <button
            type="button"
            onClick={() => { setActiveTab('twitter'); setStatusMessage(null); }}
            className={`flex-1 py-3 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'twitter'
                ? 'bg-gradient-to-r from-sky-600 to-blue-600 text-white shadow-lg shadow-sky-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Twitter className="w-4 h-4 text-sky-400" />
            <span>𝕏 پیج / حساب ایکس (توییتر)</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('website'); setStatusMessage(null); }}
            className={`flex-1 py-3 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'website'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Globe className="w-4 h-4 text-purple-400" />
            <span>🌐 وب‌سایت / RSS سایت</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('trends'); setStatusMessage(null); }}
            className={`flex-1 py-3 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'trends'
                ? 'bg-gradient-to-r from-amber-600 to-pink-600 text-white shadow-lg shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Flame className="w-4 h-4 text-amber-400 animate-pulse" />
            <span>🔥 کاوشگر ترندهای داغ AI</span>
          </button>
        </div>

        {/* Feedback Alert */}
        {statusMessage && (
          <div
            className={`mb-5 p-4 rounded-2xl text-xs flex items-center gap-3 shadow-md ${
              statusMessage.type === 'success'
                ? 'bg-emerald-900/80 border-2 border-emerald-400 text-white font-black'
                : statusMessage.type === 'error'
                ? 'bg-rose-200 border-2 border-rose-600 text-black font-black shadow-lg'
                : 'bg-blue-900/80 border-2 border-blue-400 text-white font-black'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle className="w-5 h-5 shrink-0 text-emerald-300" />
            ) : statusMessage.type === 'error' ? (
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-800" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0 text-amber-300" />
            )}
            <span className={`leading-relaxed text-xs font-black ${statusMessage.type === 'error' ? 'text-black font-bold' : 'text-white'}`}>
              {statusMessage.text}
            </span>
          </div>
        )}

        {/* TAB 1: Twitter (X) Source Extractor & Monitoring Creator */}
        {activeTab === 'twitter' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="p-5 neu-flat bg-slate-900/90 border border-sky-500/30 rounded-2xl space-y-4">
              <div className="flex items-center gap-3 border-b border-white/10 pb-3">
                <div className="p-2.5 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-400/30">
                  <Twitter className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">استخراج و مانیتورینگ حساب یا پست ایکس 𝕏 (توییتر)</h3>
                  <p className="text-xs text-slate-300">
                    آیدی یا لینک پست توییتر را وارد کنید تا محتوا توسط AI بازنویسی و ارسال شود یا به عنوان اتصال خودکار مانیتورینگ ثبت گردد.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-black text-white">
                  آیدی پیج یا لینک توئیت در شبکه اجتماعی ایکس 𝕏 (توییتر):
                </label>
                <input
                  type="text"
                  placeholder="مثال: @BBCPersian یا https://x.com/username/status/188000..."
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="w-full p-3 text-xs font-mono bg-slate-950 border border-white/20 rounded-xl text-white dir-ltr text-right focus:outline-none focus:border-sky-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300">
                  دستور سفارشی بازنویسی (اختیاری):
                </label>
                <input
                  type="text"
                  placeholder="مثال: لحن پست را جذاب، خبری و با هشتگ‌های مرتبط تنظیم کن."
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  className="w-full p-2.5 text-xs bg-slate-950 border border-white/10 rounded-xl text-slate-200 focus:outline-none focus:border-sky-400"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={handleExtractLink}
                  disabled={isExtracting}
                  className="w-full sm:flex-1 py-3 px-5 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                >
                  {isExtracting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      <span>در حال استخراج و پردازش AI...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>استخراج و بازنویسی دستی با AI</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleCreateMonitoringConnection(urlInput)}
                  className="w-full sm:flex-1 py-3 px-5 rounded-xl bg-gradient-to-r from-slate-800 to-slate-900 border border-sky-400/40 text-sky-300 hover:bg-slate-800 font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <PlusCircle className="w-4 h-4 text-sky-400" />
                  <span>➕ ثبت به عنوان اتصال خودکار ایکس</span>
                </button>
              </div>
            </div>

            {/* Extracted Data Result Card */}
            {extractedData && (
              <div className="p-5 neu-flat bg-slate-900 border border-sky-500/30 rounded-2xl space-y-4 animate-fadeIn">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                    <h4 className="text-xs font-black text-white">پیش‌نمایش محتوای استخراج شده توییتر</h4>
                  </div>
                  {extractedData.sourceUrl && (
                    <a
                      href={extractedData.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-sky-400 hover:underline flex items-center gap-1 font-mono dir-ltr"
                    >
                      <LinkIcon className="w-3 h-3" />
                      <span>لینک منبع</span>
                    </a>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    متن آماده جهت ارسال به تلگرام (قابل ویرایش):
                  </label>
                  <textarea
                    rows={6}
                    value={extractedData.telegramText}
                    onChange={(e) => setExtractedData({ ...extractedData, telegramText: e.target.value })}
                    className="w-full p-3 text-xs bg-slate-950 border border-white/20 rounded-xl text-slate-100 focus:outline-none focus:border-sky-400 leading-relaxed"
                  />
                </div>

                {extractedData.mediaUrls && extractedData.mediaUrls.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-300">رسانه‌های استخراج‌شده ({extractedData.mediaUrls.length}):</span>
                    <div className="flex items-center gap-2 overflow-x-auto pb-2">
                      {extractedData.mediaUrls.map((url, idx) => (
                        <img
                          key={idx}
                          src={url}
                          alt={`Media ${idx}`}
                          className="w-20 h-20 object-cover rounded-xl border border-white/10"
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={handlePostExtracted}
                    disabled={isExtracting}
                    className="py-3 px-6 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs transition-all flex items-center gap-2 cursor-pointer shadow-lg disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    <span>ارسال مستقیم این پست به کانال تلگرام</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Website / RSS Source Extractor & Monitoring Creator */}
        {activeTab === 'website' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="p-5 neu-flat bg-slate-900/90 border border-purple-500/30 rounded-2xl space-y-4">
              <div className="flex items-center gap-3 border-b border-white/10 pb-3">
                <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-400/30">
                  <Globe className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">استخراج و مانیتورینگ وب‌سایت یا RSS سایت 🌐</h3>
                  <p className="text-xs text-slate-300">
                    آدرس وب‌سایت یا فید RSS خبر را وارد کنید تا اخبار توسط AI استخراج، خلاصه و ارسال شوند یا به عنوان اتصال خودکار ثبت گردند.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-black text-white">
                  آدرس وب‌سایت یا فید RSS خبری: 🌐
                </label>
                <input
                  type="text"
                  placeholder="مثال: https://example.com/news یا https://site.com/rss"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="w-full p-3 text-xs font-mono bg-slate-950 border border-white/20 rounded-xl text-white dir-ltr text-right focus:outline-none focus:border-purple-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300">
                  دستور سفارشی بازنویسی (اختیاری):
                </label>
                <input
                  type="text"
                  placeholder="مثال: اخبار را در ۳ پاراگراف کوتاه خلاصه کن."
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  className="w-full p-2.5 text-xs bg-slate-950 border border-white/10 rounded-xl text-slate-200 focus:outline-none focus:border-purple-400"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={handleExtractLink}
                  disabled={isExtracting}
                  className="w-full sm:flex-1 py-3 px-5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                >
                  {isExtracting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      <span>در حال استخراج و پردازش AI...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>استخراج و بازنویسی دستی با AI</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleCreateMonitoringConnection(urlInput)}
                  className="w-full sm:flex-1 py-3 px-5 rounded-xl bg-gradient-to-r from-slate-800 to-slate-900 border border-purple-400/40 text-purple-300 hover:bg-slate-800 font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <PlusCircle className="w-4 h-4 text-purple-400" />
                  <span>➕ ثبت به عنوان اتصال خودکار وب‌سایت</span>
                </button>
              </div>
            </div>

            {/* Extracted Data Result Card */}
            {extractedData && (
              <div className="p-5 neu-flat bg-slate-900 border border-purple-500/30 rounded-2xl space-y-4 animate-fadeIn">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                    <h4 className="text-xs font-black text-white">پیش‌نمایش محتوای استخراج شده وب‌سایت</h4>
                  </div>
                  {extractedData.sourceUrl && (
                    <a
                      href={extractedData.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-purple-400 hover:underline flex items-center gap-1 font-mono dir-ltr"
                    >
                      <LinkIcon className="w-3 h-3" />
                      <span>لینک منبع</span>
                    </a>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    متن آماده جهت ارسال به تلگرام (قابل ویرایش):
                  </label>
                  <textarea
                    rows={6}
                    value={extractedData.telegramText}
                    onChange={(e) => setExtractedData({ ...extractedData, telegramText: e.target.value })}
                    className="w-full p-3 text-xs bg-slate-950 border border-white/20 rounded-xl text-slate-100 focus:outline-none focus:border-purple-400 leading-relaxed"
                  />
                </div>

                {extractedData.mediaUrls && extractedData.mediaUrls.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-300">رسانه‌های استخراج‌شده ({extractedData.mediaUrls.length}):</span>
                    <div className="flex items-center gap-2 overflow-x-auto pb-2">
                      {extractedData.mediaUrls.map((url, idx) => (
                        <img
                          key={idx}
                          src={url}
                          alt={`Media ${idx}`}
                          className="w-20 h-20 object-cover rounded-xl border border-white/10"
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={handlePostExtracted}
                    disabled={isExtracting}
                    className="py-3 px-6 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs transition-all flex items-center gap-2 cursor-pointer shadow-lg disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    <span>ارسال مستقیم این پست به کانال تلگرام</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 1: AI Trend Hunter & Auto Poster (Unified) */}
        {activeTab === 'trends' && (
          <div className="space-y-6">
            
            {/* User AI API Key Configuration Card */}
            <div className="p-4 neu-inset rounded-2xl border border-purple-500/30 bg-purple-950/30 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="text-xs font-black text-purple-200 flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-purple-400" />
                  <span>کلید API اختصاصی هوش مصنوعی کاربر (جهت کاوش و بروزرسانی خودکار ترندهای X):</span>
                  <span className="text-rose-400 font-bold">* (الزامی)</span>
                </label>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-amber-300 hover:text-amber-200 underline font-bold"
                >
                  دریافت کلید رایگان Gemini از Google AI Studio ➔
                </a>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="md:col-span-3">
                  <input
                    type="password"
                    value={userAiApiKey}
                    onChange={(e) => {
                      setUserAiApiKey(e.target.value);
                      localStorage.setItem('autorun_user_ai_api_key', e.target.value.trim());
                    }}
                    placeholder="کلید API اختصاصی Gemini یا سرویس مورد نظر (مثال: AIzaSy...)"
                    className="w-full p-2.5 text-xs font-mono bg-slate-900 border border-purple-500/40 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-purple-400 dir-ltr text-right"
                  />
                </div>
                <div className="md:col-span-1">
                  <select
                    value={userAiProvider}
                    onChange={(e) => setUserAiProvider(e.target.value)}
                    className="w-full p-2.5 text-xs font-bold bg-slate-900 border border-purple-500/40 rounded-xl text-white focus:outline-none focus:border-purple-400"
                  >
                    <option value="gemini">Google Gemini</option>
                    <option value="openai">OpenAI (ChatGPT)</option>
                    <option value="deepseek">DeepSeek AI</option>
                    <option value="claude">Anthropic Claude</option>
                  </select>
                </div>
              </div>
              <p className="text-[10px] text-slate-300 leading-relaxed font-medium">
                🔒 طبق دستورالعمل، کلید پیش‌فرض سیستم حذف گردیده و هر کاربر جهت دریافت و بروزرسانی خودکار ترندها باید کلید API اختصاصی خود را وارد نماید.
              </p>
            </div>

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
              <div className="space-y-2">
                <span className="text-xs font-black text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>موضوعات آماده جهت انتخاب سریع:</span>
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  {presetTopics.map((pt, idx) => {
                    const isSelected = trendTopic === pt.topic;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => updateTrendTopicShared(pt.topic)}
                        className={`px-3.5 py-2 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-2 border-amber-300 shadow-md shadow-purple-500/30 scale-105'
                            : 'bg-black text-white hover:bg-slate-900 border border-slate-700 shadow-sm'
                        }`}
                      >
                        <span>{pt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Point 3 & 4: Shared Post Count Selector */}
              <div className="pt-3 border-t border-white/10 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black text-white">تعداد پست ترند در هر بار (مشترک کاوش زنده و خودکار):</span>
                  {[1, 3, 5, 10, 15, 20, 24, 30].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => updateTrendCountShared(cnt)}
                      className={`px-3.5 py-2 text-xs font-black rounded-xl transition-all cursor-pointer ${
                        trendCount === cnt
                          ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-2 border-amber-300 shadow-md shadow-purple-500/30 scale-105'
                          : 'bg-black text-white hover:bg-slate-900 border border-slate-700 shadow-sm'
                      }`}
                    >
                      {cnt} پست
                    </button>
                  ))}

                  <div className="flex items-center gap-1.5 bg-black border border-slate-700 rounded-xl px-3.5 py-2 shadow-sm">
                    <span className="text-[11px] text-slate-100 font-bold">عدد سفارشی:</span>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={trendCount}
                      onChange={(e) => updateTrendCountShared(Math.min(30, Math.max(1, parseInt(e.target.value) || 1)))}
                      className="w-12 text-xs font-black bg-transparent text-amber-300 text-center focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-200 font-bold">پست</span>
                  </div>
                </div>
              </div>

              {/* Toggle Option for Consolidating Trends when count > 2 */}
              {trendCount > 2 && (
                <div className="p-4 bg-purple-900/60 border-2 border-purple-400/80 rounded-2xl flex items-center justify-between gap-3 text-xs shadow-lg animate-fadeIn">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-purple-500/30 text-purple-200 border border-purple-300/50 shrink-0">
                      <Sparkles className="w-5 h-5 text-amber-300" />
                    </div>
                    <div>
                      <span className="font-black text-white text-xs block mb-0.5">خلاصه‌سازی و ارسال تمام {trendCount} ترند در ۱ پیام واحد</span>
                      <span className="text-[11px] text-purple-100 font-bold leading-relaxed block">
                        اختیاری: تمام {trendCount} ترند به جای {trendCount} پست جداگانه، به صورت ۱ پیام خلاصه‌شده و شیک جمع‌بندی می‌گردند.
                      </span>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={combineIntoSinglePost}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setCombineIntoSinglePost(val);
                        setAutoConfig((prev) => ({ ...prev, combineIntoSinglePost: val }));
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
                  </label>
                </div>
              )}

              {/* Search Action Button */}
              <div className="pt-3 border-t border-white/10">
                <button
                  onClick={handleSearchTrendsManual}
                  disabled={isSearchingTrends}
                  className="w-full py-4 px-6 neu-button bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:from-purple-500 hover:via-indigo-500 hover:to-pink-500 text-white font-black text-xs sm:text-sm rounded-xl shadow-xl shadow-purple-500/25 transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
                >
                  {isSearchingTrends ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin text-amber-300" />
                      <span>در حال کاوش و استخراج ترندهای زنده...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 text-amber-300 fill-amber-300 animate-bounce" />
                      <span>🔍 کاوش و استخراج زنده ترندها (نمایش پیش‌نمایش جهت بررسی و ارسال)</span>
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
              <div className="p-4 bg-blue-900/50 border-2 border-blue-400/60 rounded-xl text-xs text-blue-100 flex items-start gap-3 shadow-md">
                <Sparkles className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-black text-white text-xs block">🔍 تضمین کاوش لحظه‌ای قبل از هر ارسال خودکار:</span>
                  <p className="text-[11px] text-blue-100 leading-relaxed font-bold">
                    ربات پیش از ارسال، مطالب قدیمی را مجدداً استفاده نمی‌کند؛ بلکه دقیقاً سر رأس هر زمان‌بندی (مثلاً هر {customIntervalInput} ساعت)، سرچ زنده آنلاین انجام داده و اخبار، ترندها، جوک‌ها و میم‌های همان لحظه را استخراج، بازنویسی و مستقیماً به کانال ارسال می‌کند.
                  </p>
                </div>
              </div>

              {/* Point 3: Customizable Interval controls */}
              <div className="space-y-2.5">
                <label className="block text-xs font-black text-white flex items-center gap-1.5">
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
                      className={`px-3.5 py-2 text-xs font-black rounded-xl transition-all cursor-pointer ${
                        Number(customIntervalInput) === preset.hrs
                          ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-2 border-amber-300 shadow-md shadow-purple-500/30 scale-105'
                          : 'bg-black text-white hover:bg-slate-900 border border-slate-700 shadow-sm'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}

                  <div className="flex items-center gap-1.5 bg-black border border-slate-700 rounded-xl px-3.5 py-2 shadow-sm">
                    <span className="text-[11px] text-slate-100 font-bold">ساعات کاستوم:</span>
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
                      className="w-16 text-xs font-black bg-transparent text-amber-300 text-center focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-200 font-bold">ساعت</span>
                  </div>
                </div>
              </div>

              {/* Clear Schedule Example Card */}
              <div className="p-4 bg-emerald-900/50 border-2 border-emerald-400/60 rounded-xl text-xs text-emerald-100 space-y-2 shadow-md">
                <div className="flex items-center gap-1.5 font-black text-amber-300 text-xs">
                  <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
                  <span>💡 توضیح نحوه عملکرد دقیق این تنظیمات:</span>
                </div>
                <p className="text-[11px] text-emerald-100 leading-relaxed font-bold">
                  اگر فاصله زمانی را روی <strong>{Number(customIntervalInput) < 1 ? `${Math.round(Number(customIntervalInput) * 60)} دقیقه` : `${customIntervalInput} ساعت`}</strong> و تعداد را روی <strong>{trendCount} پست</strong> قرار دهید؛ سیستم سر رأس هر <strong>{Number(customIntervalInput) < 1 ? `${Math.round(Number(customIntervalInput) * 60)} دقیقه` : `${customIntervalInput} ساعت`}</strong> یک‌بار، ابتدا سرچ زنده در توییتر/X و وب درباره «{trendTopic}» انجام داده و {combineIntoSinglePost && trendCount > 2 ? <strong>تمام {trendCount} ترند تازه همان لحظه را در ۱ پیام خلاصه‌شده‌ی واحد</strong> : <strong>تعداد {trendCount} پست تازه و داغ همان لحظه</strong>} را پیدا کرده و همزمان به کانال تلگرام ارسال می‌کند.
                </p>
              </div>

              {/* Status & Save Button */}
              <div className="flex items-center justify-between gap-3 pt-2 flex-wrap">
                <div className="text-xs text-slate-300 font-bold flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${autoConfig.enabled ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`}></span>
                  <span>وضعیت ارسال خودکار: {autoConfig.enabled ? `فعال (هر ${customIntervalInput} ساعت)` : 'غیرفعال'}</span>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                  <button
                    onClick={handleRunAutoNow}
                    disabled={isSavingAuto}
                    type="button"
                    className="py-2.5 px-4 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-black text-xs rounded-xl shadow-lg shadow-orange-900/30 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSavingAuto ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Zap className="w-4 h-4 text-amber-200 fill-amber-200" />
                    )}
                    <span>🚀 تست و اجرای فوری ارسال ترندها به کانال</span>
                  </button>

                  <button
                    onClick={handleSaveAutoSettings}
                    disabled={isSavingAuto}
                    type="button"
                    className="py-2.5 px-4 neu-button bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSavingAuto ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Settings className="w-4 h-4" />
                    )}
                    <span>ذخیره تنظیمات ارسال خودکار</span>
                  </button>
                </div>
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
                        <span className={log.status === 'success' ? 'text-emerald-300 font-bold' : 'text-white font-black bg-rose-900/90 px-2 py-0.5 rounded border border-rose-500'}>
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
                <div className="flex items-center justify-between flex-wrap gap-2 p-3 bg-purple-950/40 border border-purple-500/30 rounded-2xl">
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <Flame className="w-4 h-4 text-amber-400" />
                    <span>نتایج استخراج شده ترندهای X (تعداد: {trendResults.length}):</span>
                  </h3>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={scrollToTop}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-400/40 text-xs font-bold rounded-xl flex items-center gap-1 cursor-pointer transition-all shadow-sm"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                      <span>بازگشت به بالای پنل X</span>
                    </button>

                    {trendResults.length > 1 && (
                      <button
                        type="button"
                        onClick={handlePostAllCombined}
                        disabled={isInstantPosting}
                        className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        <span>⚡ ارسال یکجای تمام {trendResults.length} ترند در ۱ پیام خلاصه‌شده</span>
                      </button>
                    )}
                  </div>
                </div>

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
                    <div className="bg-black p-3.5 rounded-xl border border-slate-700 space-y-2 shadow-sm">
                      <div className="flex items-center gap-1.5 text-white font-black text-xs">
                        <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
                        <span>خلاصه منبع اصلی (کاور شده از X و وب):</span>
                      </div>
                      <p className="text-xs font-sans text-slate-100 font-bold leading-relaxed bg-slate-900 p-3 rounded-lg border border-slate-700">
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

                    {item.mediaUrls && item.mediaUrls.length > 0 && (
                      <div className="space-y-2 pt-1">
                        <span className="text-xs font-bold text-slate-300">تصاویر/رسانه‌های ترند ({item.mediaUrls.length}):</span>
                        <div className="flex items-center gap-2 overflow-x-auto pb-2">
                          {item.mediaUrls.map((url, mIdx) => (
                            <img
                              key={mIdx}
                              src={url}
                              alt={`Trend Media ${mIdx}`}
                              className="w-20 h-20 object-cover rounded-xl border border-white/10"
                            />
                          ))}
                        </div>
                      </div>
                    )}

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

                {/* Bottom Scroll-To-Top Button */}
                <div className="pt-3 pb-1 flex justify-center">
                  <button
                    type="button"
                    onClick={scrollToTop}
                    className="px-6 py-3 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 text-black font-black text-xs rounded-2xl shadow-xl transition-all flex items-center gap-2 cursor-pointer scale-105 hover:scale-110"
                  >
                    <ArrowUp className="w-4 h-4 text-black stroke-[3]" />
                    <span>⬆️ بازگشت به ابتدای پنل X</span>
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
