import { NextRequest, NextResponse } from 'next/server';

const NO_STORE = { 'Cache-Control': 'no-store, private' };

export async function middleware(request: NextRequest) {
  const cookieName = process.env.NODE_ENV === 'production' ? '__Host-paw_session' : 'paw_session';
  const token = request.cookies.get(cookieName)?.value;
  const signIn = () => {
    const url = new URL('/login', request.url);
    url.searchParams.set('redirect', `${request.nextUrl.pathname}${request.nextUrl.search}`);
    const response = NextResponse.redirect(url);
    response.headers.set('Cache-Control', 'no-store, private');
    response.cookies.set(cookieName, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 0,
    });
    return response;
  };

  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return signIn();
  try {
    const upstream = new URL(process.env.PAW_API_URL || 'http://127.0.0.1:4000/api/v1/');
    if (!['http:', 'https:'].includes(upstream.protocol) || upstream.username || upstream.password || upstream.search || upstream.hash) {
      throw new Error('Invalid API configuration');
    }
    const response = await fetch(`${upstream.toString().replace(/\/$/, '')}/me`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(5000),
    });
    if (response.status === 401 || response.status === 403) return signIn();
    if (!response.ok) throw new Error('Session verification unavailable');
    const profile = await response.json();
    if (!profile?.data?.id || !profile?.data?.email) throw new Error('Invalid session response');
    const result = NextResponse.next();
    result.headers.set('Cache-Control', 'no-store, private');
    return result;
  } catch {
    // An unavailable API must not turn a revoked or unknown session into access.
    return new NextResponse('Verifikasi sesi tidak tersedia. Silakan coba lagi.', {
      status: 503,
      headers: { ...NO_STORE, 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

export const config = {
  matcher: ['/((?!api(?:/|$)|login(?:/|$)|setup(?:/|$)|_next(?:/|$)|favicon.ico$|manifest.json$|sw.js$|icons/).*)'],
};
