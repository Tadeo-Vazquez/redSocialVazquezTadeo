import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage } from 'mongoose';
import {
  Comentario,
  ComentarioDocumento,
} from './comentarios/comentarios.schema.js';
import { Post, PostDocument } from './posts.schema.js';
import { StatisticsRangeDto } from './dtos/statistics-range.dto.js';

type CreatedAtFilter = {
  $gte?: Date;
  $lt?: Date;
  $lte?: Date;
};

@Injectable()
export class StatisticsService {
  constructor(
    @InjectModel(Post.name) private readonly postModel: Model<PostDocument>,
    @InjectModel(Comentario.name)
    private readonly commentModel: Model<ComentarioDocumento>,
  ) {}

  /**
   * Cuenta publicaciones visibles por autor dentro del rango pedido. Primero
   * filtra y agrupa en MongoDB, luego incorpora los datos públicos del autor
   * para devolver filas directamente utilizables por el gráfico.
   */
  async postsPerUser(range: StatisticsRangeDto) {
    const match: Record<string, unknown> = {
      isDeleted: false,
      ...this.createdAtFilter(range),
    };
    const pipeline: PipelineStage[] = [
      // Reducir el conjunto al inicio evita contar publicaciones dadas de baja
      // y hace que el rango de fechas afecte a cada etapa posterior.
      { $match: match },
      // Cada grupo representa un usuario; $sum: 1 incrementa por publicación.
      { $group: { _id: '$usuarioId', cantidad: { $sum: 1 } } },
      {
        // El identificador agrupado coincide con users._id. El lookup agrega
        // el perfil para rotular el dato sin una consulta por cada resultado.
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'usuario',
        },
      },
      // $lookup devuelve siempre un arreglo; el grupo tiene un único autor.
      { $set: { usuario: { $arrayElemAt: ['$usuario', 0] } } },
      {
        // Se renombra _id como usuarioId y solo se exponen campos necesarios
        // para el gráfico, nunca información privada del documento.
        $project: {
          _id: 0,
          usuarioId: '$_id',
          nombre: '$usuario.nombre',
          apellido: '$usuario.apellido',
          username: '$usuario.username',
          cantidad: 1,
        },
      },
      { $sort: { cantidad: -1, username: 1 } },
    ];

    return this.postModel.aggregate(pipeline).exec();
  }

  /**
   * Devuelve un único total de comentarios cuyo post sigue activo. El join y
   * unwind descartan comentarios huérfanos o pertenecientes a publicaciones
   * dadas de baja, manteniendo la misma visibilidad que usa el feed.
   */
  async totalComments(range: StatisticsRangeDto) {
    const pipeline: PipelineStage[] = [
      { $match: this.createdAtFilter(range) },
      this.activePostLookup(),
      { $unwind: '$publicacion' },
      { $count: 'total' },
    ];
    const [result] = await this.commentModel.aggregate(pipeline).exec();
    // MongoDB no produce fila en $count si no hay coincidencias; en ese caso
    // la API mantiene una respuesta numérica estable con total igual a cero.
    return { total: result?.total ?? 0 };
  }

  /**
   * Agrupa los comentarios visibles por publicación y devuelve su título para
   * identificar cada barra/segmento. Se comparte el filtro de rango y la
   * exclusión de publicaciones dadas de baja con totalComments.
   */
  async commentsPerPost(range: StatisticsRangeDto) {
    const pipeline: PipelineStage[] = [
      { $match: this.createdAtFilter(range) },
      this.activePostLookup(),
      { $unwind: '$publicacion' },
      {
        $group: {
          _id: '$publicacionId',
          titulo: { $first: '$publicacion.titulo' },
          cantidad: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          publicacionId: '$_id',
          titulo: 1,
          cantidad: 1,
        },
      },
      { $sort: { cantidad: -1, titulo: 1 } },
    ];

    return this.commentModel.aggregate(pipeline).exec();
  }

  /**
   * Busca la publicación referenciada por cada comentario y solo conserva
   * coincidencias activas. La proyección reduce el documento unido a lo único
   * requerido por las estadísticas.
   */
  private activePostLookup(): PipelineStage {
    return {
      $lookup: {
        from: 'posts',
        let: { postId: '$publicacionId' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$_id', '$$postId'] },
                  { $eq: ['$isDeleted', false] },
                ],
              },
            },
          },
          { $project: { titulo: 1 } },
        ],
        as: 'publicacion',
      },
    };
  }

  /**
   * Construye la condición MongoDB para `createdAt`. Una fecha sin hora en
   * `to` representa el día entero y se expresa como límite exclusivo del día
   * siguiente; los timestamps, en cambio, usan exactamente el instante dado.
   * También rechaza rangos invertidos antes de enviar la agregación a MongoDB.
   */
  private createdAtFilter(range: StatisticsRangeDto): {
    createdAt?: CreatedAtFilter;
  } {
    const filter: CreatedAtFilter = {};
    if (range.from) {
      filter.$gte = new Date(range.from);
    }

    if (range.to) {
      const end = new Date(range.to);
      if (/^\d{4}-\d{2}-\d{2}$/.test(range.to)) {
        end.setUTCDate(end.getUTCDate() + 1);
        filter.$lt = end;
      } else {
        filter.$lte = end;
      }
    }

    const lowerBound = filter.$gte?.getTime();
    const upperBound = (filter.$lt ?? filter.$lte)?.getTime();
    if (
      lowerBound !== undefined &&
      upperBound !== undefined &&
      lowerBound >= upperBound
    ) {
      throw new BadRequestException(
        'El parámetro from debe ser anterior al límite superior de to.',
      );
    }

    return Object.keys(filter).length > 0 ? { createdAt: filter } : {};
  }
}
