import { beforeEach, describe, expect, it, vi } from 'vitest';

// No database client is imported or instantiated: all persistence/outbox calls are mocked.
const db = vi.hoisted(() => ({
  calendar: { findFirst: vi.fn(), create: vi.fn() },
  calendarEvent: { create: vi.fn(), update: vi.fn() },
  meeting: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(),
}));
const outbox = vi.hoisted(() => vi.fn());
vi.mock('@paw/database', () => ({ prisma: db, createOutboxEvent: outbox }));
vi.mock('../audit/audit.service', () => ({ AuditService: class {} }));

import { MeetingsService, CreateMeetingRequestDto } from './meetings.service';
import { GoogleMeetAdapter, ZoomMeetingAdapter } from './adapters/meeting-provider.adapter';
import { meetingLinkProvenance } from './meeting-validation';

const request: CreateMeetingRequestDto = {
  provider: 'google-meet', title: 'Team meeting',
  startsAt: '2026-10-30T02:00:00.000Z', endsAt: '2026-10-30T03:00:00.000Z', timezone: 'Asia/Jakarta',
};
const exactUrl = 'https://Meet.Example.test/Join/AbC?token=A%2fb%2Bz&X=1#Room';
let service: MeetingsService;
let row: any;

beforeEach(() => {
  vi.clearAllMocks();
  row = {
    id: 'meeting-1', ownerId: 'owner-1', provider: 'google-meet', externalMeetingId: null,
    joinUrl: exactUrl, provisioningStatus: 'confirmed', createdAt: new Date('2026-10-29T00:00:00Z'),
    calendarEvent: { id: 'event-1', title: request.title, startsAt: new Date(request.startsAt), endsAt: new Date(request.endsAt), timezone: request.timezone },
  };
  db.$transaction.mockImplementation(async (fn: (tx: typeof db) => unknown) => fn(db));
  db.calendar.findFirst.mockResolvedValue({ id: 'calendar-1' });
  db.calendarEvent.create.mockImplementation(async ({ data }) => ({ id: 'event-1', ...data }));
  db.calendarEvent.update.mockImplementation(async ({ data }) => {
    const defined = Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
    row.calendarEvent = { ...row.calendarEvent, ...defined };
    return row.calendarEvent;
  });
  db.meeting.findFirst.mockImplementation(async () => row);
  db.meeting.findMany.mockImplementation(async () => [row]);
  db.meeting.create.mockImplementation(async ({ data }) => {
    row = { ...row, joinUrl: null, externalMeetingId: null, ...data };
    return row;
  });
  db.meeting.update.mockImplementation(async ({ data }) => {
    row = { ...row, ...data };
    return row;
  });
  service = new MeetingsService({ record: vi.fn() } as never);
});

