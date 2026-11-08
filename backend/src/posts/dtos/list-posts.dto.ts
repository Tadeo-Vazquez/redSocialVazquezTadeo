import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class ListPostsDto {
  // Permite elegir fecha predeterminada o ordenar por cantidad de likes.
  @IsOptional()
  @IsIn(['fecha', 'likes'], {
    message: 'El ordenamiento debe ser fecha o likes.',
  })
  ordenar?: 'fecha' | 'likes';

  @IsOptional()
  @IsMongoId({ message: 'El usuarioId no es válido.' })
  usuarioId?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt({ message: 'El offset debe ser un número entero.' })
  @Min(0, { message: 'El offset no puede ser negativo.' })
  offset = 0;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt({ message: 'El limit debe ser un número entero.' })
  @Min(1, { message: 'El limit debe ser mayor a cero.' })
  @Max(100, { message: 'El limit no puede superar 100.' })
  limit = 10;
}
