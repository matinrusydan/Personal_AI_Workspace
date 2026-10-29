# SETUP.md — Persiapan Lingkungan dan Discovery (NON-EKSEKUSI)

**Jangan menjalankan langkah instalasi otomatis saat mode PLANNING ONLY.** Ini checklist untuk owner dan agent setelah izin.

## 1. Matriks lingkungan
| Bagian | Lokal | MVP iOS | Produksi nanti |
|---|---|---|---|
| OS | Windows 11 + PowerShell | macOS + Xcode, iPhone fisik | Ubuntu LTS VPS |
| Runtime | Node.js LTS kompatibel, pnpm, Docker Desktop/WSL2 | Swift, Xcode, Apple developer tooling | Node.js dan Docker Compose |
| DB | PostgreSQL lokal/container | backend staging | PostgreSQL dengan backup |
| Queue | Redis + BullMQ | backend staging | Redis terisolasi |
| Auth | lokal dengan demo account, no secrets in git | device signing | OIDC/passkey/TOTP sesuai ADR |
| Secrets | .env lokal tidak di-commit | Keychain/secure config | managed secret/locked env |

## 2. Discovery aman (read-only)
PowerShell, jalankan hanya bila owner meminta audit environment:
```powershell
Get-Location
Get-ChildItem -Force | Select-Object Name, Mode
node --version
npm --version
pnpm --version
where.exe git
where.exe docker
```
**Jangan** mengasumsikan versi sudah cocok berdasarkan hasil percakapan sebelumnya. Agent harus memverifikasi di mesin aktif.

## 3. Prasyarat manual untuk MVP
- Akses iPhone fisik, versi iOS yang mendukung AlarmKit; rencana test silent/Focus/lock/reboot.
- Akses Mac/Xcode atau macOS CI/signing yang memenuhi syarat Apple; detail pengujian perangkat dan distribusi harus disepakati.
- Apple Developer account/entitlement/distribution plan sesuai kebutuhan, belum diasumsikan tersedia.
- Google Cloud project, OAuth consent, akun kalender, scope minimum.
- Zoom Marketplace app yang cocok (user OAuth), quota/scopes dan akun host.
- Telegram bot token, ID owner allowlist (disimpan sebagai secret).
- Domain HTTPS untuk callback OAuth/webhook di staging/prod.

## 4. Local-first workflow (setelah approval)
1. Audit environment dan compatibility matrix; tulis hasil ke docs, tanpa secret.
2. Buat project scaffolding sesuai ADR (hanya setelah Phase 0 gate).
3. Gunakan environment terpisah: dev/staging/prod dan database berbeda.
4. Siapkan mock provider dan fixture test sebelum memakai akun nyata.
5. Jangan menaruh port DB/Redis di public internet.
6. Jangan menjalankan auth redirect OAuth produksi pada localhost tanpa desain dan registrasi yang sesuai.

## 5. Exit criteria setup
Tool versions verified, mobile build strategy approved, provider access plan approved, threat model reviewed, reproducible local startup plan accepted. Belum berarti source dibuat.

## 6. Dokumentasi CLI
Lihat `docs/COMMANDS_AND_FLAGS.md` untuk flags resmi Claude dan flags aplikasi **proposed**, `docs/FEATURE_FLAGS.md` untuk runtime toggles. Jangan mencampurkan keduanya.
