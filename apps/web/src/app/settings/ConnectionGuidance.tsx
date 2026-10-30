'use client';

import { useState } from 'react';

function GuideSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface-subtle p-4 sm:p-5">
      <h3 className="font-semibold text-text-primary">{title}</h3>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-text-secondary">{children}</div>
    </section>
  );
}

export function ConnectionGuidance() {
  const [open, setOpen] = useState(true);

  return (
    <section
      aria-labelledby="connection-guidance-title"
      className="space-y-4 rounded-xl border border-border bg-surface p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="connection-guidance-title" className="text-base font-semibold">
            Koneksi iPhone dan layanan
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-text-secondary">
            Panduan dan status di bawah ini bukan bukti koneksi aktif. Tidak ada pengaturan jaringan
            atau akun eksternal yang diubah dari halaman ini.
          </p>
        </div>
        <button
          type="button"
          className="min-h-touch rounded-md border border-border px-3 py-2 text-sm font-medium text-text-primary hover:bg-surface-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-focusRing"
          aria-expanded={open}
          aria-controls="connection-guidance-content"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? 'Sembunyikan panduan' : 'Tampilkan panduan'}
        </button>
      </div>

      {open ? (
        <div id="connection-guidance-content" className="space-y-3">
          <GuideSection title="Safari di iPhone — mulai dari Wi-Fi yang sama">
            <p>
              <code>localhost</code> dan <code>127.0.0.1</code> di iPhone menunjuk ke iPhone itu
              sendiri, bukan PC. Untuk mencoba, gunakan alamat LAN PC dan port web (biasanya{' '}
              <code>3000</code>) dari Safari,
              sementara PC dan iPhone berada di Wi-Fi yang sama.
            </p>
            <p>
              Ini belum dikonfigurasi atau diuji dari perangkat Anda. Login dan pendaftaran browser
              juga memerlukan routing API, origin yang cocok, cookies, dan secure context; membuka
              halaman saja tidak membuktikan alur tersebut berfungsi. Jangan membuka PostgreSQL atau
              Redis ke jaringan.
            </p>
          </GuideSection>

          <GuideSection title="Akses privat HTTPS — opsi berikutnya">
            <p>
              Tailscale Serve dapat menjadi opsi HTTPS privat untuk perangkat yang diizinkan pada
              tailnet yang sama. Ini perlu setup dan verifikasi terpisah untuk web, API, origin, dan
              akses akun; saat ini belum disiapkan.
            </p>
            <p>
              Tunnel publik tidak diperlukan untuk mulai di Safari dan tidak disarankan tanpa
              persetujuan serta tinjauan keamanan tersendiri.
            </p>
          </GuideSection>

          <GuideSection title="Safari bukan aplikasi alarm native">
            <p>
              Safari membuka dashboard web saja. Ia tidak memasangkan aplikasi iOS native dan tidak
              membuktikan AlarmKit siap atau alarm akan berbunyi. Aplikasi native saat ini belum
              memiliki alur login/pairing yang lengkap dan jadwal alarm nyata belum diverifikasi di
              iPhone fisik.
            </p>
          </GuideSection>

          <GuideSection title="Mengapa koneksi layanan belum tersedia?">
            <p>
              <strong>Google Calendar/Meet dan Zoom:</strong> halaman ini belum memiliki alur OAuth,
              callback, penyimpanan/pembaruan token yang aman, maupun pemeriksaan API akun. Mengisi
              kredensial saja tidak menyelesaikan implementasi ini.
            </p>
            <p>
              <strong>Telegram:</strong> koneksi bot memerlukan konfigurasi dan pairing penerima serta
              pengiriman pesan nyata yang terverifikasi; ini bukan sekadar OAuth.
            </p>
            <p>
              Status tetap “Not verified” dan tombol koneksi dinonaktifkan sampai alur itu dibangun
              dan diuji. Persetujuan akun atau konfigurasi operator mungkin diperlukan kemudian,
              tetapi belum cukup dengan sendirinya.
            </p>
          </GuideSection>
        </div>
      ) : null}
    </section>
  );
}
