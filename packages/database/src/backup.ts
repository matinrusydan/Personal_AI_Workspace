import { PrismaClient, getPrismaClient } from './client';
import { createHash } from 'crypto';

export interface DatabaseSnapshot {
  version: string;
  exportedAt: string;
  checksum: string;
  data: {
    users: unknown[];
    projects: unknown[];
    tasks: unknown[];
    calendars: unknown[];
    calendarEvents: unknown[];
    meetings: unknown[];
    reminderRules: unknown[];
    reminderOccurrences: unknown[];
    auditLogs: unknown[];
  };
}

/**
 * Exports a consistent JSON snapshot of all data belonging to an owner.
 */
export async function exportDatabaseSnapshot(
  ownerId: string,
  client?: PrismaClient,
): Promise<DatabaseSnapshot> {
  const db = client ?? getPrismaClient();

  const [
    users,
    projects,
    tasks,
    calendars,
    calendarEvents,
    meetings,
    reminderRules,
    reminderOccurrences,
    auditLogs,
  ] = await Promise.all([
    db.user.findMany({ where: { id: ownerId } }),
    db.project.findMany({ where: { ownerId } }),
    db.task.findMany({ where: { ownerId } }),
    db.calendar.findMany({ where: { ownerId } }),
    db.calendarEvent.findMany({ where: { ownerId } }),
    db.meeting.findMany({ where: { ownerId } }),
    db.reminderRule.findMany({ where: { ownerId } }),
    db.reminderOccurrence.findMany({ where: { rule: { ownerId } } }),
    db.auditLog.findMany({ where: { actorId: ownerId }, take: 100 }),
  ]);

  const rawData = {
    users,
    projects,
    tasks,
    calendars,
    calendarEvents,
    meetings,
    reminderRules,
    reminderOccurrences,
    auditLogs,
  };

  const payloadString = JSON.stringify(rawData);
  const checksum = createHash('sha256').update(payloadString).digest('hex');

  return {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    checksum,
    data: rawData,
  };
}

/**
 * Validates integrity of a snapshot before restoring.
 */
export function verifySnapshotChecksum(snapshot: DatabaseSnapshot): boolean {
  const payloadString = JSON.stringify(snapshot.data);
  const expected = createHash('sha256').update(payloadString).digest('hex');
  return expected === snapshot.checksum;
}
