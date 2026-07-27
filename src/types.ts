export type ConnectionStatus = 'active' | 'paused' | 'error' | 'connecting';

export type RewriteMode = 'none' | 'ai' | 'replace';
export type ContentFilter = 'all' | 'text_only' | 'text_and_photo' | 'text_and_video' | 'text_and_voice' | 'text_and_video_note' | 'voice_only' | 'video_note_only';
export type AiProvider = 'gemini' | 'openai' | 'deepseek' | 'claude' | 'custom_openai';

export interface TextReplacementRule {
  id: string;
  find: string;
  replace: string;
  isRegex?: boolean;
}

export interface AdvancedSettings {
  rewriteMode: RewriteMode;
  aiPrompt?: string;
  aiProvider?: AiProvider;
  aiApiKey?: string;
  aiModel?: string;
  aiCustomBaseUrl?: string;
  geminiApiKey?: string; // backwards compatibility
  replacements: TextReplacementRule[];
  signature?: string;
  removeSourceLinks?: boolean;
  cleanTagsAndLinks?: boolean;
  contentFilter: ContentFilter;
  enableBale?: boolean;
  baleTargetChannel?: string;
  baleBotToken?: string;
  baleReplaceId?: string;
  preventDuplicates?: boolean;
  duplicateSimilarityThreshold?: number;
  duplicateAction?: 'skip' | 'delete_existing';
  checkMediaDuplicate?: boolean;
  // Global Channel Supervisor
  enableGlobalSupervisor?: boolean;
  globalHashAlgorithm?: 'fingerprint' | 'exact_hash' | 'fuzzy_token';
  globalSimilarityThreshold?: number;
  cacheBufferHours?: number;
  crossChannelScope?: 'all_channels' | 'same_target_channel';
}

export interface GlobalSupervisorConfig {
  enabled: boolean;
  botToken: string;
  autoDelete: boolean;
  scanDepth: number;
  platform: 'telegram' | 'bale' | 'both';
}

export interface TelegramConnection {
  id: string;
  sourceChannel: string;
  targetChannel: string;
  botToken: string;
  status: ConnectionStatus;
  lastMessageId: number | null;
  lastMessageTime: string | null;
  transferredCount: number;
  createdAt: string;
  lastError: string | null;
  botName?: string;
  sourceTitle?: string;
  enableBale?: boolean;
  baleTargetChannel?: string;
  baleBotToken?: string;
  baleReplaceId?: string;
  settings?: AdvancedSettings;
}

export interface ConnectionLog {
  id: string;
  connectionId: string;
  timestamp: string;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
  messageType?: string;
  sourceMsgId?: number;
}

export interface ForwardedMessageRecord {
  id: string;
  connectionId: string;
  sourceMsgId: number;
  targetMsgId?: number;
  targetChannel?: string;
  type: 'text' | 'photo' | 'video' | 'document' | 'audio' | 'voice' | 'video_note' | 'animation' | 'media_group';
  caption?: string;
  transferredAt: string;
  status: 'success' | 'failed';
  mediaUrl?: string;
  mediaItems?: { type: 'photo' | 'video'; url: string }[];
}

export interface CreateConnectionDTO {
  sourceChannel: string;
  targetChannel: string;
  botToken: string;
  enableBale?: boolean;
  baleTargetChannel?: string;
  baleBotToken?: string;
  baleReplaceId?: string;
  settings?: AdvancedSettings;
}

export interface ConnectionStats {
  totalConnections: number;
  activeConnections: number;
  totalTransferred: number;
  lastActivity: string | null;
}

export interface User {
  id: string;
  username: string;
  fullName: string;
  email: string;
  phone?: string;
  password?: string;
  role: 'user' | 'admin';
  plan: 'pro' | 'free' | 'vip';
  subscriptionStatus: 'active' | 'inactive' | 'expired';
  subscriptionExpireAt?: string | null; // ISO date string or null for lifetime
  maxConnections?: number;
  connectionsCount?: number;
  createdAt: string;
  updatedAt?: string;
  token?: string;
}

export interface LoginDTO {
  identifier: string; // username, email, or phone
  password: string;
}

export interface RegisterDTO {
  username: string;
  fullName: string;
  email: string;
  phone?: string;
  password: string;
  otpCode?: string;
}

export interface SubscriptionPlan {
  id: 'free' | 'pro' | 'vip';
  name: string;
  badge: string;
  priceMonthly: number; // in Tomans
  description: string;
  maxConnections: number;
  features: string[];
  recommended?: boolean;
  color: string;
}

export interface RedeemCodeDTO {
  code: string;
}

export interface PurchaseRequestDTO {
  planId: 'pro' | 'vip';
  billingCycleMonths: number;
  paymentMethod: 'card_to_card' | 'online_gateway' | 'telegram_support';
  transactionId?: string;
  promoCode?: string;
  amountPaid?: number;
}

export interface PurchaseRequestRecord {
  id: string;
  userId: string;
  username: string;
  fullName?: string;
  userEmail?: string;
  userPhone?: string;
  planId: 'pro' | 'vip';
  planTitle: string;
  billingCycleMonths: number;
  paymentMethod: 'card_to_card' | 'online_gateway' | 'telegram_support';
  transactionId?: string;
  amountPaid: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  processedAt?: string;
  adminNote?: string;
}


