import { Directive, ElementRef, Input, OnInit } from '@angular/core';

/**
 * Resalta el elemento con un color rojo si su contenedor está en error.
 * Útil para campos de formulario que fallan la validación.
 * Uso: <input appHighlightError [error]="control.hasError('required')" />
 */
@Directive({
  selector: '[appHighlightError]',
  standalone: true,
})
export class HighlightErrorDirective implements OnInit {
  // Si es true, el elemento se resalta como error.
  @Input('appHighlightError') error = false;
  // Color personalizado; por defecto es rojo.
  @Input() errorColor = '#dc2626';

  constructor(private elementRef: ElementRef<HTMLElement>) {}

  ngOnInit(): void {
    this.updateStyles();
  }

  ngOnChanges(): void {
    this.updateStyles();
  }

  private updateStyles(): void {
    const element = this.elementRef.nativeElement;
    if (this.error) {
      // Aplica un borde rojo y cambio de fondo leve.
      element.style.borderColor = this.errorColor;
      element.style.borderWidth = '2px';
      element.style.backgroundColor = `${this.errorColor}10`; // 10% de opacidad
    } else {
      // Restaura los estilos por defecto.
      element.style.borderColor = '';
      element.style.borderWidth = '';
      element.style.backgroundColor = '';
    }
  }
}
