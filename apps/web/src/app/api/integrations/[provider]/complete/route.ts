import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = {
  'Cache-Control': 'no-store, private',
  Pragma: 'no-cache',
  'Referrer-Policy': 'no-referrer',
};

const VALID_PROVIDERS = new Set(['google', 'zoom']);

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider } = await context.params;
  if (!VALID_PROVIDERS.has(provider)) {
    return NextResponse.json({ error: { message: 'Provider not supported' } }, { status: 404, headers: NO_STORE });
  }

  const sessionCookie = process.env.NODE_ENV === 'production' ? '__Host-paw_session' : 'paw_session';
  const session = request.cookies.get(sessionCookie)?.value;
  if (!session) {
    return NextResponse.json({ error: { message: 'Authentication required' } }, { status: 401, headers: NO_STORE });
  }

  const configuredOrigin = process.env.APP_ORIGIN || 'http://localhost:3000';
  const originHeader = request.headers.get('origin');
  if (originHeader && originHeader !== new URL(configuredOrigin).origin) {
    return NextResponse.json({ error: { message: 'Request origin not allowed' } }, { status: 403, headers: NO_STORE });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { message: 'Invalid JSON request' } }, { status: 400, headers: NO_STORE });
  }

  const flowId = body['flowId'];
  if (typeof flowId !== 'string' || !flowId) {
    return NextResponse.json({ error: { message: 'Missing flow identifier' } }, { status: 400, headers: NO_STORE });
  }

  const upstream = new URL(process.env.PAW_API_URL || 'http://127.0.0.1:4000/api/v1/');
  try {
    const completeRes = await fetch(`${upstream.toString().replace(/\/$/, '')}/integrations/${provider}/oauth/complete`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ flowId }),
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });

    const payload = await completeRes.json().catch(() => ({}));
    if (!completeRes.ok) {
      return NextResponse.json(
        { error: { message: payload.error?.message || 'Failed to complete OAuth authorization' } },
        { status: completeRes.status, headers: NO_STORE },
      );
    }

    return NextResponse.json(payload, { status: 200, headers: NO_STORE });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Integration completion failed';
    return NextResponse.json({ error: { message: msg } }, { status: 503, headers: NO_STORE });
  }
}
