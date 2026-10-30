export interface TelegramBotUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
}

export interface TelegramSentMessage {
  message_id: number;
  date: number;
  chat: { id: number; type: string };
}

export interface TelegramWebhookInfo {
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  last_error_date?: number;
  last_error_message?: string;
}

export class TelegramBotClient {
  private readonly baseUrl: string;

  constructor(private readonly botToken?: string) {
    this.baseUrl = `https://api.telegram.org/bot${botToken || 'UNCONFIGURED'}`;
  }

  isConfigured(): boolean {
    return !!this.botToken && !this.botToken.includes('UNCONFIGURED');
  }

  async getMe(): Promise<TelegramBotUser> {
    if (!this.isConfigured()) {
      throw new Error('Telegram bot token is not configured');
    }

    const res = await fetch(`${this.baseUrl}/getMe`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok || !json.result) {
      throw new Error(`Telegram getMe failed: ${json.description || 'Invalid bot token'}`);
    }

    return json.result;
  }

  async getWebhookInfo(): Promise<TelegramWebhookInfo> {
    if (!this.isConfigured()) {
      throw new Error('Telegram bot token is not configured');
    }

    const res = await fetch(`${this.baseUrl}/getWebhookInfo`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok || !json.result) {
      throw new Error(`Telegram getWebhookInfo failed: ${json.description || 'API error'}`);
    }

    return json.result;
  }

  async deleteWebhook(): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      const res = await fetch(`${this.baseUrl}/deleteWebhook`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
      });
      const json = await res.json().catch(() => ({}));
      return !!json.ok;
    } catch {
      return false;
    }
  }

  async sendMessage(chatId: string | number, text: string): Promise<TelegramSentMessage> {
    if (!this.isConfigured()) {
      throw new Error('Telegram bot token is not configured');
    }

    const res = await fetch(`${this.baseUrl}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok || !json.result) {
      throw new Error(`Telegram sendMessage failed: ${json.description || 'Delivery rejected by Telegram'}`);
    }

    return json.result;
  }

  async getUpdates(offset?: number, timeout = 0): Promise<any[]> {
    if (!this.isConfigured()) {
      throw new Error('Telegram bot token is not configured');
    }

    const body: Record<string, unknown> = { timeout };
    if (offset !== undefined) body['offset'] = offset;

    const res = await fetch(`${this.baseUrl}/getUpdates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout((timeout + 5) * 1000),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) {
      throw new Error(`Telegram getUpdates failed: ${json.description || 'Polling error'}`);
    }

    return Array.isArray(json.result) ? json.result : [];
  }
}
