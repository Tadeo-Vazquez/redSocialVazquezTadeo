import { Pipe, PipeTransform } from '@angular/core';

/**
 * Conserva hasta maxLength caracteres del texto y añade puntos si se recorta.
 * Útil para descripciones, títulos u otros campos de longitud variable.
 * Ejemplo: "Una descripción extensa" | truncateText:8 → "Una desc..."
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

    // Array.from separa por puntos de código para no cortar un emoji en medio
    // de su par sustituto UTF-16.
    const characters = Array.from(value);
    if (characters.length <= maxLength) {
      return value;
    }

    // Los puntos indican que la tarjeta muestra solo una vista previa. La
    // publicación original permanece intacta para consultarla en detalle.
    return characters.slice(0, Math.max(0, maxLength)).join('').trim() + '...';
  }
}
