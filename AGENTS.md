# AGENTS.md — Aturan untuk SEMUA AI Coding Agents

> Berlaku bagi Claude Code, OpenCode, Codex, Antigravity dan agent lain yang masuk repo ini. Baca sebelum analisis, menulis, atau menjalankan tools.

## 1. Mission dan mode
- Produk: Personal AI Workspace (single-owner, local-first, future VPS), spesifikasi di `PRD.md`.
- **MODE SAAT INI: PLANNING ONLY.** Hanya membaca/mengaudit/menyusun rencana/dokumentasi bila diizinkan owner. Dilarang membuat aplikasi, menginstal dependency, mengeksekusi migrasi, menghubungkan API provider, atau deploy tanpa persetujuan baru.
- Hormati `TASK.md` dan keputusan dalam `docs/ADR.md`.

## 2. Preflight wajib setiap sesi
1. Konfirmasi direktori/repo dan daftar file yang ada; hindari membuat repo kedua.
2. Baca `AGENTS.md` + `CLAUDE.md` jika Claude Code; `PRD.md`, `docs/DECISIONS_AND_BLOCKERS.md`, `TASK.md`, ADR terkait.
3. Tampilkan status phase, feature flags dan blocker. Tandai hal yang tidak dapat diverifikasi.
4. Siapkan rencana *read-only* dengan perubahan yang diusulkan, risiko, test, rollback, dan approval yang dibutuhkan.
5. Jangan klaim sesuatu PASS tanpa log/test/bukti.

## 3. Rules yang tidak boleh dilewati
- Satu otoritas state bisnis: PostgreSQL. Queue/Redis bukan satu-satunya sumber kebenaran.
- Kalender, task, reminder, push/alarms harus tetap bekerja saat AI offline.
- Semua output AI yang mengubah data/action eksternal harus menjadi `proposal -> user approval -> revalidation -> execution`.
- Pengguna yang membuat perubahan manual secara terautentikasi tidak memerlukan approval AI tambahan, tetapi operasi sensitif seperti deploy tetap minta konfirmasi eksplisit.
- Batas tool agent: tidak ada root, unrestricted shell, Docker socket, kredensial prod, token OAuth mentah, atau akses vault personal tanpa izin.
- Dilarang `--dangerously-skip-permissions`, bypass permissions, auto-approve semua tools, force push, destructive database migration tanpa izin eksplisit.
- Tidak boleh mengklaim native iOS alarm setara aplikasi Clock tanpa pengujian AlarmKit di iPhone fisik dan batas versi iOS.
- Semua waktu persisten UTC + `Asia/Jakarta`/IANA timezone; DST, recurrence, snooze, dan keterlambatan ditest.
- No secrets in repo, docs, logs, screenshot, prompt, atau commit. `.env.example` hanya placeholder.
- Integrasi provider adapter-first; error, retry, dedupe, reconciliation, rate limits dan token refresh harus terdokumentasi.

## 4. Engineering standar
- TypeScript strict, input validation, explicit types, lint/test/format di pipeline setelah coding disetujui.
- OpenAPI-first untuk REST dan schema versioning; typed clients untuk web, CLI, Swift.
- Transactional outbox dan consumer idempotent untuk event asinkron.
- UI menggunakan design tokens, semantik, aksesibilitas; **dilarang hardcode warna/sizing** di komponen tanpa alasan ADR.
- Mobile first, responsif, light/dark/auto dan custom themes dapat dipilih; pastikan WCAG 2.2 AA sebagai target.
- Kerjakan satu milestone / task branch, PR dengan bukti, lalu handoff.

## 5. Agent response format
Tiap laporan harus memuat: `Mode`, `Phase`, `Dokumen dibaca`, `Temuan`, `Asumsi`, `Blocker`, `Rencana & file terdampak`, `Testing/evidence`, `Risiko`, `Approval diperlukan`, `Next step`.

## 6. Shared memory
Dokumentasi repo adalah kebenaran produk. Obsidian shared memory boleh digunakan nanti **setelah** pemilik menentukan vault path dan izin folder. Catatan Obsidian bukan alasan melewati aturan repo, bukan sumber rahasia, dan tidak boleh menimpa ADR terverifikasi.

## 7. Bila diminta implementasi
Pastikan ada persetujuan terpisah dari owner yang menyebut milestone. Jika belum ada, berhenti pada rencana. Jika sudah, lakukan perubahan minimal sesuai acceptance criteria, gunakan test, laporkan bukti, dan jangan otomatis deploy ke prod.
