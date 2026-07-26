import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import * as cheerio from "cheerio";
import { GoogleGenAI } from "@google/genai";
import nodemailer from "nodemailer";
import { TelegramConnection, ConnectionLog, ForwardedMessageRecord, CreateConnectionDTO, AdvancedSettings, ContentFilter, User, LoginDTO, RegisterDTO } from "./src/types";

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

  // 1. OpenAI, DeepSeek, or Custom OpenAI Compatible Endpoint
  if (provider === "openai" || provider === "deepseek" || provider === "custom_openai") {
    let baseUrl = "https://api.openai.com/v1";
    let defaultModel = "gpt-4o-mini";
    let apiKey = options.apiKey?.trim().replace(/^["']|["']$/g, '') || process.env.OPENAI_API_KEY?.trim().replace(/^["']|["']$/g, '') || "";

    if (provider === "deepseek") {
      baseUrl = "https://api.deepseek.com";
      defaultModel = "deepseek-chat";
      apiKey = options.apiKey?.trim().replace(/^["']|["']$/g, '') || process.env.DEEPSEEK_API_KEY?.trim().replace(/^["']|["']$/g, '') || "";
    } else if (provider === "custom_openai") {
      baseUrl = (options.customBaseUrl?.trim() || "https://openrouter.ai/api/v1").replace(/\/+$/, "");
      defaultModel = "meta-llama/llama-3.3-70b-instruct";
      apiKey = options.apiKey?.trim().replace(/^["']|["']$/g, '') || "";
    }

    const modelName = options.model?.trim() || defaultModel;

    if (!apiKey) {
      const pName = provider === "openai" ? "OpenAI" : provider === "deepseek" ? "DeepSeek" : "سرویس سفارشی";
      throw new Error(`کلید API برای ${pName} وارد نشده است.`);
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
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
    const apiKey = options.apiKey?.trim().replace(/^["']|["']$/g, '') || process.env.ANTHROPIC_API_KEY?.trim().replace(/^["']|["']$/g, '') || "";
    const modelName = options.model?.trim() || "claude-3-5-sonnet-latest";

    if (!apiKey) {
      throw new Error("کلید API کلود (Anthropic) وارد نشده است.");
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

  // 3. Google Gemini (Default)
  const apiKey = options.apiKey?.trim().replace(/^["']|["']$/g, '') || process.env.GEMINI_API_KEY?.trim().replace(/^["']|["']$/g, '') || "";
  const ai = getGeminiClient(apiKey);
  if (!ai) {
    throw new Error("کلید API هوش مصنوعی Gemini وارد نشده است! لطفاً کلید Gemini را در تنظیمات وارد کنید.");
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

function normalizeTargetChannel(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith("-100") || cleaned.match(/^-\d+$/)) {
    return cleaned; // Chat ID
  }
  cleaned = cleaned.replace(/^https?:\/\/t\.me\//i, "");
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
      const rewritten = await executeAiRewrite({
        provider: settings.aiProvider,
        apiKey: settings.aiApiKey || settings.geminiApiKey,
        model: settings.aiModel,
        customBaseUrl: settings.aiCustomBaseUrl,
        prompt: settings.aiPrompt,
        text: text,
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

function checkIsDuplicatePost(
  targetChannel: string,
  newPostText: string,
  mediaUrl?: string,
  thresholdPercent: number = 80,
  checkMedia: boolean = true
): { isDuplicate: boolean; similarity: number; matchedMsg?: ForwardedMessageRecord; reason?: string } {
  if (!newPostText && !mediaUrl) {
    return { isDuplicate: false, similarity: 0 };
  }

  const cleanTarget = targetChannel.trim().toLowerCase();
  const targetMessages = messages.filter(
    (m) => m.status === "success" && m.targetChannel && m.targetChannel.trim().toLowerCase() === cleanTarget
  );

  for (const prevMsg of targetMessages.slice(0, 300)) {
    if (checkMedia && mediaUrl && prevMsg.mediaUrl && mediaUrl === prevMsg.mediaUrl) {
      return {
        isDuplicate: true,
        similarity: 100,
        matchedMsg: prevMsg,
        reason: "تطابق دقیق تصویر/ویدیو در کانال مقصد",
      };
    }

    if (newPostText && prevMsg.caption) {
      const sim = calculateTextSimilarity(newPostText, prevMsg.caption);
      if (sim >= thresholdPercent) {
        return {
          isDuplicate: true,
          similarity: sim,
          matchedMsg: prevMsg,
          reason: `شباهت متنی ${sim}٪ (بالاتر از آستانه ${thresholdPercent}٪)`,
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

async function sendTelegramMessage(
  botToken: string,
  targetChannel: string,
  payload: any
): Promise<{ ok: boolean; messageId?: number; error?: string }> {
  try {
    const method = payload.method || "sendMessage";

    const callApi = async (m: string, p: any) => {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/${m}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: targetChannel, ...p }),
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

    // 3. Send Media Group (Album)
    if (method === "sendMediaGroup" && Array.isArray(payload.media)) {
      const normalizedMedia = payload.media.map((m: any) => ({
        ...m,
        media: m.type === "photo" ? getHighResMediaUrl(m.media) : m.media,
      }));

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

      let sentAny = false;
      let lastMsgId: number | undefined;
      for (const item of normalizedMedia) {
        if (item.type === "photo") {
          const r = await sendTelegramMessage(botToken, targetChannel, {
            method: "sendPhoto",
            photo: item.media,
            caption: item.caption || "",
          });
          if (r.ok) {
            sentAny = true;
            lastMsgId = r.messageId;
          }
        } else if (item.type === "video") {
          const r = await sendTelegramMessage(botToken, targetChannel, {
            method: "sendVideo",
            video: item.media,
            caption: item.caption || "",
          });
          if (r.ok) {
            sentAny = true;
            lastMsgId = r.messageId;
          }
        }
      }
      if (sentAny) return { ok: true, messageId: lastMsgId };
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

async function fetchHighResEmbedMedia(cleanChannel: string, msgId: number): Promise<{ photos: string[] }> {
  try {
    const embedUrl = `https://t.me/${cleanChannel}/${msgId}?embed=1`;
    const res = await fetchWithRetry(embedUrl, 1);
    if (!res || !res.ok) return { photos: [] };

    const html = await res.text();
    const $ = cheerio.load(html);
    const photos: string[] = [];

    // 1. Check og:image meta tag (full resolution photo)
    const ogImage = $("meta[property='og:image']").attr("content");
    if (ogImage) {
      const cleaned = cleanMediaUrl(ogImage);
      if (cleaned && isMediaUrlValidAndNotEmoji(cleaned)) {
        photos.push(cleaned);
      }
    }

    // 2. Check embed page photo elements
    $(".tgme_widget_message_photo_wrap, .tgme_widget_message_photo, a.tgme_widget_message_photo_wrap, .tgme_widget_message_grouped_layer_item, .tgme_widget_message_grouped_item").each((_, photoEl) => {
      const $p = $(photoEl);
      if ($p.closest(".js-message_text, .tgme_widget_message_text, .emoji, tg-emoji, .tgme_widget_message_user_photo, .tgme_widget_message_author_photo").length > 0) {
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

      const text = extractTelegramHtml($post.find(".js-message_text"), $);
      
      const mediaItems: { type: 'photo' | 'video'; url: string }[] = [];

      // Extract Photos: Search ONLY in photo wrappers outside text and video wrappers
      $post.find(".tgme_widget_message_photo_wrap, .tgme_widget_message_photo, a.tgme_widget_message_photo_wrap, .tgme_widget_message_grouped_layer_item, .tgme_widget_message_grouped_item").each((_, photoEl) => {
        const $p = $(photoEl);
        // Exclude elements inside message text, author/user avatar wrappers, OR video wrappers
        if ($p.closest(".js-message_text, .tgme_widget_message_text, .emoji, tg-emoji, .tgme_widget_message_user_photo, .tgme_widget_message_author_photo, .tgme_widget_message_video_player, .tgme_widget_message_video_wrap, .tgme_widget_message_video, a.tgme_widget_message_video_player").length > 0) {
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

      // Extract Videos: Search ONLY in video tags/wrappers outside text
      $post.find("video.tgme_widget_message_video, .tgme_widget_message_video_player video, .tgme_widget_message_video_wrap video, a.tgme_widget_message_video_player").each((_, videoEl) => {
        const $v = $(videoEl);
        if ($v.closest(".js-message_text, .tgme_widget_message_text, .emoji, tg-emoji").length > 0) {
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

      let hasPhoto = mediaItems.some(m => m.type === 'photo');
      let photoUrl = mediaItems.find(m => m.type === 'photo')?.url;

      const hasVideo = mediaItems.some(m => m.type === 'video');
      const videoUrl = mediaItems.find(m => m.type === 'video')?.url;

      // Check if this post is a single video post (not a real Telegram media group album)
      const hasGroupedLayout = $post.find(".tgme_widget_message_grouped_layer, .tgme_widget_message_grouped_layer_item").length > 0 || $post.hasClass("tgme_widget_message_grouped");
      if (hasVideo && !hasGroupedLayout) {
        // Single video post: exclude video preview poster thumbnails from photo mediaItems
        for (let i = mediaItems.length - 1; i >= 0; i--) {
          if (mediaItems[i].type === 'photo') {
            mediaItems.splice(i, 1);
          }
        }
        hasPhoto = false;
        photoUrl = undefined;
      }

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
      const hasGif = $post.find(".tgme_widget_message_gif_wrap").length > 0;
      const isMediaGroup = mediaItems.length > 1;

      let type: ForwardedMessageRecord["type"] = "text";
      if (isMediaGroup) type = "media_group";
      else if (hasPhoto) type = "photo";
      else if (hasVideoNote) type = "video_note";
      else if (hasVideo) type = "video";
      else if (hasVoice) type = "voice";
      else if (hasGif) type = "animation";
      else if (hasAudio) type = "audio";
      else if (hasDocument) type = "document";

      posts.push({
        msgId,
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

    // Upgrade photo quality by fetching dedicated post embed data (photos only)
    for (const post of posts) {
      if ((post.hasPhoto || post.isMediaGroup) && !post.hasVideo && post.type !== "video") {
        const embedMedia = await fetchHighResEmbedMedia(cleanName, post.msgId);
        if (embedMedia.photos && embedMedia.photos.length > 0) {
          post.photoUrl = embedMedia.photos[0];
          const videoItems = post.mediaItems.filter(m => m.type === 'video');
          const newPhotoItems = embedMedia.photos.map(url => ({ type: 'photo' as const, url }));
          post.mediaItems = [...newPhotoItems, ...videoItems];
          if (post.mediaItems.length > 1) {
            post.isMediaGroup = true;
            post.type = "media_group";
          }
        }
      }
    }

    return { ok: true, posts, channelTitle };
  } catch (e: any) {
    return { ok: false, posts: [], error: `خطا در دریافت اطلاعات کانال: ${e.message || 'fetch failed'}` };
  }
}

// Connection Sync Worker Function
async function processConnectionSync(conn: TelegramConnection, forceAll: boolean = false) {
  if (conn.status === "paused") return;

  const scrapeResult = await scrapeTelegramChannel(conn.sourceChannel);
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

  let lastId = conn.lastMessageId;

  if (lastId === null) {
    const maxPostId = Math.max(...posts.map((p) => p.msgId));
    conn.lastMessageId = maxPostId - 1;
    conn.status = "active";
    conn.lastError = null;
    writeJsonFile(CONNECTIONS_FILE, connections);
    addLog(conn.id, "info", `شناسه پیام اولیه تنظیم شد: #${maxPostId - 1}. در انتظار انتشار پست جدید...`);
    lastId = maxPostId - 1;
  }

  const newPosts = posts.filter((p) => p.msgId > (lastId || 0));

  if (newPosts.length === 0) {
    return;
  }

  addLog(conn.id, "info", `${newPosts.length} پست جدید در کانال مبدأ شناسایی شد. بررسی فیلترها و شروع ارسال...`);

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

    // 2b. Duplicate Detection & Prevention Check (Skip sending new duplicate posts, keep old posts untouched)
    const preventDuplicates = conn.settings?.preventDuplicates ?? true;
    const similarityThreshold = conn.settings?.duplicateSimilarityThreshold ?? 80;
    const checkMedia = conn.settings?.checkMediaDuplicate ?? true;

    if (preventDuplicates) {
      const dupCheck = checkIsDuplicatePost(
        conn.targetChannel,
        transformedText,
        post.photoUrl || post.videoUrl,
        similarityThreshold,
        checkMedia
      );

      if (dupCheck.isDuplicate) {
        addLog(
          conn.id,
          "warning",
          `پست جدید #${post.msgId} به علت شباهت ${dupCheck.similarity}٪ با پست موجود در کانال ${conn.targetChannel} ارسال نشد (پست‌های قدیمی کانال محفوظ ماندند). علت: ${dupCheck.reason}`,
          post.type,
          post.msgId
        );
        conn.lastMessageId = Math.max(conn.lastMessageId || 0, post.msgId);
        writeJsonFile(CONNECTIONS_FILE, connections);
        continue;
      }
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
        mediaUrl: post.photoUrl || post.videoUrl,
      };
      messages.unshift(record);
      writeJsonFile(MESSAGES_FILE, messages);
      writeJsonFile(CONNECTIONS_FILE, connections);

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
    const { sourceChannel, targetChannel, botToken, enableBale, baleTargetChannel, baleBotToken, baleReplaceId, settings }: CreateConnectionDTO = req.body;

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
      enableBale: !!enableBale,
      baleTargetChannel: baleTargetChannel?.trim() || undefined,
      baleBotToken: baleBotToken?.trim() || undefined,
      baleReplaceId: resolvedBaleReplaceId,
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
      },
    };

    connections.unshift(newConnection);
    writeJsonFile(CONNECTIONS_FILE, connections);

    addLog(newConnection.id, "info", `اتصال جدید بین ${newConnection.sourceChannel} و ${newConnection.targetChannel} ایجاد شد.`);

    if (newConnection.enableBale && newConnection.baleTargetChannel) {
      addLog(newConnection.id, "info", `ارسال همزمان به پیام‌رسان بله (${newConnection.baleTargetChannel}) نیز فعال گردید.`);
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

  const {
    rewriteMode,
    aiPrompt,
    geminiApiKey,
    replacements,
    signature,
    removeSourceLinks,
    cleanTagsAndLinks,
    contentFilter,
    enableBale,
    baleTargetChannel,
    baleBotToken,
    baleReplaceId
  }: AdvancedSettings = req.body;

  if (enableBale) {
    const authUser = getAuthUser(req);
    if (authUser && authUser.role !== 'admin' && (authUser.plan === 'free' || authUser.subscriptionStatus !== 'active')) {
      return res.status(403).json({
        error: "قابلیت ارسال همزمان به پیام‌رسان بله (ایران) ویژه کاربران دارای اشتراک پرو (PRO) یا ویژه (VIP) می‌باشد. لطفاً برای فعال‌سازی این امکان، اشتراک خود را ارتقا دهید."
      });
    }
  }

  conn.enableBale = !!enableBale;
  if (baleTargetChannel !== undefined) conn.baleTargetChannel = baleTargetChannel.trim();
  if (baleBotToken !== undefined) conn.baleBotToken = baleBotToken.trim();
  if (baleReplaceId !== undefined) conn.baleReplaceId = baleReplaceId.trim();

  conn.settings = {
    rewriteMode: rewriteMode || "none",
    aiPrompt: aiPrompt || "",
    geminiApiKey: geminiApiKey || "",
    replacements: replacements || [],
    signature: signature || "",
    removeSourceLinks: !!removeSourceLinks,
    cleanTagsAndLinks: !!cleanTagsAndLinks,
    contentFilter: contentFilter || "all",
    enableBale: !!enableBale,
    baleTargetChannel: baleTargetChannel?.trim() || "",
    baleBotToken: baleBotToken?.trim() || "",
    baleReplaceId: baleReplaceId?.trim() || "",
  };

  writeJsonFile(CONNECTIONS_FILE, connections);
  addLog(conn.id, "info", "تنظیمات پیشرفته و فیلترها (به همراه تنظیمات بله) با موفقیت به‌روزرسانی شد.");

  res.json(conn);
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

        if (checkMedia && current.mediaUrl && compareWith.mediaUrl && current.mediaUrl === compareWith.mediaUrl) {
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
      status: "approved",
      createdAt: new Date().toISOString(),
      processedAt: new Date().toISOString(),
    };

    // Activate subscription
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

    purchaseRequests.unshift(newRequest);
    writeJsonFile(PURCHASE_REQUESTS_FILE, purchaseRequests);

    res.json({
      success: true,
      message: `درخواست ارتقای اشتراک شما ثبت گردید! اشتراک ${newRequest.planTitle} شما فعال گردید.`,
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
    const currentConnections = readJsonFile(CONNECTIONS_FILE, connections);
    const currentRequests = readJsonFile(PURCHASE_REQUESTS_FILE, purchaseRequests);

    const backupData = {
      version: "1.1.0",
      exportedAt: new Date().toISOString(),
      exportedBy: authUser.username,
      note: "بکاپ اختصاصی اطلاعات اعضا (یوزرنیم، پسورد، ایمیل) و کانال‌های متصل اعضا (بدون پیام‌های منتقل‌شده)",
      users: currentUsers,
      connections: currentConnections,
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

    users = importedUsers;
    connections = importedConnections;
    purchaseRequests = importedRequests;

    writeJsonFile(USERS_FILE, users);
    writeJsonFile(CONNECTIONS_FILE, connections);
    writeJsonFile(PURCHASE_REQUESTS_FILE, purchaseRequests);

    // If backup JSON happens to include messages/logs (e.g. legacy backup), restore them if provided
    if (Array.isArray(backupData.messages) && backupData.messages.length > 0) {
      messages = backupData.messages;
      writeJsonFile(MESSAGES_FILE, messages);
    }
    if (Array.isArray(backupData.logs) && backupData.logs.length > 0) {
      logs = backupData.logs;
      writeJsonFile(LOGS_FILE, logs);
    }

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
