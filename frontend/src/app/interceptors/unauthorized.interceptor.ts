import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Session } from '../services/session';
import { MatSnackBar } from '@angular/material/snack-bar';

/**
 * Interceptor que captura respuestas 401 Unauthorized.
 * Cuando el backend rechaza el JWT (expirado, inválido, usuario deshabilitado),
 * este interceptor borra la sesión y redirige al login.
 */
@Injectable()
export class UnauthorizedInterceptor implements HttpInterceptor {
  private readonly router = inject(Router);
  private readonly session = inject(Session);
  private readonly snackBar = inject(MatSnackBar);

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return next.handle(request).pipe(
      catchError((error: unknown) => {
        // Solo procesa errores HTTP (no conexión, etc).
        if (error instanceof HttpErrorResponse && error.status === 401) {
          console.warn('[UnauthorizedInterceptor] Sesión expirada o inválida. Redirigiendo al login.');

          // Borra el perfil guardado localmente.
          this.session.clear();

          // Muestra un mensaje informativo solo si no estamos ya en login.
          if (!this.router.url.includes('/login')) {
            this.snackBar.open('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.', 'Cerrar', {
              duration: 5000,
              horizontalPosition: 'center',
              verticalPosition: 'top',
              panelClass: ['error-snackbar'],
            });
          }

          // Redirige al login.
          void this.router.navigate(['/login']);
        }

        // Re-lanza el error para que el componente pueda manejarlo si lo desea.
        return throwError(() => error);
      }),
    );
  }
}
