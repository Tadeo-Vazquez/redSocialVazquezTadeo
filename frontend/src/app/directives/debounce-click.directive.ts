import { Directive, HostListener, Input, Output, EventEmitter } from '@angular/core';

/**
 * Evita enviar múltiples peticiones si se hace clic repetido en un botón.
 * Desactiva el elemento por un tiempo tras el primer clic.
 * Uso: <button appDebounceClick (debounceClick)="submit()">Enviar</button>
 */
@Directive({
  selector: '[appDebounceClick]',
  standalone: true,
})
export class DebounceClickDirective {
  // El tiempo en milisegundos que se desactiva el elemento tras un clic.
  @Input() debounceTime = 500;
  @Output() debounceClick = new EventEmitter<MouseEvent>();

  private isDisabled = false;

  @HostListener('click', ['$event'])
  onClick(event: MouseEvent): void {
    // Si ya está desactivado, ignora el evento.
    if (this.isDisabled) {
      event.preventDefault();
      return;
    }

    this.isDisabled = true;
    this.debounceClick.emit(event);

    // Después del tiempo especificado, permite nuevos clics.
    setTimeout(() => {
      this.isDisabled = false;
    }, this.debounceTime);
  }
}
