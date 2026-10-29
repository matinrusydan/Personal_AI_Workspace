import 'dotenv/config';
import { createOutboxWorker } from './processors/outbox.processor';
import { pollAndDispatchOutboxEvents } from './dispatcher';

async function bootstrap() {
  console.log('[Worker] Starting Personal AI Workspace Worker service...');

  // Start BullMQ outbox worker
  const worker = createOutboxWorker();
  console.log('[Worker] Outbox BullMQ worker listening on "outbox-queue"');

  // Start outbox polling loop (every 3 seconds)
  const pollInterval = setInterval(async () => {
    try {
      const dispatched = await pollAndDispatchOutboxEvents(25);
      if (dispatched > 0) {
        console.log(`[Worker:Dispatcher] Dispatched ${dispatched} pending outbox events to BullMQ`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Worker:Dispatcher] Error during outbox polling:', msg);
    }
  }, 3000);

  // Graceful shutdown handling
  const shutdown = async () => {
    console.log('[Worker] Shutting down gracefully...');
    clearInterval(pollInterval);
    await worker.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((err) => {
  console.error('[Worker] Fatal error during bootstrap:', err);
  process.exit(1);
});
