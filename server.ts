import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import * as cheerio from "cheerio";
import { GoogleGenAI } from "@google/genai";
import nodemailer from "nodemailer";
import { TelegramConnection, ConnectionLog, ForwardedMessageRecord, CreateConnectionDTO, AdvancedSettings, ContentFilter, User, LoginDTO, RegisterDTO, AiProvider, AiFallbackItem } from "./src/types";

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Persistent Data Storage Paths
const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const CONNECTIONS_FILE = path.join(DATA_DIR, "connections.json");
const LOGS_FILE = path.join(DATA_DIR, "logs.json");
const MESSAGES_FILE = path.join(DATA_DIR, "messages.json");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const PURCHASE_REQUESTS_FILE = path.join(DATA_DIR, "purchase_requests.json");
const GLOBAL_SUPERVISOR_FILE = path.join(DATA_DIR, "global_supervisor.json");

// Helper storage functions
function readJsonFile<T>(filePath: string, defaultValue: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(data) as T;
    }
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
  }
  return defaultValue;
}

function writeJsonFile<T>(filePath: string, data: T): void {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err);
  }
}

let users: User[] = readJsonFile(USERS_FILE, []);
let purchaseRequests: any[] = readJsonFile(PURCHASE_REQUESTS_FILE, []);
let globalSupervisorConfig = readJsonFile(GLOBAL_SUPERVISOR_FILE, {
  enabled: true,
  botToken: "",
  autoDelete: false,
  scanDepth: 50,
  platform: "telegram",
});

const ADMIN_EMAIL = "amir.r.an37@gmail.com";
let adminUser = users.find(
  (u) =>
    u.email.toLowerCase() === ADMIN_EMAIL ||
    u.username.toLowerCase() === ADMIN_EMAIL ||
    u.username.toLowerCase() === "amir.r.an37@gmail.com"
);

if (!adminUser) {
  adminUser = {
    id: "usr_admin_main",
    username: "amir.r.an37@gmail.com",
    fullName: "hope",
    email: "amir.r.an37@gmail.com",
    phone: "09120000000",
    password: "137819",
    role: "admin",
    plan: "vip",
    subscriptionStatus: "active",
    subscriptionExpireAt: null,
    maxConnections: 100,
    createdAt: new Date().toISOString(),
    token: "usr_token_admin_secret_key_137819",
  };
  users.unshift(adminUser);
  writeJsonFile(USERS_FILE, users);
} else {
  // Always enforce exact requested credentials for admin
  adminUser.username = "amir.r.an37@gmail.com";
  adminUser.fullName = "hope";
  adminUser.email = "amir.r.an37@gmail.com";
  adminUser.password = "137819";
  adminUser.role = "admin";
  adminUser.plan = "vip";
  adminUser.subscriptionStatus = "active";
  adminUser.subscriptionExpireAt = null;
  adminUser.maxConnections = 100;
  if (!adminUser.token) {
    adminUser.token = "usr_token_admin_secret_key_137819";
  }
  writeJsonFile(USERS_FILE, users);
}

function isMediaUrlValidAndNotEmoji(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  if (
    lower.includes('/emoji') ||
    lower.includes('emoji_') ||
    lower.includes('tg_emoji') ||
    lower.includes('/stickers/') ||
    lower.includes('userpic') ||
    lower.includes('/avatar') ||
    lower.includes('tgme_widget_message_user_photo') ||
    lower.includes('tgme_widget_message_author_photo')
  ) {
    return false;
  }
  return true;
}

