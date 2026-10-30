import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const COOKIE = process.env.NODE_ENV === 'production' ? '__Host-paw_session' : 'paw_session';
const PUBLIC_POSTS = new Set(['auth/setup', 'auth/login', 'auth/mfa/verify', 'auth/mfa/enroll/verify']);
const ROOTS = new Set(['auth', 'me', 'tasks', 'projects', 'calendar', 'meetings', 'reminders', 'devices', 'stats', 'integrations', 'approvals', 'agents', 'workflows']);
const NO_STORE = { 'Cache-Control': 'no-store, private', Pragma: 'no-cache' };

function error(message: string, status: number) {
  return NextResponse.json({ error: { message } }, { status, headers: NO_STORE });
}

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  if (!path.length || !ROOTS.has(path[0]!) || path.some((part) => !/^[A-Za-z0-9_-]+$/.test(part))) return error('Not found', 404);
  const endpoint = path.join('/');
  if (endpoint === 'auth/dev-session') return error('Not found', 404);
  const method = request.method;
  const mutation = !['GET', 'HEAD'].includes(method);
  let origin: URL;
  let upstream: URL;
  try {
    origin = new URL(process.env.APP_ORIGIN || 'http://localhost:3000');
    upstream = new URL(process.env.PAW_API_URL || 'http://127.0.0.1:4000/api/v1/');
    if (!['http:', 'https:'].includes(upstream.protocol) || upstream.username || upstream.password || upstream.search || upstream.hash || origin.pathname !== '/' || origin.search || origin.hash || (process.env.NODE_ENV === 'production' && origin.protocol !== 'https:')) throw new Error();
  } catch { return error('Service configuration unavailable', 503); }
  // The configured origin is authoritative, never an untrusted Host/X-Forwarded-Host.
  if (mutation && (request.headers.get('origin') !== origin.origin || request.headers.get('sec-fetch-site') === 'cross-site')) return error('Request origin is not allowed', 403);
  const session = request.cookies.get(COOKIE)?.value;
  if (!(method === 'POST' && PUBLIC_POSTS.has(endpoint)) && !session) return error('Authentication required', 401);
  const headers = new Headers({ Accept: 'application/json' });
  if (session) headers.set('Authorization', `Bearer ${session}`);
  if (mutation) {
    headers.set('Origin', origin.origin);
    if (!request.headers.get('content-type')?.startsWith('application/json') && method !== 'DELETE') return error('JSON request required', 415);
    headers.set('Content-Type', 'application/json');
  }
  for (const name of ['if-match', 'idempotency-key']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  let body: string | undefined;
  if (mutation && request.body) {
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 65536) { await reader.cancel(); return error('Request too large', 413); }
      chunks.push(chunk.value);
    }
    body = Buffer.concat(chunks).toString('utf8');
  }
  // Construct from a fixed server-owned URL; no redirects, cookies or credentials
  // from the browser are forwarded upstream except the opaque session above.
  const url = `${upstream.toString().replace(/\/$/, '')}/${path.map(encodeURIComponent).join('/')}${request.nextUrl.search}`;
  try {
    const response = await fetch(url, { method, headers, body, cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(15000) });
    if (response.status >= 300 && response.status < 400) return error('Unexpected service response', 502);
    if (response.status >= 500) return error('Service unavailable. Try again later.', 503);
    const payload = response.status === 204 ? null : await response.json();
    // Secrets used only by native clients never enter browser response JSON.
    const accessToken = payload?.data?.accessToken;
    if (payload?.data) delete payload.data.accessToken;
    const result = response.status === 204
      ? new NextResponse(null, { status: 204, headers: NO_STORE })
      : NextResponse.json(payload, { status: response.status, headers: NO_STORE });
    if (response.ok && typeof accessToken === 'string' && (endpoint === 'auth/mfa/verify' || endpoint === 'auth/mfa/enroll/verify')) {
      const expires = new Date(payload.data.expiresAt);
      if (!Number.isFinite(expires.getTime()) || expires.getTime() <= Date.now()) return error('Unexpected service response', 502);
      result.cookies.set(COOKIE, accessToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', expires });
    }
    if (response.status === 401 || (endpoint === 'auth/logout' && response.ok)) result.cookies.set(COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 0 });
    return result;
  } catch { return error('Authentication service unavailable. Try again later.', 503); }
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
