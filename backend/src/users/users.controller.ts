import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { UpdateProfileDto } from './dtos/update-profile.dto.js';
import { UsersService } from './users.service.js';
import { SecureImageInterceptor } from '../utils/interceptors/secure-image.interceptor.js';
import { ParseMongoIdPipe } from '../utils/pipes/parse-mongo-id.pipe.js';
import type { Types } from 'mongoose';
import { AdminGuard } from '../auth/guards/admin.guard.js';
import { CreateUserDto } from './dtos/create-user.dto.js';

// Expone las rutas HTTP relacionadas con los usuarios.
@Controller('users')
export class UsersController {
  // NestJS proporciona UsersService para ejecutar la lógica de negocio.
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(AdminGuard)
  findAll() {
    return this.usersService.findAll();
  }

  // El guard comprueba primero la sesión y el rol. Después, el interceptor
  // recibe el campo multipart "image" y valida y normaliza la imagen antes de
  // pasarla al servicio; también se conservan las solicitudes JSON sin archivo.
  @Post()
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(SecureImageInterceptor('image'))
  create(
    @Body() dto: CreateUserDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return this.usersService.create(dto, image);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  disable(@Param('id', ParseMongoIdPipe) id: Types.ObjectId) {
    return this.usersService.disable(id);
  }

  @Post(':id/habilitar')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.OK)
  enable(@Param('id', ParseMongoIdPipe) id: Types.ObjectId) {
    return this.usersService.enable(id);
  }

  // GET /users/:id
  // Busca y devuelve el perfil público de un usuario mediante su ObjectId.
  @Get(':id')
  findOne(@Param('id', ParseMongoIdPipe) id: Types.ObjectId) {
    return this.usersService.findProfile(id);
  }

  // PUT /users/:id
  // Actualiza el perfil identificado por id. Los campos llegan como multipart/form-data
  // porque la misma petición puede incluir la foto nueva.
  @Put(':id')
  // Antes de ejecutar update(), valida y normaliza el archivo del campo "image" si existe.
  @UseInterceptors(SecureImageInterceptor('image'))
  update(
    // Parametro de la URL que identifica al usuario que se va a modificar.
    @Param('id', ParseMongoIdPipe) id: Types.ObjectId,
    // Datos validados del perfil mediante UpdateProfileDto.
    @Body() dto: UpdateProfileDto,
    // Archivo opcional normalizado por el interceptor antes de llegar al controlador.
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return this.usersService.updateProfile(id, dto, image);
  }
}
