import { Directive, HostListener, Input, Output, EventEmitter, OnDestroy } from '@angular/core';

/**
 * Evita enviar múltiples peticiones si se hace clic repetido en un botón.
 * Emite el primer clic y descarta los siguientes durante un intervalo breve.
 * Uso: <button appDebounceClick (debounceClick)="submit()">Enviar</button>
 */
@Directive({
  selector: '[appDebounceClick]',
  standalone: true,
})
export class DebounceClickDirective implements OnDestroy {
  // El intervalo se puede configurar desde la plantilla en milisegundos.
  @Input() debounceTime = 500;
  @Output() debounceClick = new EventEmitter<MouseEvent>();

  private waiting = false;
  private timer?: ReturnType<typeof setTimeout>;

  // HostListener escucha el clic del elemento que lleva la directiva. El
  // componente debe suscribirse a debounceClick, no al evento click original.
  @HostListener('click', ['$event'])
  onClick(event: MouseEvent): void {
    if (this.waiting) {
      event.preventDefault();
      return;
    }

    // Se bloquea y programa la liberación antes de emitir: el receptor podría
    // destruir la vista durante el evento y ngOnDestroy debe poder cancelar el timer.
    this.waiting = true;
    this.timer = setTimeout(() => {
      this.waiting = false;
    }, this.debounceTime);
    this.debounceClick.emit(event);
  }

  ngOnDestroy(): void {
    // Evita conservar un temporizador cuando se elimina la tarjeta de la vista.
    clearTimeout(this.timer);
  }
}
