import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@paw/database';
import { TelegramService, TelegramUpdate } from '../src/modules/telegram/telegram.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { TasksService } from '../src/modules/tasks/tasks.service';
import { CalendarService } from '../src/modules/calendar/calendar.service';
import { RemindersService } from '../src/modules/reminders/reminders.service';
import { randomUUID } from 'crypto';

describe('Telegram Gateway & Allowlist Verification (Milestone P3-02)', () => {
  let telegramService: TelegramService;
  let auditService: AuditService;
  let tasksService: TasksService;
  let calendarService: CalendarService;
  let remindersService: RemindersService;

  const testOwnerId = randomUUID();
  const allowedTelegramId = '987654321';
  const unauthorizedTelegramId = '666666666';
  const testSecretToken = 'test-secret-token-xyz';

  beforeAll(async () => {
    auditService = new AuditService();
    tasksService = new TasksService(auditService);
    calendarService = new CalendarService(auditService);
    remindersService = new RemindersService(auditService);

    telegramService = new TelegramService(
      auditService,
      tasksService,
      calendarService,
      remindersService,
    );

    telegramService.setAllowedUserId(allowedTelegramId);
    telegramService.setWebhookSecret(testSecretToken);

    // Create test user
    await prisma.user.create({
      data: {
        id: testOwnerId,
        email: `test-tg-owner-${Date.now()}@example.com`,
        passwordHash: 'hash',
        passwordSalt: 'salt',
      },
    });

    // Create a sample task
    await prisma.task.create({
      data: {
        ownerId: testOwnerId,
        title: 'Telegram Task Checklist',
        status: 'todo',
        priority: 'high',
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Webhook Security & Secret Token', () => {
    it('rejects webhook requests with invalid or missing secret token', async () => {
      const update: TelegramUpdate = {
        update_id: 1001,
        message: {
          message_id: 1,
          from: { id: parseInt(allowedTelegramId, 10), is_bot: false, first_name: 'Owner' },
          chat: { id: parseInt(allowedTelegramId, 10), type: 'private' },
          date: Math.floor(Date.now() / 1000),
          text: '/start',
        },
      };

      await expect(telegramService.handleWebhookUpdate(update, 'wrong-secret')).rejects.toThrow(
        'Invalid or missing Telegram webhook secret token',
      );
    });

    it('deduplicates incoming updates by update_id', async () => {
      const uniqueUpdateId = Math.floor(Math.random() * 800000000) + 1000000;
      const update: TelegramUpdate = {
        update_id: uniqueUpdateId,
        message: {
          message_id: 2,
          from: { id: parseInt(allowedTelegramId, 10), is_bot: false, first_name: 'Owner' },
          chat: { id: parseInt(allowedTelegramId, 10), type: 'private' },
          date: Math.floor(Date.now() / 1000),
          text: '/start',
        },
      };

      // First call processes
      const first = await telegramService.handleWebhookUpdate(update, testSecretToken);
      expect(first.status).toBe('processed');

      // Second call with same update_id is deduplicated
      const second = await telegramService.handleWebhookUpdate(update, testSecretToken);
      expect(second.status).toBe('deduplicated');
    });
  });

  describe('Numeric Allowlist Enforcement (docs/SECURITY.md)', () => {
    it('rejects updates from unauthorized stranger user ID', async () => {
      const uniqueUpdateId = Math.floor(Math.random() * 800000000) + 2000000;
      const update: TelegramUpdate = {
        update_id: uniqueUpdateId,
        message: {
          message_id: 3,
          from: { id: parseInt(unauthorizedTelegramId, 10), is_bot: false, first_name: 'Stranger' },
          chat: { id: parseInt(unauthorizedTelegramId, 10), type: 'private' },
          date: Math.floor(Date.now() / 1000),
          text: '/tasks',
        },
      };

      const res = await telegramService.handleWebhookUpdate(update, testSecretToken);
      expect(res.status).toBe('rejected_unauthorized_sender');
    });

    it('processes commands from authorized owner numeric ID', async () => {
      const uniqueUpdateId = Math.floor(Math.random() * 800000000) + 3000000;
      const update: TelegramUpdate = {
        update_id: uniqueUpdateId,
        message: {
          message_id: 4,
          from: { id: parseInt(allowedTelegramId, 10), is_bot: false, first_name: 'Owner' },
          chat: { id: parseInt(allowedTelegramId, 10), type: 'private' },
          date: Math.floor(Date.now() / 1000),
          text: '/start',
        },
      };

      const res = await telegramService.handleWebhookUpdate(update, testSecretToken);
      expect(res.status).toBe('processed');
      expect(res.reply).toContain('Halo Owner!');
    });

    it('responds to /tasks command with active tasks', async () => {
      const uniqueUpdateId = Math.floor(Math.random() * 800000000) + 4000000;
      const update: TelegramUpdate = {
        update_id: uniqueUpdateId,
        message: {
          message_id: 5,
          from: { id: parseInt(allowedTelegramId, 10), is_bot: false, first_name: 'Owner' },
          chat: { id: parseInt(allowedTelegramId, 10), type: 'private' },
          date: Math.floor(Date.now() / 1000),
          text: '/tasks',
        },
      };

      const res = await telegramService.handleWebhookUpdate(update, testSecretToken);
      expect(res.status).toBe('processed');
      expect(res.reply).toContain('Active Tasks');
      expect(res.reply).toContain('Telegram Task Checklist');
    });
  });

  describe('Outgoing Notification Delivery', () => {
    it('dispatches notification and records NotificationDelivery with deduplicated ID', async () => {
      // Create a dummy reminder occurrence for testing delivery record
      const task = await prisma.task.create({
        data: {
          ownerId: testOwnerId,
          title: 'Notification Test Task',
          dueAt: new Date(),
          status: 'todo',
        },
      });

      const rule = await remindersService.createReminderRule(testOwnerId, {
        sourceType: 'task',
        sourceId: task.id,
        offsetMinutes: 0,
      });

      const deliveryRes = await telegramService.sendNotification({
        occurrenceId: rule.data.occurrenceId,
        recipientChatId: allowedTelegramId,
        text: '⏰ Reminder: Task with deadline is due now!',
      });

      expect(deliveryRes.success).toBe(true);
      expect(deliveryRes.providerMessageId).toBeDefined();

      // Verify record in PostgreSQL notification_deliveries
      const delivery = await prisma.notificationDelivery.findFirst({
        where: {
          occurrenceId: rule.data.occurrenceId,
          channel: 'telegram',
        },
      });

      expect(delivery).not.toBeNull();
      expect(delivery?.status).toBe('sent');
      expect(delivery?.recipientRef).toBe(allowedTelegramId);
    });
  });
});