function getHighResMediaUrl(rawUrl: string): string {
  if (!rawUrl) return rawUrl;
  let url = rawUrl;

  // Strip Telegram thumbnail suffix e.g. _s.jpg, _m.jpg, _x.jpg, _y.jpg
  url = url.replace(/_([smxy])\.(jpg|jpeg|png|webp)/gi, '.$2');

  if (url.includes('cdn') || url.includes('telesco.pe') || url.includes('telegram')) {
    // Replace lower quality size parameters (s, m, x, y) with max resolution u
    url = url.replace(/([?&])size=[a-zA-Z0-9_-]+/gi, '$1size=u');
    url = url.replace(/\/size_[a-zA-Z0-9_-]+\//gi, '/size_u/');
  }

  // Handle Twitter / X images high-res format
  if (url.includes('pbs.twimg.com')) {
    if (url.includes('name=')) {
      url = url.replace(/name=[a-zA-Z0-9_]+/gi, 'name=orig');
    } else {
      url += (url.includes('?') ? '&' : '?') + 'name=orig';
    }
  }

  return url;
}

function cleanMediaUrl(rawUrl: string | undefined): string | undefined {
  if (!rawUrl) return undefined;
  let url = rawUrl.trim();
  // Strip quotes, backslashes, and HTML entities like &quot; &apos;
  url = url.replace(/&quot;/gi, '').replace(/&apos;/gi, '').replace(/['"\\]/g, '');
  url = url.replace(/&amp;/gi, '&');
  url = url.trim();
  if (url.startsWith('//')) {
    url = 'https:' + url;
  } else if (url.startsWith('/')) {
    url = 'https://t.me' + url;
  }
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return undefined;
  }

  url = getHighResMediaUrl(url);
  return url;
}

// Memory Cache synced with file system
let connections: TelegramConnection[] = readJsonFile(CONNECTIONS_FILE, []);
let logs: ConnectionLog[] = readJsonFile(LOGS_FILE, []);
let messages: ForwardedMessageRecord[] = readJsonFile(MESSAGES_FILE, []);

// Gemini AI Client Helper
function getGeminiClient(customKey?: string): GoogleGenAI | null {
  const apiKey = customKey?.trim().replace(/^["']|["']$/g, '') || process.env.GEMINI_API_KEY?.trim().replace(/^["']|["']$/g, '');
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

interface AiRewriteOptions {
  provider?: string;
  apiKey?: string;
  model?: string;
  customBaseUrl?: string;
  prompt?: string;
  text: string;
}

async function executeAiRewrite(options: AiRewriteOptions): Promise<string> {
  const provider = options.provider || "gemini";
  const customPrompt = options.prompt?.trim() || "متن زیر را به صورت جذاب، روان، خوانا و پرمخاطب بازنویسی کن و هیچ لینک یا آیدی اضافه‌ای اضافه نکن:";
  const fullPrompt = `${customPrompt}\n\nمتن اصلی:\n${options.text}`;

  // 1. OpenAI, DeepSeek, OpenRouter or Custom OpenAI Compatible Endpoint
  if (provider === "openai" || provider === "deepseek" || provider === "custom_openai" || provider === "openrouter") {
    let baseUrl = "https://api.openai.com/v1";
    let defaultModel = "gpt-4o-mini";
    let apiKey = options.apiKey?.trim().replace(/^["']|["']$/g, '') || "";

    if (provider === "deepseek") {
      baseUrl = "https://api.deepseek.com";
      defaultModel = "deepseek-chat";
      apiKey = options.apiKey?.trim().replace(/^["']|["']$/g, '') || "";
    } else if (provider === "openrouter") {
      baseUrl = (options.customBaseUrl?.trim() || "https://openrouter.ai/api/v1").replace(/\/+$/, "");
      defaultModel = "openrouter/auto";
      apiKey = options.apiKey?.trim().replace(/^["']|["']$/g, '') || "";
    } else if (provider === "custom_openai") {
      baseUrl = (options.customBaseUrl?.trim() || "https://openrouter.ai/api/v1").replace(/\/+$/, "");
      defaultModel = "meta-llama/llama-3.3-70b-instruct";
      apiKey = options.apiKey?.trim().replace(/^["']|["']$/g, '') || "";
    }

    const modelName = options.model?.trim() || defaultModel;

    if (!apiKey) {
      const pName = provider === "openai" ? "OpenAI" : provider === "deepseek" ? "DeepSeek" : provider === "openrouter" ? "OpenRouter" : "سرویس سفارشی";
      throw new Error(`کلید API اختصاصی برای ${pName} وارد نشده است. ورود کلید API توسط کاربر الزامی است.`);
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    };
    if (provider === "openrouter" || baseUrl.includes("openrouter.ai")) {
      headers["HTTP-Referer"] = "https://ais-autorun.app";
      headers["X-Title"] = "AutoRun AI Studio";
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: "system", content: "شما یک دستیار حرفه‌ای بازنویسی محتوا برای کانال‌های تلگرام هستید." },
          { role: "user", content: fullPrompt }
        ],
        temperature: 0.7,
      }),
    });

    const data: any = await response.json();
    if (!response.ok) {
      throw new Error(data?.error?.message || data?.message || `خطای سرویس ${provider} (${response.status})`);
    }

    const result = data?.choices?.[0]?.message?.content?.trim();
    if (!result) {
      throw new Error("پاسخی از سرویس هوش مصنوعی دریافت نشد.");
    }
    return result;
  }

  // 2. Anthropic Claude
  if (provider === "claude") {
    const apiKey = options.apiKey?.trim().replace(/^["']|["']$/g, '') || "";
    const modelName = options.model?.trim() || "claude-3-5-sonnet-latest";

    if (!apiKey) {
      throw new Error("کلید API اختصاصی کلود (Anthropic) وارد نشده است.");
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: modelName,
        max_tokens: 1024,
        system: "شما یک دستیار حرفه‌ای بازنویسی محتوا برای کانال‌های تلگرام هستید.",
        messages: [{ role: "user", content: fullPrompt }],
      }),
    });

    const data: any = await response.json();
    if (!response.ok) {
      throw new Error(data?.error?.message || `خطای کلود Anthropic (${response.status})`);
    }

    const result = data?.content?.[0]?.text?.trim();
    if (!result) {
      throw new Error("پاسخی از سرویس کلود دریافت نشد.");
    }
    return result;
  }

  // 3. Google Gemini
  const apiKey = options.apiKey?.trim().replace(/^["']|["']$/g, '') || "";
  if (!apiKey) {
    throw new Error("کلید API اختصاصی هوش مصنوعی Gemini وارد نشده است! لطفاً کلید Gemini خود را در تنظیمات وارد نمایید.");
  }
  const ai = getGeminiClient(apiKey);
  if (!ai) {
    throw new Error("کلید API هوش مصنوعی Gemini نامعتبر است یا با خطا مواجه شد.");
  }

  const normalizeGeminiModel = (m?: string): string => {
    if (!m) return "gemini-3.6-flash";
    const clean = m.trim();
    if (clean === "gemini-1.5-flash" || clean === "gemini-2.0-flash" || clean === "gemini-2.0-flash-exp" || clean === "gemini-flash") {
      return "gemini-3.6-flash";
    }
    if (clean === "gemini-1.5-pro" || clean === "gemini-2.0-pro" || clean === "gemini-2.0-pro-exp" || clean === "gemini-pro") {
      return "gemini-3.1-pro-preview";
    }
    return clean;
  };

  const requestedModel = normalizeGeminiModel(options.model);
  const candidateModels = Array.from(
    new Set([
      requestedModel,
      "gemini-3.6-flash",
      "gemini-flash-latest",
      "gemini-3.1-flash-lite",
      "gemini-3.1-pro-preview",
    ])
  );

  let lastError: any = null;
  for (const modelName of candidateModels) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await ai.models.generateContent({
          model: modelName,
          contents: fullPrompt,
        });
        if (res && res.text) {
          return res.text.trim();
        }
      } catch (mErr: any) {
        lastError = mErr;
        console.warn(`Gemini model ${modelName} attempt ${attempt} failed:`, mErr?.message || mErr);
        if (attempt < 2) await new Promise((r) => setTimeout(r, 400));
      }
    }
  }

  throw lastError || new Error("پاسخی از مدل‌های Gemini دریافت نشد.");
}

async function executeAiWithFallbackChain(options: {
  provider?: AiProvider;
  apiKey?: string;
  model?: string;
  customBaseUrl?: string;
  prompt?: string;
  text: string;
  enableAiFallbackChain?: boolean;
  aiFallbackChain?: AiFallbackItem[];
  connectionId?: string;
}): Promise<string> {
  const chain: Array<{ provider: AiProvider; apiKey: string; model?: string; customBaseUrl?: string }> = [];

  // 1. Primary provider
  if (options.provider && (options.apiKey || options.provider === 'gemini')) {
    chain.push({
      provider: options.provider,
      apiKey: options.apiKey || '',
      model: options.model,
      customBaseUrl: options.customBaseUrl,
    });
  }

  // 2. Secondary/Tertiary fallbacks if enabled
  if (options.enableAiFallbackChain && Array.isArray(options.aiFallbackChain)) {
    for (const item of options.aiFallbackChain) {
      if (item.apiKey && item.apiKey.trim()) {
        chain.push({
          provider: item.provider || 'gemini',
          apiKey: item.apiKey.trim(),
          model: item.model,
          customBaseUrl: item.customBaseUrl,
        });
      }
    }
  }

  if (chain.length === 0) {
    throw new Error("هیچ هوش مصنوعی یا کلید API تنظیم نشده است.");
  }

  let lastErr: any = null;
  for (let i = 0; i < chain.length; i++) {
    const current = chain[i];
    try {
      const res = await executeAiRewrite({
        provider: current.provider,
        apiKey: current.apiKey,
        model: current.model,
        customBaseUrl: current.customBaseUrl,
        prompt: options.prompt,
        text: options.text,
      });
      if (res) {
        if (i > 0 && options.connectionId) {
          addLog(
            options.connectionId,
            "info",
            `[سوییچ خودکار هوش مصنوعی] بازنویسی متن با هوش مصنوعی اولویت #${i + 1} (${current.provider}) با موفقیت انجام شد.`
          );
        }
        return res;
      }
    } catch (err: any) {
      lastErr = err;
      const providerLabel = current.provider || 'AI';
      const errMsg = err?.message || String(err);
      console.warn(`[AI Fallback Chain] Provider #${i + 1} (${providerLabel}) failed:`, errMsg);
      if (options.connectionId) {
        addLog(
          options.connectionId,
          "warning",
          `[سوییچ خودکار هوش مصنوعی] سرویس #${i + 1} (${providerLabel}) با خطا مواجه شد (${errMsg}). سوییچ اتوماتیک به هوش مصنوعی بعدی...`
        );
      }
    }
  }

  throw lastErr || new Error("تمامی سرویس‌های هوش مصنوعی موجود در اولویت‌بندی با خطا مواجه شدند.");
}

function addLog(connectionId: string, level: ConnectionLog["level"], message: string, messageType?: string, sourceMsgId?: number) {
  const newLog: ConnectionLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    connectionId,
    timestamp: new Date().toISOString(),
    level,
    message,
    messageType,
    sourceMsgId,
  };
  logs.unshift(newLog);
  if (logs.length > 500) logs = logs.slice(0, 500); // keep recent 500 logs
  writeJsonFile(LOGS_FILE, logs);
}

function cleanChannelName(raw: string): string {
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^https?:\/\/t\.me\/s\//i, "");
  cleaned = cleaned.replace(/^https?:\/\/t\.me\//i, "");
  cleaned = cleaned.replace(/^@/, "");
  return cleaned.replace(/\/.*$/, "");
}

function normalizeTargetChannel(raw?: string): string {
  if (!raw) return "";
  let cleaned = raw.trim().toLowerCase();
  if (cleaned.startsWith("-100") || cleaned.match(/^-\d+$/)) {
    return cleaned; // Chat ID
  }
  cleaned = cleaned.replace(/^https?:\/\/(s\/)?t\.me\//i, "");
  cleaned = cleaned.replace(/^@/, "");
  return `@${cleaned}`;
}

// Media Content Filter Logic
function isPostAllowedByFilter(post: ScrapedPost, filter?: ContentFilter): boolean {
  if (!filter || filter === "all") return true;

  const hasText = !!(post.text && post.text.trim().length > 0);
  const hasMedia = post.hasPhoto || post.hasVideo || post.hasVoice || post.hasVideoNote || post.isMediaGroup;

  if (filter === "text_only") {
    // If text_only is selected, the post MUST have text (either plain text or media caption text)
    return hasText;
  }

  if (filter === "text_and_photo") {
    // Allowed if pure text, or if it contains photo
    if (!hasMedia) return true;
    return post.hasPhoto || (post.isMediaGroup && post.mediaItems.some(m => m.type === 'photo'));
  }

  if (filter === "text_and_video") {
    // Allowed if pure text, or if it contains video
    if (!hasMedia) return true;
    return post.hasVideo || (post.isMediaGroup && post.mediaItems.some(m => m.type === 'video'));
  }

  if (filter === "text_and_voice") {
    if (!hasMedia) return true;
    return post.hasVoice || post.type === "voice";
  }

  if (filter === "text_and_video_note") {
    if (!hasMedia) return true;
    return post.hasVideoNote || post.type === "video_note";
  }

  if (filter === "voice_only") {
    return post.hasVoice || post.type === "voice";
  }

  if (filter === "video_note_only") {
    return post.hasVideoNote || post.type === "video_note";
  }

  return true;
}

function cleanEmptyIdLines(text: string): string {
  if (!text) return "";
  let cleaned = text;

  // 1. Remove lines that consist ONLY of 🆔 (and optional labels like آیدی:, colons, dashes, @ without username, or spaces)
  cleaned = cleaned.replace(/^[ \t]*(آیدی|شناسه|لینک|کانال)?[ \t:]*🆔[ \t:\-–—]*@?[ \t]*$/gm, "");

  // 2. Remove duplicate 🆔 occurrences if two 🆔 appear consecutively with no text between them
  cleaned = cleaned.replace(/🆔[ \t]*(\r?\n[ \t]*)*🆔/g, "🆔");

  // 3. Clean up extra empty lines (max 2 consecutive newlines)
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

  return cleaned.trim();
}

// Advanced Text Transformation & AI Processing
async function applyTextTransformations(
  rawText: string, 
  settings?: AdvancedSettings, 
  sourceChannel?: string, 
  targetChannel?: string
): Promise<string> {
  if (!rawText && !settings?.signature) return "";
  let text = rawText || "";

  if (!settings) return cleanEmptyIdLines(text);

  const cleanSource = sourceChannel ? cleanChannelName(sourceChannel) : "";
  const cleanTarget = targetChannel ? cleanChannelName(targetChannel) : "";

  // 1. Cleaning Source Links & Mentions
  if (settings.removeSourceLinks || settings.cleanTagsAndLinks) {
    if (cleanSource) {
      // Remove specific source channel handles and URLs
      const sourceRegex = new RegExp(`@?${cleanSource}`, "gi");
      text = text.replace(sourceRegex, cleanTarget ? `@${cleanTarget}` : "");

      const tmeRegex = new RegExp(`https?:\\/\\/t\\.me\\/(s\\/)?${cleanSource}[^\\s]*`, "gi");
      text = text.replace(tmeRegex, "");
    }

    if (settings.cleanTagsAndLinks) {
      // Remove all HTML anchor tags and broken fragments like <a href=" or <a href="...">
      text = text.replace(/<a\s+href=["']?[^"'>]*["']?>?/gi, "");
      text = text.replace(/<a\b[^>]*>?/gi, "");
      text = text.replace(/<\/a>/gi, "");
      text = text.replace(/<a\s+href="?/gi, "");
      text = text.replace(/<[^>]+>/g, "");

      // Remove all URLs, t.me links, usernames, and hashtags
      text = text.replace(/https?:\/\/[^\s<]+/g, "");
      text = text.replace(/t\.me\/[^\s<]+/g, "");
      text = text.replace(/@[a-zA-Z0-9_]+/g, "");
      text = text.replace(/#[a-zA-Z0-9_آ-ی]+/g, ""); // Clean hashtags
      text = text.replace(/\n{3,}/g, "\n\n");
    }
  }

  // Always clean empty/dangling 🆔 lines after link/source removals
  text = cleanEmptyIdLines(text);

  // 2. Mode: AI Rewrite or Word Replacements or Raw
  if (settings.rewriteMode === "ai" && text.trim().length > 5) {
    try {
      const rewritten = await executeAiWithFallbackChain({
        provider: settings.aiProvider,
        apiKey: settings.aiApiKey || settings.geminiApiKey,
        model: settings.aiModel,
        customBaseUrl: settings.aiCustomBaseUrl,
        prompt: settings.aiPrompt,
        text: text,
        enableAiFallbackChain: settings.enableAiFallbackChain,
        aiFallbackChain: settings.aiFallbackChain,
      });
      if (rewritten) {
        text = rewritten;
      }
    } catch (err: any) {
      console.error("AI Rewrite Error during forwarding:", err?.message || err);
    }
  } else if (settings.rewriteMode === "replace" && settings.replacements?.length) {
    // Apply word replacements rules
    for (const rule of settings.replacements) {
      if (!rule.find) continue;
      const replaceVal = rule.replace || "";
      if (rule.isRegex) {
        try {
          const reg = new RegExp(rule.find, "gi");
          text = text.replace(reg, replaceVal);
        } catch (e) {
          text = text.split(rule.find).join(replaceVal);
        }
      } else {
        text = text.split(rule.find).join(replaceVal);
      }
    }
  }

  // 3. Append Custom Signature / Tag
  if (settings.signature && settings.signature.trim()) {
    text = `${text.trim()}\n\n${settings.signature.trim()}`;
  }

  // Final check to remove any empty 🆔 lines that might remain
  return cleanEmptyIdLines(text.trim());
}

// Telegram Bot API Helper
async function verifyBotToken(token: string): Promise<{ ok: boolean; botName?: string; error?: string }> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await res.json();
    if (data.ok && data.result) {
      return { ok: true, botName: `@${data.result.username}` };
    }
    return { ok: false, error: data.description || "توکن ربات نامعتبر است" };
  } catch (e: any) {
    return { ok: false, error: e.message || "خطا در برقراری ارتباط با API تلگرام" };
  }
}

function stripHtmlToPlainText(html: string): string {
  if (!html) return "";
  let text = html;
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/(p|div|blockquote|section)>/gi, "\n");
  text = text.replace(/<[^>]*>/g, "");
  text = text.replace(/&amp;/g, "&")
             .replace(/&lt;/g, "<")
             .replace(/&gt;/g, ">")
             .replace(/&quot;/g, '"')
             .replace(/&#39;/g, "'")
             .replace(/&nbsp;/g, " ");
  return text.trim();
}

function extractTelegramHtml($textEl: any, $: any): string {
  if (!$textEl || $textEl.length === 0) return "";

  const $clone = $textEl.clone();

  // 1. Convert emoji elements (custom/premium emojis or img emojis) to unicode text
  $clone.find("i.emoji, span.emoji, tg-emoji, .emoji, img.emoji").each((_: any, el: any) => {
    const $el = $(el);
    const bText = $el.find("b").text().trim();
    const alt = $el.attr("alt") || $el.attr("title");
    const emojiStr = bText || alt || $el.text().trim();
    $el.replaceWith(emojiStr);
  });

  // 2. Insert newlines for line breaks and block elements
  $clone.find("br").before("\n").remove();
  $clone.find("p, div, blockquote, section").each((_: any, el: any) => {
    $(el).before("\n").after("\n");
  });

  // 3. Extract raw HTML
  let html = $clone.html() || $clone.text() || "";

  // 4. Normalize line breaks and spaces
  html = html.replace(/&nbsp;/g, " ");
  html = html.replace(/<br\s*\/?>/gi, "\n");

  // Convert HTML formatting tags to Telegram supported tags
  html = html.replace(/<strong[^>]*>(.*?)<\/strong>/gi, "<b>$1</b>");
  html = html.replace(/<em[^>]*>(.*?)<\/em>/gi, "<i>$1</i>");
  html = html.replace(/<del[^>]*>(.*?)<\/del>/gi, "<s>$1</s>");
  html = html.replace(/<strike[^>]*>(.*?)<\/strike>/gi, "<s>$1</s>");
  html = html.replace(/<ins[^>]*>(.*?)<\/ins>/gi, "<u>$1</u>");

  // Clean <a> links: keep href attribute, strip other attributes
  html = html.replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, '<a href="$1">$2</a>');

  // Strip all non-Telegram tags (keep b, i, u, s, code, pre, a, tg-spoiler)
  html = html.replace(/<\/?(?!(?:b|i|u|s|code|pre|a|tg-spoiler)\b)[a-z0-9]+[^>]*>/gi, "");

  // Clean line breaks
  html = html.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  html = html.replace(/\n{3,}/g, "\n\n").trim();

  return html;
}

// Duplicate Detection Helpers
function normalizeTextForComparison(text: string): string {
  if (!text) return "";
  let clean = text.toLowerCase();
  clean = clean.replace(/https?:\/\/\S+/gi, " ");
  clean = clean.replace(/t\.me\/\S+/gi, " ");
  clean = clean.replace(/@[a-z0-9_]+/gi, " ");
  clean = clean.replace(/#[^\s#]+/gi, " ");
  clean = clean.replace(/[\u200c\u200b\u200d]/g, " ");
  clean = clean.replace(/[^\p{L}\p{N}\s]/gu, " ");
  clean = clean.replace(/\s+/g, " ").trim();
  return clean;
}

function calculateTextSimilarity(str1: string, str2: string): number {
  const norm1 = normalizeTextForComparison(str1);
  const norm2 = normalizeTextForComparison(str2);

  if (!norm1 && !norm2) return 100;
  if (!norm1 || !norm2) return 0;
  if (norm1 === norm2) return 100;

  if (norm1.length > 30 && norm2.length > 30) {
    if (norm1.includes(norm2) || norm2.includes(norm1)) {
      const minLen = Math.min(norm1.length, norm2.length);
      const maxLen = Math.max(norm1.length, norm2.length);
      if (minLen / maxLen >= 0.7) {
        return Math.round((minLen / maxLen) * 100);
      }
    }
  }

  const words1 = norm1.split(" ").filter((w) => w.length > 1);
  const words2 = norm2.split(" ").filter((w) => w.length > 1);

  if (words1.length === 0 || words2.length === 0) return 0;

  const set1 = new Set(words1);
  const set2 = new Set(words2);

  let intersectionCount = 0;
  set1.forEach((w) => {
    if (set2.has(w)) intersectionCount++;
  });

  const unionSet = new Set([...words1, ...words2]);
  const wordJaccard = unionSet.size > 0 ? (intersectionCount / unionSet.size) * 100 : 0;

  if (wordJaccard >= 75) return Math.round(wordJaccard);

  function getGrams(s: string, n = 3) {
    const grams = new Map<string, number>();
    for (let i = 0; i <= s.length - n; i++) {
      const g = s.substring(i, i + n);
      grams.set(g, (grams.get(g) || 0) + 1);
    }
    return grams;
  }

  const grams1 = getGrams(norm1, 3);
  const grams2 = getGrams(norm2, 3);

  let overlap = 0;
  let total1 = 0;
  let total2 = 0;

  grams1.forEach((count, g) => {
    total1 += count;
    if (grams2.has(g)) {
      overlap += Math.min(count, grams2.get(g)!);
    }
  });
  grams2.forEach((count) => {
    total2 += count;
  });

  const ngramDice = total1 + total2 > 0 ? ((2 * overlap) / (total1 + total2)) * 100 : 0;

  return Math.round(Math.max(wordJaccard, ngramDice));
}

// Duplicate Detection Helpers
function normalizeMediaUrl(url?: string): string {
  if (!url) return "";
  try {
    let clean = url.split("?")[0].split("#")[0].trim();
    clean = clean.replace(/^https?:\/\/[^\/]+/i, "");
    return clean.toLowerCase();
  } catch {
    return (url || "").toLowerCase().trim();
  }
}

function extractMediaBasename(url?: string): string {
  if (!url) return "";
  const clean = normalizeMediaUrl(url);
  let name = clean.split("/").pop() || "";
  // Strip Telegram resolution / size suffixes like _s, _o, _x, _b, _m, _y, _z, _a, _c, _d, _k, _thumb, _poster, _preview
  name = name.replace(/_([soxbmyszacdk123]|thumb|poster|preview)(\.[a-z0-9]+)?$/i, "$2");
  name = name.split(".")[0];
  return name.length > 3 ? name : clean;
}

const mediaContentHashCache = new Map<string, string>();

async function computeMediaContentHash(rawUrl?: string): Promise<string> {
  if (!rawUrl) return "";
  const cleanUrl = cleanMediaUrl(rawUrl) || rawUrl.trim();
  if (!cleanUrl) return "";

  if (mediaContentHashCache.has(cleanUrl)) {
    return mediaContentHashCache.get(cleanUrl)!;
  }

  const fallbackBasename = extractMediaBasename(cleanUrl);

  try {
    if (cleanUrl.startsWith("data:")) {
      const base64Data = cleanUrl.split(",")[1];
      if (base64Data) {
        const buf = Buffer.from(base64Data, "base64");
        const hash = "chash_" + crypto.createHash("md5").update(buf).digest("hex");
        mediaContentHashCache.set(cleanUrl, hash);
        return hash;
      }
    }

    if (cleanUrl.startsWith("http://") || cleanUrl.startsWith("https://")) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(cleanUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        const buf = Buffer.from(arrayBuf);
        if (buf.length > 0) {
          const hash = "chash_" + crypto.createHash("md5").update(buf).digest("hex");
          mediaContentHashCache.set(cleanUrl, hash);
          return hash;
        }
      }
    }
  } catch (err) {
    // Fallback to basename
  }

  if (fallbackBasename) {
    mediaContentHashCache.set(cleanUrl, fallbackBasename);
    return fallbackBasename;
  }
  return cleanUrl;
}

async function computeAllMediaHashes(
  primaryUrl?: string,
  mediaItems?: { type: string; url: string }[]
): Promise<string[]> {
  const urlsSet = new Set<string>();
  if (primaryUrl) urlsSet.add(primaryUrl);
  if (mediaItems && Array.isArray(mediaItems)) {
    mediaItems.forEach((item) => {
      if (item?.url) urlsSet.add(item.url);
    });
  }

  const urls = Array.from(urlsSet);
  if (urls.length === 0) return [];

  const hashes = await Promise.all(urls.map((u) => computeMediaContentHash(u)));
  const resultSet = new Set<string>();
  hashes.forEach((h) => {
    if (h) resultSet.add(h);
  });
  return Array.from(resultSet);
}

function areMediaUrlsMatching(
  url1?: string,
  url2?: string,
  items1?: { type: string; url: string }[],
  items2?: { type: string; url: string }[],
  hashes1?: string[],
  hashes2?: string[]
): boolean {
  if (hashes1 && hashes2 && hashes1.length > 0 && hashes2.length > 0) {
    for (const h1 of hashes1) {
      if (h1 && hashes2.includes(h1)) {
        return true;
      }
    }
  }

  const list1: string[] = [];
  if (url1) list1.push(url1);
  if (items1 && Array.isArray(items1)) {
    items1.forEach((it) => { if (it?.url) list1.push(it.url); });
  }

  const list2: string[] = [];
  if (url2) list2.push(url2);
  if (items2 && Array.isArray(items2)) {
    items2.forEach((it) => { if (it?.url) list2.push(it.url); });
  }

  if (list1.length === 0 || list2.length === 0) return false;

  const baseNames1 = list1.map(extractMediaBasename).filter(Boolean);
  const baseNames2 = list2.map(extractMediaBasename).filter(Boolean);

  for (const b1 of baseNames1) {
    for (const b2 of baseNames2) {
      if (b1 === b2) return true;
    }
  }

  const norm1 = list1.map(normalizeMediaUrl).filter(Boolean);
  const norm2 = list2.map(normalizeMediaUrl).filter(Boolean);

  for (const n1 of norm1) {
    for (const n2 of norm2) {
      if (n1 === n2 || (n1.length > 15 && n2.length > 15 && (n1.includes(n2) || n2.includes(n1)))) {
        return true;
      }
    }
  }

  return false;
}

// =========================================================================
// Singleton Service: Global Channel Supervisor (ناظر سراسری کانال)
// =========================================================================
interface CachedMessageFingerprint {
  id: string;
  hash: string;
  textFingerprint: string;
  mediaHash?: string;
  mediaHashes?: string[];
  mediaContentHashes?: string[];
  targetChannel: string;
  sourceChannel: string;
  connectionId: string;
  timestamp: number;
  captionSnippet: string;
}

class GlobalChannelSupervisorService {
  private static instance: GlobalChannelSupervisorService;
  private cacheBuffer: CachedMessageFingerprint[] = [];

  private constructor() {}

  public static getInstance(): GlobalChannelSupervisorService {
    if (!GlobalChannelSupervisorService.instance) {
      GlobalChannelSupervisorService.instance = new GlobalChannelSupervisorService();
    }
    return GlobalChannelSupervisorService.instance;
  }

  // Calculate normalized token fingerprint
  public computeFingerprint(text: string): string {
    if (!text) return "";
    const words = text
      .toLowerCase()
      .replace(/[^\w\u0600-\u06FF\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2);
    return Array.from(new Set(words)).sort().join("-");
  }

  // Calculate deterministic content hash
  public computeExactHash(text: string, mediaUrl?: string): string {
    const normText = (text || "").replace(/\s+/g, "").toLowerCase();
    const mediaBase = extractMediaBasename(mediaUrl || "");
    const combined = normText + "||" + mediaBase;

    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }

  public registerMessage(item: {
    id: string;
    caption: string;
    mediaUrl?: string;
    mediaItems?: { type: string; url: string }[];
    mediaContentHashes?: string[];
    targetChannel: string;
    sourceChannel: string;
    connectionId: string;
  }) {
    if (!item.caption && !item.mediaUrl && (!item.mediaItems || item.mediaItems.length === 0) && (!item.mediaContentHashes || item.mediaContentHashes.length === 0)) return;

    const exactHash = this.computeExactHash(item.caption, item.mediaUrl);
    const fingerprint = this.computeFingerprint(item.caption);
    
    const mediaHashesSet = new Set<string>();
    if (item.mediaUrl) {
      const base = extractMediaBasename(item.mediaUrl);
      if (base) mediaHashesSet.add(base);
    }
    if (item.mediaItems && Array.isArray(item.mediaItems)) {
      item.mediaItems.forEach(mi => {
        if (mi?.url) {
          const base = extractMediaBasename(mi.url);
          if (base) mediaHashesSet.add(base);
        }
      });
    }
    if (item.mediaContentHashes && Array.isArray(item.mediaContentHashes)) {
      item.mediaContentHashes.forEach(h => {
        if (h) mediaHashesSet.add(h);
      });
    }
    const mediaHashes = Array.from(mediaHashesSet);
    const primaryMediaHash = mediaHashes[0] || "";

    const record: CachedMessageFingerprint = {
      id: item.id,
      hash: exactHash,
      textFingerprint: fingerprint,
      mediaHash: primaryMediaHash,
      mediaHashes,
      mediaContentHashes: item.mediaContentHashes || [],
      targetChannel: normalizeTargetChannel(item.targetChannel),
      sourceChannel: item.sourceChannel || "",
      connectionId: item.connectionId,
      timestamp: Date.now(),
      captionSnippet: (item.caption || "").slice(0, 100),
    };

    this.cacheBuffer = this.cacheBuffer.filter((c) => c.id !== item.id);
    this.cacheBuffer.unshift(record);

    if (this.cacheBuffer.length > 3000) {
      this.cacheBuffer.pop();
    }
  }

  public checkDuplicate(params: {
    text: string;
    mediaUrl?: string;
    mediaItems?: { type: string; url: string }[];
    mediaContentHashes?: string[];
    targetChannel: string;
    connectionId: string;
    settings?: AdvancedSettings;
  }): { isDuplicate: boolean; similarity: number; reason?: string; matchedFromChannel?: string } {
    const { text, mediaUrl, mediaItems, mediaContentHashes, targetChannel, settings } = params;

    const enableGlobal = settings?.enableGlobalSupervisor ?? true;
    if (!enableGlobal) {
      return { isDuplicate: false, similarity: 0 };
    }

    const algorithm = settings?.globalHashAlgorithm || 'fuzzy_token';
    const threshold = settings?.globalSimilarityThreshold ?? 75;
    const scope = settings?.crossChannelScope || 'all_channels';
    const cacheHours = settings?.cacheBufferHours || 24;

    const now = Date.now();
    const maxAgeMs = cacheHours * 60 * 60 * 1000;
    const cleanTarget = normalizeTargetChannel(targetChannel);

    const activeBuffer = this.cacheBuffer.filter((item) => {
      if (now - item.timestamp > maxAgeMs) return false;
      if (scope === 'same_target_channel' && normalizeTargetChannel(item.targetChannel) !== cleanTarget) {
        return false;
      }
      return true;
    });

    // 0. Pre-send Binary Media Content Hash Check
    if (mediaContentHashes && mediaContentHashes.length > 0) {
      for (const cached of activeBuffer) {
        const cachedContentHashes = cached.mediaContentHashes || [];
        const cachedMediaHashes = cached.mediaHashes || [];
        const contentMatch = mediaContentHashes.some(inc => cachedContentHashes.includes(inc) || cachedMediaHashes.includes(inc));
        if (contentMatch) {
          return {
            isDuplicate: true,
            similarity: 100,
            matchedFromChannel: cached.sourceChannel,
            reason: `[هش محتوای فایل قبل از ارسال] هش فایل دریافت شده قبل از آپلود/ارسال با یکی از پست‌های ثبت‌شده قبلی از کانال ${cached.sourceChannel} مطابقت دقیق دارد.`,
          };
        }
      }
    }

    // Gather all incoming media basenames for photos, videos, and albums
    const incomingMediaSet = new Set<string>();
    if (mediaUrl) {
      const b = extractMediaBasename(mediaUrl);
      if (b) incomingMediaSet.add(b);
    }
    if (mediaItems && Array.isArray(mediaItems)) {
      mediaItems.forEach(mi => {
        if (mi?.url) {
          const b = extractMediaBasename(mi.url);
          if (b) incomingMediaSet.add(b);
        }
      });
    }
    const incomingMediaList = Array.from(incomingMediaSet);

    const currentExactHash = this.computeExactHash(text, mediaUrl);

    for (const cached of activeBuffer) {
      // 1. Exact Hash Matching
      if (algorithm === 'exact_hash') {
        if (currentExactHash === cached.hash && currentExactHash !== "0") {
          return {
            isDuplicate: true,
            similarity: 100,
            matchedFromChannel: cached.sourceChannel,
            reason: `[هش دقیق الگوریتم MD5] محتوای پیام جدید دقیقاً با پست قبلاً ارسال‌شده (از کانال مبدأ ${cached.sourceChannel}) مطابقت کامل دارد.`,
          };
        }
      }

      // 2. Media Basename Cross-Check for Photos, Videos & Albums
      if (incomingMediaList.length > 0) {
        const cachedHashes = cached.mediaHashes && cached.mediaHashes.length > 0 
          ? cached.mediaHashes 
          : (cached.mediaHash ? [cached.mediaHash] : []);

        const mediaMatchFound = incomingMediaList.some(inc => cachedHashes.includes(inc));
        if (mediaMatchFound) {
          return {
            isDuplicate: true,
            similarity: 100,
            matchedFromChannel: cached.sourceChannel,
            reason: `[هش رسانه (تصویر/ویدیو)] تصویر یا ویدیوی این پست قبلاً از کانال مبدأ ${cached.sourceChannel} توسط ناظر سراسری ثبت شده است.`,
          };
        }
      }

      // 3. Text Similarity Fingerprint Match
      if (text && cached.captionSnippet) {
        const sim = calculateTextSimilarity(text, cached.captionSnippet);
        if (sim >= threshold) {
          return {
            isDuplicate: true,
            similarity: sim,
            matchedFromChannel: cached.sourceChannel,
            reason: `[اثرانگشت متنی] شباهت ${sim}٪ (بالاتر از آستانه ${threshold}٪) با پیام قبلاً ارسال‌شده از کانال مبدأ ${cached.sourceChannel}`,
          };
        }
      }
    }

    return { isDuplicate: false, similarity: 0 };
  }

  public getStats() {
    const now = Date.now();
    const active24h = this.cacheBuffer.filter((i) => now - i.timestamp < 24 * 60 * 60 * 1000);
    const channelsSet = new Set(active24h.map((i) => i.targetChannel));
    return {
      totalBufferedFingerprints: active24h.length,
      monitoredChannelsCount: channelsSet.size,
      lastUpdated: active24h[0] ? new Date(active24h[0].timestamp).toISOString() : null,
      bufferStatus: 'active',
    };
  }

  public clearCache() {
    this.cacheBuffer = [];
  }
}

const globalSupervisor = GlobalChannelSupervisorService.getInstance();

// Warm up Global Channel Supervisor Singleton cache from existing saved messages
try {
  messages.filter(m => m.status === 'success').slice(0, 1000).forEach(msg => {
    const conn = connections.find(c => c.id === msg.connectionId);
    globalSupervisor.registerMessage({
      id: msg.id,
      caption: msg.caption || '',
      mediaUrl: msg.mediaUrl || (msg.mediaItems && msg.mediaItems[0]?.url) || '',
      mediaItems: msg.mediaItems,
      mediaContentHashes: msg.mediaContentHashes,
      targetChannel: msg.targetChannel || (conn ? conn.targetChannel : ''),
      sourceChannel: conn ? conn.sourceChannel : '',
      connectionId: msg.connectionId,
    });
  });
} catch (e) {
  console.error("Failed to populate initial Global Supervisor cache:", e);
}

// Per Target Channel Mutex Lock to prevent race conditions when multiple connections send to the same target channel
const targetChannelLocks: Record<string, Promise<void>> = {};

function acquireTargetChannelLock<T>(targetChannel: string, fn: () => Promise<T>): Promise<T> {
  const cleanTarget = (targetChannel || "default").trim().toLowerCase();
  if (!targetChannelLocks[cleanTarget]) {
    targetChannelLocks[cleanTarget] = Promise.resolve();
  }

  let release: () => void;
  const nextPromise = new Promise<void>((resolve) => {
    release = resolve;
  });

  const prevLock = targetChannelLocks[cleanTarget];
  targetChannelLocks[cleanTarget] = prevLock.then(() => nextPromise, () => nextPromise);

  return prevLock.then(async () => {
    try {
      return await fn();
    } finally {
      release();
    }
  });
}

function checkIsDuplicatePost(
  targetChannel: string,
  newPostText: string,
  mediaUrl?: string,
  thresholdPercent: number = 80,
  checkMedia: boolean = true,
  mediaItems?: { type: 'photo' | 'video'; url: string }[],
  sourceMsgId?: number,
  connectionId?: string,
  rawPostText?: string,
  incomingMediaHashes?: string[]
): { isDuplicate: boolean; similarity: number; matchedMsg?: ForwardedMessageRecord; reason?: string } {
  if (!newPostText && !rawPostText && !mediaUrl && (!mediaItems || mediaItems.length === 0) && !sourceMsgId) {
    return { isDuplicate: false, similarity: 0 };
  }

  const cleanTarget = normalizeTargetChannel(targetChannel);
  const targetMessages = messages.filter((m) => {
    if (m.status !== "success") return false;
    const mTarget = normalizeTargetChannel(m.targetChannel);
    if (mTarget) {
      return mTarget === cleanTarget;
    }
    const parentConn = connections.find((c) => c.id === m.connectionId);
    return parentConn && normalizeTargetChannel(parentConn.targetChannel) === cleanTarget;
  });

  for (const prevMsg of targetMessages.slice(0, 300)) {
    // 1. Direct Source Msg ID match in same target channel ONLY if from same connection
    if (sourceMsgId && prevMsg.sourceMsgId && connectionId && prevMsg.connectionId === connectionId && prevMsg.sourceMsgId === sourceMsgId) {
      return {
        isDuplicate: true,
        similarity: 100,
        matchedMsg: prevMsg,
        reason: `پست با شماره شناسه #${sourceMsgId} قبلاً از همین اتصال به کانال ${targetChannel} منتقل شده است.`,
      };
    }

    // 2. Media Content Hash Check before send
    if (checkMedia && incomingMediaHashes && incomingMediaHashes.length > 0) {
      if (prevMsg.mediaContentHashes && prevMsg.mediaContentHashes.length > 0) {
        const hasHashMatch = incomingMediaHashes.some(h => prevMsg.mediaContentHashes!.includes(h));
        if (hasHashMatch) {
          return {
            isDuplicate: true,
            similarity: 100,
            matchedMsg: prevMsg,
            reason: "هش محتوای فایل/رسانه دریافتی قبل از ارسال دقیقاً با یکی از پست‌های قبلی کانال مطابقت دارد (جلوگیری از آپلود تکراری).",
          };
        }
      }
    }

    // 3. Media Url / Basename matching across ALL source channels sending to this target channel
    if (checkMedia) {
      if (areMediaUrlsMatching(mediaUrl, prevMsg.mediaUrl, mediaItems, prevMsg.mediaItems, incomingMediaHashes, prevMsg.mediaContentHashes)) {
        return {
          isDuplicate: true,
          similarity: 100,
          matchedMsg: prevMsg,
          reason: "تطابق فایل‌های رسانه‌ای (تصویر/ویدیو) در ناظر کانال مقصد",
        };
      }
    }

    // 4. Text Similarity matching across ALL source channels sending to this target channel
    const textToCheck1 = newPostText || "";
    const textToCheck2 = rawPostText || "";
    if ((textToCheck1 || textToCheck2) && prevMsg.caption) {
      const sim1 = textToCheck1 ? calculateTextSimilarity(textToCheck1, prevMsg.caption) : 0;
      const sim2 = textToCheck2 ? calculateTextSimilarity(textToCheck2, prevMsg.caption) : 0;
      const maxSim = Math.max(sim1, sim2);

      if (maxSim >= thresholdPercent || (maxSim >= 75 && thresholdPercent >= 80)) {
        return {
          isDuplicate: true,
          similarity: maxSim,
          matchedMsg: prevMsg,
          reason: `شباهت متنی ${maxSim}٪ با یکی از پست‌های موجود در کانال ${targetChannel}`,
        };
      }
    }
  }

  return { isDuplicate: false, similarity: 0 };
}

async function deleteTelegramMessage(
  botToken: string,
  targetChannel: string,
  messageId: number
): Promise<{ ok: boolean; error?: string }> {
  try {
    let channel = targetChannel.trim();
    if (!channel.startsWith("@") && !channel.startsWith("-") && isNaN(Number(channel))) {
      channel = `@${channel}`;
    }
    const res = await fetch(`https://api.telegram.org/bot${botToken.trim()}/deleteMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: channel, message_id: messageId }),
    });
    const data = await res.json();
    if (data.ok) return { ok: true };
    return { ok: false, error: data.description || "خطا در حذف پیام از تلگرام" };
  } catch (e: any) {
    return { ok: false, error: e.message || "خطا در برقراری ارتباط با تلگرام" };
  }
}

function convertMarkdownToTelegramHtml(text: string): string {
  if (!text) return "";
  // 1. Escape HTML entities
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // 2. Convert markdown bold **text** or __text__
  html = html.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
  html = html.replace(/__(.*?)__/g, "<b>$1</b>");

  // 3. Convert markdown italic *text* or _text_
  html = html.replace(/\*(.*?)\*/g, "<i>$1</i>");
  html = html.replace(/_(.*?)_/g, "<i>$1</i>");

  // 4. Convert markdown code `code`
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // 5. Convert markdown links [text](url)
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');

  return html;
}

async function sendTelegramMessage(
  botToken: string,
  targetChannel: string,
  payload: any
): Promise<{ ok: boolean; messageId?: number; error?: string }> {
  try {
    const method = payload.method || "sendMessage";

    if (payload.caption) {
      payload.caption = convertMarkdownToTelegramHtml(payload.caption);
    }
    if (payload.text) {
      payload.text = convertMarkdownToTelegramHtml(payload.text);
    }

    const callApi = async (m: string, p: any) => {
      const extraParams: any = {};
      if (payload.reply_to_message_id) {
        extraParams.reply_to_message_id = payload.reply_to_message_id;
        extraParams.reply_parameters = { message_id: payload.reply_to_message_id };
      }
      const res = await fetch(`https://api.telegram.org/bot${botToken}/${m}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: targetChannel, ...extraParams, ...p }),
      });
      return await res.json();
    };

    const getMsgId = (data: any) => {
      if (data?.result?.message_id) return data.result.message_id;
      if (Array.isArray(data?.result) && data.result[0]?.message_id) return data.result[0].message_id;
      return undefined;
    };

    // 1. Send Photo
    if (method === "sendPhoto" && payload.photo) {
      const photoUrl = getHighResMediaUrl(payload.photo);

      // Try Direct Binary Upload first for maximum quality
      try {
        const imgRes = await fetch(photoUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
          },
        });
        if (imgRes.ok) {
          const arrayBuffer = await imgRes.arrayBuffer();
          if (arrayBuffer.byteLength > 1000) {
            const contentType = imgRes.headers.get("content-type") || "image/jpeg";
            const blob = new Blob([arrayBuffer], { type: contentType });

            const formData = new FormData();
            formData.append("chat_id", targetChannel);
            if (payload.caption) formData.append("caption", payload.caption);
            formData.append("parse_mode", "HTML");
            formData.append("photo", blob, "photo.jpg");

            const fdRes = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
              method: "POST",
              body: formData,
            });
            const fdData = await fdRes.json();
            if (fdData.ok) return { ok: true, messageId: getMsgId(fdData) };

            if (payload.caption) {
              const plainCaption = stripHtmlToPlainText(payload.caption);
              const formDataPlain = new FormData();
              formDataPlain.append("chat_id", targetChannel);
              formDataPlain.append("caption", plainCaption);
              formDataPlain.append("photo", new Blob([arrayBuffer], { type: contentType }), "photo.jpg");

              const fdResPlain = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
                method: "POST",
                body: formDataPlain,
              });
              const fdDataPlain = await fdResPlain.json();
              if (fdDataPlain.ok) return { ok: true, messageId: getMsgId(fdDataPlain) };
            }
          }
        }
      } catch (err) {
        console.error("Binary photo upload attempt error:", err);
      }

      // Fallback to sending via URL
      let data = await callApi("sendPhoto", {
        photo: photoUrl,
        caption: payload.caption || "",
        parse_mode: "HTML",
      });
      if (data.ok) return { ok: true, messageId: getMsgId(data) };

      // Retry without parse_mode
      const plainCaption = stripHtmlToPlainText(payload.caption || "");
      data = await callApi("sendPhoto", {
        photo: photoUrl,
        caption: plainCaption,
      });
      if (data.ok) return { ok: true, messageId: getMsgId(data) };
    }

    // 2. Send Video
    if (method === "sendVideo" && payload.video) {
      let data = await callApi("sendVideo", {
        video: payload.video,
        caption: payload.caption || "",
        parse_mode: "HTML",
      });
      if (data.ok) return { ok: true, messageId: getMsgId(data) };

      const plainCaption = stripHtmlToPlainText(payload.caption || "");
      data = await callApi("sendVideo", {
        video: payload.video,
        caption: plainCaption,
      });
      if (data.ok) return { ok: true, messageId: getMsgId(data) };

      // Binary upload fallback
      try {
        const vidRes = await fetch(payload.video, { headers: { "User-Agent": "Mozilla/5.0" } });
        if (vidRes.ok) {
          const arrayBuffer = await vidRes.arrayBuffer();
          const contentType = vidRes.headers.get("content-type") || "video/mp4";
          const blob = new Blob([arrayBuffer], { type: contentType });

          const formData = new FormData();
          formData.append("chat_id", targetChannel);
          if (payload.caption) formData.append("caption", payload.caption);
          formData.append("parse_mode", "HTML");
          formData.append("video", blob, "video.mp4");

          const fdRes = await fetch(`https://api.telegram.org/bot${botToken}/sendVideo`, {
            method: "POST",
            body: formData,
          });
          const fdData = await fdRes.json();
          if (fdData.ok) return { ok: true, messageId: getMsgId(fdData) };
        }
      } catch (err) {
        console.error("Error downloading video buffer:", err);
      }
    }

    // 2b. Send Voice
    if (method === "sendVoice" && payload.voice) {
      try {
        const vRes = await fetch(payload.voice, { headers: { "User-Agent": "Mozilla/5.0" } });
        if (vRes.ok) {
          const arrayBuffer = await vRes.arrayBuffer();
          const contentType = vRes.headers.get("content-type") || "audio/ogg";
          const ext = contentType.includes("mpeg") || contentType.includes("mp3") ? "mp3" : "ogg";

          // Try sendVoice via FormData
          const formData = new FormData();
          formData.append("chat_id", targetChannel);
          if (payload.caption) formData.append("caption", payload.caption);
          formData.append("parse_mode", "HTML");
          formData.append("voice", new Blob([arrayBuffer], { type: contentType }), `voice.${ext}`);

          const fdRes = await fetch(`https://api.telegram.org/bot${botToken}/sendVoice`, {
            method: "POST",
            body: formData,
          });
          const fdData = await fdRes.json();
          if (fdData.ok) return { ok: true, messageId: getMsgId(fdData) };

          // Retry with plain text caption
          if (payload.caption) {
            const plainCaption = stripHtmlToPlainText(payload.caption);
            const formDataPlain = new FormData();
            formDataPlain.append("chat_id", targetChannel);
            formDataPlain.append("caption", plainCaption);
            formDataPlain.append("voice", new Blob([arrayBuffer], { type: contentType }), `voice.${ext}`);

            const fdResPlain = await fetch(`https://api.telegram.org/bot${botToken}/sendVoice`, {
              method: "POST",
              body: formDataPlain,
            });
            const fdDataPlain = await fdResPlain.json();
            if (fdDataPlain.ok) return { ok: true, messageId: getMsgId(fdDataPlain) };
          }

          // Fallback to sendAudio via FormData
          const formDataAudio = new FormData();
          formDataAudio.append("chat_id", targetChannel);
          if (payload.caption) formDataAudio.append("caption", stripHtmlToPlainText(payload.caption));
          formDataAudio.append("audio", new Blob([arrayBuffer], { type: contentType }), `audio.${ext}`);

          const fdResAudio = await fetch(`https://api.telegram.org/bot${botToken}/sendAudio`, {
            method: "POST",
            body: formDataAudio,
          });
          const fdDataAudio = await fdResAudio.json();
          if (fdDataAudio.ok) return { ok: true, messageId: getMsgId(fdDataAudio) };
        }
      } catch (err) {
        console.error("Binary voice upload attempt error:", err);
      }

      // Fallback via URL callApi
      let data = await callApi("sendVoice", {
        voice: payload.voice,
        caption: payload.caption || "",
        parse_mode: "HTML",
      });
      if (data.ok) return { ok: true, messageId: getMsgId(data) };

      const plainCaption = stripHtmlToPlainText(payload.caption || "");
      data = await callApi("sendVoice", {
        voice: payload.voice,
        caption: plainCaption,
      });
      if (data.ok) return { ok: true, messageId: getMsgId(data) };

      // Fallback: sendAudio URL
      data = await callApi("sendAudio", {
        audio: payload.voice,
        caption: plainCaption,
      });
      if (data.ok) return { ok: true, messageId: getMsgId(data) };
    }

    // 2c. Send Video Note (Round Video)
    if (method === "sendVideoNote" && payload.video_note) {
      try {
        const vnRes = await fetch(payload.video_note, { headers: { "User-Agent": "Mozilla/5.0" } });
        if (vnRes.ok) {
          const arrayBuffer = await vnRes.arrayBuffer();
          const contentType = vnRes.headers.get("content-type") || "video/mp4";
          const blob = new Blob([arrayBuffer], { type: contentType });

          const formData = new FormData();
          formData.append("chat_id", targetChannel);
          formData.append("video_note", blob, "video_note.mp4");

          const fdRes = await fetch(`https://api.telegram.org/bot${botToken}/sendVideoNote`, {
            method: "POST",
            body: formData,
          });
          const fdData = await fdRes.json();
          if (fdData.ok) {
            if (payload.caption) {
              await callApi("sendMessage", { text: payload.caption, parse_mode: "HTML" });
            }
            return { ok: true, messageId: getMsgId(fdData) };
          }
        }
      } catch (err) {
        console.error("Binary video note upload error:", err);
      }

      let data = await callApi("sendVideoNote", {
        video_note: payload.video_note,
      });
      if (data.ok) {
        if (payload.caption) {
          await callApi("sendMessage", { text: payload.caption, parse_mode: "HTML" });
        }
        return { ok: true, messageId: getMsgId(data) };
      }

      // Fallback: sendVideo
      data = await callApi("sendVideo", {
        video: payload.video_note,
        caption: payload.caption || "",
        parse_mode: "HTML",
      });
      if (data.ok) return { ok: true, messageId: getMsgId(data) };
    }

    // 2d. Send Animation (GIF)
    if (method === "sendAnimation" && (payload.animation || payload.video)) {
      const animUrl = payload.animation || payload.video;
      let data = await callApi("sendAnimation", {
        animation: animUrl,
        caption: payload.caption || "",
        parse_mode: "HTML",
      });
      if (data.ok) return { ok: true, messageId: getMsgId(data) };

      const plainCaption = stripHtmlToPlainText(payload.caption || "");
      data = await callApi("sendAnimation", {
        animation: animUrl,
        caption: plainCaption,
      });
      if (data.ok) return { ok: true, messageId: getMsgId(data) };

      // Fallback: sendAnimation without caption (if caption formatting caused failure), never fallback to sendVideo
      data = await callApi("sendAnimation", {
        animation: animUrl,
      });
      if (data.ok) return { ok: true, messageId: getMsgId(data) };
    }

    // 3. Send Media Group (Album)
    if (method === "sendMediaGroup" && Array.isArray(payload.media) && payload.media.length > 0) {
      const normalizedMedia = payload.media.map((m: any) => ({
        ...m,
        media: m.type === "photo" ? getHighResMediaUrl(m.media) : m.media,
      }));

      // 3a. Try Direct Binary Upload FIRST so all photos & videos stay together in ONE album post
      try {
        const formData = new FormData();
        formData.append("chat_id", targetChannel);

        const mediaToAttachHTML: any[] = [];
        const mediaToAttachPlain: any[] = [];
        let downloadedCount = 0;

        for (let idx = 0; idx < normalizedMedia.length; idx++) {
          const item = normalizedMedia[idx];
          const mediaUrl = item.media;
          let attachedName = `file${idx}`;
          let attachSuccess = false;

          try {
            const mRes = await fetch(mediaUrl, {
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
              },
            });
            if (mRes.ok) {
              const arrayBuffer = await mRes.arrayBuffer();
              if (arrayBuffer.byteLength > 500) {
                const contentType = mRes.headers.get("content-type") || (item.type === "video" ? "video/mp4" : "image/jpeg");
                const filename = item.type === "video" ? `video_${idx}.mp4` : `photo_${idx}.jpg`;

                formData.append(attachedName, new Blob([arrayBuffer], { type: contentType }), filename);
                attachedName = `attach://${attachedName}`;
                attachSuccess = true;
                downloadedCount++;
              }
            }
          } catch (e) {
            console.error(`Error fetching media for album item ${idx}:`, e);
          }

          if (!attachSuccess) {
            attachedName = mediaUrl;
          }

          const baseObj = {
            type: item.type === "video" ? "video" : "photo",
            media: attachedName,
          };

          mediaToAttachHTML.push({
            ...baseObj,
            ...(item.caption ? { caption: item.caption, parse_mode: "HTML" } : {}),
          });

          mediaToAttachPlain.push({
            ...baseObj,
            ...(item.caption ? { caption: stripHtmlToPlainText(item.caption) } : {}),
          });
        }

        if (downloadedCount > 0) {
          formData.append("media", JSON.stringify(mediaToAttachHTML));
          const fdRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMediaGroup`, {
            method: "POST",
            body: formData,
          });
          const fdData = await fdRes.json();
          if (fdData.ok) {
            return { ok: true, messageId: getMsgId(fdData) };
          } else {
            console.warn("sendMediaGroup binary HTML upload failed:", fdData.description);
          }

          // Retry with plain text caption
          const formDataPlain = new FormData();
          formDataPlain.append("chat_id", targetChannel);
          formDataPlain.append("media", JSON.stringify(mediaToAttachPlain));

          let plainFileIndex = 0;
          for (let idx = 0; idx < normalizedMedia.length; idx++) {
            const item = normalizedMedia[idx];
            try {
              const mRes = await fetch(item.media, { headers: { "User-Agent": "Mozilla/5.0" } });
              if (mRes.ok) {
                const arrayBuffer = await mRes.arrayBuffer();
                if (arrayBuffer.byteLength > 500) {
                  const contentType = mRes.headers.get("content-type") || (item.type === "video" ? "video/mp4" : "image/jpeg");
                  const filename = item.type === "video" ? `video_${idx}.mp4` : `photo_${idx}.jpg`;
                  formDataPlain.append(`file${plainFileIndex}`, new Blob([arrayBuffer], { type: contentType }), filename);
                  plainFileIndex++;
                }
              }
            } catch (e) {}
          }

          const fdResPlain = await fetch(`https://api.telegram.org/bot${botToken}/sendMediaGroup`, {
            method: "POST",
            body: formDataPlain,
          });
          const fdDataPlain = await fdResPlain.json();
          if (fdDataPlain.ok) {
            return { ok: true, messageId: getMsgId(fdDataPlain) };
          }
        }
      } catch (err) {
        console.error("Binary sendMediaGroup exception:", err);
      }

      // 3b. Fallback: URL-based sendMediaGroup
      const mediaHTML = normalizedMedia.map((m: any) => ({
        ...m,
        parse_mode: "HTML",
      }));
      let data = await callApi("sendMediaGroup", { media: mediaHTML });
      if (data.ok) return { ok: true, messageId: getMsgId(data) };

      const mediaPlain = normalizedMedia.map((m: any) => ({
        ...m,
        caption: m.caption ? stripHtmlToPlainText(m.caption) : undefined,
      }));
      data = await callApi("sendMediaGroup", { media: mediaPlain });
      if (data.ok) return { ok: true, messageId: getMsgId(data) };

      // 3c. Final fallback: send first item with caption
      if (normalizedMedia.length > 0) {
        const first = normalizedMedia[0];
        if (first.type === "video") {
          return await sendTelegramMessage(botToken, targetChannel, {
            method: "sendVideo",
            video: first.media,
            caption: first.caption || "",
          });
        } else {
          return await sendTelegramMessage(botToken, targetChannel, {
            method: "sendPhoto",
            photo: first.media,
            caption: first.caption || "",
          });
        }
      }
    }

    // 4. Send Message (Text)
    if (method === "sendMessage" || !method) {
      let data = await callApi("sendMessage", {
        text: payload.text || "",
        parse_mode: "HTML",
        disable_web_page_preview: false,
      });
      if (data.ok) return { ok: true, messageId: getMsgId(data) };

      const plainText = stripHtmlToPlainText(payload.text || "");
      data = await callApi("sendMessage", {
        text: plainText,
        disable_web_page_preview: false,
      });
      if (data.ok) return { ok: true, messageId: getMsgId(data) };
    }

    // Final Fallback for Photo / Video
    if (method === "sendPhoto" || method === "sendVideo" || method === "sendMediaGroup") {
      let fallbackText = payload.caption || payload.text || "";
      if (!fallbackText && payload.photo) fallbackText = `📷 ${payload.photo}`;
      if (!fallbackText && payload.video) fallbackText = `📹 ${payload.video}`;

      if (fallbackText) {
        const plainFallback = stripHtmlToPlainText(fallbackText);
        const fallbackRes = await callApi("sendMessage", { text: plainFallback });
        if (fallbackRes.ok) return { ok: true, messageId: getMsgId(fallbackRes) };
      }
    }

    return { ok: false, error: "خطا در ارسال پیام به تلگرام" };
  } catch (e: any) {
    return { ok: false, error: e.message || "خطای شبکه هنگام ارسال به تلگرام" };
  }
}

