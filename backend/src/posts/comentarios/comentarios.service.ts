import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { User, UserDocument } from '../../users/users.schema.js';
import { Post, PostDocument } from '../posts.schema.js';
import { Comentario, ComentarioDocumento } from './comentarios.schema.js';
import { ComentarioDto } from './dtos/comentario.dto.js';
import { ListaComentariosDto } from './dtos/lista-comentarios.dto.js';

@Injectable()
export class ServicioComentarios {
  constructor(
    @InjectModel(Comentario.name)
    private readonly modeloComentario: Model<ComentarioDocumento>,
    @InjectModel(Post.name)
    private readonly modeloPublicacion: Model<PostDocument>,
    @InjectModel(User.name)
    private readonly modeloUsuario: Model<UserDocument>,
  ) {}

  /**
   * Crea un comentario asociado a una publicación y a un usuario activos.
   * El esquema agrega automáticamente createdAt y updatedAt mediante timestamps.
   */
  async crearComentario(
    publicacionId: Types.ObjectId,
    datos: ComentarioDto,
  ) {
    this.validarUsuarioId(datos.usuarioId);
    await this.verificarPublicacionActiva(publicacionId);
    await this.verificarUsuarioActivo(datos.usuarioId);

    const comentario = await this.modeloComentario.create({
      publicacionId,
      usuarioId: new Types.ObjectId(datos.usuarioId),
      texto: datos.texto,
      modificado: false,
    });

    return {
      mensaje: 'Comentario agregado correctamente.',
      comentario,
    };
  }

  /**
   * Lista los comentarios de una sola publicación. El orden secundario por ID
   * hace determinista la paginación cuando varios comentarios comparten fecha.
   */
  async listarComentarios(
    publicacionId: Types.ObjectId,
    datos: ListaComentariosDto,
  ) {
    await this.verificarPublicacionActiva(publicacionId);

    const filtro = { publicacionId };
    // La página y el total usan el mismo filtro; Promise.all ejecuta las dos
    // consultas independientes en paralelo sin cambiar el resultado esperado.
    const [comentarios, total] = await Promise.all([
      this.modeloComentario
        .find(filtro)
        // El segundo criterio hace estable el orden si dos comentarios
        // comparten la misma marca de tiempo.
        .sort({ createdAt: -1, _id: -1 })
        .skip(datos.offset)
        .limit(datos.limit)
        .populate('usuarioId', 'nombre apellido username avatarUrl')
        .exec(),
      this.modeloComentario.countDocuments(filtro).exec(),
    ]);

    return {
      publicacionId,
      desplazamiento: datos.offset,
      limite: datos.limit,
      total,
      comentarios,
    };
  }

  /**
   * Edita únicamente un comentario que pertenezca a la publicación indicada
   * y cuyo autor coincida con usuarioId; al guardar, marca el cambio para que
   * los clientes puedan distinguirlo del texto original.
   */
  async editarComentario(
    publicacionId: Types.ObjectId,
    comentarioId: Types.ObjectId,
    datos: ComentarioDto,
  ) {
    this.validarUsuarioId(datos.usuarioId);
    await this.verificarPublicacionActiva(publicacionId);
    await this.verificarUsuarioActivo(datos.usuarioId);

    const comentario = await this.modeloComentario
      .findOne({
        _id: comentarioId,
        publicacionId,
      })
      .exec();
    if (!comentario) {
      throw new NotFoundException('Comentario no encontrado.');
    }

    // Se compara el usuario recibido con el autor almacenado. Esta comprobación
    // solo demuestra autoría si usuarioId viene de una identidad autenticada;
    // un identificador enviado libremente por el cliente puede ser falsificado.
    if (comentario.usuarioId.toString() !== datos.usuarioId) {
      throw new ForbiddenException(
        'Solo el autor puede modificar este comentario.',
      );
    }

    comentario.texto = datos.texto;
    comentario.modificado = true;
    await comentario.save();

    return {
      mensaje: 'Comentario modificado correctamente.',
      comentario,
    };
  }

  // Comprueba que la publicación exista y no haya sido eliminada lógicamente.
  private async verificarPublicacionActiva(
    publicacionId: Types.ObjectId,
  ): Promise<void> {
    const publicacion = await this.modeloPublicacion
      .findOne({ _id: publicacionId, isDeleted: false })
      .select('_id')
      .exec();
    if (!publicacion) {
      throw new NotFoundException('Publicación no encontrada.');
    }
  }

  // Evita asociar comentarios a usuarios inexistentes o dados de baja.
  private async verificarUsuarioActivo(usuarioId: string): Promise<void> {
    const usuario = await this.modeloUsuario
      .findOne({ _id: usuarioId, isDeleted: false })
      .select('_id')
      .exec();
    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado.');
    }
  }

  /**
   * Valida el ID de usuario recibido en el body. Los IDs de publicación y
   * comentario llegan desde la ruta y son convertidos por ParseMongoIdPipe.
   */
  private validarUsuarioId(usuarioId: string | undefined): void {
    if (!usuarioId || !isValidObjectId(usuarioId)) {
      throw new BadRequestException(
        'El identificador del usuario no es válido.',
      );
    }
  }
}
