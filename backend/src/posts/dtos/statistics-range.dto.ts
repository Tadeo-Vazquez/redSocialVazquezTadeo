import { IsDateString, IsOptional } from 'class-validator';

export class StatisticsRangeDto {
  @IsOptional()
  @IsDateString(
    { strict: true },
    { message: 'La fecha de inicio no es válida.' },
  )
  from?: string;

  @IsOptional()
  @IsDateString(
    { strict: true },
    { message: 'La fecha de fin no es válida.' },
  )
  to?: string;
}
