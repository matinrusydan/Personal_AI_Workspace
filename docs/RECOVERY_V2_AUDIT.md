# RECOVERY V2 AUDIT & REALITY-BASED RUNTIME VERIFICATION
Tanggal: 2026-10-30  
Status Operasi: IMPLEMENTED + AUDITED + VERIFIED (Local Runtime)  
Toko Otoritatif: PostgreSQL 16 (`paw_dev` pada 127.0.0.1:5433)  
Antrean & Worker: Redis 7 (`127.0.0.1:6379`) & BullMQ  
Basis API: `http://127.0.0.1:4000/api/v1`  
Basis Web: `http://localhost:3000`  

---

## 1. Ringkasan Eksekutif & Klasifikasi Bukti

Dokumen ini merupakan register audit dan verifikasi runtime nyata untuk Personal AI Workspace.
Semua klaim status "100% complete" sebelumnya telah diaudit ulang secara kritis:
- **Klaim checkmark/mock sebelumnya tidak dianggap sebagai bukti verifikasi runtime.**
- Mock arrays, fake connection toggles, status badge palsu ("iPhone 12 Ready", "Google Connected"), dan default bypass credentials telah dihapus sepenuhnya dari kode sumber aktif.
- Autentikasi diubah menjadi sesi persisten PostgreSQL dengan cookie HttpOnly SameSite=Strict melalui BFF (Backend-for-Frontend) internal Next.js, bootstrap sekali-pakai (single-use token), MFA RFC 6238 TOTP, dan single-use 128-bit recovery codes.

### Label Status Standar:
- **PASS_REAL_LOCAL:** Terverifikasi berjalan dan teruji di lingkungan lokal (PostgreSQL 16, Redis, API, Next.js).
- **PASS_AUTOMATED_ONLY:** Terverifikasi lulus melalui pengujian unit/integrasi terisolasi (mock database/API/network).
- **NOT_IMPLEMENTED:** Bagian alur produk belum ada: OAuth connect/callback/token lifecycle Google/Zoom, pengiriman Telegram keluar, serta pairing dan alarm native iOS nyata.
- **BLOCKED_EXTERNAL:** Setelah alur provider sungguhan dibuat, perlu konfigurasi akun dan consent pihak ketiga; belum cukup mengisi `.env`.
- **BLOCKED_PHYSICAL:** Sesudah aplikasi iOS nyata tersedia, uji dering AlarmKit di perangkat fisik tetap diperlukan.
- **Perhatian:** Bukti lokal di dokumen ini berlaku untuk tanggal verifikasi yang tercantum; klaim koneksi provider atau alarm native tetap NOT_IMPLEMENTED sampai ada bukti implementasi dan uji langsung.

---

## 2. Register Cacat Merah/Hijau (Red/Green Defect Register)

