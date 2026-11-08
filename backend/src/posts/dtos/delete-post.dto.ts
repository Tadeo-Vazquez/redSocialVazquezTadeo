import { IsMongoId, IsNotEmpty } from 'class-validator';

export class DeletePostDto {
  // Identifica quién solicita la baja lógica para que el servicio pueda autorizarla.
  @IsMongoId({ message: 'El identificador del usuario no es válido.' })
  @IsNotEmpty({ message: 'El usuario que elimina es obligatorio.' })
  usuarioId: string;
}