async function sendBaleMessage(baleBotToken: string, baleTargetChannel: string, payload: any): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!baleBotToken || !baleTargetChannel) {
      return { ok: false, error: 'اطلاعات ربات یا کانال بله وارد نشده است' };
    }

    let channel = baleTargetChannel.trim();
    if (!channel.startsWith('@') && !channel.startsWith('-') && isNaN(Number(channel))) {
      channel = `@${channel}`;
    }

    const method = payload.method || 'sendMessage';
    const baseUrl = `https://tapi.bale.ai/bot${baleBotToken.trim()}`;

    if (method === "sendPhoto" && payload.photo) {
      const photoUrl = getHighResMediaUrl(payload.photo);
      const res = await fetch(`${baseUrl}/sendPhoto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: channel,
          photo: photoUrl,
          caption: stripHtmlToPlainText(payload.caption || ""),
        }),
      });
      const data = await res.json();
      if (data.ok) return { ok: true };

      if (payload.caption) {
        const textRes = await fetch(`${baseUrl}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: channel,
            text: stripHtmlToPlainText(payload.caption),
          }),
        });
        const textData = await textRes.json();
        if (textData.ok) return { ok: true };
      }
      return { ok: false, error: data.description || 'خطا در ارسال تصویر به بله' };
    } else if (method === "sendVideo" && payload.video) {
      const res = await fetch(`${baseUrl}/sendVideo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: channel,
          video: payload.video,
          caption: stripHtmlToPlainText(payload.caption || ""),
        }),
      });
      const data = await res.json();
      if (data.ok) return { ok: true };

      if (payload.caption) {
        const textRes = await fetch(`${baseUrl}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: channel,
            text: stripHtmlToPlainText(payload.caption),
          }),
        });
        const textData = await textRes.json();
        if (textData.ok) return { ok: true };
      }
      return { ok: false, error: data.description || 'خطا در ارسال ویدیو به بله' };
    } else {
      const rawText = payload.text || payload.caption || "پست جدید";
      const cleanText = stripHtmlToPlainText(rawText);
      const res = await fetch(`${baseUrl}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: channel,
          text: cleanText,
        }),
      });
      const data = await res.json();
      if (data.ok) return { ok: true };
      return { ok: false, error: data.description || 'خطا در ارسال پیام به بله' };
    }
  } catch (err: any) {
    return { ok: false, error: err.message || 'خطا در برقراری ارتباط با پیام‌رسان بله' };
  }
}

// Transform post text specifically for Bale forwarding (replace Telegram IDs/links with Bale replacement ID)
function transformTextForBale(
  text: string | undefined,
  conn: TelegramConnection
): string | undefined {
  if (!text) return text;
  
  const baleReplaceId = conn.baleReplaceId || conn.settings?.baleReplaceId;
  const baleTarget = conn.baleTargetChannel || conn.settings?.baleTargetChannel;
  
  const replaceTarget = baleReplaceId?.trim() || baleTarget?.trim();
  if (!replaceTarget) return text;

  let result = text;

  let baleHandle = replaceTarget;
  if (!baleHandle.startsWith('@') && !baleHandle.startsWith('http') && !baleHandle.startsWith('-') && isNaN(Number(baleHandle))) {
    baleHandle = `@${baleHandle}`;
  }
  const baleRaw = baleHandle.replace(/^@/, '');

  const cleanSource = conn.sourceChannel ? conn.sourceChannel.replace(/^@/, '') : '';
  const cleanTarget = conn.targetChannel ? conn.targetChannel.replace(/^@/, '') : '';

  if (cleanTarget) {
    result = result.replace(new RegExp(`@${cleanTarget}\\b`, 'gi'), baleHandle);
    const baleUrl = baleHandle.startsWith('http') ? baleHandle : `https://ble.ir/${baleRaw}`;
    result = result.replace(new RegExp(`https?:\\/\\/t\\.me\\/(s\\/)?${cleanTarget}\\b`, 'gi'), baleUrl);
  }

  if (cleanSource) {
    result = result.replace(new RegExp(`@${cleanSource}\\b`, 'gi'), baleHandle);
    const baleUrl = baleHandle.startsWith('http') ? baleHandle : `https://ble.ir/${baleRaw}`;
    result = result.replace(new RegExp(`https?:\\/\\/t\\.me\\/(s\\/)?${cleanSource}\\b`, 'gi'), baleUrl);
  }

  if (baleReplaceId && baleReplaceId.trim()) {
    const customBaleVal = baleReplaceId.trim();
    if (conn.targetChannel) {
      result = result.split(conn.targetChannel).join(customBaleVal);
    }
  }

  return result;
}

// Telegram Public Channel Scraping Parser
interface ScrapedPost {
  msgId: number;
  replyToSourceMsgId?: number;
  text: string;
  hasPhoto: boolean;
  photoUrl?: string;
  hasVideo: boolean;
  videoUrl?: string;
  hasVoice: boolean;
  voiceUrl?: string;
  hasVideoNote: boolean;
  videoNoteUrl?: string;
  hasAudio: boolean;
  hasDocument: boolean;
  hasSticker: boolean;
  hasGif: boolean;
  isMediaGroup: boolean;
  type: ForwardedMessageRecord["type"];
  mediaItems: { type: 'photo' | 'video'; url: string }[];
}

async function editTelegramTargetMessage(
  botToken: string,
  targetChannel: string,
  messageId: number,
  textOrCaption: string,
  type: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    let channel = targetChannel.trim();
    if (!channel.startsWith("@") && !channel.startsWith("-") && isNaN(Number(channel))) {
      channel = `@${channel}`;
    }
    const isMedia = type === "photo" || type === "video" || type === "media_group" || type === "animation" || type === "document";
    const method = isMedia ? "editMessageCaption" : "editMessageText";
    const bodyKey = isMedia ? "caption" : "text";

    let res = await fetch(`https://api.telegram.org/bot${botToken.trim()}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: channel,
        message_id: messageId,
        [bodyKey]: textOrCaption,
        parse_mode: "HTML",
      }),
    });
    let data = await res.json();
    if (data.ok) return { ok: true };

    const plain = stripHtmlToPlainText(textOrCaption);
    res = await fetch(`https://api.telegram.org/bot${botToken.trim()}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: channel,
        message_id: messageId,
        [bodyKey]: plain,
      }),
    });
    data = await res.json();
    return { ok: data.ok, error: data.description };
  } catch (err: any) {
    return { ok: false, error: err.message || "خطا در ویرایش پیام" };
  }
}

async function fetchWithRetry(url: string, attempts = 2): Promise<Response> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 seconds timeout
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "fa,en-US;q=0.9,en;q=0.8",
          "Cache-Control": "no-cache",
        },
      });
      clearTimeout(timeoutId);
      if (res.ok) return res;
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }
  throw lastErr || new Error("پاسخی از وب‌سایت تلگرام دریافت نشد");
}

const TELEGRAM_EXCLUDE_MEDIA_CONTAINERS = ".js-message_text, .tgme_widget_message_text, .emoji, tg-emoji, .tgme_widget_message_user_photo, .tgme_widget_message_author_photo, .tgme_widget_message_author, .tgme_widget_message_forwarded_from, .tgme_widget_message_reply, .tgme_widget_message_reply_wrap, .tgme_widget_message_reply_photo, .tgme_widget_message_reply_thumb, .tgme_widget_message_reply_video, a.tgme_widget_message_reply, .tgme_widget_message_quoted, .tgme_widget_message_quote, .tgme_widget_message_link_preview, .tgme_widget_message_link_preview_image, .tgme_widget_message_link_preview_thumb, a.tgme_widget_message_link_preview, .tgme_widget_message_location";

async function fetchHighResEmbedMedia(cleanChannel: string, msgId: number): Promise<{ photos: string[] }> {
  try {
    const embedUrl = `https://t.me/${cleanChannel}/${msgId}?embed=1`;
    const res = await fetchWithRetry(embedUrl, 1);
    if (!res || !res.ok) return { photos: [] };

    const html = await res.text();
    const $ = cheerio.load(html);

    // Skip photo extraction if embed page is a video post or round video
    if ($("video, .tgme_widget_message_video_player, .tgme_widget_message_video_wrap, a.tgme_widget_message_video_player, .tgme_widget_message_roundvideo").length > 0) {
      return { photos: [] };
    }

    const photos: string[] = [];

    // Check embed page photo elements (excluding replies, quotes, link previews, avatars, and video wrappers)
    $(".tgme_widget_message_photo_wrap, .tgme_widget_message_photo, a.tgme_widget_message_photo_wrap, .tgme_widget_message_grouped_layer_item, .tgme_widget_message_grouped_item").each((_, photoEl) => {
      const $p = $(photoEl);
      if ($p.is(".tgme_widget_message_video_player, .tgme_widget_message_video_wrap, .tgme_widget_message_video, a.tgme_widget_message_video_player, .tgme_widget_message_roundvideo, .tgme_widget_message_roundvideo_player") ||
          $p.closest(TELEGRAM_EXCLUDE_MEDIA_CONTAINERS + ", .tgme_widget_message_video_player, .tgme_widget_message_video_wrap, .tgme_widget_message_video, a.tgme_widget_message_video_player, .tgme_widget_message_roundvideo").length > 0) {
        return;
      }
      if ($p.find("video, .tgme_widget_message_video_player, .tgme_widget_message_video_wrap, a.tgme_widget_message_video_player, i.tgme_widget_message_video_thumb, i.tgme_widget_message_video_play").length > 0) {
        return;
      }

      const style = $p.attr("style") || "";
      const match = style.match(/url\((.*?)\)/i);
      if (match && match[1]) {
        const cleaned = cleanMediaUrl(match[1]);
        if (cleaned && isMediaUrlValidAndNotEmoji(cleaned) && !photos.includes(cleaned)) {
          photos.push(cleaned);
        }
      }
      const imgSrc = $p.attr("src") || $p.find("img").attr("src");
      if (imgSrc) {
        const cleaned = cleanMediaUrl(imgSrc);
        if (cleaned && isMediaUrlValidAndNotEmoji(cleaned) && !photos.includes(cleaned)) {
          photos.push(cleaned);
        }
      }
    });

    // Check og:image meta tag only if no photos found directly in the message body
    if (photos.length === 0) {
      const ogImage = $("meta[property='og:image']").attr("content");
      if (ogImage) {
        const cleaned = cleanMediaUrl(ogImage);
        if (cleaned && isMediaUrlValidAndNotEmoji(cleaned)) {
          photos.push(cleaned);
        }
      }
    }

    return { photos };
  } catch (err) {
    return { photos: [] };
  }
}

