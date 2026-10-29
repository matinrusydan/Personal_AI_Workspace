# TASK.md — Master Backlog & Approval Gates

**Workflow:** `PLANNED -> READY_FOR_REVIEW -> APPROVED -> IN_PROGRESS -> IN_TEST -> DONE` atau `BLOCKED`. Tidak ada task IN_PROGRESS tanpa persetujuan owner. Semua P0 = MVP; P1/P2 tidak memblokir MVP kecuali dependensi keamanan.

## Phase 0 — Feasibility & Architecture Validation (FIRST)
- [x] P0-01 Audit dan matriks AlarmKit (versi iOS, permission, silent/Focus, locked/offline, recurring, snooze, device restore). [DONE 2026-10-29: Verified via official Apple documentation].
- [x] P0-02 Pastikan perangkat iPhone fisik dan jalur Mac/Xcode/signing/distribusi. [DONE 2026-10-29: iPhone 12 iOS 26.4.1 verified; ADR-015 approved for GitHub Actions macOS runner + Windows sideloading].
- [x] P0-03 Uji konsep Google Calendar OAuth/two-way sync dan pembuatan Meet (akun yang dipakai). [DONE 2026-10-29: Free personal tier scope and async provisioning state machine documented].
- [x] P0-04 Uji konsep Zoom user OAuth, permission, meeting creation, rate limit. [DONE 2026-10-29: Free developer account scope & 40m group meeting constraint documented].
- [x] P0-05 Finalisasi threat model, kebijakan approval dan boundary agent. [DONE 2026-10-29: ADR-014 Hybrid MFA accepted, immutable AI proposal policy locked].
- [x] P0-06 Finalisasi rancangan design system dan personalisasi tema. [DONE 2026-10-29: Semantic DTCG token architecture & contrast validator design locked].
- [x] P0-07 Finalisasi budget/ops constraints & release gates. [DONE 2026-10-29: Free-tier $0 dev budget confirmed by owner].
**Gate 0:** PASSED (Feasibility audited, ADR-014 & ADR-015 accepted, owner approved 2026-10-29).

## Phase 1 — Platform Core
- [x] P1-01 Monorepo, lint, test, OpenAPI, CI dasar. [DONE 2026-10-29: pnpm workspace initialized; contracts, config, ui, database packages created; OpenAPI 3.1 schema and TS types generated; GitHub Actions CI/iOS workflows setup; format/lint/typecheck/build validated].
- [x] P1-02 Auth, MFA, sessions, devices, audit. [DONE 2026-10-29: NestJS apps/api initialized; ADR-014 TOTP RFC 6238 and single-use recovery code MFA implemented; session management and JWT guard setup; device enrollment endpoint created; append-only audit service with redaction implemented; 13 vitest tests passing].
- [ ] P1-03 PostgreSQL migrations, Redis/BullMQ, outbox. (READY_FOR_REVIEW)
- [ ] P1-04 Token-based responsive web shell, tema adaptif. (PLANNED)
- [ ] P1-04 Token-based responsive web shell, tema adaptif. (PLANNED)
**Gate 1:** test setup/deterministic auth dan kontrak tanpa public exposure.

## Phase 2 — Productivity
- [ ] P2-01 Projects/tasks/subtasks/tags/priorities/deadlines.
- [ ] P2-02 Recurrence & timezone engine.
- [ ] P2-03 Calendar CRUD, conflict detection, Google two-way sync.
- [ ] P2-04 Google Meet + Zoom provider adapters.
**Gate 2:** cross-channel event/meeting idempotent; sync replay/recovery lulus.

## Phase 3 — Reminder & iOS
- [ ] P3-01 Reminder occurrences + recovery + escalation.
- [ ] P3-02 Telegram gateway + allowlist + notification.
- [ ] P3-03 SwiftUI device sync + AlarmKit capability implementation sesuai validated spec.
- [ ] P3-04 Snooze/acknowledgment, offline/lock/silent/Focus/reboot tests.
**Gate 3:** bukti tes iPhone fisik; tidak mengganti alarm dengan generic push diam-diam.

## Phase 4 — UI and MVP Release
- [ ] P4-01 Desktop/mobile dashboard, schedule, tasks, integration settings.
- [ ] P4-02 Theme builder/personalization, dark/light/auto, responsive, WCAG checks.
- [ ] P4-03 E2E, security review, backup/restore, logs/alerts.
**Gate 4:** `docs/TEST_PLAN.md` AC-01..AC-16 yang berlaku lolos.

## Phase 5 — Post-MVP
- [ ] P5-01 Backend AI assistant/tool proposal/approval.
- [ ] P5-02 Isolated Claude Code worker, PR-only coding workflow.
- [ ] P5-03 Workflow engine/visual builder; Obsidian + RAG; plugin interfaces.
- [ ] P5-04 VPS production deployment, later enhancements (Gmail/Drive, WhatsApp, IoT, habit tracker).

## Pelaporan task
Pakai `templates/TASK_TEMPLATE.md`: scope, depends_on, files impacted, evidence/test, rollback, risk, approval owner. Agent tidak boleh menandai DONE dari rencana saja.
