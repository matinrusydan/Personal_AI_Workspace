import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { StatsService } from './stats.service';
import { AuthGuard, AuthenticatedUser } from '../../common/guards/auth.guard';

@Controller('stats')
@UseGuards(AuthGuard)
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('overview')
  async getOverview(@Req() req: { user: AuthenticatedUser }) {
    return this.statsService.getOverviewStats(req.user.userId);
  }
}
