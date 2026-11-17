import { Directive, ElementRef, AfterViewInit } from '@angular/core';

/**
 * Enfoca automáticamente el elemento al renderizarse.
 * Útil para campos de entrada en modales o nuevas secciones.
 * Uso: <input appAutofocus />
 */
@Directive({
  selector: '[appAutofocus]',
  standalone: true,
})
export class AutofocusDirective implements AfterViewInit {
  constructor(private elementRef: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    // Espera el próximo ciclo para asegurar que el elemento está en el DOM.
    setTimeout(() => {
      const element = this.elementRef.nativeElement;
      // Si es un input, textarea o select, puede recibir el foco.
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        element.focus();
      }
    }, 0);
  }
}