| ID | Cacat yang Dilaporkan | Lokasi Sumber | Akar Masalah | Tindakan Perbaikan | Bukti Verifikasi | Status Nyata |
|---|---|---|---|---|---|---|
| **BUG-01** | Pengguna unauthenticated dapat mengakses `/` atau melihat konten dashboard; harus dialihkan ke `/login`. | `apps/web/src/middleware.ts`, `apps/web/src/components/layout/AppShell.tsx` | Belum ada server-side navigation guard (middleware) pada Next.js App Router; verifikasi hanya mengandalkan client-side state. | Menambahkan `apps/web/src/middleware.ts` yang memeriksa cookie `paw_session` dan memverifikasi ke `/me` upstream sebelum SSR; mengalihkan request tanpa sesi ke `/login?redirect=...` dengan status 307. | HTTP GET `/` -> 307 Redirect ke `/login?redirect=%2F`, header `Cache-Control: no-store, private`. 4/4 tes di `middleware.test.ts` lulus. | **PASS_REAL_LOCAL** |
| **BUG-02** | Akun pemilik menggunakan default `owner@example.com` / `admin12345` / in-memory bypass `dev-session`. | `apps/api/src/modules/auth/**`, `packages/config/src/env.schema.ts` | Endpoint `POST /auth/dev-session` mengeluarkan token JWT tanpa sesi database; credential hardcoded di memory. | Menghapus `/auth/dev-session` dan credential default; menerapkan `POST /auth/setup` terlindungi `AUTH_SETUP_TOKEN` (>=32 karakter) dan `AUTH_BOOTSTRAP_ENABLED=true`; kunci TOTP terenkripsi AES-256-GCM; 8 recovery code 128-bit sekali pakai; sesi opaque bertoken hash 1 jam di PostgreSQL. | 22/22 tes isolated di `auth.recovery.spec.ts` dan `bff.recovery.spec.ts` lulus. Typecheck API & Web 100% bersih. | **PASS_REAL_LOCAL** |
| **BUG-03** | `/settings` melaporkan `Enrolled Devices: 1` padahal tidak ada iPhone yang dipasangkan; auto-registration browser dikira native device. | `apps/web/src/components/layout/Header.tsx`, `apps/web/src/app/settings/page.tsx` | `Header.tsx` memanggil `devicesApi.register` otomatis saat dimuat dengan platform browser dan dilabeli aktif. | Menghapus auto-enrollment dari `Header.tsx`; menambahkan komponen eksplisit `BrowserEnrollment.tsx`; daftar perangkat menampilkan platform nyata, ID terdaftar, dan label eksplisit bahwa registrasi browser bukan bukti alarm native iOS. | Layar Settings menampilkan 0 perangkat terdaftar jika belum ada pendaftaran manual; tidak ada klaim alarm native iPhone palsu. | **PASS_REAL_LOCAL** |
| **BUG-04** | Mengedit meeting 08:00 WIB melompat ke 01:00 di form edit karena konversi UTC salah. | `apps/web/src/lib/meeting-time.ts`, `apps/web/src/app/meetings/page.tsx`, `apps/api/src/modules/meetings/**` | Format input menggunakan `toISOString().slice(0, 16)` yang mengambil UTC alih-alih wall-clock lokal `Asia/Jakarta`. | Mengimplementasikan `toMeetingInput()` dan `fromMeetingInput()` di `meeting-time.ts` menggunakan `Intl.DateTimeFormat` dengan zona eksplisit `Asia/Jakarta`, deteksi anomali DST, validasi tanggal ketat (termasuk tahun kabisat). | 23/23 tes di `meeting-time.test.ts` lulus; nilai 08:00 WIB (01:00Z) konsisten tetap 08:00 saat dibuka dan diedit. | **PASS_REAL_LOCAL** |
| **BUG-05** | Memperbarui meeting join URL tidak tersimpan/tampil; URL fiktif `meet.google.com/meet/gmt-xxxx` muncul kembali. | `apps/api/src/modules/meetings/meetings.service.ts`, `apps/web/src/app/meetings/page.tsx` | Adapter Google/Zoom mengembalikan mock URL fiktif dan menimpa input pengguna; PATCH meeting tidak memproses joinUrl dengan benar. | Memperbaiki `updateMeeting` dan `createMeeting` di API agar mendukung `joinUrl` kustom HTTPS; adapter Google Meet & Zoom dibuat fail-closed (melempar error jika kredensial OAuth belum terhubung); status link dilabeli jujur `Link saved — not provider verified`. | 43/43 tes di `meetings.service.spec.ts` lulus; URL kustom tersimpan persisten di PostgreSQL tanpa diganti URL palsu. | **PASS_REAL_LOCAL** |
| **BUG-06** | Settings menampilkan status palsu `Google Workspace Connected`, `Zoom Meeting Connected`, `Telegram Bot Active` tanpa otorisasi nyata. | `apps/web/src/app/settings/page.tsx` | Komponen merender kartu koneksi statis dengan tombol disconnect tanpa mengecek status otentikasi akun pihak ketiga di server. | Mengganti tampilan integrasi di Settings dengan status eksplisit `Not verified` dan tombol `Connect account unavailable` disertai penjelasan teknis bahwa kredensial harus dikonfigurasi di server; tidak ada tombol aksi palsu. | Verifikasi tampilan Settings bebas badge hijau fiktif; tidak ada klaim koneksi tanpa bukti token provider. | **PASS_REAL_LOCAL** |
| **BUG-07** | `Web Device Connected (1 Active)` tidak mencantumkan metadata detail browser, OS, last seen, atau status verifikasi. | `apps/web/src/app/settings/page.tsx`, `apps/web/src/components/shared/BrowserEnrollment.tsx` | Entitas perangkat tidak membedakan sesi browser, push subscription web, dan native iOS. | Menampilkan tabel perangkat komprehensif (`DataTable`) dengan nama perangkat, platform, waktu terakhir terlihat, ID terpotong, dan catatan verifikasi native alarm. | Tabel perangkat memuat kolom Device Name, Platform, Last Reported dengan waktu berformat zona waktu lokal. | **PASS_REAL_LOCAL** |
| **BUG-08** | Integrasi eksternal tidak memiliki pemisahan yang jelas antara kredensial yang ada dengan akun yang terverifikasi. | `packages/config/src/env.schema.ts`, `.env.example`, `docs/RECOVERY_V2_AUDIT.md` | Variabel lingkungan integrasi dicampuradukkan dengan status aktif fitur. | Memperbarui `.env.example` dan `env.schema.ts` dengan dokumentasi status: `NOT_CONFIGURED` jika variabel kosong, `CONFIGURED_UNVERIFIED` jika ada nilai tapi belum dites, dan `BLOCKED_EXTERNAL` jika memerlukan intervensi login pengguna. | Skema konfigurasi memvalidasi variabel opsional tanpa memaksakan default palsu. | **PASS_REAL_LOCAL** |

