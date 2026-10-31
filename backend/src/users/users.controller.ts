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

// Expone las rutas HTTP relacionadas con los usuarios.
@Controller('users')
export class UsersController {
  // NestJS proporciona UsersService para ejecutar la lógica de negocio.
  constructor(private readonly usersService: UsersService) {}

  // GET /users/:id
  // Busca y devuelve el perfil público de un usuario mediante su ObjectId.
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findProfile(id);
  }

  // PUT /users/:id
  // Actualiza los campos de perfil enviados en el body y, opcionalmente, reemplaza la foto.
  @Put(':id')
  // Usa el interceptor seguro para recibir el campo multipart llamado "image".
  @UseInterceptors(SecureImageInterceptor('image'))
  update(
    // Parametro de la URL que identifica al usuario que se va a modificar.
    @Param('id') id: string,
    // Datos validados del perfil mediante UpdateProfileDto.
    @Body() dto: UpdateProfileDto,
    // Archivo opcional normalizado por el interceptor antes de llegar al controlador.
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return this.usersService.updateProfile(id, dto, image);
  }
}
