import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth.service.js';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const accessToken: unknown = request.cookies?.access_token;
    const { user } = await this.authService.authorize(
      typeof accessToken === 'string' ? accessToken : undefined,
    );

    if (user.perfil !== 'administrador') {
      throw new ForbiddenException(
        'Se requiere el rol administrador para realizar esta acción.',
      );
    }

    return true;
  }
}
