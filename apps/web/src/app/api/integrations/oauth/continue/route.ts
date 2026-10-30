import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const flowId = searchParams.get('flowId');
  const provider = searchParams.get('provider');

  if (!flowId || !provider || !['google', 'zoom'].includes(provider)) {
    return NextResponse.redirect(new URL('/settings?error=invalid_continuation', request.url));
  }

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>Menyelesaikan Otorisasi...</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f9fafb; color: #111827; }
    .card { background: white; padding: 2rem; border-radius: 0.75rem; border: 1px solid #e5e7eb; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); max-width: 24rem; text-align: center; }
    .spinner { width: 2rem; height: 2rem; border: 3px solid #e5e7eb; border-top-color: #2563eb; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 1rem; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <h2 style="font-size: 1.125rem; font-weight: 600; margin: 0 0 0.5rem;">Menyelesaikan Sambungan Akun</h2>
    <p style="font-size: 0.875rem; color: #6b7280; margin: 0;">Memverifikasi akun dan otorisasi sesi pemilik...</p>
  </div>
  <script>
    (async () => {
      try {
        const res = await fetch('/api/integrations/${encodeURIComponent(provider)}/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ flowId: '${encodeURIComponent(flowId)}' })
        });
        if (res.ok) {
          window.location.replace('/settings?integration=${encodeURIComponent(provider)}&status=connected');
        } else {
          const err = await res.json().catch(() => ({}));
          const msg = encodeURIComponent(err.error?.message || 'Gagal menyelesaikan integrasi');
          window.location.replace('/settings?integration=${encodeURIComponent(provider)}&error=' + msg);
        }
      } catch (e) {
        window.location.replace('/settings?integration=${encodeURIComponent(provider)}&error=connection_failed');
      }
    })();
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, private',
      'Referrer-Policy': 'no-referrer',
    },
  });
}
