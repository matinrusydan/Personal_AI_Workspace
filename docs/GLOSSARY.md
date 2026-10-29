# GLOSSARY.md

- **MVP:** minimum viable product; in this project native AlarmKit + Meet AND Zoom are required.
- **P0/P1/P2:** mandatory MVP / post-MVP agent workflow / later integrations.
- **Owner:** single end user with privileged access.
- **System of record:** authoritative database (PostgreSQL).
- **Transactional outbox:** persisted event stored in same transaction as business change.
- **Idempotency:** repeated request produces same logical effect, avoids duplicate meeting/reminder.
- **Reconciliation:** periodic comparison external provider or queue with authoritative state.
- **APNs:** Apple Push Notification service; not interchangeable with local native alarm.
- **AlarmKit:** Apple framework for supported native alarms and timers.
- **PWA:** installable web application with web platform limits.
- **ADR:** architecture decision record, owner-reviewed change log.
- **Design token:** stable design-system variable, e.g. background surface/text color/spacing.
- **Semantic token:** role-based UI variable that varies by theme/mode.
- **Feature flag:** runtime switch for staged rollout, not a substitute for permission.
- **CLI flag:** argument to command invocation; not necessarily implemented.
- **Approval gateway:** deterministic service enforcing owner approval of AI-originated mutations.
- **Coding worker:** isolated Claude Code environment for PR/test, not a production root shell.
