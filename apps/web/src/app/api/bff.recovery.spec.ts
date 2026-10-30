import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from './[...path]/route';

const context = (path: string) => ({ params: Promise.resolve({ path: path.split('/') }) });
const upstream = vi.fn();
beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('APP_ORIGIN', 'http://localhost:3000');
  vi.stubGlobal('fetch', upstream);
  upstream.mockReset();
});

it('rejects unauthenticated requests and removed bypass without calling the API', async () => {
  const response = await GET(new NextRequest('http://localhost:3000/api/me'), context('me'));
  expect(response.status).toBe(401);
  expect((await POST(new NextRequest('http://localhost:3000/api/auth/dev-session', { method: 'POST' }), context('auth/dev-session'))).status).toBe(404);
  expect(upstream).not.toHaveBeenCalled();
});

it('rejects cross-origin and missing-Origin mutations', async () => {
  for (const origin of [undefined, 'https://attacker.invalid']) {
    const request = new NextRequest('http://localhost:3000/api/auth/login', { method: 'POST', headers: origin ? { origin } : {} });
    expect((await POST(request, context('auth/login'))).status).toBe(403);
  }
  expect(upstream).not.toHaveBeenCalled();
});

it('stores token in an HttpOnly cookie and removes it from browser JSON', async () => {
  upstream.mockResolvedValue(new Response(JSON.stringify({ data: { accessToken: 'opaque-test-token', expiresAt: new Date(Date.now() + 3600_000).toISOString() } }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  const request = new NextRequest('http://localhost:3000/api/auth/mfa/verify', { method: 'POST', headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' }, body: JSON.stringify({ ticket: 'test', code: '123456' }) });
  const response = await POST(request, context('auth/mfa/verify'));
  expect(response.status).toBe(200);
  expect(response.headers.get('set-cookie')).toContain('HttpOnly');
  expect(response.headers.get('set-cookie')).toContain('SameSite=strict');
  expect((await response.json()).data.accessToken).toBeUndefined();
  expect(response.headers.get('cache-control')).toContain('no-store');
});

it('forwards only the session cookie as bearer and clears revoked cookies', async () => {
  upstream.mockResolvedValue(new Response(JSON.stringify({ error: { message: 'Authentication required' } }), { status: 401 }));
  const response = await GET(new NextRequest('http://localhost:3000/api/me', { headers: { cookie: 'paw_session=stored-token', authorization: 'Bearer attacker-token' } }), context('me'));
  expect(upstream.mock.calls[0]![1].headers.get('Authorization')).toBe('Bearer stored-token');
  expect(response.status).toBe(401);
  expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
});

it('does not follow upstream redirects or expose internal service errors', async () => {
  upstream.mockResolvedValue(new Response('sensitive service internals', { status: 500 }));
  const response = await GET(new NextRequest('http://localhost:3000/api/me', { headers: { cookie: 'paw_session=test' } }), context('me'));
  expect(response.status).toBe(503);
  expect(JSON.stringify(await response.json())).not.toContain('sensitive');
  expect(upstream.mock.calls[0]![1].redirect).toBe('manual');
});
