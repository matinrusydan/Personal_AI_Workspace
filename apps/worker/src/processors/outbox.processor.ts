import { Worker, Job } from 'bullmq';
import { getRedisConnection } from '../connection';
import { markOutboxEventDelivered, recordOutboxEventFailure } from '@paw/database';

export interface OutboxJobData {
  outboxId: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  traceId?: string;
}

export function createOutboxWorker() {
  const connection = getRedisConnection();

  const worker = new Worker<OutboxJobData>(
    'outbox-queue',
    async (job: Job<OutboxJobData>) => {
      const { outboxId, eventType, aggregateId } = job.data;
      console.log(
        `[Worker:Outbox] Processing event '${eventType}' for aggregate '${aggregateId}' (job ${job.id})`,
      );

      try {
        // In subsequent milestones, this routes to domain handlers
        // (calendar sync, reminder dispatcher, notification delivery)

        // Mark event as delivered in PostgreSQL authoritative store
        await markOutboxEventDelivered(outboxId);
        console.log(`[Worker:Outbox] Successfully marked outbox event '${outboxId}' as delivered`);

        return { success: true, outboxId };
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown outbox processing error';
        console.error(`[Worker:Outbox] Failed to process event '${outboxId}':`, errorMsg);
        await recordOutboxEventFailure(outboxId, errorMsg);
        throw err;
      }
    },
    {
      connection,
      concurrency: 5,
    },
  );

  worker.on('failed', (job, err) => {
    console.error(`[Worker:Outbox] Job ${job?.id} failed with error: ${err.message}`);
  });

  return worker;
}
