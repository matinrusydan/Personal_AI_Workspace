# EVENT_FLOWS.md — Event Catalog & Sequence Rules

## Event naming
`domain.entity.action.v1`; fields: `eventId`, `occurredAt`, `aggregateId`, `aggregateVersion`, `ownerId`, `traceId`, `payload`, `schemaVersion`. Publish via transactional outbox after DB commit, process at least once. Consumers must be idempotent.

| Event | Producer | Primary consumers |
|---|---|---|
| task.created.v1 / task.updated.v1 | task module | recurrence/reminder, audit |
| calendar.event.created.v1 / .updated.v1 / .canceled.v1 | calendar | sync, conflicts, reminder |
| meeting.provisioning.requested.v1 | meeting | Google/Zoom worker |
| meeting.provisioning.confirmed.v1 / .failed.v1 | integration worker | UI, notify, audit |
| reminder.occurrence.scheduled.v1 | reminder | devices, notification |
| reminder.occurrence.due.v1 | worker | delivery channels |
| reminder.occurrence.acknowledged.v1 / .snoozed.v1 | device/API | escalation, audit |
| device.alarm.schedule.requested.v1 / .reported.v1 | reminder/iOS sync | device status/audit |
| integration.sync.requested.v1 / .completed.v1 / .failed.v1 | webhooks/reconcile | calendar store, alerts |
| approval.requested.v1 / .decided.v1 | AI approval P1 | agent dispatcher |

## Sequence 1 — Manual calendar create
Authenticated UI/CLI/Telegram structured command -> API validation -> conflict check -> DB calendar event `pending` + outbox -> provider worker creates Meet/Zoom -> provider ID/link reconcile -> status confirmed + reminder schedule -> notification. If provider fails, mark failed, show retry/recovery; never report success before confirmation.

## Sequence 2 — External Google edits
Webhook with verified channel -> enqueue sync request -> Google incremental sync token -> map external IDs/etags -> compare source ownership and optimistic version -> update local cache -> reschedule future reminder occurrences -> update client. Token 410 triggers controlled full re-sync; avoid destructive local user data wipes.

## Sequence 3 — Reminder and iOS alarm
Create rule -> persist occurrences -> server desired alarm sync -> iOS app fetches desired state and schedules via AlarmKit after authorization -> device reports `scheduled|failed` -> local alarm runs when supported -> user ack/snooze -> persist + reconcile -> suppress escalation if ack. If device never syncs, fallback Telegram/push policy; fallback is not a native alarm guarantee.

## Sequence 4 — AI request (P1)
User natural language -> model outputs constrained action proposal -> backend validates tool/args/policy -> immutable pending approval -> owner approves specific digest -> re-check authorization and state -> execute via deterministic domain service -> audit & result -> notify. Approval must not authorize a changed payload or broad shell scope.

## Failure & recovery
- Retry temporary 429/5xx with exponential backoff + jitter and provider quota caps.
- External creates: reconcile by request mapping to avoid duplicates after timeout.
- Dead-letter queue and operations alert after retry exhaustion.
- Periodic job reads upcoming occurrences from DB and reconciles BullMQ jobs (Redis resets must not erase reminders).
- Idempotent webhook handling with replay prevention.
- Clock skew and timezone DST regression cases in tests.
