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
  async crearComentario(publicacionId: string, datos: ComentarioDto) {
    this.validarIdentificadores({
      publicacionId,
      usuarioId: datos.usuarioId,
    });
    await this.verificarPublicacionActiva(publicacionId);
    await this.verificarUsuarioActivo(datos.usuarioId);

    const comentario = await this.modeloComentario.create({
      publicacionId: new Types.ObjectId(publicacionId),
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
  async listarComentarios(publicacionId: string, datos: ListaComentariosDto) {
    this.validarIdentificadores({ publicacionId });
    await this.verificarPublicacionActiva(publicacionId);

    const filtro = { publicacionId: new Types.ObjectId(publicacionId) };
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
    publicacionId: string,
    comentarioId: string,
    datos: ComentarioDto,
  ) {
    this.validarIdentificadores({
      publicacionId,
      comentarioId,
      usuarioId: datos.usuarioId,
    });
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
    publicacionId: string,
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
   * Valida todos los ObjectId recibidos y traduce el nombre técnico del campo
   * a una etiqueta comprensible para construir el error que verá el cliente.
   */
  private validarIdentificadores(
    identificadores: Record<string, string | undefined>,
  ): void {
    for (const [campo, valor] of Object.entries(identificadores)) {
      if (!valor || !isValidObjectId(valor)) {
        const etiqueta =
          campo === 'publicacionId'
            ? 'publicación'
            : campo === 'comentarioId'
              ? 'comentario'
              : 'usuario';
        throw new BadRequestException(
          `El identificador de ${etiqueta} no es válido.`,
        );
      }
    }
  }
}
