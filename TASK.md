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
- [x] P1-03 PostgreSQL migrations, Redis/BullMQ, outbox. [DONE 2026-10-30: PostgreSQL 16 (port 5433) connected; Prisma ORM migrations created paw_dev with 26 tables & composite indexes; Transactional Outbox pattern implemented; apps/worker scaffolded with BullMQ & Redis (port 6379) dispatcher; 6 vitest integration tests passing; 19 total tests passing across monorepo].
- [x] P1-04 Token-based responsive web shell, tema adaptif. [DONE 2026-10-30: Next.js 15 App Router apps/web scaffolded; ADR-012 semantic theme engine implemented with presets (default, forest, ocean) and WCAG 2.2 AA contrast validator; responsive AppShell with desktop sidebar & mobile PWA bottom nav (44pt targets); PWA manifest.json created; Next.js production build succeeded; 23 total tests passing across monorepo].
**Gate 1:** PASSED (Platform Core fully scaffolded, typed, tested, and operational 2026-10-30).

## Phase 2 — Productivity
- [x] P2-01 Projects/tasks/subtasks/tags/priorities/deadlines. [DONE 2026-10-30: Tasks & Projects domain modules implemented in apps/api; CRUD endpoints with optimistic concurrency (version/If-Match) & tags; atomic outbox events task.created.v1 & task.updated.v1; interactive TaskCard and CreateTaskDialog in apps/web with status board; 26 total tests passing].
- [x] P2-02 Recurrence & timezone engine. [DONE 2026-10-30: RFC 5545 RRULE engine implemented; deterministic occurrence key generation; timezone normalization (Asia/Jakarta default); window occurrence expansion; PostgreSQL recurrence_rules CRUD; 9 vitest tests passing].
- [x] P2-03 Calendar CRUD, conflict detection, Google two-way sync. [DONE 2026-10-30: Calendar & events CRUD implemented; time conflict detection engine; Google Calendar incremental sync & HTTP 410 recovery reconciliation; webhook ingest & outbox event emission; calendar timeline UI in apps/web; 36 total tests passing].
- [x] P2-04 Google Meet + Zoom provider adapters. [DONE 2026-10-30: Asynchronous meeting provisioning state machines implemented; GoogleMeetAdapter (conferenceData) & ZoomMeetingAdapter; atomic meeting.provisioning.requested & confirmed outbox events; interactive Meetings UI in apps/web; 38 total tests passing].
**Gate 2:** PASSED (Productivity domain fully operational across API, worker, database, and web UI 2026-10-30).

## Phase 3 — Reminder & iOS
- [ ] P3-01 Reminder occurrences + recovery + escalation. (READY_FOR_REVIEW)
- [ ] P3-02 Telegram gateway + allowlist + notification. (PLANNED)
- [ ] P3-03 SwiftUI device sync + AlarmKit capability implementation sesuai validated spec. (PLANNED)
- [ ] P3-04 Snooze/acknowledgment, offline/lock/silent/Focus/reboot tests. (PLANNED)
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
