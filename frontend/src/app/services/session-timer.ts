import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { Session } from './session';
import { Auth } from './auth';
import { SessionWarningDialog } from '../shared/session-warning-dialog/session-warning-dialog';

/**
 * Gestiona el temporizador de sesión: avisa cuando quedan 5 minutos y permite extender.
 * Configuración: 10 minutos hasta mostrar modal, 15 minutos totales (JWT expires en 15 min).
 */
@Injectable({
  providedIn: 'root',
})
export class SessionTimer {
  private readonly router = inject(Router);
  private readonly session = inject(Session);
  private readonly auth = inject(Auth);
  private readonly dialog = inject(MatDialog);

  // ⏰ TESTING: 2 minutos totales (en lugar de 15)
  private readonly TOTAL_SESSION_TIME_MS = 2 * 60 * 1000;
  // ⏰ TESTING: Modal a 1 minuto (en lugar de 10)
  private readonly WARNING_TIME_MS = 1 * 60 * 1000;
  // ⏰ TESTING: 1 minuto restante (en lugar de 5)
  private readonly REMAINING_TIME_MS = 1 * 60 * 1000;

  private sessionTimeout: ReturnType<typeof setTimeout> | null = null;
  private warningTimeout: ReturnType<typeof setTimeout> | null = null;
  private inactivityTimeout: ReturnType<typeof setTimeout> | null = null;
  private onActivityHandler: ((event: Event) => void) | null = null;
  private currentDialogRef: any = null;

  /**
   * Inicia el temporizador. Se llama tras un login o registro exitoso.
   */
  startTimer(): void {
    console.log('[SessionTimer] Iniciando timer...');
    this.clearTimers();

    // Programa el aviso de expiración en 1 minuto.
    this.warningTimeout = setTimeout(() => {
      console.log('[SessionTimer] Mostrando modal de advertencia');
      this.showWarningDialog();
    }, this.WARNING_TIME_MS);

    // Programa el cierre de sesión en 2 minutos si no se extiende.
    this.sessionTimeout = setTimeout(() => {
      console.log('[SessionTimer] Sesión expirada, redirigiendo a login');
      this.expireSession();
    }, this.TOTAL_SESSION_TIME_MS);

    // Reinicia el timer si hay actividad del usuario (clic, escritura, etc).
    this.setupInactivityListener();
  }

  /**
   * Reinicia el temporizador tras actividad del usuario.
   */
  private resetTimerOnActivity(): void {
    // Si la sesión ya está vencida o hay un modal abierto, no reiniciar.
    if (!this.session.getCurrentUser() || this.dialog.openDialogs.length > 0) {
      return;
    }

    // 🧪 TESTING: Descomenta la siguiente línea para DESACTIVAR reinicio por actividad
    // return;

    console.log('[SessionTimer] Actividad detectada, reiniciando timer');
    this.clearTimers();
    this.startTimer();
  }

  /**
   * Escucha actividad del usuario: clics y teclas.
   */
  private setupInactivityListener(): void {
    this.onActivityHandler = () => this.resetTimerOnActivity();

    // Escucha cualquier clic en el documento.
    document.addEventListener('click', this.onActivityHandler, { once: false });
    // Escucha cualquier pulsación de tecla.
    document.addEventListener('keydown', this.onActivityHandler, { once: false });

    // Almacena la función para limpiarla después.
    this.inactivityTimeout = setTimeout(() => {
      this.removeActivityListeners();
    }, this.TOTAL_SESSION_TIME_MS) as unknown as ReturnType<typeof setTimeout>;
  }

  /**
   * Remueve los listeners de actividad.
   */
  private removeActivityListeners(): void {
    if (this.onActivityHandler) {
      document.removeEventListener('click', this.onActivityHandler);
      document.removeEventListener('keydown', this.onActivityHandler);
      this.onActivityHandler = null;
    }
  }

  /**
   * Muestra un modal avisando que quedan 5 minutos. Ofrece extender o cerrar sesión.
   */
  private showWarningDialog(): void {
    this.currentDialogRef = this.dialog.open(SessionWarningDialog, {
      disableClose: true,
      width: '400px',
    });

    this.currentDialogRef.afterClosed().subscribe((extended: boolean) => {
      this.currentDialogRef = null;
      if (extended) {
        // El usuario eligió extender; reinicia el timer completo.
        console.log('[SessionTimer] Sesión extendida');
        this.startTimer();
      } else {
        // El usuario eligió cerrar o no respondió; expira la sesión ahora.
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
    if (this.inactivityTimeout) {
      clearTimeout(this.inactivityTimeout);
      this.inactivityTimeout = null;
    }

    // Remueve los listeners de actividad.
    this.removeActivityListeners();
  }

  /**
   * Detiene el temporizador. Se llama al cerrar sesión de forma explícita.
   */
  stopTimer(): void {
    console.log('[SessionTimer] Deteniendo timer');
    this.clearTimers();
  }
}
