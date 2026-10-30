import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as connectPost } from '../src/app/api/integrations/[provider]/connect/route';
import { GET as callbackGet } from '../src/app/api/integrations/[provider]/callback/route';
import { GET as continueGet } from '../src/app/api/integrations/oauth/continue/route';
import { POST as completePost } from '../src/app/api/integrations/[provider]/complete/route';

const upstream = vi.fn();
beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('APP_ORIGIN', 'http://localhost:3000');
  vi.stubEnv('PAW_API_URL', 'http://127.0.0.1:4000/api/v1/');
  vi.stubGlobal('fetch', upstream);
  upstream.mockReset();
});

describe('Integrations BFF OAuth lifecycle routes', () => {
  const providerContext = (provider = 'google') => ({
    params: Promise.resolve({ provider }),
  });

  describe('Connect route (POST /api/integrations/[provider]/connect)', () => {
    it('requires an active session cookie', async () => {
      const req = new NextRequest('http://localhost:3000/api/integrations/google/connect', {
        method: 'POST',
      });
      const res = await connectPost(req, providerContext('google'));
      expect(res.status).toBe(401);
      expect(upstream).not.toHaveBeenCalled();
    });

    it('rejects foreign origin mutation', async () => {
      const req = new NextRequest('http://localhost:3000/api/integrations/google/connect', {
        method: 'POST',
        headers: {
          cookie: 'paw_session=valid-session-token',
          origin: 'https://evil.attacker.com',
        },
      });
      const res = await connectPost(req, providerContext('google'));
      expect(res.status).toBe(403);
      expect(upstream).not.toHaveBeenCalled();
    });

    it('returns authorization URL and sets HttpOnly SameSite=Lax binding cookie', async () => {
      upstream.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?state=xyz',
              bindingToken: 'binding-secret-123',
              transactionId: 'tx-uuid-456',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const req = new NextRequest('http://localhost:3000/api/integrations/google/connect', {
        method: 'POST',
        headers: {
          cookie: 'paw_session=valid-session-token',
          origin: 'http://localhost:3000',
        },
      });
      const res = await connectPost(req, providerContext('google'));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.authorizationUrl).toContain('accounts.google.com');

      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).toContain('paw_oauth_binding=tx-uuid-456%3Abinding-secret-123');
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('SameSite=lax');
    });
  });

  describe('Callback route (GET /api/integrations/[provider]/callback)', () => {
    it('redirects to settings with error if provider returned error or code is missing', async () => {
      const req = new NextRequest(
        'http://localhost:3000/api/integrations/google/callback?error=access_denied',
      );
      const res = await callbackGet(req, providerContext('google'));
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/settings?integration=google&error=access_denied');
    });

    it('stages code on upstream Nest API and redirects to continuation route', async () => {
      upstream.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: { flowId: 'flow-staged-789' } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const req = new NextRequest(
        'http://localhost:3000/api/integrations/google/callback?code=google-auth-code&state=expected-state',
        {
          headers: {
            cookie: 'paw_oauth_binding=tx-uuid-456:binding-secret-123',
          },
        },
      );
      const res = await callbackGet(req, providerContext('google'));
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe(
        'http://localhost:3000/api/integrations/oauth/continue?flowId=flow-staged-789&provider=google',
      );
      expect(upstream).toHaveBeenCalledWith(
        expect.stringContaining('/integrations/google/oauth/stage'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            transactionId: 'tx-uuid-456',
            bindingToken: 'binding-secret-123',
            state: 'expected-state',
            code: 'google-auth-code',
          }),
        }),
      );
    });
  });

  describe('Continuation route (GET /api/integrations/oauth/continue)', () => {
    it('serves a minimal same-origin HTML document that completes authorization', async () => {
      const req = new NextRequest(
        'http://localhost:3000/api/integrations/oauth/continue?flowId=flow-staged-789&provider=google',
      );
      const res = await continueGet(req);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/html');
      const html = await res.text();
      expect(html).toContain('Menyelesaikan Sambungan Akun');
      expect(html).toContain('/api/integrations/google/complete');
      expect(html).toContain('flow-staged-789');
    });
  });

  describe('Complete route (POST /api/integrations/[provider]/complete)', () => {
    it('requires the SameSite=Strict session cookie to complete account attachment', async () => {
      const req = new NextRequest('http://localhost:3000/api/integrations/google/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          origin: 'http://localhost:3000',
        },
        body: JSON.stringify({ flowId: 'flow-staged-789' }),
      });
      const res = await completePost(req, providerContext('google'));
      expect(res.status).toBe(401);
      expect(upstream).not.toHaveBeenCalled();
    });

    it('forwards session bearer and claims staged flow on Nest API', async () => {
      upstream.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              success: true,
              provider: 'google',
              account: { email: 'owner@gmail.com', displayName: 'Workspace Owner' },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const req = new NextRequest('http://localhost:3000/api/integrations/google/complete', {
        method: 'POST',
        headers: {
          cookie: 'paw_session=valid-session-token',
          origin: 'http://localhost:3000',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ flowId: 'flow-staged-789' }),
      });
      const res = await completePost(req, providerContext('google'));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.success).toBe(true);
      expect(json.data.account.email).toBe('owner@gmail.com');

      expect(upstream).toHaveBeenCalledWith(
        expect.stringContaining('/integrations/google/oauth/complete'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer valid-session-token',
          }),
          body: JSON.stringify({ flowId: 'flow-staged-789' }),
        }),
      );
    });
  });
});
