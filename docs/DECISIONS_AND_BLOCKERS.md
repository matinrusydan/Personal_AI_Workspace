# DECISIONS_AND_BLOCKERS.md — Baseline & Go/No-Go

## Locked by owner (2026-10-29)
| Decision | Chosen |
|---|---|
| Users | single owner, future-ready schema |
| Core | Next.js + NestJS + PostgreSQL |
| Jobs | Redis/BullMQ |
| Deployment | local first, VPS later (target 4 vCPU/8 GB) |
| Access | public HTTPS + MFA, private admin surface |
| MVP | tasks/projects, calendar/Google two-way, Meet AND Zoom, dashboard, Telegram, iOS **native alarm** |
| AI | Claude Code for coding + backend AI assistant (P1) |
| AI actions | approval required for ALL AI-initiated mutations, manual actions not subject to extra AI approval |
| Extensibility | modular core + plugins + workflows |
| Design | modern custom, dynamic design system light/dark, user customization |
| Memory later | DB + Obsidian + RAG |
| Budget | undetermined |

## Explicit constraints
Native alarm from MVP is non-negotiable without new owner approval. Generic push notification cannot be silently substituted. Meet/Zoom both must work in MVP. Agent must not code until Phase 0 validated + approval.

## Blockers / unanswered
- iOS version targets, actual device/OS capabilities; AlarmKit authorization, background/offline & alarm semantics; user install/distribution conditions.
- Availability of Mac/Xcode or macOS build service, signing, Apple Developer account.
- Google OAuth (consent screen, allowed scopes, token life), eligible Calendar/Meet account.
- Zoom OAuth app permissions, host license/meeting quotas and API limits.
- Domain/provider webhook ingress strategy during local-only dev.
- Monthly budget ceiling and desired support/backup policy.
- Domain name & HTTPS ingress when VPS launched.

## Phase 0 gate — minimum evidence
1. iOS AlarmKit spike on physical compatible iPhone: one-time, recurring, snooze, offline, locked, Focus/silent, app terminated, reboot, authorization revoked; limitations annotated.
2. macOS build/sign/test path identified and approved.
3. Google and Zoom provider API smoke test strategy with expected account, approval/scopes/rate limits.
4. ADR deviations documented and signed by owner.
5. Cost and external callback plan accepted.

## If blocked
Report exact blocker, supported fallbacks/options, cost/risk; ask owner for explicit re-scope; do not pretend acceptance passed.
