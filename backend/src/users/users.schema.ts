import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;
export type UserProfile = 'usuario' | 'administrador';

// Define en MongoDB los campos que tendrá cada usuario y sus reglas.
@Schema({ timestamps: true })
export class User {
  // Nombre real del usuario; elimina espacios sobrantes al inicio y final.
  @Prop({ required: true, trim: true })
  nombre: string;

  // Apellido real del usuario.
  @Prop({ required: true, trim: true })
  apellido: string;

  // Correo electrónico único, normalizado en minúsculas.
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  // Nombre de usuario único, usado también para iniciar sesión.
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  username: string;

  // Hash bcrypt. select:false impide que aparezca en consultas normales.
  @Prop({ required: true, select: false })
  password: string;

  // Fecha de nacimiento almacenada como Date.
  @Prop({ required: true })
  fechaNacimiento: Date;

  // Texto breve presentado en el perfil del usuario.
  @Prop({ required: true })
  descripcionBreve: string;

  // URL HTTPS de la foto almacenada en Cloudinary.
  @Prop({ type: String, default: '', trim: true })
  avatarUrl: string;

  // Rol de la cuenta: usuario normal o administrador.
  @Prop({ required: true, enum: ['usuario', 'administrador'], default: 'usuario' })
  perfil: UserProfile;

  // Marca de baja lógica; true significa que el usuario fue deshabilitado.
  @Prop({ default: false })
  isDeleted: boolean;
}

// SchemaFactory convierte la clase decorada en el schema utilizado por Mongoose.
export const UserSchema = SchemaFactory.createForClass(User);