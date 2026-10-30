export interface GoogleTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  scope: string;
}

export interface GoogleProfile {
  sub: string;
  email: string;
  name?: string;
}

export class GoogleOAuthProvider {
  private readonly authUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
  private readonly tokenUrl = 'https://oauth2.googleapis.com/token';
  private readonly userinfoUrl = 'https://openidconnect.googleapis.com/v1/userinfo';
  private readonly calendarListUrl = 'https://www.googleapis.com/calendar/v3/users/me/calendarList';
  private readonly revokeUrl = 'https://oauth2.googleapis.com/revoke';

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
  ) {}

  isConfigured(): boolean {
    return !!this.clientId && !!this.clientSecret;
  }

  buildAuthorizationUrl(redirectUri: string, state: string): string {
    const scopes = [
      'openid',
      'email',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.readonly',
    ].join(' ');

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes,
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    return `${this.authUrl}?${params.toString()}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<GoogleTokens> {
    const body = new URLSearchParams({
      code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    const res = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Google token exchange failed (${res.status}): ${err.error_description || err.error || 'Unknown error'}`);
    }

    const json = await res.json();
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresIn: json.expires_in,
      scope: json.scope || '',
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    const body = new URLSearchParams({
      refresh_token: refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: 'refresh_token',
    });

    const res = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Google token refresh failed: ${err.error_description || err.error || 'Token expired or revoked'}`);
    }

    const json = await res.json();
    return {
      accessToken: json.access_token,
      expiresIn: json.expires_in,
    };
  }

  async fetchUserProfile(accessToken: string): Promise<GoogleProfile> {
    const res = await fetch(this.userinfoUrl, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch Google user profile (${res.status})`);
    }

    const json = await res.json();
    if (!json.sub) {
      throw new Error('Missing Google user subject ID');
    }

    return {
      sub: json.sub,
      email: json.email || '',
      name: json.name,
    };
  }

  async testCalendarAccess(accessToken: string): Promise<{ calendarCount: number }> {
    const res = await fetch(this.calendarListUrl, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      throw new Error(`Google Calendar access test failed (${res.status})`);
    }

    const json = await res.json();
    return { calendarCount: Array.isArray(json.items) ? json.items.length : 0 };
  }

  async revoke(token: string): Promise<void> {
    try {
      await fetch(this.revokeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token }).toString(),
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      // Best-effort revocation
    }
  }

  validateScopes(grantedScopeStr: string): boolean {
    const granted = new Set(grantedScopeStr.split(/\s+/));
    const required = [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.readonly',
    ];
    return required.every((req) => granted.has(req));
  }
}
