# PRD.md — Product Requirements Document v1.0

## Identitas
Produk: Personal AI Workspace. Owner: satu orang. Status: **design baseline, planning only**. Default locale `id-ID`, timezone `Asia/Jakarta` (dapat diubah per user/per event). Develop lokal Windows dahulu, deploy VPS kemudian. iOS native **P0**.

## Problem & outcomes
User ingin mengelola meeting/jadwal/tugas/reminder secara konsisten via Web UI desktop, PWA iPhone, Telegram, CLI, dan aplikasi iOS; alarm native harus menonjol; ekosistem dapat tumbuh tanpa rewrite. Outcome: buat tugas/meeting dari satu channel terlihat di semua channel; reminder konsisten meski AI mati; approval AI dapat diaudit.

## Personas & access
Single owner dengan device desktop dan iPhone; desain future multi-user memakai owner_id. Admin actions hanya melalui akun owner yang terautentikasi; Telegram ID ter-allowlist; CLI memakai credential khusus bukan hardcoded API key.

## User journeys P0
1. Buat task/subtask+deadline di Web -> tampil di calendar view -> reminder -> status kembali di web/Telegram.
2. Buat meeting Zoom dari UI -> izin OAuth -> external meeting tercipta -> event tersinkron -> join URL tercatat -> reminder di iPhone.
3. Buat Google Meet dari Google Calendar -> proses conferenceData asinkron -> tampil URL confirmed, bukan URL palsu.
4. Event Google diperbarui di Calendar -> workspace menerima perubahan lewat sync/webhook -> jadwal reminder diperbarui tanpa duplicate.
5. Tambah agenda lewat Telegram command eksplisit -> backend menerima dan memvalidasi -> notifikasi kanal lain.
6. Alarm device terjadwal dan diuji (offline, locked, silent/Focus sesuai kemampuan AlarmKit) -> acknowledge/snooze kembali sync.
7. AI (P1) membaca request natural language -> proposal -> owner approve -> execution -> audit log.

## Prioritas: P0 wajib MVP
- FR-01 Authentication/MFA/sessions and owner allowlist.
- FR-02 Web desktop + mobile PWA dan native iOS alarm client.
- FR-03 Project/task/subtask, priority, deadline, tags, status, recurrence.
- FR-04 Calendar view, conflict detection dan two-way Google Calendar sync.
- FR-05 Google Meet & Zoom meeting creation dengan status provisioning.
- FR-06 Persistent reminder scheduler, retries, dedupe, snooze/ack/escalation.
- FR-07 Telegram commands, notifications dan delivery status.
- FR-08 Dynamic design system dengan theme switcher dan persistence.
- FR-09 Security/audit/backup, dokumentasi dan test bukti.

## P1 (sesudah MVP)
- Backend AI assistant, proposal-based tools dengan mandatory approval (owner selected).
- Claude Code isolated coding agent, PR-only workflow, deployment approval.
- Workflow editor (template + visual builder) dan automation triggers.

## P2 (later)
- Obsidian shared memory + opt-in RAG, Gmail/Drive/GitHub, WhatsApp, Home Assistant, habit tracker, plugin SDK lengkap.

## Not in P0
Integrasi WhatsApp atau IoT, mobile Android, multi-user admin, autonomous production deployment, broad file access agent, fully general plugin marketplace.

## Non-functional requirements
- RPO target <= 24 jam backup (refine setelah ops); RTO target <= 4 jam (target desain, belum SLA).
- Web common API p95 <500ms untuk beban 1 user, di luar vendor calls; runtime observability.
- Reminder durable dan dapat dipulihkan setelah restart; duplicate consumer tidak membuat meeting dua kali.
- Offline AlarmKit bila jadwal sudah terpasang lokal, sesuai bukti fisik.
- Authentication least privilege, TLS, scopes minimal, encryption tokens, audit safety.
- WCAG 2.2 AA target, keyboard/screen reader/reduced-motion/contrast.
- Feature flags diberi fallback dan tidak mengubah data tersimpan secara tak kompatibel.

## Non-goals dan dependency gate
Alarm bukan sekadar APNs push. AlarmKit official framework tersedia untuk OS yang didukung; perlu test versi/permission/entitlement/perangkat/distribusi, tidak menjanjikan identik dengan Apple Clock. Diperlukan jalur macOS/Xcode untuk build/sign app iOS. Google/Zoom OAuth perlu akun/izin yang tersedia. Semua ini menjadi Phase 0 *go/no-go*.

## Metrics
- Meeting provisioning success, sync latency, duplicate rate, reminder on-time attempt, alarm scheduled/ack ratio (sesuai visibility yang tersedia), API error rate, approval policy violation (target 0), backup restore success.

## Release acceptance
P0 hanya complete dengan test/evidence: baca `docs/TEST_PLAN.md`. Tidak boleh silent-scope-reduction tanpa approval ADR.