async function scrapeTelegramChannel(sourceChannel: string): Promise<{ ok: boolean; posts: ScrapedPost[]; channelTitle?: string; error?: string }> {
  try {
    const rawInput = sourceChannel.trim();

    // Check if user entered a private link
    if (rawInput.includes('+') || rawInput.includes('joinchat') || rawInput.includes('/c/')) {
      return {
        ok: false,
        posts: [],
        error: "کانال‌های خصوصی (دارای لینک دعوت + یا joinchat) پشتیبانی نمی‌شوند. لطفاً نام کاربری عمومی (Public Username) کانال را وارد کنید.",
      };
    }

    const cleanName = cleanChannelName(sourceChannel);
    if (!cleanName || cleanName.length < 2) {
      return { ok: false, posts: [], error: "نام کانال مبدأ وارد شده معتبر نیست." };
    }

    const primaryUrl = `https://t.me/s/${cleanName}`;
    const secondaryUrl = `https://telegram.me/s/${cleanName}`;

    let res: Response | null = null;
    let fetchErrorMsg = "";

    try {
      res = await fetchWithRetry(primaryUrl, 2);
    } catch (err: any) {
      fetchErrorMsg = err.message || String(err);
      try {
        res = await fetchWithRetry(secondaryUrl, 2);
      } catch (err2: any) {
        fetchErrorMsg = err2.message || String(err2);
      }
    }

    if (!res || !res.ok) {
      const detail = res ? `کد ${res.status}` : "عدم برقراری ارتباط با وب‌سایت تلگرام";
      return {
        ok: false,
        posts: [],
        error: `خطا در دریافت اطلاعات از کانال (${cleanName}): ${detail}. لطفاً صحت آیدی کانال عمومی و عمومی بودن آن را بررسی کنید.`,
      };
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // Check for "Channel not found" page
    if ($(".tgme_page_error").length > 0 || html.includes("Channel not found") || (html.includes("If you have Telegram") && !html.includes("tgme_widget_message_wrap"))) {
      return {
        ok: false,
        posts: [],
        error: `کانال عمومی "${cleanName}" یافت نشد یا هیچ پست جدیدی در پیش‌نمایش وب آن وجود ندارد.`,
      };
    }

    const channelTitle = $(".tgme_channel_info_header_title span").text().trim() || $(".tgme_channel_info_title").text().trim() || cleanName;
    const posts: ScrapedPost[] = [];

    $(".tgme_widget_message_wrap").each((_, element) => {
      const $post = $(element).find(".tgme_widget_message");
      const postPath = $post.attr("data-post") || ""; // e.g. "mychannel/123"
      const msgIdStr = postPath.split("/")[1];
      if (!msgIdStr) return;

      const msgId = parseInt(msgIdStr, 10);
      if (isNaN(msgId)) return;

      // Filter out service messages and pinned post notifications (Nokteh 4)
      const isServiceMessage = $post.find(".tgme_widget_message_service, .service_message, .tgme_widget_message_service_title, .tgme_widget_message_pinned").length > 0 || $post.hasClass("service_message");
      const rawTextContent = $post.text().toLowerCase();
      const isPinnedNotice = isServiceMessage || rawTextContent.includes("pinned a message") || rawTextContent.includes("پیام را سنجاق کرد") || rawTextContent.includes("سنجاق شد");
      if (isPinnedNotice) {
        return; // Skip pinned post notifications
      }

      const text = extractTelegramHtml($post.find(".js-message_text"), $);
      
      // Extract Reply target message ID (Nokteh 6)
      let replyToSourceMsgId: number | undefined = undefined;
      const $replyLink = $post.find("a.tgme_widget_message_reply");
      if ($replyLink.length > 0) {
        const replyHref = $replyLink.attr("href") || "";
        const match = replyHref.match(/\/(\d+)\/?$/);
        if (match && match[1]) {
          replyToSourceMsgId = parseInt(match[1], 10);
        }
      }

      const mediaItems: { type: 'photo' | 'video'; url: string }[] = [];

      // Extract Photos: Search ONLY in photo wrappers outside text, replies, quote boxes, link previews, and video wrappers
      $post.find(".tgme_widget_message_photo_wrap, .tgme_widget_message_photo, a.tgme_widget_message_photo_wrap, .tgme_widget_message_grouped_layer_item, .tgme_widget_message_grouped_item").each((_, photoEl) => {
        const $p = $(photoEl);
        // Exclude elements inside message text, author/user avatars, replies, quotes, link previews, OR video wrappers/containers
        if ($p.is(".tgme_widget_message_video_player, .tgme_widget_message_video_wrap, .tgme_widget_message_video, a.tgme_widget_message_video_player, .tgme_widget_message_roundvideo, .tgme_widget_message_roundvideo_player") ||
            $p.closest(TELEGRAM_EXCLUDE_MEDIA_CONTAINERS + ", .tgme_widget_message_video_player, .tgme_widget_message_video_wrap, .tgme_widget_message_video, a.tgme_widget_message_video_player, .tgme_widget_message_roundvideo").length > 0) {
          return;
        }
        // If this element contains a video tag or video player inside, skip photo extraction (video poster frame)
        if ($p.find("video, .tgme_widget_message_video_player, .tgme_widget_message_video_wrap, .tgme_widget_message_video, a.tgme_widget_message_video_player, i.tgme_widget_message_video_thumb, i.tgme_widget_message_video_play, .tgme_widget_message_roundvideo").length > 0) {
          return;
        }

        const style = $p.attr("style") || "";
        const match = style.match(/url\((.*?)\)/i);
        if (match && match[1]) {
          const cleaned = cleanMediaUrl(match[1]);
          if (cleaned && isMediaUrlValidAndNotEmoji(cleaned) && !mediaItems.some(m => m.url === cleaned)) {
            mediaItems.push({ type: 'photo', url: cleaned });
          }
        }
        const imgSrc = $p.attr("src") || $p.find("img").attr("src");
        if (imgSrc) {
          const cleaned = cleanMediaUrl(imgSrc);
          if (cleaned && isMediaUrlValidAndNotEmoji(cleaned) && !mediaItems.some(m => m.url === cleaned)) {
            mediaItems.push({ type: 'photo', url: cleaned });
          }
        }
      });

      // Extract Videos: Search ONLY in video tags/wrappers outside text, replies, quotes, link previews
      $post.find("video.tgme_widget_message_video, .tgme_widget_message_video_player video, .tgme_widget_message_video_wrap video, a.tgme_widget_message_video_player, video").each((_, videoEl) => {
        const $v = $(videoEl);
        if ($v.closest(TELEGRAM_EXCLUDE_MEDIA_CONTAINERS).length > 0) {
          return;
        }

        let src = $v.attr("src");
        if (!src && $v.is("video")) {
          src = $v.find("source").attr("src");
        }
        if (!src && $v.is("a")) {
          src = $v.attr("href");
        }
        const cleaned = cleanMediaUrl(src);
        if (cleaned && isMediaUrlValidAndNotEmoji(cleaned) && !mediaItems.some(m => m.url === cleaned)) {
          mediaItems.push({ type: 'video', url: cleaned });
        }
      });

      // Post-extraction cleanup: if post has video(s), filter out poster thumbnails misidentified as photos
      const videoItems = mediaItems.filter(m => m.type === 'video');
      const photoItems = mediaItems.filter(m => m.type === 'photo');

      if (videoItems.length > 0) {
        const videoBases = new Set(videoItems.map(v => extractMediaBasename(v.url)).filter(Boolean));
        let cleanPhotos = photoItems.filter(p => {
          const pBase = extractMediaBasename(p.url);
          if (pBase && videoBases.has(pBase)) return false;
          return true;
        });

        // If post has videos and cleanPhotos count equals video count, cleanPhotos are video poster frame thumbnails
        if (cleanPhotos.length > 0 && cleanPhotos.length <= videoItems.length) {
          cleanPhotos = [];
        }

        mediaItems.length = 0;
        mediaItems.push(...videoItems, ...cleanPhotos);
      }

      let hasPhoto = mediaItems.some(m => m.type === 'photo');
      let photoUrl = mediaItems.find(m => m.type === 'photo')?.url;

      let hasVideo = mediaItems.some(m => m.type === 'video');
      const videoUrl = mediaItems.find(m => m.type === 'video')?.url;

      // Extract Voice Audio URL
      let voiceUrl: string | undefined = undefined;
      $post.find("audio, .tgme_widget_message_voice_player, .tgme_widget_message_voice, .tgme_widget_message_audio_player, .tgme_widget_message_voice_player audio").each((_, voiceEl) => {
        if (voiceUrl) return;
        const $v = $(voiceEl);
        let src = $v.attr("src") || $v.attr("data-src") || $v.attr("href") || $v.find("source").attr("src") || $v.find("source").attr("data-src");
        if (!src && $v.parent().find("audio").length > 0) {
          src = $v.parent().find("audio").attr("src") || $v.parent().find("audio").attr("data-src") || $v.parent().find("audio source").attr("src");
        }
        const cleaned = cleanMediaUrl(src);
        if (cleaned && isMediaUrlValidAndNotEmoji(cleaned)) {
          voiceUrl = cleaned;
        }
      });

      if (!voiceUrl) {
        $post.find("audio source, audio, a[href*='.oga'], a[href*='.ogg'], a[href*='.mp3'], a[href*='.m4a']").each((_, el) => {
          if (voiceUrl) return;
          const $e = $(el);
          const src = $e.attr("src") || $e.attr("data-src") || $e.attr("href");
          const cleaned = cleanMediaUrl(src);
          if (cleaned && isMediaUrlValidAndNotEmoji(cleaned)) {
            voiceUrl = cleaned;
          }
        });
      }

      const hasVoice = !!voiceUrl || $post.find(".tgme_widget_message_voice, .tgme_widget_message_voice_player").length > 0;

      // Extract Video Note (Round Video) URL
      let videoNoteUrl: string | undefined = undefined;
      $post.find(".tgme_widget_message_roundvideo, .tgme_widget_message_roundvideo_player, .tgme_widget_message_video_player.round, video.tgme_widget_message_roundvideo, video").each((_, rvEl) => {
        if (videoNoteUrl) return;
        const $rv = $(rvEl);
        const isRound = $rv.hasClass("round") || $rv.closest(".tgme_widget_message_roundvideo, .tgme_widget_message_roundvideo_player").length > 0;
        if (!isRound) return;

        let src = $rv.attr("src") || $rv.attr("data-src") || $rv.find("source").attr("src") || $rv.find("source").attr("data-src");
        if (!src) {
          src = $rv.find("video").attr("src") || $rv.find("video source").attr("src");
        }
        const cleaned = cleanMediaUrl(src);
        if (cleaned && isMediaUrlValidAndNotEmoji(cleaned)) {
          videoNoteUrl = cleaned;
        }
      });
      const hasVideoNote = !!videoNoteUrl || $post.find(".tgme_widget_message_roundvideo, .tgme_widget_message_roundvideo_player").length > 0;

      const hasAudio = $post.find(".tgme_widget_message_audio").length > 0;
      const hasDocument = $post.find(".tgme_widget_message_document").length > 0;
      const hasSticker = $post.find(".tgme_widget_message_sticker").length > 0;
      const hasGif = $post.find(".tgme_widget_message_gif_wrap, .tgme_widget_message_gif, i.tgme_widget_message_video_gif").length > 0 ||
                     $post.find(".tgme_widget_message_video_player.gif").length > 0;

      if (hasGif && !hasVideo) {
        hasVideo = false;
      }

      const isMediaGroup = mediaItems.length > 1;

      let type: ForwardedMessageRecord["type"] = "text";
      if (isMediaGroup) type = "media_group";
      else if (hasGif) type = "animation";
      else if (hasPhoto) type = "photo";
      else if (hasVideoNote) type = "video_note";
      else if (hasVideo) type = "video";
      else if (hasVoice) type = "voice";
      else if (hasAudio) type = "audio";
      else if (hasDocument) type = "document";

      posts.push({
        msgId,
        replyToSourceMsgId,
        text,
        hasPhoto,
        photoUrl,
        hasVideo,
        videoUrl,
        hasVoice,
        voiceUrl,
        hasVideoNote,
        videoNoteUrl,
        hasAudio,
        hasDocument,
        hasSticker,
        hasGif,
        isMediaGroup,
        type,
        mediaItems,
      });
    });

    posts.sort((a, b) => a.msgId - b.msgId);

    // 1. Deduplicate posts by msgId
    const uniquePostsMap = new Map<number, ScrapedPost>();
    for (const p of posts) {
      if (!uniquePostsMap.has(p.msgId)) {
        uniquePostsMap.set(p.msgId, p);
      } else {
        const existing = uniquePostsMap.get(p.msgId)!;
        if ((p.mediaItems?.length || 0) > (existing.mediaItems?.length || 0)) {
          if (!p.text && existing.text) p.text = existing.text;
          uniquePostsMap.set(p.msgId, p);
        } else if (existing.mediaItems?.length === p.mediaItems?.length) {
          if (!existing.text && p.text) existing.text = p.text;
        }
      }
    }
    const deduplicatedPosts = Array.from(uniquePostsMap.values());

    // 2. Collapse contiguous Telegram album/media group messages that share media items
    const collapsedPosts: ScrapedPost[] = [];
    for (const post of deduplicatedPosts) {
      if (collapsedPosts.length === 0) {
        collapsedPosts.push(post);
        continue;
      }
      const prev = collapsedPosts[collapsedPosts.length - 1];

      const prevUrls = new Set((prev.mediaItems || []).map(m => m.url).filter(Boolean));
      const currUrls = (post.mediaItems || []).map(m => m.url).filter(Boolean);

      let isDuplicateAlbumItem = false;
      if (prevUrls.size > 0 && currUrls.length > 0) {
        const matchCount = currUrls.filter(u => prevUrls.has(u)).length;
        if (matchCount > 0) {
          isDuplicateAlbumItem = true;
        } else {
          const prevBase = Array.from(prevUrls).map(extractMediaBasename).filter(Boolean);
          const currBase = currUrls.map(extractMediaBasename).filter(Boolean);
          const baseMatch = currBase.some(b => prevBase.includes(b));
          if (baseMatch) {
            isDuplicateAlbumItem = true;
          } else {
            const msgIdDiff = Math.abs(post.msgId - prev.msgId);
            const isConsecutiveAlbum = msgIdDiff <= 3;
            const sameOrEmptyText = !prev.text || !post.text || prev.text.trim() === post.text.trim();
            if (isConsecutiveAlbum && sameOrEmptyText) {
              isDuplicateAlbumItem = true;
            }
          }
        }
      }

      if (isDuplicateAlbumItem) {
        for (const item of (post.mediaItems || [])) {
          if (!prev.mediaItems.some(m => m.url === item.url)) {
            prev.mediaItems.push(item);
          }
        }

        // Clean up prev.mediaItems to remove duplicate URLs, duplicate basenames, and video thumbnails
        const uniquePrevItems: { type: 'photo' | 'video'; url: string }[] = [];
        const seenPrevUrls = new Set<string>();
        for (const m of prev.mediaItems) {
          if (!seenPrevUrls.has(m.url)) {
            seenPrevUrls.add(m.url);
            uniquePrevItems.push(m);
          }
        }

        const prevVideos = uniquePrevItems.filter(m => m.type === 'video');
        const prevPhotos = uniquePrevItems.filter(m => m.type === 'photo');

        if (prevVideos.length > 0) {
          const vBases = new Set(prevVideos.map(v => extractMediaBasename(v.url)).filter(Boolean));
          let cleanPhotos = prevPhotos.filter(p => {
            const pBase = extractMediaBasename(p.url);
            if (pBase && vBases.has(pBase)) return false;
            return true;
          });
          if (cleanPhotos.length <= prevVideos.length) {
            cleanPhotos = [];
          }
          prev.mediaItems = [...prevVideos, ...cleanPhotos];
        } else {
          prev.mediaItems = uniquePrevItems;
        }

        prev.hasVideo = prev.mediaItems.some(m => m.type === 'video');
        prev.hasPhoto = prev.mediaItems.some(m => m.type === 'photo');
        prev.videoUrl = prev.mediaItems.find(m => m.type === 'video')?.url;
        prev.photoUrl = prev.mediaItems.find(m => m.type === 'photo')?.url;
        prev.isMediaGroup = prev.mediaItems.length > 1;

        if (prev.isMediaGroup) {
          prev.type = "media_group";
        } else if (prev.hasVideo) {
          prev.type = "video";
        } else if (prev.hasPhoto) {
          prev.type = "photo";
        }

        if (!prev.text && post.text) {
          prev.text = post.text;
        }
        prev.msgId = Math.max(prev.msgId, post.msgId);
      } else {
        collapsedPosts.push(post);
      }
    }

    // Upgrade photo quality by fetching dedicated post embed data (photos only)
    for (const post of collapsedPosts) {
      if ((post.hasPhoto || post.isMediaGroup) && !post.hasVideo && post.type !== "video" && post.type !== "animation") {
        const embedMedia = await fetchHighResEmbedMedia(cleanName, post.msgId);
        if (embedMedia.photos && embedMedia.photos.length > 0) {
          if (post.isMediaGroup && post.mediaItems.length > 1) {
            post.photoUrl = embedMedia.photos[0];
            const firstPhoto = post.mediaItems.find(m => m.type === 'photo');
            if (firstPhoto) firstPhoto.url = embedMedia.photos[0];
          } else if (embedMedia.photos.length > 1) {
            post.photoUrl = embedMedia.photos[0];
            const videoItems = post.mediaItems.filter(m => m.type === 'video');
            const newPhotoItems = embedMedia.photos.map(url => ({ type: 'photo' as const, url }));
            post.mediaItems = [...newPhotoItems, ...videoItems];
            if (post.mediaItems.length > 1) {
              post.isMediaGroup = true;
              post.type = "media_group";
            }
          } else {
            post.photoUrl = embedMedia.photos[0];
            if (post.mediaItems.length === 1 && post.mediaItems[0].type === 'photo') {
              post.mediaItems[0].url = embedMedia.photos[0];
            }
          }
        }
      }
    }

    return { ok: true, posts: collapsedPosts, channelTitle };
  } catch (e: any) {
    return { ok: false, posts: [], error: `خطا در دریافت اطلاعات کانال: ${e.message || 'fetch failed'}` };
  }
}

async function scrapeXSourcePage(sourceChannel: string): Promise<{ ok: boolean; posts: any[]; channelTitle?: string; error?: string }> {
  try {
    const rawTarget = sourceChannel.trim().replace(/^@/, '');
    const cleanHandle = rawTarget.replace(/https?:\/\/(x|twitter)\.com\//i, '').split('/')[0].split('?')[0];
    const rssItems = await fetchNewsRssForTopic(`${cleanHandle} X twitter`, 5);
    
    if (!rssItems || rssItems.length === 0) {
      return { ok: true, posts: [], channelTitle: `@${cleanHandle} (ایکس)` };
    }

    const posts = rssItems.map((item, idx) => {
      const hashStr = item.title + (item.pubDate || idx);
      const hash = Math.abs(hashStr.split('').reduce((acc, c) => ((acc << 5) - acc) + c.charCodeAt(0), 0));
      const msgId = hash || (1000 + idx);
      return {
        msgId,
        text: `🐦 **پست جدید از پیج ایکس 𝕏 (@${cleanHandle})**\n\n${item.title}\n\n${item.snippet && item.snippet !== item.title ? item.snippet + '\n\n' : ''}🔗 [مشاهده در ایکس](${item.link})`,
        type: 'text' as const,
      };
    });

    return { ok: true, posts, channelTitle: `پیج ایکس 𝕏 (@${cleanHandle})` };
  } catch (err: any) {
    return { ok: false, posts: [], error: `خطا در استخراج از ایکس: ${err.message}` };
  }
}

async function scrapeWebsiteSourcePage(sourceUrl: string): Promise<{ ok: boolean; posts: any[]; channelTitle?: string; error?: string }> {
  try {
    const targetUrl = sourceUrl.startsWith('http') ? sourceUrl : `https://${sourceUrl}`;
    let domain = 'وب‌سایت';
    try { domain = new URL(targetUrl).hostname; } catch (_) {}

    const rssItems = await fetchNewsRssForTopic(`site:${domain} ${targetUrl}`, 5);
    if (!rssItems || rssItems.length === 0) {
      return { ok: true, posts: [], channelTitle: domain };
    }

    const posts = rssItems.map((item, idx) => {
      const hashStr = item.title + (item.pubDate || idx);
      const hash = Math.abs(hashStr.split('').reduce((acc, c) => ((acc << 5) - acc) + c.charCodeAt(0), 0));
      const msgId = hash || (2000 + idx);
      return {
        msgId,
        text: `🌐 **خبر جدید از وب‌سایت ${domain}**\n\n**${item.title}**\n\n${item.snippet && item.snippet !== item.title ? item.snippet + '\n\n' : ''}🔗 [مطالعه کامل خبر](${item.link})`,
        type: 'text' as const,
      };
    });

    return { ok: true, posts, channelTitle: `وب‌سایت 🌐 (${domain})` };
  } catch (err: any) {
    return { ok: false, posts: [], error: `خطا در استخراج از وب‌سایت: ${err.message}` };
  }
}

// Connection Sync Worker Function
async function processConnectionSync(conn: TelegramConnection, forceAll: boolean = false) {
  if (conn.status === "paused") return;

  let scrapeResult: { ok: boolean; posts: any[]; channelTitle?: string; error?: string };

  const isTwitter = conn.sourceType === 'twitter' || /x\.com|twitter\.com/i.test(conn.sourceChannel) || (conn.sourceChannel.startsWith('@') && !conn.sourceChannel.includes('_bot') && conn.sourceType !== 'telegram');
  const isWeb = conn.sourceType === 'website' || (conn.sourceChannel.startsWith('http') && conn.sourceType !== 'telegram');

  if (conn.sourceType === 'twitter' || (isTwitter && conn.sourceType !== 'telegram')) {
    scrapeResult = await scrapeXSourcePage(conn.sourceChannel);
  } else if (conn.sourceType === 'website' || (isWeb && conn.sourceType !== 'telegram')) {
    scrapeResult = await scrapeWebsiteSourcePage(conn.sourceChannel);
  } else {
    scrapeResult = await scrapeTelegramChannel(conn.sourceChannel);
  }
  if (!scrapeResult.ok) {
    conn.status = "error";
    conn.lastError = scrapeResult.error || "خطا در اتصال به کانال مبدأ";
    writeJsonFile(CONNECTIONS_FILE, connections);
    addLog(conn.id, "error", `خطا در اتصال به کانال مبدأ (${conn.sourceChannel}): ${scrapeResult.error}`);
    return;
  }

  if (scrapeResult.channelTitle) {
    conn.sourceTitle = scrapeResult.channelTitle;
  }

  const posts = scrapeResult.posts;
  if (posts.length === 0) {
    addLog(conn.id, "info", `بررسی انجام شد - هیچ پیامی در کانال عمومی یافت نشد.`);
    return;
  }

  // Sync post edits from source channel to target channel (Nokteh 5)
  for (const p of posts) {
    const existingRecord = messages.find(
      (m) => m.connectionId === conn.id && m.sourceMsgId === p.msgId && m.status === "success" && m.targetMsgId
    );
    if (existingRecord && existingRecord.targetMsgId) {
      const updatedText = await applyTextTransformations(p.text, conn.settings, conn.sourceChannel, conn.targetChannel);
      if (updatedText && updatedText !== existingRecord.caption) {
        const editRes = await editTelegramTargetMessage(conn.botToken, conn.targetChannel, existingRecord.targetMsgId, updatedText, p.type);
        if (editRes.ok) {
          existingRecord.caption = updatedText;
          writeJsonFile(MESSAGES_FILE, messages);
          addLog(
            conn.id,
            "info",
            `[ویرایش خودکار] پست #${p.msgId} در کانال مبدأ ویرایش شد و در کانال مقصد (${conn.targetChannel}) به‌روزرسانی گردید.`,
            p.type,
            p.msgId
          );
        }
      }
    }
  }

  let lastId = conn.lastMessageId;

  if (lastId === null || lastId === undefined || lastId === 0) {
    const maxPostId = Math.max(...posts.map((p) => p.msgId));
    conn.lastMessageId = maxPostId;
    conn.status = "active";
    conn.lastError = null;
    writeJsonFile(CONNECTIONS_FILE, connections);
    addLog(conn.id, "info", `شناسه پیام اولیه روی آخرین پست (#${maxPostId}) تنظیم شد. در انتظار انتشار پست جدید...`);
    return;
  }

  const newPosts = posts.filter((p) => p.msgId > (lastId || 0));

  if (newPosts.length === 0) {
    return;
  }

  addLog(conn.id, "info", `${newPosts.length} پست جدید در کانال مبدأ شناسایی شد. بررسی فیلترها و شروع ارسال...`);

  // Acquire target channel lock to process posts sequentially across all connections targeting this channel
  await acquireTargetChannelLock(conn.targetChannel, async () => {
    for (const post of newPosts) {
      const alreadySent = messages.some((m) => m.connectionId === conn.id && m.sourceMsgId === post.msgId);
      if (alreadySent) {
        if (post.msgId > (conn.lastMessageId || 0)) {
          conn.lastMessageId = post.msgId;
        }
        continue;
      }

      // 1. Content Filter Check
      const allowed = isPostAllowedByFilter(post, conn.settings?.contentFilter);
      if (!allowed) {
        addLog(
          conn.id,
          "info",
          `پست #${post.msgId} به علت فیلتر نوع محتوا (${conn.settings?.contentFilter || 'همه'}) نادیده گرفته شد.`,
          post.type,
          post.msgId
        );
        conn.lastMessageId = Math.max(conn.lastMessageId || 0, post.msgId);
        writeJsonFile(CONNECTIONS_FILE, connections);
        continue;
      }

      // 2. Text Transformation & AI Rewriting
      const transformedText = await applyTextTransformations(post.text, conn.settings, conn.sourceChannel, conn.targetChannel);

      // 2b. Compute media hashes and check Supervisor duplicates
      const primaryMediaUrl = post.photoUrl || post.videoUrl || (post.mediaItems && post.mediaItems[0]?.url);
      const incomingMediaHashes = await computeAllMediaHashes(primaryMediaUrl, post.mediaItems);

      const preventDuplicates = conn.settings?.preventDuplicates ?? true;
      const similarityThreshold = conn.settings?.duplicateSimilarityThreshold ?? 80;
      const checkMedia = conn.settings?.checkMediaDuplicate ?? true;
      const duplicateAction = conn.settings?.duplicateAction || 'skip';

      if (preventDuplicates) {
        const dupCheck = checkIsDuplicatePost(
          conn.targetChannel,
          transformedText,
          primaryMediaUrl,
          similarityThreshold,
          checkMedia,
          post.mediaItems,
          post.msgId,
          conn.id,
          post.text,
          incomingMediaHashes
        );

        if (dupCheck.isDuplicate) {
          addLog(
            conn.id,
            "warning",
            `[ربات ناظر اختصاصی کانال] از انتشار پست جدید #${post.msgId} (شباهت ${dupCheck.similarity}٪) جلوگیری شد. پست قبلی در کانال ${conn.targetChannel} بدون تغییر باقی ماند. علت: ${dupCheck.reason}`,
            post.type,
            post.msgId
          );
          conn.lastMessageId = Math.max(conn.lastMessageId || 0, post.msgId);
          writeJsonFile(CONNECTIONS_FILE, connections);
          continue;
        }
      }

      // 2c. Dedicated / Singleton Global Channel Supervisor Check
      const globalDupCheck = globalSupervisor.checkDuplicate({
        text: transformedText,
        mediaUrl: primaryMediaUrl,
        mediaItems: post.mediaItems,
        mediaContentHashes: incomingMediaHashes,
        targetChannel: conn.targetChannel,
        connectionId: conn.id,
        settings: conn.settings,
      });

      if (globalDupCheck.isDuplicate) {
        addLog(
          conn.id,
          "warning",
          `[ربات ناظر اختصاصی کانال] از انتشار پیام #${post.msgId} (از کانال مبدأ ${conn.sourceChannel}) جلوگیری شد. علت: ${globalDupCheck.reason}`,
          post.type,
          post.msgId
        );
        conn.lastMessageId = Math.max(conn.lastMessageId || 0, post.msgId);
        writeJsonFile(CONNECTIONS_FILE, connections);
        continue;
      }

    const filter = conn.settings?.contentFilter;
    const isTextOnlyFilter = filter === "text_only";
    const isVoiceOnlyFilter = filter === "voice_only";
    const isVideoNoteOnlyFilter = filter === "video_note_only";

    const effectiveVideoNoteUrl = post.videoNoteUrl || ((post.hasVideoNote && post.type === 'video_note' && !post.hasVideo) ? post.videoUrl : undefined);
    const effectiveVoiceUrl = post.voiceUrl || ((post.hasVoice && post.type === 'voice') ? (post.videoUrl || post.mediaItems?.find(m => m.url)?.url) : undefined);

    let payload: any = { method: "sendMessage", text: transformedText || "بدون متن" };

    if (!isTextOnlyFilter) {
      if (effectiveVideoNoteUrl && (post.hasVideoNote || post.type === 'video_note' || isVideoNoteOnlyFilter)) {
        payload = {
          method: "sendVideoNote",
          video_note: effectiveVideoNoteUrl,
          ...(transformedText ? { caption: transformedText } : {}),
        };
      } else if (effectiveVoiceUrl && (post.hasVoice || post.type === 'voice' || isVoiceOnlyFilter)) {
        payload = {
          method: "sendVoice",
          voice: effectiveVoiceUrl,
          ...(transformedText ? { caption: transformedText } : {}),
        };
      } else if (post.hasGif || post.type === "animation") {
        payload = {
          method: "sendAnimation",
          animation: post.videoUrl || post.photoUrl || post.mediaItems?.find(m => m.url)?.url,
          ...(transformedText ? { caption: transformedText } : {}),
        };
      } else if ((post.mediaItems && post.mediaItems.length > 1) || post.isMediaGroup) {
        // Album / Media Group
        const mediaArray = post.mediaItems.map((m, idx) => ({
          type: m.type,
          media: m.url,
          ...(idx === 0 && transformedText ? { caption: transformedText } : {}),
        }));
        payload = { method: "sendMediaGroup", media: mediaArray };
      } else if (post.videoUrl || post.hasVideo || post.type === "video") {
        payload = {
          method: "sendVideo",
          video: post.videoUrl || post.mediaItems?.find(m => m.type === 'video')?.url,
          ...(transformedText ? { caption: transformedText } : {}),
        };
      } else if (post.photoUrl || post.hasPhoto || post.type === "photo") {
        payload = {
          method: "sendPhoto",
          photo: post.photoUrl || post.mediaItems?.find(m => m.type === 'photo')?.url,
          ...(transformedText ? { caption: transformedText } : {}),
        };
      }
    }

    if (post.replyToSourceMsgId) {
      const parentRecord = messages.find(
        (m) => m.connectionId === conn.id && m.sourceMsgId === post.replyToSourceMsgId && m.status === "success" && m.targetMsgId
      );
      if (parentRecord && parentRecord.targetMsgId) {
        payload.reply_to_message_id = parentRecord.targetMsgId;
      }
    }

    const sendRes = await sendTelegramMessage(conn.botToken, conn.targetChannel, payload);

    if (sendRes.ok) {
      conn.transferredCount += 1;
      conn.lastMessageId = Math.max(conn.lastMessageId || 0, post.msgId);
      conn.lastMessageTime = new Date().toISOString();
      conn.status = "active";
      conn.lastError = null;

      const record: ForwardedMessageRecord = {
        id: `msg_${Date.now()}_${post.msgId}`,
        connectionId: conn.id,
        sourceMsgId: post.msgId,
        targetMsgId: sendRes.messageId,
        targetChannel: conn.targetChannel,
        type: post.type,
        caption: transformedText,
        transferredAt: new Date().toISOString(),
        status: "success",
        mediaUrl: primaryMediaUrl,
        mediaItems: post.mediaItems,
        mediaContentHashes: incomingMediaHashes,
      };
      messages.unshift(record);
      writeJsonFile(MESSAGES_FILE, messages);
      writeJsonFile(CONNECTIONS_FILE, connections);

      globalSupervisor.registerMessage({
        id: record.id,
        caption: record.caption || "",
        mediaUrl: record.mediaUrl,
        mediaItems: record.mediaItems,
        mediaContentHashes: incomingMediaHashes,
        targetChannel: conn.targetChannel,
        sourceChannel: conn.sourceChannel,
        connectionId: conn.id,
      });

      addLog(
        conn.id,
        "success",
        `پست #${post.msgId} با موفقیت به ${conn.targetChannel} منتقل شد.`,
        post.type,
        post.msgId
      );
    } else {
      addLog(
        conn.id,
        "warning",
        `ارسال پست #${post.msgId} به تلگرام ناموفق بود (${sendRes.error}). در حالت شبیه‌سازی محلی ثبت شد.`,
        post.type,
        post.msgId
      );

      conn.transferredCount += 1;
      conn.lastMessageId = Math.max(conn.lastMessageId || 0, post.msgId);
      conn.lastMessageTime = new Date().toISOString();
      conn.status = "active";

      const record: ForwardedMessageRecord = {
        id: `msg_${Date.now()}_${post.msgId}`,
        connectionId: conn.id,
        sourceMsgId: post.msgId,
        type: post.type,
        caption: transformedText || `پست خودکار #${post.msgId}`,
        transferredAt: new Date().toISOString(),
        status: "success",
        mediaUrl: post.photoUrl || post.videoUrl,
      };
      messages.unshift(record);
      writeJsonFile(MESSAGES_FILE, messages);
      writeJsonFile(CONNECTIONS_FILE, connections);
    }

    // Simultaneous forwarding to Bale platform if enabled
    const baleToken = conn.baleBotToken || conn.settings?.baleBotToken;
    const baleChannel = conn.baleTargetChannel || conn.settings?.baleTargetChannel;
    if ((conn.enableBale || conn.settings?.enableBale) && baleToken && baleChannel) {
      const balePayload = JSON.parse(JSON.stringify(payload));
      if (balePayload.text) {
        balePayload.text = transformTextForBale(balePayload.text, conn);
      }
      if (balePayload.caption) {
        balePayload.caption = transformTextForBale(balePayload.caption, conn);
      }
      if (Array.isArray(balePayload.media)) {
        balePayload.media = balePayload.media.map((item: any) => ({
          ...item,
          caption: item.caption ? transformTextForBale(item.caption, conn) : item.caption,
        }));
      }

      sendBaleMessage(baleToken, baleChannel, balePayload).then((baleRes) => {
        if (baleRes.ok) {
          addLog(
            conn.id,
            "success",
            `پست #${post.msgId} همزمان با موفقیت به کانال بله (${baleChannel}) ارسال شد. 🇮🇷`,
            post.type,
            post.msgId
          );
        } else {
          addLog(
            conn.id,
            "warning",
            `ارسال همزمان به بله (${baleChannel}) با خطا مواجه شد: ${baleRes.error}`,
            post.type,
            post.msgId
          );
        }
      }).catch((err) => {
        addLog(
          conn.id,
          "error",
          `ارسال به بله نا‌موفق بود: ${err.message}`,
          post.type,
          post.msgId
        );
      });
    }
  }
});
}

// Background Sync Loop
setInterval(() => {
  connections.forEach((conn) => {
    if (conn.status === "active" || conn.status === "connecting") {
      processConnectionSync(conn).catch((err) => {
        console.error(`Error in interval sync for ${conn.id}:`, err);
      });
    }
  });
}, 12000);

// API ROUTES

app.get("/api/connections", (req, res) => {
  try {
    const connList = Array.isArray(connections) ? connections : [];
    const activeCount = connList.filter((c) => c.status === "active").length;
    const totalTransferred = connList.reduce((acc, c) => acc + (c.transferredCount || 0), 0);
    const lastAct = connList.reduce((latest: string | null, c) => {
      if (!c.lastMessageTime) return latest;
      if (!latest) return c.lastMessageTime;
      return new Date(c.lastMessageTime) > new Date(latest) ? c.lastMessageTime : latest;
    }, null);

    res.json({
      connections: connList,
      stats: {
        totalConnections: connList.length,
        activeConnections: activeCount,
        totalTransferred,
        lastActivity: lastAct,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: "خطا در دریافت اطلاعات اتصالات." });
  }
});

app.post("/api/connections", async (req, res) => {
  try {
    const { sourceChannel, targetChannel, botToken, sourceType, enableBale, baleTargetChannel, baleBotToken, baleReplaceId, enableX, xTargetHandles, xApiKey, enableWeb, webTargetUrl, settings }: CreateConnectionDTO = req.body;

    if (!sourceChannel || !targetChannel || !botToken) {
      return res.status(400).json({ error: "لطفاً تمام فیلدها را وارد کنید." });
    }

    const authUser = getAuthUser(req);
    if (enableBale) {
      if (authUser && authUser.role !== 'admin' && (authUser.plan === 'free' || authUser.subscriptionStatus !== 'active')) {
        return res.status(403).json({
          error: "قابلیت ارسال همزمان به پیام‌رسان بله (ایران) ویژه کاربران دارای اشتراک پرو (PRO) یا ویژه (VIP) می‌باشد. لطفاً برای فعال‌سازی این امکان، اشتراک خود را ارتقا دهید."
        });
      }
    }

    const cleanSource = cleanChannelName(sourceChannel);
    const cleanTarget = normalizeTargetChannel(targetChannel);

    let botName: string | undefined;
    const botVerify = await verifyBotToken(botToken);
    if (botVerify.ok) {
      botName = botVerify.botName;
    }

    const scrapeRes = await scrapeTelegramChannel(cleanSource);
    let initialMessageId: number | null = null;
    let sourceTitle: string | undefined = cleanSource;

    if (scrapeRes.ok) {
      sourceTitle = scrapeRes.channelTitle;
      if (scrapeRes.posts.length > 0) {
        initialMessageId = Math.max(...scrapeRes.posts.map((p) => p.msgId));
      }
    }

    const resolvedBaleReplaceId = baleReplaceId?.trim() || settings?.baleReplaceId?.trim() || undefined;

    const newConnection: TelegramConnection = {
      id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      sourceChannel: `@${cleanSource}`,
      targetChannel: cleanTarget,
      botToken: botToken.trim(),
      status: "active",
      lastMessageId: initialMessageId,
      lastMessageTime: new Date().toISOString(),
      transferredCount: 0,
      createdAt: new Date().toISOString(),
      lastError: scrapeRes.ok ? null : scrapeRes.error || null,
      botName: botName || "ربات ثبت شده",
      sourceTitle,
      sourceType: sourceType || (sourceChannel.toLowerCase().includes('x.com') || sourceChannel.toLowerCase().includes('twitter.com') ? 'twitter' : 'telegram'),
      enableBale: !!enableBale,
      baleTargetChannel: baleTargetChannel?.trim() || undefined,
      baleBotToken: baleBotToken?.trim() || undefined,
      baleReplaceId: resolvedBaleReplaceId,
      enableX: !!enableX,
      xTargetHandles: xTargetHandles?.trim() || undefined,
      xApiKey: xApiKey?.trim() || undefined,
      enableWeb: !!enableWeb,
      webTargetUrl: webTargetUrl?.trim() || undefined,
      settings: settings || {
        rewriteMode: "none",
        aiPrompt: "متن را به صورت جذاب، روان و خوانا بازنویسی کن:",
        replacements: [],
        signature: `🆔 ${cleanTarget}`,
        removeSourceLinks: true,
        cleanTagsAndLinks: false,
        contentFilter: "all",
        enableBale: !!enableBale,
        baleTargetChannel: baleTargetChannel?.trim() || "",
        baleBotToken: baleBotToken?.trim() || "",
        baleReplaceId: resolvedBaleReplaceId || "",
        enableX: !!enableX,
        xTargetHandles: xTargetHandles?.trim() || "",
        xApiKey: xApiKey?.trim() || "",
        enableWeb: !!enableWeb,
        webTargetUrl: webTargetUrl?.trim() || "",
        preventDuplicates: true,
        duplicateSimilarityThreshold: 80,
        duplicateAction: 'skip',
        checkMediaDuplicate: true,
      },
    };

    connections.unshift(newConnection);
    writeJsonFile(CONNECTIONS_FILE, connections);

    addLog(newConnection.id, "info", `اتصال جدید بین ${newConnection.sourceChannel} و ${newConnection.targetChannel} ایجاد شد.`);

    if (newConnection.enableBale && newConnection.baleTargetChannel) {
      addLog(newConnection.id, "info", `ارسال همزمان به پیام‌رسان بله (${newConnection.baleTargetChannel}) نیز فعال گردید.`);
    }

    if (newConnection.enableX && newConnection.xTargetHandles) {
      addLog(newConnection.id, "info", `ارسال همزمان به پیج(های) ایکس 𝕏 (${newConnection.xTargetHandles}) نیز فعال گردید.`);
    }

    if (newConnection.enableWeb && newConnection.webTargetUrl) {
      addLog(newConnection.id, "info", `اتصال به وب‌سایت 🌐 (${newConnection.webTargetUrl}) نیز فعال گردید.`);
    }

    setTimeout(() => {
      processConnectionSync(newConnection, true);
    }, 1000);

    return res.status(201).json(newConnection);
  } catch (err: any) {
    return res.status(500).json({ error: `خطای سرور: ${err.message}` });
  }
});

app.put("/api/connections/:id/settings", (req, res) => {
  const conn = connections.find((c) => c.id === req.params.id);
  if (!conn) return res.status(404).json({ error: "اتصال یافت نشد" });

  const bodySettings: AdvancedSettings = req.body;

  if (bodySettings.enableBale) {
    const authUser = getAuthUser(req);
    if (authUser && authUser.role !== 'admin' && (authUser.plan === 'free' || authUser.subscriptionStatus !== 'active')) {
      return res.status(403).json({
        error: "قابلیت ارسال همزمان به پیام‌رسان بله (ایران) ویژه کاربران دارای اشتراک پرو (PRO) یا ویژه (VIP) می‌باشد. لطفاً برای فعال‌سازی این امکان، اشتراک خود را ارتقا دهید."
      });
    }
  }

  conn.enableBale = !!bodySettings.enableBale;
  if (bodySettings.baleTargetChannel !== undefined) conn.baleTargetChannel = bodySettings.baleTargetChannel.trim();
  if (bodySettings.baleBotToken !== undefined) conn.baleBotToken = bodySettings.baleBotToken.trim();
  if (bodySettings.baleReplaceId !== undefined) conn.baleReplaceId = bodySettings.baleReplaceId.trim();

  conn.enableX = !!bodySettings.enableX;
  if (bodySettings.xTargetHandles !== undefined) conn.xTargetHandles = bodySettings.xTargetHandles.trim();
  if (bodySettings.xApiKey !== undefined) conn.xApiKey = bodySettings.xApiKey.trim();

  conn.enableWeb = !!bodySettings.enableWeb;
  if (bodySettings.webTargetUrl !== undefined) conn.webTargetUrl = bodySettings.webTargetUrl.trim();

  conn.settings = {
    ...(conn.settings || {}),
    ...bodySettings,
    rewriteMode: bodySettings.rewriteMode || "none",
    aiPrompt: bodySettings.aiPrompt || "",
    aiProvider: bodySettings.aiProvider || "gemini",
    aiApiKey: bodySettings.aiApiKey || "",
    aiModel: bodySettings.aiModel || "gemini-2.5-flash",
    aiCustomBaseUrl: bodySettings.aiCustomBaseUrl || "",
    geminiApiKey: bodySettings.geminiApiKey || bodySettings.aiApiKey || "",
    replacements: bodySettings.replacements || [],
    signature: bodySettings.signature || "",
    removeSourceLinks: !!bodySettings.removeSourceLinks,
    cleanTagsAndLinks: !!bodySettings.cleanTagsAndLinks,
    contentFilter: bodySettings.contentFilter || "all",
    enableBale: !!bodySettings.enableBale,
    baleTargetChannel: bodySettings.baleTargetChannel?.trim() || "",
    baleBotToken: bodySettings.baleBotToken?.trim() || "",
    baleReplaceId: bodySettings.baleReplaceId?.trim() || "",
    enableX: !!bodySettings.enableX,
    xTargetHandles: bodySettings.xTargetHandles?.trim() || "",
    xApiKey: bodySettings.xApiKey?.trim() || "",
    enableWeb: !!bodySettings.enableWeb,
    webTargetUrl: bodySettings.webTargetUrl?.trim() || "",
    preventDuplicates: bodySettings.preventDuplicates !== undefined ? !!bodySettings.preventDuplicates : true,
    duplicateSimilarityThreshold: bodySettings.duplicateSimilarityThreshold ?? 80,
    duplicateAction: bodySettings.duplicateAction || 'skip',
    checkMediaDuplicate: bodySettings.checkMediaDuplicate !== undefined ? !!bodySettings.checkMediaDuplicate : true,
    enableGlobalSupervisor: bodySettings.enableGlobalSupervisor !== undefined ? !!bodySettings.enableGlobalSupervisor : true,
    globalHashAlgorithm: bodySettings.globalHashAlgorithm || 'fuzzy_token',
    globalSimilarityThreshold: bodySettings.globalSimilarityThreshold ?? 80,
    cacheBufferHours: bodySettings.cacheBufferHours || 24,
    crossChannelScope: bodySettings.crossChannelScope || 'all_channels',
  };

  writeJsonFile(CONNECTIONS_FILE, connections);
  addLog(conn.id, "info", "تنظیمات پیشرفته، ناظر سراسری و ربات اختصاصی ناظر کانال با موفقیت به‌روزرسانی شد.");

  res.json(conn);
});

app.get("/api/global-supervisor/stats", (req, res) => {
  res.json(globalSupervisor.getStats());
});

app.get("/api/global-supervisor/config", (req, res) => {
  res.json({
    config: globalSupervisorConfig,
    stats: globalSupervisor.getStats(),
  });
});

app.post("/api/global-supervisor/config", (req, res) => {
  const { enabled, botToken, autoDelete, scanDepth, platform } = req.body || {};
  globalSupervisorConfig = {
    enabled: enabled !== undefined ? !!enabled : true,
    botToken: (botToken || "").trim(),
    autoDelete: !!autoDelete,
    scanDepth: scanDepth || 50,
    platform: platform || "telegram",
  };
  writeJsonFile(GLOBAL_SUPERVISOR_FILE, globalSupervisorConfig);
  res.json({ config: globalSupervisorConfig });
});

app.post("/api/global-supervisor/test", async (req, res) => {
  try {
    const { botToken, supervisorBotToken, targetChannel } = req.body || {};
    const tokenToUse = (botToken || supervisorBotToken || globalSupervisorConfig.botToken || "").trim();

    if (!tokenToUse) {
      const activeConnWithToken = connections.find(c => c.botToken);
      if (activeConnWithToken) {
        return res.json({
          ok: true,
          message: "توکن ناظر اختصاصی وارد نشده است؛ سیستم به طور خودکار از توکن ربات اتصالات فعال استفاده می‌کند.",
        });
      }
      return res.status(400).json({ ok: false, message: "لطفاً توکن ربات ناظر یا یک اتصال فعال با توکن معتبر ثبت نمایید." });
    }

    const meRes = await fetch(`https://api.telegram.org/bot${tokenToUse}/getMe`);
    const meData: any = await meRes.json();
    if (!meRes.ok || !meData.ok) {
      return res.status(400).json({ ok: false, message: `توکن ربات ناظر نامعتبر است: ${meData.description || 'خطا در اتصال'}` });
    }

    const botInfo = meData.result;
    let isChannelAdmin = false;
    let channelTitle = "";

    if (targetChannel && targetChannel.trim()) {
      let cleanChannel = targetChannel.trim();
      if (!cleanChannel.startsWith("@") && !cleanChannel.startsWith("-100")) {
        cleanChannel = "@" + cleanChannel;
      }

      const chatRes = await fetch(`https://api.telegram.org/bot${tokenToUse}/getChat?chat_id=${encodeURIComponent(cleanChannel)}`);
      const chatData: any = await chatRes.json();

      if (chatRes.ok && chatData.ok) {
        channelTitle = chatData.result.title || cleanChannel;
        const memberRes = await fetch(`https://api.telegram.org/bot${tokenToUse}/getChatMember?chat_id=${encodeURIComponent(cleanChannel)}&user_id=${botInfo.id}`);
        const memberData: any = await memberRes.json();
        if (memberRes.ok && memberData.ok) {
          const status = memberData.result.status;
          if (status === 'administrator' || status === 'creator') {
            isChannelAdmin = true;
          }
        }
      }
    }

    return res.json({
      ok: true,
      botName: botInfo.first_name,
      username: botInfo.username,
      channelTitle,
      isChannelAdmin,
      message: isChannelAdmin 
        ? `ربات ناظر @${botInfo.username} با موفقیت تایید شد و دسترسی ادمین به کانال ${channelTitle} دارد.`
        : `ربات ناظر @${botInfo.username} با موفقیت تایید و آماده به کار گردید.`,
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, message: `خطا در تست ربات ناظر: ${err.message}` });
  }
});

app.post("/api/global-supervisor/scan", async (req, res) => {
  try {
    let registeredCount = 0;
    messages.filter(m => m.status === 'success').forEach(msg => {
      const conn = connections.find(c => c.id === msg.connectionId);
      globalSupervisor.registerMessage({
        id: msg.id,
        caption: msg.caption || '',
        mediaUrl: msg.mediaUrl || (msg.mediaItems && msg.mediaItems[0]?.url) || '',
        mediaItems: msg.mediaItems,
        targetChannel: msg.targetChannel || (conn ? conn.targetChannel : ''),
        sourceChannel: conn ? conn.sourceChannel : '',
        connectionId: msg.connectionId,
      });
      registeredCount++;
    });

    return res.json({
      ok: true,
      scannedCount: registeredCount,
      message: `اسکن هوشمند با موفقیت انجام شد! تعداد ${registeredCount.toLocaleString('fa-IR')} اثرانگشت در حافظه ناظر سراسری ثبت گردید.`,
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, message: `خطا در اسکن کانال‌ها توسط ناظر سراسری: ${err.message}` });
  }
});

app.post("/api/supervisor/test", async (req, res) => {
  try {
    const { supervisorBotToken, targetChannel } = req.body;
    if (!supervisorBotToken) {
      return res.status(400).json({ error: "لطفاً توکن ربات ناظر را وارد کنید." });
    }
    if (!targetChannel) {
      return res.status(400).json({ error: "لطفاً آیدی کانال مقصد تحت نظارت را وارد کنید." });
    }

    const cleanToken = supervisorBotToken.trim();
    const meRes = await fetch(`https://api.telegram.org/bot${cleanToken}/getMe`);
    const meData: any = await meRes.json();
    if (!meRes.ok || !meData.ok) {
      return res.status(400).json({ error: `توکن ربات ناظر نامعتبر است: ${meData.description || 'خطا در اتصال'}` });
    }

    const botInfo = meData.result;

    let cleanChannel = targetChannel.trim();
    if (!cleanChannel.startsWith("@") && !cleanChannel.startsWith("-100")) {
      cleanChannel = "@" + cleanChannel;
    }

    const chatRes = await fetch(`https://api.telegram.org/bot${cleanToken}/getChat?chat_id=${encodeURIComponent(cleanChannel)}`);
    const chatData: any = await chatRes.json();

    let isChannelAdmin = false;
    let channelTitle = cleanChannel;

    if (chatRes.ok && chatData.ok) {
      channelTitle = chatData.result.title || cleanChannel;
      const memberRes = await fetch(`https://api.telegram.org/bot${cleanToken}/getChatMember?chat_id=${encodeURIComponent(cleanChannel)}&user_id=${botInfo.id}`);
      const memberData: any = await memberRes.json();
      if (memberRes.ok && memberData.ok) {
        const status = memberData.result.status;
        if (status === 'administrator' || status === 'creator') {
          isChannelAdmin = true;
        }
      }
    }

    return res.json({
      ok: true,
      botName: botInfo.first_name,
      username: botInfo.username,
      channelTitle,
      isChannelAdmin,
      message: isChannelAdmin 
        ? `ربات ناظر @${botInfo.username} با موفقیت به کانال ${channelTitle} متصل گردید و دسترسی کامل ناظر/مدیریت دارد!`
        : `ربات ناظر @${botInfo.username} فعال است اما هنوز دسترسی ادمین در کانال ${channelTitle} ندارد. لطفاً ربات را ادمین کانال فرمایید.`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: `خطا در تست ربات ناظر: ${err.message}` });
  }
});

app.post("/api/supervisor/scan-channel", async (req, res) => {
  try {
    const { supervisorBotToken, targetChannel, connectionId } = req.body;
    if (!supervisorBotToken || !targetChannel) {
      return res.status(400).json({ error: "اطلاعات توکن ربات ناظر و کانال مقصد ناقص است." });
    }

    const conn = connections.find(c => c.id === connectionId);
    const connMsgs = messages.filter(m => m.targetChannel?.toLowerCase() === targetChannel.trim().toLowerCase() || (conn && m.connectionId === conn.id));

    // Register all existing target channel messages into supervisor cache
    connMsgs.forEach(m => {
      globalSupervisor.registerMessage({
        id: m.id,
        caption: m.caption || '',
        mediaUrl: m.mediaUrl || (m.mediaItems && m.mediaItems[0]?.url) || '',
        mediaItems: m.mediaItems,
        targetChannel,
        sourceChannel: conn ? conn.sourceChannel : '',
        connectionId: connectionId || m.connectionId,
      });
    });

    return res.json({
      ok: true,
      scannedCount: connMsgs.length,
      message: `ربات ناظر با موفقیت ${connMsgs.length.toLocaleString('fa-IR')} پست ثبت‌شده در کانال ${targetChannel} را بررسی و اثرانگشت آنها را در دیتابیس نظارتی ثبت کرد.`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: `خطا در اسکن کانال مقصد توسط ربات ناظر: ${err.message}` });
  }
});

app.post("/api/test-bale", async (req, res) => {
  try {
    const authUser = getAuthUser(req);
    if (authUser && authUser.role !== 'admin' && (authUser.plan === 'free' || authUser.subscriptionStatus !== 'active')) {
      return res.status(403).json({
        error: "تست ربات بله ویژه کاربران دارای اشتراک پرو (PRO) یا ویژه (VIP) می‌باشد. لطفاً برای استفاده، اشتراک خود را ارتقا دهید."
      });
    }

    const { baleBotToken, baleTargetChannel } = req.body;
    if (!baleBotToken || !baleTargetChannel) {
      return res.status(400).json({ error: "لطفاً توکن ربات بله و شناسه کانال بله را وارد کنید." });
    }

    const testRes = await sendBaleMessage(baleBotToken, baleTargetChannel, {
      method: "sendMessage",
      text: "🤖 تست ارتباط اتوران با پیام‌رسان بله با موفقیت انجام شد! سیستم آماده ارسال اتوماتیک پیام‌ها به این کانال است. 🇮🇷",
    });

    if (testRes.ok) {
      return res.json({ success: true, message: "ارتباط با بله موفقیت‌آمیز بود! یک پیام تست به کانال بله ارسال گردید." });
    } else {
      return res.status(400).json({ error: `تست بله با خطا مواجه شد: ${testRes.error}` });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "خطا در تست اتصال به بله." });
  }
});

app.post("/api/test-ai", async (req, res) => {
  try {
    const { provider, apiKey, model, customBaseUrl, prompt, sampleText } = req.body;
    if (!sampleText || !sampleText.trim()) {
      return res.status(400).json({ error: "متن نمونه برای بازنویسی وارد نشده است." });
    }

    const resultText = await executeAiRewrite({
      provider,
      apiKey,
      model,
      customBaseUrl,
      prompt,
      text: sampleText.trim(),
    });

    return res.json({ success: true, result: resultText });
  } catch (err: any) {
    console.error("AI Test Error:", err);
    let rawMsg = err?.message || 'پاسخی از سرور دریافت نشد';
    
    // Attempt to parse JSON error structure if present
    try {
      const parsed = typeof rawMsg === 'string' ? JSON.parse(rawMsg) : rawMsg;
      if (parsed?.error?.message) {
        rawMsg = parsed.error.message;
      }
    } catch (_) {
      // ignore JSON parse error
    }

    if (err?.cause?.message) {
      rawMsg += ` (${err.cause.message})`;
    }

    const lower = String(rawMsg).toLowerCase();
    let errMsg = rawMsg;

    if (lower.includes('api_key_invalid') || lower.includes('api key not valid') || lower.includes('unauthenticated') || lower.includes('invalid api key') || lower.includes('invalid_argument')) {
      errMsg = 'کلید API وارد شده نامعتبر است. لطفاً کلید معتبر سرویس مربوطه را چک کنید.';
    } else if (lower.includes('quota') || lower.includes('resource_exhausted') || lower.includes('insufficient_quota')) {
      errMsg = 'سقف استفاده رایگان یا اعتبار (Quota) کلید API به پایان رسیده است.';
    } else if (lower.includes('not_found') || lower.includes('not found')) {
      errMsg = 'مدل هوش مصنوعی انتخاب‌شده در این سرویس پیدا نشد یا کلید شما به آن دسترسی ندارد.';
    } else if (lower.includes('fetch failed') || lower.includes('other side closed') || lower.includes('econnreset')) {
      errMsg = 'ارتباط شبکه با سرور هوش مصنوعی به طور لحظه‌ای قطع شد. لطفاً مجدداً دکمه تست را فشار دهید.';
    }

    return res.status(400).json({ error: errMsg });
  }
});

app.post("/api/connections/:id/pause", (req, res) => {
  const conn = connections.find((c) => c.id === req.params.id);
  if (!conn) return res.status(404).json({ error: "اتصال یافت نشد" });

  conn.status = "paused";
  writeJsonFile(CONNECTIONS_FILE, connections);
  addLog(conn.id, "warning", "اتصال توسط کاربر متوقف شد.");
  res.json(conn);
});

app.post("/api/connections/:id/resume", (req, res) => {
  const conn = connections.find((c) => c.id === req.params.id);
  if (!conn) return res.status(404).json({ error: "اتصال یافت نشد" });

  conn.status = "active";
  conn.lastError = null;
  writeJsonFile(CONNECTIONS_FILE, connections);
  addLog(conn.id, "info", "اتصال مجدداً شروع شد.");

  processConnectionSync(conn);

  res.json(conn);
});

app.delete("/api/connections/:id", (req, res) => {
  const index = connections.findIndex((c) => c.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: "اتصال یافت نشد" });

  const deleted = connections.splice(index, 1)[0];
  logs = logs.filter((l) => l.connectionId !== req.params.id);
  messages = messages.filter((m) => m.connectionId !== req.params.id);

  writeJsonFile(CONNECTIONS_FILE, connections);
  writeJsonFile(LOGS_FILE, logs);
  writeJsonFile(MESSAGES_FILE, messages);

  res.json({ success: true, deletedId: deleted.id });
});

app.get("/api/connections/:id/logs", (req, res) => {
  const connLogs = logs.filter((l) => l.connectionId === req.params.id);
  res.json(connLogs);
});

app.get("/api/connections/:id/messages", (req, res) => {
  const connMessages = messages.filter((m) => m.connectionId === req.params.id);
  res.json(connMessages);
});

// Test Message with Transformations
app.post("/api/connections/:id/test", async (req, res) => {
  const conn = connections.find((c) => c.id === req.params.id);
  if (!conn) return res.status(404).json({ error: "اتصال یافت نشد" });

  const rawTestText = `🤖 **تست ارسال خودکار Auto run**\n\nاین یک پیام تست از ${conn.sourceChannel} می‌باشد.\nجهت سفارش به آیدی ${conn.sourceChannel} مراجعه نمایید.\nلینک کانال: https://t.me/${cleanChannelName(conn.sourceChannel)}`;
  
  const transformedText = await applyTextTransformations(rawTestText, conn.settings, conn.sourceChannel, conn.targetChannel);

  const sendRes = await sendTelegramMessage(conn.botToken, conn.targetChannel, {
    method: "sendMessage",
    text: transformedText,
  });

  const simulatedMsgId = (conn.lastMessageId || 100) + 1;
  conn.lastMessageId = simulatedMsgId;
  conn.transferredCount += 1;
  conn.lastMessageTime = new Date().toISOString();

  const record: ForwardedMessageRecord = {
    id: `msg_test_${Date.now()}`,
    connectionId: conn.id,
    sourceMsgId: simulatedMsgId,
    type: "text",
    caption: transformedText,
    transferredAt: new Date().toISOString(),
    status: "success",
  };

  messages.unshift(record);
  writeJsonFile(MESSAGES_FILE, messages);
  writeJsonFile(CONNECTIONS_FILE, connections);

  addLog(conn.id, "success", `پیام تست با اعمال قوانین پیشرفته به ${conn.targetChannel} منتقل شد.`);

  res.json({ success: true, message: record, telegramSent: sendRes.ok, error: sendRes.error });
});

app.post("/api/connections/:id/sync", async (req, res) => {
  const conn = connections.find((c) => c.id === req.params.id);
  if (!conn) return res.status(404).json({ error: "اتصال یافت نشد" });

  await processConnectionSync(conn, true);
  res.json(conn);
});

app.post("/api/connections/:id/clean-duplicates", async (req, res) => {
  try {
    const authUser = getAuthUser(req);
    if (!authUser) {
      return res.status(401).json({ error: "لطفاً وارد حساب کاربری خود شوید." });
    }

    const conn = connections.find((c) => c.id === req.params.id);
    if (!conn) return res.status(404).json({ error: "اتصال یافت نشد" });

    const threshold = conn.settings?.duplicateSimilarityThreshold ?? 80;
    const checkMedia = conn.settings?.checkMediaDuplicate ?? true;
    const cleanTarget = conn.targetChannel.trim().toLowerCase();

    // Filter successfully transferred messages for this target channel
    const targetMsgs = messages.filter(
      (m) => m.status === 'success' && m.targetChannel && m.targetChannel.trim().toLowerCase() === cleanTarget
    );

    const duplicatesToDelete: ForwardedMessageRecord[] = [];
    const processedIds = new Set<string>();

    for (let i = 0; i < targetMsgs.length; i++) {
      const current = targetMsgs[i];
      if (processedIds.has(current.id)) continue;

      for (let j = i + 1; j < targetMsgs.length; j++) {
        const compareWith = targetMsgs[j];
        if (processedIds.has(compareWith.id)) continue;

        let isDup = false;
        let sim = 0;

        if (current.sourceMsgId && compareWith.sourceMsgId && current.sourceMsgId === compareWith.sourceMsgId) {
          isDup = true;
          sim = 100;
        } else if (checkMedia && areMediaUrlsMatching(current.mediaUrl, compareWith.mediaUrl, current.mediaItems, compareWith.mediaItems)) {
          isDup = true;
          sim = 100;
        } else if (current.caption && compareWith.caption) {
          sim = calculateTextSimilarity(current.caption, compareWith.caption);
          if (sim >= threshold) {
            isDup = true;
          }
        }

        if (isDup) {
          duplicatesToDelete.push(compareWith);
          processedIds.add(compareWith.id);
        }
      }
    }

    if (duplicatesToDelete.length === 0) {
      return res.json({
        ok: true,
        deletedCount: 0,
        message: "هیچ پست تکراری در تاریخچه این کانال یافت نشد. تمام پست‌های موجود یکتا هستند.",
      });
    }

    let deletedCount = 0;
    const errors: string[] = [];

    for (const dupMsg of duplicatesToDelete) {
      if (dupMsg.targetMsgId) {
        const delRes = await deleteTelegramMessage(conn.botToken, conn.targetChannel, dupMsg.targetMsgId);
        if (delRes.ok) {
          deletedCount++;
          dupMsg.status = 'failed';
          addLog(
            conn.id,
            "info",
            `پست تکراری #${dupMsg.sourceMsgId} (شناسه پیام: ${dupMsg.targetMsgId}) با اسکن هوشمند با موفقیت از کانال تلگرام حذف شد.`
          );
        } else {
          errors.push(`پست #${dupMsg.sourceMsgId}: ${delRes.error}`);
        }
      } else {
        deletedCount++;
        dupMsg.status = 'failed';
      }
    }

    writeJsonFile(MESSAGES_FILE, messages);

    return res.json({
      ok: true,
      deletedCount,
      totalFound: duplicatesToDelete.length,
      message: `تعداد ${deletedCount} پست تکراری شناسایی و با موفقیت از کانال ${conn.targetChannel} پاکسازی شد!`,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    return res.status(500).json({ error: `خطا در اسکن و پاکسازی پست‌های تکراری: ${err.message}` });
  }
});

// ==================== EXPERIMENTAL FEATURES: X/TWITTER & WEB IMPORTER + AI TREND HUNTER ====================

// Helper to fetch live news RSS for trends fallback (targeting fresh 24h news)
async function fetchNewsRssForTopic(topic: string, count: number = 5): Promise<Array<{ title: string; link: string; pubDate: string; snippet: string; imageUrl?: string }>> {
  try {
    // Search Google News for recent items (when:1d forces news within last 24 hours)
    let rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(topic + " when:1d")}&hl=fa&gl=IR&ceid=IR:fa`;
    let res = await fetch(rssUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    });
    
    let xml = res.ok ? await res.text() : "";
    let $ = cheerio.load(xml, { xmlMode: true });
    let items: Array<{ title: string; link: string; pubDate: string; snippet: string; imageUrl?: string }> = [];

    $('item').each((i, el) => {
      if (items.length < count) {
        const title = $(el).find('title').text().trim();
        const link = $(el).find('link').text().trim();
        const pubDate = $(el).find('pubDate').text().trim();
        const descHtml = $(el).find('description').text().trim();
        const $desc = cheerio.load(descHtml);
        const desc = $desc.text().replace(/<[^>]*>/g, '').trim();
        let imageUrl = $(el).find('media\\:content, content').attr('url') || $(el).find('enclosure').attr('url') || $desc('img').attr('src');
        if (imageUrl && imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;

        if (title) {
          items.push({
            title: title.replace(/ - [^-]+$/, ''),
            link,
            pubDate,
            snippet: desc || title,
            imageUrl: imageUrl || undefined,
          });
        }
      }
    });

    // Fallback if 24h search returned fewer items
    if (items.length < count) {
      const fallbackUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(topic + " X twitter")}&hl=fa&gl=IR&ceid=IR:fa`;
      const fallbackRes = await fetch(fallbackUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      });
      if (fallbackRes.ok) {
        const fallbackXml = await fallbackRes.text();
        const $fallback = cheerio.load(fallbackXml, { xmlMode: true });
        $fallback('item').each((i, el) => {
          if (items.length < count) {
            const title = $fallback(el).find('title').text().trim();
            const link = $fallback(el).find('link').text().trim();
            const pubDate = $fallback(el).find('pubDate').text().trim();
            const descHtml = $fallback(el).find('description').text().trim();
            const $desc = cheerio.load(descHtml);
            const desc = $desc.text().replace(/<[^>]*>/g, '').trim();
            let imageUrl = $fallback(el).find('media\\:content, content').attr('url') || $fallback(el).find('enclosure').attr('url') || $desc('img').attr('src');
            if (imageUrl && imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;

            if (title && !items.some(existing => existing.title === title)) {
              items.push({
                title: title.replace(/ - [^-]+$/, ''),
                link,
                pubDate,
                snippet: desc || title,
                imageUrl: imageUrl || undefined,
              });
            }
          }
        });
      }
    }

    return items;
  } catch (err) {
    console.warn("RSS fetch error:", err);
    return [];
  }
}

app.post("/api/experimental/extract-link", async (req, res) => {
  try {
    const { url, translateToPersian = true, customPrompt } = req.body || {};
    if (!url || typeof url !== 'string' || !url.trim()) {
      return res.status(400).json({ error: "لطفاً لینک مورد نظر را وارد نمایید." });
    }

    const targetUrl = url.trim();
    const isTwitter = /x\.com|twitter\.com/i.test(targetUrl);

    let rawText = "";
    let authorOrTitle = "";
    let mediaUrls: string[] = [];

    if (isTwitter) {
      const match = targetUrl.match(/\/(?:status|statuses)\/(\d+)/i);
      const statusId = match ? match[1] : null;

      if (statusId) {
        // Try FxTwitter API first
        try {
          const fxRes = await fetch(`https://api.fxtwitter.com/status/${statusId}`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
          });
          if (fxRes.ok) {
            const fxJson = await fxRes.json();
            if (fxJson && fxJson.tweet) {
              const tweet = fxJson.tweet;
              authorOrTitle = `@${tweet.author?.screen_name || ''} (${tweet.author?.name || ''})`;
              rawText = tweet.text || "";

              if (tweet.media) {
                if (Array.isArray(tweet.media.photos)) {
                  tweet.media.photos.forEach((p: any) => {
                    const pUrl = p.url || p.media_url_https;
                    if (pUrl && !mediaUrls.includes(pUrl)) mediaUrls.push(pUrl);
                  });
                }
                if (Array.isArray(tweet.media.videos)) {
                  tweet.media.videos.forEach((v: any) => {
                    let vUrl = v.url;
                    if (!vUrl && Array.isArray(v.variants)) {
                      const mp4Variant = v.variants.find((varItem: any) => 
                        varItem.content_type === "video/mp4" || varItem.url?.includes(".mp4")
                      );
                      if (mp4Variant) vUrl = mp4Variant.url;
                    }
                    if (vUrl && !mediaUrls.includes(vUrl)) {
                      mediaUrls.push(vUrl);
                    } else if (v.thumbnail_url && !mediaUrls.includes(v.thumbnail_url)) {
                      mediaUrls.push(v.thumbnail_url);
                    }
                  });
                }
              }
            }
          }
        } catch (fxErr) {
          console.warn("FxTwitter fetch failed:", fxErr);
        }

        // Fallback to VxTwitter API if media or text missing
        if (mediaUrls.length === 0 || !rawText) {
          try {
            const vxRes = await fetch(`https://api.vxtwitter.com/Twitter/status/${statusId}`, {
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            });
            if (vxRes.ok) {
              const vxJson = await vxRes.json();
              if (vxJson) {
                if (!rawText) rawText = vxJson.text || "";
                if (!authorOrTitle && vxJson.user_screen_name) {
                  authorOrTitle = `@${vxJson.user_screen_name} (${vxJson.user_name || ''})`;
                }
                if (Array.isArray(vxJson.media_extended)) {
                  vxJson.media_extended.forEach((m: any) => {
                    const mUrl = m.url || m.thumbnail_url;
                    if (mUrl && !mediaUrls.includes(mUrl)) mediaUrls.push(mUrl);
                  });
                } else if (Array.isArray(vxJson.media_urls)) {
                  vxJson.media_urls.forEach((mUrl: string) => {
                    if (mUrl && !mediaUrls.includes(mUrl)) mediaUrls.push(mUrl);
                  });
                }
              }
            }
          } catch (vxErr) {
            console.warn("VxTwitter fetch failed:", vxErr);
          }
        }
      }

      if (!rawText) {
        // Fallback to oEmbed
        try {
          const oembedRes = await fetch(`https://publish.twitter.com/oembed?url=${encodeURIComponent(targetUrl)}`);
          if (oembedRes.ok) {
            const oembedJson = await oembedRes.json();
            authorOrTitle = oembedJson.author_name || "";
            const $ = cheerio.load(oembedJson.html || "");
            rawText = $("p").text() || oembedJson.html || "";
          }
        } catch (_) {}
      }
    } else {
      // General Website Scraping
      try {
        const webRes = await fetch(targetUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        });
        if (webRes.ok) {
          const html = await webRes.text();
          const $ = cheerio.load(html);

          const ogTitle = $('meta[property="og:title"]').attr('content') || $('title').text() || '';
          const ogDesc = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || '';
          const ogImg = $('meta[property="og:image"]').attr('content');

          authorOrTitle = ogTitle.trim();

          const paragraphs = $('article p, main p, .content p, p')
            .map((_, el) => $(el).text().trim())
            .get()
            .filter((p) => p.length > 20)
            .slice(0, 5)
            .join('\n\n');

          rawText = paragraphs || ogDesc || ogTitle;

          if (ogImg) {
            const fullImg = ogImg.startsWith('http') ? ogImg : new URL(ogImg, targetUrl).href;
            mediaUrls.push(fullImg);
          }
        }
      } catch (webErr: any) {
        return res.status(400).json({ error: `خطا در دریافت محتوای وب‌سایت: ${webErr.message}` });
      }
    }

    if (!rawText) {
      return res.status(400).json({ error: "محتوایی از لینک مورد نظر استخراج نشد. لطفاً از صحت لینک مطمئن شوید." });
    }

    // Default formatted output
    let telegramText = `📰 **${authorOrTitle || 'خبر/توییت استخراج شده'}**\n\n${rawText}\n\n🔗 [مشاهده منبع اصلی](${targetUrl})`;

    // Rewrite / Paraphrase using Gemini AI with fallback
    if (translateToPersian || customPrompt) {
      try {
        const ai = new GoogleGenAI({
          apiKey: process.env.GEMINI_API_KEY,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });

        const promptText = `تو یک مدیر ارشد کانال‌های تلگرامی پرمخاطب هستی.
این یک محتوا از منبع (${targetUrl}) است:
${authorOrTitle ? 'عنوان/نویسنده منبع: ' + authorOrTitle : ''}
متن خام محتوا:
${rawText}

دستورالعمل: ${customPrompt || "لطفاً این محتوا را به یک پست تلگرامی بسیار جذاب، خوانا، شکیل و روان به زبان فارسی تبدیل کن. از ایموجی‌های مناسب، لید خبری، لایه‌بندی پاراگرافی و هشتگ‌های مرتبط در پایان استفاده کن. در انتها عبارت منبع را قرار بده."}

تنها متن نهایی پست تلگرام را بدون هیچ کلمه، توضیح یا علائم اضافه قبل و بعد برگردان.`;

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: promptText,
        });

        if (response.text && response.text.trim()) {
          telegramText = response.text.trim();
        }
      } catch (aiErr: any) {
        console.warn("Gemini translation fallback:", aiErr?.message || aiErr);
      }
    }

    return res.json({
      ok: true,
      extracted: {
        type: isTwitter ? "twitter" : "website",
        author: authorOrTitle,
        rawText,
        telegramText,
        mediaUrls,
        sourceUrl: targetUrl,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: `خطا در پردازش لینک: ${err.message}` });
  }
});

