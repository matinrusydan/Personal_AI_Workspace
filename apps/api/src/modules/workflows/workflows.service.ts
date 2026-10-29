import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { prisma, Prisma } from '@paw/database';
import { AuditService } from '../audit/audit.service';
import { TasksService } from '../tasks/tasks.service';

export interface WorkflowNode {
  id: string;
  type: 'trigger' | 'condition' | 'action';
  actionType?: 'task.create' | 'reminder.schedule' | 'notification.send';
  config: Record<string, unknown>;
}

export interface WorkflowEdge {
  from: string;
  to: string;
}

export interface WorkflowGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface CreateWorkflowDefinitionDto {
  name: string;
  description?: string;
  graph: WorkflowGraph;
}

export interface PluginManifest {
  id: string;
  version: string;
  displayName: string;
  permissions: string[];
  uiSlots: string[];
}

@Injectable()
export class WorkflowsService {
  constructor(
    private readonly auditService: AuditService,
    private readonly tasksService: TasksService,
  ) {}

  /**
   * Creates or updates a versioned workflow definition (docs/WORKFLOW_AND_PLUGIN_SPEC.md)
   */
  async createDefinition(ownerId: string, dto: CreateWorkflowDefinitionDto, traceId?: string) {
    if (!dto.name || !dto.graph || !dto.graph.nodes) {
      throw new BadRequestException('Workflow name and graph nodes are required');
    }

    const definition = await prisma.workflowDefinition.create({
      data: {
        ownerId,
        revision: 1,
        status: 'published',
        graphJson: dto.graph as unknown as Prisma.InputJsonValue,
      },
    });

    this.auditService.record({
      actorType: 'user',
      actorId: ownerId,
      action: 'workflow.definition.created',
      target: definition.id,
      traceId,
      metadata: { name: dto.name, nodesCount: dto.graph.nodes.length },
    });

    return {
      data: {
        id: definition.id,
        revision: definition.revision,
        status: definition.status,
        graph: definition.graphJson,
        createdAt: definition.createdAt.toISOString(),
      },
    };
  }

  async listDefinitions(ownerId: string) {
    const definitions = await prisma.workflowDefinition.findMany({
      where: { ownerId },
      include: {
        runs: {
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      data: definitions.map((d) => ({
        id: d.id,
        revision: d.revision,
        status: d.status,
        graph: d.graphJson,
        runsCount: d.runs.length,
        createdAt: d.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Executes a workflow run deterministically step by step
   */
  async executeWorkflow(
    ownerId: string,
    definitionId: string,
    context: Record<string, unknown> = {},
    traceId?: string,
  ) {
    const definition = await prisma.workflowDefinition.findFirst({
      where: { id: definitionId, ownerId },
    });

    if (!definition) {
      throw new NotFoundException(`Workflow definition ${definitionId} not found`);
    }

    const graph = definition.graphJson as unknown as WorkflowGraph;

    const run = await prisma.workflowRun.create({
      data: {
        definitionId,
        revision: definition.revision,
        status: 'running',
        traceId,
      },
    });

    const executionSteps: Array<{ nodeId: string; status: string; output?: unknown }> = [];

    // Traverse and execute action nodes deterministically
    const actionNodes = graph.nodes.filter((n) => n.type === 'action');
    for (const node of actionNodes) {
      try {
        let result: unknown = null;
        if (node.actionType === 'task.create') {
          const title =
            (node.config['title'] as string) ||
            (context['title'] as string) ||
            'Automated Workflow Task';
          result = await this.tasksService.createTask(
            ownerId,
            {
              title,
              priority: (node.config['priority'] as any) || 'normal',
            },
            traceId,
          );
        }

        executionSteps.push({ nodeId: node.id, status: 'succeeded', output: result });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        executionSteps.push({ nodeId: node.id, status: 'failed', output: msg });
      }
    }

    const allSucceeded = executionSteps.every((s) => s.status === 'succeeded');
    const finalStatus = allSucceeded ? 'completed' : 'failed';

    await prisma.workflowRun.update({
      where: { id: run.id },
      data: {
        status: finalStatus,
        completedAt: new Date(),
      },
    });

    this.auditService.record({
      actorType: 'system',
      actorId: 'workflow-engine',
      action: `workflow.run.${finalStatus}`,
      target: run.id,
      traceId,
      metadata: { stepsExecuted: executionSteps.length, finalStatus },
    });

    return {
      runId: run.id,
      status: finalStatus,
      steps: executionSteps,
    };
  }

  /**
   * Plugin Manifest Validator (docs/WORKFLOW_AND_PLUGIN_SPEC.md)
   */
  validatePluginManifest(manifest: PluginManifest): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!manifest.id || !/^[a-z0-9-]+$/.test(manifest.id)) {
      errors.push('Plugin id must be kebab-case lowercase alphanumeric');
    }
    if (!manifest.version || !/^\d+\.\d+\.\d+$/.test(manifest.version)) {
      errors.push('Plugin version must follow SemVer (e.g. 1.0.0)');
    }
    if (!manifest.displayName) {
      errors.push('Plugin displayName is required');
    }

    // Security check: restrict dangerous permissions in MVP
    const DANGEROUS_PERMS = ['filesystem:unrestricted', 'shell:execute', 'network:raw'];
    for (const p of manifest.permissions || []) {
      if (DANGEROUS_PERMS.includes(p)) {
        errors.push(`Disallowed high-risk permission: ${p}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
