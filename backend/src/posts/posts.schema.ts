import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PostDocument = Post & Document;

// Representa una publicación almacenada en MongoDB.
@Schema({ timestamps: true })
export class Post {
  // ObjectId del usuario creador; se relaciona con la colección users mediante ref.
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  usuarioId: Types.ObjectId;

  // Datos principales visibles de la publicación.
  @Prop({ required: true, trim: true })
  titulo: string;

  @Prop({ required: true, trim: true })
  descripcion: string;

  // URL pública de la imagen y public_id usado para eliminarla desde Cloudinary.
  @Prop({ type: String, default: '', trim: true })
  imagenUrl: string;

  @Prop({ type: String, default: '', trim: true })
  imagenPublicId: string;

  // Cada ObjectId representa un usuario que realizó un me gusta.
  // Al no permitir repetir IDs, una publicación puede recibir un solo like por usuario.
  @Prop({
    type: [{ type: Types.ObjectId, ref: 'User' }],
    default: [],
  })
  likes: Types.ObjectId[];

  // La baja lógica conserva el documento sin mostrarlo ni permitir futuras acciones.
  @Prop({ default: false, index: true })
  isDeleted: boolean;
}

export const PostSchema = SchemaFactory.createForClass(Post);
