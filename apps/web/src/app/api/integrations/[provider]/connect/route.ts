import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = {
  'Cache-Control': 'no-store, private',
  Pragma: 'no-cache',
  'Referrer-Policy': 'no-referrer',
};

const BINDING_COOKIE = 'paw_oauth_binding';
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

  const upstream = new URL(process.env.PAW_API_URL || 'http://127.0.0.1:4000/api/v1/');
  try {
    const response = await fetch(`${upstream.toString().replace(/\/$/, '')}/integrations/${provider}/connect`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: { message: errData.error?.message || 'Failed to initiate authorization' } },
        { status: response.status, headers: NO_STORE },
      );
    }

    const payload = await response.json();
    const { authorizationUrl, bindingToken, transactionId } = payload.data || {};
    if (!authorizationUrl || !bindingToken || !transactionId) {
      return NextResponse.json({ error: { message: 'Invalid provider initialization' } }, { status: 502, headers: NO_STORE });
    }

    // Set short-lived HttpOnly SameSite=Lax binding cookie for the cross-site OAuth redirect return
    const bindingValue = `${transactionId}:${bindingToken}`;
    const result = NextResponse.json({ data: { authorizationUrl } }, { status: 200, headers: NO_STORE });
    result.cookies.set(BINDING_COOKIE, bindingValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 600, // 10 minutes
    });

    return result;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Integration service unavailable';
    return NextResponse.json({ error: { message: msg } }, { status: 503, headers: NO_STORE });
  }
}
