import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ServicioComentarios } from './comentarios.service.js';
import { ComentarioDto } from './dtos/comentario.dto.js';
import { ListaComentariosDto } from './dtos/lista-comentarios.dto.js';
import { ParseMongoIdPipe } from '../../utils/pipes/parse-mongo-id.pipe.js';
import type { Types } from 'mongoose';

// Se conservan las rutas públicas existentes para no romper a sus clientes.
@Controller('posts/:postId/comments')
export class ControladorComentarios {
  constructor(private readonly servicioComentarios: ServicioComentarios) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  crearComentario(
    @Param('postId', ParseMongoIdPipe) publicacionId: Types.ObjectId,
    @Body() datos: ComentarioDto,
  ) {
    return this.servicioComentarios.crearComentario(publicacionId, datos);
  }

  @Get()
  listarComentarios(
    @Param('postId', ParseMongoIdPipe) publicacionId: Types.ObjectId,
    @Query() datos: ListaComentariosDto,
  ) {
    return this.servicioComentarios.listarComentarios(publicacionId, datos);
  }

  @Put(':commentId')
  @HttpCode(HttpStatus.OK)
  editarComentario(
    @Param('postId', ParseMongoIdPipe) publicacionId: Types.ObjectId,
    @Param('commentId', ParseMongoIdPipe) comentarioId: Types.ObjectId,
    @Body() datos: ComentarioDto,
  ) {
    return this.servicioComentarios.editarComentario(
      publicacionId,
      comentarioId,
      datos,
    );
  }
}
