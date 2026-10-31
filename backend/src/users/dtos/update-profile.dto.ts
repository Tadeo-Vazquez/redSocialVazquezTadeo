import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

// DTO recibido al actualizar un perfil.
// Todos sus campos son opcionales para permitir cambios parciales.
export class UpdateProfileDto {
  // El nombre puede omitirse y, si llega, debe ser texto no vacío.
  @IsOptional()
  @IsString({ message: 'El nombre debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El nombre no puede estar vacío.' })
  @MaxLength(50, { message: 'El nombre no puede superar los 50 caracteres.' })
  nombre?: string;

  // El apellido puede omitirse y debe respetar el límite de longitud.
  @IsOptional()
  @IsString({ message: 'El apellido debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El apellido no puede estar vacío.' })
  @MaxLength(50, { message: 'El apellido no puede superar los 50 caracteres.' })
  apellido?: string;

  // Fecha opcional que debe tener formato ISO aceptado por IsDateString.
  @IsOptional()
  @IsDateString({}, { message: 'La fecha de nacimiento debe ser una fecha válida.' })
  fechaNacimiento?: string;

  // Descripción opcional; se recorta al eliminar espacios sobrantes.
  @IsOptional()
  @IsString({ message: 'La descripción debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'La descripción no puede estar vacía.' })
  @MaxLength(280, { message: 'La descripción no puede superar los 280 caracteres.' })
  @Transform(({ value }) => value?.trim())
  descripcionBreve?: string;
}
