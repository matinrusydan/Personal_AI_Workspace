# INTEGRATIONS.md — Provider Adapter Contracts

## Provider design principles
Each external adapter exposes capabilities, OAuth connect/disconnect, health, rate-limit handling, mapping, reconciliation and structured errors. Backend is owner of secrets; no client gets refresh token. Default disabled until configured and tested. Use fake adapters in test.

## Google Calendar + Google Meet (P0)
- Authorization Code OAuth and minimum scopes; account/calendar write access mandatory.
- Calendar initial full sync -> `nextSyncToken`; incremental sync, stable query params, handle HTTP 410 invalidation by resync without losing local-only data.
- Push channels are expiring subscriptions; validate channel ID, resource ID and secret token; renew before expiry, use polling/reconciliation if webhook missed.
- Create Meet via event `conferenceData.createRequest` and `conferenceDataVersion=1`; creation may return pending, poll until confirmed/failed.
- Deletion/updates require ETag/concurrency conflict handling. Deduplicate by external IDs and idempotency; do not write a new meeting if provider call timed out without reconciliation.
- Permission and support of conference solution depends on the calendar/account. Always test actual account.

## Zoom Meetings (P0)
- Choose compliant Zoom OAuth app type and minimum meeting scopes; respect account restrictions and rate limits, check current developer docs.
- `POST /users/{userId}/meetings` with authenticated host (user-level can use `me`) after OAuth. Keep external meeting ID + joining URL; host `start_url` sensitive/short-lived, do not surface indiscriminately.
- Handle provider rate-limit, revoked tokens, pending/confirmed/failed creation, cancellations and optional webhook verification.
- Event in Google Calendar that includes Zoom link and Zoom meeting object are related but **not equivalent**; choose canonical event ownership and reconcile both.

## Telegram Bot (P0)
- Use Telegram Bot API; webhook over HTTPS or polling in local dev, only one source consumes updates.
- Hard allowlist numeric Telegram user ID + verify update origins/secret webhook header where used. No admin operations from group channels by default.
- Deterministic commands first: task create/list/complete, calendar view, reminder ack/snooze, meeting create; NLP only P1 behind approval.
- Dedupe incoming `update_id`; avoid echoing tokens or private meeting URLs in public chats.

## APNs + iOS device (P0)
- Device token registration and rotation; APNs push is supplemental, not native scheduled alarm.
- Device can be offline, token revoked or permission denied; backend reports uncertain delivery status honestly. Native alarm scheduling must be confirmed by client.

## Later adapters (P2)
- Gmail, Google Drive: minimum OAuth scopes; explicit content import approval.
- GitHub: least-privilege installation/workflow; coding worker creates PR; no direct prod branch push.
- Obsidian: user-approved directories only; Markdown memory is not system-of-record; protect secrets; opt-in RAG.
- WhatsApp: vendor official API/business approval and costs; not assume personal WhatsApp arbitrary bot supported.
- Home Assistant/IoT: LAN/private connector, constrained services, explicit confirmation for physical actions.

## Contract proposal
`ProviderAdapter`: `capabilities()`, `connect()`, `refreshToken()`, `createMeeting()`, `updateMeeting()`, `cancelMeeting()`, `syncChanges(cursor)`, `health()`, errors `{provider,kind,retryable,correlationId}`. Adapter-specific methods allowed; avoid giant interface requiring unrelated providers.

## Operational checklist
Provider credential owner, callback URL, scopes, event mapping, retry policy, quota, revocation, incident handling, test account and sandbox plan. Sources in `REFERENCES.md`.