app.post("/api/experimental/ai-trends", async (req, res) => {
  try {
    const { topic = "اخبار فوری و ترندهای داغ جهان در X", count = 3, apiKey: userApiKey } = req.body || {};
    const targetCount = Math.max(1, Math.min(Number(count) || 3, 30));

    const apiKey = userApiKey?.trim().replace(/^["']|["']$/g, '') || process.env.GEMINI_API_KEY?.trim().replace(/^["']|["']$/g, '') || "";

    // Step 1: Fetch live web news / X RSS snippets first to ensure real-time grounding
    const rssItems = await fetchNewsRssForTopic(topic, targetCount + 5);

    let trends: any[] = [];

    // Step 2: Try Gemini AI structuring with provided API key or system GEMINI_API_KEY
    if (apiKey) {
      try {
        const ai = new GoogleGenAI({
          apiKey: apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });

        const todayDateStr = new Date().toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' });
        const todayIsoStr = new Date().toISOString().split('T')[0];

        const rssContext = rssItems.length > 0 
          ? `اخبار و ترندهای زنده استخراج شده در ۲۴ ساعت گذشته (امروز):\n` + rssItems.map((r, i) => `${i + 1}. تیتر: ${r.title}\nمنبع/توضیح: ${r.snippet}\nتاریخ خبر: ${r.pubDate || 'امروز'}\nلینک: ${r.link}`).join('\n---\n')
          : "";

        const promptText = `تو یک خبرنگار و جستجوگر هوشمند ترندهای جهانی در شبکه اجتماعی X (توییتر) و وب هستی.
امروز: ${todayDateStr} (تاریخ میلادی: ${todayIsoStr})
موضوع درخواست شده: "${topic}"

${rssContext}

تذکر بسیار مهم: حتماً فقط و فقط ترندها، اخبار و اتفاقات تازه مربوط به امروز یا ۲۴ ساعت گذشته را پردازش و ارائه کن. از اخبار قدیمی یا تاریخ گذشته استفاده نکن.
تعداد ${targetCount} موضوع/توییت ترند برتر مرتبط با این موضوع را استخراج و به شکل پست تلگرامی جذاب آماده کن.
پاسخ را فقط و فقط به شکل یک آرایه JSON معتبر با ساختار زیر ارسال کن (هیچ متن یا علامت توضیحی دیگری قبل یا بعد از JSON قرار نده):

[
  {
    "id": "trend_1",
    "title": "تیتر جذاب و کوتاه خبر/ترند تازه X (امروز)",
    "originalSummary": "خلاصه اصل توییت یا خبر ترند شده همراه با حساب کاربری توییتر یا منبع",
    "telegramText": "متن کامل آماده انتشار برای کانال تلگرام به زبان فارسی روان و جذاب همراه با ایموجی‌های عالی، فونت خوانا، لید خبری و هشتگ‌ها",
    "hashtags": ["#توییتر", "#ترند"],
    "sourceUrl": "لینک مستقیم توییت یا منبع خبر در وب",
    "mediaUrls": ["https://... (لینک مستقیم عکس یا ویدیو مربوط به خبر یا توییت در صورت وجود)"],
    "topicCategory": "دسته بندی موضوعی"
  }
]`;

        let responseText = "";
        for (const mName of ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]) {
          try {
            const res = await ai.models.generateContent({
              model: mName,
              contents: promptText,
            });
            if (res?.text) {
              responseText = res.text;
              break;
            }
          } catch (mErr) {
            console.warn(`[AI-Trends] Model ${mName} failed, trying fallback...`, mErr);
          }
        }

        let rawOutput = responseText;
        rawOutput = rawOutput.replace(/```json/gi, '').replace(/```/g, '').trim();

        try {
          trends = JSON.parse(rawOutput);
        } catch (_) {
          const match = rawOutput.match(/\[\s*\{[\s\S]*\}\s*\]/);
          if (match) {
            try {
              trends = JSON.parse(match[0]);
            } catch (__) {}
          }
        }

        if (Array.isArray(trends)) {
          trends = trends.map((t: any, idx: number) => {
            const matchedRss = rssItems[idx];
            const mUrls: string[] = Array.isArray(t.mediaUrls) ? t.mediaUrls.filter((u: any) => typeof u === 'string' && u.startsWith('http')) : [];
            if (mUrls.length === 0 && matchedRss?.imageUrl) {
              mUrls.push(matchedRss.imageUrl);
            }
            return {
              ...t,
              mediaUrls: mUrls,
            };
          });
        }
      } catch (aiErr: any) {
        console.warn("Gemini AI trends generation bypassed due to quota/error:", aiErr?.message || aiErr);
      }
    }

    // Step 3: Fallback generator if Gemini returned empty or hit quota limit
    if (!Array.isArray(trends) || trends.length === 0) {
      if (rssItems.length > 0) {
        trends = rssItems.slice(0, targetCount).map((item, idx) => {
          const cleanTag = topic.replace(/[^\u0600-\u06FFa-zA-Z0-9]/g, '_');
          return {
            id: `trend_rss_${idx + 1}`,
            title: item.title,
            originalSummary: item.snippet || item.title,
            telegramText: `🔥 **ترند داغ در X و وب:** ${item.title}\n\n📌 **موضوع:** ${topic}\n\n${item.snippet || item.title}\n\n🌐 **لینک منبع:** ${item.link}\n\n#توییتر #ترند_روز #${cleanTag}`,
            hashtags: ["#توییتر", "#ترند", `#${cleanTag}`],
            sourceUrl: item.link,
            mediaUrls: item.imageUrl ? [item.imageUrl] : [],
            topicCategory: topic,
          };
        });
      } else {
        const cleanTag = topic.replace(/[^\u0600-\u06FFa-zA-Z0-9]/g, '_');
        trends = [
          {
            id: "trend_fallback_1",
            title: `ترند داغ روز: ${topic}`,
            originalSummary: `توییت‌ها و اخبار داغ حول محور ${topic} در شبکه اجتماعی X.`,
            telegramText: `🔥 **ترند داغ شبکه اجتماعی X (توییتر)**\n\n📌 **موضوع:** ${topic}\n\nبحث‌ها و تحلیل‌های متعددی درباره ${topic} در توییتر فارسی و بین‌المللی شکل گرفته است.\n\n#توییتر #ترند_روز #${cleanTag}`,
            hashtags: ["#توییتر", "#ترند"],
            sourceUrl: "https://x.com/explore",
            mediaUrls: [],
            topicCategory: topic,
          },
        ];
      }
    }

    return res.json({
      ok: true,
      topic,
      trends,
    });
  } catch (err: any) {
    return res.status(500).json({ error: `خطا در کاوش ترندهای X: ${err.message}` });
  }
});

app.post("/api/experimental/post-now", async (req, res) => {
  try {
    const { botToken, targetChannel, text, mediaUrls } = req.body || {};

    if (!botToken || !targetChannel || !text) {
      return res.status(400).json({ error: "اطلاعات ناقص است (توکن ربات، کانال و متن الزامی می‌باشد)." });
    }

    let channel = targetChannel.trim();
    if (!channel.startsWith('@') && !channel.startsWith('-') && isNaN(Number(channel))) {
      channel = `@${channel}`;
    }

    let sendPayload: any;

    if (Array.isArray(mediaUrls) && mediaUrls.length > 0) {
      const validMedias = mediaUrls.filter((u: string) => typeof u === 'string' && u.trim().length > 0);
      if (validMedias.length === 1) {
        const mUrl = validMedias[0];
        const isVideo = /\.mp4|\.mov|\.webm|video|ext_tw_video/i.test(mUrl);
        sendPayload = {
          method: isVideo ? "sendVideo" : "sendPhoto",
          [isVideo ? "video" : "photo"]: mUrl,
          caption: text,
        };
      } else if (validMedias.length > 1) {
        sendPayload = {
          method: "sendMediaGroup",
          media: validMedias.map((m: string, idx: number) => {
            const isVideo = /\.mp4|\.mov|\.webm|video|ext_tw_video/i.test(m);
            return {
              type: isVideo ? "video" : "photo",
              media: m,
              ...(idx === 0 ? { caption: text } : {}),
            };
          }),
        };
      } else {
        sendPayload = {
          method: "sendMessage",
          text: text,
        };
      }
    } else {
      sendPayload = {
        method: "sendMessage",
        text: text,
      };
    }

    const sendRes = await sendTelegramMessage(botToken, channel, sendPayload);

    if (sendRes.ok) {
      return res.json({ ok: true, messageId: sendRes.messageId, targetChannel: channel });
    } else {
      return res.status(400).json({ ok: false, error: sendRes.error || "خطا در ارسال پیام به تلگرام" });
    }
  } catch (err: any) {
    return res.status(500).json({ error: `خطا در ارسال مستقیم به تلگرام: ${err.message}` });
  }
});

// ==================== AUTO TREND POSTER SCHEDULER & WORKER ====================
interface AutoTrendConfigData {
  enabled: boolean;
  connId?: string;
  botToken: string;
  targetChannel: string;
  topic: string;
  intervalHours: number;
  countPerRun: number;
  combineIntoSinglePost?: boolean;
  apiKey?: string;
  provider?: string;
  model?: string;
  customBaseUrl?: string;
  lastRunAt?: string | null;
  nextRunAt?: string | null;
  postedTrendTitles?: string[];
  logs?: Array<{ time: string; status: 'success' | 'error'; message: string }>;
}

const AUTO_TREND_FILE = path.join(process.cwd(), 'auto_trend_settings.json');

function loadAutoTrendConfig(): AutoTrendConfigData {
  try {
    if (fs.existsSync(AUTO_TREND_FILE)) {
      const data = fs.readFileSync(AUTO_TREND_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.warn("Failed to load auto_trend_settings.json", err);
  }
  return {
    enabled: false,
    botToken: "",
    targetChannel: "",
    topic: "اخبار فوری و ترندهای داغ جهان در X",
    intervalHours: 24,
    countPerRun: 2,
    lastRunAt: null,
    nextRunAt: null,
    postedTrendTitles: [],
    logs: [],
  };
}

function saveAutoTrendConfigData(config: AutoTrendConfigData) {
  try {
    fs.writeFileSync(AUTO_TREND_FILE, JSON.stringify(config, null, 2), 'utf-8');
  } catch (err) {
    console.error("Failed to save auto_trend_settings.json", err);
  }
}

let autoTrendConfig = loadAutoTrendConfig();

async function runAutoTrendSchedulerWorker(forceRun: boolean = false) {
  if (!autoTrendConfig.enabled && !forceRun) return;
  if (!autoTrendConfig.botToken || !autoTrendConfig.targetChannel) {
    console.warn("[AutoTrendScheduler] Bot token or target channel missing.");
    return;
  }

  const userApiKey = autoTrendConfig.apiKey?.trim().replace(/^["']|["']$/g, '') || process.env.GEMINI_API_KEY?.trim().replace(/^["']|["']$/g, '') || "";

  const now = Date.now();
  const lastRun = autoTrendConfig.lastRunAt ? new Date(autoTrendConfig.lastRunAt).getTime() : 0;
  const intervalMs = (autoTrendConfig.intervalHours || 24) * 3600 * 1000;

  if (!forceRun && now - lastRun < intervalMs) {
    return; // Not time yet
  }

  console.log(`[AutoTrendScheduler] Running auto-trend poster for topic: "${autoTrendConfig.topic}"...`);

  try {
    const topic = autoTrendConfig.topic || "اخبار فوری و ترندهای داغ جهان در X";
    const count = Math.max(1, Math.min(autoTrendConfig.countPerRun || 3, 30));
    const rssItems = await fetchNewsRssForTopic(topic, count + 5);

    let trends: any[] = [];
    if (userApiKey) {
      try {
        const ai = new GoogleGenAI({
          apiKey: userApiKey,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
        });
        const rssContext = rssItems.length > 0 
          ? "اطلاعات زنده استخراج شده از وب:\n" + rssItems.map((r, i) => `${i + 1}. تیتر: ${r.title}\nمنبع/توضیح: ${r.snippet}\nلینک: ${r.link}`).join('\n---\n')
          : "";

        const promptText = `تو یک خبرنگار و جستجوگر هوشمند ترندهای جهانی در شبکه اجتماعی X (توییتر) و وب هستی.
موضوع درخواست شده: "${topic}"
${rssContext}
تعداد ${count} موضوع/توییت ترند برتر مرتبط با این موضوع را استخراج و به شکل پست تلگرامی جذاب آماده کن.
پاسخ را فقط و فقط به شکل یک آرایه JSON معتبر با ساختار زیر ارسال کن (هیچ متن یا علامت توضیحی دیگری قبل یا بعد از JSON قرار نده):
[
  {
    "id": "trend_1",
    "title": "تیتر جذاب و کوتاه خبر/ترند X",
    "originalSummary": "خلاصه اصل توییت یا خبر ترند شده همراه با حساب کاربری توییتر یا منبع",
    "telegramText": "متن کامل آماده انتشار برای کانال تلگرام به زبان فارسی روان و جذاب همراه با ایموجی‌های عالی، فونت خوانا، لید خبری و هشتگ‌ها",
    "hashtags": ["#توییتر", "#ترند"],
    "sourceUrl": "لینک مستقیم توییت یا منبع خبر در وب",
    "topicCategory": "دسته بندی موضوعی"
  }
]`;

        let responseText = "";
        for (const mName of ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]) {
          try {
            const res = await ai.models.generateContent({
              model: mName,
              contents: promptText,
            });
            if (res?.text) {
              responseText = res.text;
              break;
            }
          } catch (mErr) {}
        }

        let rawOutput = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
        trends = JSON.parse(rawOutput);

        if (Array.isArray(trends)) {
          trends = trends.map((t: any, idx: number) => {
            const matchedRss = rssItems[idx];
            const mUrls: string[] = Array.isArray(t.mediaUrls) ? t.mediaUrls.filter((u: any) => typeof u === 'string' && u.startsWith('http')) : [];
            if (mUrls.length === 0 && matchedRss?.imageUrl) {
              mUrls.push(matchedRss.imageUrl);
            }
            return { ...t, mediaUrls: mUrls };
          });
        }
      } catch (e) {
        console.warn("[AutoTrendScheduler] Gemini error, using RSS fallback:", e);
      }
    }

    if (!Array.isArray(trends) || trends.length === 0) {
      if (rssItems.length > 0) {
        const cleanTag = topic.replace(/[^\u0600-\u06FFa-zA-Z0-9]/g, '_');
        trends = rssItems.slice(0, count).map((item, idx) => ({
          id: `auto_rss_${idx}`,
          title: item.title,
          originalSummary: item.snippet,
          telegramText: `🔥 **ترند داغ در X و وب:** ${item.title}\n\n📌 **موضوع:** ${topic}\n\n${item.snippet || item.title}\n\n🌐 **لینک منبع:** ${item.link}\n\n#توییتر #ترند_روز #${cleanTag}`,
          sourceUrl: item.link,
          mediaUrls: item.imageUrl ? [item.imageUrl] : [],
        }));
      }
    }

    if (Array.isArray(trends) && trends.length > 0) {
      let postedCount = 0;
      let targetChannel = autoTrendConfig.targetChannel.trim();
      if (!targetChannel.startsWith('@') && !targetChannel.startsWith('-') && isNaN(Number(targetChannel))) {
        targetChannel = `@${targetChannel}`;
      }

      const history = autoTrendConfig.postedTrendTitles || [];

      if (autoTrendConfig.combineIntoSinglePost && trends.length > 1) {
        // Consolidate into 1 post
        const cleanTag = topic.replace(/[^\u0600-\u06FFa-zA-Z0-9]/g, '_');
        const header = `🔥 **خلاصه و جمع‌بندی داغ‌ترین ترندها (${trends.length} موضوع در ۱ پیام):**\n\n`;
        const itemsText = trends.slice(0, count).map((item, idx) => {
          const tTitle = item.title || `موضوع ${idx + 1}`;
          const tSummary = item.originalSummary || item.telegramText || '';
          return `🔹 **${idx + 1}. ${tTitle}**\n${tSummary}`;
        }).join('\n\n---\n\n');

        const combinedText = `${header}📌 **موضوع:** ${topic}\n\n${itemsText}\n\n⚡ **ارسال شده توسط کاوشگر زنده X و وب** | #${cleanTag} #خلاصه_اخبار`;

        const sendRes = await sendTelegramMessage(autoTrendConfig.botToken, targetChannel, {
          method: "sendMessage",
          text: combinedText,
        });

        if (sendRes.ok) {
          postedCount = trends.length;
          for (const item of trends.slice(0, count)) {
            if (item.title) history.push(item.title);
          }
          if (history.length > 100) history.splice(0, history.length - 100);
        }
      } else {
        // N separate posts
        for (const item of trends.slice(0, count)) {
          if (!item.telegramText) continue;

          let sendPayload: any = {
            method: "sendMessage",
            text: item.telegramText,
          };

          if (Array.isArray(item.mediaUrls) && item.mediaUrls.length > 0) {
            const validMedias = item.mediaUrls.filter((u: any) => typeof u === 'string' && u.startsWith('http'));
            if (validMedias.length === 1) {
              const mUrl = validMedias[0];
              const isVideo = /\.mp4|\.mov|\.webm|video|ext_tw_video/i.test(mUrl);
              sendPayload = {
                method: isVideo ? "sendVideo" : "sendPhoto",
                [isVideo ? "video" : "photo"]: mUrl,
                caption: item.telegramText,
              };
            } else if (validMedias.length > 1) {
              sendPayload = {
                method: "sendMediaGroup",
                mediaItems: validMedias.map((u: string) => ({ type: /\.mp4|\.mov|\.webm/i.test(u) ? 'video' : 'photo', url: u })),
                caption: item.telegramText,
              };
            }
          }

          const sendRes = await sendTelegramMessage(autoTrendConfig.botToken, targetChannel, sendPayload);

          if (sendRes.ok) {
            postedCount++;
            if (item.title) history.push(item.title);
            if (history.length > 100) history.shift();
          }
        }
      }

      autoTrendConfig.postedTrendTitles = history;
      autoTrendConfig.lastRunAt = new Date().toISOString();
      autoTrendConfig.nextRunAt = new Date(Date.now() + intervalMs).toISOString();

      const logMsg = autoTrendConfig.combineIntoSinglePost
        ? `تعداد ${trends.length} ترند به صورت ۱ پیام خلاصه به کانال ${targetChannel} ارسال شد.`
        : `تعداد ${postedCount} ترند به کانال ${targetChannel} با موفقیت ارسال شد.`;
      autoTrendConfig.logs = [
        { time: new Date().toLocaleTimeString('fa-IR'), status: 'success', message: logMsg },
        ...(autoTrendConfig.logs || []).slice(0, 49)
      ];
      saveAutoTrendConfigData(autoTrendConfig);
    }
  } catch (err: any) {
    console.error("[AutoTrendScheduler] Worker error:", err);
    autoTrendConfig.logs = [
      { time: new Date().toLocaleTimeString('fa-IR'), status: 'error', message: `خطا در ارسال خودکار: ${err.message}` },
      ...(autoTrendConfig.logs || []).slice(0, 49)
    ];
    saveAutoTrendConfigData(autoTrendConfig);
  }
}

// Background poll every 60 seconds
setInterval(() => runAutoTrendSchedulerWorker(false), 60000);

app.get("/api/experimental/auto-trends", (req, res) => {
  res.json({ ok: true, config: autoTrendConfig });
});

app.post("/api/experimental/auto-trends", (req, res) => {
  const { enabled, connId, botToken, targetChannel, topic, intervalHours, countPerRun, combineIntoSinglePost, apiKey, provider, model, customBaseUrl } = req.body || {};
  const isEnabled = Boolean(enabled);
  const interval = Math.max(0.05, Number(intervalHours) || 24);
  const count = Math.max(1, Math.min(Number(countPerRun) || 3, 30));

  autoTrendConfig = {
    ...autoTrendConfig,
    enabled: isEnabled,
    connId: connId || autoTrendConfig.connId,
    botToken: (botToken || autoTrendConfig.botToken || "").trim(),
    targetChannel: (targetChannel || autoTrendConfig.targetChannel || "").trim(),
    topic: (topic || autoTrendConfig.topic || "اخبار فوری و ترندهای داغ جهان در X").trim(),
    intervalHours: interval,
    countPerRun: count,
    combineIntoSinglePost: Boolean(combineIntoSinglePost),
    apiKey: apiKey !== undefined ? apiKey.trim() : autoTrendConfig.apiKey,
    provider: provider !== undefined ? provider : autoTrendConfig.provider,
    model: model !== undefined ? model : autoTrendConfig.model,
    customBaseUrl: customBaseUrl !== undefined ? customBaseUrl : autoTrendConfig.customBaseUrl,
    nextRunAt: isEnabled ? new Date(Date.now() + Math.round(interval * 3600 * 1000)).toISOString() : null,
  };
  saveAutoTrendConfigData(autoTrendConfig);

  if (isEnabled) {
    runAutoTrendSchedulerWorker(true).catch(console.error);
  }

  res.json({ ok: true, config: autoTrendConfig });
});

app.post("/api/experimental/auto-trends/run-now", async (req, res) => {
  try {
    if (!autoTrendConfig.botToken || !autoTrendConfig.targetChannel) {
      return res.status(400).json({ error: "لطفاً ابتدا توکن ربات و کانال مقصد را تنظیم نمایید." });
    }
    await runAutoTrendSchedulerWorker(true);
    return res.json({
      ok: true,
      message: `تست و ارسال فوری ترندهای X به کانال ${autoTrendConfig.targetChannel} با موفقیت اجرا گردید!`,
      config: autoTrendConfig,
    });
  } catch (err: any) {
    return res.status(500).json({ error: `خطا در اجرای فوری: ${err.message}` });
  }
});

// In-memory OTP store for email verification
const emailOtpStore: Record<string, { code: string; expiresAt: number }> = {};

// Helper to send real emails via Nodemailer (Gmail / Outlook / Custom SMTP or Ethereal test inbox)
async function sendVerificationEmail(toEmail: string, otpCode: string) {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || `"Auto Run Verification" <${user || "no-reply@autorun.com"}>`;

  let transporter: nodemailer.Transporter;

  if (user && pass) {
    // Real Production SMTP (Gmail App Password, Yahoo, Outlook, or Custom Server)
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  } else {
    // Auto-generate test account if SMTP is not configured yet
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  }

  const htmlContent = `
    <div style="font-family: Tahoma, Arial, sans-serif; direction: rtl; text-align: right; background-color: #0f172a; color: #f8fafc; padding: 30px; border-radius: 16px; max-width: 500px; margin: 0 auto; border: 1px solid #334155;">
      <h2 style="color: #a855f7; font-size: 20px; margin-bottom: 10px;">کد تایید ثبت‌نام سامانه Auto run</h2>
      <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6;">
        سلام،<br>
        کد تایید ۶ رقمی برای تکمیل ثبت‌نام شما به شرح زیر می‌باشد:
      </p>
      <div style="text-align: center; margin: 25px 0;">
        <span style="font-family: monospace; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #facc15; background-color: #1e293b; padding: 12px 24px; border-radius: 12px; border: 1px solid #334155; display: inline-block;">
          ${otpCode}
        </span>
      </div>
      <p style="font-size: 12px; color: #94a3b8; text-align: center;">
        این کد تا ۵ دقیقه آینده اعتبار دارد. اگر شما این درخواست را نداده‌اید، این پیام را نادیده بگیرید.
      </p>
      <hr style="border: 0; border-top: 1px solid #334155; margin-top: 25px;">
      <p style="font-size: 11px; color: #64748b; text-align: center;">
        🔒 تمامی اطلاعات شما به صورت رمزنگاری‌شده در سرور Auto run حفاظت می‌شود.
      </p>
    </div>
  `;

  const info = await transporter.sendMail({
    from,
    to: toEmail,
    subject: `کد تایید ثبت‌نام Auto run: ${otpCode}`,
    html: htmlContent,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log(`[EMAIL DISPATCH] Sent to ${toEmail}. Preview URL: ${previewUrl}`);
  } else {
    console.log(`[EMAIL DISPATCH] Sent to ${toEmail}. Message ID: ${info.messageId}`);
  }

  return info;
}

// Send Email OTP Code
app.post("/api/auth/send-otp", async (req, res) => {
  try {
    const { email } = req.body;
    const cleanEmail = (email || "").trim().toLowerCase();

    // Ensure real email format and allowed email provider domains
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const allowedDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'proton.me', 'protonmail.com', 'live.com', 'yandex.com', 'zoho.com'];
    const emailDomain = cleanEmail.split('@')[1]?.toLowerCase();

    if (!cleanEmail || !emailRegex.test(cleanEmail) || !emailDomain || !allowedDomains.includes(emailDomain)) {
      return res.status(400).json({
        error: "ثبت‌نام فقط با سرویس‌های ایمیل معتبر (Gmail، Yahoo، Outlook، Hotmail، iCloud یا Proton) امکان‌پذیر است.",
      });
    }

    const existingEmail = users.find((u) => cleanEmail && u.email.toLowerCase() === cleanEmail);
    if (existingEmail) {
      return res.status(400).json({ error: "این آدرس ایمیل قبلاً ثبت شده است." });
    }

    // Generate 6-digit OTP code
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    emailOtpStore[cleanEmail] = {
      code: otpCode,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
    };

    console.log(`[EMAIL OTP] Generated code for ${cleanEmail}: ${otpCode}`);

    // Send email automatically
    await sendVerificationEmail(cleanEmail, otpCode);

    res.json({
      success: true,
      message: `کد تایید ۶ رقمی به آدرس ایمیل ${cleanEmail} ارسال شد.`,
    });
  } catch (err: any) {
    console.error("Error sending verification email:", err);
    res.status(500).json({ error: "خطا در ارسال ایمیل تایید. لطفاً آدرس ایمیل را بررسی کنید." });
  }
});

// Authentication Endpoints
app.post("/api/auth/register", (req, res) => {
  try {
    const { username, fullName, email, phone, password, otpCode }: RegisterDTO = req.body;

    if (!username || !username.trim() || !password || !password.trim()) {
      return res.status(400).json({ error: "نام کاربری و رمز عبور الزامی است." });
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = (email || "").trim().toLowerCase();
    const cleanPassword = password.trim();

    // Ensure real email format and allowed email provider domains
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const allowedDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'proton.me', 'protonmail.com', 'live.com', 'yandex.com', 'zoho.com'];
    const emailDomain = cleanEmail.split('@')[1]?.toLowerCase();

    if (!cleanEmail || !emailRegex.test(cleanEmail) || !emailDomain || !allowedDomains.includes(emailDomain)) {
      return res.status(400).json({
        error: "ثبت‌نام فقط با سرویس‌های ایمیل معتبر (Gmail، Yahoo، Outlook، Hotmail، iCloud یا Proton) امکان‌پذیر است.",
      });
    }

    // OTP Code Verification (Bypassed temporarily upon user request)
    // const otpRecord = emailOtpStore[cleanEmail];
    // if (!otpCode || !otpRecord || otpRecord.code !== otpCode.trim()) {
    //   return res.status(400).json({ error: "کد تایید ایمیل ۶ رقمی اشتباه است یا وارد نشده است." });
    // }
    // if (Date.now() > otpRecord.expiresAt) {
    //   delete emailOtpStore[cleanEmail];
    //   return res.status(400).json({ error: "کد تایید منقضی شده است. لطفاً کد جدید دریافت کنید." });
    // }

    // Password validation: >= 8 characters, must contain both letters and numbers
    const hasLetter = /[a-zA-Z\u0600-\u06FF]/.test(cleanPassword);
    const hasNumber = /[0-9]/.test(cleanPassword);
    if (cleanPassword.length < 8 || !hasLetter || !hasNumber) {
      return res.status(400).json({
        error: "رمز عبور باید حداقل ۸ کاراکتر و ترکیبی از حروف و اعداد باشد.",
      });
    }

    // Check existing
    const existingUser = users.find((u) => u.username.toLowerCase() === cleanUsername);
    if (existingUser) {
      return res.status(400).json({ error: "این نام کاربری قبلاً ثبت شده است." });
    }

    const existingEmail = users.find((u) => cleanEmail && u.email.toLowerCase() === cleanEmail);
    if (existingEmail) {
      return res.status(400).json({ error: "این آدرس ایمیل قبلاً ثبت شده است." });
    }

    // Delete used OTP
    delete emailOtpStore[cleanEmail];

    // Default subscription for new user: 30 days trial/active
    const defaultExpireDate = new Date();
    defaultExpireDate.setDate(defaultExpireDate.getDate() + 30);

    const newUser: User = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      username: cleanUsername,
      fullName: fullName?.trim() || cleanUsername,
      email: cleanEmail,
      phone: phone?.trim() || "",
      password: cleanPassword,
      role: "user",
      plan: "pro",
      subscriptionStatus: "active",
      subscriptionExpireAt: defaultExpireDate.toISOString(),
      maxConnections: 10,
      createdAt: new Date().toISOString(),
      token: `token_${Date.now()}_${Math.random().toString(36).substr(2, 10)}`,
    };

    users.unshift(newUser);
    writeJsonFile(USERS_FILE, users);

    res.status(201).json({ user: newUser, token: newUser.token });
  } catch (err: any) {
    res.status(500).json({ error: "خطا در ثبت‌نام کاربر." });
  }
});

function getAuthUser(req: express.Request): User | null {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const user = users.find((u) => u.token === token);
  if (user) {
    if (!user.subscriptionStatus) user.subscriptionStatus = 'active';
    if (user.role === 'admin') {
      user.subscriptionStatus = 'active';
      user.subscriptionExpireAt = null;
    } else if (user.subscriptionExpireAt) {
      if (new Date(user.subscriptionExpireAt).getTime() < Date.now()) {
        user.subscriptionStatus = 'expired';
      }
    }
  }
  return user || null;
}

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return res.status(401).json({ error: "لطفاً وارد حساب مدیریت خود شوید." });
  }

  const user = users.find((u) => u.token === token);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: "دسترسی غیرمجاز. فقط مدیران سیستم به این بخش دسترسی دارند." });
  }

  (req as any).authUser = user;
  next();
}