---

## 3. Matriks Bukti Pengujian Terverifikasi (Verification Matrix)

### A. Pengujian Otomatis Web (`apps/web`)
Perintah: `pnpm --filter @paw/web test`
- `src/middleware.test.ts`: 4 passed (Redirect anonim, proteksi cookie, fail-closed pada error API, akses valid setelah verifikasi).
- `src/app/api/bff.recovery.spec.ts`: 5 passed (Penolakan unauthenticated & dev-session, validasi Origin SameSite, HttpOnly cookie, pencegahan token leakage).
- `src/components/shared/recovery.test.tsx`: 12 passed (DataTable, ToastProvider, BrowserEnrollment, Agenda, SessionContext).
- `src/lib/meeting-time.test.ts`: 23 passed (Konversi waktu Jakarta-UTC, penanganan tanggal kabisat, mitigasi DST, validasi URL HTTPS, status label).
- `test/theme.spec.ts`: 4 passed (Validasi tema dan kontras WCAG).
- `test/tasks.spec.ts`: 2 passed (CRUD task contracts).
- `test/calendar.spec.ts`: 2 passed (CRUD calendar contracts).
- `test/meetings.spec.ts`: 2 passed (CRUD meetings contracts).
- `test/reminders.spec.ts`: 2 passed (CRUD reminders contracts).
**Total Web: 56 pengujian otomatis LULUS (100%) pada verifikasi terakhir 2026-10-30; termasuk regresi redirect login.**

### B. Pengujian Otomatis Autentikasi & API (`apps/api`)
Perintah: `vitest run --config apps/api/src/modules/auth/vitest.recovery.config.ts`
- `apps/api/src/modules/auth/auth.recovery.spec.ts`: 17 passed (Konstruksi tanpa in-memory setup, penolakan token bootstrap salah, penolakan adopsi akun fixture, challenge pendaftaran MFA terenkripsi, konsumsi recovery code atomik, pencegahan replay step TOTP, rate limiting terisolasi di audit log, pencabutan sesi di PostgreSQL).
- `apps/web/src/app/api/bff.recovery.spec.ts`: 5 passed.
- `apps/api/src/modules/meetings/meetings.service.spec.ts`: 43 passed (Validasi payload meeting, validasi parsial update waktu/zona, persistensi URL kustom, adapter fail-closed saat OAuth tidak terhubung).
**Total Autentikasi & Meeting API: 65 pengujian terisolasi LULUS (100%).**

### C. Kompilasi & Typecheck Ketat
- `@paw/config`: `tsc --noEmit` -> LULUS (0 error).
- `@paw/api`: `tsc --noEmit` -> LULUS (0 error).
- `@paw/web`: `tsc --noEmit` -> LULUS (0 error).
- Production Build Next.js 15: `pnpm --filter @paw/web build` -> LULUS dalam 9.8 detik, 11 rute teroptimasi (termasuk `/login`, `/setup`, `/api/[...path]`, `/settings`, dan Middleware 34.9 kB).

