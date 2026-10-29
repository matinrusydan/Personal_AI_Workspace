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
import { MeetingsService, CreateMeetingRequestDto } from './meetings.service';
import { AuthGuard, AuthenticatedUser } from '../../common/guards/auth.guard';

@Controller('meetings')
@UseGuards(AuthGuard)
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  @Get()
  async listMeetings(@Req() req: { user: AuthenticatedUser }) {
    return this.meetingsService.listMeetings(req.user.userId);
  }

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async createMeeting(
    @Req() req: { user: AuthenticatedUser },
    @Body() body: CreateMeetingRequestDto,
    @Headers('x-trace-id') traceId?: string,
  ) {
    return this.meetingsService.createMeeting(req.user.userId, body, traceId);
  }

  @Get(':id')
  async getMeeting(@Req() req: { user: AuthenticatedUser }, @Param('id') id: string) {
    return this.meetingsService.getMeeting(req.user.userId, id);
  }
}
