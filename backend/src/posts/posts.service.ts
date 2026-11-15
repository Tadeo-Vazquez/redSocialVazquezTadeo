import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  isValidObjectId,
  Model,
  PipelineStage,
  Types,
} from 'mongoose';
import { User, UserDocument } from '../users/users.schema.js';
import { CloudinaryService } from '../utils/cloudinary.service.js';
import { CreatePostDto } from './dtos/create-post.dto.js';
import { Post, PostDocument } from './posts.schema.js';
import { ListPostsDto } from './dtos/list-posts.dto.js';

@Injectable()
export class PostsService {
  constructor(
    @InjectModel(Post.name) private readonly postModel: Model<PostDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  /**
   * Crea una publicación vinculada a un usuario activo. La imagen se sube
   * primero al proveedor externo y, si MongoDB falla, se elimina para no dejar
   * un archivo que ya no tenga una publicación asociada.
   */
  async create(dto: CreatePostDto, image?: Express.Multer.File) {
    // La publicación solo puede pertenecer a una cuenta activa existente.
    const user = await this.userModel.findOne({
      _id: dto.usuarioId,
      isDeleted: false,
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    let imageUrl = '';
    let imagePublicId = '';

    // La imagen es opcional; si existe se guarda primero en Cloudinary.
    if (image) {
      const uploadedImage = await this.cloudinaryService.uploadImage(
        image.buffer,
        'red-social/publicaciones',
      );
      imageUrl = uploadedImage.secure_url;
      imagePublicId = uploadedImage.public_id;
    }

    try {
      // Registra la relación con el usuario y establece likes vacío e isDeleted falso.
      const post = await this.postModel.create({
        usuarioId: user._id,
        titulo: dto.titulo,
        descripcion: dto.descripcion,
        imagenUrl: imageUrl,
        imagenPublicId: imagePublicId,
        likes: [],
        isDeleted: false,
      });

      return {
        message: 'Publicación creada correctamente.',
        post,
      };
    } catch (error) {
      // Evita guardar una imagen huérfana si MongoDB rechaza la publicación.
      if (imagePublicId) {
        await this.cloudinaryService.deleteImage(imagePublicId);
      }
      throw error;
    }
  }

  /**
   * Devuelve una página de publicaciones junto con el total que coincide con
   * los filtros. La agregación hace el conteo y la consulta de página usando
   * el mismo conjunto de publicaciones activas.
   */
  async findAll(dto: ListPostsDto) {
    // offset indica desde qué publicación comenzar y limit cuántas traer.
    const offset = dto.offset ?? 0;
    const limit = dto.limit ?? 10;
    const match: Record<string, unknown> = { isDeleted: false };

    if (dto.usuarioId) {
      match.usuarioId = new Types.ObjectId(dto.usuarioId);
    }

    const pipeline: PipelineStage[] = [
      // Solo se buscan publicaciones que no estén dadas de baja.
      { $match: match },
      {
        $addFields: {
          // Obtiene la cantidad real de elementos del arreglo likes.
          likesCount: { $size: { $ifNull: ['$likes', []] } },
        },
      },
      {
        $sort:
          // Ordena por likes o, por defecto, por fecha descendente.
          dto.ordenar === 'likes'
            ? { likesCount: -1, createdAt: -1 }
            : { createdAt: -1 },
      },
      {
        $facet: {
          posts: [
            // $facet permite obtener la página y el total en una sola agregación:
            // esta rama pagina, incorpora el perfil del autor y oculta datos privados.
            { $skip: offset },
            { $limit: limit },
            {
              $lookup: {
                from: 'users',
                localField: 'usuarioId',
                foreignField: '_id',
                as: 'usuario',
              },
            },
            {
              $set: {
                usuario: { $arrayElemAt: ['$usuario', 0] },
              },
            },
            {
              $project: {
                // Retorna también el total general y las publicaciones de la página.
                'usuario.password': 0,
                'usuario.isDeleted': 0,
              },
            },
          ],
          total: [{ $count: 'count' }],
        },
      },
      {
        $project: {
          posts: 1,
          total: { $ifNull: [{ $arrayElemAt: ['$total.count', 0] }, 0] },
        },
      },
    ];

    const [result] = await this.postModel.aggregate(pipeline).exec();
    return {
      offset,
      limit,
      total: result?.total ?? 0,
      posts: result?.posts ?? [],
    };
  }

  /**
   * Registra un "me gusta" solo si la publicación y el usuario existen y aún
   * no hay una acción de ese usuario en el arreglo de likes.
   */
  async addLike(postId: string, usuarioId?: string) {
    // Valida primero IDs, porque los datos deben tener formato ObjectId.
    this.validateIds(postId, usuarioId, 'publicación');

    const post = await this.postModel.findOne({
      _id: postId,
      isDeleted: false,
    });
    if (!post) {
      throw new NotFoundException('Publicación no encontrada.');
    }

    const user = await this.userModel.findOne({
      _id: usuarioId,
      isDeleted: false,
    });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    const userObjectId = new Types.ObjectId(usuarioId);
    // Buscar repetidos antes de modificar el arreglo evita un segundo like.
    if (post.likes.some((likeId) => likeId.toString() === usuarioId)) {
      throw new ConflictException(
        'El usuario ya indicó que le gusta esta publicación.',
      );
    }

    post.likes.push(userObjectId);
    await post.save();

    return {
      message: 'Me gusta agregado correctamente.',
      likes: post.likes.length,
      likedByUser: true,
    };
  }

  /**
   * Quita un "me gusta" existente. Se valida antes de filtrar el arreglo para
   * distinguir entre eliminar una acción real y solicitar una que nunca existió.
   */
  async removeLike(postId: string, usuarioId?: string) {
    this.validateIds(postId, usuarioId, 'publicación');

    const post = await this.postModel.findOne({
      _id: postId,
      isDeleted: false,
    });
    if (!post) {
      throw new NotFoundException('Publicación no encontrada.');
    }

    const user = await this.userModel.findOne({
      _id: usuarioId,
      isDeleted: false,
    });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    const hasLiked = post.likes.some(
      (likeId) => likeId.toString() === usuarioId,
    );
    // No se permite quitar una acción que el usuario nunca realizó.
    if (!hasLiked) {
      throw new BadRequestException(
        'El usuario no había indicado me gusta en esta publicación.',
      );
    }

    post.likes = post.likes.filter(
      (likeId) => likeId.toString() !== usuarioId,
    );
    await post.save();

    return {
      message: 'Me gusta eliminado correctamente.',
      likes: post.likes.length,
      likedByUser: false,
    };
  }

  /**
   * Aplica una baja lógica: conserva el documento y sus relaciones, pero deja
   * de incluirlo en consultas que filtran isDeleted=false. Solo puede hacerlo
   * el creador o un usuario administrador.
   */
  async remove(id: string, usuarioId?: string) {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('El identificador de la publicación no es válido.');
    }
    if (!usuarioId || !isValidObjectId(usuarioId)) {
      throw new BadRequestException('El identificador del usuario no es válido.');
    }

    const post = await this.postModel.findOne({
      _id: id,
      isDeleted: false,
    });
    if (!post) {
      throw new NotFoundException('Publicación no encontrada.');
    }

    const actor = await this.userModel.findOne({
      _id: usuarioId,
      isDeleted: false,
    });
    if (!actor) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    const isCreator = post.usuarioId.toString() === usuarioId;
    const isAdministrator = actor.perfil === 'administrador';
    // El creador puede eliminar su publicación y un administrador puede eliminar cualquiera.
    if (!isCreator && !isAdministrator) {
      throw new ForbiddenException(
        'Solo el creador o un administrador pueden eliminar la publicación.',
      );
    }

    post.isDeleted = true;
    await post.save();

    return {
      message: 'Publicación eliminada correctamente.',
      post,
    };
  }

  /**
   * Comprueba los identificadores antes de usarlos en consultas Mongoose.
   * Así los valores ausentes o mal formados generan un error HTTP claro y no
   * un error de conversión de MongoDB.
   */
  private validateIds(
    postId: string,
    usuarioId: string | undefined,
    entityName: string,
  ): void {
    if (!isValidObjectId(postId)) {
      throw new BadRequestException(
        `El identificador de la ${entityName} no es válido.`,
      );
    }
    if (!usuarioId || !isValidObjectId(usuarioId)) {
      throw new BadRequestException(
        'El identificador del usuario no es válido.',
      );
    }
  }
}
