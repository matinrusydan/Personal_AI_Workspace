/** Browser requests use the same-origin BFF and HttpOnly cookies only. */
export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (path.startsWith('//') || path.includes('://')) throw new Error('Invalid API endpoint');
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  headers.delete('Authorization');
  const response = await fetch(`/api${path}`, { ...options, headers, credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const payload = await response.json();
      const detail = payload.error?.message || payload.message;
      if (typeof detail === 'string') message = detail;
    } catch { /* A non-JSON failure must still expose the HTTP status. */ }
    if (response.status === 401 && !path.startsWith('/auth/') && typeof window !== 'undefined') {
      window.dispatchEvent(new Event('paw:unauthorized'));
    }
    throw new ApiError(message, response.status);
  }
  return response.status === 204 ? ({} as T) : response.json();
}

export interface AuthChallenge {
  mfaRequired: true;
  enrollmentRequired: boolean;
  ticket: string;
  expiresIn: number;
  secret?: string;
  provisioningUri?: string;
}
export interface AuthProfile {
  id: string;
  email: string;
  timezone: string;
  defaultTimezone: string;
  locale: string;
}
export interface AuthSettings {
  profile: AuthProfile;
  sessions: { id: string; createdAt: string; expiresAt: string; deviceId: string | null; current: boolean }[];
  activeSessionsCount: number;
  mfa: { enabled: boolean; authenticatorsCount: number; recoveryCodesRemaining: number };
}
export interface AuthCompletion { expiresAt: string; recoveryCodes?: string[] }

export const authApi = {
  setup: (email: string, password: string, setupToken: string) =>
    apiRequest<{ data: AuthChallenge }>('/auth/setup', { method: 'POST', body: JSON.stringify({ email, password, setupToken }) }),
  login: (email: string, password: string) =>
    apiRequest<{ data: AuthChallenge }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  verifyMfa: (ticket: string, code: string) =>
    apiRequest<{ data: AuthCompletion }>('/auth/mfa/verify', { method: 'POST', body: JSON.stringify({ ticket, code }) }),
  verifyEnrollment: (ticket: string, code: string) =>
    apiRequest<{ data: AuthCompletion }>('/auth/mfa/enroll/verify', { method: 'POST', body: JSON.stringify({ ticket, code }) }),
  logout: () => apiRequest('/auth/logout', { method: 'POST' }),
  getMe: () => apiRequest<{ data: AuthProfile }>('/me'),
  settings: () => apiRequest<{ data: AuthSettings }>('/auth/settings'),
  updateProfile: (data: { timezone?: string; locale?: string }) =>
    apiRequest<{ data: AuthProfile }>('/auth/profile', { method: 'PATCH', body: JSON.stringify(data) }),
  revokeSession: (id: string) => apiRequest<{ success: boolean }>(`/auth/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};

// Tasks API (Full CRUD)
export const tasksApi = {
  list: (status?: string, projectId?: string) => {
    const params = new URLSearchParams();
    if (status && status !== 'all') params.append('status', status);
    if (projectId) params.append('projectId', projectId);
    const qs = params.toString();
    return apiRequest<{ data: any[] }>(qs ? `/tasks?${qs}` : '/tasks');
  },
  get: (id: string) => apiRequest<{ data: any }>(`/tasks/${id}`),
  create: (data: {
    title: string;
    description?: string | null;
    projectId?: string | null;
    priority?: string;
    dueAt?: string | null;
    tags?: string[];
  }) => apiRequest<{ data: any }>('/tasks', { method: 'POST', body: JSON.stringify(data) }),
  update: (
    id: string,
    data: {
      title?: string;
      description?: string | null;
      priority?: string;
      status?: string;
      dueAt?: string | null;
      tags?: string[];
      version?: number;
    },
  ) => apiRequest<{ data: any }>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) => apiRequest<{ success: boolean }>(`/tasks/${id}`, { method: 'DELETE' }),
};

// Projects API
export const projectsApi = {
  list: () => apiRequest<{ data: any[] }>('/projects'),
  create: (data: { title: string; colorToken?: string }) =>
    apiRequest<{ data: any }>('/projects', { method: 'POST', body: JSON.stringify(data) }),
  delete: (id: string) => apiRequest<{ data: any }>(`/projects/${id}`, { method: 'DELETE' }),
};

// Calendar API (Full CRUD)
export const calendarApi = {
  list: (from: string, to: string, calendarId?: string) => {
    const params = new URLSearchParams({ from, to });
    if (calendarId) params.append('calendarId', calendarId);
    return apiRequest<{ data: any[] }>(`/calendar/events?${params.toString()}`);
  },
  get: (id: string) => apiRequest<{ data: any }>(`/calendar/events/${id}`),
  create: (data: {
    title: string;
    startsAt: string;
    endsAt: string;
    timezone?: string;
    calendarId?: string;
  }) =>
    apiRequest<{ data: any }>('/calendar/events', { method: 'POST', body: JSON.stringify(data) }),
  update: (
    id: string,
    data: {
      title?: string;
      startsAt?: string;
      endsAt?: string;
      timezone?: string;
      status?: string;
      version?: number;
    },
  ) =>
    apiRequest<{ data: any }>(`/calendar/events/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    apiRequest<{ success: boolean }>(`/calendar/events/${id}`, { method: 'DELETE' }),
  syncGoogle: (calendarId: string) =>
    apiRequest<{ success: boolean; syncedCount: number }>('/integrations/google/sync', {
      method: 'POST',
      body: JSON.stringify({ calendarId }),
    }),
};

// Meetings API (Full CRUD)
export const meetingsApi = {
  list: () => apiRequest<{ data: any[] }>('/meetings'),
  get: (id: string) => apiRequest<{ data: any }>(`/meetings/${id}`),
  create: (data: {
    provider: string;
    title: string;
    startsAt: string;
    endsAt: string;
    timezone?: string;
    joinUrl?: string;
  }) => apiRequest<{ data: any }>('/meetings', { method: 'POST', body: JSON.stringify(data) }),
  update: (
    id: string,
    data: {
      title?: string;
      startsAt?: string;
      endsAt?: string;
      timezone?: string;
      joinUrl?: string;
    },
  ) =>
    apiRequest<{ data: any }>(`/meetings/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) => apiRequest<{ success: boolean }>(`/meetings/${id}`, { method: 'DELETE' }),
};

// Reminders API (Full CRUD)
export const remindersApi = {
  list: (status?: string) =>
    apiRequest<{ data: any[] }>(
      status && status !== 'all' ? `/reminders?status=${status}` : '/reminders',
    ),
  create: (data: {
    sourceType: string;
    sourceId: string;
    offsetMinutes: number;
    channelPolicy?: string;
  }) => apiRequest<{ data: any }>('/reminders', { method: 'POST', body: JSON.stringify(data) }),
  acknowledge: (occurrenceId: string, clientRequestId: string, deviceId?: string) =>
    apiRequest<{ success: boolean }>(`/reminders/${occurrenceId}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify({ clientRequestId, deviceId }),
    }),
  snooze: (occurrenceId: string, clientRequestId: string, minutes = 10, deviceId?: string) =>
    apiRequest<{ success: boolean }>(`/reminders/${occurrenceId}/snooze`, {
      method: 'POST',
      body: JSON.stringify({ clientRequestId, minutes, deviceId }),
    }),
  delete: (ruleId: string) =>
    apiRequest<{ success: boolean }>(`/reminders/${ruleId}`, { method: 'DELETE' }),
};

