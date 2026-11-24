import { HttpErrorResponse } from '@angular/common/http';

/**
 * Extrae el mensaje enviado por NestJS, que puede ser texto o una lista de
 * errores de validación. Para fallos sin ese formato utiliza un mensaje
 * legible, sin asumir la estructura de un valor unknown.
 */
export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    const message: unknown = error.error?.message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message) && message.every((item) => typeof item === 'string')) {
      return message.join(' ');
    }
  }
  return fallback;
}
