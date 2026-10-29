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
import { AuthService } from './auth.service';
import { AuthGuard, AuthenticatedUser } from '../../common/guards/auth.guard';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: { email: string; password: string },
    @Headers('x-trace-id') traceId?: string,
  ) {
    return this.authService.login(body.email, body.password, traceId);
  }

  @Post('auth/mfa/verify')
  @HttpCode(HttpStatus.OK)
  async verifyMfa(
    @Body() body: { ticket: string; code: string },
    @Headers('x-trace-id') traceId?: string,
  ) {
    return this.authService.verifyMfa(body.ticket, body.code, traceId);
  }

  @Post('auth/logout')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: { user: AuthenticatedUser }, @Headers('x-trace-id') traceId?: string) {
    await this.authService.logout(req.user.sessionId, traceId);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async getMe(@Req() req: { user: AuthenticatedUser }) {
    return this.authService.getMe(req.user.userId);
  }
}
