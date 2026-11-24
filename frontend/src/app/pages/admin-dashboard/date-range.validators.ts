import { AbstractControl, ValidationErrors } from '@angular/forms';

/**
 * Valida que el valor sea una fecha real con formato YYYY-MM-DD. Un campo
 * vacío es válido porque los límites del rango son opcionales.
 */
export function validRangeDate(control: AbstractControl): ValidationErrors | null {
  const value: unknown = control.value;
  if (value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { invalidDate: true };
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  // La comparación detecta fechas imposibles que JavaScript normaliza, como
  // el 31 de febrero, sin depender de la zona horaria del navegador.
  return value.startsWith('0000') ||
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
    ? { invalidDate: true }
    : null;
}

/** Devuelve el día actual del navegador con formato YYYY-MM-DD. */
export function todayLocalDate(): string {
  const today = new Date();
  const year = String(today.getFullYear()).padStart(4, '0');
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Rechaza fechas posteriores al día de hoy (error futureDate). */
export function notAfterToday(control: AbstractControl): ValidationErrors | null {
  const value: unknown = control.value;
  // Solo se compara una fecha válida; el otro validador informa los errores de formato.
  return typeof value === 'string' && value !== '' && !validRangeDate(control) && value > todayLocalDate()
    ? { futureDate: true }
    : null;
}
