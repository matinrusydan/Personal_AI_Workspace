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

/**
 * Cross-site top-level GET callback from OAuth provider (Google or Zoom).
 * Receives code & state with Lax binding cookie (Strict session cookie omitted by browser on cross-site GET).
 * Stages the code on Nest API, clears binding cookie, and redirects to same-origin continuation document.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider } = await context.params;
  const baseUrl = process.env.APP_ORIGIN || 'http://localhost:3000';

  if (!VALID_PROVIDERS.has(provider)) {
    return NextResponse.redirect(`${baseUrl}/settings?error=unsupported_provider`);
  }

  const { searchParams } = request.nextUrl;
  const errorParam = searchParams.get('error');
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (errorParam || !code || !state) {
    const res = NextResponse.redirect(`${baseUrl}/settings?integration=${provider}&error=${encodeURIComponent(errorParam || 'missing_code')}`);
    res.cookies.set(BINDING_COOKIE, '', { path: '/', maxAge: 0 });
    return res;
  }

  const bindingCookie = request.cookies.get(BINDING_COOKIE)?.value;
  if (!bindingCookie || !bindingCookie.includes(':')) {
    const res = NextResponse.redirect(`${baseUrl}/settings?integration=${provider}&error=invalid_binding`);
    res.cookies.set(BINDING_COOKIE, '', { path: '/', maxAge: 0 });
    return res;
  }

  const [transactionId, bindingToken] = bindingCookie.split(':');
  const upstream = new URL(process.env.PAW_API_URL || 'http://127.0.0.1:4000/api/v1/');

  try {
    const stageRes = await fetch(`${upstream.toString().replace(/\/$/, '')}/integrations/${provider}/oauth/stage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        transactionId,
        bindingToken,
        state,
        code,
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });

    if (!stageRes.ok) {
      const errPayload = await stageRes.json().catch(() => ({}));
      const msg = errPayload.error?.message || 'staging_failed';
      const res = NextResponse.redirect(`${baseUrl}/settings?integration=${provider}&error=${encodeURIComponent(msg)}`);
      res.cookies.set(BINDING_COOKIE, '', { path: '/', maxAge: 0 });
      return res;
    }

    const payload = await stageRes.json();
    const flowId = payload.data?.flowId;
    if (!flowId) {
      const res = NextResponse.redirect(`${baseUrl}/settings?integration=${provider}&error=invalid_stage_response`);
      res.cookies.set(BINDING_COOKIE, '', { path: '/', maxAge: 0 });
      return res;
    }

    // Redirect to clean same-origin continuation route
    const res = NextResponse.redirect(`${baseUrl}/api/integrations/oauth/continue?flowId=${encodeURIComponent(flowId)}&provider=${encodeURIComponent(provider)}`);
    res.cookies.set(BINDING_COOKIE, '', { path: '/', maxAge: 0 });
    return res;
  } catch {
    const res = NextResponse.redirect(`${baseUrl}/settings?integration=${provider}&error=upstream_unavailable`);
    res.cookies.set(BINDING_COOKIE, '', { path: '/', maxAge: 0 });
    return res;
  }
}
