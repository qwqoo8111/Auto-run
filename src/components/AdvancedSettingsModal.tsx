import React, { useEffect, useState } from 'react';
import { 
  X, Plus, Trash2, Save, Sliders, Sparkles, CheckCircle2, RefreshCw, 
  Eye, Replace, FileText, Filter, Bot, ShieldCheck, Tag, Link2, Globe, Cpu, Key, Lock, Crown,
  CopyCheck, ShieldAlert
} from 'lucide-react';
import { TelegramConnection, AdvancedSettings, TextReplacementRule, RewriteMode, ContentFilter, AiProvider, User } from '../types';
import { updateConnectionSettings, testAiApi, testBaleBot, cleanDuplicates } from '../services/api';

interface AdvancedSettingsModalProps {
  connection: TelegramConnection | null;
  onClose: () => void;
  onSaved: () => void;
  currentUser?: User | null;
  onOpenSubscriptions?: () => void;
}

const PROVIDERS: {
  id: AiProvider;
  name: string;
  badge: string;
  icon: string;
  color: string;
  keyLink: string;
  keyTip: string;
  models: { id: string; label: string }[];
}[] = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    badge: 'پیش‌فرض / رایگان',
    icon: '🤖',
    color: 'border-purple-500/30 text-purple-300 bg-purple-950/20',
    keyLink: 'https://aistudio.google.com/app/apikey',
    keyTip: 'کلید رایگان از گوگل AI Studio (با جیمیل)',
    models: [
      { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash (پیشنهادی - هوشمند و سریع)' },
      { id: 'gemini-flash-latest', label: 'Gemini Flash Latest (آخرین نسخه فلاش)' },
      { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite (فوق‌العاده سریع)' },
      { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (استدلال پیشرفته و کیفیت بالا)' },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI (ChatGPT)',
    badge: 'GPT-4o & GPT-4o-mini',
    icon: '⚡',
    color: 'border-emerald-500/30 text-emerald-300 bg-emerald-950/20',
    keyLink: 'https://platform.openai.com/api-keys',
    keyTip: 'کلید اختصاصی از OpenAI Platform',
    models: [
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini (سریع، کم‌هزینه و هوشمند)' },
      { id: 'gpt-4o', label: 'GPT-4o (قدرتمندترین مدل هوش مصنوعی)' },
      { id: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
      { id: 'o3-mini', label: 'o3-mini (مدل استدلالی)' },
    ],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek AI',
    badge: 'DeepSeek V3 & R1',
    icon: '🐳',
    color: 'border-cyan-500/30 text-cyan-300 bg-cyan-950/20',
    keyLink: 'https://platform.deepseek.com/api_keys',
    keyTip: 'کلید اقتصادی از پنل DeepSeek',
    models: [
      { id: 'deepseek-chat', label: 'DeepSeek V3 (DeepSeek Chat - بسیار عالی)' },
      { id: 'deepseek-reasoner', label: 'DeepSeek R1 (Reasoner - استدلال پیشرفته)' },
    ],
  },
  {
    id: 'claude',
    name: 'Anthropic Claude',
    badge: 'Claude 3.5 Sonnet',
    icon: '🧠',
    color: 'border-amber-500/30 text-amber-300 bg-amber-950/20',
    keyLink: 'https://console.anthropic.com/settings/keys',
    keyTip: 'کلید اختصاصی از Console Anthropic',
    models: [
      { id: 'claude-3-5-sonnet-latest', label: 'Claude 3.5 Sonnet (بهترین در نگارش فارسی)' },
      { id: 'claude-3-5-haiku-latest', label: 'Claude 3.5 Haiku (فوق‌العاده سریع)' },
      { id: 'claude-3-opus-latest', label: 'Claude 3 Opus' },
    ],
  },
  {
    id: 'custom_openai',
    name: 'سرویس دلخواه / OpenRouter / Groq',
    badge: 'API استاندارد OpenAI',
    icon: '🌐',
    color: 'border-blue-500/30 text-blue-300 bg-blue-950/20',
    keyLink: 'https://openrouter.ai/keys',
    keyTip: 'اتصال به OpenRouter, Groq, Together, Ollama یا سرور شخصی',
    models: [
      { id: 'meta-llama/llama-3.3-70b-instruct', label: 'OpenRouter: Llama 3.3 70B' },
      { id: 'llama-3.3-70b-versatile', label: 'Groq: Llama 3.3 70B Versatile' },
      { id: 'deepseek/deepseek-r1', label: 'OpenRouter: DeepSeek R1' },
      { id: 'custom', label: 'نام مدل سفارشی دلخواه (تایپ دستی)' },
    ],
  },
];

export const AdvancedSettingsModal: React.FC<AdvancedSettingsModalProps> = ({
  connection,
  onClose,
  onSaved,
  currentUser,
  onOpenSubscriptions,
}) => {
  const isSubscribed = currentUser?.role === 'admin' || (currentUser?.plan !== 'free' && currentUser?.subscriptionStatus === 'active');
  const [rewriteMode, setRewriteMode] = useState<RewriteMode>('none');
  const [aiPrompt, setAiPrompt] = useState<string>('متن زیر را به صورت جذاب، روان، خوانا و پرمخاطب بازنویسی کن:');
  
  // AI Settings State
  const [aiProvider, setAiProvider] = useState<AiProvider>('gemini');
  const [aiApiKey, setAiApiKey] = useState<string>('');
  const [aiModel, setAiModel] = useState<string>('gemini-3.6-flash');
  const [aiCustomBaseUrl, setAiCustomBaseUrl] = useState<string>('https://openrouter.ai/api/v1');
  const [customModelInput, setCustomModelInput] = useState<string>('');

  const [replacements, setReplacements] = useState<TextReplacementRule[]>([]);
  const [signature, setSignature] = useState<string>('');
  const [removeSourceLinks, setRemoveSourceLinks] = useState<boolean>(true);
  const [cleanTagsAndLinks, setCleanTagsAndLinks] = useState<boolean>(false);
  const [contentFilter, setContentFilter] = useState<ContentFilter>('all');

  const [saving, setSaving] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // Live AI Test States
  const [testingAi, setTestingAi] = useState<boolean>(false);
  const [aiTestResult, setAiTestResult] = useState<string | null>(null);
  const [aiTestError, setAiTestError] = useState<string | null>(null);

  // Live Preview Sample Text
  const [sampleText, setSampleText] = useState<string>('');

  // Bale Integration State
  const [enableBale, setEnableBale] = useState<boolean>(false);
  const [baleTargetChannel, setBaleTargetChannel] = useState<string>('');
  const [baleBotToken, setBaleBotToken] = useState<string>('');
  const [baleReplaceId, setBaleReplaceId] = useState<string>('');
  const [testingBale, setTestingBale] = useState<boolean>(false);
  const [baleStatusMsg, setBaleStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Duplicate Protection State
  const [preventDuplicates, setPreventDuplicates] = useState<boolean>(true);
  const [duplicateSimilarityThreshold, setDuplicateSimilarityThreshold] = useState<number>(80);
  const [duplicateAction, setDuplicateAction] = useState<'skip' | 'delete_existing'>('skip');
  const [checkMediaDuplicate, setCheckMediaDuplicate] = useState<boolean>(true);
  const [cleaningDuplicates, setCleaningDuplicates] = useState<boolean>(false);
  const [cleanDuplicatesResult, setCleanDuplicatesResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    if (connection) {
      const s = connection.settings || {};
      setRewriteMode(s.rewriteMode || 'none');
      setAiPrompt(s.aiPrompt || 'متن زیر را به صورت جذاب، روان، خوانا و پرمخاطب بازنویسی کن:');
      
      const prov = s.aiProvider || 'gemini';
      setAiProvider(prov);
      setAiApiKey(s.aiApiKey || s.geminiApiKey || '');
      let loadedModel = s.aiModel;
      if (prov === 'gemini') {
        if (!loadedModel || loadedModel === 'gemini-2.0-flash' || loadedModel === 'gemini-1.5-flash') {
          loadedModel = 'gemini-3.6-flash';
        } else if (loadedModel === 'gemini-1.5-pro') {
          loadedModel = 'gemini-3.1-pro-preview';
        }
      } else if (!loadedModel) {
        loadedModel = prov === 'openai' ? 'gpt-4o-mini' : prov === 'deepseek' ? 'deepseek-chat' : prov === 'claude' ? 'claude-3-5-sonnet-latest' : 'meta-llama/llama-3.3-70b-instruct';
      }
      setAiModel(loadedModel);
      setAiCustomBaseUrl(s.aiCustomBaseUrl || 'https://openrouter.ai/api/v1');

      setReplacements(s.replacements || []);
      setSignature(s.signature !== undefined ? s.signature : `🆔 ${connection.targetChannel}`);
      setRemoveSourceLinks(s.removeSourceLinks !== undefined ? s.removeSourceLinks : true);
      setCleanTagsAndLinks(!!s.cleanTagsAndLinks);
      setContentFilter(s.contentFilter || 'all');

      setPreventDuplicates(s.preventDuplicates !== undefined ? !!s.preventDuplicates : true);
      setDuplicateSimilarityThreshold(s.duplicateSimilarityThreshold ?? 80);
      setDuplicateAction(s.duplicateAction || 'skip');
      setCheckMediaDuplicate(s.checkMediaDuplicate !== undefined ? !!s.checkMediaDuplicate : true);

      setEnableBale(!!s.enableBale || !!connection.enableBale);
      setBaleTargetChannel(s.baleTargetChannel || connection.baleTargetChannel || '');
      setBaleBotToken(s.baleBotToken || connection.baleBotToken || '');
      setBaleReplaceId(s.baleReplaceId || connection.baleReplaceId || '');

      setSampleText(
        `پست جدید در کانال ${connection.sourceChannel}\nبرای خرید و ثبت سفارش به آیدی ${connection.sourceChannel} پیام دهید.\nلینک کانال: https://t.me/${connection.sourceChannel.replace('@', '')}\n#فروشگاه #تخفیف`
      );
    }
  }, [connection]);

  if (!connection) return null;

  const currentProviderConfig = PROVIDERS.find((p) => p.id === aiProvider) || PROVIDERS[0];

  const handleProviderSelect = (pId: AiProvider) => {
    setAiProvider(pId);
    const target = PROVIDERS.find((p) => p.id === pId);
    if (target && target.models.length > 0) {
      setAiModel(target.models[0].id);
    }
  };

  const handleTestAi = async () => {
    setTestingAi(true);
    setAiTestResult(null);
    setAiTestError(null);

    const activeModel = aiModel === 'custom' ? customModelInput.trim() : aiModel;

    try {
      const data = await testAiApi({
        provider: aiProvider,
        apiKey: aiApiKey.trim(),
        model: activeModel,
        customBaseUrl: aiCustomBaseUrl.trim(),
        prompt: aiPrompt.trim(),
        sampleText: sampleText.trim() || 'این یک نمونه متن برای تست هوش مصنوعی است.',
      });
      if (data && data.result) {
        setAiTestResult(data.result);
      } else {
        setAiTestError('پاسخی از هوش مصنوعی دریافت نشد.');
      }
    } catch (err: any) {
      setAiTestError(err.message || 'خطا در ارتباط با سرور');
    } finally {
      setTestingAi(false);
    }
  };

  const handleAddRule = () => {
    setReplacements([
      ...replacements,
      { id: `rule_${Date.now()}`, find: '', replace: '', isRegex: false },
    ]);
  };

  const handleRemoveRule = (id: string) => {
    setReplacements(replacements.filter((r) => r.id !== id));
  };

  const handleRuleChange = (id: string, field: 'find' | 'replace' | 'isRegex', value: any) => {
    setReplacements(
      replacements.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const handleQuickAddSourceReplace = () => {
    const cleanSource = connection.sourceChannel.replace(/^@/, '');
    const cleanTarget = connection.targetChannel.replace(/^@/, '');
    setReplacements([
      ...replacements,
      {
        id: `rule_${Date.now()}`,
        find: `@${cleanSource}`,
        replace: `@${cleanTarget}`,
        isRegex: false,
      },
    ]);
  };

  // Preview Transformation Computation
  const getTransformedPreview = () => {
    let text = sampleText;
    if (!text && !signature) return '';

    const cleanEmptyIdLines = (str: string): string => {
      if (!str) return '';
      let cleaned = str.replace(/^[ \t]*(آیدی|شناسه|لینک|کانال)?[ \t:]*🆔[ \t:\-–—]*@?[ \t]*$/gm, '');
      cleaned = cleaned.replace(/🆔[ \t]*(\r?\n[ \t]*)*🆔/g, '🆔');
      cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
      return cleaned.trim();
    };

    const cleanSource = connection.sourceChannel.replace(/^@/, '');
    const cleanTarget = connection.targetChannel.replace(/^@/, '');

    // 1. Clean Source Links & Handles
    if (removeSourceLinks || cleanTagsAndLinks) {
      if (cleanSource) {
        const sourceRegex = new RegExp(`@?${cleanSource}`, 'gi');
        text = text.replace(sourceRegex, cleanTarget ? `@${cleanTarget}` : '');

        const tmeRegex = new RegExp(`https?:\\/\\/t\\.me\\/(s\\/)?${cleanSource}[^\\s]*`, 'gi');
        text = text.replace(tmeRegex, '');
      }

      if (cleanTagsAndLinks) {
        // Remove all HTML anchor tags and broken fragments like <a href=" or <a href="...">
        text = text.replace(/<a\s+href=["']?[^"'>]*["']?>?/gi, '');
        text = text.replace(/<a\b[^>]*>?/gi, '');
        text = text.replace(/<\/a>/gi, '');
        text = text.replace(/<a\s+href="?/gi, '');
        text = text.replace(/<[^>]+>/g, '');

        // Remove all URLs, t.me links, usernames, and hashtags
        text = text.replace(/https?:\/\/[^\s<]+/g, '');
        text = text.replace(/t\.me\/[^\s<]+/g, '');
        text = text.replace(/@[a-zA-Z0-9_]+/g, '');
        text = text.replace(/#[a-zA-Z0-9_آ-ی]+/g, '');
        text = text.replace(/\n{3,}/g, '\n\n');
      }
    }

    text = cleanEmptyIdLines(text);

    // 2. Mode preview
    if (rewriteMode === 'ai') {
      const pName = currentProviderConfig.name;
      const mName = aiModel === 'custom' ? (customModelInput || 'سفارشی') : aiModel;
      text = `[✨ بازنویسی هوش مصنوعی (${pName} - ${mName})]: \n"محتوای جدید و جذابی بر اساس متن اصلی تولید خواهد شد."`;
    } else if (rewriteMode === 'replace') {
      for (const rule of replacements) {
        if (!rule.find) continue;
        const repVal = rule.replace || '';
        if (rule.isRegex) {
          try {
            const reg = new RegExp(rule.find, 'gi');
            text = text.replace(reg, repVal);
          } catch (e) {
            text = text.split(rule.find).join(repVal);
          }
        } else {
          text = text.split(rule.find).join(repVal);
        }
      }
    }

    // 3. Append Signature
    if (signature && signature.trim()) {
      text = `${text.trim()}\n\n${signature.trim()}`;
    }

    return cleanEmptyIdLines(text);
  };

  const handleTestBale = async () => {
    if (!baleBotToken.trim() || !baleTargetChannel.trim()) {
      setBaleStatusMsg({ type: 'error', text: 'لطفاً ابتدا توکن ربات بله و شناسه کانال بله را وارد کنید.' });
      return;
    }

    setTestingBale(true);
    setBaleStatusMsg(null);
    try {
      const res = await testBaleBot(baleBotToken.trim(), baleTargetChannel.trim());
      setBaleStatusMsg({ type: 'success', text: res.message });
    } catch (err: any) {
      setBaleStatusMsg({ type: 'error', text: err.message || 'خطا در اتصال به پیام‌رسان بله.' });
    } finally {
      setTestingBale(false);
    }
  };

  const handleCleanDuplicatesNow = async () => {
    if (!connection) return;
    setCleaningDuplicates(true);
    setCleanDuplicatesResult(null);
    try {
      const res = await cleanDuplicates(connection.id);
      setCleanDuplicatesResult({ ok: res.ok, message: res.message });
      onSaved();
    } catch (err: any) {
      setCleanDuplicatesResult({ ok: false, message: err.message || 'خطا در پاکسازی پست‌های تکراری' });
    } finally {
      setCleaningDuplicates(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSavedSuccess(false);
    try {
      const activeModel = aiModel === 'custom' ? customModelInput.trim() : aiModel;
      const newSettings: AdvancedSettings = {
        rewriteMode,
        aiPrompt,
        aiProvider,
        aiApiKey,
        aiModel: activeModel,
        aiCustomBaseUrl,
        geminiApiKey: aiProvider === 'gemini' ? aiApiKey : undefined,
        replacements: replacements.filter((r) => r.find.trim() !== ''),
        signature,
        removeSourceLinks,
        cleanTagsAndLinks,
        contentFilter,
        enableBale,
        baleTargetChannel: baleTargetChannel.trim(),
        baleBotToken: baleBotToken.trim(),
        baleReplaceId: baleReplaceId.trim(),
        preventDuplicates,
        duplicateSimilarityThreshold,
        duplicateAction,
        checkMediaDuplicate,
      };
      await updateConnectionSettings(connection.id, newSettings);
      setSavedSuccess(true);
      onSaved();
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 1000);
    } catch (err: any) {
      alert(err.message || 'خطا در ذخیره تنظیمات');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 md:p-4">
      <div className="neu-flat w-full max-w-4xl max-h-[92vh] flex flex-col border border-white/10 overflow-hidden shadow-2xl">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-white/5 flex items-center justify-between bg-black/20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 neu-inset rounded-xl text-yellow-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">تنظیمات پیشرفته و فیلترهای هوشمند</h3>
              <p className="text-xs text-slate-400 mt-0.5 dir-ltr text-right">
                {connection.sourceChannel} ➔ {connection.targetChannel}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="neu-btn-secondary p-2 text-slate-300 hover:text-red-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-6">
          
          {/* Section 1: Content Filter (چه محتواهایی فوروارد شوند؟) */}
          <div className="neu-inset p-4 space-y-3 border border-white/5">
            <div className="flex items-center gap-2 text-xs font-bold text-yellow-400">
              <Filter className="w-4 h-4" />
              <span>چه محتواهایی فوروارد شوند؟ (فیلتر محتوا)</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
              {[
                { id: 'all', title: 'همه محتواها', desc: 'متن، عکس، ویدیو، ویس و ویدیومسیج' },
                { id: 'text_only', title: 'فقط متن‌ها', desc: 'بدون هیچ فایل یا رسانه' },
                { id: 'text_and_photo', title: 'متن و عکس', desc: 'ارسال عکس و متن' },
                { id: 'text_and_video', title: 'متن و ویدیو', desc: 'ارسال ویدیو و متن' },
                { id: 'text_and_voice', title: 'متن و ویس (صوتی)', desc: 'ارسال پیام‌های صوتی و ویس' },
                { id: 'text_and_video_note', title: 'متن و ویس ویدیو (دایره‌ای)', desc: 'ارسال ویدیوهای دایره‌ای (ویس ویدیو)' },
                { id: 'voice_only', title: 'فقط ویس‌های صوتی', desc: 'فقط پیام صوتی/ویس' },
                { id: 'video_note_only', title: 'فقط ویس ویدیو', desc: 'فقط ویدیو دایره‌ای' },
              ].map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setContentFilter(item.id as ContentFilter)}
                  className={`p-3 rounded-xl border text-right transition-all flex flex-col justify-between ${
                    contentFilter === item.id
                      ? 'bg-yellow-400/10 border-yellow-400 text-yellow-400 shadow-lg'
                      : 'bg-black/20 border-white/5 text-slate-400 hover:border-white/20'
                  }`}
                >
                  <span className="text-xs font-bold block">{item.title}</span>
                  <span className="text-[10px] text-slate-500 mt-1">{item.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Section 2: Text Rewrite Mode (تغییر و بازنویسی متن پیام) */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-white">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>تغییر و بازنویسی متن پیام</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { id: 'none', label: 'بدون تغییر', desc: 'ارسال دقیق متن اصلی' },
                { id: 'ai', label: 'بازنویسی با هوش مصنوعی', desc: 'بازنویسی هوشمند توسط Gemini' },
                { id: 'replace', label: 'جایگزینی کلمات', desc: 'تغییر کلمات بر اساس قوانین شما' },
              ].map((mode) => (
                <button
                  type="button"
                  key={mode.id}
                  onClick={() => setRewriteMode(mode.id as RewriteMode)}
                  className={`p-3.5 rounded-xl border text-right transition-all ${
                    rewriteMode === mode.id
                      ? 'bg-blue-500/15 border-blue-400 text-blue-400 font-bold'
                      : 'bg-black/20 border-white/5 text-slate-400 hover:border-white/20'
                  }`}
                >
                  <div className="text-xs font-bold">{mode.label}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{mode.desc}</div>
                </button>
              ))}
            </div>

            {/* AI Custom Prompt & API Key Option if AI mode active */}
            {rewriteMode === 'ai' && (
              <div className="neu-inset p-4 space-y-4 rounded-xl border border-purple-500/30 bg-purple-950/15">
                <div className="flex items-center justify-between border-b border-purple-500/20 pb-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-purple-300">
                    <Bot className="w-4.5 h-4.5 text-purple-400" />
                    <span>تنظیمات موتور هوش مصنوعی</span>
                  </div>
                  <span className="text-[11px] font-semibold text-purple-300 bg-purple-500/15 px-2.5 py-0.5 rounded-full border border-purple-500/30 flex items-center gap-1">
                    <span>{currentProviderConfig.icon}</span>
                    <span>{currentProviderConfig.name}</span>
                  </span>
                </div>

                {/* Provider Selector */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-purple-200">
                    ۱. انتخاب سرویس هوش مصنوعی (Provider):
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                    {PROVIDERS.map((p) => (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => handleProviderSelect(p.id)}
                        className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                          aiProvider === p.id
                            ? 'bg-purple-600/25 border-purple-400 text-white font-bold ring-1 ring-purple-400 shadow-lg'
                            : 'bg-black/40 border-white/10 text-slate-400 hover:border-purple-500/40 hover:text-purple-200'
                        }`}
                      >
                        <span className="text-base">{p.icon}</span>
                        <span className="text-xs font-bold line-clamp-1">{p.name}</span>
                        <span className="text-[9px] text-purple-300/80 bg-purple-500/10 px-1.5 py-0.2 rounded-full border border-purple-500/20">
                          {p.badge}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Model Selector */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-purple-200">
                    ۲. انتخاب مدل هوش مصنوعی (Model):
                  </label>
                  <select
                    value={aiModel}
                    onChange={(e) => setAiModel(e.target.value)}
                    className="w-full bg-black/60 border border-white/15 px-3 py-2 text-xs rounded-lg text-white focus:outline-none focus:border-purple-400 font-mono"
                  >
                    {currentProviderConfig.models.map((m) => (
                      <option key={m.id} value={m.id} className="bg-slate-900 text-white">
                        {m.label} ({m.id})
                      </option>
                    ))}
                  </select>

                  {/* If custom model selected */}
                  {aiModel === 'custom' && (
                    <input
                      type="text"
                      value={customModelInput}
                      onChange={(e) => setCustomModelInput(e.target.value)}
                      placeholder="نام دقیق مدل را وارد کنید (مثلا: meta-llama/llama-3.3-70b-instruct)"
                      className="w-full mt-1 bg-black/60 border border-purple-400 px-3 py-2 text-xs rounded-lg text-white placeholder-slate-500 focus:outline-none font-mono dir-ltr text-right"
                    />
                  )}
                </div>

                {/* Custom Base URL (Visible if custom_openai) */}
                {aiProvider === 'custom_openai' && (
                  <div className="space-y-1.5 bg-blue-950/20 p-2.5 rounded-lg border border-blue-500/30">
                    <label className="block text-xs font-bold text-blue-300 flex items-center gap-1">
                      <Globe className="w-3.5 h-3.5 text-blue-400" />
                      <span>آدرس پایه API (Base URL):</span>
                    </label>
                    <input
                      type="text"
                      value={aiCustomBaseUrl}
                      onChange={(e) => setAiCustomBaseUrl(e.target.value)}
                      placeholder="مثال: https://openrouter.ai/api/v1 یا https://api.groq.com/openai/v1"
                      className="w-full bg-black/60 border border-white/15 px-3 py-2 text-xs rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-400 font-mono dir-ltr text-right"
                    />
                  </div>
                )}

                {/* API Key Input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-purple-200 flex items-center gap-1">
                      <Key className="w-3.5 h-3.5 text-purple-400" />
                      <span>کلید API Key ({currentProviderConfig.name}):</span>
                    </label>
                    {aiProvider === 'gemini' && (
                      <span className="text-[10px] text-yellow-400 font-semibold">
                        (در صورت خالی بودن از کلید پیش‌فرض سرور استفاده می‌شود)
                      </span>
                    )}
                  </div>
                  <input
                    type="password"
                    value={aiApiKey}
                    onChange={(e) => setAiApiKey(e.target.value)}
                    placeholder={
                      aiProvider === 'gemini'
                        ? 'AIzaSy... (اختیاری برای Gemini)'
                        : aiProvider === 'openai'
                        ? 'sk-proj-... (کلید OpenAI)'
                        : aiProvider === 'deepseek'
                        ? 'sk-... (کلید DeepSeek)'
                        : aiProvider === 'claude'
                        ? 'sk-ant-api03-... (کلید Claude)'
                        : 'کلید API سرویس مورد نظر'
                    }
                    className="w-full bg-black/60 border border-white/15 px-3 py-2 text-xs rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-purple-400 font-mono dir-ltr text-right"
                  />
                  <p className="text-[10px] text-slate-400 flex items-center gap-1">
                    💡 <span className="text-purple-300">راهنما:</span> {currentProviderConfig.keyTip} ➔
                    <a
                      href={currentProviderConfig.keyLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-yellow-400 underline hover:text-yellow-300 font-bold"
                    >
                      دریافت کلید API
                    </a>
                  </p>
                </div>

                {/* AI Prompt Input */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-purple-200">
                    دستور سفارشی برای هوش مصنوعی (AI Prompt):
                  </label>
                  <input
                    type="text"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="مثال: متن را با لحنی جذاب و پرمخاطب بازنویسی کن و هیچ لینک اضافه‌ای نزار"
                    className="w-full bg-black/60 border border-white/15 px-3 py-2 text-xs rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-purple-400"
                  />
                </div>

                {/* Live Test AI Button */}
                <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={handleTestAi}
                    disabled={testingAi}
                    className="neu-btn-secondary px-3 py-2 text-xs font-bold text-purple-300 border-purple-500/30 flex items-center justify-center gap-1.5 hover:bg-purple-500/20"
                  >
                    {testingAi ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-300" />
                        <span>در حال ارسال درخواست به {currentProviderConfig.name}...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                        <span>تست زنده عملکرد ({currentProviderConfig.name})</span>
                      </>
                    )}
                  </button>
                  <span className="text-[10px] text-slate-400 text-center sm:text-right">
                    متن نمونه پایین کادر برای تست زنده استفاده می‌شود
                  </span>
                </div>

                {/* AI Test Results */}
                {aiTestResult && (
                  <div className="p-3 bg-purple-900/30 border border-purple-500/30 rounded-xl space-y-1">
                    <span className="text-[11px] font-bold text-purple-300 block">✨ پاسخ هوش مصنوعی ({currentProviderConfig.name}):</span>
                    <p className="text-xs text-purple-100 whitespace-pre-wrap">{aiTestResult}</p>
                  </div>
                )}

                {aiTestError && (
                  <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-xl space-y-1 text-xs text-red-300">
                    <span className="font-bold block">❌ خطا در اتصال به هوش مصنوعی:</span>
                    <span>{aiTestError}</span>
                  </div>
                )}
              </div>
            )}

            {/* Word Replacement Rules Table if Replace mode active */}
            {rewriteMode === 'replace' && (
              <div className="neu-inset p-3.5 space-y-3 rounded-xl border border-blue-500/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-300">لیست قوانین جایگزینی کلمات:</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleQuickAddSourceReplace}
                      className="neu-btn-secondary px-2.5 py-1 text-[11px] font-semibold text-yellow-400"
                    >
                      + جایگزینی آیدی مبدأ با مقصد
                    </button>
                    <button
                      type="button"
                      onClick={handleAddRule}
                      className="neu-btn-primary px-2.5 py-1 text-[11px] font-bold text-black flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>افزودن کلمه</span>
                    </button>
                  </div>
                </div>

                {replacements.length === 0 ? (
                  <div className="text-center text-xs text-slate-500 py-3">
                    هیچ قانونی تعریف نشده است.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {replacements.map((rule, idx) => (
                      <div key={rule.id} className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 w-4">{idx + 1}.</span>
                        <input
                          type="text"
                          value={rule.find}
                          onChange={(e) => handleRuleChange(rule.id, 'find', e.target.value)}
                          placeholder="کلمه/عبارت مبدأ"
                          className="flex-1 bg-black/40 border border-white/10 px-2.5 py-1.5 text-xs rounded-lg text-white focus:border-yellow-400 dir-ltr text-right"
                        />
                        <span className="text-slate-500 text-xs">➔</span>
                        <input
                          type="text"
                          value={rule.replace}
                          onChange={(e) => handleRuleChange(rule.id, 'replace', e.target.value)}
                          placeholder="کلمه جدید (یا خالی برای حذف)"
                          className="flex-1 bg-black/40 border border-white/10 px-2.5 py-1.5 text-xs rounded-lg text-white focus:border-blue-400 dir-ltr text-right"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveRule(rule.id)}
                          className="p-1.5 text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 3: Source Cleanup Controls */}
          <div className="neu-inset p-4 space-y-3 border border-white/5">
            <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              <span>تنظیمات پاکسازی لینک‌ها و آیدی‌های کانال مبدأ</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <label className="flex items-start gap-3 neu-inset p-3 cursor-pointer hover:bg-white/5 transition-colors rounded-xl">
                <input
                  type="checkbox"
                  checked={removeSourceLinks}
                  onChange={(e) => setRemoveSourceLinks(e.target.checked)}
                  className="w-4 h-4 mt-0.5 accent-emerald-400 rounded"
                />
                <div className="text-xs">
                  <span className="font-bold text-white block">حذف خودکار تمام لینک‌ها، منشن‌ها و آیدی‌های تلگرامی کانال مبدأ</span>
                  <span className="text-slate-400 mt-0.5 block text-[11px]">
                    جایگزینی یا حذف آیدی {connection.sourceChannel} و لینک‌های t.me مربوط به آن
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 neu-inset p-3 cursor-pointer hover:bg-white/5 transition-colors rounded-xl">
                <input
                  type="checkbox"
                  checked={cleanTagsAndLinks}
                  onChange={(e) => setCleanTagsAndLinks(e.target.checked)}
                  className="w-4 h-4 mt-0.5 accent-emerald-400 rounded"
                />
                <div className="text-xs">
                  <span className="font-bold text-white block">پاکسازی کلی تمام تگ‌ها (#) و لینک‌های وب</span>
                  <span className="text-slate-400 mt-0.5 block text-[11px]">
                    حذف تمام لینک‌های اینترنتی و هشتگ‌های موجود در متن اصلی
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Section 3.5: Duplicate Detection & Prevention (تشخیص و پاکسازی پست‌های تکراری) */}
          <div className="p-4 rounded-xl neu-inset bg-amber-500/5 border border-amber-500/20 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-amber-500/15 pb-3">
              <div className="flex items-center gap-2">
                <CopyCheck className="w-5 h-5 text-amber-400" />
                <div>
                  <h4 className="text-xs font-bold text-amber-300">سیستم هوشمند تشخیص و جلوگیـری از پست‌های تکراری</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    الگوریتم هوشمند سنجش شباهت محتوا و پاکسازی اتوماتیک پست‌های تکراری در کانال مقصد
                  </p>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1.5 rounded-xl border border-amber-500/30 transition-all">
                <input
                  type="checkbox"
                  checked={preventDuplicates}
                  onChange={(e) => setPreventDuplicates(e.target.checked)}
                  className="w-4 h-4 accent-amber-400 rounded"
                />
                <span className="text-xs font-bold text-amber-200">فعال‌سازی سیستم ضد تکرار</span>
              </label>
            </div>

            {preventDuplicates && (
              <div className="space-y-4 animate-fadeIn pt-1">
                {/* Threshold Selection */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-200 flex items-center justify-between">
                    <span>۱. درصد آستانه تشخیص شباهت متنی:</span>
                    <span className="text-amber-400 font-extrabold dir-ltr text-xs">{duplicateSimilarityThreshold}٪ شباهت</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { val: 70, label: '۷۰٪ (حساسیت بالا)', desc: 'شناسایی کوچکترین شباهت‌ها' },
                      { val: 80, label: '۸۰٪ (پیش‌فرض استاندارد)', desc: 'متعادل و پیشنهادی' },
                      { val: 90, label: '۹۰٪ (حساسیت متوسط)', desc: 'فقط متن‌های بسیار مشابه' },
                      { val: 95, label: '۹۵٪ (حساسیت دقیق)', desc: 'فقط پست‌های کاملاً همسان' },
                    ].map((item) => (
                      <button
                        type="button"
                        key={item.val}
                        onClick={() => setDuplicateSimilarityThreshold(item.val)}
                        className={`p-2.5 rounded-xl border text-right transition-all ${
                          duplicateSimilarityThreshold === item.val
                            ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-bold shadow-md'
                            : 'bg-black/30 border-white/5 text-slate-400 hover:border-white/20'
                        }`}
                      >
                        <span className="text-xs font-bold block">{item.label}</span>
                        <span className="text-[10px] text-slate-500 block mt-0.5">{item.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Safety Guarantee Notice */}
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-200 text-xs flex items-center gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-blue-400 shrink-0" />
                  <div>
                    <span className="font-bold block">تضمین امنیت پست‌های قدیمی کانال:</span>
                    <span className="text-[11px] text-slate-300">
                      پست‌های قدیمی‌تر موجود در کانال شما کاملاً محفوظ باقی می‌مانند و هیچ پستی از قبل حذف نخواهد شد. فقط در صورتی که پست جدیدی با پست‌های قبلی بیش از {duplicateSimilarityThreshold}٪ شباهت داشته باشد، از ارسال آن جلوگیری خواهد شد.
                    </span>
                  </div>
                </div>

                {/* Duplicate Action Behavior */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-200">
                    ۲. اقدام هنگام مواجهه با پست تکراری جدید:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDuplicateAction('skip')}
                      className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
                        duplicateAction === 'skip'
                          ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-bold shadow-md'
                          : 'bg-black/30 border-white/5 text-slate-400 hover:border-white/20'
                      }`}
                    >
                      <span className="text-xs font-bold block">🚫 عدم ارسال پست جدید (پیش‌فرض)</span>
                      <span className="text-[10px] text-slate-400 block mt-1 leading-relaxed">
                        پست جدید ارسال نمی‌شود و پست‌های قبلی کانال بدون تغییر حفظ می‌شوند.
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDuplicateAction('delete_existing')}
                      className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
                        duplicateAction === 'delete_existing'
                          ? 'bg-rose-500/20 border-rose-400 text-rose-300 font-bold shadow-md'
                          : 'bg-black/30 border-white/5 text-slate-400 hover:border-white/20'
                      }`}
                    >
                      <span className="text-xs font-bold block">🗑️ حذف پست قدیمی و جایگزینی با پست جدید</span>
                      <span className="text-[10px] text-slate-400 block mt-1 leading-relaxed">
                        پست تکراری قدیمی‌تر از کانال تلگرام حذف شده و پست جدید جایگزین می‌گردد.
                      </span>
                    </button>
                  </div>
                </div>

                {/* Media Check Option */}
                <label className="flex items-center gap-3 neu-inset p-3 cursor-pointer hover:bg-white/5 transition-colors rounded-xl">
                  <input
                    type="checkbox"
                    checked={checkMediaDuplicate}
                    onChange={(e) => setCheckMediaDuplicate(e.target.checked)}
                    className="w-4 h-4 accent-amber-400 rounded"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-white block">بررسی و تطابق فایل‌های رسانه‌ای (عکس و ویدیو)</span>
                    <span className="text-slate-400 mt-0.5 block text-[11px]">
                      در صورت یکسان بودن تصویر یا ویدیوی دو پست، به عنوان پست تکراری شناسایی شده و بر اساس تنظیم فوق اقدام می‌شود.
                    </span>
                  </div>
                </label>

                {/* Manual Scan and Clean Duplicates Button */}
                <div className="p-3.5 rounded-xl bg-black/40 border border-amber-500/30 space-y-2.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <span className="text-xs font-bold text-amber-300 block">پاکسازی فوری پست‌های تکراری موجود در کانال</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        اسکن هوشمند تمام پست‌های منتقل‌شده قبلی در کانال مقصد و حذف موارد تکراری
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleCleanDuplicatesNow}
                      disabled={cleaningDuplicates}
                      className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 text-xs font-extrabold flex items-center gap-1.5 shadow-lg transition-all cursor-pointer disabled:opacity-50"
                    >
                      <CopyCheck className={`w-4 h-4 ${cleaningDuplicates ? 'animate-spin' : ''}`} />
                      <span>{cleaningDuplicates ? 'در حال اسکن و پاکسازی...' : 'اسکن و پاکسازی آنلاین'}</span>
                    </button>
                  </div>

                  {cleanDuplicatesResult && (
                    <div className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                      cleanDuplicatesResult.ok 
                        ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' 
                        : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                    }`}>
                      <span className="font-bold">{cleanDuplicatesResult.message}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Section 4: Signature / Tag (افزودن امضا یا تگ اختصاصی به پیام) */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-white flex items-center gap-1.5">
              <Tag className="w-4 h-4 text-yellow-400" />
              <span>افزودن امضا یا تگ اختصاصی به انتهای پیام (Signature / Tag):</span>
            </label>
            <div className="neu-inset p-2 rounded-xl">
              <textarea
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                placeholder={`مثال:\n🆔 ${connection.targetChannel}`}
                rows={3}
                className="w-full bg-transparent p-2 text-xs text-white placeholder-slate-500 focus:outline-none resize-none font-sans"
              />
            </div>
          </div>

          {/* Section 4.5: Bale Dual Forwarding (تنظیمات ارسال به پیام‌رسان بله) */}
          <div className="p-4 rounded-xl neu-inset bg-emerald-500/5 border border-emerald-500/20 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={enableBale}
                  onChange={(e) => {
                    if (!isSubscribed && e.target.checked) {
                      setBaleStatusMsg({ type: 'error', text: 'ارسال به بله مخصوص نسخه های اشتراکی (PRO / VIP) است.' });
                    } else {
                      setBaleStatusMsg(null);
                    }
                    setEnableBale(e.target.checked);
                  }}
                  className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-400 bg-slate-900 border-white/20 cursor-pointer"
                />
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-emerald-300">ارسال همزمان به پیام‌رسان بله (ایران) 🇮🇷</span>
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
                  className="px-2.5 py-1 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 hover:from-amber-500/30 hover:to-yellow-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Crown className="w-3.5 h-3.5 text-amber-400" />
                  <span>ارتقا به پرو</span>
                </button>
              )}
            </div>

            {!isSubscribed && enableBale && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center justify-between gap-3 animate-fadeIn">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>این قابلیت نیازمند اشتراک <strong>PRO</strong> یا <strong>VIP</strong> می‌باشد.</span>
                </div>
                {onOpenSubscriptions && (
                  <button
                    type="button"
                    onClick={onOpenSubscriptions}
                    className="px-2.5 py-1 bg-amber-500 text-slate-950 font-black rounded-lg text-xs hover:bg-amber-400 transition-all cursor-pointer shrink-0"
                  >
                    خرید اشتراک
                  </button>
                )}
              </div>
            )}

            {enableBale && (
              <div className="space-y-3 pt-2 border-t border-white/10 animate-fadeIn">
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  💡 راهنما: ربات ساخته شده توسط <strong>BotFather@</strong> در بله را مدیر (Admin) کانال یا گروه مقصد کنید و توکن را وارد نمایید.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-200">
                      کانال یا گروه مقصد در بله
                    </label>
                    <div className="neu-inset p-1 flex items-center">
                      <input
                        type="text"
                        value={baleTargetChannel}
                        onChange={(e) => setBaleTargetChannel(e.target.value)}
                        placeholder="مثال: my_bale_channel@"
                        className="w-full bg-transparent px-2.5 py-1.5 text-white placeholder-slate-500 focus:outline-none text-xs dir-ltr text-right"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-200 flex items-center justify-between">
                      <span>جایگزین آیدی در بله (اختیاری)</span>
                      <span className="text-[9px] text-emerald-400 font-normal">در متن پست‌ها</span>
                    </label>
                    <div className="neu-inset p-1 flex items-center">
                      <input
                        type="text"
                        value={baleReplaceId}
                        onChange={(e) => setBaleReplaceId(e.target.value)}
                        placeholder="مثال: my_bale_id@ یا ble.ir/id"
                        className="w-full bg-transparent px-2.5 py-1.5 text-white placeholder-slate-500 focus:outline-none text-xs dir-ltr text-right"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-200">
                      توکن ربات بله
                    </label>
                    <div className="neu-inset p-1 flex items-center">
                      <input
                        type="text"
                        value={baleBotToken}
                        onChange={(e) => setBaleBotToken(e.target.value)}
                        placeholder="مثال: 123456789:ABCdef..."
                        className="w-full bg-transparent px-2.5 py-1.5 text-white placeholder-slate-500 focus:outline-none text-xs dir-ltr text-left font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                  <button
                    type="button"
                    onClick={handleTestBale}
                    disabled={testingBale}
                    className="px-3 py-1.5 bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {testingBale ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5 text-emerald-400" />}
                    <span>تست ارسال به کانال بله</span>
                  </button>

                  {baleStatusMsg && (
                    <div className={`text-xs font-bold flex items-center gap-1.5 ${
                      baleStatusMsg.type === 'success' ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {baleStatusMsg.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                      <span>{baleStatusMsg.text}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Section 5: Live Interactive Preview */}
          <div className="space-y-2 pt-2 border-t border-white/5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
              <Eye className="w-4 h-4" />
              <span>پیش‌نمایش خروجی نهایی پیام:</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <span className="text-[11px] text-slate-400 mb-1 block">متن نمونه کانال مبدأ ({connection.sourceChannel}):</span>
                <textarea
                  value={sampleText}
                  onChange={(e) => setSampleText(e.target.value)}
                  rows={4}
                  className="w-full p-2.5 text-xs rounded-xl focus:outline-none resize-none transition-all duration-200 preview-input-box"
                />
              </div>

              <div>
                <span className="text-[11px] text-emerald-400 font-bold mb-1 flex items-center gap-1.5 block">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block"></span>
                  <span>خروجی ارسال شونده به ({connection.targetChannel}):</span>
                </span>
                <div className="w-full min-h-[96px] p-3 text-xs rounded-xl whitespace-pre-wrap font-sans transition-all duration-200 preview-output-box">
                  {getTransformedPreview() || <span className="placeholder-text italic">پیش‌نمایش نشان داده خواهد شد...</span>}
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-white/5 bg-black/20 flex justify-between items-center">
          <button
            type="button"
            onClick={onClose}
            className="neu-btn-secondary px-5 py-2.5 text-xs font-bold text-slate-300"
          >
            انصراف
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="neu-btn-primary px-8 py-2.5 text-xs font-black flex items-center gap-2 text-black"
          >
            {savedSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-900" />
                <span>ذخیره شد!</span>
              </>
            ) : saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-black" />
                <span>در حال ذخیره‌سازی...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>ذخیره تغییرات</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
