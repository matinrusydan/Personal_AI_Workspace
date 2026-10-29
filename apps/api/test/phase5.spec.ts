import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@paw/database';
import { ApprovalsService } from '../src/modules/approvals/approvals.service';
import { AiService } from '../src/modules/ai/ai.service';
import { AgentsService } from '../src/modules/agents/agents.service';
import { WorkflowsService } from '../src/modules/workflows/workflows.service';
import { TasksService } from '../src/modules/tasks/tasks.service';
import { CalendarService } from '../src/modules/calendar/calendar.service';
import { MeetingsService } from '../src/modules/meetings/meetings.service';
import { RemindersService } from '../src/modules/reminders/reminders.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { randomUUID } from 'crypto';

describe('Post-MVP AI Assistant, Approvals, & Workflows (Phase 5)', () => {
  let auditService: AuditService;
  let tasksService: TasksService;
  let calendarService: CalendarService;
  let meetingsService: MeetingsService;
  let remindersService: RemindersService;
  let approvalsService: ApprovalsService;
  let aiService: AiService;
  let agentsService: AgentsService;
  let workflowsService: WorkflowsService;

  const testOwnerId = randomUUID();
  let createdApprovalId: string;
  let createdPayloadHash: string;

  beforeAll(async () => {
    auditService = new AuditService();
    tasksService = new TasksService(auditService);
    calendarService = new CalendarService(auditService);
    meetingsService = new MeetingsService(auditService);
    remindersService = new RemindersService(auditService);

    approvalsService = new ApprovalsService(
      auditService,
      tasksService,
      calendarService,
      meetingsService,
    );
    aiService = new AiService(approvalsService);
    agentsService = new AgentsService(auditService);
    workflowsService = new WorkflowsService(auditService, tasksService, remindersService);

    // Create user in PostgreSQL
    await prisma.user.create({
      data: {
        id: testOwnerId,
        email: `test-p5-${Date.now()}@example.com`,
        passwordHash: 'hash',
        passwordSalt: 'salt',
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('P5-01: Backend AI Assistant & Mandatory Approval Gateway', () => {
    it('creates an action proposal from natural language without mutating state directly', async () => {
      const res = await aiService.proposeAction(
        testOwnerId,
        'Besok jadwalkan meeting Zoom jam 09.00 tentang evaluasi sprint',
        'trace-ai-1',
      );

      expect(res.status).toBe('pending_approval');
      expect(res.proposal.id).toBeDefined();
      expect(res.proposal.action).toBe('meeting.create');
      expect(res.proposal.status).toBe('pending');
      createdApprovalId = res.proposal.id;
      createdPayloadHash = res.proposal.payloadHash;

      // Verify that NO meeting was created yet before approval
      const meetings = await prisma.meeting.findMany({
        where: { ownerId: testOwnerId },
      });
      expect(meetings).toHaveLength(0);
    });

    it('rejects approval decision if payload hash does not match (Tamper Protection)', async () => {
      await expect(
        approvalsService.decideApproval(testOwnerId, createdApprovalId, {
          decision: 'approved',
          payloadHash: 'tampered-fake-hash',
        }),
      ).rejects.toThrow('Payload digest mismatch');
    });

    it('executes deterministic domain action upon owner approval and emits outbox events', async () => {
      const decision = await approvalsService.decideApproval(
        testOwnerId,
        createdApprovalId,
        {
          decision: 'approved',
          payloadHash: createdPayloadHash,
        },
        'trace-decision-1',
      );

      expect(decision.success).toBe(true);
      expect(decision.decision).toBe('approved');
      expect(decision.executionResult).toBeDefined();

      // Verify meeting was created in PostgreSQL
      const meetings = await prisma.meeting.findMany({
        where: { ownerId: testOwnerId },
      });
      expect(meetings.length).toBeGreaterThanOrEqual(1);
    });

    it('rejects decisions on already resolved approval requests (Anti-Replay)', async () => {
      await expect(
        approvalsService.decideApproval(testOwnerId, createdApprovalId, {
          decision: 'approved',
          payloadHash: createdPayloadHash,
        }),
      ).rejects.toThrow('terminal state');
    });
  });

  describe('P5-02: Isolated Claude Code Coding Worker', () => {
    let codingRunId: string;

    it('dispatches coding run request with PR-only constraint and budget limits', async () => {
      const run = await agentsService.createCodingRun(
        testOwnerId,
        {
          repository: 'Personal_AI_Workspace',
          targetBranch: 'main',
          prompt: 'Add unit tests for calendar recurrence edge cases',
          budgetLimitUsd: 1.5,
        },
        'trace-agent-run',
      );

      expect(run.data.id).toBeDefined();
      expect(run.data.kind).toBe('coding');
      expect(run.data.status).toBe('pending');
      codingRunId = run.data.id;

      // Verify outbox event to notify runner
      const outbox = await prisma.outboxEvent.findFirst({
        where: {
          aggregateId: codingRunId,
          eventType: 'agent.coding_run.requested.v1',
        },
      });
      expect(outbox).not.toBeNull();
      expect((outbox?.payload as any).prOnly).toBe(true);
    });

    it('records completion of coding run with PR url and audit record', async () => {
      const completed = await agentsService.completeCodingRun(testOwnerId, codingRunId, {
        prUrl: 'https://github.com/matinrusydan/Personal_AI_Workspace/pull/1',
        featureBranch: 'feature/recurrence-tests',
        testSummary: 'All 38 tests passing',
        filesChangedCount: 3,
      });

      expect(completed.success).toBe(true);
      expect(completed.status).toBe('completed');
      expect(completed.prUrl).toContain('/pull/1');
    });
  });

  describe('P5-03: Workflow Engine & Plugin Interface', () => {
    it('creates versioned workflow definition and validates graph', async () => {
      const def = await workflowsService.createDefinition(testOwnerId, {
        name: 'Daily Morning Checklist Workflow',
        graph: {
          nodes: [
            {
              id: 'n1',
              type: 'trigger',
              config: { cron: '0 8 * * *' },
            },
            {
              id: 'n2',
              type: 'action',
              actionType: 'task.create',
              config: { title: 'Review today goals & calendar', priority: 'high' },
            },
          ],
          edges: [{ from: 'n1', to: 'n2' }],
        },
      });

      expect(def.data.id).toBeDefined();
      expect(def.data.revision).toBe(1);
      expect(def.data.status).toBe('published');

      // Execute workflow run
      const run = await workflowsService.executeWorkflow(testOwnerId, def.data.id);
      expect(run.status).toBe('completed');
      expect(run.steps[0]!.status).toBe('succeeded');
    });

    it('validates plugin manifests and rejects dangerous permissions in MVP', () => {
      // Valid plugin
      const validPlugin = workflowsService.validatePluginManifest({
        id: 'pomodoro-timer',
        version: '1.0.0',
        displayName: 'Pomodoro Timer Widget',
        permissions: ['ui:dashboard_slot'],
        uiSlots: ['dashboard-widget'],
      });
      expect(validPlugin.valid).toBe(true);
      expect(validPlugin.errors).toHaveLength(0);

      // Malicious plugin attempting shell/filesystem
      const dangerousPlugin = workflowsService.validatePluginManifest({
        id: 'untrusted-script',
        version: '1.0.0',
        displayName: 'Malicious Addon',
        permissions: ['shell:execute', 'filesystem:unrestricted'],
        uiSlots: [],
      });
      expect(dangerousPlugin.valid).toBe(false);
      expect(dangerousPlugin.errors.length).toBeGreaterThan(0);
    });
  });
});
