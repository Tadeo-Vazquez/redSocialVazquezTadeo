import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { CreatePostDto } from './dtos/create-post.dto.js';
import { PostsService } from './posts.service.js';
import { SecureImageInterceptor } from '../utils/interceptors/secure-image.interceptor.js';
import { ListPostsDto } from './dtos/list-posts.dto.js';
import { DeletePostDto } from './dtos/delete-post.dto.js';
import { UserActionDto } from './dtos/user-action.dto.js';

@Controller('posts')
export class PostsController {
  private readonly logger = new Logger(PostsController.name);

  constructor(private readonly postsService: PostsService) {}

  // POST /posts: recibe los datos validados y una imagen opcional.
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    SecureImageInterceptor('image', { width: 1080, height: 1440 }),
  )
  async create(
    @Body() dto: CreatePostDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    this.logger.log(
      `POST /posts - Creando publicación para el usuario ${dto.usuarioId}`,
    );
    const result = await this.postsService.create(dto, image);
    this.logger.log(
      `POST /posts - Publicación creada con ID ${result.post._id}`,
    );
    return result;
  }

  // GET /posts: delega filtros, ordenamiento y paginación al servicio.
  @Get()
  findAll(@Query() dto: ListPostsDto) {
    return this.postsService.findAll(dto);
  }

  // DELETE /posts/:id: inicia baja lógica; el servicio verifica permisos.
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('id') id: string,
    @Query('usuarioId') usuarioIdQuery: string,
    @Body() dto: Partial<DeletePostDto>,
  ) {
    const usuarioId = usuarioIdQuery ?? dto?.usuarioId;
    this.logger.log(
      `DELETE /posts/${id} - Solicitud del usuario ${usuarioId ?? 'desconocido'}`,
    );
    const result = await this.postsService.remove(id, usuarioId);
    this.logger.log(`DELETE /posts/${id} - Baja lógica completada`);
    return result;
  }

  // POST /posts/:id/likes: agrega el ObjectId del usuario al arreglo likes.
  @Post(':id/likes')
  @HttpCode(HttpStatus.CREATED)
  async addLike(
    @Param('id') id: string,
    @Query('usuarioId') usuarioIdQuery: string,
    @Body() dto: Partial<UserActionDto>,
  ) {
    const usuarioId = usuarioIdQuery ?? dto?.usuarioId;
    this.logger.log(
      `POST /posts/${id}/likes - Solicitud del usuario ${usuarioId ?? 'desconocido'}`,
    );
    return this.postsService.addLike(id, usuarioId);
  }

  // DELETE /posts/:id/likes: elimina el ObjectId del usuario si ya había dado like.
  @Delete(':id/likes')
  @HttpCode(HttpStatus.OK)
  async removeLike(
    @Param('id') id: string,
    @Query('usuarioId') usuarioIdQuery: string,
    @Body() dto: Partial<UserActionDto>,
  ) {
    const usuarioId = usuarioIdQuery ?? dto?.usuarioId;
    this.logger.log(
      `DELETE /posts/${id}/likes - Solicitud del usuario ${usuarioId ?? 'desconocido'}`,
    );
    return this.postsService.removeLike(id, usuarioId);
  }
}
