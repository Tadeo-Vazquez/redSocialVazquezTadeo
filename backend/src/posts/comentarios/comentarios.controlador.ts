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

// Se conservan las rutas públicas existentes para no romper a sus clientes.
@Controller('posts/:postId/comments')
export class ControladorComentarios {
  constructor(private readonly servicioComentarios: ServicioComentarios) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  crearComentario(
    @Param('postId') publicacionId: string,
    @Body() datos: ComentarioDto,
  ) {
    return this.servicioComentarios.crearComentario(publicacionId, datos);
  }

  @Get()
  listarComentarios(
    @Param('postId') publicacionId: string,
    @Query() datos: ListaComentariosDto,
  ) {
    return this.servicioComentarios.listarComentarios(publicacionId, datos);
  }

  @Put(':commentId')
  @HttpCode(HttpStatus.OK)
  editarComentario(
    @Param('postId') publicacionId: string,
    @Param('commentId') comentarioId: string,
    @Body() datos: ComentarioDto,
  ) {
    return this.servicioComentarios.editarComentario(
      publicacionId,
      comentarioId,
      datos,
    );
  }
}