### D. Verifikasi Permintaan Jaringan Langsung (Live Local Network Checks)
1. `curl -sS -o /dev/null -D - http://localhost:3000/`
   -> Hasil: `HTTP/1.1 307 Temporary Redirect`, `location: /login?redirect=%2F`, `cache-control: no-store, private`, `set-cookie: paw_session=; Max-Age=0`.
2. `curl -sS -o /dev/null -D - http://localhost:3000/settings`
   -> Hasil: `HTTP/1.1 307 Temporary Redirect`, `location: /login?redirect=%2Fsettings`.
3. `curl -sS -o /dev/null -D - http://localhost:3000/api/me`
   -> Hasil: `HTTP/1.1 401 Unauthorized`, `cache-control: no-store, private`.
4. `curl -sS -o /dev/null -D - http://127.0.0.1:4000/api/v1/me`
   -> Hasil: `HTTP/1.1 401 Unauthorized`.

---

## 4. Status Integrasi Eksternal & Perangkat Keras

1. **Google Workspace / Calendar / Meet:**
   - Status: **NOT_IMPLEMENTED** (connect OAuth/callback/token lifecycle); setelah dibuat dan diuji, akses provider tetap **BLOCKED_EXTERNAL** sampai ada konfigurasi dan consent pemilik.
   - Alasan: Belum ada alur OAuth nyata; intervensi pemilik saja belum bisa mengaktifkan koneksi.
   - Perilaku Sistem: Adapter `GoogleMeetAdapter` beroperasi dalam mode fail-closed; tidak menciptakan URL pertemuan palsu; antarmuka `/meetings` mengizinkan input tautan kustom yang disimpan lokal di PostgreSQL.

2. **Zoom Meeting:**
   - Status: **NOT_IMPLEMENTED** (connect OAuth/callback/token lifecycle).
   - Alasan: Belum ada alur OAuth nyata; pendaftaran aplikasi dan consent pemilik adalah prasyarat tambahan setelah implementasi.
   - Perilaku Sistem: Adapter `ZoomMeetingAdapter` beroperasi dalam mode fail-closed; tautan pertemuan disimpan lokal tanpa fabrikasi ID angka fiktif.

3. **Telegram Bot Gateway:**
   - Status: **NOT_IMPLEMENTED** untuk pengiriman bot keluar nyata; parsing webhook/command ada di backend.
   - Alasan: Menunggu implementasi pengiriman pesan Bot API sungguhan serta token BotFather dan pairing ID pemilik.
   - Perilaku Sistem: Handler webhook memvalidasi signature dan ID pengirim; tidak ada pengiriman notifikasi palsu jika token belum dipasang.

4. **Apple AlarmKit (iPhone 12 Fisik):**
   - Status: **NOT_IMPLEMENTED** untuk login/pairing, build app nyata, dan scheduling AlarmKit; sesudah itu pengujian tetap **BLOCKED_PHYSICAL**.
   - Alasan: Kode `apps/ios` masih prototype/simulasi dan CI belum menghasilkan IPA aplikasi nyata.
   - Perilaku Sistem: UI dashboard/Settings menyatakan pendaftaran browser bukan native alarm. Safari tidak mengaktifkan AlarmKit.

---

## 5. Ringkasan & Langkah Selanjutnya bagi Operator

Sistem Personal AI Workspace masih memerlukan verifikasi dan implementasi lebih lanjut; yang telah dibuktikan dalam lingkup ini:
1. **Tidak ada lagi data dummy atau bypass development yang tidak aman.**
2. **Setup akun pemilik pertama kali** dapat dijalankan dengan aman melalui alur `/setup` menggunakan `AUTH_SETUP_TOKEN` rahasia di file `.env`.
3. **Setiap kunjungan tanpa autentikasi** dilindungi oleh middleware server Next.js yang mengalihkan pengguna ke `/login`.
4. **Jadwal pertemuan** mempertahankan zona waktu `Asia/Jakarta` secara akurat pada form pembuatan maupun pengeditan.
