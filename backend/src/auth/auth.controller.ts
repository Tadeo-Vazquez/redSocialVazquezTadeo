import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
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
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @UseInterceptors(SecureImageInterceptor('image'))
  register(
    @Body() dto: RegisterDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return this.authService.register(dto, image);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}
