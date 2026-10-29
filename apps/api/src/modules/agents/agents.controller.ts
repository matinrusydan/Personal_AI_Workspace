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
import { AgentsService, CreateCodingRunDto, CompleteCodingRunDto } from './agents.service';
import { AuthGuard, AuthenticatedUser } from '../../common/guards/auth.guard';

@Controller('agents')
@UseGuards(AuthGuard)
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get('coding-runs')
  async listRuns(@Req() req: { user: AuthenticatedUser }) {
    return this.agentsService.listCodingRuns(req.user.userId);
  }

  @Post('coding-runs')
  @HttpCode(HttpStatus.ACCEPTED)
  async createRun(
    @Req() req: { user: AuthenticatedUser },
    @Body() body: CreateCodingRunDto,
    @Headers('x-trace-id') traceId?: string,
  ) {
    return this.agentsService.createCodingRun(req.user.userId, body, traceId);
  }

  @Get('coding-runs/:id')
  async getRun(@Req() req: { user: AuthenticatedUser }, @Param('id') id: string) {
    return this.agentsService.getCodingRun(req.user.userId, id);
  }

  @Post('coding-runs/:id/complete')
  @HttpCode(HttpStatus.OK)
  async completeRun(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
    @Body() body: CompleteCodingRunDto,
    @Headers('x-trace-id') traceId?: string,
  ) {
    return this.agentsService.completeCodingRun(req.user.userId, id, body, traceId);
  }
}
