import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import {
  CalendarService,
  CreateCalendarEventDto,
  UpdateCalendarEventDto,
  ExternalGoogleEvent,
} from './calendar.service';
import { AuthGuard, AuthenticatedUser } from '../../common/guards/auth.guard';

@Controller()
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get('calendars')
  @UseGuards(AuthGuard)
  async listCalendars(@Req() req: { user: AuthenticatedUser }) {
    return this.calendarService.listCalendars(req.user.userId);
  }

  @Post('calendars')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createCalendar(
    @Req() req: { user: AuthenticatedUser },
    @Body() body: { provider: string; externalCalendarId: string },
  ) {
    return this.calendarService.createCalendar(req.user.userId, body);
  }

  @Get('calendar/events')
  @UseGuards(AuthGuard)
  async listEvents(
    @Req() req: { user: AuthenticatedUser },
    @Query('from') fromStr?: string,
    @Query('to') toStr?: string,
    @Query('calendarId') calendarId?: string,
  ) {
    if (!fromStr || !toStr) {
      throw new BadRequestException('query parameters "from" and "to" are required');
    }
    const from = new Date(fromStr);
    const to = new Date(toStr);
    return this.calendarService.listEvents(req.user.userId, from, to, calendarId);
  }

  @Post('calendar/events')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createEvent(
    @Req() req: { user: AuthenticatedUser },
    @Body() body: CreateCalendarEventDto,
    @Headers('x-trace-id') traceId?: string,
  ) {
    return this.calendarService.createEvent(req.user.userId, body, traceId);
  }

  @Get('calendar/conflicts')
  @UseGuards(AuthGuard)
  async detectConflicts(
    @Req() req: { user: AuthenticatedUser },
    @Query('startsAt') startsAtStr?: string,
    @Query('endsAt') endsAtStr?: string,
    @Query('excludeEventId') excludeEventId?: string,
  ) {
    if (!startsAtStr || !endsAtStr) {
      throw new BadRequestException('startsAt and endsAt query parameters are required');
    }
    const startsAt = new Date(startsAtStr);
    const endsAt = new Date(endsAtStr);
    return this.calendarService.detectConflicts(req.user.userId, startsAt, endsAt, excludeEventId);
  }

  @Get('calendar/events/:id')
  @UseGuards(AuthGuard)
  async getEvent(@Req() req: { user: AuthenticatedUser }, @Param('id') id: string) {
    return this.calendarService.getEvent(req.user.userId, id);
  }

  @Patch('calendar/events/:id')
  @UseGuards(AuthGuard)
  async updateEvent(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
    @Body() body: UpdateCalendarEventDto,
    @Headers('if-match') ifMatch?: string,
    @Headers('x-trace-id') traceId?: string,
  ) {
    const version = ifMatch ? parseInt(ifMatch, 10) : undefined;
    return this.calendarService.updateEvent(req.user.userId, id, body, version, traceId);
  }

  @Delete('calendar/events/:id')
  @UseGuards(AuthGuard)
  async deleteEvent(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
    @Headers('x-trace-id') traceId?: string,
  ) {
    return this.calendarService.deleteEvent(req.user.userId, id, traceId);
  }

  // Google Two-Way Sync Endpoint
  @Post('integrations/google/sync')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async triggerGoogleSync(
    @Req() req: { user: AuthenticatedUser },
    @Body()
    body: {
      calendarId: string;
      simulate410InvalidToken?: boolean;
      externalEvents?: ExternalGoogleEvent[];
    },
  ) {
    return this.calendarService.syncGoogleCalendar(req.user.userId, body.calendarId, body);
  }

  // Google Calendar Inbound Webhook Endpoint
  @Post('webhooks/google/calendar')
  @HttpCode(HttpStatus.OK)
  async handleGoogleWebhook(
    @Headers('x-goog-channel-id') channelId: string,
    @Headers('x-goog-resource-id') resourceId: string,
    @Headers('x-goog-channel-token') channelToken: string,
    @Headers('x-trace-id') traceId?: string,
  ) {
    return this.calendarService.handleGoogleWebhook(channelId, resourceId, channelToken, traceId);
  }
}
