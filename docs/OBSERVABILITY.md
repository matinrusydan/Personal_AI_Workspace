# OBSERVABILITY.md — Logs, Metrics, Alerts, Runbooks

## Principles
End-to-end correlation IDs, structured logs with sensitive field redaction, metrics designed around user reliability, operational audit separate from application logs. Retention and access are explicit, not infinite.

## Essential metrics
- `api_request_duration_seconds`, `api_error_total` (by route/status, not PII).
- `outbox_oldest_pending_seconds`, `queue_job_retries_total`, `queue_dead_letter_count`.
- `reminders_due_total`, `reminders_attempted_on_time_total`, `reminder_overdue_count`.
- `alarm_device_sync_lag_seconds`, `alarm_schedule_success_total`, `alarm_schedule_failed_total` (not equivalent to audible delivery).
- `calendar_sync_success_total`, `calendar_sync_last_success_timestamp`, `provider_http_429_total`.
- `meetings_provisioning_failures_total`, `meeting_duplicate_prevented_total`.
- `approval_unauthorized_attempt_total`, `oauth_refresh_failures_total`, `backup_last_verified_restore_timestamp`.
- P1 AI tokens/cost/timeouts, coding worker runs, rejected tool calls.

## Alerts
- Critical: overdue important reminder unsent, no worker heartbeat, backup/restore health lost, attempted policy bypass.
- Warning: provider sync stalled, OAuth expired, device alarms unsynced, queue DLQ rising, disk near full.
- No unaudited automatic repair with root privileges. Alert destination can be Telegram to owner but must avoid secrets.

## Runbook checklist
Capture trace ID -> classify user-impact -> inspect redacted logs -> check provider status and queue -> isolate failure/retry idempotently -> notify owner -> postmortem + ADR if architectural change.

## Dashboards
Availability/success, Calendar provider sync, Reminders due/delivered/acked, Alarm device readiness, Integration health, Security events, VPS resource usage. Every dashboard clarifies `attempted`, `accepted`, `delivered`, `scheduled`, and `acknowledged` differences.
