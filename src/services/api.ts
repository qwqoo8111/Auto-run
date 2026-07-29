import { TelegramConnection, ConnectionLog, ForwardedMessageRecord, CreateConnectionDTO, ConnectionStats, AdvancedSettings, User, LoginDTO, RegisterDTO, SubscriptionPlan, PurchaseRequestDTO, PurchaseRequestRecord } from '../types';

async function safeJsonFetch(url: string, options?: RequestInit, maxRetries = 5): Promise<any> {
  let lastErr: any = null;
  const token = typeof window !== 'undefined' ? localStorage.getItem('autorun_auth_token') : null;
  const mergedHeaders: Record<string, string> = {
    'Accept': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options?.headers as Record<string, string> || {}),
  };

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, { ...options, headers: mergedHeaders });
      const contentType = res.headers.get('content-type') || '';
      
      const text = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch (_) {
        // Response body is not JSON (e.g., HTML during server restart or proxy error)
      }

      if (!res.ok) {
        if (data && data.error) {
          throw new Error(data.error);
        }
        if (res.status === 401 || res.status === 403) {
          throw new Error(data?.error || `نشست کاری منقضی شده است یا دسترسی غیرمجاز است (${res.status})`);
        }
        if (res.status >= 500 && attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
          continue;
        }
        throw new Error(data?.error || `خطا در دریافت اطلاعات (${res.status})`);
      }

      if (data !== null) {
        return data;
      }

      if (!contentType.includes('application/json')) {
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
          continue;
        }
        throw new Error('پاسخ سرور در قالب JSON معتبر نیست.');
      }

      throw new Error('پاسخ خالی یا نامعتبر از سرور دریافت شد.');
    } catch (err: any) {
      lastErr = err;
      if (err.message && (err.message.includes('401') || err.message.includes('403') || err.message.includes('دسترسی غیرمجاز') || err.message.includes('منقضی'))) {
        throw err;
      }
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
        continue;
      }
      throw err;
    }
  }
  throw lastErr || new Error('خطا در برقراری ارتباط با سرور.');
}

export async function fetchConnections(): Promise<{ connections: TelegramConnection[]; stats: ConnectionStats }> {
  return safeJsonFetch('/api/connections');
}

export async function createConnection(dto: CreateConnectionDTO): Promise<TelegramConnection> {
  return safeJsonFetch('/api/connections', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });
}

export async function updateConnectionSettings(id: string, settings: AdvancedSettings): Promise<TelegramConnection> {
  return safeJsonFetch(`/api/connections/${id}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
}

export async function pauseConnection(id: string): Promise<TelegramConnection> {
  return safeJsonFetch(`/api/connections/${id}/pause`, { method: 'POST' });
}

export async function resumeConnection(id: string): Promise<TelegramConnection> {
  return safeJsonFetch(`/api/connections/${id}/resume`, { method: 'POST' });
}

export async function deleteConnection(id: string): Promise<void> {
  await safeJsonFetch(`/api/connections/${id}`, { method: 'DELETE' });
}

export async function fetchConnectionLogs(id: string): Promise<ConnectionLog[]> {
  return safeJsonFetch(`/api/connections/${id}/logs`);
}

export async function fetchConnectionMessages(id: string): Promise<ForwardedMessageRecord[]> {
  return safeJsonFetch(`/api/connections/${id}/messages`);
}

export async function sendTestMessage(id: string): Promise<{ success: boolean; telegramSent: boolean; error?: string }> {
  return safeJsonFetch(`/api/connections/${id}/test`, { method: 'POST' });
}

export async function triggerManualSync(id: string): Promise<TelegramConnection> {
  return safeJsonFetch(`/api/connections/${id}/sync`, { method: 'POST' });
}

export async function cleanDuplicates(id: string): Promise<{ ok: boolean; deletedCount: number; message: string; errors?: string[] }> {
  return safeJsonFetch(`/api/connections/${id}/clean-duplicates`, { method: 'POST' });
}

export async function testAiApi(payload: {
  provider?: string;
  apiKey?: string;
  model?: string;
  customBaseUrl?: string;
  prompt?: string;
  sampleText?: string;
}): Promise<{ success: boolean; result: string }> {
  return safeJsonFetch('/api/test-ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function fetchGlobalSupervisorConfig(): Promise<{ config: any; stats: any }> {
  return safeJsonFetch('/api/global-supervisor/config');
}

export async function updateGlobalSupervisorConfig(config: any): Promise<{ config: any }> {
  return safeJsonFetch('/api/global-supervisor/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
}

export async function testGlobalSupervisorBot(payload: {
  botToken: string;
  targetChannel?: string;
}): Promise<{ ok: boolean; botName?: string; username?: string; channelTitle?: string; isChannelAdmin?: boolean; message: string }> {
  return safeJsonFetch('/api/global-supervisor/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function scanGlobalSupervisorChannels(payload: {
  botToken?: string;
}): Promise<{ ok: boolean; scannedCount: number; message: string }> {
  return safeJsonFetch('/api/global-supervisor/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function loginUser(dto: LoginDTO): Promise<{ user: User; token: string }> {
  return safeJsonFetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });
}

export async function registerUser(dto: RegisterDTO): Promise<{ user: User; token: string }> {
  return safeJsonFetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });
}

export async function sendEmailOtp(email: string): Promise<{ success: boolean; message: string }> {
  return safeJsonFetch('/api/auth/send-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
}

export async function fetchCurrentUser(token: string): Promise<User> {
  return safeJsonFetch('/api/auth/me', {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
}

export async function forgotPassword(identifier: string): Promise<{ success: boolean; message: string }> {
  return safeJsonFetch('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier }),
  });
}

export async function fetchAdminUsers(token: string): Promise<User[]> {
  return safeJsonFetch('/api/admin/users', {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
}

export async function updateAdminUserSubscription(
  token: string,
  userId: string,
  data: {
    subscriptionStatus?: 'active' | 'inactive' | 'expired';
    plan?: string;
    durationDays?: number | null;
    customExpireAt?: string | null;
    role?: 'user' | 'admin';
    maxConnections?: number;
  }
): Promise<{ success: boolean; user: User }> {
  return safeJsonFetch(`/api/admin/users/${userId}/subscription`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
}

export async function createAdminUser(token: string, userData: any): Promise<{ success: boolean; user: User }> {
  return safeJsonFetch('/api/admin/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(userData),
  });
}

export async function deleteAdminUser(token: string, userId: string): Promise<{ success: boolean; message: string }> {
  return safeJsonFetch(`/api/admin/users/${userId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
}

export async function fetchSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  return safeJsonFetch('/api/subscriptions/plans');
}

export async function redeemGiftCode(
  token: string,
  code: string
): Promise<{ success: boolean; message: string; user?: User; discountPercent?: number }> {
  return safeJsonFetch('/api/subscriptions/redeem-code', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ code }),
  });
}

