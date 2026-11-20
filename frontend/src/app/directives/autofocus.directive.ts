import { Directive, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';

/**
 * Enfoca automáticamente el elemento al renderizarse.
 * Útil para campos de entrada en modales o nuevas secciones.
 * Uso: <input appAutofocus />
 */
@Directive({
  selector: '[appAutofocus]',
  standalone: true,
})
export class AutofocusDirective implements AfterViewInit, OnDestroy {
  constructor(private elementRef: ElementRef<HTMLElement>) {}

  private focusTimer?: ReturnType<typeof setTimeout>;

  ngAfterViewInit(): void {
    // Esperar al siguiente turno permite que Angular termine de insertar la
    // vista. Si el usuario ya enfocó otro control, no le quitamos el foco.
    this.focusTimer = setTimeout(() => {
      const element = this.elementRef.nativeElement;
      const activeElement = element.ownerDocument.activeElement;
      if (element.isConnected && (activeElement === element.ownerDocument.body || !activeElement)) {
        element.focus();
      }
    }, 0);
  }

  ngOnDestroy(): void {
    // Si la vista desaparece antes del turno programado, se cancela el foco.
    clearTimeout(this.focusTimer);
  }
}
