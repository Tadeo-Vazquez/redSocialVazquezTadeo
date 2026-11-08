import { Transform } from 'class-transformer';
import {
  IsMongoId,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreatePostDto {
  // Asegura que la publicación se vincule con un ObjectId real de MongoDB.
  @IsMongoId({ message: 'El identificador del usuario no es válido.' })
  @IsNotEmpty({ message: 'El usuario es obligatorio.' })
  usuarioId: string;

  // Validaciones de longitud y tipo requeridas por las reglas de publicación.
  @IsString({ message: 'El título debe ser texto.' })
  @IsNotEmpty({ message: 'El título es obligatorio.' })
  @MaxLength(100, { message: 'El título no puede superar los 100 caracteres.' })
  @Transform(({ value }) => value?.trim())
  titulo: string;

  @IsString({ message: 'La descripción debe ser texto.' })
  @IsNotEmpty({ message: 'La descripción es obligatoria.' })
  @MaxLength(1000, {
    message: 'La descripción no puede superar los 1000 caracteres.',
  })
  @Transform(({ value }) => value?.trim())
  descripcion: string;
}
