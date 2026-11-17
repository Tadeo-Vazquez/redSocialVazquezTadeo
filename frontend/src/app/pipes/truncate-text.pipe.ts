import { Pipe, PipeTransform } from '@angular/core';

/**
 * Trunca un texto a una longitud máxima y añade puntos suspensivos.
 * Útil para descripciones, títulos u otros campos de longitud variable.
 * Ejemplo: "Este es un texto muy largo" | truncateText:15 → "Este es un te..."
 */
@Pipe({
  name: 'truncateText',
  standalone: true,
})
export class TruncateTextPipe implements PipeTransform {
  transform(value: string | null | undefined, maxLength: number = 50): string {
    if (!value || typeof value !== 'string') {
      return '';
    }

    // Si el texto es más corto que el máximo, se devuelve sin cambios.
    if (value.length <= maxLength) {
      return value;
    }

    // Corta al máximo y añade puntos suspensivos.
    return value.substring(0, maxLength).trim() + '...';
  }
}
