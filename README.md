# Personal AI Workspace — Documentation Pack v1.0

**Status:** APPROVED DESIGN BASELINE / PLANNING ONLY  
**Tanggal baseline:** 2026-10-29  
**Bahasa:** Indonesia; kata kunci dan identifier teknis menggunakan English.  
**Owner:** single-user; arsitektur memungkinkan multi-user di masa depan.

## Mulai dari sini
1. Baca `AGENTS.md` dan `CLAUDE.md` (aturan kerja agent).
2. Baca `PRD.md` serta `docs/ARCHITECTURE.md` (cakupan dan batas sistem).
3. Baca `docs/DECISIONS_AND_BLOCKERS.md` (keputusan final dan gerbang kelayakan).
4. Baca `TASK.md` dan `docs/ROADMAP.md` (milestone dan gate).
5. Baca `prompts/START_HERE_CLAUDE_CODE.md`, lalu gunakan prompt siap salin di dalamnya.

## Tujuan
Workspace self-hosted untuk task/project, kalender + Google Meet/Zoom, Telegram, pengingat dengan alarm iPhone native, dashboard web/PWA, CLI, kemudian AI assistant dan Claude Code worker. Satu sumber data, tanpa ketergantungan AI untuk reminder atau kalender.

## Aturan baseline
- **JANGAN langsung coding** sampai owner menyetujui Phase 0, hasil feasibility iOS, dan rencana milestone.
- Dokumen dalam ZIP adalah **spesifikasi**, bukan aplikasi terinstal, flag aktif, API yang sudah hidup, atau kredensial yang sudah terkonfigurasi.
- Jika diperlukan revisi arsitektur, buat ADR baru, jelaskan trade-off, dan minta approval.
- `docs/COMMANDS_AND_FLAGS.md` membedakan flag Claude Code yang terdokumentasi resmi vs flag aplikasi **proposed**.

## Struktur dokumen
- `AGENTS.md`, `CLAUDE.md`: kebijakan agent, prioritas instruksi, persetujuan, keamanan.
- `SETUP.md`: discovery Windows, prasyarat macOS/Xcode, persiapan lokal/VPS (non-eksekusi).
- `TASK.md`: backlog bertahap, definisi done dan gate.
- `PRD.md`: tujuan, user journeys, FR/NFR, scope.
- `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/API_CONTRACTS.md`, `docs/EVENT_FLOWS.md`.
- `docs/DESIGN_SYSTEM.md`, `docs/FEATURE_FLAGS.md`, `docs/COMMANDS_AND_FLAGS.md`.
- `docs/IOS_ALARM.md`, `docs/INTEGRATIONS.md`, `docs/SECURITY.md`, `docs/AI_APPROVAL_AND_AGENTS.md`.
- `docs/DEPLOYMENT.md`, `docs/TEST_PLAN.md`, `docs/OBSERVABILITY.md`, `docs/ROADMAP.md`.
- `docs/DECISIONS_AND_BLOCKERS.md`, `docs/ADR.md`, `docs/RISK_AND_COST.md`, `docs/REFERENCES.md`.
- `prompts/`: master prompts untuk Claude Code.
- `templates/`: template ADR, implementation plan, task dan session handoff.

## Hierarki keputusan
**Instruksi owner yang eksplisit > aturan keselamatan/izin platform > PRD dan ADR yang disetujui > dokumentasi teknis > output agent.** Jika konflik, berhenti pada perubahan yang konflik dan laporkan; jangan diam-diam memilih solusi.

## Definition of success
P0 feature dan AC lulus dengan bukti; alarm iPhone diuji di perangkat fisik; dua provider meeting berfungsi; sinkronisasi dan reminder tahan restart; AI tidak diperlukan untuk operasi inti; tidak ada tindakan AI mengubah state tanpa approval.
