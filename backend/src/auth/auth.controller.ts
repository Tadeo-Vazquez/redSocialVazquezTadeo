import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { RegisterDto } from './dtos/register.dto.js';
import { LoginDto } from './dtos/login.dto.js';
import { AuthService } from './auth.service.js';
import { AUTH_TOKEN_TTL_MINUTES } from './auth.constants.js';
import { SecureImageInterceptor } from '../utils/interceptors/secure-image.interceptor.js';
import { AccessToken } from './decorators/access-token.decorator.js';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @UseInterceptors(SecureImageInterceptor('image'))
  async register(
    @Body() dto: RegisterDto,
    @UploadedFile() image?: Express.Multer.File,
    @Res({ passthrough: true }) response?: Response,
  ) {
    this.logger.log(`POST /auth/register - Solicitud recibida para el email: ${dto.email}`);
    // El servicio entrega el token junto con los datos; se separa aquí para
    // enviarlo en el encabezado Set-Cookie y dejarlo fuera del cuerpo JSON.
    const { accessToken, ...result } = await this.authService.register(dto, image);
    this.setAuthCookie(response, accessToken);
    this.logger.log(`POST /auth/register - Respuesta finalizada correctamente para el email: ${dto.email}`);
    return result;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.logger.log(`POST /auth/login - Solicitud recibida para el usuario: ${dto.loginInput}`);
    // Login y registro usan la misma forma de emitir la sesión para que el
    // navegador reciba la cookie con idénticas opciones de seguridad.
    const { accessToken, ...result } = await this.authService.login(dto);
    this.setAuthCookie(response, accessToken);
    this.logger.log(`POST /auth/login - Respuesta finalizada correctamente para el usuario: ${dto.loginInput}`);
    return result;
  }

  @Post('autorizar')
  @HttpCode(HttpStatus.OK)
  async authorize(@AccessToken() accessToken: string | undefined) {
    this.logger.log('POST /auth/autorizar - Validando la cookie de sesión.');

    // El servicio responde 401 si falta el token, no es válido/ya venció o si
    // el usuario asociado fue eliminado o deshabilitado.
    return this.authService.authorize(accessToken);
  }

  @Post('refrescar')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @AccessToken() accessToken: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.logger.log('POST /auth/refrescar - Renovando la cookie de sesión.');

    // refresh valida primero el token vigente y devuelve un JWT recién firmado.
    // Se reemplaza la cookie solo si esa validación y la consulta del usuario pasan.
    const { accessToken: renewedToken, ...result } =
      await this.authService.refresh(accessToken);
    this.setAuthCookie(response, renewedToken);

    return result;
  }

  // El navegador no puede borrar directamente una cookie HttpOnly. Esta ruta
  // responde con Set-Cookie para expirarla en el navegador que hizo la petición.
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Res({ passthrough: true }) response: Response): void {
    // Usamos la misma ruta y opciones de seguridad que al crear la cookie.
    // Esto elimina la cookie del navegador, pero no revoca otras copias del JWT:
    // estas siguen siendo válidas hasta su vencimiento.
    response.clearCookie('access_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
  }

  private setAuthCookie(response: Response | undefined, accessToken: string): void {
    // HttpOnly impide que JavaScript lea el JWT; el navegador lo adjunta solo
    // en las solicitudes que coincidan con el dominio y la ruta de esta cookie.
    response?.cookie('access_token', accessToken, {
      httpOnly: true,
      // En producción obliga a transportar la cookie por HTTPS; en desarrollo
      // local permite probar HTTP sin configurar certificados.
      secure: process.env.NODE_ENV === 'production',
      // Lax permite la navegación normal al sitio y reduce el envío desde
      // solicitudes iniciadas por sitios externos.
      sameSite: 'lax',
      // Express recibe maxAge en milisegundos; la constante compartida está en minutos.
      maxAge: AUTH_TOKEN_TTL_MINUTES * 60 * 1000,
      // Hace que la cookie esté disponible para las rutas de autenticación y API.
      path: '/',
    });
  }
}
