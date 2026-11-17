import { Pipe, PipeTransform } from '@angular/core';

/**
 * Convierte una fecha en un texto relativo como "Hace 2 días", "Hace 3 horas".
 * Útil para mostrar cuándo ocurrió algo sin exponer la fecha exacta.
 * Ejemplo: new Date("2026-11-15") pasa "17/11/2026" → "Hace 2 días"
 */
@Pipe({
  name: 'timeAgo',
  standalone: true,
})
export class TimeAgoPipe implements PipeTransform {
  transform(value: string | Date | null | undefined): string {
    if (!value) {
      return '';
    }

    const date = typeof value === 'string' ? new Date(value) : value;
    if (isNaN(date.getTime())) {
      return 'Fecha inválida';
    }

    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    // Menos de un minuto
    if (seconds < 60) {
      return 'Justo ahora';
    }

    // Menos de una hora
    if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      return `Hace ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;
    }

    // Menos de un día
    if (seconds < 86400) {
      const hours = Math.floor(seconds / 3600);
      return `Hace ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
    }

    // Menos de una semana
    if (seconds < 604800) {
      const days = Math.floor(seconds / 86400);
      return `Hace ${days} ${days === 1 ? 'día' : 'días'}`;
    }

    // Menos de un mes
    if (seconds < 2592000) {
      const weeks = Math.floor(seconds / 604800);
      return `Hace ${weeks} ${weeks === 1 ? 'semana' : 'semanas'}`;
    }

    // Menos de un año
    if (seconds < 31536000) {
      const months = Math.floor(seconds / 2592000);
      return `Hace ${months} ${months === 1 ? 'mes' : 'meses'}`;
    }

    // Un año o más
    const years = Math.floor(seconds / 31536000);
    return `Hace ${years} ${years === 1 ? 'año' : 'años'}`;
  }
}
