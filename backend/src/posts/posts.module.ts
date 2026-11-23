import { Module } from '@nestjs/common';
import { PostsService } from './posts.service.js';
import { PostsController } from './posts.controller.js';
import { MongooseModule } from '@nestjs/mongoose';
import { Post, PostSchema } from './posts.schema.js';
import { UsersModule } from '../users/users.module.js';
import { ModuloComentarios } from './comentarios/comentarios.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { EstadisticasController } from './estadisticas.controller.js';
import {
  Comentario,
  EsquemaComentario,
} from './comentarios/comentarios.schema.js';
import { StatisticsService } from './statistics.service.js';

@Module({
  imports: [
    // Registra el modelo Post para poder inyectarlo en el servicio.
    MongooseModule.forFeature([
      { name: Post.name, schema: PostSchema },
      { name: Comentario.name, schema: EsquemaComentario },
    ]),
    // Importa User para verificar autores, usuarios activos y roles administrador.
    UsersModule,
    AuthModule,
    // Los comentarios forman parte de Publicaciones, pero tienen su propio
    // controlador, servicio y esquema para mantener separadas las responsabilidades.
    ModuloComentarios,
  ],
  providers: [PostsService, StatisticsService],
  controllers: [PostsController, EstadisticasController],
})
export class PostsModule {}
