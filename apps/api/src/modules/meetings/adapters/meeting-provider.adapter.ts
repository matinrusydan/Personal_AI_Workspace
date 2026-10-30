export type MeetingProviderType = 'google-meet' | 'zoom';
export type ProvisioningStatus = 'provisioning' | 'confirmed' | 'failed';

export interface CreateMeetingParams {
  title: string;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
}

export interface ProviderMeetingResult {
  externalMeetingId: string;
  joinUrl: string;
  status: ProvisioningStatus;
  providerData?: Record<string, unknown>;
}

export interface IMeetingProviderAdapter {
  readonly provider: MeetingProviderType;
  createMeeting(params: CreateMeetingParams): Promise<ProviderMeetingResult>;
  cancelMeeting(externalMeetingId: string): Promise<boolean>;
  checkHealth(): Promise<boolean>;
}

/**
 * Google Meet Provider Adapter (P0 MVP)
 * Creates Google Meet via calendar conferenceData specification (docs/INTEGRATIONS.md)
 */
export class GoogleMeetAdapter implements IMeetingProviderAdapter {
  readonly provider: MeetingProviderType = 'google-meet';

  async createMeeting(_params: CreateMeetingParams): Promise<ProviderMeetingResult> {
    throw new Error('Google Calendar OAuth is not connected. Connect Google in Settings before provisioning Meet.');
  }

  async cancelMeeting(_externalMeetingId: string): Promise<boolean> {
    throw new Error('Google Calendar OAuth is not connected. Cannot cancel the provider meeting.');
  }

  async checkHealth(): Promise<boolean> {
    return false;
  }
}

/**
 * Zoom Meetings Provider Adapter (P0 MVP)
 * Fails closed until a real OAuth API implementation and token are configured.
 */
export class ZoomMeetingAdapter implements IMeetingProviderAdapter {
  readonly provider: MeetingProviderType = 'zoom';

  async createMeeting(_params: CreateMeetingParams): Promise<ProviderMeetingResult> {
    throw new Error('Zoom OAuth is not connected. Connect Zoom in Settings before provisioning a meeting.');
  }

  async cancelMeeting(_externalMeetingId: string): Promise<boolean> {
    throw new Error('Zoom OAuth is not connected. Cannot cancel the provider meeting.');
  }

  async checkHealth(): Promise<boolean> {
    return false;
  }
}
