import { forwardRef, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { AUTH_TOKEN_TTL_MINUTES } from './auth.constants.js';
import { UsersModule } from '../users/users.module.js';
import { AdminGuard } from './guards/admin.guard.js';

@Module({
  imports: [
    forwardRef(() => UsersModule),
    JwtModule.registerAsync({
      inject: [ConfigService],
      // Lee el secreto desde el entorno para no guardar una clave sensible en el código.
      // getOrThrow hace que la app falle al arrancar si JWT_SECRET no está configurado.
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        // El JWT usa la misma duración que la cookie; se ajusta en auth.constants.ts.
        signOptions: { expiresIn: `${AUTH_TOKEN_TTL_MINUTES}m` },
      }),
    }),
  ],
  providers: [AuthService, AdminGuard],
  controllers: [AuthController],
  exports: [AuthService, AdminGuard],
})
export class AuthModule {}
