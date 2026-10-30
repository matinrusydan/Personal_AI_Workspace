import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { prisma, createOutboxEvent } from '@paw/database';
import { AuditService } from '../audit/audit.service';
import {
  MeetingProviderType,
  IMeetingProviderAdapter,
  GoogleMeetAdapter,
  ZoomMeetingAdapter,
} from './adapters/meeting-provider.adapter';
import {
  validateMeetingTitle, validateMeetingTimezone, validateMeetingInstant,
  validateMeetingRange, validateMeetingJoinUrl, meetingLinkProvenance,
} from './meeting-validation';

export interface CreateMeetingRequestDto {
  provider: MeetingProviderType;
  title: string;
  startsAt: string;
  endsAt: string;
  timezone?: string;
  calendarId?: string;
  reminderOffsetsMinutes?: number[];
  joinUrl?: string;
}

@Injectable()
export class MeetingsService {
  private readonly adapters = new Map<MeetingProviderType, IMeetingProviderAdapter>();

  constructor(private readonly auditService: AuditService) {
    this.adapters.set('google-meet', new GoogleMeetAdapter());
    this.adapters.set('zoom', new ZoomMeetingAdapter());
  }

  getAdapter(provider: MeetingProviderType): IMeetingProviderAdapter {
    const adapter = this.adapters.get(provider);
    if (!adapter) {
      throw new BadRequestException(`Unsupported meeting provider: ${provider}`);
    }
    return adapter;
  }

