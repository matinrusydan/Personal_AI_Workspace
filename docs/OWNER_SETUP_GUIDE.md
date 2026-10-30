# PANDUAN PENGATURAN OPERATOR (WINDOWS POWERSHELL)
Personal AI Workspace (PAW) — Local Runtime Operations

Panduan ini ditujukan bagi pemilik/operator sistem yang menjalankan Personal AI Workspace di lingkungan Windows 11 menggunakan PowerShell.

---

## 1. Persiapan Variabel Lingkungan & Kunci Rahasia

Buka Windows PowerShell pada direktori repositori:
```powershell
Set-Location "C:\laragon\www\Personal_AI_Workspace"
```

Salin file contoh konfigurasi jika belum memiliki file `.env`:
```powershell
Copy-Item .env.example .env
```

### A. Membuat Kunci Enkripsi (AUTH_ENCRYPTION_KEY)
Kunci enkripsi harus berupa 32 byte acak dalam format heksadesimal 64 karakter (digunakan untuk mengenkripsi secret TOTP at-rest):
```powershell
# Jalankan perintah PowerShell berikut untuk menghasilkan kunci 64-karakter acak:
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$encryptionKey = [System.BitConverter]::ToString($bytes).Replace("-", "").ToLower()
Write-Host "AUTH_ENCRYPTION_KEY: $encryptionKey"
```
Salin nilai tersebut ke `.env`:
```env
AUTH_ENCRYPTION_KEY=<nilai-di-atas>
```

### B. Membuat Token Setup Sekali Pakai (AUTH_SETUP_TOKEN)
Token setup diperlukan untuk mengaktifkan pendaftaran pemilik pertama kali:
```powershell
# Jalankan perintah berikut untuk menghasilkan token setup dengan entropi tinggi:
$setupTokenBytes = New-Object byte[] 24
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($setupTokenBytes)
$setupToken = [Convert]::ToBase64String($setupTokenBytes).Replace("+", "-").Replace("/", "_").TrimEnd("=")
Write-Host "AUTH_SETUP_TOKEN: $setupToken"
```
Konfigurasikan di `.env`:
```env
AUTH_BOOTSTRAP_ENABLED=true
AUTH_SETUP_TOKEN=<nilai-setup-token-di-atas>
OWNER_EMAIL=matin.rusydan@gmail.com
```

---

## 2. Memulai Layanan Pengembangan Lokal

Pastikan PostgreSQL 16 berjalan pada port 5433 dan Redis berjalan pada port 6379 (atau via Docker):
```powershell
# Verifikasi status koneksi port PostgreSQL dan Redis:
Test-NetConnection -ComputerName 127.0.0.1 -Port 5433
Test-NetConnection -ComputerName 127.0.0.1 -Port 6379
```

Buka dua terminal PowerShell terpisah untuk menjalankan backend API dan frontend web:

### Terminal 1 — Backend API (NestJS - Auto Hot Reload):
```powershell
pnpm dev:api
# Backend aktif di http://127.0.0.1:4000/api/v1
# Sudah dilengkapi Hot-Reload otomatis: setiap perubahan kode di src/ otomatis di-compile dan server restart sendiri tanpa perlu pnpm build manual!
```

### Terminal 2 — Frontend Web (Next.js - Fast Refresh):
```powershell
pnpm dev:web
# Frontend web aktif di http://localhost:3000
# Otomatis reload saat kode diubah (Next.js Fast Refresh)
```

### Terminal 3 (Opsional) — Worker BullMQ (Auto Hot Reload):
```powershell
pnpm dev:worker
# Otomatis me-reload processor saat kode antrean diubah
```

---

## 3. Pendaftaran Akun Pemilik Pertama Kali (One-Time Bootstrap)

1. Buka browser dan akses alamat setup lokal:  
   `http://localhost:3000/setup`
2. Masukkan data pendaftaran:
   - **Owner Email:** Harus sama persis dengan `OWNER_EMAIL` di `.env` (misal: `matin.rusydan@gmail.com`).
   - **Password:** Minimal 14 karakter (gunakan passphrase kuat dan unik).
   - **Confirm Password:** Masukkan ulang password yang sama.
   - **One-time Setup Token:** Masukkan token rahasia dari `AUTH_SETUP_TOKEN`.
3. Klik **"Create account and enroll MFA"**.
4. **Pendaftaran TOTP Authenticator:**
   - Salin **Manual setup key** yang ditampilkan ke aplikasi authenticator Anda (Google Authenticator, Microsoft Authenticator, atau 1Password) dengan format Time-based, 6 digit, 30 detik.
   - Masukkan 6 digit kode dari aplikasi authenticator Anda.
5. **Simpan Recovery Codes:**
   - Sistem akan menampilkan **8 kode pemulihan (recovery codes)** single-use.
   - Simpan kode tersebut di catatan aman / offline password manager.
   - Centang konfirmasi dan klik **"Continue to workspace"**.
