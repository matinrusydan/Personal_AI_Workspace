import {
  Controller,
  Post,
  Body,
  Headers,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AiService } from './ai.service';
import { AuthGuard, AuthenticatedUser } from '../../common/guards/auth.guard';

@Controller('ai')
@UseGuards(AuthGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  /**
   * Natural Language Intent Proposal Gateway
   * Returns structured approval request; does NOT execute state changes directly.
   */
  @Post('propose')
  @HttpCode(HttpStatus.OK)
  async propose(
    @Req() req: { user: AuthenticatedUser },
    @Body() body: { prompt: string },
    @Headers('x-trace-id') traceId?: string,
  ): Promise<{
    status: string;
    message: string;
    proposal: unknown;
    summary: string;
    riskLevel: string;
  }> {
    return this.aiService.proposeAction(req.user.userId, body.prompt, traceId);
  }
}
