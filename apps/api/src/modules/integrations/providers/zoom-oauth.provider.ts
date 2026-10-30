export interface ZoomTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  scope: string;
}

export interface ZoomProfile {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

export class ZoomOAuthProvider {
  private readonly authUrl = 'https://zoom.us/oauth/authorize';
  private readonly tokenUrl = 'https://zoom.us/oauth/token';
  private readonly userProfileUrl = 'https://api.zoom.us/v2/users/me';
  private readonly revokeUrl = 'https://zoom.us/oauth/revoke';

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
  ) {}

  isConfigured(): boolean {
    return !!this.clientId && !!this.clientSecret;
  }

  private getBasicAuthHeader(): string {
    const creds = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    return `Basic ${creds}`;
  }

  buildAuthorizationUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      state,
    });
    return `${this.authUrl}?${params.toString()}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<ZoomTokens> {
    const body = new URLSearchParams({
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    const res = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: this.getBasicAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Zoom token exchange failed (${res.status}): ${err.reason || err.error || 'Unknown error'}`);
    }

    const json = await res.json();
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresIn: json.expires_in,
      scope: json.scope || '',
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; refreshToken?: string; expiresIn: number }> {
    const body = new URLSearchParams({
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    const res = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: this.getBasicAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Zoom token refresh failed: ${err.reason || err.error || 'Token expired or revoked'}`);
    }

    const json = await res.json();
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresIn: json.expires_in,
    };
  }

  async fetchUserProfile(accessToken: string): Promise<ZoomProfile> {
    const res = await fetch(this.userProfileUrl, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch Zoom user profile (${res.status})`);
    }

    const json = await res.json();
    if (!json.id) {
      throw new Error('Missing Zoom user ID');
    }

    return {
      id: json.id,
      email: json.email || '',
      firstName: json.first_name,
      lastName: json.last_name,
    };
  }

  async revoke(token: string): Promise<void> {
    try {
      await fetch(this.revokeUrl, {
        method: 'POST',
        headers: {
          Authorization: this.getBasicAuthHeader(),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ token }).toString(),
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      // Best-effort
    }
  }
}
