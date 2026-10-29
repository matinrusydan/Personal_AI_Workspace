import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApprovalsService } from './approvals.service';
import { AuthGuard, AuthenticatedUser } from '../../common/guards/auth.guard';

@Controller('approvals')
@UseGuards(AuthGuard)
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  @Get()
  async listApprovals(
    @Req() req: { user: AuthenticatedUser },
    @Query('status') status?: string,
  ): Promise<{ data: unknown[] }> {
    return this.approvalsService.listApprovalRequests(req.user.userId, status);
  }

  @Get(':id')
  async getApproval(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
  ): Promise<{ data: unknown }> {
    return this.approvalsService.getApprovalRequest(req.user.userId, id);
  }

  @Post(':id/decision')
  @HttpCode(HttpStatus.OK)
  async decideApproval(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
    @Body() body: { decision: 'approved' | 'rejected'; payloadHash: string },
    @Headers('x-trace-id') traceId?: string,
  ): Promise<{ success: boolean; decision: string; requestId: string; executionResult: unknown }> {
    return this.approvalsService.decideApproval(req.user.userId, id, body, traceId);
  }
}
