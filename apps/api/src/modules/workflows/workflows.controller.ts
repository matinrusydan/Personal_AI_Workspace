import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Headers,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { WorkflowsService, CreateWorkflowDefinitionDto, PluginManifest } from './workflows.service';
import { AuthGuard, AuthenticatedUser } from '../../common/guards/auth.guard';

@Controller('workflows')
@UseGuards(AuthGuard)
export class WorkflowsController {
  constructor(private readonly workflowsService: WorkflowsService) {}

  @Get('definitions')
  async listDefinitions(@Req() req: { user: AuthenticatedUser }): Promise<{ data: unknown[] }> {
    return this.workflowsService.listDefinitions(req.user.userId);
  }

  @Post('definitions')
  @HttpCode(HttpStatus.CREATED)
  async createDefinition(
    @Req() req: { user: AuthenticatedUser },
    @Body() body: CreateWorkflowDefinitionDto,
    @Headers('x-trace-id') traceId?: string,
  ): Promise<{ data: unknown }> {
    return this.workflowsService.createDefinition(req.user.userId, body, traceId);
  }

  @Post('definitions/:id/run')
  @HttpCode(HttpStatus.OK)
  async runWorkflow(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
    @Body() body: { context?: Record<string, unknown> },
    @Headers('x-trace-id') traceId?: string,
  ): Promise<{ runId: string; status: string; steps: unknown[] }> {
    return this.workflowsService.executeWorkflow(req.user.userId, id, body.context || {}, traceId);
  }

  @Post('plugins/validate')
  @HttpCode(HttpStatus.OK)
  async validatePlugin(
    @Body() body: PluginManifest,
  ): Promise<{ valid: boolean; errors: string[] }> {
    return this.workflowsService.validatePluginManifest(body);
  }
}
