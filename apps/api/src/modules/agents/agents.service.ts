import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { prisma, createOutboxEvent } from '@paw/database';
import { AuditService } from '../audit/audit.service';
import { createHash } from 'crypto';

export interface CreateCodingRunDto {
  taskId?: string;
  repository: string;
  targetBranch: string;
  prompt: string;
  budgetLimitUsd?: number;
}

export interface CompleteCodingRunDto {
  prUrl: string;
  featureBranch: string;
  testSummary: string;
  filesChangedCount: number;
}

@Injectable()
export class AgentsService {
  constructor(private readonly auditService: AuditService) {}

  /**
   * Dispatches an isolated Claude Code ephemeral worker request (docs/AI_APPROVAL_AND_AGENTS.md)
   * Enforces PR-only output, least privilege, and sandbox budget limits.
   */
  async createCodingRun(ownerId: string, dto: CreateCodingRunDto, traceId?: string) {
    if (!dto.repository || !dto.prompt) {
      throw new BadRequestException('repository and prompt are required');
    }

    const run = await prisma.$transaction(async (tx) => {
      const agentRun = await tx.agentRun.create({
        data: {
          ownerId,
          kind: 'coding',
          status: 'pending',
          model: 'claude-code-worker-v1',
          costEstimate: dto.budgetLimitUsd || 1.0,
        },
      });

      // Emits outbox event to notify ephemeral container runner
      await createOutboxEvent(tx, {
        aggregateType: 'agent_run',
        aggregateId: agentRun.id,
        eventType: 'agent.coding_run.requested.v1',
        payload: {
          runId: agentRun.id,
          repository: dto.repository,
          targetBranch: dto.targetBranch || 'main',
          prompt: dto.prompt,
          budgetLimitUsd: agentRun.costEstimate,
          prOnly: true, // Strict architectural guarantee: no direct commit to prod branch
        },
        traceId,
      });

      return agentRun;
    });

    this.auditService.record({
      actorType: 'user',
      actorId: ownerId,
      action: 'agent.coding_run.created',
      target: run.id,
      traceId,
      metadata: { repository: dto.repository, budget: run.costEstimate },
    });

    return {
      data: {
        id: run.id,
        kind: run.kind,
        status: run.status,
        model: run.model,
        budgetLimitUsd: run.costEstimate,
        createdAt: run.createdAt.toISOString(),
      },
    };
  }

  async listCodingRuns(ownerId: string) {
    const runs = await prisma.agentRun.findMany({
      where: { ownerId, kind: 'coding' },
      include: {
        invocations: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      data: runs.map((r) => ({
        id: r.id,
        status: r.status,
        model: r.model,
        costEstimate: r.costEstimate,
        createdAt: r.createdAt.toISOString(),
        completedAt: r.completedAt?.toISOString() ?? null,
        invocations: r.invocations.map((inv) => ({
          id: inv.id,
          toolName: inv.toolName,
          status: inv.status,
          outputDigest: inv.outputDigest,
        })),
      })),
    };
  }

  async getCodingRun(ownerId: string, id: string) {
    const run = await prisma.agentRun.findFirst({
      where: { id, ownerId },
      include: { invocations: true },
    });

    if (!run) {
      throw new NotFoundException(`Coding run ${id} not found`);
    }

    return {
      data: {
        id: run.id,
        kind: run.kind,
        status: run.status,
        model: run.model,
        costEstimate: run.costEstimate,
        createdAt: run.createdAt.toISOString(),
        completedAt: run.completedAt?.toISOString() ?? null,
        invocations: run.invocations,
      },
    };
  }

  /**
   * Finalizes an isolated coding run: records PR output & test summary
   */
  async completeCodingRun(
    ownerId: string,
    id: string,
    dto: CompleteCodingRunDto,
    traceId?: string,
  ) {
    const run = await prisma.agentRun.findFirst({
      where: { id, ownerId },
    });

    if (!run) {
      throw new NotFoundException(`Coding run ${id} not found`);
    }

    const outputDigest = createHash('sha256').update(JSON.stringify(dto)).digest('hex');

    await prisma.$transaction(async (tx) => {
      await tx.agentRun.update({
        where: { id },
        data: {
          status: 'completed',
          completedAt: new Date(),
        },
      });

      await tx.toolInvocation.create({
        data: {
          runId: id,
          toolName: 'git.create_pull_request',
          status: 'succeeded',
          outputDigest,
        },
      });

      await createOutboxEvent(tx, {
        aggregateType: 'agent_run',
        aggregateId: id,
        eventType: 'agent.coding_run.completed.v1',
        payload: {
          runId: id,
          prUrl: dto.prUrl,
          featureBranch: dto.featureBranch,
          testSummary: dto.testSummary,
        },
        traceId,
      });
    });

    this.auditService.record({
      actorType: 'system',
      actorId: 'claude-code-worker',
      action: 'agent.coding_run.completed',
      target: id,
      traceId,
      metadata: { prUrl: dto.prUrl, branch: dto.featureBranch },
    });

    return {
      success: true,
      runId: id,
      prUrl: dto.prUrl,
      status: 'completed',
    };
  }
}
