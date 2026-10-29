# Implementation Plan — Milestone P3-01: Persistent Reminders, Recovery, & Escalation Engine

## Mode and approvals
- **Current mode:** APPROVED IMPLEMENTATION (Phase 3 authorized by owner).
- **Approval scope:** Milestone P3-01 (Reminder Rules, Occurrences, Idempotent Ack/Snooze, Outbox Events, Recovery Scheduler, and Escalation Engine).

## Deliverables
1. **Reminders Module (`apps/api`):**
   - `RemindersService` & `RemindersController`
   - `POST /api/v1/reminders`: Create reminder rule linked to task or calendar event.
   - `GET /api/v1/reminders`: List rules and due occurrences.
   - `POST /api/v1/reminders/:id/acknowledge`: Idempotent acknowledgment using `clientRequestId`.
   - `POST /api/v1/reminders/:id/snooze`: Idempotent snooze rescheduling occurrence.
   - `DELETE /api/v1/reminders/:id`: Cancel rule and future occurrences.
2. **Transactional Outbox Events:**
   - `reminder.occurrence.scheduled.v1`
   - `reminder.occurrence.due.v1`
   - `reminder.occurrence.acknowledged.v1`
   - `reminder.occurrence.snoozed.v1`
3. **Recovery & Escalation Processor (`apps/worker`):**
   - Recurring recovery sweep polling PostgreSQL for unhandled/stuck occurrences and enqueuing to BullMQ.
   - Escalation check: triggers escalation outbox event if occurrence is unacknowledged past deadline.
4. **Automated Vitest Tests:**
   - Unit and integration tests in `apps/api/test/reminders.spec.ts` and `apps/worker/test/reminders.spec.ts`.