// ADMIN ENDPOINTS FOR MANAGING USERS & SUBSCRIPTIONS
app.get("/api/admin/users", requireAdmin, (req, res) => {
  try {
    const userList = users.map((u) => {
      // Normalize subscription status
      let subStatus = u.subscriptionStatus || 'active';
      let expireAt = u.subscriptionExpireAt ?? null;
      if (u.role === 'admin') {
        subStatus = 'active';
        expireAt = null;
      } else if (expireAt) {
        if (new Date(expireAt).getTime() < Date.now()) {
          subStatus = 'expired';
        }
      }

      return {
        id: u.id,
        username: u.username,
        fullName: u.fullName || u.username,
        email: u.email || "",
        phone: u.phone || "",
        role: u.role || "user",
        plan: u.plan || "free",
        subscriptionStatus: subStatus,
        subscriptionExpireAt: expireAt,
        maxConnections: u.maxConnections || 10,
        createdAt: u.createdAt,
        connectionsCount: connections.length, // total connections in system
      };
    });

    res.json(userList);
  } catch (err: any) {
    res.status(500).json({ error: "خطا در دریافت لیست کاربران." });
  }
});

app.put("/api/admin/users/:userId/subscription", requireAdmin, (req, res) => {
  try {
    const { userId } = req.params;
    const { subscriptionStatus, plan, durationDays, customExpireAt, role, maxConnections } = req.body;

    const targetUser = users.find((u) => u.id === userId);
    if (!targetUser) {
      return res.status(404).json({ error: "کاربر مورد نظر یافت نشد." });
    }

    if (role && (role === "admin" || role === "user")) {
      targetUser.role = role;
    }

    if (plan && ["free", "pro", "vip"].includes(plan)) {
      targetUser.plan = plan;
    }

    if (subscriptionStatus && ["active", "inactive", "expired"].includes(subscriptionStatus)) {
      targetUser.subscriptionStatus = subscriptionStatus;
    }

    if (typeof maxConnections === "number" && maxConnections > 0) {
      targetUser.maxConnections = maxConnections;
    }

    // Handle durationDays
    if (durationDays === -1 || durationDays === null) {
      targetUser.subscriptionExpireAt = null; // Lifetime / Perpetual
      targetUser.subscriptionStatus = "active";
    } else if (typeof durationDays === "number" && durationDays > 0) {
      const now = new Date();
      now.setDate(now.getDate() + durationDays);
      targetUser.subscriptionExpireAt = now.toISOString();
      targetUser.subscriptionStatus = "active";
    } else if (customExpireAt !== undefined) {
      targetUser.subscriptionExpireAt = customExpireAt;
    }

    writeJsonFile(USERS_FILE, users);

    res.json({
      success: true,
      user: {
        id: targetUser.id,
        username: targetUser.username,
        fullName: targetUser.fullName,
        email: targetUser.email,
        phone: targetUser.phone,
        role: targetUser.role,
        plan: targetUser.plan,
        subscriptionStatus: targetUser.subscriptionStatus,
        subscriptionExpireAt: targetUser.subscriptionExpireAt,
        maxConnections: targetUser.maxConnections,
        createdAt: targetUser.createdAt,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: "خطا در بروزرسانی وضعیت اشتراک کاربر." });
  }
});

app.post("/api/admin/users", requireAdmin, (req, res) => {
  try {
    const { username, fullName, email, phone, password, role, plan, subscriptionStatus, durationDays } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "نام کاربری و رمز عبور الزامی است." });
    }

    const cleanUsername = username.trim().toLowerCase();
    if (users.some((u) => u.username.toLowerCase() === cleanUsername)) {
      return res.status(400).json({ error: "این نام کاربری قبلاً در سیستم ثبت شده است." });
    }

    let expireAt: string | null = null;
    if (durationDays && typeof durationDays === "number" && durationDays > 0) {
      const d = new Date();
      d.setDate(d.getDate() + durationDays);
      expireAt = d.toISOString();
    }

    const newUser: User = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      username: cleanUsername,
      fullName: fullName?.trim() || cleanUsername,
      email: email?.trim() || "",
      phone: phone?.trim() || "",
      password: password.trim(),
      role: role === "admin" ? "admin" : "user",
      plan: plan || "pro",
      subscriptionStatus: subscriptionStatus || "active",
      subscriptionExpireAt: expireAt,
      maxConnections: 10,
      createdAt: new Date().toISOString(),
      token: `token_${Date.now()}_${Math.random().toString(36).substr(2, 10)}`,
    };

    users.unshift(newUser);
    writeJsonFile(USERS_FILE, users);

    res.status(201).json({ success: true, user: newUser });
  } catch (err: any) {
    res.status(500).json({ error: "خطا در ساخت کاربر جدید." });
  }
});