6. **Amankan Server:**  
   Setelah selesai mendaftar, ubah pengaturan di `.env` untuk mencegah penggunaan ulang endpoint setup:
   ```env
   AUTH_BOOTSTRAP_ENABLED=false
   AUTH_SETUP_TOKEN=
   ```

---

## 4. Alur Masuk Harian (Daily Login)

1. Buka `http://localhost:3000/`.  
   Jika belum masuk atau sesi habis, middleware server akan otomatis mengarahkan ke `http://localhost:3000/login`.
2. Masukkan email dan password pemilik.
3. Masukkan 6 digit kode dari aplikasi authenticator (atau salah satu kode pemulihan jika ponsel tidak tersedia).
4. Sesi akan diterbitkan dalam bentuk cookie terproteksi `paw_session` dengan masa berlaku 1 jam.

---

## 5. Integrasi Pihak Ketiga (Status Implementasi & Persyaratan Mendatang)

Saat ini di layar Settings, kartu integrasi berstatus **Not verified** dan tombol **Connect account unavailable**. Hal ini karena alur otorisasi OAuth (Google Workspace & Zoom) dan verifikasi pengiriman pesan keluar nyata (Telegram Bot) **belum diimplementasikan di backend**, bukan semata-mata karena token belum diisi. Mengisi kredensial di `.env` belum akan mengaktifkan tombol koneksi.

Jika nantinya alur integrasi tersebut diimplementasikan, berikut adalah prasyarat akun pihak ketiga yang akan dibutuhkan:

### A. Google Workspace (Calendar & Meet)
1. Buka Google Cloud Console (`console.cloud.google.com`).
2. Masuk ke **APIs & Services > Credentials**, pilih atau buat OAuth 2.0 Client ID (Application type: **Web application**).
3. Pada bagian **Authorized redirect URIs**, tambahkan:
   `http://localhost:3000/api/integrations/google/callback`
   *(Pastikan port 3000 dan path sesuai persis, tanpa spasi atau trailing slash)*.
4. Masukkan Client ID dan Secret ke `.env`:
   ```env
   GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=xxx
   ```

### B. Zoom Meetings
1. Buka Zoom Marketplace (`marketplace.zoom.us`) dan buka pengaturan OAuth App Anda.
2. Pada tab **App Credentials**, setel:
   - **OAuth Redirect URL:** `http://localhost:3000/api/integrations/zoom/callback`
   - **OAuth Allow Lists:** `http://localhost:3000`
3. Masukkan Client ID dan Secret ke `.env`:
   ```env
   ZOOM_CLIENT_ID=xxx
   ZOOM_CLIENT_SECRET=xxx
   ```

### C. Telegram Bot — Pengiriman Keluar Nyata Belum Diimplementasikan
1. Hubungi `@BotFather` di Telegram untuk membuat bot baru (`/newbot`).
2. Salin token bot yang diberikan ke `.env`:
   ```env
   TELEGRAM_BOT_TOKEN=xxx:yyy
   TELEGRAM_OWNER_USER_ID=<ID-numerik-Telegram-Anda>
   ```

---

## 6. Akses dari iPhone (Safari Web vs Native AlarmKit)

### A. Membuka Workspace di Safari iPhone (Jalur Cepat Tanpa App Native)
Untuk membuka web workspace dari iPhone Anda:
1. Pastikan PC Windows dan iPhone Anda terhubung ke **jaringan Wi-Fi yang sama**.
2. Cari alamat IP lokal (IPv4) PC Anda di PowerShell:
   ```powershell
   (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias "Wi-Fi").IPAddress
   # Contoh hasil: 192.168.1.15
   ```
3. Buka browser Safari di iPhone dan ketik:  
   `http://192.168.1.15:3000` (atau gunakan jalur HTTPS privat seperti Tailscale jika sudah disiapkan).
4. Masuk menggunakan email pemilik, password, dan kode TOTP.  
   *(Catatan: `localhost` pada iPhone merujuk ke iPhone itu sendiri, bukan ke PC).*
5. **Penting:** Akses web di Safari ini adalah untuk dashboard, tugas, kalender, dan pertemuan. Ini **bukan** pengganti alarm native dan tidak mengaktifkan fitur AlarmKit.

### B. Status Aplikasi Native iOS AlarmKit (Spesifikasi & Roadmap)
Aplikasi native di `apps/ios` saat ini berstatus **BLOCKED_PHYSICAL / PROTOTYPE**:
- Kode Swift saat ini masih menggunakan konfigurasi loopback dan simulasi otorisasi AlarmKit.
- Alur login/pairing native dengan backend dan penyimpanan token di Keychain belum diimplementasikan lengkap.
- Workflow GitHub Actions saat ini belum mengompilasi file IPA nyata yang dapat langsung diinstal.
- Sideloading dan pengujian AlarmKit berdering keras saat layar terkunci akan dilakukan pada milestone native tersendiri.

