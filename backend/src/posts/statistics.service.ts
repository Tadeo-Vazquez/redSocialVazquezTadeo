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
        // Busca en la colección users el documento cuyo _id (foreignField) coincida con
        // el _id del grupo actual (localField, que es el usuarioId)
        // y guarda el resultado en un arreglo llamado usuario. Evita hacer un N+1 query (una consulta por cada usuario).
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
   * Cuenta comentarios visibles por día UTC y suma esos mismos valores para
   * obtener el total. El join descarta comentarios de publicaciones dadas de baja.
   */
  async totalComments(range: StatisticsRangeDto) {
    const pipeline: PipelineStage[] = [
      // Conserva solo los comentarios creados dentro del rango solicitado.
      { $match: this.createdAtFilter(range) },
      // Añade la publicación asociada, siempre que siga activa.
      this.activePostLookup(),
      // Convierte el arreglo de publicaciones en un valor; descarta comentarios
      // cuya publicación no existe o fue dada de baja.
      { $unwind: '$publicacion' },
      {
        // Agrupa por día de creación usando UTC y cuenta los comentarios de cada día.
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } },
          cantidad: { $sum: 1 },
        },
      },
      // Ordena los días cronológicamente.
      { $sort: { _id: 1 } },
      // Da nombres legibles a los campos que se devolverán.
      { $project: { _id: 0, fecha: '$_id', cantidad: 1 } },
    ];
    // Ejecuta la agregación y tipa cada fila como fecha y cantidad.
    const porDia = await this.commentModel
      .aggregate<{ fecha: string; cantidad: number }>(pipeline)
      .exec();
    // Suma las cantidades diarias y devuelve el total junto con el detalle.
    return { total: porDia.reduce((sum, day) => sum + day.cantidad, 0), porDia };
  }

  /**
   * Agrupa los comentarios visibles por publicación y devuelve su título para
   * identificar cada barra/segmento. Se comparte el filtro de rango y la
   * exclusión de publicaciones dadas de baja con totalComments.
   */
  async commentsPerPost(range: StatisticsRangeDto) {
    const pipeline: PipelineStage[] = [
      // Filtra los comentarios por la fecha de creación solicitada.
      { $match: this.createdAtFilter(range) },
      // Incorpora únicamente publicaciones que continúan activas.
      this.activePostLookup(),
      // Deja un documento por comentario con su publicación asociada.
      { $unwind: '$publicacion' },
      {
        // Agrupa por publicación, toma su título y cuenta sus comentarios.
        $group: {
          _id: '$publicacionId',
          titulo: { $first: '$publicacion.titulo' },
          cantidad: { $sum: 1 },
        },
      },
      {
        // Expone el identificador de publicación y los datos para el gráfico.
        $project: {
          _id: 0,
          publicacionId: '$_id',
          titulo: 1,
          cantidad: 1,
        },
      },
      // Muestra primero las publicaciones con más comentarios; desempata por título.
      { $sort: { cantidad: -1, titulo: 1 } },
    ];

    // Ejecuta la agregación y devuelve una fila por publicación.
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
        // Busca la publicación asociada a cada comentario en la colección posts.
        from: 'posts',
        // Guarda el ID de la publicación del comentario para compararlo en la subconsulta.
        let: { postId: '$publicacionId' },
        pipeline: [
          {
            $match: {
              $expr: {
                // Exige que coincidan el ID y el estado activo de la publicación.
                $and: [
                  { $eq: ['$_id', '$$postId'] },
                  { $eq: ['$isDeleted', false] },
                ],
              },
            },
          },
          // Recupera solo el título, que es el dato requerido por las estadísticas.
          { $project: { titulo: 1 } },
        ],
        // Guarda la coincidencia como arreglo en el campo publicacion.
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
    // Empieza con un filtro vacío; solo agrega los límites que fueron enviados.
    const filter: CreatedAtFilter = {};
    if (range.from) {
      // La fecha inicial se incluye en los resultados.
      filter.$gte = new Date(range.from);
    }

    if (range.to) {
      // Convierte el límite final a Date para compararlo con createdAt.
      const end = new Date(range.to);
      if (/^\d{4}-\d{2}-\d{2}$/.test(range.to)) {
        // Si solo llegó una fecha, incluye el día entero usando el día siguiente
        // como límite exclusivo.
        end.setUTCDate(end.getUTCDate() + 1);
        filter.$lt = end;
      } else {
        // Si llegó fecha y hora, incluye exactamente ese instante como límite.
        filter.$lte = end;
      }
    }

    // Obtiene los límites numéricos para validar que el rango tenga sentido.
    const lowerBound = filter.$gte?.getTime();
    const upperBound = (filter.$lt ?? filter.$lte)?.getTime();
    // Rechaza rangos invertidos o vacíos antes de consultar la base de datos.
    if (
      lowerBound !== undefined &&
      upperBound !== undefined &&
      (filter.$lt ? lowerBound >= upperBound : lowerBound > upperBound)
    ) {
      throw new BadRequestException(
        'La fecha de inicio no puede ser posterior a la fecha de fin.',
      );
    }

    // Devuelve el filtro dentro de createdAt; si no hay límites, no filtra por fecha.
    return Object.keys(filter).length > 0 ? { createdAt: filter } : {};
  }
}
