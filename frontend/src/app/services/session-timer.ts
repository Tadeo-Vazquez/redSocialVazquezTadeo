import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Session } from './session';
import { SessionWarningDialog } from '../shared/session-warning-dialog/session-warning-dialog';

/** Gestiona el aviso y el vencimiento según la expiración real del token. */
@Injectable({
  providedIn: 'root',
})
export class SessionTimer {
  private readonly router = inject(Router);
  private readonly session = inject(Session);
  private readonly dialog = inject(MatDialog);

  // ⏰ TESTING: 1 minuto para pruebas rápidas (cambiar a 5 para producción)
  private readonly WARNING_BEFORE_EXPIRATION_MS = 1 * 60 * 1000;

  private sessionTimeout: ReturnType<typeof setTimeout> | null = null;
  private warningTimeout: ReturnType<typeof setTimeout> | null = null;
  private currentDialogRef: MatDialogRef<SessionWarningDialog, number | false> | null = null;

  /**
   * Programa el aviso y el cierre usando la expiración enviada por el servidor.
   */
  startTimer(expiresAt: number): void {
    this.clearTimers();

    const remainingTime = expiresAt - Date.now();
    if (!Number.isFinite(expiresAt) || remainingTime <= 0) {
      console.error('[SessionTimer] La fecha de expiración de la sesión no es válida.');
      this.expireSession();
      return;
    }

    this.warningTimeout = setTimeout(() => {
      console.log('[SessionTimer] Mostrando modal de advertencia');
      this.showWarningDialog();
    }, Math.max(remainingTime - this.WARNING_BEFORE_EXPIRATION_MS, 0));

    this.sessionTimeout = setTimeout(() => {
      console.log('[SessionTimer] Sesión expirada, redirigiendo a login');
      this.expireSession();
    }, remainingTime);
  }

  /**
   * Muestra un modal antes del vencimiento. Ofrece extender o cerrar sesión.
   */
  private showWarningDialog(): void {
    this.currentDialogRef = this.dialog.open(SessionWarningDialog, {
      disableClose: true,
      width: '400px',
    });

    this.currentDialogRef.afterClosed().subscribe((newExpiresAt) => {
      this.currentDialogRef = null;
      if (typeof newExpiresAt === 'number') {
        console.log('[SessionTimer] Sesión extendida');
        this.startTimer(newExpiresAt);
      } else {
        console.log('[SessionTimer] Usuario eligió cerrar sesión');
        this.expireSession();
      }
    });
  }

  /**
   * Cierra la sesión: borra datos, muestra mensaje y redirige al login.
   */
  private expireSession(): void {
    // Cierra el modal si está abierto
    if (this.currentDialogRef) {
      this.currentDialogRef.close(false);
      this.currentDialogRef = null;
    }

    this.clearTimers();
    this.session.clear();
    this.router.navigate(['/login']);
  }

  /**
   * Detiene todos los temporizadores en curso.
   */
  private clearTimers(): void {
    if (this.sessionTimeout) {
      clearTimeout(this.sessionTimeout);
      this.sessionTimeout = null;
    }
    if (this.warningTimeout) {
      clearTimeout(this.warningTimeout);
      this.warningTimeout = null;
    }
  }

  /**
   * Detiene el temporizador. Se llama al cerrar sesión de forma explícita.
   */
  stopTimer(): void {
    console.log('[SessionTimer] Deteniendo timer');
    this.clearTimers();
  }
}
