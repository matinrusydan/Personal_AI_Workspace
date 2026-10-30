import { Controller, Post, Get, Patch, Delete, Param, Body, UseGuards, Req, HttpCode, ForbiddenException, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard, AuthenticatedUser } from '../../common/guards/auth.guard';

interface AuthRequest {
  user: AuthenticatedUser;
  ip?: string;
  headers: { origin?: string };
}

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private async publicAttempt(req: AuthRequest, body: Record<string, unknown>) {
    this.origin(req);
    await this.authService.rateLimit(req.ip || 'unknown', typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 254) : 'mfa-or-setup');
  }

  private origin(req: AuthRequest) {
    // API uses bearer tokens, not browser cookies. Still reject foreign browser
    // origins on all auth mutations. Native clients do not send Origin.
    if (!req.headers.origin) return;
    try {
      const allowed = new URL(process.env.APP_ORIGIN || 'http://localhost:3000');
      if (allowed.pathname !== '/' || allowed.search || allowed.hash || allowed.username || allowed.password || !['http:', 'https:'].includes(allowed.protocol)) throw new Error('Invalid origin');
      if (req.headers.origin !== allowed.origin) throw new Error('Foreign origin');
    } catch {
      throw new ForbiddenException('Request origin is not allowed');
    }
  }

  private object(body: unknown): Record<string, unknown> {
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BadRequestException('Invalid request');
    return body as Record<string, unknown>;
  }

  @Post('auth/setup')
  @HttpCode(200)
  async setup(@Body() input: unknown, @Req() req: AuthRequest) {
    const body = this.object(input);
    await this.publicAttempt(req, body);
    return this.authService.bootstrap(body);
  }

  @Post('auth/login')
  @HttpCode(200)
  async login(@Body() input: unknown, @Req() req: AuthRequest) {
    const body = this.object(input);
    await this.publicAttempt(req, body);
    return this.authService.login(body.email, body.password);
  }

  @Post('auth/mfa/verify')
  @HttpCode(200)
  async verifyMfa(@Body() input: unknown, @Req() req: AuthRequest) {
    const body = this.object(input);
    await this.publicAttempt(req, body);
    return this.authService.verifyMfa(body.ticket, body.code);
  }

  @Post('auth/mfa/enroll/verify')
  @HttpCode(200)
  async verifyEnrollment(@Body() input: unknown, @Req() req: AuthRequest) {
    const body = this.object(input);
    await this.publicAttempt(req, body);
    return this.authService.verifyMfa(body.ticket, body.code, true);
  }

  @Post('auth/logout')
  @UseGuards(AuthGuard)
  @HttpCode(204)
  async logout(@Req() req: AuthRequest) {
    this.origin(req);
    await this.authService.logout(req.user.sessionId);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  getMe(@Req() req: AuthRequest) { return this.authService.getMe(req.user.userId); }

  @Get('auth/settings')
  @UseGuards(AuthGuard)
  settings(@Req() req: AuthRequest) { return this.authService.settings(req.user.userId, req.user.sessionId); }

  @Patch('auth/profile')
  @UseGuards(AuthGuard)
  updateProfile(@Body() input: unknown, @Req() req: AuthRequest) {
    this.origin(req);
    return this.authService.updateProfile(req.user.userId, this.object(input));
  }

  @Delete('auth/sessions/:id')
  @UseGuards(AuthGuard)
  revokeSession(@Param('id') id: string, @Req() req: AuthRequest) {
    this.origin(req);
    return this.authService.revokeSession(req.user.userId, id);
  }
}
