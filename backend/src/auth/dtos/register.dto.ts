import { 
  IsEmail, 
  IsNotEmpty, 
  IsString, 
  Matches, 
  MinLength, 
  IsDateString,
  MaxLength
} from 'class-validator';
import { Transform } from 'class-transformer';

export class RegisterDto {
  @IsString({ message: 'El nombre debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El nombre es obligatorio.' })
  @MaxLength(50, { message: 'El nombre no puede superar los 50 caracteres.' })
  nombre: string;

  @IsString({ message: 'El apellido debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El apellido es obligatorio.' })
  @MaxLength(50, { message: 'El apellido no puede superar los 50 caracteres.' })
  apellido: string;

  @IsEmail({}, { message: 'El correo electrónico debe ser una dirección válida.' })
  @IsNotEmpty({ message: 'El correo electrónico es obligatorio.' })
  @Transform(({ value }) => value?.trim().toLowerCase())
  email: string;

  @IsString({ message: 'El nombre de usuario debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El nombre de usuario es obligatorio.' })
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message: 'El nombre de usuario solo puede contener letras, números, puntos, guiones y guiones bajos.',
  })
  @MaxLength(30, { message: 'El nombre de usuario no puede superar los 30 caracteres.' })
  @Transform(({ value }) => value?.trim().toLowerCase())
  username: string;

  @IsString({ message: 'La contraseña debe ser una cadena de texto.' })
  @MinLength(8, { message: 'La contraseña debe poseer al menos 8 caracteres.' })
  @Matches(/^(?=.*[A-Z])(?=.*\d)/, {
    message: 'La contraseña debe contener al menos una letra mayúscula y un número.',
  })
  password: string;

  @IsString({ message: 'Debes repetir la contraseña.' })
  @IsNotEmpty({ message: 'El campo repetir contraseña no puede estar vacío.' })
  repetirPassword: string;

  @IsDateString({}, { message: 'La fecha de nacimiento debe ser una fecha válida (YYYY-MM-DD).' })
  @IsNotEmpty({ message: 'La fecha de nacimiento es obligatoria.' })
  fechaNacimiento: string;

  @IsString({ message: 'La descripción breve debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'La descripción breve es obligatoria.' })
  @MaxLength(280, { message: 'La descripción no puede superar los 280 caracteres.' })
  descripcionBreve: string;
}