// Devices API (Registration & Listing)
export const devicesApi = {
  list: () => apiRequest<{ data: any[] }>('/devices'),
  register: (data: { platform: string; installId: string; deviceName?: string }) =>
    apiRequest<{ data: any }>('/devices/register', { method: 'POST', body: JSON.stringify(data) }),
  getAlarms: () => apiRequest<{ data: any[] }>('/devices/alarms'),
  reportStatus: (
    occurrenceId: string,
    data: { platformAlarmId?: string; status: string; errorMessage?: string },
  ) =>
    apiRequest<{ success: boolean }>(`/devices/alarms/${occurrenceId}/status`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// Integrations API
export type IntegrationProvider = 'google' | 'zoom' | 'telegram';
export type IntegrationStatusType =
  | 'NOT_CONFIGURED'
  | 'DISCONNECTED'
  | 'CONNECTED'
  | 'EXPIRED'
  | 'ERROR';

export interface IntegrationAccount {
  displayName?: string | null;
  email?: string | null;
  username?: string | null;
}

export interface IntegrationStatusItem {
  provider: IntegrationProvider;
  status: IntegrationStatusType;
  account?: IntegrationAccount | null;
  lastVerifiedAt?: string | null;
  lastTestedAt?: string | null;
  error?: {
    code: string;
    message: string;
    retryable?: boolean;
  } | null;
  configGuidance?: string | null;
}

export const integrationsApi = {
  list: () => apiRequest<{ data: IntegrationStatusItem[] }>('/integrations'),
  get: (provider: string) => apiRequest<{ data: IntegrationStatusItem }>(`/integrations/${provider}`),
  startConnect: (provider: 'google' | 'zoom') =>
    apiRequest<{ data: { authorizationUrl: string } }>(`/integrations/${provider}/connect`, {
      method: 'POST',
    }),
  test: (provider: string) =>
    apiRequest<{ data: { success: boolean; message: string; verifiedAt: string } }>(
      `/integrations/${provider}/test`,
      { method: 'POST' },
    ),
  disconnect: (provider: string) =>
    apiRequest<{ success: boolean }>(`/integrations/${provider}`, { method: 'DELETE' }),
  createTelegramPairing: () =>
    apiRequest<{
      data: {
        challengeId: string;
        manualCode: string;
        deepLink: string;
        expiresAt: string;
        botUsername: string;
      };
    }>('/integrations/telegram/pairings', { method: 'POST' }),
  getTelegramPairingStatus: (challengeId: string) =>
    apiRequest<{ data: { status: 'pending' | 'paired' | 'expired' | 'canceled'; account?: IntegrationAccount } }>(
      `/integrations/telegram/pairings/${encodeURIComponent(challengeId)}`,
    ),
  cancelTelegramPairing: (challengeId: string) =>
    apiRequest<{ success: boolean }>(
      `/integrations/telegram/pairings/${encodeURIComponent(challengeId)}`,
      { method: 'DELETE' },
    ),
};

// Stats API
export const statsApi = {
  overview: () =>
    apiRequest<{
      data: {
        activeTasksCount: number;
        totalTasksCount: number;
        todayMeetingsCount: number;
        totalMeetingsCount: number;
        totalEventsCount: number;
        devicesCount: number;
        devices: any[];
        isIosDeviceReady: boolean;
        outboxPendingCount: number;
        systemHealth: string;
        asOf: string;
      };
    }>('/stats/overview'),
};

