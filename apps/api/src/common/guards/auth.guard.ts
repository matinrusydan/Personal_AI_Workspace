import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { ServerEnvSchema } from '@paw/config';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  sessionId: string;
}

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly jwtSecret: string;

  constructor() {
    const config = ServerEnvSchema.parse(process.env);
    this.jwtSecret = config.JWT_SECRET;
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, this.jwtSecret) as AuthenticatedUser;
      request.user = decoded;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}
