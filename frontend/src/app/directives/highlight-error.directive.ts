import { Directive, HostBinding, Input } from '@angular/core';

/**
 * Aplica la clase de error del formulario y comunica el estado a lectores de pantalla.
 * Uso: <input [appHighlightError]="control.touched && control.invalid" />
 */
@Directive({
  selector: '[appHighlightError]',
  standalone: true,
})
export class HighlightErrorDirective {
  // El componente decide cuándo mostrar el error; por ejemplo, después de que
  // el usuario toque el control. Angular actualiza este valor al cambiar el formulario.
  @Input('appHighlightError') error = false;

  // HostBinding aplica la clase al propio input. El CSS de cada formulario
  // define su apariencia sin sobrescribir estilos de foco ni valores originales.
  @HostBinding('class.input-error')
  get hasError(): boolean {
    return this.error;
  }

  // aria-invalid permite reconocer el error aunque no se perciba el color.
  @HostBinding('attr.aria-invalid')
  get ariaInvalid(): 'true' | null {
    return this.error ? 'true' : null;
  }
}
