import { Injectable, UnauthorizedException, BadRequestException, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { prisma, createOutboxEvent, Prisma } from '@paw/database';
import { ServerEnvSchema } from '@paw/config';
import { createHash } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { TasksService } from '../tasks/tasks.service';
import { CalendarService } from '../calendar/calendar.service';
import { RemindersService } from '../reminders/reminders.service';
import { TelegramBotClient } from './telegram-bot.client';

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: {
      id: number;
      is_bot: boolean;
      first_name: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
    };
    date: number;
    text?: string;
  };
}

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly config = ServerEnvSchema.parse(process.env);
  private readonly botClient: TelegramBotClient;
  private allowedUserId: string;
  private webhookSecret: string;
  private isPolling = false;
  private pollingOffset = 0;

  constructor(
    private readonly auditService: AuditService,
    private readonly tasksService: TasksService,
    private readonly calendarService: CalendarService,
    private readonly remindersService: RemindersService,
  ) {
    this.allowedUserId = this.config.TELEGRAM_OWNER_USER_ID || '123456789';
    this.webhookSecret = this.config.TELEGRAM_WEBHOOK_SECRET || 'paw-telegram-secret';
    this.botClient = new TelegramBotClient(this.config.TELEGRAM_BOT_TOKEN);
  }

  async onModuleInit() {
    if (this.botClient.isConfigured() && process.env.NODE_ENV !== 'test') {
      this.startPolling();
    }
  }

  onModuleDestroy() {
    this.isPolling = false;
  }

  async startPolling() {
    if (this.isPolling) return;
    this.isPolling = true;

    try {
      const webhookInfo = await this.botClient.getWebhookInfo();
      if (webhookInfo.url) {
        console.log(`[Telegram] Menghapus webhook (${webhookInfo.url}) agar polling lokal dapat berjalan...`);
        await this.botClient.deleteWebhook();
      }
    } catch (err: unknown) {
      console.warn('[Telegram] Cek webhook info warning:', err instanceof Error ? err.message : err);
    }

    console.log('[Telegram] Polling lokal aktif untuk menerima pesan bot...');
    this.pollLoop();
  }

  private async pollLoop() {
    while (this.isPolling) {
      try {
        const updates = await this.botClient.getUpdates(this.pollingOffset, 3);
        for (const update of updates) {
          if (update.update_id >= this.pollingOffset) {
            this.pollingOffset = update.update_id + 1;
          }
          await this.processIncomingUpdate(update);
        }
      } catch (err: unknown) {
        // Sleep on network error before retrying
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
  }

  private async processIncomingUpdate(update: TelegramUpdate) {
    if (!update || !update.message) return;

    try {
      const res = await this.handleWebhookUpdate(update, this.webhookSecret);
      if (res && res.reply && update.message.chat?.id) {
        // Send reply directly back to Telegram chat!
        await this.botClient.sendMessage(update.message.chat.id, res.reply);
      }
    } catch (err: unknown) {
      console.error('[Telegram] Gagal memproses update:', err instanceof Error ? err.message : err);
    }
  }

  getBotClient() {
    return this.botClient;
  }

  // Testing helper to configure allowed sender
  setAllowedUserId(id: string) {
    this.allowedUserId = id;
  }

  setWebhookSecret(secret: string) {
    this.webhookSecret = secret;
  }

  /**
   * Hard allowlist check per docs/SECURITY.md
   */
  isSenderAllowed(senderId?: number | string): boolean {
    if (!senderId) return false;
    return String(senderId) === String(this.allowedUserId);
  }

  /**
   * Validates webhook secret token
   */
  validateWebhookSecret(secretToken?: string): boolean {
    if (!secretToken) return false;
    return secretToken === this.webhookSecret;
  }

  /**
   * Ingests and processes Telegram webhook update
   */
  async handleWebhookUpdate(update: TelegramUpdate, secretToken?: string, traceId?: string) {
    // 1. Verify webhook secret header
    if (this.webhookSecret && !this.validateWebhookSecret(secretToken)) {
      throw new UnauthorizedException('Invalid or missing Telegram webhook secret token');
    }

    if (!update || !update.update_id) {
      throw new BadRequestException('Invalid update payload');
    }

    // 2. Deduplicate update_id using webhook_inbox table
    const eventKey = `tg_update_${update.update_id}`;
    const existing = await prisma.webhookInbox.findUnique({
      where: {
        provider_externalEventKey: {
          provider: 'telegram',
          externalEventKey: eventKey,
        },
      },
    });

    if (existing) {
      return { status: 'deduplicated', update_id: update.update_id };
    }

    await prisma.webhookInbox.create({
      data: {
        provider: 'telegram',
        externalEventKey: eventKey,
        payload: update as unknown as Prisma.InputJsonValue,
      },
    });

    // 3. Sender allowlist validation (allow pairing command /start pair_ to proceed)
    const message = update.message;
    if (!message || !message.from) {
      return { status: 'ignored_no_message' };
    }

    const text = message.text?.trim() || '';
    const isPairingAttempt = text.startsWith('/start pair_');

    const senderId = message.from.id;
    if (!isPairingAttempt && !this.isSenderAllowed(senderId)) {
      this.auditService.record({
        actorType: 'user',
        actorId: String(senderId),
        action: 'telegram.message.rejected_unauthorized',
        traceId,
        metadata: { senderId, username: message.from.username },
      });
      return { status: 'rejected_unauthorized_sender' };
    }

    // 4. Dispatch deterministic command
    const responseText = await this.dispatchCommand(text, message, traceId);

    return {
      status: 'processed',
      update_id: update.update_id,
      reply: responseText,
    };
  }

  /**
   * Deterministic command parser
   */
  async dispatchCommand(text: string, message?: TelegramUpdate['message'], _traceId?: string): Promise<string> {
    const parts = text.split(/\s+/);
    const command = parts[0]?.toLowerCase() || '';

    // Handle pairing command
    if (command === '/start' && parts[1]?.startsWith('pair_') && message) {
      if (message.chat.type !== 'private') {
        return '❌ Pairing hanya dapat dilakukan melalui pesan pribadi (private chat) dengan bot.';
      }
      if (this.config.TELEGRAM_OWNER_USER_ID && String(message.from?.id) !== String(this.config.TELEGRAM_OWNER_USER_ID)) {
        return `⛔ Akses ditolak: ID Telegram Anda (${message.from?.id}) tidak cocok dengan TELEGRAM_OWNER_USER_ID (${this.config.TELEGRAM_OWNER_USER_ID}) di file .env.`;
      }

      const tokenHash = `telegram_pair:${createHash('sha256').update(parts[1]).digest('hex')}`;
      const challenge = await prisma.telegramPairingChallenge.findUnique({
        where: { tokenHash },
      });

      if (!challenge || challenge.status !== 'PENDING' || challenge.expiresAt <= new Date()) {
        return '❌ Kode pairing tidak valid atau telah kedaluwarsa. Silakan buat kode pairing baru di menu Settings.';
      }

      await prisma.telegramPairingChallenge.update({
        where: { id: challenge.id },
        data: { status: 'PAIRED', consumedAt: new Date() },
      });

      await prisma.connectedAccount.upsert({
        where: {
          ownerId_provider_externalSubject: {
            ownerId: challenge.ownerId,
            provider: 'telegram',
            externalSubject: String(message.from?.id),
          },
        },
        create: {
          ownerId: challenge.ownerId,
          provider: 'telegram',
          externalSubject: String(message.from?.id),
          telegramUserId: String(message.from?.id),
          telegramChatId: String(message.chat.id),
          displayName: message.from?.username || message.from?.first_name || 'Telegram User',
          username: message.from?.username,
          status: 'CONNECTED',
          lastVerifiedAt: new Date(),
        },
        update: {
          telegramUserId: String(message.from?.id),
          telegramChatId: String(message.chat.id),
          displayName: message.from?.username || message.from?.first_name || 'Telegram User',
          username: message.from?.username,
          status: 'CONNECTED',
          lastVerifiedAt: new Date(),
          lastErrorCode: null,
        },
      });

      return '✅ Berhasil! Akun Telegram Anda telah terpasang resmi dengan Personal AI Workspace.';
    }

    // Find default owner
    const owner = await prisma.user.findFirst({
      where: { email: this.config.OWNER_EMAIL },
    });
    const ownerId = owner?.id || 'e1000000-0000-0000-0000-000000000001';

    switch (command) {
      case '/start':
        return '👋 Halo Owner! Personal AI Workspace Telegram Gateway aktif. Perintah tersedia: /tasks, /calendar, /ack <id>, /snooze <id> <mins>';

      case '/tasks': {
        const tasks = await this.tasksService.listTasks(ownerId, { status: 'todo' });
        if (tasks.data.length === 0) {
          return '📋 Tidak ada task pending. Semua beres!';
        }
        const lines = tasks.data.slice(0, 10).map((t, idx) => {
          const due = t.dueAt ? ` (Due: ${new Date(t.dueAt).toLocaleDateString('id-ID')})` : '';
          return `${idx + 1}. [${t.priority.toUpperCase()}] ${t.title}${due}`;
        });
        return `📋 *Active Tasks:*\n${lines.join('\n')}`;
      }

      case '/calendar': {
        const now = new Date();
        const next7Days = new Date(now.getTime() + 7 * 86400000);
        const events = await this.calendarService.listEvents(ownerId, now, next7Days);
        if (events.data.length === 0) {
          return '📅 Tidak ada agenda dalam 7 hari ke depan.';
        }
        const lines = events.data.slice(0, 10).map((e, idx) => {
          const time = new Date(e.startsAt).toLocaleString('id-ID', {
            dateStyle: 'short',
            timeStyle: 'short',
          });
          return `${idx + 1}. ${e.title} - ${time} (${e.source})`;
        });
        return `📅 *Agenda 7 Hari:* \n${lines.join('\n')}`;
      }

      case '/ack': {
        const occurrenceId = parts[1];
        if (!occurrenceId) {
          return '⚠️ Penggunaan: /ack <occurrence_id>';
        }
        try {
          await this.remindersService.acknowledgeOccurrence(ownerId, {
            occurrenceId,
            clientRequestId: `tg-ack-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          });
          return `✅ Pengingat '${occurrenceId}' berhasil di-acknowledge!`;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          return `❌ Gagal acknowledge: ${msg}`;
        }
      }

      case '/snooze': {
        const occurrenceId = parts[1];
        const minutes = parts[2] ? parseInt(parts[2], 10) : 10;
        if (!occurrenceId) {
          return '⚠️ Penggunaan: /snooze <occurrence_id> [menit, default 10]';
        }
        try {
          await this.remindersService.snoozeOccurrence(ownerId, {
            occurrenceId,
            clientRequestId: `tg-snz-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            minutes,
          });
          return `⏰ Pengingat '${occurrenceId}' berhasil di-snooze selama ${minutes} menit.`;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          return `❌ Gagal snooze: ${msg}`;
        }
      }

      default:
        return '❓ Perintah tidak dikenal. Ketik /start untuk melihat daftar perintah.';
    }
  }

  /**
   * Sends outgoing notification via Telegram and records NotificationDelivery
   */
  async sendNotification(params: {
    occurrenceId?: string;
    recipientChatId: string;
    text: string;
    traceId?: string;
  }) {
    let providerMessageId = `tg_msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    if (this.botClient.isConfigured()) {
      try {
        const sent = await this.botClient.sendMessage(params.recipientChatId, params.text);
        providerMessageId = String(sent.message_id);
      } catch (err: unknown) {
        if (params.occurrenceId) {
          await prisma.notificationDelivery.create({
            data: {
              occurrenceId: params.occurrenceId,
              channel: 'telegram',
              recipientRef: params.recipientChatId,
              status: 'failed',
              lastError: err instanceof Error ? err.message : String(err),
              attemptCount: 1,
            },
          });
        }
        throw err;
      }
    }

    if (params.occurrenceId) {
      await prisma.notificationDelivery.create({
        data: {
          occurrenceId: params.occurrenceId,
          channel: 'telegram',
          recipientRef: params.recipientChatId,
          status: 'sent',
          providerMessageId,
          attemptCount: 1,
        },
      });

      await prisma.$transaction(async (tx) => {
        await createOutboxEvent(tx, {
          aggregateType: 'notification',
          aggregateId: params.occurrenceId!,
          eventType: 'notification.sent.v1',
          payload: {
            channel: 'telegram',
            providerMessageId,
            recipient: params.recipientChatId,
          },
          traceId: params.traceId,
        });
      });
    }

    return {
      success: true,
      providerMessageId,
      sentAt: new Date().toISOString(),
    };
  }
}