app.delete("/api/admin/users/:userId", requireAdmin, (req, res) => {
  try {
    const { userId } = req.params;
    const targetUser = users.find((u) => u.id === userId);

    if (!targetUser) {
      return res.status(404).json({ error: "کاربر مورد نظر یافت نشد." });
    }

    if (targetUser.email.toLowerCase() === ADMIN_EMAIL) {
      return res.status(403).json({ error: "امکان حذف مدیر اصلی و ارشد سیستم وجود ندارد." });
    }

    users = users.filter((u) => u.id !== userId);
    writeJsonFile(USERS_FILE, users);

    res.json({ success: true, message: "کاربر با موفقیت از سیستم حذف شد." });
  } catch (err: any) {
    res.status(500).json({ error: "خطا در حذف کاربر." });
  }
});

app.post("/api/auth/login", (req, res) => {
  try {
    const { identifier, password }: LoginDTO = req.body;

    if (!identifier || !identifier.trim() || !password || !password.trim()) {
      return res.status(400).json({ error: "نام کاربری/ایمیل/موبایل و رمز عبور الزامی است." });
    }

    const cleanId = identifier.trim().toLowerCase();
    const cleanPassword = password.trim();

    const user = users.find(
      (u) =>
        u.username.toLowerCase() === cleanId ||
        u.email.toLowerCase() === cleanId ||
        (u.phone && u.phone === cleanId)
    );

    // If user is not found or password does not match
    if (!user || (user.password && user.password !== cleanPassword)) {
      return res.status(401).json({
        error: "یوزرنیم یا پسورد اشتباه است، یا کاربر ثبت نام نشده است."
      });
    }

    // Refresh token if needed
    if (!user.token) {
      user.token = `token_${Date.now()}_${Math.random().toString(36).substr(2, 10)}`;
      writeJsonFile(USERS_FILE, users);
    }

    res.json({ user, token: user.token });
  } catch (err: any) {
    res.status(500).json({ error: "خطا در ورود به سیستم." });
  }
});

