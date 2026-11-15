import { Transform } from 'class-transformer';
import { IsMongoId, IsNotEmpty, IsString, MaxLength } from 'class-validator';

// Crear y editar un comentario requieren los mismos datos y reglas.
export class ComentarioDto {
  @IsMongoId({ message: 'El identificador del usuario no es válido.' })
  @IsNotEmpty({ message: 'El usuario es obligatorio.' })
  usuarioId: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'El comentario debe ser texto.' })
  @IsNotEmpty({ message: 'El comentario no puede estar vacío.' })
  @MaxLength(1000, {
    message: 'El comentario no puede superar los 1000 caracteres.',
  })
  texto: string;
}
