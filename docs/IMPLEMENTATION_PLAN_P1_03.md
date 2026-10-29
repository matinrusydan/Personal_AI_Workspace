# Implementation Plan — Milestone P1-03: PostgreSQL Migrations, Redis/BullMQ, & Outbox

## Mode and approvals
- **Current mode:** PLANNING ONLY until explicit owner permission to execute.
- **Approval scope:** Milestone P1-03 only (Database Schema Migrations, Prisma ORM, Redis/BullMQ Job Queue, Transactional Outbox Pattern, and Worker Application Scaffolding).
- **Subsequent milestones (P1-04 onwards):** Strictly require separate, subsequent approval.

## Preflight evidence
- **Documents read:** `AGENTS.md`, `CLAUDE.md`, `PRD.md`, `TASK.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/EVENT_FLOWS.md`, `docs/SECURITY.md`, `docs/ADR.md` (ADR-002: PostgreSQL authoritative, ADR-003: Redis/BullMQ delayed jobs, ADR-004: Transactional outbox), `packages/config/src/env.schema.ts`.
- **Environment verified:** Node.js v22.16.0, pnpm v10.15.1, Git, `docker-compose.yml` and `.env.example` created.
- **Prerequisite for Execution:** Docker Desktop running on Windows 11 with PostgreSQL (`127.0.0.1:5432`) and Redis (`127.0.0.1:6379`) containers active via `docker compose up -d`.

## Deliverables
1. **Prisma ORM & Migration Engine (`packages/database`):**
   - Full Prisma schema (`packages/database/prisma/schema.prisma`) modeling all core entities from `docs/DATA_MODEL.md`:
     - Identity: `User`, `Authenticator`, `Session`, `Device`, `PushToken`
     - Tasks: `Project`, `Task`, `Tag`, `TaskTag`, `RecurrenceRule`
     - Calendar & Meetings: `Calendar`, `CalendarEvent`, `Meeting`, `ConnectedAccount`, `SyncCursor`
     - Reminders & Native Alarms: `ReminderRule`, `ReminderOccurrence`, `DeviceAlarm`, `AlarmAcknowledgment`, `NotificationDelivery`
     - Reliability & Consistency: `WebhookInbox`, `OutboxEvent`, `IdempotencyKey`
     - Governance & Auditing: `ApprovalRequest`, `ApprovalDecision`, `AuditLog`
   - Migration script generation (`prisma migrate dev`) creating initial relational schema with composite indexes and constraints.
   - Type-safe Prisma Client exports for use in `apps/api` and `apps/worker`.
2. **Transactional Outbox Service (`packages/database` & `apps/api`):**
   - Atomic unit of work helper ensuring domain state changes and `OutboxEvent` records commit within the same PostgreSQL transaction (`$transaction`).
   - Outbox event schema conforming to `docs/EVENT_FLOWS.md` (`domain.entity.action.v1`).
3. **Worker Application (`apps/worker`):**
   - Monorepo package `apps/worker` initialized with BullMQ and Redis connection.
   - Outbox publisher job polling unpublished `outbox_events` and enqueuing them to BullMQ queues.
   - Idempotent consumer worker architecture with retry policies and dead-letter queue handling.
4. **Integration of Prisma with `apps/api`:**
   - Connect `apps/api` AuthModule and DevicesModule to real PostgreSQL database repositories, replacing in-memory mocks.

## Design approach / ADR alignment
- **ADR-002 (PostgreSQL Authoritative):** PostgreSQL is the single source of truth; all foreign keys, cascades, and version counters (`version`, `optimistic concurrency`) strictly enforced.
- **ADR-003 (Redis + BullMQ Delayed Jobs):** BullMQ handles asynchronous worker orchestration; schedules reconcile against PostgreSQL.
- **ADR-004 (Transactional Outbox):** No event is emitted to Redis/BullMQ without being durably committed to the `outbox_events` table in PostgreSQL first.

## Files to be created / modified
```text
docker-compose.yml (created)
.env.example (created)
.env (to be copied from .env.example)
packages/
  database/
    package.json (add prisma, @prisma/client)
    prisma/
      schema.prisma
      migrations/
    src/
      client.ts
      outbox.ts
      index.ts
apps/
  worker/
    package.json
    tsconfig.json
    src/
      main.ts
      queues/
      processors/
        outbox.processor.ts
  api/
    src/modules/auth/auth.service.ts (connect to Prisma)
    src/modules/devices/devices.service.ts (connect to Prisma)
```

## Validation & Test Plan
1. **Container Health:** Run `docker compose up -d`; verify `pg_isready` and `redis-cli ping` return healthy status.
2. **Migration Execution:** Run `pnpm --filter @paw/database prisma migrate dev --name init`; verify all 26 tables and indexes are created in PostgreSQL.
3. **Outbox Atomicity Test:** Test creating an entity alongside an outbox event; verify that rolling back the transaction prevents outbox event insertion.
4. **BullMQ Worker Test:** Verify worker process consumes outbox event, logs execution, and marks `delivered_at` timestamp.
5. **API Test Suite:** Re-run `pnpm --filter @paw/api test`; ensure all 13 tests pass with real database repository transactions.
6. **Lint & Typecheck:** `pnpm run lint` and `pnpm run typecheck` pass across all workspace projects.

## Security / secrets / rollback / costs
- **Zero Secrets:** Default dev credentials (`postgres/postgres`) strictly bound to `127.0.0.1` only.
- **Cost:** $0 (Local execution).
- **Rollback Strategy:** `docker compose down -v` drops local database; Prisma migration rollback via `prisma migrate reset`.

## Go / No-Go
- [ ] Owner authorizes exact scope of Milestone P1-03.
- [ ] Docker Desktop installed and running on Windows 11.
- [ ] Database containers healthy (`docker compose ps`).
