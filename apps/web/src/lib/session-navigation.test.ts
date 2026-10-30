import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from './api';
import { loginRedirectPath, redirectToLogin } from '../components/shared/SessionContext';

// No browser credentials, real network requests, or database mutations in this suite.
afterEach(() => vi.unstubAllGlobals());

describe('session navigation boundaries', () => {
  it('uses document replacement instead of the client router after session loss', () => {
    const replace = vi.fn();
    vi.stubGlobal('window', { location: { replace } });
    redirectToLogin('/settings');
    expect(replace).toHaveBeenCalledExactlyOnceWith('/login?redirect=%2Fsettings');
    expect(loginRedirectPath('//attacker.invalid')).toBe('/login?redirect=%2F');
  });

  it('notifies the shell when a protected request loses its cookie session', async () => {
    const dispatchEvent = vi.fn();
    vi.stubGlobal('window', { dispatchEvent });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: { message: 'Authentication required' } }), { status: 401 },
    )));
    await expect(apiRequest('/tasks')).rejects.toMatchObject({ status: 401 });
    expect(dispatchEvent).toHaveBeenCalledTimes(1);
    expect(dispatchEvent.mock.calls[0]![0].type).toBe('paw:unauthorized');
  });

  it.each(['/auth/login', '/auth/mfa/verify'])('keeps failed %s on the authentication form', async (path) => {
    const dispatchEvent = vi.fn();
    vi.stubGlobal('window', { dispatchEvent });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));
    await expect(apiRequest(path, { method: 'POST' })).rejects.toMatchObject({ status: 401 });
    expect(dispatchEvent).not.toHaveBeenCalled();
  });

  it('does not redirect on a service failure or claim that logout succeeded', async () => {
    const dispatchEvent = vi.fn();
    vi.stubGlobal('window', { dispatchEvent });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 503 })));
    await expect(apiRequest('/tasks')).rejects.toMatchObject({ status: 503 });
    expect(dispatchEvent).not.toHaveBeenCalled();
  });
});
