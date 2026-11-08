import { IsMongoId, IsNotEmpty } from 'class-validator';

export class UserActionDto {
  // Reutiliza la validación de ObjectId para todas las acciones sobre un usuario.
  @IsMongoId({ message: 'El identificador del usuario no es válido.' })
  @IsNotEmpty({ message: 'El usuario es obligatorio.' })
  usuarioId: string;
}
