import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { UpdateProfileDto } from './dtos/update-profile.dto.js';
import { UsersService } from './users.service.js';
import { SecureImageInterceptor } from '../utils/interceptors/secure-image.interceptor.js';
import { ParseMongoIdPipe } from '../utils/pipes/parse-mongo-id.pipe.js';
import type { Types } from 'mongoose';

// Expone las rutas HTTP relacionadas con los usuarios.
@Controller('users')
export class UsersController {
  // NestJS proporciona UsersService para ejecutar la lógica de negocio.
  constructor(private readonly usersService: UsersService) {}

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
