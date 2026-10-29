import {
  Controller,
  Post,
  Get,
  Body,
  Param,
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

  @Get()
  async listDevices(@Req() req: { user: AuthenticatedUser }) {
    return this.devicesService.listDevices(req.user.userId);
  }

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

  @Post('alarms/:id/status')
  @HttpCode(HttpStatus.OK)
  async reportAlarmStatus(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
    @Body() body: { platformAlarmId?: string; status: string; errorMessage?: string },
    @Headers('x-trace-id') traceId?: string,
  ) {
    return this.devicesService.reportAlarmStatus(req.user.userId, id, body, traceId);
  }
}
