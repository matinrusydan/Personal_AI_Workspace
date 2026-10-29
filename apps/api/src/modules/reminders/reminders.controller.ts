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
import {
  RemindersService,
  CreateReminderRuleDto,
  AcknowledgeReminderDto,
  SnoozeReminderDto,
} from './reminders.service';
import { AuthGuard, AuthenticatedUser } from '../../common/guards/auth.guard';

@Controller('reminders')
@UseGuards(AuthGuard)
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Get()
  async listReminders(@Req() req: { user: AuthenticatedUser }, @Query('status') status?: string) {
    return this.remindersService.listReminders(req.user.userId, status);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createReminderRule(
    @Req() req: { user: AuthenticatedUser },
    @Body() body: CreateReminderRuleDto,
    @Headers('x-trace-id') traceId?: string,
  ) {
    return this.remindersService.createReminderRule(req.user.userId, body, traceId);
  }

  @Post(':id/acknowledge')
  @HttpCode(HttpStatus.OK)
  async acknowledge(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
    @Body() body: { clientRequestId: string; deviceId?: string },
    @Headers('x-trace-id') traceId?: string,
  ) {
    const dto: AcknowledgeReminderDto = {
      occurrenceId: id,
      clientRequestId: body.clientRequestId,
      deviceId: body.deviceId,
    };
    return this.remindersService.acknowledgeOccurrence(req.user.userId, dto, traceId);
  }

  @Post(':id/snooze')
  @HttpCode(HttpStatus.OK)
  async snooze(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
    @Body() body: { clientRequestId: string; minutes: number; deviceId?: string },
    @Headers('x-trace-id') traceId?: string,
  ) {
    const dto: SnoozeReminderDto = {
      occurrenceId: id,
      clientRequestId: body.clientRequestId,
      minutes: body.minutes,
      deviceId: body.deviceId,
    };
    return this.remindersService.snoozeOccurrence(req.user.userId, dto, traceId);
  }

  @Post('sweep')
  @HttpCode(HttpStatus.OK)
  async sweep() {
    return this.remindersService.sweepDueOccurrences();
  }

  @Post('escalate')
  @HttpCode(HttpStatus.OK)
  async escalate(@Query('graceMinutes') graceMinutes?: string) {
    const minutes = graceMinutes ? parseInt(graceMinutes, 10) : 5;
    return this.remindersService.checkAndEscalate(minutes);
  }
}