  async listMeetings(ownerId: string) {
    const meetings = await prisma.meeting.findMany({
      where: { ownerId },
      include: {
        calendarEvent: {
          select: { id: true, title: true, startsAt: true, endsAt: true, timezone: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      data: meetings.map((m) => ({
        id: m.id,
        provider: m.provider,
        externalMeetingId: m.externalMeetingId,
        joinUrl: m.joinUrl,
        linkProvenance: meetingLinkProvenance(m),
        provisioningStatus: m.provisioningStatus,
        calendarEvent: m.calendarEvent
          ? {
              id: m.calendarEvent.id,
              title: m.calendarEvent.title,
              startsAt: m.calendarEvent.startsAt.toISOString(),
              endsAt: m.calendarEvent.endsAt.toISOString(),
              timezone: m.calendarEvent.timezone,
            }
          : null,
        createdAt: m.createdAt.toISOString(),
      })),
    };
  }

  async getMeeting(ownerId: string, id: string) {
    const meeting = await prisma.meeting.findFirst({
      where: { id, ownerId },
      include: {
        calendarEvent: true,
      },
    });

    if (!meeting) {
      throw new NotFoundException(`Meeting ${id} not found`);
    }

    return {
      data: {
        id: meeting.id,
        provider: meeting.provider,
        externalMeetingId: meeting.externalMeetingId,
        joinUrl: meeting.joinUrl,
        linkProvenance: meetingLinkProvenance(meeting),
        provisioningStatus: meeting.provisioningStatus,
        calendarEvent: meeting.calendarEvent
          ? {
              id: meeting.calendarEvent.id,
              title: meeting.calendarEvent.title,
              startsAt: meeting.calendarEvent.startsAt.toISOString(),
              endsAt: meeting.calendarEvent.endsAt.toISOString(),
              timezone: meeting.calendarEvent.timezone,
            }
          : null,
        createdAt: meeting.createdAt.toISOString(),
      },
    };
  }

  /**
   * Initiates meeting creation via Asynchronous Provisioning State Machine (docs/INTEGRATIONS.md).
   * Custom HTTPS links are saved locally with null external ID and separate link events;
   * their legacy 'confirmed' storage status does not assert provider verification.
   * 1. Creates Meeting record with status: 'provisioning'
   * 2. Atomically creates CalendarEvent & emits 'meeting.provisioning.requested.v1'
   * 3. Executes provider adapter to provision meeting
   * 4. Updates meeting with externalMeetingId + joinUrl and status: 'confirmed'
   * 5. Emits 'meeting.provisioning.confirmed.v1'
   */
  async createMeeting(ownerId: string, dto: CreateMeetingRequestDto, traceId?: string) {
    const title = validateMeetingTitle(dto.title);
    const startsAt = validateMeetingInstant(dto.startsAt);
    const endsAt = validateMeetingInstant(dto.endsAt);
    validateMeetingRange(startsAt, endsAt);
    const timezone = validateMeetingTimezone(dto.timezone === undefined ? 'Asia/Jakarta' : dto.timezone);
    const customJoinUrl = dto.joinUrl === undefined ? undefined : validateMeetingJoinUrl(dto.joinUrl);
    const adapter = this.getAdapter(dto.provider);

    // Step 1: Ensure owner has a target calendar
    let targetCalendarId = dto.calendarId;
    if (targetCalendarId !== undefined) {
      const ownedCalendar = await prisma.calendar.findFirst({ where: { id: targetCalendarId, ownerId } });
      if (!ownedCalendar) throw new BadRequestException('Calendar not found for this owner');
    } else {
      const defaultCal = await prisma.calendar.findFirst({
        where: { ownerId },
      });
      if (defaultCal) {
        targetCalendarId = defaultCal.id;
      } else {
        const newCal = await prisma.calendar.create({
          data: {
            ownerId,
            provider: 'local',
            externalCalendarId: 'primary',
            syncStatus: 'active',
          },
        });
        targetCalendarId = newCal.id;
      }
    }

    // Step 2: Atomic Transaction: Create Meeting ('provisioning') + CalendarEvent + Outbox Event
    const initial = await prisma.$transaction(async (tx) => {
      const calEvent = await tx.calendarEvent.create({
        data: {
          ownerId,
          calendarId: targetCalendarId,
          title,
          startsAt,
          endsAt,
          timezone,
          source: 'local',
          status: 'confirmed',
          version: 1,
        },
      });

      const meeting = await tx.meeting.create({
        data: {
          ownerId,
          calendarEventId: calEvent.id,
          provider: dto.provider,
          provisioningStatus: 'provisioning',
        },
      });

      await createOutboxEvent(tx, {
        aggregateType: 'meeting',
        aggregateId: meeting.id,
        eventType: customJoinUrl === undefined ? 'meeting.provisioning.requested.v1' : 'meeting.link.requested.v1',
        payload: {
          meetingId: meeting.id,
          provider: meeting.provider,
          calendarEventId: calEvent.id,
          title: calEvent.title,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          timezone,
        },
        traceId,
      });

      return { meeting, calEvent };
    });

    // Step 3: Execute provider adapter or use user-provided joinUrl
    try {
      let finalExternalId: string | null;
      let finalJoinUrl: string;

      if (customJoinUrl !== undefined) {
        finalJoinUrl = customJoinUrl;
        finalExternalId = null;
      } else {
        const providerResult = await adapter.createMeeting({
          title,
          startsAt,
          endsAt,
          timezone,
        });
        if (providerResult.status !== 'confirmed' || !providerResult.externalMeetingId) {
          throw new Error('Provider did not confirm meeting provisioning');
        }
        finalExternalId = providerResult.externalMeetingId;
        finalJoinUrl = validateMeetingJoinUrl(providerResult.joinUrl);
      }

      // Step 4: Atomic update to confirmed status + confirmed outbox event
      const confirmed = await prisma.$transaction(async (tx) => {
        const m = await tx.meeting.update({
          where: { id: initial.meeting.id },
          data: {
            externalMeetingId: finalExternalId,
            joinUrl: finalJoinUrl,
            provisioningStatus: 'confirmed',
          },
        });

        await createOutboxEvent(tx, {
          aggregateType: 'meeting',
          aggregateId: m.id,
          eventType: customJoinUrl === undefined ? 'meeting.provisioning.confirmed.v1' : 'meeting.link.saved.v1',
          payload: {
            meetingId: m.id,
            provider: m.provider,
            externalMeetingId: m.externalMeetingId,
            joinUrl: m.joinUrl,
            linkProvenance: meetingLinkProvenance(m),
          },
          traceId,
        });

        return m;
      });

      this.auditService.record({
        actorType: 'user',
        actorId: ownerId,
        action: customJoinUrl === undefined ? 'meeting.created' : 'meeting.link.saved',
        target: confirmed.id,
        traceId,
        metadata: {
          provider: confirmed.provider,
          externalMeetingId: confirmed.externalMeetingId,
          linkProvenance: meetingLinkProvenance(confirmed),
        },
      });

      return {
        data: {
          id: confirmed.id,
          provider: confirmed.provider,
          externalMeetingId: confirmed.externalMeetingId,
          joinUrl: confirmed.joinUrl,
          status: confirmed.provisioningStatus,
          linkProvenance: meetingLinkProvenance(confirmed),
        },
      };
    } catch (err: unknown) {
      // Step 5: Mark failed on error and emit failed outbox event
      const errorMsg = err instanceof Error ? err.message : String(err);
      await prisma.$transaction(async (tx) => {
        await tx.meeting.update({
          where: { id: initial.meeting.id },
          data: { provisioningStatus: 'failed' },
        });

        await createOutboxEvent(tx, {
          aggregateType: 'meeting',
          aggregateId: initial.meeting.id,
          eventType: 'meeting.provisioning.failed.v1',
          payload: {
            meetingId: initial.meeting.id,
            error: errorMsg,
          },
          traceId,
        });
      });

      throw new BadRequestException(`Meeting provisioning failed: ${errorMsg}`);
    }
  }

  async updateMeeting(
    ownerId: string,
    id: string,
    dto: {
      title?: string;
      startsAt?: string;
      endsAt?: string;
      timezone?: string;
      joinUrl?: string;
    },
    traceId?: string,
  ) {
    const title = dto.title === undefined ? undefined : validateMeetingTitle(dto.title);
    const startsAt = dto.startsAt === undefined ? undefined : validateMeetingInstant(dto.startsAt);
    const endsAt = dto.endsAt === undefined ? undefined : validateMeetingInstant(dto.endsAt);
    const timezone = dto.timezone === undefined ? undefined : validateMeetingTimezone(dto.timezone);
    const joinUrl = dto.joinUrl === undefined ? undefined : validateMeetingJoinUrl(dto.joinUrl);
    const changesSchedule = [title, startsAt, endsAt, timezone].some((value) => value !== undefined);

    const updated = await prisma.$transaction(async (tx) => {
      // Read the effective endpoints in the same transaction as the update.
      const current = await tx.meeting.findFirst({ where: { id, ownerId }, include: { calendarEvent: true } });
      if (!current) throw new NotFoundException(`Meeting ${id} not found`);
      let calEvent = current.calendarEvent;
      if (changesSchedule) {
        if (!calEvent) throw new BadRequestException('Meeting has no calendar event to update');
        validateMeetingRange(startsAt ?? calEvent.startsAt, endsAt ?? calEvent.endsAt);
        calEvent = await tx.calendarEvent.update({
          where: { id: calEvent.id },
          data: { title, startsAt, endsAt, timezone, version: { increment: 1 } },
        });
      }

      const updatedMeeting = joinUrl === undefined ? current : await tx.meeting.update({
        where: { id },
        data: { joinUrl },
      });

      await createOutboxEvent(tx, {
        aggregateType: 'meeting',
        aggregateId: id,
        eventType: 'meeting.updated.v1',
        payload: { id, ...dto },
        traceId,
      });

      return { ...updatedMeeting, calendarEvent: calEvent };
    });

    return {
      data: {
        id: updated.id,
        provider: updated.provider,
        externalMeetingId: updated.externalMeetingId,
        joinUrl: updated.joinUrl,
        linkProvenance: meetingLinkProvenance(updated),
        provisioningStatus: updated.provisioningStatus,
        calendarEvent: updated.calendarEvent
          ? {
              id: updated.calendarEvent.id,
              title: updated.calendarEvent.title,
              startsAt: updated.calendarEvent.startsAt.toISOString(),
              endsAt: updated.calendarEvent.endsAt.toISOString(),
              timezone: updated.calendarEvent.timezone,
            }
          : null,
      },
    };
  }

  async deleteMeeting(ownerId: string, id: string, traceId?: string) {
    const meeting = await prisma.meeting.findFirst({
      where: { id, ownerId },
      include: { calendarEvent: true },
    });

    if (!meeting) {
      throw new NotFoundException(`Meeting ${id} not found`);
    }

    await prisma.$transaction(async (tx) => {
      if (meeting.calendarEventId) {
        await tx.calendarEvent.delete({
          where: { id: meeting.calendarEventId },
        });
      }

      await tx.meeting.delete({
        where: { id },
      });

      await createOutboxEvent(tx, {
        aggregateType: 'meeting',
        aggregateId: id,
        eventType: 'meeting.canceled.v1',
        payload: {
          meetingId: id,
          provider: meeting.provider,
          externalMeetingId: meeting.externalMeetingId,
        },
        traceId,
      });
    });

    this.auditService.record({
      actorType: 'user',
      actorId: ownerId,
      action: 'meeting.canceled',
      target: id,
      traceId,
    });

    return { success: true };
  }
}