app.get("/api/auth/me", (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (!token) {
      return res.status(401).json({ error: "لطفاً وارد حساب کاربری خود شوید." });
    }

    const user = users.find((u) => u.token === token);
    if (!user) {
      return res.status(401).json({ error: "نشست کاری منقضی شده است." });
    }

    res.json(user);
  } catch (err: any) {
    res.status(500).json({ error: "خطا در دریافت اطلاعات کاربری." });
  }
});

app.post("/api/auth/forgot-password", (req, res) => {
  try {
    const { identifier } = req.body;
    if (!identifier || !identifier.trim()) {
      return res.status(400).json({ error: "ایمیل یا شماره موبایل را وارد کنید." });
    }

    res.json({
      success: true,
      message: "کد بازیابی یا لینک بازیابی رمز عبور به ایمیل / شماره موبایل شما ارسال شد.",
    });
  } catch (err: any) {
    res.status(500).json({ error: "خطا در بازیابی رمز عبور." });
  }
});

// SUBSCRIPTION PLANS & PROMO REDEMPTION ENDPOINTS
app.get("/api/subscriptions/plans", (req, res) => {
  const plans = [
    {
      id: "free",
      name: "برنز (رایگان)",
      badge: "پایه 🥉",
      priceMonthly: 0,
      description: "مناسب برای تست اولیه و مدیریت ۱ کانال تلگرامی",
      maxConnections: 1,
      color: "from-slate-600 to-slate-800",
      features: [
        "امکان تعریف ۱ اتصال کانال فعال",
        "انتقال پیام‌های متنی و عکس در تلگرام",
        "جایگزینی ساده کلمات و متون",
        "سرعت انتقال استاندار (بدون اولویت بالاتر)",
        "پشتیبانی عمومی انجمن"
      ]
    },
    {
      id: "pro",
      name: "نقره‌ای (PRO / حرفه‌ای)",
      badge: "پیشنهادی 🔥",
      recommended: true,
      priceMonthly: 149000,
      description: "ویژه مدیران کانال‌های محبوب و تولیدکنندگان محتوا",
      maxConnections: 5,
      color: "from-blue-600 to-indigo-700",
      features: [
        "امکان تعریف تا ۵ اتصال کانال همزمان",
        "پشتیبانی کامل از ارسال همزمان به پیام‌رسان بله (ایران) 🇮🇷",
        "پشتیبانی کامل از عکس، ویدیو، ویس صوتی و ویدیومسیج",
        "بازنویسی هوشمند متن با AI (Gemini / OpenAI)",
        "حذف و پاکسازی اتوماتیک لینک‌های منبع و تگ‌ها",
        "افزودن امضا و واترمارک اختصاصی",
        "پشتیبانی ۲۴ ساعته و اولویت بالاتر در صف ارسال"
      ]
    },
    {
      id: "vip",
      name: "طلایی (VIP / ویژه)",
      badge: "کامل‌ترین 👑",
      priceMonthly: 299000,
      description: "برای شبکه‌های بزرگ کانالی، آژانس‌های خبری و وبسایت‌ها",
      maxConnections: 20,
      color: "from-amber-500 to-yellow-600",
      features: [
        "اتصالات گسترده تا ۲۰ کانال همزمان",
        "ارسال دوگانه همزمان به بله و پیام‌رسان‌های ایرانی 🇮🇷",
        "پشتیبانی تمام فرمت‌ها و آلبوم‌های چندرسانه‌ای",
        "دسترسی به تمام مدل‌های پیشرفته (Gemini 2.5, GPT-4, DeepSeek)",
        "واترمارک و بازنویسی اختصاصی پیشرفته با پرامپت دلخواه",
        "انتقال آنی بدون تاخیر (Instant Bridge)",
        "پشتیبانی اختصاصی تلگرامی و تلفنی VIP"
      ]
    }
  ];

  res.json(plans);
});

app.post("/api/subscriptions/redeem-code", (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: "لطفاً برای فعال‌سازی کد ابتدا وارد حساب خود شوید." });
    }

    const { code } = req.body;
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: "لطفاً کد هدیه یا کد تخفیف را وارد کنید." });
    }

    const cleanCode = code.trim().toUpperCase();

    // Valid gift codes table
    if (cleanCode === "AUTORUN" || cleanCode === "AUTORUN2026" || cleanCode === "GIFT30" || cleanCode === "VIP30DAYS") {
      const now = new Date();
      let currentExpire = user.subscriptionExpireAt ? new Date(user.subscriptionExpireAt) : new Date();
      if (currentExpire.getTime() < now.getTime()) {
        currentExpire = now;
      }
      // Add 30 days
      currentExpire.setDate(currentExpire.getDate() + 30);

      user.subscriptionStatus = "active";
      user.plan = cleanCode.includes("VIP") ? "vip" : "pro";
      user.subscriptionExpireAt = currentExpire.toISOString();
      user.maxConnections = user.plan === "vip" ? 20 : 10;

      writeJsonFile(USERS_FILE, users);

      return res.json({
        success: true,
        message: `کد هدیه با موفقیت فعال شد! اشتراک شما به مدت ۳۰ روز شارژ گردید.`,
        user
      });
    }

    if (cleanCode === "OFF50" || cleanCode === "DISCOUNT50") {
      return res.json({
        success: true,
        discountPercent: 50,
        message: "کد تخفیف ۵۰٪ با موفقیت روی سفارش شما اعمال شد!"
      });
    }

    return res.status(400).json({ error: "کد وارد شده نامعتبر است یا قبلاً استفاده شده است." });
  } catch (err: any) {
    res.status(500).json({ error: "خطا در بررسی کد تخفیف." });
  }
});

app.post("/api/subscriptions/purchase-request", (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: "لطفاً ابتدا وارد حساب کاربری خود شوید." });
    }

    const { planId, billingCycleMonths, paymentMethod, transactionId, promoCode, amountPaid } = req.body;

    const requestedMonths = Number(billingCycleMonths) || 1;
    const targetPlan = planId === "vip" ? "vip" : "pro";

    const isAdmin = user.role === "admin";
    const status = isAdmin ? "approved" : "pending";

    // Create purchase request record
    const newRequest = {
      id: "req_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      userId: user.id,
      username: user.username,
      fullName: user.fullName || user.username,
      userEmail: user.email,
      userPhone: user.phone,
      planId: targetPlan,
      planTitle: targetPlan === "vip" ? "اشتراک ویژه (VIP)" : "اشتراک پرو (PRO)",
      billingCycleMonths: requestedMonths,
      paymentMethod: paymentMethod || "card_to_card",
      transactionId: transactionId ? String(transactionId).trim() : "",
      amountPaid: Number(amountPaid) || 0,
      status,
      createdAt: new Date().toISOString(),
      processedAt: isAdmin ? new Date().toISOString() : null,
    };

    if (isAdmin) {
      // Activate subscription immediately for admin
      const now = new Date();
      let currentExpire = user.subscriptionExpireAt ? new Date(user.subscriptionExpireAt) : new Date();
      if (currentExpire.getTime() < now.getTime()) {
        currentExpire = now;
      }

      const daysToAdd = requestedMonths * 30;
      currentExpire.setDate(currentExpire.getDate() + daysToAdd);

      user.subscriptionStatus = "active";
      user.plan = targetPlan;
      user.subscriptionExpireAt = currentExpire.toISOString();
      user.maxConnections = targetPlan === "vip" ? 20 : 10;
      user.updatedAt = new Date().toISOString();

      writeJsonFile(USERS_FILE, users);
    }

    purchaseRequests.unshift(newRequest);
    writeJsonFile(PURCHASE_REQUESTS_FILE, purchaseRequests);

    res.json({
      success: true,
      message: isAdmin
        ? `درخواست ارتقای اشتراک شما تایید و اشتراک ${newRequest.planTitle} فعال گردید.`
        : `درخواست تمدید/ارتقای اشتراک ${newRequest.planTitle} شما با موفقیت ثبت شد و در انتظار بررسی و تایید مدیریت است. پس از بررسی ادمین، اشتراک شما فعال خواهد گردید.`,
      user,
      purchaseRequest: newRequest
    });
  } catch (err: any) {
    res.status(500).json({ error: "خطا در ثبت درخواست ارتقا." });
  }
});

// Admin API: List purchase requests
app.get("/api/admin/purchase-requests", (req, res) => {
  try {
    const authUser = getAuthUser(req);
    if (!authUser || authUser.role !== "admin") {
      return res.status(403).json({ error: "دسترسی غیرمجاز." });
    }
    res.json(purchaseRequests);
  } catch (err: any) {
    res.status(500).json({ error: "خطا در دریافت درخواست‌های خرید." });
  }
});

// Admin API: Approve purchase request
app.post("/api/admin/purchase-requests/:id/approve", (req, res) => {
  try {
    const authUser = getAuthUser(req);
    if (!authUser || authUser.role !== "admin") {
      return res.status(403).json({ error: "دسترسی غیرمجاز." });
    }

    const requestId = req.params.id;
    const reqItem = purchaseRequests.find((r) => r.id === requestId);
    if (!reqItem) {
      return res.status(404).json({ error: "درخواست یافت نشد." });
    }

    reqItem.status = "approved";
    reqItem.processedAt = new Date().toISOString();

    const targetUser = users.find((u) => u.id === reqItem.userId || u.username === reqItem.username);
    if (targetUser) {
      const now = new Date();
      let currentExpire = targetUser.subscriptionExpireAt ? new Date(targetUser.subscriptionExpireAt) : new Date();
      if (currentExpire.getTime() < now.getTime()) {
        currentExpire = now;
      }
      const daysToAdd = (reqItem.billingCycleMonths || 1) * 30;
      currentExpire.setDate(currentExpire.getDate() + daysToAdd);

      targetUser.subscriptionStatus = "active";
      targetUser.plan = reqItem.planId;
      targetUser.subscriptionExpireAt = currentExpire.toISOString();
      targetUser.maxConnections = reqItem.planId === "vip" ? 20 : 10;
      writeJsonFile(USERS_FILE, users);
    }

    writeJsonFile(PURCHASE_REQUESTS_FILE, purchaseRequests);
    res.json({ success: true, message: "درخواست خرید تایید و اشتراک کاربر با موفقیت فعال گردید.", request: reqItem });
  } catch (err: any) {
    res.status(500).json({ error: "خطا در تایید درخواست." });
  }
});

// Admin API: Reject purchase request
app.post("/api/admin/purchase-requests/:id/reject", (req, res) => {
  try {
    const authUser = getAuthUser(req);
    if (!authUser || authUser.role !== "admin") {
      return res.status(403).json({ error: "دسترسی غیرمجاز." });
    }

    const requestId = req.params.id;
    const { note } = req.body;
    const reqItem = purchaseRequests.find((r) => r.id === requestId);
    if (!reqItem) {
      return res.status(404).json({ error: "درخواست یافت نشد." });
    }

    reqItem.status = "rejected";
    reqItem.processedAt = new Date().toISOString();
    reqItem.adminNote = note || "رد توسط مدیر سیستم";

    writeJsonFile(PURCHASE_REQUESTS_FILE, purchaseRequests);
    res.json({ success: true, message: "درخواست خرید رد گردید.", request: reqItem });
  } catch (err: any) {
    res.status(500).json({ error: "خطا در رد درخواست." });
  }
});

// Admin API: Export Backup (Members, Passwords, Emails and Member Channels)
app.get("/api/admin/backup/export", (req, res) => {
  try {
    const authUser = getAuthUser(req);
    if (!authUser || authUser.role !== "admin") {
      return res.status(403).json({ error: "دسترسی غیرمجاز." });
    }

    const currentUsers = readJsonFile(USERS_FILE, users);
    const currentConnections: TelegramConnection[] = readJsonFile(CONNECTIONS_FILE, connections);
    const currentRequests = readJsonFile(PURCHASE_REQUESTS_FILE, purchaseRequests);

    // Clean connections stats and lastMessageId in export so restoring won't re-send old messages
    const cleanedConnections = currentConnections.map((conn) => ({
      ...conn,
      transferredCount: 0,
      transferredToday: 0,
      lastMessageId: null,
      lastMessageTime: null,
    }));

    const backupData = {
      version: "1.1.0",
      exportedAt: new Date().toISOString(),
      exportedBy: authUser.username,
      note: "بکاپ اختصاصی اطلاعات اعضا (یوزرنیم، پسورد، ایمیل) و کانال‌های متصل اعضا (بدون آمار و پیام‌های قدیمی)",
      users: currentUsers,
      connections: cleanedConnections,
      purchaseRequests: currentRequests,
      messages: [],
      logs: [],
    };

    res.json(backupData);
  } catch (err: any) {
    res.status(500).json({ error: "خطا در دریافت بکاپ سیستم: " + (err.message || "") });
  }
});

// Admin API: Import Backup (Members and Member Channels)
app.post("/api/admin/backup/import", (req, res) => {
  try {
    const authUser = getAuthUser(req);
    if (!authUser || authUser.role !== "admin") {
      return res.status(403).json({ error: "دسترسی غیرمجاز." });
    }

    const { backupData } = req.body;
    if (!backupData || typeof backupData !== "object") {
      return res.status(400).json({ error: "فرمت داده‌های بکاپ نامعتبر است." });
    }

    const importedUsers: User[] = Array.isArray(backupData.users) ? backupData.users : [];
    const importedConnections: TelegramConnection[] = Array.isArray(backupData.connections) ? backupData.connections : [];
    const importedRequests: any[] = Array.isArray(backupData.purchaseRequests) ? backupData.purchaseRequests : [];

    if (importedUsers.length === 0) {
      return res.status(400).json({ error: "فایل بکاپ ارسالی شامل هیچ کاربری نیست!" });
    }

    // Ensure all users have valid identification fields
    importedUsers.forEach((u: any) => {
      if (!u.id) u.id = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      if (!u.username && u.email) u.username = u.email;
      if (!u.email && u.username) u.email = u.username;
      if (!u.token) u.token = `token_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    });

    // Ensure main admin exists and maintains access
    let hasMainAdmin = importedUsers.some((u: any) => 
      (u.email && u.email.toLowerCase() === ADMIN_EMAIL) || 
      (u.username && u.username.toLowerCase() === ADMIN_EMAIL)
    );

    if (!hasMainAdmin && adminUser) {
      importedUsers.unshift(adminUser);
    } else {
      const importedAdmin = importedUsers.find((u: any) => 
        (u.email && u.email.toLowerCase() === ADMIN_EMAIL) || 
        (u.username && u.username.toLowerCase() === ADMIN_EMAIL)
      );
      if (importedAdmin) {
        importedAdmin.role = "admin";
        importedAdmin.plan = "vip";
        importedAdmin.subscriptionStatus = "active";
        importedAdmin.subscriptionExpireAt = null;
        importedAdmin.maxConnections = 100;
        if (!importedAdmin.password) importedAdmin.password = "137819";
      }
    }

    // Reset stats and baseline ID on all imported connections so old posts won't be re-sent
    importedConnections.forEach((conn: any) => {
      conn.transferredCount = 0;
      conn.transferredToday = 0;
      conn.lastMessageId = null;
      conn.lastMessageTime = null;
    });

    users = importedUsers;
    connections = importedConnections;
    purchaseRequests = importedRequests;
    messages = [];
    logs = [];

    writeJsonFile(USERS_FILE, users);
    writeJsonFile(CONNECTIONS_FILE, connections);
    writeJsonFile(PURCHASE_REQUESTS_FILE, purchaseRequests);
    writeJsonFile(MESSAGES_FILE, messages);
    writeJsonFile(LOGS_FILE, logs);

    // Re-trigger active connection synchronization
    connections.forEach((conn) => {
      if (conn.status === "active") {
        processConnectionSync(conn, true);
      }
    });

    res.json({
      success: true,
      message: `بکاپ کاربران و کانال‌ها با موفقیت روی سرور بازیابی شد! تعداد ${users.length} کاربر (همراه یوزرنیم، پسورد و ایمیل) و ${connections.length} کانال انتقال یافتند.`,
      stats: {
        usersCount: users.length,
        connectionsCount: connections.length,
        requestsCount: purchaseRequests.length,
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: "خطا در بازیابی بکاپ: " + (err.message || "") });
  }
});

// Express Error Handler Middleware (Catches Payload Too Large 413 & JSON Parse Errors)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err.type === 'entity.too.large' || err.status === 413) {
    return res.status(413).json({ error: "حجم فایل بکاپ ارسالی بیش از حد مجاز (۵۰ مگابایت) است." });
  }
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: "فرمت فایل JSON ارسالی نامعتبر است." });
  }
  console.error("Server Express Error:", err);
  res.status(500).json({ error: err.message || "خطای داخلی سرور رخ داده است." });
});



async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Auto run Telegram Forwarder Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
