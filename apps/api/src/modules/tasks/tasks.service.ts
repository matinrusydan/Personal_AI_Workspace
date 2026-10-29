import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { prisma, createOutboxEvent } from '@paw/database';
import { AuditService } from '../audit/audit.service';

export interface CreateTaskDto {
  title: string;
  description?: string;
  projectId?: string;
  parentTaskId?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  dueAt?: string;
  timezone?: string;
  tags?: string[];
}

export interface UpdateTaskDto {
  title?: string;
  description?: string;
  projectId?: string | null;
  status?: 'todo' | 'in_progress' | 'blocked' | 'done';
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  dueAt?: string | null;
  timezone?: string;
  version?: number;
  tags?: string[];
}

@Injectable()
export class TasksService {
  constructor(private readonly auditService: AuditService) {}

  async listTasks(
    ownerId: string,
    filters?: {
      status?: string;
      projectId?: string;
      dueBefore?: string;
    },
  ) {
    const where: Record<string, unknown> = {
      ownerId,
    };

    if (filters?.status) {
      where['status'] = filters.status;
    }
    if (filters?.projectId) {
      where['projectId'] = filters.projectId;
    }
    if (filters?.dueBefore) {
      where['dueAt'] = { lte: new Date(filters.dueBefore) };
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        taskTags: {
          include: {
            tag: true,
          },
        },
        subTasks: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
          },
        },
      },
      orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }, { createdAt: 'desc' }],
    });

    return {
      data: tasks.map((t) => this.mapTaskEntity(t)),
    };
  }

  async getTask(ownerId: string, id: string) {
    const task = await prisma.task.findFirst({
      where: { id, ownerId },
      include: {
        taskTags: {
          include: {
            tag: true,
          },
        },
        subTasks: true,
        project: {
          select: { id: true, title: true },
        },
      },
    });

    if (!task) {
      throw new NotFoundException(`Task with id ${id} not found`);
    }

    return {
      data: this.mapTaskEntity(task),
    };
  }

  async createTask(ownerId: string, dto: CreateTaskDto, traceId?: string) {
    if (!dto.title || dto.title.trim() === '') {
      throw new BadRequestException('Task title is required');
    }

    // Verify parentTaskId if specified
    if (dto.parentTaskId) {
      const parent = await prisma.task.findFirst({
        where: { id: dto.parentTaskId, ownerId },
      });
      if (!parent) {
        throw new BadRequestException(`Parent task ${dto.parentTaskId} not found`);
      }
    }

    // Execute atomic transaction: Create Task + TaskTags + Outbox Event
    const result = await prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          ownerId,
          projectId: dto.projectId,
          parentTaskId: dto.parentTaskId,
          title: dto.title.trim(),
          description: dto.description,
          priority: dto.priority || 'normal',
          status: 'todo',
          dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
          timezone: dto.timezone || 'Asia/Jakarta',
          version: 1,
        },
      });

      // Handle tags if provided
      if (dto.tags && dto.tags.length > 0) {
        for (const tagName of dto.tags) {
          const cleanTag = tagName.trim();
          if (cleanTag) {
            const tag = await tx.tag.upsert({
              where: {
                ownerId_name: { ownerId, name: cleanTag },
              },
              update: {},
              create: { ownerId, name: cleanTag },
            });

            await tx.taskTag.create({
              data: {
                taskId: task.id,
                tagId: tag.id,
              },
            });
          }
        }
      }

      // Atomic outbox event emission per ADR-004 & docs/EVENT_FLOWS.md
      await createOutboxEvent(tx, {
        aggregateType: 'task',
        aggregateId: task.id,
        eventType: 'task.created.v1',
        payload: {
          id: task.id,
          title: task.title,
          priority: task.priority,
          status: task.status,
          dueAt: task.dueAt?.toISOString() ?? null,
          timezone: task.timezone,
        },
        traceId,
      });

      return task;
    });

    this.auditService.record({
      actorType: 'user',
      actorId: ownerId,
      action: 'task.created',
      target: result.id,
      traceId,
      metadata: { title: result.title, priority: result.priority },
    });

    return this.getTask(ownerId, result.id);
  }

  async updateTask(
    ownerId: string,
    id: string,
    dto: UpdateTaskDto,
    ifMatchVersion?: number,
    traceId?: string,
  ) {
    const existing = await prisma.task.findFirst({
      where: { id, ownerId },
    });

    if (!existing) {
      throw new NotFoundException(`Task with id ${id} not found`);
    }

    // Optimistic concurrency check (version or If-Match)
    const expectedVersion = ifMatchVersion ?? dto.version;
    if (expectedVersion !== undefined && existing.version !== expectedVersion) {
      throw new ConflictException(
        `Task version mismatch: current is ${existing.version}, expected ${expectedVersion}`,
      );
    }

    const nextVersion = existing.version + 1;

    const updated = await prisma.$transaction(async (tx) => {
      const task = await tx.task.update({
        where: { id },
        data: {
          title: dto.title !== undefined ? dto.title.trim() : undefined,
          description: dto.description !== undefined ? dto.description : undefined,
          projectId: dto.projectId !== undefined ? dto.projectId : undefined,
          status: dto.status !== undefined ? dto.status : undefined,
          priority: dto.priority !== undefined ? dto.priority : undefined,
          dueAt: dto.dueAt !== undefined ? (dto.dueAt ? new Date(dto.dueAt) : null) : undefined,
          timezone: dto.timezone !== undefined ? dto.timezone : undefined,
          version: nextVersion,
        },
      });

      // Update tags if provided
      if (dto.tags !== undefined) {
        // Clear existing associations
        await tx.taskTag.deleteMany({ where: { taskId: id } });

        for (const tagName of dto.tags) {
          const cleanTag = tagName.trim();
          if (cleanTag) {
            const tag = await tx.tag.upsert({
              where: {
                ownerId_name: { ownerId, name: cleanTag },
              },
              update: {},
              create: { ownerId, name: cleanTag },
            });

            await tx.taskTag.create({
              data: {
                taskId: id,
                tagId: tag.id,
              },
            });
          }
        }
      }

      // Atomic outbox event emission for task update
      await createOutboxEvent(tx, {
        aggregateType: 'task',
        aggregateId: task.id,
        eventType: 'task.updated.v1',
        payload: {
          id: task.id,
          status: task.status,
          priority: task.priority,
          dueAt: task.dueAt?.toISOString() ?? null,
          version: task.version,
        },
        traceId,
      });

      return task;
    });

    this.auditService.record({
      actorType: 'user',
      actorId: ownerId,
      action: 'task.updated',
      target: updated.id,
      traceId,
      metadata: { status: updated.status, version: updated.version },
    });

    return this.getTask(ownerId, updated.id);
  }

  async deleteTask(ownerId: string, id: string, traceId?: string) {
    const existing = await prisma.task.findFirst({
      where: { id, ownerId },
    });

    if (!existing) {
      throw new NotFoundException(`Task with id ${id} not found`);
    }

    await prisma.$transaction(async (tx) => {
      await tx.taskTag.deleteMany({ where: { taskId: id } });
      await tx.task.delete({ where: { id } });

      await createOutboxEvent(tx, {
        aggregateType: 'task',
        aggregateId: id,
        eventType: 'task.deleted.v1',
        payload: { id },
        traceId,
      });
    });

    this.auditService.record({
      actorType: 'user',
      actorId: ownerId,
      action: 'task.deleted',
      target: id,
      traceId,
    });

    return { success: true };
  }

  private mapTaskEntity(task: {
    id: string;
    projectId: string | null;
    parentTaskId: string | null;
    title: string;
    description: string | null;
    priority: string;
    status: string;
    dueAt: Date | null;
    timezone: string | null;
    version: number;
    taskTags?: Array<{ tag: { name: string } }>;
    subTasks?: unknown[];
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    return {
      id: task.id,
      projectId: task.projectId,
      parentTaskId: task.parentTaskId,
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: task.status,
      dueAt: task.dueAt ? task.dueAt.toISOString() : null,
      timezone: task.timezone,
      version: task.version,
      tags: task.taskTags ? task.taskTags.map((tt) => tt.tag.name) : [],
      subTasks: task.subTasks || [],
      createdAt: task.createdAt ? task.createdAt.toISOString() : undefined,
      updatedAt: task.updatedAt ? task.updatedAt.toISOString() : undefined,
    };
  }
}
