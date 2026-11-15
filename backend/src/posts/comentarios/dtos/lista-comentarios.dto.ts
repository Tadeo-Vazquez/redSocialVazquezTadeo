import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListaComentariosDto {
  // El desplazamiento y el límite permiten cargar comentarios en tandas.
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt({ message: 'El desplazamiento debe ser un número entero.' })
  @Min(0, { message: 'El desplazamiento no puede ser negativo.' })
  offset = 0;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt({ message: 'El límite debe ser un número entero.' })
  @Min(1, { message: 'El límite debe ser mayor a cero.' })
  @Max(100, { message: 'El límite no puede superar 100.' })
  limit = 10;
}
