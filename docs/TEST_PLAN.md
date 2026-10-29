# TEST_PLAN.md — Acceptance & QA Evidence

## Test pyramid
- Unit: validation, recurrence, timezone conversions, conflict detection, theme token resolver, approval policies.
- Integration: PostgreSQL transaction/outbox; Redis/BullMQ recover/retry, provider adapters mocks, OAuth states, webhook signature/replay.
- Contract: OpenAPI clients TS + Swift and provider payload fixtures.
- E2E: web/task/meeting/reminder/Telegram/CLI flows with staging provider.
- Physical device: real iPhone AlarmKit, authorization, screen locked, offline, silent/Focus, app terminated, reboot.
- Security: MFA, IDOR, token leak, prompt injection and approval tamper/replay.
- Recovery: worker restart, DB restore, Redis loss, expired Google sync token, provider timeouts.

## MVP acceptance criteria
| ID | Evidence required |
|---|---|
| AC-01 | MFA login and session revocation demonstrably work |
| AC-02 | Task from web visible via CLI/Telegram and vice versa |
| AC-03 | Google Calendar edits flow both directions, with conflict recovery |
| AC-04 | Real Google Meet created, stable external ID and join URL confirmed |
| AC-05 | Real Zoom meeting created, status/link reliable and API quota handled |
| AC-06 | Conflict detection across multiple events/timezones |
| AC-07 | Reminder survives API/worker/Redis restart without duplication/loss |
| AC-08 | Native AlarmKit physical-device tests meet owner-approved alarm behavior incl offline |
| AC-09 | Snooze and ack device->backend->other clients reconcile safely |
| AC-10 | Escalation triggers only when no accepted acknowledgment |
| AC-11 | All AI mutations blocked until explicit approval (P1 gate, not P0) |
| AC-12 | Expired/replayed/tampered approval rejected (P1 gate) |
| AC-13 | Tokens absent from client payload and app logs |
| AC-14 | Encrypted off-host backup restored successfully |
| AC-15 | Task/calendar/reminder functions during AI outage |
| AC-16 | Release/rollback rehearsal and runbook adequate for launch |
| AC-17 | Theme persists light/dark/system/custom and passes contrast/keyboard tests |
| AC-18 | Feature flags off states fail-safe, no unintended side effects |

## Native alarm test matrix fields
Device model, OS build, AlarmKit permission status, Focus/silent state, app state, network state, alarm type/timezone, expected vs actual sound/UI, acknowledged/snoozed, sync confirmation and evidence ref. Logs alone do not prove audible alarm; observer confirms.

## Stress/failure cases
- Duplicate Google webhook, Zoom timeout after commit, expired OAuth token, incremental sync 410, device clock drift, same-id retry, network offline while alarm due, DST ambiguous local time, deleting recurring series mid-schedule.
- Theme custom contrast invalid, reduced-motion preference, large text dynamic type and mobile navigation keyboard.
- Agent prompt attempts 'ignore policy' and changed payload after approval.

## Definition of Done
Requirements + tests + docs + review + rollback + evidence links. A test listed but not run = NOT VERIFIED. A P0 requirement blocked = MVP NOT COMPLETE.
