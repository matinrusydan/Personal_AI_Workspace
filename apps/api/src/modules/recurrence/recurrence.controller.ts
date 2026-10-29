import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { RecurrenceService, CreateRecurrenceRuleDto } from './recurrence.service';
import { AuthGuard, AuthenticatedUser } from '../../common/guards/auth.guard';

@Controller('recurrence-rules')
@UseGuards(AuthGuard)
export class RecurrenceController {
  constructor(private readonly recurrenceService: RecurrenceService) {}

  @Get()
  async listRules(@Req() req: { user: AuthenticatedUser }) {
    return this.recurrenceService.listRules(req.user.userId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createRule(@Req() req: { user: AuthenticatedUser }, @Body() body: CreateRecurrenceRuleDto) {
    return this.recurrenceService.createRule(req.user.userId, body);
  }

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  async previewRule(
    @Body()
    body: {
      rrule: string;
      startsLocal: string;
      timezone: string;
      windowStart: string;
      windowEnd: string;
    },
  ) {
    return this.recurrenceService.previewOccurrences(
      body.rrule,
      body.startsLocal,
      body.timezone,
      body.windowStart,
      body.windowEnd,
    );
  }

  @Get(':id')
  async getRule(@Req() req: { user: AuthenticatedUser }, @Param('id') id: string) {
    return this.recurrenceService.getRule(req.user.userId, id);
  }

  @Delete(':id')
  async deleteRule(@Req() req: { user: AuthenticatedUser }, @Param('id') id: string) {
    return this.recurrenceService.deleteRule(req.user.userId, id);
  }
}
