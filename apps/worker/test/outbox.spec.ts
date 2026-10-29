import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  prisma,
  createOutboxEvent,
  fetchPendingOutboxEvents,
  markOutboxEventDelivered,
  recordOutboxEventFailure,
} from '@paw/database';
import { pollAndDispatchOutboxEvents, getOutboxQueue } from '../src/dispatcher';
import { randomUUID } from 'crypto';

describe('Transactional Outbox & BullMQ Dispatcher (Milestone P1-03)', () => {
  const testAggregateId = randomUUID();
  let createdEventId: string;

  beforeAll(async () => {
    // Isolated UUID guarantees clean state without deleting records
  });

  afterAll(async () => {
    const queue = getOutboxQueue();
    await queue.close();
    await prisma.$disconnect();
  });

  it('guarantees atomicity: rolled back transaction does NOT commit outbox event', async () => {
    const rollbackAggregateId = randomUUID();

    try {
      await prisma.$transaction(async (tx) => {
        await createOutboxEvent(tx, {
          aggregateType: 'task',
          aggregateId: rollbackAggregateId,
          eventType: 'task.created.v1',
          payload: { title: 'Doomed Task' },
        });
        throw new Error('Simulated domain exception rolling back transaction');
      });
    } catch {
      // Expected rollback
    }

    const uncommitted = await prisma.outboxEvent.findFirst({
      where: { aggregateId: rollbackAggregateId },
    });
    expect(uncommitted).toBeNull();
  });

  it('successfully persists outbox event within a committed transaction', async () => {
    await prisma.$transaction(async (tx) => {
      const event = await createOutboxEvent(tx, {
        aggregateType: 'task',
        aggregateId: testAggregateId,
        eventType: 'task.created.v1',
        payload: { title: 'Valid Task' },
        traceId: 'test-trace-123',
      });
      createdEventId = event.id;
    });

    expect(createdEventId).toBeDefined();

    const stored = await prisma.outboxEvent.findUnique({
      where: { id: createdEventId },
    });
    expect(stored).not.toBeNull();
    expect(stored?.aggregateId).toBe(testAggregateId);
    expect(stored?.deliveredAt).toBeNull();
    expect(stored?.retryCount).toBe(0);
  });

  it('fetches pending outbox events ordered chronologically', async () => {
    const pending = await fetchPendingOutboxEvents(200);
    expect(pending.length).toBeGreaterThan(0);
    const found = pending.find((e) => e.id === createdEventId);
    expect(found).toBeDefined();
  });

  it('records delivery failure and increments retry count', async () => {
    const updated = await recordOutboxEventFailure(
      createdEventId,
      'Connection timed out to external worker',
    );
    expect(updated.retryCount).toBe(1);
    expect(updated.lastErrorLog).toBe('Connection timed out to external worker');
  });

  it('dispatches pending outbox events to BullMQ with jobId deduplication', async () => {
    const count = await pollAndDispatchOutboxEvents(200);
    expect(count).toBeGreaterThanOrEqual(1);

    const queue = getOutboxQueue();
    const job = await queue.getJob(createdEventId);
    expect(job).toBeDefined();
    expect(job?.id).toBe(createdEventId);
    expect(job?.data.eventType).toBe('task.created.v1');
  });

  it('marks outbox event as delivered', async () => {
    const delivered = await markOutboxEventDelivered(createdEventId);
    expect(delivered.deliveredAt).not.toBeNull();

    // Verify it is no longer returned in pending events
    const pendingAfter = await fetchPendingOutboxEvents(200);
    const found = pendingAfter.find((e) => e.id === createdEventId);
    expect(found).toBeUndefined();
  });
});
