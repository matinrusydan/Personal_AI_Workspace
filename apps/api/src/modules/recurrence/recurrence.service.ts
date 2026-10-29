import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { rrulestr } from 'rrule';
import { prisma } from '@paw/database';
import { createHash } from 'crypto';

export interface CreateRecurrenceRuleDto {
  rrule: string;
  timezone: string;
  startsLocal: string; // ISO date string
  endsAt?: string | null;
}

export interface ExpandedOccurrence {
  date: Date;
  occurrenceKey: string;
}

@Injectable()
export class RecurrenceService {
  /**
   * Validates an RFC 5545 RRULE string
   */
  validateRRule(rruleString: string): boolean {
    try {
      rrulestr(rruleString);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generates a deterministic occurrence key per docs/DATA_MODEL.md
   * Format: ruleId + original wall-time UTC ISO + timezone hash
   */
  generateOccurrenceKey(ruleId: string, date: Date, timezone: string): string {
    const raw = `${ruleId}_${date.toISOString()}_${timezone}`;
    return createHash('sha256').update(raw).digest('hex').substring(0, 32);
  }

  /**
   * Expands an RRULE into discrete occurrence instances within a specific time window
   */
  expandOccurrences(
    ruleId: string,
    rruleString: string,
    dtstart: Date,
    timezone: string,
    windowStart: Date,
    windowEnd: Date,
    maxCount = 100,
  ): ExpandedOccurrence[] {
    try {
      const parsed = rrulestr(rruleString, { dtstart });
      const dates = parsed.between(windowStart, windowEnd, true);

      return dates.slice(0, maxCount).map((date) => ({
        date,
        occurrenceKey: this.generateOccurrenceKey(ruleId, date, timezone),
      }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(`Failed to expand RRULE: ${msg}`);
    }
  }

  /**
   * Calculates next occurrence after a given timestamp
   */
  getNextOccurrence(rruleString: string, dtstart: Date, afterDate: Date): Date | null {
    try {
      const parsed = rrulestr(rruleString, { dtstart });
      return parsed.after(afterDate, false);
    } catch {
      return null;
    }
  }

  /**
   * Standardizes IANA timezone
   */
  normalizeTimezone(tz?: string): string {
    if (!tz) return 'Asia/Jakarta';
    try {
      Intl.DateTimeFormat(undefined, { timeZone: tz });
      return tz;
    } catch {
      throw new BadRequestException(`Invalid IANA timezone: ${tz}`);
    }
  }

  // Database operations for recurrence rules

  async listRules(ownerId: string) {
    const rules = await prisma.recurrenceRule.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      data: rules.map((r) => ({
        id: r.id,
        rrule: r.rrule,
        timezone: r.timezone,
        startsLocal: r.startsLocal.toISOString(),
        endsAt: r.endsAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  async getRule(ownerId: string, id: string) {
    const rule = await prisma.recurrenceRule.findFirst({
      where: { id, ownerId },
    });

    if (!rule) {
      throw new NotFoundException(`Recurrence rule ${id} not found`);
    }

    return {
      data: {
        id: rule.id,
        rrule: rule.rrule,
        timezone: rule.timezone,
        startsLocal: rule.startsLocal.toISOString(),
        endsAt: rule.endsAt?.toISOString() ?? null,
        createdAt: rule.createdAt.toISOString(),
      },
    };
  }

  async createRule(ownerId: string, dto: CreateRecurrenceRuleDto) {
    const timezone = this.normalizeTimezone(dto.timezone);
    const startsDate = new Date(dto.startsLocal);

    if (isNaN(startsDate.getTime())) {
      throw new BadRequestException('Invalid startsLocal timestamp format');
    }

    // Validate RRULE syntax
    if (!this.validateRRule(dto.rrule)) {
      throw new BadRequestException(`Invalid RFC 5545 RRULE: ${dto.rrule}`);
    }

    const rule = await prisma.recurrenceRule.create({
      data: {
        ownerId,
        rrule: dto.rrule,
        timezone,
        startsLocal: startsDate,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
      },
    });

    return {
      data: {
        id: rule.id,
        rrule: rule.rrule,
        timezone: rule.timezone,
        startsLocal: rule.startsLocal.toISOString(),
        endsAt: rule.endsAt?.toISOString() ?? null,
        createdAt: rule.createdAt.toISOString(),
      },
    };
  }

  async deleteRule(ownerId: string, id: string) {
    const existing = await prisma.recurrenceRule.findFirst({
      where: { id, ownerId },
    });

    if (!existing) {
      throw new NotFoundException(`Recurrence rule ${id} not found`);
    }

    await prisma.recurrenceRule.delete({ where: { id } });
    return { success: true };
  }

  /**
   * Preview occurrences without saving
   */
  previewOccurrences(
    rruleString: string,
    startsLocal: string,
    timezone: string,
    windowStartStr: string,
    windowEndStr: string,
  ) {
    const tz = this.normalizeTimezone(timezone);
    const dtstart = new Date(startsLocal);
    const windowStart = new Date(windowStartStr);
    const windowEnd = new Date(windowEndStr);

    if (isNaN(dtstart.getTime()) || isNaN(windowStart.getTime()) || isNaN(windowEnd.getTime())) {
      throw new BadRequestException('Invalid date parameters for recurrence expansion');
    }

    const occurrences = this.expandOccurrences(
      'preview',
      rruleString,
      dtstart,
      tz,
      windowStart,
      windowEnd,
    );

    return {
      data: occurrences.map((o) => ({
        date: o.date.toISOString(),
        occurrenceKey: o.occurrenceKey,
      })),
    };
  }
}