export async function submitPurchaseRequest(
  token: string,
  dto: PurchaseRequestDTO
): Promise<{ success: boolean; message: string; user: User }> {
  return safeJsonFetch('/api/subscriptions/purchase-request', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(dto),
  });
}

export async function testBaleBot(baleBotToken: string, baleTargetChannel: string): Promise<{ success: boolean; message: string }> {
  return safeJsonFetch('/api/test-bale', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ baleBotToken, baleTargetChannel }),
  });
}

export async function fetchAdminPurchaseRequests(token: string): Promise<PurchaseRequestRecord[]> {
  return safeJsonFetch('/api/admin/purchase-requests', {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
}

export async function approveAdminPurchaseRequest(token: string, requestId: string): Promise<{ success: boolean; message: string }> {
  return safeJsonFetch(`/api/admin/purchase-requests/${requestId}/approve`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
}

export async function rejectAdminPurchaseRequest(token: string, requestId: string, note?: string): Promise<{ success: boolean; message: string }> {
  return safeJsonFetch(`/api/admin/purchase-requests/${requestId}/reject`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ note }),
  });
}

export async function exportAdminBackup(token: string): Promise<any> {
  return safeJsonFetch('/api/admin/backup/export', {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
}

export async function importAdminBackup(token: string, backupData: any): Promise<{ success: boolean; message: string; stats?: any }> {
  return safeJsonFetch('/api/admin/backup/import', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ backupData }),
  });
}

export async function extractSocialLink(payload: {
  url: string;
  translateToPersian?: boolean;
  customPrompt?: string;
}): Promise<{
  ok: boolean;
  extracted: {
    type: string;
    author?: string;
    title?: string;
    rawText: string;
    telegramText: string;
    mediaUrls: string[];
    sourceUrl: string;
  };
}> {
  return safeJsonFetch('/api/experimental/extract-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function fetchAiXTrends(payload: {
  topic?: string;
  count?: number;
}): Promise<{
  ok: boolean;
  topic: string;
  trends: Array<{
    id: string;
    title: string;
    originalSummary: string;
    telegramText: string;
    hashtags: string[];
    sourceUrl?: string;
    topicCategory?: string;
  }>;
}> {
  return safeJsonFetch('/api/experimental/ai-trends', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function postExperimentalToTelegram(payload: {
  botToken: string;
  targetChannel: string;
  text: string;
  mediaUrls?: string[];
}): Promise<{ ok: boolean; messageId?: number; error?: string }> {
  return safeJsonFetch('/api/experimental/post-now', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export interface AutoTrendConfig {
  enabled: boolean;
  connId?: string;
  botToken: string;
  targetChannel: string;
  topic: string;
  intervalHours: number;
  countPerRun: number;
  lastRunAt?: string | null;
  nextRunAt?: string | null;
  logs?: Array<{ time: string; status: 'success' | 'error'; message: string }>;
}

export async function getAutoTrendConfig(): Promise<{ ok: boolean; config: AutoTrendConfig }> {
  return safeJsonFetch('/api/experimental/auto-trends', {
    method: 'GET',
  });
}

export async function saveAutoTrendConfig(payload: AutoTrendConfig): Promise<{ ok: boolean; config: AutoTrendConfig }> {
  return safeJsonFetch('/api/experimental/auto-trends', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}





