import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { findActiveSession } from '../session-security';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  sessionId: string;
}

@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const header = request.headers.authorization;
    if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Authentication required');
    }
    const session = await findActiveSession(header.slice(7));
    if (!session) throw new UnauthorizedException('Authentication required');
    request.user = { userId: session.user.id, email: session.user.email, sessionId: session.id } satisfies AuthenticatedUser;
    return true;
  }
}
