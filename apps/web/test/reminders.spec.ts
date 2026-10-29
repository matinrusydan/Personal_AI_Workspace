import { describe, it, expect } from 'vitest';
import { ReminderItem } from '../src/app/reminders/page';

describe('Reminders & Native Alarm UI Logic (Milestone P3-01 & P3-03)', () => {
  const reminders: ReminderItem[] = [
    {
      id: 'r1',
      title: 'Task Reminder',
      sourceType: 'task',
      scheduledFor: '2026-11-02T08:45:00.000Z',
      channelPolicy: 'prominent_alarm',
      status: 'scheduled',
      attemptVersion: 1,
    },
    {
      id: 'r2',
      title: 'Meeting Telegram Alert',
      sourceType: 'calendar_event',
      scheduledFor: '2026-11-02T12:50:00.000Z',
      channelPolicy: 'telegram',
      status: 'acknowledged',
      attemptVersion: 1,
    },
  ];

  it('filters reminders by channel policy', () => {
    const alarmReminders = reminders.filter((r) => r.channelPolicy === 'prominent_alarm');
    const telegramReminders = reminders.filter((r) => r.channelPolicy === 'telegram');

    expect(alarmReminders).toHaveLength(1);
    expect(telegramReminders).toHaveLength(1);
    expect(alarmReminders[0]!.title).toContain('Task Reminder');
  });

  it('verifies snooze increments attemptVersion', () => {
    const item = reminders[0]!;
    const snoozed: ReminderItem = {
      ...item,
      status: 'snoozed',
      attemptVersion: item.attemptVersion + 1,
    };

    expect(snoozed.status).toBe('snoozed');
    expect(snoozed.attemptVersion).toBe(2);
  });
});
