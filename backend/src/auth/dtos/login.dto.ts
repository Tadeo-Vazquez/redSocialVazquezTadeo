import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class LoginDto {
  @IsString({ message: 'El usuario o correo debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'Debes ingresar tu correo o nombre de usuario.' })
  @MaxLength(254, { message: 'El usuario o correo es demasiado largo.' })
  @Transform(({ value }) => value?.trim().toLowerCase())
  loginInput: string;

  @IsString({ message: 'La contraseña debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'La contraseña es obligatoria.' })
  password: string;
}