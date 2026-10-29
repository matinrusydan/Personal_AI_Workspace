import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  Headers,
} from '@nestjs/common';
import { DevicesService } from './devices.service';
import { AuthGuard, AuthenticatedUser } from '../../common/guards/auth.guard';

@Controller('devices')
@UseGuards(AuthGuard)
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post('register')
  @HttpCode(HttpStatus.OK)
  async registerDevice(
    @Req() req: { user: AuthenticatedUser },
    @Body()
    body: {
      platform: 'ios' | 'web' | 'desktop_windows';
      installId: string;
      deviceName?: string;
    },
    @Headers('x-trace-id') traceId?: string,
  ) {
    return this.devicesService.registerDevice(req.user.userId, body, traceId);
  }

  @Get('alarms')
  async getDeviceAlarms(@Req() req: { user: AuthenticatedUser }) {
    return this.devicesService.getDesiredAlarms(req.user.userId);
  }
}
