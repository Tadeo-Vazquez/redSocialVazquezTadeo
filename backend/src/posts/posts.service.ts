import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, PipelineStage, Types } from 'mongoose';
import { User, UserDocument } from '../users/users.schema.js';
import { CloudinaryService } from '../utils/cloudinary.service.js';
import { CreatePostDto } from './dtos/create-post.dto.js';
import { Post, PostDocument } from './posts.schema.js';
import { ListPostsDto } from './dtos/list-posts.dto.js';

@Injectable()
export class PostsService {
  constructor(
    // Los modelos representan colecciones de MongoDB y permiten consultas,
    // creación de documentos y operaciones de agregación de forma tipada.
    @InjectModel(Post.name) private readonly postModel: Model<PostDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    // Encapsula las operaciones externas de Cloudinary para mantenerlas fuera
    // de las consultas y reglas de negocio principales.
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  /**
   * Crea una publicación vinculada a un usuario activo. La imagen se sube
   * primero al proveedor externo y, si MongoDB falla, se elimina para no dejar
   * un archivo que ya no tenga una publicación asociada.
   */
  async create(dto: CreatePostDto, image?: Express.Multer.File) {
    // Primero se valida la relación autor-publicación: el ID recibido en el DTO
    // debe corresponder a un usuario existente que todavía esté activo.
    const user = await this.userModel.findOne({
      _id: dto.usuarioId,
      isDeleted: false,
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    // Sin imagen, ambos valores quedan vacíos. Si hay archivo, se reemplazan
    // con la URL pública y el public_id necesario para eliminarlo posteriormente.
    let imageUrl = '';
    let imagePublicId = '';

    // La imagen es opcional. Se sube antes de crear el documento porque su
    // public_id se necesita dentro de MongoDB y debe estar disponible si luego
    // hace falta deshacer la operación.
    if (image) {
      const uploadedImage = await this.cloudinaryService.uploadImage(
        image.buffer,
        'red-social/publicaciones',
      );
      imageUrl = uploadedImage.secure_url;
      imagePublicId = uploadedImage.public_id;
    }

    try {
      // Mongoose crea el documento y aplica el esquema. Se establece explícitamente
      // el estado inicial: ningún like y una publicación visible (isDeleted=false).
      const post = await this.postModel.create({
        usuarioId: user._id,
        titulo: dto.titulo,
        descripcion: dto.descripcion,
        imagenUrl: imageUrl,
        imagenPublicId: imagePublicId,
        likes: [],
        isDeleted: false,
      });

      // La respuesta combina un mensaje de confirmación con el documento creado,
      // de modo que el cliente pueda mostrarlo o actualizar su feed sin consultar otra vez.
      return {
        message: 'Publicación creada correctamente.',
        post,
      };
    } catch (error) {
      // Patrón de compensación: si MongoDB rechaza el documento después de subir
      // la imagen, se elimina el archivo remoto para evitar recursos huérfanos.
      if (imagePublicId) {
        await this.cloudinaryService.deleteImage(imagePublicId);
      }
      // Relanzar el mismo error conserva su tipo y detalles originales para que
      // NestJS pueda generar la respuesta HTTP correspondiente.
      throw error;
    }
  }

  /**
   * Devuelve una página de publicaciones junto con el total que coincide con
   * los filtros. La agregación hace el conteo y la consulta de página usando
   * el mismo conjunto de publicaciones activas.
   */
  async findAll(dto: ListPostsDto) {
    const offset = dto.offset ?? 0;
    const limit = dto.limit ?? 10;

    // El filtro comienza excluyendo publicaciones dadas de baja. Si el DTO
    // incluye usuarioId, se añade un filtro adicional para ese autor.
    const match: Record<string, unknown> = { isDeleted: false };

    if (dto.usuarioId) {
      match.usuarioId = new Types.ObjectId(dto.usuarioId);
    }

    // El pipeline organiza las operaciones en el mismo orden en que MongoDB
    // las ejecutará: filtrar, calcular, ordenar, paginar y contar.
    const pipeline: PipelineStage[] = [
      // $match reduce el conjunto desde el principio y evita procesar
      // publicaciones eliminadas o documentos ajenos al filtro de usuario.
      { $match: match },
      {
        $addFields: {
          // $size cuenta la cantidad de elementos de likes. $ifNull usa [] como
          // respaldo cuando el arreglo no existe o tiene valor null.
          likesCount: { $size: { $ifNull: ['$likes', []] } },
        },
      },
      {
        $sort:
          // Para ordenar por likes se prioriza likesCount y createdAt funciona
          // como desempate. Sin ese criterio, la fecha descendente determina todo el orden.
          dto.ordenar === 'likes'
            ? { likesCount: -1, createdAt: -1 }
            : { createdAt: -1 },
      },
      {
        $facet: {
          posts: [
            // Esta rama calcula la página solicitada y luego incorpora el perfil
            // del autor. $facet permite mantener esta operación en la misma consulta.
            { $skip: offset },
            { $limit: limit },
            {
              // $lookup busca documentos en users cuyo _id coincida con usuarioId.
              // El resultado queda en el arreglo usuario hasta convertirlo en objeto.
              $lookup: {
                from: 'users',
                localField: 'usuarioId',
                foreignField: '_id',
                as: 'usuario',
              },
            },
            {
              $set: {
                // $arrayElemAt selecciona el primer usuario encontrado. El índice 0
                // convierte la coincidencia única del arreglo en un objeto visible.
                usuario: { $arrayElemAt: ['$usuario', 0] },
              },
            },
            {
              $project: {
                // Los valores 0 excluyen campos sensibles sin eliminar las demás
                // propiedades del usuario ni de la publicación.
                'usuario.password': 0,
                'usuario.isDeleted': 0,
              },
            },
          ],
          // Cuenta los documentos que llegaron a $facet después de $match,
          // antes de que la rama posts aplique $skip y $limit.
          total: [{ $count: 'count' }],
        },
      },
      {
        $project: {
          // Mantiene la lista y toma el primer valor del arreglo de conteo.
          // $ifNull devuelve 0 cuando la agregación no encontró publicaciones.
          posts: 1,
          total: { $ifNull: [{ $arrayElemAt: ['$total.count', 0] }, 0] },
        },
      },
    ];

    const [result] = await this.postModel.aggregate(pipeline).exec();
    // Los operadores ?? protegen esta respuesta si MongoDB devuelve undefined.
    // offset y limit permiten al cliente saber qué porción del total recibió.
    return {
      offset,
      limit,
      total: result?.total ?? 0,
      posts: result?.posts ?? [],
    };
  }

  /**
   * Busca una publicación activa por ID y prepara los mismos datos derivados
   * que entrega el feed: autor visible y total de "me gusta". La agregación
   * mantiene coherente el formato que espera la tarjeta reutilizada en detalle.
   */
  async findOne(id: Types.ObjectId) {
    // Las dos condiciones de $match forman una búsqueda segura: el ID debe
    // coincidir exactamente y el documento debe seguir activo.
    const [post] = await this.postModel
      .aggregate([
        { $match: { _id: id, isDeleted: false } },
        {
          $addFields: {
            // likesCount entrega el total calculado por MongoDB y evita que
            // la interfaz tenga que contar el arreglo durante cada render.
            likesCount: { $size: { $ifNull: ['$likes', []] } },
          },
        },
        {
          $lookup: {
            // Une la publicación con users mediante usuarioId, permitiendo mostrar
            // nombre, username y avatar sin una consulta adicional al autor.
            from: 'users',
            localField: 'usuarioId',
            foreignField: '_id',
            as: 'usuario',
          },
        },
        {
          $set: {
            // Convierte el arreglo de coincidencias creado por $lookup en un
            // objeto usuario directamente accesible desde la respuesta.
            usuario: { $arrayElemAt: ['$usuario', 0] },
          },
        },
        {
          $project: {
            // Se excluyen credenciales y el estado interno de la cuenta. Los demás
            // campos del perfil incluido permanecen disponibles para la interfaz.
            'usuario.password': 0,
            'usuario.isDeleted': 0,
          },
        },
      ])
      .exec();

    if (!post) {
      throw new NotFoundException('Publicación no encontrada.');
    }
    // Se devuelve el único resultado esperado, ya que el ID identifica una
    // publicación y $match garantiza que su estado sea activo.
    return post;
  }

  /**
   * Registra un "me gusta" solo si la publicación y el usuario existen y aún
   * no hay una acción de ese usuario en el arreglo de likes.
   */
  async addLike(postId: Types.ObjectId, usuarioId?: string) {
    // usuarioId llega en el body o query, por eso no pasa automáticamente por
    // ParseMongoIdPipe y debe validarse explícitamente en el servicio.
    this.validateUserId(usuarioId);

    // La modificación solo puede afectar una publicación activa: una publicación
    // eliminada se considera inexistente para esta operación.
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
    // Mongoose devuelve los likes como ObjectId. Comparar sus representaciones
    // de texto permite detectar si el usuario ya agregó su like anteriormente.
    if (post.likes.some((likeId) => likeId.toString() === usuarioId)) {
      throw new ConflictException(
        'El usuario ya indicó que le gusta esta publicación.',
      );
    }

    post.likes.push(userObjectId);
    // save persiste la modificación del documento y ejecuta las validaciones
    // y middlewares definidos en el esquema de Mongoose.
    await post.save();

    // likes informa el contador final y likedByUser permite actualizar el estado
    // visual del cliente sin hacer una consulta adicional.
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
  async removeLike(postId: Types.ObjectId, usuarioId?: string) {
    this.validateUserId(usuarioId);

    // Buscar la publicación antes de modificar el arreglo garantiza que la
    // operación se haga únicamente sobre contenido activo.
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

    // hasLiked conserva el resultado de la comprobación anterior a la mutación:
    // permite diferenciar una acción válida de una solicitud inválida.
    const hasLiked = post.likes.some(
      (likeId) => likeId.toString() === usuarioId,
    );
    // No se permite quitar una acción que el usuario nunca realizó.
    if (!hasLiked) {
      throw new BadRequestException(
        'El usuario no había indicado me gusta en esta publicación.',
      );
    }

    // filter crea un nuevo arreglo que conserva todos los likes salvo el que
    // corresponde al ID recibido. Así no se modifica directamente la variable
    // mientras se recorre, y se sustituye el arreglo completo al guardar.
    post.likes = post.likes.filter((likeId) => likeId.toString() !== usuarioId);
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
  async remove(id: Types.ObjectId, usuarioId?: string) {
    this.validateUserId(usuarioId);

    // El filtro de isDeleted=false evita ejecutar una segunda eliminación sobre
    // una publicación que ya fue dada de baja.
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

    // El autor coincide si su ID almacenado es igual al ID recibido. Además,
    // el perfil administrador concede permiso para eliminar contenido ajeno.
    const isCreator = post.usuarioId.toString() === usuarioId;
    const isAdministrator = actor.perfil === 'administrador';
    if (!isCreator && !isAdministrator) {
      throw new ForbiddenException(
        'Solo el creador o un administrador pueden eliminar la publicación.',
      );
    }

    // Borrado lógico: se conserva el documento físico y sus relaciones. Al cambiar
    // isDeleted a true, los filtros activos dejan de devolver esta publicación.
    post.isDeleted = true;
    await post.save();

    return {
      message: 'Publicación eliminada correctamente.',
      post,
    };
  }

  /**
   * Comprueba el ID de usuario, que llega desde el body o query y no pasa por
   * ParseMongoIdPipe. Los IDs de publicación de estas operaciones ya llegan
   * convertidos por la pipe aplicada a sus parámetros de ruta.
   */
  private validateUserId(usuarioId: string | undefined): void {
    if (!usuarioId || !isValidObjectId(usuarioId)) {
      throw new BadRequestException(
        'El identificador del usuario no es válido.',
      );
    }
  }
}
