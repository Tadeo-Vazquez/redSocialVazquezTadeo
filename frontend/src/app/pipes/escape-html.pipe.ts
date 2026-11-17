import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/**
 * Escapa caracteres HTML para evitar inyecciones y renderiza el contenido sin riesgo.
 * Útil cuando se muestran datos ingresados por usuarios sin interpretar etiquetas HTML.
 * Ejemplo: "<script>alert('xss')</script>" → "&lt;script&gt;alert('xss')&lt;/script&gt;"
 */
@Pipe({
  name: 'escapeHtml',
  standalone: true,
})
export class EscapeHtmlPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  transform(value: string | null | undefined): SafeHtml {
    if (!value || typeof value !== 'string') {
      return '';
    }

    // Crea un div temporal para aprovechar el comportamiento de escape del navegador.
    const textArea = document.createElement('textarea');
    textArea.textContent = value;
    const escaped = textArea.innerHTML;

    // Devuelve el HTML escapado de forma segura para Angular.
    return this.sanitizer.bypassSecurityTrustHtml(escaped);
  }
}
