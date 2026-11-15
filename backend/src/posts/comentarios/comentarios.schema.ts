import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ComentarioDocumento = Comentario & Document;

@Schema({ timestamps: true, collection: 'comments' })
export class Comentario {
  // La referencia permite consultar los comentarios de una publicación y
  // ocultarlos cuando esa publicación se da de baja lógica.
  @Prop({
    type: Types.ObjectId,
    ref: 'Post',
    required: true,
    index: true,
  })
  publicacionId: Types.ObjectId;

  // Conservamos al autor como referencia: no duplicamos información del
  // perfil que podría cambiar, como el nombre de usuario o el avatar.
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  usuarioId: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 1000 })
  texto: string;

  // Se activa al editar, para que el cliente pueda indicar explícitamente
  // que el contenido ya no es el texto original.
  @Prop({ type: Boolean, default: false })
  modificado: boolean;
}

export const EsquemaComentario = SchemaFactory.createForClass(Comentario);
