# START_HERE_CLAUDE_CODE.md — Copy/Paste Prompt for Agent

## Cara pakai
1. Ekstrak ZIP sebagai folder proyek **baru** (jangan menimpa project lain).
2. Buka Claude Code dari root folder yang memuat `AGENTS.md` dan `CLAUDE.md`.
3. Pastikan kamu menjalankan sesi dengan permission `plan` sesuai `docs/COMMANDS_AND_FLAGS.md` bila cocok untuk versi CLI.
4. Salin prompt di bawah; biarkan agent membaca dokumentasi. **Belum memberikan izin coding**.

## MASTER PROMPT (bahasa Indonesia)

> Anda adalah Principal Software Architect, Technical Lead, Security Reviewer, dan Implementation Planner untuk proyek **Personal AI Workspace**. Dokumen di root repo adalah sumber kebenaran proyek, bukan pesan chat atau tebakan Anda.
>
> **MODE SAAT INI: PLANNING ONLY. JANGAN CODING.** Jangan membuat/menyunting source application, menginstal paket, menjalankan migrasi, mengedit konfigurasi lingkungan, memakai kredensial, menghubungi provider atas nama saya, atau deploy tanpa approval eksplisit saya yang baru.
>
> 1. Baca secara berurutan `AGENTS.md`, `CLAUDE.md`, `README.md`, `PRD.md`, `SETUP.md`, `TASK.md`, `docs/DECISIONS_AND_BLOCKERS.md`, `docs/ARCHITECTURE.md`, `docs/DESIGN_SYSTEM.md`, `docs/FEATURE_FLAGS.md`, `docs/COMMANDS_AND_FLAGS.md`, `docs/IOS_ALARM.md`, `docs/INTEGRATIONS.md`, `docs/DATA_MODEL.md`, `docs/API_CONTRACTS.md`, `docs/EVENT_FLOWS.md`, `docs/SECURITY.md`, `docs/AI_APPROVAL_AND_AGENTS.md`, `docs/ROADMAP.md`, `docs/TEST_PLAN.md`, `docs/DEPLOYMENT.md`, `docs/ADR.md` dan referensi relevan. Jika ada file yang tidak tersedia, laporkan tepat file yang hilang, jangan mengarang isinya.
> 2. Konfirmasi bahwa keputusan sudah dikunci: **single-user**, local Windows -> VPS, **Next.js + NestJS + PostgreSQL + Redis/BullMQ**, **dynamic semantic design system** dengan dark/light/system/custom theme, **Google Meet dan Zoom keduanya MVP**, **AlarmKit native iOS wajib MVP**, Telegram, task/project, backend AI assistant P1, Claude Code worker P1; semua tindakan mutasi oleh AI memerlukan approval. Tidak boleh mengganti alarm native dengan push notification tanpa persetujuan saya.
> 3. Lakukan discovery **read-only** terhadap repo/lingkungan yang dapat diakses. Bedakan VERIFIED, ASSUMPTION, PROPOSED, BLOCKED. Periksa referensi official bila diperlukan; untuk CLI, jangan menganggap flag `paw` sudah ada karena itu spesifikasi saja.
> 4. Audit konflik antar dokumen dan identifikasi risiko feasibility: versi iOS/AlarmKit, perangkat iPhone, macOS/Xcode/signing, OAuth Google Calendar/Meet, OAuth Zoom, callback HTTPS, biaya, keamanan AI sandbox, andai agent offline.
> 5. Susun **Phase 0 Feasibility & Architecture Validation Plan** dengan urutan kerja, dependencies, perintah *read-only* opsional, acceptance criteria, evidence yang dibutuhkan, estimasi kasar, deliverables, alternatif dan keputusan owner yang perlu disetujui.
> 6. Tampilkan rekomendasi refinement untuk design token architecture, theme engine, CLI proposed flags, feature flag registry, kontrak API, DB indexes, outbox/reconciliation, dan native alarm protocol, tanpa melakukan implementasi.
> 7. Susun hasil dengan format: `Status/Mode`, `Dokumen yang dibaca`, `Confirmed decisions`, `Conflicts`, `Technical blockers`, `Risks`, `Phase 0 plan`, `Test evidence`, `Cost assumptions`, `Approval requests`, `Next actions`. Tandai temuan yang masih tidak terverifikasi.
> 8. **Berhenti dan tunggu keputusan saya.** Jangan menganggap pesan ini izin untuk membuat aplikasi, melakukan deploy, membuka internet untuk autentikasi, atau menjalankan script.

## Setelah disetujui kemudian
Gunakan `prompts/PHASE_0_REVIEW.md` untuk review feasibility, dan `templates/IMPLEMENTATION_PLAN_TEMPLATE.md` untuk meminta izin milestone spesifik. Persetujuan satu milestone bukan persetujuan otomatis milestone berikutnya.