describe('meeting validation (mocked persistence only)', () => {
  it.each([
    { title: '' }, { title: '   ' }, { title: null },
    { startsAt: 'not-a-date' }, { endsAt: '' }, { startsAt: null },
    { startsAt: '2026-10-30T02:00' }, { startsAt: '2026-02-30T02:00:00Z' },
    { startsAt: '2026-10-30T25:00:00Z' }, { startsAt: request.endsAt },
    { timezone: 'Mars/Olympus' }, { timezone: '' }, { timezone: null }, { timezone: '+07:00' },
    { joinUrl: '' }, { joinUrl: 'http://example.test/join' }, { joinUrl: 'javascript:alert(1)' },
    { joinUrl: 'https://user:password@example.test/join' }, { joinUrl: ' https://example.test/join' },
    { joinUrl: 'https://example.test/a b' }, { joinUrl: null },
  ])('rejects invalid create payload before persistence: %j', async (patch) => {
    await expect(service.createMeeting('owner-1', { ...request, ...patch } as CreateMeetingRequestDto)).rejects.toThrow();
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.calendar.findFirst).not.toHaveBeenCalled();
  });

  it.each([
    { startsAt: '2026-10-30T03:00:00Z' }, { startsAt: '2026-10-30T04:00:00Z' },
    { endsAt: '2026-10-30T02:00:00Z' }, { endsAt: '2026-10-30T01:00:00Z' },
    { startsAt: 'bad' }, { endsAt: '2026-02-30T03:00:00Z' },
    { title: '  ' }, { title: null }, { timezone: 'bad/timezone' }, { timezone: null },
    { joinUrl: '' }, { joinUrl: 'http://example.test' }, { joinUrl: null },
  ])('rejects invalid partial update using persisted endpoints: %j', async (patch) => {
    await expect(service.updateMeeting('owner-1', row.id, patch as never)).rejects.toThrow();
    expect(db.calendarEvent.update).not.toHaveBeenCalled();
    expect(db.meeting.update).not.toHaveBeenCalled();
    expect(outbox).not.toHaveBeenCalled();
  });

  it('accepts a valid one-sided update and normalizes the title', async () => {
    const result = await service.updateMeeting('owner-1', row.id, { title: '  New title  ', startsAt: '2026-10-30T02:30:00Z' });
    expect(result.data.calendarEvent?.title).toBe('New title');
    expect(result.data.calendarEvent?.startsAt).toBe('2026-10-30T02:30:00.000Z');
    expect(result.data.calendarEvent?.endsAt).toBe(request.endsAt);
    expect(db.meeting.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: row.id, ownerId: 'owner-1' } }));
  });

  it('does not silently update a missing calendar event', async () => {
    row.calendarEvent = null;
    await expect(service.updateMeeting('owner-1', row.id, { title: 'New' })).rejects.toThrow('no calendar event');
    expect(outbox).not.toHaveBeenCalled();
  });

  it('rejects a calendar belonging to another owner', async () => {
    db.calendar.findFirst.mockResolvedValue(null);
    await expect(service.createMeeting('owner-1', { ...request, calendarId: 'other-calendar', joinUrl: exactUrl })).rejects.toThrow('Calendar not found');
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

describe('custom meeting links and fail-closed providers', () => {
  it('preserves the exact URL through create, update, list and get without an invented ID', async () => {
    const adapter = vi.spyOn(service.getAdapter('google-meet'), 'createMeeting');
    const created = await service.createMeeting('owner-1', { ...request, joinUrl: exactUrl });
    expect(created.data.joinUrl).toBe(exactUrl);
    expect(created.data.externalMeetingId).toBeNull();
    expect(created.data.linkProvenance).toBe('user-provided');
    expect(adapter).not.toHaveBeenCalled();
    expect(outbox.mock.calls.map(([, event]) => event.eventType)).toEqual(['meeting.link.requested.v1', 'meeting.link.saved.v1']);
    const updated = await service.updateMeeting('owner-1', row.id, { title: 'Renamed' });
    expect(updated.data.joinUrl).toBe(exactUrl);
    expect(db.meeting.update).toHaveBeenCalledTimes(1); // create finalization only, not title edit
    const replacement = exactUrl.replace('X=1', 'X=2');
    expect((await service.updateMeeting('owner-1', row.id, { joinUrl: replacement })).data.joinUrl).toBe(replacement);
    expect((await service.listMeetings('owner-1')).data[0]?.joinUrl).toBe(replacement);
    expect((await service.getMeeting('owner-1', row.id)).data.joinUrl).toBe(replacement);
  });

  it('does not reclassify a legacy external ID as provider verified or mutate it on title edit', async () => {
    row.externalMeetingId = 'custom-old-id';
    const result = await service.updateMeeting('owner-1', row.id, { title: 'Renamed' });
    expect(result.data.externalMeetingId).toBe('custom-old-id');
    expect(result.data.linkProvenance).toBe('unverified');
    expect(db.meeting.update).not.toHaveBeenCalled();
  });

  it.each(['google-meet', 'zoom'] as const)('fails closed without a link for %s and records failure, not confirmation', async (provider) => {
    await expect(service.createMeeting('owner-1', { ...request, provider })).rejects.toThrow('OAuth is not connected');
    expect(row.provisioningStatus).toBe('failed');
    expect(row.joinUrl).toBeNull();
    expect(outbox.mock.calls.map(([, event]) => event.eventType)).toEqual(['meeting.provisioning.requested.v1', 'meeting.provisioning.failed.v1']);
  });

  it('never upgrades an unconfirmed adapter result to confirmed', async () => {
    vi.spyOn(service.getAdapter('google-meet'), 'createMeeting').mockResolvedValueOnce({
      externalMeetingId: 'pending-id', joinUrl: 'https://example.test/pending', status: 'provisioning',
    });
    await expect(service.createMeeting('owner-1', request)).rejects.toThrow('did not confirm');
    expect(row.provisioningStatus).toBe('failed');
    expect(row.joinUrl).toBeNull();
  });

  it('reports adapters unhealthy and rejects cancellation without calling a provider', async () => {
    for (const adapter of [new GoogleMeetAdapter(), new ZoomMeetingAdapter()]) {
      expect(await adapter.checkHealth()).toBe(false);
      await expect(adapter.cancelMeeting('not-a-real-id')).rejects.toThrow('OAuth is not connected');
    }
    expect(meetingLinkProvenance({ joinUrl: null, externalMeetingId: null })).toBe('none');
  });
});
