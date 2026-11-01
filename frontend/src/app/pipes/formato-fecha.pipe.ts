import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'formatoFecha',
  standalone: true,
})
export class FormatoFechaPipe implements PipeTransform {
  transform(value: string | Date | null | undefined): string {
    if (!value) {
      return '';
    }

    const date = this.toLocalDate(value);
    if (!date || Number.isNaN(date.getTime())) {
      return '';
    }

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
  }

  private toLocalDate(value: string | Date): Date | null {
    if (value instanceof Date) {
      return value;
    }

    const isoDate = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(value.trim());
    if (isoDate) {
      const [, year, month, day] = isoDate;
      return new Date(Number(year), Number(month) - 1, Number(day));
    }

    return new Date(value);
  }
}
