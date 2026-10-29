/**
 * Client-Side API Helper connecting apps/web to apps/api on http://127.0.0.1:4000/api/v1
 * All CRUD mutations query and mutate PostgreSQL 16 directly via REST API.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000/api/v1';

let cachedToken: string | null = null;

export async function getValidAuthToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;

  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('paw_access_token');
      if (stored) {
        cachedToken = stored;
        return stored;
      }
    } catch {
      // Ignore localStorage restrictions
    }

    // In local development, automatically bootstrap dev session if no token is stored
    try {
      const resp = await fetch(`${API_BASE}/auth/dev-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (resp.ok) {
        const json = await resp.json();
        const token = json.data?.accessToken;
        if (token) {
          cachedToken = token;
          try {
            localStorage.setItem('paw_access_token', token);
          } catch {
            // Ignore
          }
          return token;
        }
      }
    } catch {
      // Backend might be starting
    }
  }

  return null;
}

export async function apiRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const token = await getValidAuthToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMsg = `API request failed with status ${response.status}`;
    try {
      const errJson = await response.json();
      errorMsg = errJson.error?.message || errJson.message || errorMsg;
    } catch {
      // Ignore
    }
    throw new Error(errorMsg);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// Auth API
export const authApi = {
  getDevSession: () =>
    apiRequest<{ data: { accessToken: string; user: { id: string; email: string } } }>(
      '/auth/dev-session',
      {
        method: 'POST',
      },
    ),
  login: (email: string, passwordPlain: string) =>
    apiRequest<{ data: { mfaRequired: boolean; ticket: string } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: passwordPlain }),
    }),
  verifyMfa: (ticket: string, code: string) =>
    apiRequest<{ data: { accessToken: string; expiresAt: string } }>('/auth/mfa/verify', {
      method: 'POST',
      body: JSON.stringify({ ticket, code }),
    }),
  logout: () => apiRequest('/auth/logout', { method: 'POST' }),
  getMe: () => apiRequest<{ data: { id: string; email: string; timezone: string } }>('/me'),
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
  }) => apiRequest<{ data: any }>('/meetings', { method: 'POST', body: JSON.stringify(data) }),
  update: (
    id: string,
    data: { title?: string; startsAt?: string; endsAt?: string; timezone?: string },
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
