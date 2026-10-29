import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { prisma, createOutboxEvent, Prisma } from '@paw/database';
import { AuditService } from '../audit/audit.service';
import { TasksService } from '../tasks/tasks.service';
import { CalendarService } from '../calendar/calendar.service';
import { MeetingsService } from '../meetings/meetings.service';
import { createHash } from 'crypto';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ProposedActionPayload {
  action: 'task.create' | 'meeting.create' | 'calendar.event.create';
  parameters: Record<string, unknown>;
  riskLevel: RiskLevel;
  humanSummary: string;
}

@Injectable()
export class ApprovalsService {
  constructor(
    private readonly auditService: AuditService,
    private readonly tasksService: TasksService,
    private readonly calendarService: CalendarService,
    private readonly meetingsService: MeetingsService,
  ) {}

  /**
   * Computes deterministic SHA-256 hash of canonical JSON payload
   */
  computePayloadHash(action: string, parameters: Record<string, unknown>): string {
    const canonicalString = JSON.stringify(
      { action, parameters },
      Object.keys({ action, parameters }).sort(),
    );
    return createHash('sha256').update(canonicalString).digest('hex');
  }

  /**
   * Creates an immutable approval request (docs/AI_APPROVAL_AND_AGENTS.md)
   * All AI-initiated actions start here.
   */
  async createApprovalRequest(
    ownerId: string,
    actionPayload: ProposedActionPayload,
    actorId = 'ai-assistant',
    ttlHours = 24,
    traceId?: string,
  ) {
    const payloadHash = this.computePayloadHash(actionPayload.action, actionPayload.parameters);

    const expiresAt = new Date(Date.now() + ttlHours * 3600000);

    const request = await prisma.approvalRequest.create({
      data: {
        ownerId,
        action: actionPayload.action,
        payloadHash,
        payload: actionPayload as unknown as Prisma.InputJsonValue,
        status: 'pending',
        expiresAt,
        actorId,
      },
    });

    this.auditService.record({
      actorType: 'system',
      actorId,
      action: 'approval.requested',
      target: request.id,
      traceId,
      metadata: {
        action: request.action,
        payloadHash: request.payloadHash,
        expiresAt: expiresAt.toISOString(),
      },
    });

    return {
      data: {
        id: request.id,
        action: request.action,
        payloadHash: request.payloadHash,
        status: request.status,
        expiresAt: request.expiresAt.toISOString(),
        payload: request.payload,
      },
    };
  }

  async listApprovalRequests(ownerId: string, status?: string) {
    const where: Record<string, unknown> = { ownerId };
    if (status) {
      where['status'] = status;
    }

    const requests = await prisma.approvalRequest.findMany({
      where,
      include: {
        decision: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      data: requests.map((r) => ({
        id: r.id,
        action: r.action,
        payloadHash: r.payloadHash,
        status: r.status,
        expiresAt: r.expiresAt.toISOString(),
        createdAt: r.createdAt.toISOString(),
        payload: r.payload,
        decision: r.decision
          ? {
              decision: r.decision.decision,
              decidedAt: r.decision.decidedAt.toISOString(),
            }
          : null,
      })),
    };
  }

  async getApprovalRequest(ownerId: string, id: string) {
    const request = await prisma.approvalRequest.findFirst({
      where: { id, ownerId },
      include: { decision: true },
    });

    if (!request) {
      throw new NotFoundException(`Approval request ${id} not found`);
    }

    return {
      data: {
        id: request.id,
        action: request.action,
        payloadHash: request.payloadHash,
        status: request.status,
        expiresAt: request.expiresAt.toISOString(),
        createdAt: request.createdAt.toISOString(),
        payload: request.payload,
        decision: request.decision
          ? {
              decision: request.decision.decision,
              decidedAt: request.decision.decidedAt.toISOString(),
            }
          : null,
      },
    };
  }

  /**
   * Owner Decides Approval: 'approved' | 'rejected'
   * - Verifies matching payloadHash (tamper protection)
   * - Verifies single-use terminal decision (anti-replay)
   * - If approved: triggers deterministic domain executor
   */
  async decideApproval(
    ownerId: string,
    id: string,
    dto: { decision: 'approved' | 'rejected'; payloadHash: string },
    traceId?: string,
  ) {
    const request = await prisma.approvalRequest.findFirst({
      where: { id, ownerId },
      include: { decision: true },
    });

    if (!request) {
      throw new NotFoundException(`Approval request ${id} not found`);
    }

    if (request.status !== 'pending') {
      throw new ConflictException(
        `Approval request is already in terminal state: ${request.status}`,
      );
    }

    if (request.expiresAt < new Date()) {
      await prisma.approvalRequest.update({
        where: { id },
        data: { status: 'expired' },
      });
      throw new BadRequestException('Approval request has expired');
    }

    // Tamper Protection: hash verification
    if (dto.payloadHash !== request.payloadHash) {
      this.auditService.record({
        actorType: 'user',
        actorId: ownerId,
        action: 'approval.tamper_detected',
        target: id,
        traceId,
        metadata: { expected: request.payloadHash, received: dto.payloadHash },
      });
      throw new BadRequestException('Payload digest mismatch: action has been tampered with');
    }

    // Record decision in PostgreSQL
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.approvalDecision.create({
        data: {
          requestId: id,
          deciderId: ownerId,
          decision: dto.decision,
          decidedAt: now,
        },
      });

      await tx.approvalRequest.update({
        where: { id },
        data: { status: dto.decision },
      });

      await createOutboxEvent(tx, {
        aggregateType: 'approval',
        aggregateId: id,
        eventType: 'approval.decided.v1',
        payload: {
          requestId: id,
          decision: dto.decision,
          action: request.action,
        },
        traceId,
      });
    });

    this.auditService.record({
      actorType: 'user',
      actorId: ownerId,
      action: `approval.${dto.decision}`,
      target: id,
      traceId,
      metadata: { action: request.action },
    });

    // If approved: Execute deterministic domain operation
    let executionResult: unknown = null;
    if (dto.decision === 'approved') {
      executionResult = await this.executeApprovedAction(
        ownerId,
        request.action,
        (request.payload as any).parameters,
        traceId,
      );
    }

    return {
      success: true,
      decision: dto.decision,
      requestId: id,
      executionResult,
    };
  }

  /**
   * Deterministic Domain Executor: Executes already-approved payload
   */
  private async executeApprovedAction(
    ownerId: string,
    action: string,
    params: Record<string, any>,
    traceId?: string,
  ) {
    switch (action) {
      case 'task.create':
        return this.tasksService.createTask(ownerId, params as any, traceId);

      case 'meeting.create':
        return this.meetingsService.createMeeting(ownerId, params as any, traceId);

      case 'calendar.event.create':
        return this.calendarService.createEvent(ownerId, params as any, traceId);

      default:
        throw new BadRequestException(`Unrecognized approved action: ${action}`);
    }
  }
}
