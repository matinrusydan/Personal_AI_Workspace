# API_CONTRACTS.md — REST / Webhooks v1 (Proposed)

## Conventions
Prefix `/api/v1`; JSON UTF-8; UUID IDs; ISO8601 UTC for instants, explicit `timezone` IANA for UI/recurrence; `Idempotency-Key` on creates and external side effects; `If-Match` or entity `version` for concurrent updates. Response `{data,meta}` and error `{error:{code,message,details,traceId}}`. 401 auth, 403 denied, 409 conflict/stale, 422 validation, 429 rate-limited. Detailed schema to be checked before coding.

## Endpoints P0
| Verb | Endpoint | Permission / operation |
|---|---|---|
| POST | /auth/login | begin owner auth |
| POST | /auth/mfa/verify | finalize MFA |
| POST | /auth/logout | revoke session |
| GET | /me | owner preferences |
| GET/POST | /projects | list/create |
| GET/POST | /tasks | filters/list/create |
| GET/PATCH/DELETE | /tasks/{id} | read/edit/archive |
| GET/POST | /calendars | list/config |
| GET/POST | /calendar/events | list/create event |
| PATCH/DELETE | /calendar/events/{id} | update/cancel |
| POST | /meetings | provider create async |
| GET | /meetings/{id} | status and join_url when confirmed |
| GET | /calendar/conflicts | time overlap query |
| GET | /integrations | connected account states |
| POST | /integrations/{provider}/connect | OAuth start (server-generated state/PKCE) |
| GET | /integrations/{provider}/callback | OAuth code callback |
| POST | /integrations/{provider}/disconnect | revoke credential |
| GET/POST | /reminders | list/create |
| POST | /reminders/{id}/snooze | idempotent snooze |
| POST | /reminders/{id}/acknowledge | idempotent acknowledge |
| POST | /devices/register | enroll device |
| GET | /devices/alarms | desired alarm state sync delta |
| POST | /devices/alarms/{id}/status | local schedule result |
| POST | /notifications/test | opt-in test channel |
| GET | /audit-logs | owner filtered audit (redacted) |
| GET/PATCH | /preferences/theme | design system choice |

## External webhook endpoints
- `POST /webhooks/google/calendar`: channel/resource verification, enqueue incremental sync, do not treat webhook as full payload.
- `POST /webhooks/zoom`: signature/timestamp validation, idempotency, challenge/verification per current Zoom docs.
- `POST /webhooks/telegram`: verify secret token + allowlisted sender ID + dedupe update ID.
- Never expose admin/approval internals directly via a public unsigned webhook.

## P1 endpoints (NOT IN MVP)
- `POST /ai/proposals` create structured tool proposal; `GET /approvals`; `POST /approvals/{id}/decision`; `POST /agents/coding-runs` creates approved, sandboxed worker request; `GET /agents/coding-runs/{id}`.
- All state-changing AI proposals need approval, immutable argument digest, expiry and revalidation.

## Example: meeting create
```json
{
  "provider": "zoom",
  "title": "Review Project",
  "startsAt": "2026-10-30T02:00:00Z",
  "endsAt": "2026-10-30T03:00:00Z",
  "timezone": "Asia/Jakarta",
  "calendarId": "uuid",
  "reminderOffsetsMinutes": [60, 10]
}
```
`202 Accepted` example: `{"data":{"id":"uuid","status":"provisioning","joinUrl":null}}`. Later status `confirmed|failed`. Use request idempotency and reconcile third-party result.

## Example: reminder ack
`POST /api/v1/reminders/{id}/acknowledge` with body `{"occurrenceId":"uuid","clientRequestId":"uuid","deviceId":"uuid"}`. Duplicate client request returns original logical outcome.

## Spec governance
OpenAPI is canonical once implementation begins; generate TS and Swift SDK, keep contract tests and API versioning. Until then, the table is *proposed* and no endpoint should be assumed active.
