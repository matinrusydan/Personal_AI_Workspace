import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from './middleware';

const upstream = vi.fn();
const cookie = `paw_session=${'a'.repeat(43)}`;
beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('PAW_API_URL', 'http://127.0.0.1:4000/api/v1/');
  vi.stubGlobal('fetch', upstream);
  upstream.mockReset();
});

describe('server navigation protection', () => {
  it('redirects anonymous requests before rendering any protected route', async () => {
    for (const path of ['/', '/tasks', '/calendar', '/meetings', '/reminders', '/settings', '/ai']) {
      const response = await middleware(new NextRequest(`http://localhost:3000${path}`));
      expect(response.status).toBe(307);
      const location = new URL(response.headers.get('location')!);
      expect(location.pathname).toBe('/login');
      expect(location.searchParams.get('redirect')).toBe(path);
      expect(response.headers.get('cache-control')).toContain('no-store');
    }
    expect(upstream).not.toHaveBeenCalled();
  });

  it('does not treat cookie presence as authentication', async () => {
    upstream.mockResolvedValue(new Response('{}', { status: 401 }));
    const response = await middleware(new NextRequest('http://localhost:3000/settings', { headers: { cookie } }));
    expect(response.status).toBe(307);
    expect(upstream.mock.calls[0]![1].headers.Authorization).toBe(`Bearer ${'a'.repeat(43)}`);
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
  });

  it('fails closed on API errors, redirects, or malformed account responses', async () => {
    for (const response of [new Response('{}', { status: 503 }), new Response(null, { status: 302 }), new Response('{}')]) {
      upstream.mockResolvedValue(response);
      const result = await middleware(new NextRequest('http://localhost:3000/', { headers: { cookie } }));
      expect(result.status).toBe(503);
    }
  });

  it('allows navigation only after server account verification', async () => {
    upstream.mockResolvedValue(new Response(JSON.stringify({ data: { id: 'owner-id', email: 'owner@private.workspace' } })));
    const response = await middleware(new NextRequest('http://localhost:3000/tasks', { headers: { cookie } }));
    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(upstream.mock.calls[0]![1].redirect).toBe('manual');
  });
});
