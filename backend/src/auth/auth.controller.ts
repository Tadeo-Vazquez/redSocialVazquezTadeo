import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { RegisterDto } from './dtos/register.dto.js';
import { LoginDto } from './dtos/login.dto.js';
import { AuthService } from './auth.service.js';
import { SecureImageInterceptor } from '../utils/interceptors/secure-image.interceptor.js';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @UseInterceptors(SecureImageInterceptor('image'))
  async register(
    @Body() dto: RegisterDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    this.logger.log(`POST /auth/register - Solicitud recibida para el email: ${dto.email}`);
    const result = await this.authService.register(dto, image);
    this.logger.log(`POST /auth/register - Respuesta finalizada correctamente para el email: ${dto.email}`);
    return result;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    this.logger.log(`POST /auth/login - Solicitud recibida para el usuario: ${dto.loginInput}`);
    const result = await this.authService.login(dto);
    this.logger.log(`POST /auth/login - Respuesta finalizada correctamente para el usuario: ${dto.loginInput}`);
    return result;
  }
}
