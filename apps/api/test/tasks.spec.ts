import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@paw/database';
import { TasksService } from '../src/modules/tasks/tasks.service';
import { ProjectsService } from '../src/modules/projects/projects.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { randomUUID } from 'crypto';

describe('Tasks & Projects Module (Milestone P2-01)', () => {
  let auditService: AuditService;
  let tasksService: TasksService;
  let projectsService: ProjectsService;

  const testOwnerId = randomUUID();
  let createdProjectId: string;
  let createdTaskId: string;
  let createdSubtaskId: string;

  beforeAll(async () => {
    auditService = new AuditService();
    tasksService = new TasksService(auditService);
    projectsService = new ProjectsService();

    // Create test user in database
    await prisma.user.create({
      data: {
        id: testOwnerId,
        email: `test-owner-${Date.now()}@example.com`,
        passwordHash: 'hash',
        passwordSalt: 'salt',
      },
    });
  });

  afterAll(async () => {
    // Cleanup test records
    await prisma.outboxEvent.deleteMany({
      where: {
        aggregateId: { in: [createdTaskId, createdSubtaskId].filter(Boolean) },
      },
    });
    await prisma.taskTag.deleteMany({
      where: { task: { ownerId: testOwnerId } },
    });
    await prisma.task.deleteMany({
      where: { ownerId: testOwnerId },
    });
    await prisma.project.deleteMany({
      where: { ownerId: testOwnerId },
    });
    await prisma.tag.deleteMany({
      where: { ownerId: testOwnerId },
    });
    await prisma.user.deleteMany({
      where: { id: testOwnerId },
    });
  });

  describe('Projects Service', () => {
    it('creates a new project and lists it', async () => {
      const res = await projectsService.createProject(testOwnerId, {
        title: 'Work Project A',
        colorToken: 'action.primary',
      });

      expect(res.data.id).toBeDefined();
      expect(res.data.title).toBe('Work Project A');
      createdProjectId = res.data.id;

      const list = await projectsService.listProjects(testOwnerId);
      expect(list.data.length).toBeGreaterThanOrEqual(1);
      const found = list.data.find((p) => p.id === createdProjectId);
      expect(found).toBeDefined();
    });
  });

  describe('Tasks Service', () => {
    it('creates a task with tags and emits task.created.v1 outbox event atomically', async () => {
      const res = await tasksService.createTask(
        testOwnerId,
        {
          title: 'Implement Core Feature',
          description: 'Detailed specification for feature',
          projectId: createdProjectId,
          priority: 'high',
          dueAt: new Date(Date.now() + 86400000).toISOString(),
          tags: ['backend', 'urgent'],
        },
        'trace-task-1',
      );

      expect(res.data.id).toBeDefined();
      expect(res.data.title).toBe('Implement Core Feature');
      expect(res.data.priority).toBe('high');
      expect(res.data.status).toBe('todo');
      expect(res.data.version).toBe(1);
      expect(res.data.tags).toContain('backend');
      expect(res.data.tags).toContain('urgent');
      createdTaskId = res.data.id;

      // Verify atomic outbox event was created in PostgreSQL
      const outbox = await prisma.outboxEvent.findFirst({
        where: {
          aggregateId: createdTaskId,
          eventType: 'task.created.v1',
        },
      });

      expect(outbox).not.toBeNull();
      expect(outbox?.aggregateType).toBe('task');
      expect(outbox?.traceId).toBe('trace-task-1');
    });

    it('creates a subtask linked to parent task', async () => {
      const res = await tasksService.createTask(testOwnerId, {
        title: 'Subtask 1: Write Tests',
        parentTaskId: createdTaskId,
        priority: 'normal',
      });

      expect(res.data.id).toBeDefined();
      expect(res.data.parentTaskId).toBe(createdTaskId);
      createdSubtaskId = res.data.id;

      // Verify parent task reflects subtask
      const parent = await tasksService.getTask(testOwnerId, createdTaskId);
      expect(parent.data.subTasks.length).toBeGreaterThanOrEqual(1);
      const sub = (parent.data.subTasks as Array<{ id: string }>).find(
        (s) => s.id === createdSubtaskId,
      );
      expect(sub).toBeDefined();
    });

    it('updates task status with optimistic concurrency version check and emits task.updated.v1', async () => {
      const updated = await tasksService.updateTask(
        testOwnerId,
        createdTaskId,
        {
          status: 'in_progress',
          version: 1, // Correct current version
        },
        undefined,
        'trace-task-update',
      );

      expect(updated.data.status).toBe('in_progress');
      expect(updated.data.version).toBe(2);

      // Verify outbox event task.updated.v1 was created
      const outbox = await prisma.outboxEvent.findFirst({
        where: {
          aggregateId: createdTaskId,
          eventType: 'task.updated.v1',
        },
      });

      expect(outbox).not.toBeNull();
      expect(outbox?.traceId).toBe('trace-task-update');
    });

    it('rejects update when version conflicts (optimistic concurrency protection)', async () => {
      // Trying to update with stale version 1 (when current is 2) must fail with ConflictException
      await expect(
        tasksService.updateTask(testOwnerId, createdTaskId, {
          title: 'Conflicting Edit',
          version: 1,
        }),
      ).rejects.toThrow('Task version mismatch');
    });

    it('filters tasks by status and project', async () => {
      const filtered = await tasksService.listTasks(testOwnerId, {
        status: 'in_progress',
        projectId: createdProjectId,
      });

      expect(filtered.data.length).toBeGreaterThanOrEqual(1);
      expect(filtered.data[0]!.id).toBe(createdTaskId);

      const emptyList = await tasksService.listTasks(testOwnerId, {
        status: 'done',
      });
      expect(emptyList.data.find((t) => t.id === createdTaskId)).toBeUndefined();
    });

    it('deletes task and emits task.deleted.v1 outbox event', async () => {
      // Delete subtask first
      await tasksService.deleteTask(testOwnerId, createdSubtaskId);

      const del = await tasksService.deleteTask(testOwnerId, createdTaskId, 'trace-del');
      expect(del.success).toBe(true);

      // Verify task is gone
      await expect(tasksService.getTask(testOwnerId, createdTaskId)).rejects.toThrow('not found');

      // Verify task.deleted.v1 outbox event
      const outbox = await prisma.outboxEvent.findFirst({
        where: {
          aggregateId: createdTaskId,
          eventType: 'task.deleted.v1',
        },
      });
      expect(outbox).not.toBeNull();
    });
  });
});
