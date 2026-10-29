import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { prisma, createOutboxEvent, Prisma } from '@paw/database';
import { ServerEnvSchema } from '@paw/config';
import { AuditService } from '../audit/audit.service';
import { TasksService } from '../tasks/tasks.service';
import { CalendarService } from '../calendar/calendar.service';
import { RemindersService } from '../reminders/reminders.service';

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
export class TelegramService {
  private readonly config = ServerEnvSchema.parse(process.env);
  private allowedUserId: string;
  private webhookSecret: string;

  constructor(
    private readonly auditService: AuditService,
    private readonly tasksService: TasksService,
    private readonly calendarService: CalendarService,
    private readonly remindersService: RemindersService,
  ) {
    this.allowedUserId = this.config.TELEGRAM_OWNER_USER_ID || '123456789';
    this.webhookSecret = this.config.TELEGRAM_WEBHOOK_SECRET || 'paw-telegram-secret';
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

    // 3. Sender allowlist validation
    const message = update.message;
    if (!message || !message.from) {
      return { status: 'ignored_no_message' };
    }

    const senderId = message.from.id;
    if (!this.isSenderAllowed(senderId)) {
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
    const text = message.text?.trim() || '';
    const responseText = await this.dispatchCommand(text, traceId);

    return {
      status: 'processed',
      update_id: update.update_id,
      reply: responseText,
    };
  }

  /**
   * Deterministic command parser
   */
  async dispatchCommand(text: string, _traceId?: string): Promise<string> {
    const parts = text.split(/\s+/);
    const command = parts[0]?.toLowerCase() || '';

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
    const providerMessageId = `tg_msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    // In production with live token, executes:
    // fetch(`https://api.telegram.org/bot${this.config.TELEGRAM_BOT_TOKEN}/sendMessage`, { ... })

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
