import { Prisma, PrismaClient } from '@prisma/client';
import { getPrismaClient } from './client';

export interface OutboxPayload {
  aggregateType: string;
  aggregateId: string;
  eventType: string; // e.g., 'task.created.v1', 'reminder.occurrence.scheduled.v1'
  payload: Record<string, unknown>;
  traceId?: string;
}

/**
 * Creates an outbox event within an existing database transaction,
 * ensuring atomic persistence alongside business domain entities.
 */
export async function createOutboxEvent(tx: Prisma.TransactionClient, event: OutboxPayload) {
  return tx.outboxEvent.create({
    data: {
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      eventType: event.eventType,
      payload: event.payload as Prisma.InputJsonValue,
      traceId: event.traceId,
    },
  });
}

/**
 * Fetches pending outbox events that have not been delivered yet,
 * ordered chronologically.
 */
export async function fetchPendingOutboxEvents(limit = 50, client?: PrismaClient) {
  const db = client ?? getPrismaClient();
  return db.outboxEvent.findMany({
    where: {
      deliveredAt: null,
      retryCount: {
        lt: 5,
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
    take: limit,
  });
}

/**
 * Marks an outbox event as delivered.
 */
export async function markOutboxEventDelivered(id: string, client?: PrismaClient) {
  const db = client ?? getPrismaClient();
  return db.outboxEvent.update({
    where: { id },
    data: {
      deliveredAt: new Date(),
    },
  });
}

/**
 * Records a delivery failure attempt for an outbox event.
 */
export async function recordOutboxEventFailure(
  id: string,
  errorLog: string,
  client?: PrismaClient,
) {
  const db = client ?? getPrismaClient();
  return db.outboxEvent.update({
    where: { id },
    data: {
      retryCount: {
        increment: 1,
      },
      lastErrorLog: errorLog,
    },
  });
}
