import React, { useEffect, useState } from 'react';
import { 
  X, Plus, Trash2, Save, Sliders, Sparkles, CheckCircle2, RefreshCw, 
  Eye, Replace, FileText, Filter, Bot, ShieldCheck, Tag, Link2, Globe, Cpu, Key, Lock, Crown,
  CopyCheck, ShieldAlert, Activity, Twitter, ArrowUp, ArrowDown, Layers
} from 'lucide-react';
import { TelegramConnection, AdvancedSettings, TextReplacementRule, RewriteMode, ContentFilter, AiProvider, User, AiFallbackItem } from '../types';
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
    id: 'openrouter',
    name: 'OpenRouter (اوپن‌روتر)',
    badge: 'دسترسی به تمام مدل‌های دنیا',
    icon: '🔮',
    color: 'border-indigo-500/30 text-indigo-300 bg-indigo-950/20',
    keyLink: 'https://openrouter.ai/keys',
    keyTip: 'کلید اختصاصی از OpenRouter.ai (پشتیبانی از تمام هوش‌های مصنوعی)',
    models: [
      { id: 'openrouter/auto', label: 'OpenRouter Auto (انتخاب اتوماتیک بهترین مدل)' },
      { id: 'google/gemini-2.0-flash-001', label: 'Google Gemini 2.0 Flash (از طریق OpenRouter)' },
      { id: 'anthropic/claude-3.5-sonnet', label: 'Anthropic Claude 3.5 Sonnet (از طریق OpenRouter)' },
      { id: 'deepseek/deepseek-chat', label: 'DeepSeek Chat V3 (از طریق OpenRouter)' },
      { id: 'deepseek/deepseek-r1', label: 'DeepSeek R1 (مدل استدلالی)' },
      { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Meta Llama 3.3 70B' },
      { id: 'openai/gpt-4o-mini', label: 'OpenAI GPT-4o Mini (از طریق OpenRouter)' },
      { id: 'custom', label: 'نام مدل سفارشی در OpenRouter (تایپ دستی)' },
    ],
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    badge: 'Google Gemini (کلید اختصاصی)',
    icon: '🤖',
    color: 'border-purple-500/30 text-purple-300 bg-purple-950/20',
    keyLink: 'https://aistudio.google.com/app/apikey',
    keyTip: 'کلید API اختصاصی از گوگل AI Studio (با جیمیل)',
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
    id: 'openrouter',
    name: 'OpenRouter AI',
    badge: 'دسترسی جامع به همه مدل‌ها',
    icon: '🚀',
    color: 'border-violet-500/30 text-violet-300 bg-violet-950/20',
    keyLink: 'https://openrouter.ai/keys',
    keyTip: 'کلید API جامع از پلتفرم OpenRouter.ai',
    models: [
      { id: 'openrouter/auto', label: 'OpenRouter Auto (مسیریابی خودکار به بهترین مدل)' },
      { id: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet (OpenRouter)' },
      { id: 'deepseek/deepseek-r1', label: 'DeepSeek R1 (OpenRouter)' },
      { id: 'deepseek/deepseek-chat', label: 'DeepSeek V3 (OpenRouter)' },
      { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B Instruct' },
      { id: 'google/gemini-2.0-flash-001', label: 'Gemini 2.0 Flash (OpenRouter)' },
      { id: 'openai/gpt-4o-mini', label: 'GPT-4o Mini (OpenRouter)' },
      { id: 'custom', label: 'نام مدل سفارشی (تایپ دستی)' },
    ],
  },
  {
    id: 'custom_openai',
    name: 'سرویس دلخواه / API هر سایت',
    badge: 'اتصال به API هر سایت یا Endpoint دلخواه',
    icon: '🌐',
    color: 'border-blue-500/30 text-blue-300 bg-blue-950/20',
    keyLink: '',
    keyTip: 'پشتیبانی از Base URL اختصاصی، Groq, Together, Ollama یا API هر سایت دلخواه',
    models: [
      { id: 'custom', label: 'نام مدل سفارشی دلخواه (تایپ دستی)' },
      { id: 'llama-3.3-70b-versatile', label: 'Groq: Llama 3.3 70B Versatile' },
      { id: 'deepseek-chat', label: 'DeepSeek Chat V3' },
      { id: 'mistral-large-latest', label: 'Mistral Large' },
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

  // AI Fallback Chain State
  const [enableAiFallbackChain, setEnableAiFallbackChain] = useState<boolean>(false);
  const [aiFallbackChain, setAiFallbackChain] = useState<AiFallbackItem[]>([]);

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

  // Forbidden Keywords Filter State
  const [forbiddenKeywords, setForbiddenKeywords] = useState<string[]>([]);
  const [newForbiddenWord, setNewForbiddenWord] = useState<string>('');

  // Ad Detection Filter State
  const [enableAdDetection, setEnableAdDetection] = useState<boolean>(false);
  const [adDetectionMethod, setAdDetectionMethod] = useState<'ai' | 'keywords' | 'both'>('keywords');
  const [customAdKeywords, setCustomAdKeywords] = useState<string[]>([]);
  const [newAdKeyword, setNewAdKeyword] = useState<string>('');

  // Live Preview Sample Text
  const [sampleText, setSampleText] = useState<string>('');

  // Bale Integration State
  const [enableBale, setEnableBale] = useState<boolean>(false);
  const [baleTargetChannel, setBaleTargetChannel] = useState<string>('');
  const [baleBotToken, setBaleBotToken] = useState<string>('');
  const [baleReplaceId, setBaleReplaceId] = useState<string>('');
  const [testingBale, setTestingBale] = useState<boolean>(false);
  const [baleStatusMsg, setBaleStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // X (Twitter) & Website Integration State
  const [enableX, setEnableX] = useState<boolean>(false);
  const [xTargetHandles, setXTargetHandles] = useState<string>('');
  const [xApiKey, setXApiKey] = useState<string>('');
  const [enableWeb, setEnableWeb] = useState<boolean>(false);
  const [webTargetUrl, setWebTargetUrl] = useState<string>('');

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

      setEnableAiFallbackChain(!!s.enableAiFallbackChain);
      setAiFallbackChain(s.aiFallbackChain || []);

      setReplacements(s.replacements || []);
      setSignature(s.signature !== undefined ? s.signature : `🆔 ${connection.targetChannel}`);
      setRemoveSourceLinks(s.removeSourceLinks !== undefined ? s.removeSourceLinks : true);
      setCleanTagsAndLinks(!!s.cleanTagsAndLinks);
      setContentFilter(s.contentFilter || 'all');

      setForbiddenKeywords(s.forbiddenKeywords || []);
      setEnableAdDetection(!!s.enableAdDetection);
      setAdDetectionMethod(s.adDetectionMethod || 'keywords');
      setCustomAdKeywords(s.customAdKeywords || []);

      setPreventDuplicates(s.preventDuplicates !== undefined ? !!s.preventDuplicates : true);
      setDuplicateSimilarityThreshold(s.duplicateSimilarityThreshold ?? 80);
      setDuplicateAction(s.duplicateAction || 'skip');
      setCheckMediaDuplicate(s.checkMediaDuplicate !== undefined ? !!s.checkMediaDuplicate : true);

      setEnableBale(!!s.enableBale || !!connection.enableBale);
      setBaleTargetChannel(s.baleTargetChannel || connection.baleTargetChannel || '');
      setBaleBotToken(s.baleBotToken || connection.baleBotToken || '');
      setBaleReplaceId(s.baleReplaceId || connection.baleReplaceId || '');

      setEnableX(!!s.enableX || !!connection.enableX);
      setXTargetHandles(s.xTargetHandles || connection.xTargetHandles || '');
      setXApiKey(s.xApiKey || connection.xApiKey || '');
      setEnableWeb(!!s.enableWeb || !!connection.enableWeb);
      setWebTargetUrl(s.webTargetUrl || connection.webTargetUrl || '');

      if (isTwitterSource) {
        setSampleText(
          `توییت جدید از ${connection.sourceChannel}:\nOur team is rolling out new updates today! Read more at https://t.co/xyz123\n#Twitter #Tech`
        );
      } else if (isWebsiteSource) {
        setSampleText(
          `خبر جدید در وب‌سایت ${connection.sourceChannel}:\nگزارش‌های تازه نشان می‌دهد که مطالب جدید منتشر شده است.\nلینک مطلب: https://example.com/news/100`
        );
      } else {
        setSampleText(
          `پست جدید در کانال ${connection.sourceChannel}\nبرای خرید و ثبت سفارش به آیدی ${connection.sourceChannel} پیام دهید.\nلینک کانال: https://t.me/${connection.sourceChannel.replace('@', '')}\n#فروشگاه #تخفیف`
        );
      }
    }
  }, [connection]);

  if (!connection) return null;

  const isTwitterSource = connection?.sourceType === 'twitter' || connection?.sourceChannel?.toLowerCase().includes('twitter.com') || connection?.sourceChannel?.toLowerCase().includes('x.com');
  const isWebsiteSource = connection?.sourceType === 'website' || connection?.sourceChannel?.toLowerCase().includes('http');

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

    if (!aiApiKey.trim()) {
      setAiTestError('وارد کردن کلید API اختصاصی هوش مصنوعی الزامی است. کلید پیش‌فرض سیستم حذف گردیده است.');
      setTestingAi(false);
      return;
    }

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

  const handleAddFallbackItem = () => {
    setAiFallbackChain([
      ...aiFallbackChain,
      {
        id: `fallback_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        provider: 'openrouter',
        apiKey: '',
        model: 'openrouter/auto',
        customBaseUrl: 'https://openrouter.ai/api/v1',
      },
    ]);
  };

  const handleRemoveFallbackItem = (id: string) => {
    setAiFallbackChain(aiFallbackChain.filter((item) => item.id !== id));
  };

  const handleFallbackItemChange = (id: string, field: keyof AiFallbackItem, value: any) => {
    setAiFallbackChain(
      aiFallbackChain.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };
          if (field === 'provider') {
            const pObj = PROVIDERS.find((p) => p.id === value);
            if (pObj && pObj.models.length > 0) {
              updated.model = pObj.models[0].id;
            }
          }
          return updated;
        }
        return item;
      })
    );
  };

  const handleMoveFallbackItem = (index: number, direction: 'up' | 'down') => {
    const newArr = [...aiFallbackChain];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= newArr.length) return;
    const temp = newArr[index];
    newArr[index] = newArr[targetIdx];
    newArr[targetIdx] = temp;
    setAiFallbackChain(newArr);
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
      if (isTwitterSource) {
        text = text.replace(/https?:\/\/(x\.com|twitter\.com|t\.co)\/[^\s]+/gi, '');
        if (cleanSource) {
          const sourceRegex = new RegExp(`@?${cleanSource}`, 'gi');
          text = text.replace(sourceRegex, '');
        }
      } else if (isWebsiteSource) {
        text = text.replace(/https?:\/\/[^\s<]+/g, '');
      } else {
        if (cleanSource) {
          const sourceRegex = new RegExp(`@?${cleanSource}`, 'gi');
          text = text.replace(sourceRegex, cleanTarget ? `@${cleanTarget}` : '');

          const tmeRegex = new RegExp(`https?:\\/\\/t\\.me\\/(s\\/)?${cleanSource}[^\\s]*`, 'gi');
          text = text.replace(tmeRegex, '');
        }
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

  const handleAddForbiddenWord = (wordToAdd?: string) => {
    const target = (wordToAdd || newForbiddenWord).trim();
    if (!target) return;
    if (!forbiddenKeywords.includes(target)) {
      setForbiddenKeywords([...forbiddenKeywords, target]);
    }
    setNewForbiddenWord('');
  };

  const handleRemoveForbiddenWord = (word: string) => {
    setForbiddenKeywords(forbiddenKeywords.filter((w) => w !== word));
  };

  const handleAddAdKeyword = (wordToAdd?: string) => {
    const target = (wordToAdd || newAdKeyword).trim();
    if (!target) return;
    if (!customAdKeywords.includes(target)) {
      setCustomAdKeywords([...customAdKeywords, target]);
    }
    setNewAdKeyword('');
  };

  const handleRemoveAdKeyword = (word: string) => {
    setCustomAdKeywords(customAdKeywords.filter((w) => w !== word));
  };

  const handleSave = async () => {
    setSaving(true);
    setSavedSuccess(false);

    if (rewriteMode === 'ai' && !aiApiKey.trim()) {
      alert('وارد کردن کلید API اختصاصی هوش مصنوعی الزامی است. جهت استفاده از بازنویسی با هوش مصنوعی، لطفاً کلید API خود را وارد کنید.');
      setSaving(false);
      return;
    }

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
        enableAiFallbackChain,
        aiFallbackChain: aiFallbackChain.filter((item) => item.apiKey.trim() !== ''),
        replacements: replacements.filter((r) => r.find.trim() !== ''),
        signature,
        removeSourceLinks,
        cleanTagsAndLinks,
        contentFilter,
        forbiddenKeywords,
        enableAdDetection,
        adDetectionMethod,
        customAdKeywords,
        enableBale,
        baleTargetChannel: baleTargetChannel.trim(),
        baleBotToken: baleBotToken.trim(),
        baleReplaceId: baleReplaceId.trim(),
        enableX,
        xTargetHandles: xTargetHandles.trim(),
        xApiKey: xApiKey.trim(),
        enableWeb,
        webTargetUrl: webTargetUrl.trim(),
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
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 md:p-6">
      <div className="neu-flat w-full max-w-5xl lg:max-w-6xl max-h-[92vh] flex flex-col border border-white/10 overflow-hidden shadow-2xl rounded-2xl">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-white/5 flex items-center justify-between bg-black/30">
          <div className="flex items-center gap-3">
            <div className="p-2.5 neu-inset rounded-xl text-yellow-400">
              {isTwitterSource ? <Twitter className="w-5 h-5 text-sky-400" /> : isWebsiteSource ? <Globe className="w-5 h-5 text-purple-400" /> : <Sliders className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                {isTwitterSource ? (
                  <span>تنظیمات پیشرفته اختصاصی توییتر (X)</span>
                ) : isWebsiteSource ? (
                  <span>تنظیمات پیشرفته اختصاصی وب‌سایت (RSS)</span>
                ) : (
                  <span>تنظیمات پیشرفته و فیلترهای هوشمند تلگرام</span>
                )}
              </h3>
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
          
          {/* ========================================================= */}
          {/* 1. TWITTER (X) SPECIFIC ADVANCED SETTINGS                 */}
          {/* ========================================================= */}
          {isTwitterSource && (
            <>
              {/* Informational Banner */}
              <div className="p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/25 text-sky-200 text-xs flex items-center gap-2.5">
                <Twitter className="w-5 h-5 text-sky-400 shrink-0" />
                <div>
                  <span className="font-bold block text-sky-300">تنظیمات اختصاصی توییتر (X):</span>
                  <span className="text-[11px] opacity-90 leading-relaxed block mt-0.5">
                    در این بخش می‌توانید پاکسازی لینک مبدأ و آیدی‌های توییتر را فعال کرده و لینک کانال تلگرام خود (امضا) را تنظیم نمایید.
                  </span>
                </div>
              </div>

              {/* 1. Remove Source Link Option */}
              <div className="neu-inset p-4 rounded-xl border border-white/5 space-y-3">
                <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  <span>تنظیمات پاکسازی لینک مبدأ توییتر</span>
                </div>

                <label className="flex items-start gap-3 neu-inset p-3.5 cursor-pointer hover:bg-white/5 transition-colors rounded-xl border border-white/5">
                  <input
                    type="checkbox"
                    checked={removeSourceLinks}
                    onChange={(e) => setRemoveSourceLinks(e.target.checked)}
                    className="w-4 h-4 mt-0.5 accent-emerald-400 rounded cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-white block">حذف لینک مبدأ (حذف لینک‌های توییتر، t.co و آیدی پیج مبدأ)</span>
                    <span className="text-slate-400 mt-0.5 block text-[11px] leading-relaxed">
                      با فعال بودن این گزینه، لینک‌های اختصاصی توییت (twitter.com / x.com / t.co) و آیدی حساب توییتر {connection.sourceChannel} از متن توییت پاکسازی می‌شوند تا لینک پیج مبدا یا لینکهای t.co در پیام نباشد.
                    </span>
                  </div>
                </label>
              </div>

              {/* Telegram Channel Link / Signature */}
              <div className="space-y-2 neu-inset p-4 rounded-xl border border-white/5">
                <label className="block text-xs font-bold text-white flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-yellow-400" />
                  <span>امضا / لینک کانال تلگرام (که به انتهای توییت اضافه می‌شود):</span>
                </label>
                <div className="p-2 rounded-xl border border-white/10 bg-black/40">
                  <textarea
                    value={signature}
                    onChange={(e) => setSignature(e.target.value)}
                    placeholder={`مثال:\n🆔 ${connection.targetChannel}\n📢 عضویت در کانال: t.me/${connection.targetChannel.replace('@', '')}`}
                    rows={3}
                    className="w-full bg-transparent p-2 text-xs text-white placeholder-slate-500 focus:outline-none resize-none font-sans"
                  />
                </div>
                <p className="text-[11px] text-slate-400">
                  💡 این امضا (لینک کانال تلگرام شما) به انتهای تمامی توییت‌های استخراج شده از این حساب توییتر پیوست می‌گردد.
                </p>
              </div>
            </>
          )}

          {/* ========================================================= */}
          {/* 2. WEBSITE (RSS) SPECIFIC ADVANCED SETTINGS               */}
          {/* ========================================================= */}
          {isWebsiteSource && (
            <>
              <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/25 text-purple-200 text-xs flex items-center gap-2.5">
                <Globe className="w-5 h-5 text-purple-400 shrink-0" />
                <div>
                  <span className="font-bold block text-purple-300">تنظیمات اختصاصی وب‌سایت (RSS):</span>
                  <span className="text-[11px] opacity-90 leading-relaxed block mt-0.5">
                    تنظیم بازنویسی هوشمند اخبار با هوش مصنوعی، پاکسازی لینک‌های سایت مبدأ و افزودن امضای کانال تلگرام.
                  </span>
                </div>
              </div>

              {/* Text Rewrite Mode for Website */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span>تغییر و بازنویسی خبرهای وب‌سایت</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: 'none', label: 'بدون تغییر', desc: 'ارسال دقیق متن خبر وب‌سایت' },
                    { id: 'ai', label: 'بازنویسی با هوش مصنوعی', desc: 'خلاصه‌سازی و بازنویسی روان با AI' },
                    { id: 'replace', label: 'جایگزینی کلمات', desc: 'تغییر کلمات بر اساس قوانین شما' },
                  ].map((mode) => (
                    <button
                      type="button"
                      key={mode.id}
                      onClick={() => setRewriteMode(mode.id as RewriteMode)}
                      className={`p-3.5 rounded-xl border text-right transition-all cursor-pointer ${
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

                {/* AI Settings if AI mode active */}
                {rewriteMode === 'ai' && (
                  <div className="neu-inset p-4 space-y-4 rounded-xl border border-purple-500/30 bg-purple-950/15">
                    <div className="flex items-center justify-between border-b border-purple-500/20 pb-2.5">
                      <div className="flex items-center gap-2 text-xs font-bold text-purple-300">
                        <Bot className="w-4.5 h-4.5 text-purple-400" />
                        <span>تنظیمات موتور هوش مصنوعی برای اخبار</span>
                      </div>
                      <span className="text-[11px] font-semibold text-purple-300 bg-purple-500/15 px-2.5 py-0.5 rounded-full border border-purple-500/30 flex items-center gap-1">
                        <span>{currentProviderConfig.icon}</span>
                        <span>{currentProviderConfig.name}</span>
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-purple-200">
                        انتخاب سرویس هوش مصنوعی (Provider):
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
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-purple-200">
                        کلید API اختصاصی:
                      </label>
                      <input
                        type="password"
                        value={aiApiKey}
                        onChange={(e) => setAiApiKey(e.target.value)}
                        placeholder="کلید API خود را وارد کنید..."
                        className="w-full bg-black/60 border border-white/15 px-3 py-2 text-xs rounded-lg text-white focus:outline-none focus:border-purple-400 font-mono"
                      />
                    </div>

                    {/* Fallback Chain / Priority AI Configuration for Website */}
                    <div className="pt-3 border-t border-purple-500/20 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={enableAiFallbackChain}
                            onChange={(e) => setEnableAiFallbackChain(e.target.checked)}
                            className="w-4 h-4 rounded text-purple-500 focus:ring-purple-400 bg-slate-900 border-white/20 cursor-pointer"
                          />
                          <span className="text-xs font-bold text-purple-200 flex items-center gap-1.5">
                            <Layers className="w-4 h-4 text-purple-400" />
                            <span>سوییچ خودکار و زنجیره هوش مصنوعی (Fallback & Priority Chain)</span>
                          </span>
                        </label>
                        <span className="text-[10px] text-purple-300/80 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
                          در صورت اتمام سهمیه یا خطای API اصلی
                        </span>
                      </div>

                      {enableAiFallbackChain && (
                        <div className="space-y-3 pt-2 animate-fadeIn">
                          <p className="text-[11px] text-slate-300 leading-relaxed bg-black/30 p-2.5 rounded-xl border border-white/5">
                            💡 راهنما: ابتدا هوش مصنوعی اصلی بالا اجرا می‌شود. در صورت بروز خطا، اتمام شارژ یا پاسخ ندادن API، سیستم به ترتیب اولویت‌های زیر سوییچ اتوماتیک می‌کند.
                          </p>

                          {aiFallbackChain.map((item, idx) => (
                            <div key={item.id} className="p-3 rounded-xl bg-black/50 border border-purple-500/30 space-y-2.5">
                              <div className="flex items-center justify-between text-xs font-bold text-purple-300 border-b border-white/10 pb-1.5">
                                <span className="flex items-center gap-1">
                                  <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-black flex items-center justify-center border border-purple-500/30">
                                    {idx + 1}
                                  </span>
                                  <span>اولویت جایگزین #{idx + 1}</span>
                                </span>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleMoveFallbackItem(idx, 'up')}
                                    disabled={idx === 0}
                                    className="p-1 hover:bg-white/10 rounded text-slate-400 disabled:opacity-30 cursor-pointer"
                                    title="انتقال به بالا"
                                  >
                                    <ArrowUp className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleMoveFallbackItem(idx, 'down')}
                                    disabled={idx === aiFallbackChain.length - 1}
                                    className="p-1 hover:bg-white/10 rounded text-slate-400 disabled:opacity-30 cursor-pointer"
                                    title="انتقال به پایین"
                                  >
                                    <ArrowDown className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveFallbackItem(item.id)}
                                    className="p-1 hover:bg-red-500/20 rounded text-red-400 cursor-pointer"
                                    title="حذف"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-400 mb-1">
                                    سرویس هوش مصنوعی:
                                  </label>
                                  <select
                                    value={item.provider}
                                    onChange={(e) => handleFallbackItemChange(item.id, 'provider', e.target.value as AiProvider)}
                                    className="w-full bg-slate-900 border border-white/15 px-2.5 py-1.5 text-xs rounded-lg text-white focus:outline-none focus:border-purple-400 font-bold"
                                  >
                                    {PROVIDERS.map((p) => (
                                      <option key={p.id} value={p.id}>
                                        {p.icon} {p.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div>
                                  <label className="block text-[10px] font-bold text-slate-400 mb-1">
                                    کلید API اختصاصی:
                                  </label>
                                  <input
                                    type="password"
                                    value={item.apiKey}
                                    onChange={(e) => handleFallbackItemChange(item.id, 'apiKey', e.target.value)}
                                    placeholder="کلید API جایگزین..."
                                    className="w-full bg-slate-900 border border-white/15 px-2.5 py-1.5 text-xs rounded-lg text-white focus:outline-none focus:border-purple-400 font-mono"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}

                          <button
                            type="button"
                            onClick={handleAddFallbackItem}
                            className="w-full py-2 px-3 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Plus className="w-4 h-4 text-purple-400" />
                            <span>افزودن هوش مصنوعی جدید به زنجیره اولویت‌ها</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Word Replacements for website if replace mode active */}
                {rewriteMode === 'replace' && (
                  <div className="neu-inset p-4 space-y-3 rounded-xl border border-blue-500/30 bg-blue-950/15">
                    <div className="flex items-center justify-between border-b border-blue-500/20 pb-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-blue-300">
                        <Replace className="w-4 h-4 text-blue-400" />
                        <span>جدول جایگزینی کلمات و عبارت‌های خبر</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddRule}
                        className="neu-btn-primary px-2.5 py-1 text-[11px] font-bold text-black flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>افزودن کلمه</span>
                      </button>
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

              {/* Website Source Cleanup */}
              <div className="neu-inset p-4 space-y-3 border border-white/5">
                <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  <span>تنظیمات پاکسازی لینک‌های وب‌سایت مبدأ</span>
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
                      <span className="font-bold text-white block">حذف خودکار لینک‌های وب‌سایت مبدأ (URL)</span>
                      <span className="text-slate-400 mt-0.5 block text-[11px]">
                        پاکسازی آدرس‌های URL وب‌سایت اصلی از متن خبر
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
                      <span className="font-bold text-white block">پاکسازی کلی تمام کدهای HTML و هشتگ‌ها</span>
                      <span className="text-slate-400 mt-0.5 block text-[11px]">
                        حذف تمامی کدهای HTML و هشتگ‌های موجود در مقاله
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Website Signature */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-white flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-yellow-400" />
                  <span>امضا / لینک کانال تلگرام به انتهای خبر وب‌سایت:</span>
                </label>
                <div className="neu-inset p-2 rounded-xl border border-white/5">
                  <textarea
                    value={signature}
                    onChange={(e) => setSignature(e.target.value)}
                    placeholder={`مثال:\n🆔 ${connection.targetChannel}`}
                    rows={3}
                    className="w-full bg-transparent p-2 text-xs text-white placeholder-slate-500 focus:outline-none resize-none font-sans"
                  />
                </div>
              </div>
            </>
          )}

          {/* ========================================================= */}
          {/* 3. TELEGRAM SPECIFIC ADVANCED SETTINGS                    */}
          {/* ========================================================= */}
          {!isTwitterSource && !isWebsiteSource && (
            <>
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
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 2. Model Selection */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-purple-200">
                        ۲. انتخاب مدل هوش مصنوعی:
                      </label>
                      <select
                        value={aiModel}
                        onChange={(e) => setAiModel(e.target.value)}
                        className="w-full bg-black/60 border border-white/15 px-3 py-2 text-xs rounded-lg text-white focus:outline-none focus:border-purple-400 font-bold"
                      >
                        {currentProviderConfig.models.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.label}
                          </option>
                        ))}
                      </select>

                      {(aiModel === 'custom' || aiProvider === 'custom_openai') && (
                        <input
                          type="text"
                          value={customModelInput}
                          onChange={(e) => setCustomModelInput(e.target.value)}
                          placeholder="نام مدل سفارشی دلخواه را وارد کنید (مثلاً: llama-3.3-70b-versatile یا gpt-4o)..."
                          className="w-full bg-black/70 border border-purple-500/40 px-3 py-2 text-xs rounded-lg text-white focus:outline-none focus:border-purple-300 font-mono mt-1.5"
                        />
                      )}
                    </div>

                    {/* 3. Custom API Base URL for ANY Site/Server (نکته اول) */}
                    <div className="space-y-2 p-3.5 rounded-xl bg-blue-950/30 border border-blue-500/35 shadow-inner">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <label className="block text-xs font-bold text-blue-200 flex items-center gap-1.5">
                          <Globe className="w-4 h-4 text-blue-400" />
                          <span>🌐 آدرس API اختصاصی / Base URL هر سایت یا سرور دلخواه:</span>
                        </label>
                        <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded font-bold border border-blue-500/30">
                          نکته مهم: قابلیت دادن API هر سایت
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        با وارد کردن آدرس Base URL در این قسمت، می‌توانید از API اختصاصی <b>هر سایت، ارائه‌دهنده یا سرور شخصی</b> (مانند OpenAI-compatible API، Groq، Together AI، Ollama، OpenRouter و غیره) استفاده نمایید:
                      </p>
                      <input
                        type="text"
                        value={aiCustomBaseUrl}
                        onChange={(e) => setAiCustomBaseUrl(e.target.value)}
                        placeholder="https://api.your-custom-site.com/v1 یا http://localhost:11434/v1"
                        className="w-full bg-black/70 border border-white/20 px-3 py-2 text-xs rounded-lg text-white focus:outline-none focus:border-blue-400 font-mono text-left dir-ltr"
                      />
                      <div className="flex gap-1.5 flex-wrap pt-0.5">
                        <span className="text-[10px] text-slate-400 flex items-center gap-1 font-bold">میانبرهای آماده:</span>
                        <button
                          type="button"
                          onClick={() => {
                            setAiProvider('custom_openai');
                            setAiCustomBaseUrl('https://api.groq.com/openai/v1');
                            setAiModel('llama-3.3-70b-versatile');
                          }}
                          className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 hover:bg-blue-500/40 border border-blue-500/30 transition-all cursor-pointer font-medium"
                        >
                          ⚡ Groq API
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAiProvider('openrouter');
                            setAiCustomBaseUrl('https://openrouter.ai/api/v1');
                            setAiModel('openrouter/auto');
                          }}
                          className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 hover:bg-blue-500/40 border border-blue-500/30 transition-all cursor-pointer font-medium"
                        >
                          🌐 OpenRouter
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAiProvider('custom_openai');
                            setAiCustomBaseUrl('https://api.together.xyz/v1');
                          }}
                          className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 hover:bg-blue-500/40 border border-blue-500/30 transition-all cursor-pointer font-medium"
                        >
                          🚀 Together AI
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAiProvider('custom_openai');
                            setAiCustomBaseUrl('http://localhost:11434/v1');
                          }}
                          className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 hover:bg-blue-500/40 border border-blue-500/30 transition-all cursor-pointer font-medium"
                        >
                          💻 Ollama (محلی)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAiProvider('deepseek');
                            setAiCustomBaseUrl('https://api.deepseek.com');
                          }}
                          className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 hover:bg-blue-500/40 border border-blue-500/30 transition-all cursor-pointer font-medium"
                        >
                          🐳 DeepSeek
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-purple-200">
                        ۴. کلید API اختصاصی:
                      </label>
                      <input
                        type="password"
                        value={aiApiKey}
                        onChange={(e) => setAiApiKey(e.target.value)}
                        placeholder="کلید API خود را وارد کنید..."
                        className="w-full bg-black/60 border border-white/15 px-3 py-2 text-xs rounded-lg text-white focus:outline-none focus:border-purple-400 font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-purple-200">
                        ۵. نوشتن پرامپت و دستورات برای ربات (دستور بازنویسی و لحن):
                      </label>
                      <textarea
                        rows={3}
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        placeholder="دستورات و لحن بازنویسی ربات را بنویسید (مثلاً: متن را خلاصه و جذاب با ایموجی بازنویسی کن)..."
                        className="w-full bg-black/60 border border-white/15 p-2.5 text-xs rounded-lg text-white focus:outline-none focus:border-purple-400 font-sans leading-relaxed"
                      />
                      <div className="flex gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setAiPrompt('متن زیر را به صورت جذاب، روان، خوانا و پرمخاطب بازنویسی کن:')}
                          className="text-[10px] px-2 py-1 rounded bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border border-purple-500/30 transition-all"
                        >
                          ✨ استاندارد و جذاب
                        </button>
                        <button
                          type="button"
                          onClick={() => setAiPrompt('متن زیر را خلاصه‌سازی کن و نکات کلیدی آن را با ایموجی‌های مرتبط تیتروار بنویس:')}
                          className="text-[10px] px-2 py-1 rounded bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border border-purple-500/30 transition-all"
                        >
                          📌 خلاصه‌سازی تیتروار
                        </button>
                        <button
                          type="button"
                          onClick={() => setAiPrompt('متن زیر را به لحن کاملاً رسمی و تخصصی ترجمه و بازنویسی کن:')}
                          className="text-[10px] px-2 py-1 rounded bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border border-purple-500/30 transition-all"
                        >
                          👔 لحن رسمی
                        </button>
                      </div>
                    </div>

                    {/* AI API Test Connection Button */}
                    <div className="p-3 neu-inset rounded-xl bg-purple-900/20 border border-purple-500/30 space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="text-xs font-bold text-purple-200 flex items-center gap-1.5">
                          <Activity className="w-4 h-4 text-purple-400" />
                          <span>تست وصل بودن API و بررسی لایو اتصال هوش مصنوعی:</span>
                        </span>
                        <button
                          type="button"
                          onClick={handleTestAi}
                          disabled={testingAi}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500 border border-purple-400/40 shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                        >
                          {testingAi ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                          <span>{testingAi ? 'در حال تست API...' : '🧪 تست وصل بودن API'}</span>
                        </button>
                      </div>

                      {aiTestResult && (
                        <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-xs dir-rtl space-y-1">
                          <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>ارتباط API موفقیت‌آمیز بود! (پاسخ دریافتی از هوش مصنوعی):</span>
                          </div>
                          <p className="text-[11px] bg-black/40 p-2 rounded border border-emerald-500/20 leading-relaxed font-sans text-slate-100">
                            {aiTestResult}
                          </p>
                        </div>
                      )}

                      {aiTestError && (
                        <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
                          <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                          <span>{aiTestError}</span>
                        </div>
                      )}
                    </div>

                    {/* Fallback Chain / Priority AI Configuration */}
                    <div className="pt-3 border-t border-purple-500/20 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={enableAiFallbackChain}
                            onChange={(e) => setEnableAiFallbackChain(e.target.checked)}
                            className="w-4 h-4 rounded text-purple-500 focus:ring-purple-400 bg-slate-900 border-white/20 cursor-pointer"
                          />
                          <span className="text-xs font-bold text-purple-200 flex items-center gap-1.5">
                            <Layers className="w-4 h-4 text-purple-400" />
                            <span>سوییچ خودکار و زنجیره هوش مصنوعی (Fallback & Priority Chain)</span>
                          </span>
                        </label>
                        <span className="text-[10px] text-purple-300/80 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
                          در صورت اتمام سهمیه یا خطای API اصلی
                        </span>
                      </div>

                      {enableAiFallbackChain && (
                        <div className="space-y-3 pt-2 animate-fadeIn">
                          <p className="text-[11px] text-slate-300 leading-relaxed bg-black/30 p-2.5 rounded-xl border border-white/5">
                            💡 راهنما: ابتدا هوش مصنوعی اصلی بالا اجرا می‌شود. در صورت بروز خطا، اتمام شارژ یا پاسخ ندادن API، سیستم به ترتیب اولویت‌های زیر سوییچ اتوماتیک می‌کند.
                          </p>

                          {aiFallbackChain.map((item, idx) => (
                            <div key={item.id} className="p-3 rounded-xl bg-black/50 border border-purple-500/30 space-y-2.5">
                              <div className="flex items-center justify-between text-xs font-bold text-purple-300 border-b border-white/10 pb-1.5">
                                <span className="flex items-center gap-1">
                                  <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-black flex items-center justify-center border border-purple-500/30">
                                    {idx + 1}
                                  </span>
                                  <span>اولویت جایگزین #{idx + 1}</span>
                                </span>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleMoveFallbackItem(idx, 'up')}
                                    disabled={idx === 0}
                                    className="p-1 hover:bg-white/10 rounded text-slate-400 disabled:opacity-30 cursor-pointer"
                                    title="انتقال به بالا"
                                  >
                                    <ArrowUp className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleMoveFallbackItem(idx, 'down')}
                                    disabled={idx === aiFallbackChain.length - 1}
                                    className="p-1 hover:bg-white/10 rounded text-slate-400 disabled:opacity-30 cursor-pointer"
                                    title="انتقال به پایین"
                                  >
                                    <ArrowDown className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveFallbackItem(item.id)}
                                    className="p-1 hover:bg-red-500/20 rounded text-red-400 cursor-pointer"
                                    title="حذف"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-400 mb-1">
                                    سرویس هوش مصنوعی:
                                  </label>
                                  <select
                                    value={item.provider}
                                    onChange={(e) => handleFallbackItemChange(item.id, 'provider', e.target.value as AiProvider)}
                                    className="w-full bg-slate-900 border border-white/15 px-2.5 py-1.5 text-xs rounded-lg text-white focus:outline-none focus:border-purple-400 font-bold"
                                  >
                                    {PROVIDERS.map((p) => (
                                      <option key={p.id} value={p.id}>
                                        {p.icon} {p.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div>
                                  <label className="block text-[10px] font-bold text-slate-400 mb-1">
                                    کلید API اختصاصی:
                                  </label>
                                  <input
                                    type="password"
                                    value={item.apiKey}
                                    onChange={(e) => handleFallbackItemChange(item.id, 'apiKey', e.target.value)}
                                    placeholder="کلید API جایگزین..."
                                    className="w-full bg-slate-900 border border-white/15 px-2.5 py-1.5 text-xs rounded-lg text-white focus:outline-none focus:border-purple-400 font-mono"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[10px] font-bold text-slate-400 mb-1">
                                    🌐 آدرس سایت API (Base URL دلخواه):
                                  </label>
                                  <input
                                    type="text"
                                    value={item.customBaseUrl || ''}
                                    onChange={(e) => handleFallbackItemChange(item.id, 'customBaseUrl', e.target.value)}
                                    placeholder="https://api.your-custom-site.com/v1"
                                    className="w-full bg-slate-900 border border-white/15 px-2.5 py-1.5 text-xs rounded-lg text-white focus:outline-none focus:border-purple-400 font-mono text-left dir-ltr"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[10px] font-bold text-slate-400 mb-1">
                                    🤖 نام مدل (اختیاری):
                                  </label>
                                  <input
                                    type="text"
                                    value={item.model || ''}
                                    onChange={(e) => handleFallbackItemChange(item.id, 'model', e.target.value)}
                                    placeholder="مثلاً: llama-3.3-70b-versatile"
                                    className="w-full bg-slate-900 border border-white/15 px-2.5 py-1.5 text-xs rounded-lg text-white focus:outline-none focus:border-purple-400 font-mono text-left dir-ltr"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}

                          <button
                            type="button"
                            onClick={handleAddFallbackItem}
                            className="w-full py-2 px-3 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Plus className="w-4 h-4 text-purple-400" />
                            <span>افزودن هوش مصنوعی جدید به زنجیره اولویت‌ها</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Replace mode for Telegram */}
                {rewriteMode === 'replace' && (
                  <div className="neu-inset p-4 space-y-3 rounded-xl border border-blue-500/30 bg-blue-950/15">
                    <div className="flex items-center justify-between border-b border-blue-500/20 pb-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-blue-300">
                        <Replace className="w-4 h-4 text-blue-400" />
                        <span>جدول جایگزینی کلمات و عبارت‌ها</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddRule}
                        className="neu-btn-primary px-2.5 py-1 text-[11px] font-bold text-black flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>افزودن کلمه</span>
                      </button>
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

              {/* Section 3.5: Duplicate Protection */}
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
                    <div className="space-y-3 bg-black/30 p-3.5 rounded-2xl border border-white/5">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <label className="text-xs font-bold text-slate-200 flex items-center gap-2">
                          <span>۱. درصد آستانه تشخیص شباهت:</span>
                        </label>
                        <span className="text-amber-400 font-extrabold dir-rtl text-sm bg-amber-500/10 px-3 py-1 rounded-xl border border-amber-500/30">
                          {duplicateSimilarityThreshold.toLocaleString('fa-IR')}٪ شباهت
                        </span>
                      </div>

                      <div className="space-y-1">
                        <input
                          type="range"
                          min={50}
                          max={100}
                          step={5}
                          value={duplicateSimilarityThreshold}
                          onChange={(e) => setDuplicateSimilarityThreshold(Number(e.target.value))}
                          className="w-full accent-amber-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Section 3.6: Forbidden Keywords Filter (نکته پنجم) */}
              <div className="p-4 rounded-2xl neu-inset bg-rose-500/5 border border-rose-500/20 space-y-3">
                <div className="flex items-center gap-2 border-b border-rose-500/15 pb-2.5">
                  <Filter className="w-5 h-5 text-rose-400" />
                  <div>
                    <h4 className="text-xs font-bold text-rose-300">🚫 فیلتر کلمات ممنوعه (جلوگیری از ارسال پیام‌های حاوی کلمات خاص)</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      در صورت وجود هر یک از کلمات کلیدی زیر در پست کانال مبدأ، پیام کلا نادیده گرفته شده و به مقصد ارسال نمی‌شود.
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newForbiddenWord}
                    onChange={(e) => setNewForbiddenWord(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddForbiddenWord();
                      }
                    }}
                    placeholder="کلمه ممنوعه جدید را وارد کنید (مثلاً: شرط بندی، قرعه کشی)..."
                    className="flex-1 bg-black/40 border border-white/15 px-3 py-2 text-xs rounded-xl text-white focus:outline-none focus:border-rose-400"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddForbiddenWord()}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>افزودن</span>
                  </button>
                </div>

                {forbiddenKeywords.length === 0 ? (
                  <p className="text-[11px] text-slate-400 text-center py-1">
                    هیچ کلمه ممنوعه‌ای ثبت نشده است. همه پست‌ها مجاز خواهند بود.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {forbiddenKeywords.map((word) => (
                      <span
                        key={word}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-950/60 text-rose-200 border border-rose-500/30 text-xs font-medium"
                      >
                        <span>{word}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveForbiddenWord(word)}
                          className="hover:text-red-400 text-slate-400 transition-colors p-0.5 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 3.7: AI Ad Detection Filter (نکته سوم) */}
              <div className="p-4 rounded-2xl neu-inset bg-purple-500/5 border border-purple-500/20 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2 border-b border-purple-500/15 pb-2.5">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-purple-400" />
                    <div>
                      <h4 className="text-xs font-bold text-purple-300">📢 سیستم هوشمند تشخیص متن‌های تبلیغاتی و عدم ارسال (AI Ad Detector)</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        شناسایی خودکار پست‌های تبلیغاتی، آگهی فروش، رزرو تبلیغات و کانال‌های اسپانسر شده و نادیده گرفتن آنها
                      </p>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer bg-purple-500/10 hover:bg-purple-500/20 px-3 py-1.5 rounded-xl border border-purple-500/30 transition-all">
                    <input
                      type="checkbox"
                      checked={enableAdDetection}
                      onChange={(e) => setEnableAdDetection(e.target.checked)}
                      className="w-4 h-4 accent-purple-400 rounded cursor-pointer"
                    />
                    <span className="text-xs font-bold text-purple-200">فعال‌سازی ضد تبلیغات</span>
                  </label>
                </div>

                {enableAdDetection && (
                  <div className="space-y-3 pt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setAdDetectionMethod('keywords')}
                        className={`p-2.5 rounded-xl border text-center text-xs font-bold transition-all cursor-pointer ${
                          adDetectionMethod === 'keywords'
                            ? 'bg-purple-600/30 border-purple-400 text-white shadow'
                            : 'bg-black/30 border-white/10 text-slate-400 hover:text-white'
                        }`}
                      >
                        🏷️ کلمات کلیدی تبلیغاتی
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdDetectionMethod('ai')}
                        className={`p-2.5 rounded-xl border text-center text-xs font-bold transition-all cursor-pointer ${
                          adDetectionMethod === 'ai'
                            ? 'bg-purple-600/30 border-purple-400 text-white shadow'
                            : 'bg-black/30 border-white/10 text-slate-400 hover:text-white'
                        }`}
                      >
                        🤖 تشخیص با هوش مصنوعی
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdDetectionMethod('both')}
                        className={`p-2.5 rounded-xl border text-center text-xs font-bold transition-all cursor-pointer ${
                          adDetectionMethod === 'both'
                            ? 'bg-purple-600/30 border-purple-400 text-white shadow'
                            : 'bg-black/30 border-white/10 text-slate-400 hover:text-white'
                        }`}
                      >
                        ⚡ ترکیبی (کلمات + AI)
                      </button>
                    </div>

                    {(adDetectionMethod === 'keywords' || adDetectionMethod === 'both') && (
                      <div className="space-y-2 bg-black/30 p-3 rounded-xl border border-white/5">
                        <label className="block text-[11px] font-bold text-slate-300">
                          افزودن کلمه/عبارت تبلیغاتی سفارشی به دیتابیس هوشمند:
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newAdKeyword}
                            onChange={(e) => setNewAdKeyword(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddAdKeyword();
                              }
                            }}
                            placeholder="عبارت تبلیغاتی جدید (مثلاً: تعرفه آگهی، ثبت آیدی)..."
                            className="flex-1 bg-black/40 border border-white/15 px-3 py-1.5 text-xs rounded-xl text-white focus:outline-none focus:border-purple-400"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddAdKeyword()}
                            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shrink-0 cursor-pointer"
                          >
                            افزودن
                          </button>
                        </div>

                        {customAdKeywords.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {customAdKeywords.map((word) => (
                              <span
                                key={word}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-950/60 text-purple-200 border border-purple-500/30 text-[11px]"
                              >
                                <span>{word}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveAdKeyword(word)}
                                  className="hover:text-red-400 text-slate-400 transition-colors cursor-pointer"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Section 4: Signature */}
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
            </>
          )}































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
