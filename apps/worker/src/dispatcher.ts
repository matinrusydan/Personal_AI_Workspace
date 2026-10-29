import { Queue } from 'bullmq';
import { getRedisConnection } from './connection';
import { fetchPendingOutboxEvents } from '@paw/database';
import { OutboxJobData } from './processors/outbox.processor';

let outboxQueueInstance: Queue<OutboxJobData> | undefined;

export function getOutboxQueue(): Queue<OutboxJobData> {
  if (!outboxQueueInstance) {
    outboxQueueInstance = new Queue<OutboxJobData>('outbox-queue', {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    });
  }
  return outboxQueueInstance;
}

/**
 * Polls PostgreSQL for pending outbox events and pushes them into BullMQ queue.
 * Idempotency is preserved by setting jobId to outbox.id.
 */
export async function pollAndDispatchOutboxEvents(batchSize = 25): Promise<number> {
  const pendingEvents = await fetchPendingOutboxEvents(batchSize);
  if (pendingEvents.length === 0) {
    return 0;
  }

  const queue = getOutboxQueue();
  let dispatchedCount = 0;

  for (const event of pendingEvents) {
    const jobData: OutboxJobData = {
      outboxId: event.id,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      eventType: event.eventType,
      payload: event.payload as Record<string, unknown>,
      traceId: event.traceId ?? undefined,
    };

    // Use event.id as BullMQ jobId for strict deduplication
    await queue.add(event.eventType, jobData, {
      jobId: event.id,
    });
    dispatchedCount++;
  }

  return dispatchedCount;
}
