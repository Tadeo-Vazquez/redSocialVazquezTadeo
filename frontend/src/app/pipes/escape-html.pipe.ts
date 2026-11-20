import { Pipe, PipeTransform } from '@angular/core';

/**
 * Convierte caracteres especiales en entidades para mostrar texto en [innerHTML]
 * sin interpretar las etiquetas que escribió el usuario.
 * Ejemplo: "<script>alert('xss')</script>" → "&lt;script&gt;alert('xss')&lt;/script&gt;"
 */
@Pipe({
  name: 'escapeHtml',
  standalone: true,
})
export class EscapeHtmlPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (value == null) {
      return '';
    }

    // Escapar primero & evita que una entidad escrita por el usuario se
    // interprete como marcado. Se devuelve un string normal, por lo que Angular
    // todavía aplica su sanitización al asignarlo a [innerHTML].
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
