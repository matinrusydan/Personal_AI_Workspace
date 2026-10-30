import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { IntegrationsService, IntegrationProviderName } from './integrations.service';
import { AuthGuard, AuthenticatedUser } from '../../common/guards/auth.guard';

interface AuthenticatedRequest {
  user: AuthenticatedUser;
}

@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get()
  @UseGuards(AuthGuard)
  async listStatuses(@Req() req: AuthenticatedRequest) {
    return this.integrationsService.listStatuses(req.user.userId);
  }

  @Get(':provider')
  @UseGuards(AuthGuard)
  async getStatus(
    @Req() req: AuthenticatedRequest,
    @Param('provider') provider: string,
  ) {
    if (!['google', 'zoom', 'telegram'].includes(provider)) {
      throw new BadRequestException('Provider tidak didukung');
    }
    const statuses = await this.integrationsService.listStatuses(req.user.userId);
    const item = statuses.data.find((s) => s.provider === provider);
    if (!item) throw new BadRequestException('Provider tidak ditemukan');
    return { data: item };
  }

  @Post(':provider/connect')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async startOAuth(
    @Req() req: AuthenticatedRequest,
    @Param('provider') provider: string,
  ) {
    if (!['google', 'zoom'].includes(provider)) {
      throw new BadRequestException('OAuth connect hanya didukung untuk Google dan Zoom');
    }
    return this.integrationsService.startOAuth(
      req.user.userId,
      req.user.sessionId,
      provider as 'google' | 'zoom',
    );
  }

  /**
   * Staging capability endpoint called by the Next.js callback route.
   * Validates state & browser binding capability; does NOT attach account yet.
   */
  @Post(':provider/oauth/stage')
  @HttpCode(HttpStatus.OK)
  async stageOAuthCallback(
    @Param('provider') provider: string,
    @Body() body: { transactionId: string; bindingToken: string; state: string; code: string },
  ) {
    if (!body || !body.transactionId || !body.bindingToken || !body.state || !body.code) {
      throw new BadRequestException('Parameter staging OAuth tidak lengkap');
    }
    return this.integrationsService.stageOAuthCallback(
      provider,
      body.transactionId,
      body.bindingToken,
      body.state,
      body.code,
    );
  }

  /**
   * Final completion endpoint called from same-origin continuation document carrying the Strict session!
   */
  @Post(':provider/oauth/complete')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async completeOAuth(
    @Req() req: AuthenticatedRequest,
    @Param('provider') provider: string,
    @Body() body: { flowId: string },
  ) {
    if (!['google', 'zoom'].includes(provider)) {
      throw new BadRequestException('Provider tidak didukung');
    }
    if (!body || !body.flowId) {
      throw new BadRequestException('flowId diperlukan untuk menyelesaikan integrasi');
    }
    return this.integrationsService.completeOAuth(
      req.user.userId,
      req.user.sessionId,
      provider as 'google' | 'zoom',
      body.flowId,
    );
  }

  @Post(':provider/test')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async testConnection(
    @Req() req: AuthenticatedRequest,
    @Param('provider') provider: string,
  ) {
    if (!['google', 'zoom', 'telegram'].includes(provider)) {
      throw new BadRequestException('Provider tidak didukung');
    }
    return this.integrationsService.testConnection(
      req.user.userId,
      provider as IntegrationProviderName,
    );
  }

  @Delete(':provider')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async disconnect(
    @Req() req: AuthenticatedRequest,
    @Param('provider') provider: string,
  ) {
    if (!['google', 'zoom', 'telegram'].includes(provider)) {
      throw new BadRequestException('Provider tidak didukung');
    }
    return this.integrationsService.disconnect(
      req.user.userId,
      provider as IntegrationProviderName,
    );
  }

  // --- Telegram Pairing Endpoints ---

  @Post('telegram/pairings')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createTelegramPairing(@Req() req: AuthenticatedRequest) {
    return this.integrationsService.createTelegramPairingChallenge(
      req.user.userId,
      req.user.sessionId,
    );
  }

  @Get('telegram/pairings/:id')
  @UseGuards(AuthGuard)
  async getTelegramPairingStatus(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.integrationsService.getTelegramPairingStatus(req.user.userId, id);
  }

  @Delete('telegram/pairings/:id')
  @UseGuards(AuthGuard)
  async cancelTelegramPairing(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.integrationsService.cancelTelegramPairing(req.user.userId, id);
  }
}
