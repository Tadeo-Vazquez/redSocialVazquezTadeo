import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../../users/users.module.js';
import { Post, PostSchema } from '../posts.schema.js';
import { ControladorComentarios } from './comentarios.controlador.js';
import { ServicioComentarios } from './comentarios.service.js';
import { Comentario, EsquemaComentario } from './comentarios.schema.js';

@Module({
  imports: [
    // Este módulo necesita validar que la publicación esté activa y que el
    // usuario exista antes de guardar o devolver comentarios.
    MongooseModule.forFeature([
      { name: Comentario.name, schema: EsquemaComentario },
      { name: Post.name, schema: PostSchema },
    ]),
    UsersModule,
  ],
  controllers: [ControladorComentarios],
  providers: [ServicioComentarios],
})
export class ModuloComentarios {}
