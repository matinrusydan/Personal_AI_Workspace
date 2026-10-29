# FEATURE_FLAGS.md — Proposed Runtime Flags

> **ALL flags here are specifications, NOT implemented or guaranteed env variables.** Owner must approve naming and initial states before implementation. Different from CLI arguments in `COMMANDS_AND_FLAGS.md`.

## Policy
- Single central typed flag registry with `key`, `kind` (`release|ops|experiment`), `default`, `owner`, `dependencies`, `expiry`, `rollout`, `killSwitch`, `audit`.
- Flags evaluated server-side for security or provider permissions. Never trust a client flag as authorization.
- Phase 0: no feature considered active. During release, defaults start false for external integrations until configured; core safe local features enabled once approved.
- Flag state changes logged, audited and rollback documented; stale flags removed per milestone.

| Flag (proposed key) | Default prior to credentials | Meaning | Dependency |
|---|---|---|---|
| `features.tasks.enabled` | false | tasks/projects UI/API | DB/auth ready |
| `features.calendar.googleSync` | false | two-way Google sync | OAuth+sync tests |
| `features.meetings.googleMeet` | false | Google Meet creation | Google adapter |
| `features.meetings.zoom` | false | Zoom creation | Zoom adapter |
| `features.notifications.telegram` | false | Telegram delivery | allowlist/token |
| `features.notifications.webPush` | false | PWA push | VAPID/permission |
| `features.ios.alarmKit` | false | schedule native alarm | compatible iOS & permission & physical-device test |
| `features.ios.alarmFallbackPush` | false | separate fallback channel | push setup |
| `features.reminder.escalation` | false | escalation policy | reminder engine |
| `features.theme.dynamic` | false | custom theme UI | semantic token validation |
| `features.theme.presetSelector` | false | preset themes | design system |
| `features.ai.assistant` | false | NLP assistant | model API & approval gateway P1 |
| `features.ai.codingAgent` | false | Claude Code worker | sandbox + explicit approval P1 |
| `features.workflow.visualBuilder` | false | workflow editor | workflow engine P1 |
| `features.integrations.obsidian` | false | approved vault sync | scope/audit P2 |
| `features.integrations.whatsapp` | false | WhatsApp adapter | provider approval P2 |

## Invariants
Disabling `features.ios.alarmKit` must never silently mark alarms delivered. Disabling integration does not delete historical data. Flag toggles do not bypass audit, auth or approval. Feature flags cannot override release gate, P0 scope, or run destructive migrations. Show disabled features clearly, not as falsely active.

## Proposed operational config flags
- `ops.jobs.enabled`, `ops.calendar.reconciliation.enabled`, `ops.notifications.delivery.enabled` toggled only by authorized operator, with mandatory alert on disable.
- Alert on overdue `reminder_occurrences`, expired sync tokens, failed device synchronization.

## Test matrix
Test each feature off/on; dependency missing; flag removal/migration; API cannot act based only on client toggles; fail-closed auth; persistence unaffected by disable.
