import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Auth } from '../../services/auth';
import { Session } from '../../services/session';
import { SessionTimer } from '../../services/session-timer';

@Component({
  imports: [RouterLink, RouterLinkActive],
  selector: 'app-aside-nav',
  styleUrl: './aside-nav.scss',
  templateUrl: './aside-nav.html',
})
export class AsideNav {
  private readonly router = inject(Router);
  private readonly session = inject(Session);
  private readonly auth = inject(Auth);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly sessionTimer = inject(SessionTimer);

  readonly currentUser = this.session.getCurrentUser();
  isLoggingOut = false;
  logoutError = '';

  logout(): void {
    // Evita enviar varias peticiones si se pulsa el botón repetidamente.
    if (this.isLoggingOut) {
      return;
    }
    this.isLoggingOut = true;
    this.logoutError = '';
    // Primero pedimos al servidor que expire la cookie HttpOnly. Borrar solo
    // sessionStorage dejaría la cookie activa y la sesión volvería al recargar.
    this.auth.logout().subscribe({
      next: () => {
        // Detiene el temporizador de sesión.
        this.sessionTimer.stopTimer();
        // Solo descartamos el perfil local cuando el servidor confirma la operación.
        this.session.clear();
        void this.router.navigate(['/login']);
      },
      error: (error) => {
        // Si falla la petición, conservamos el perfil y permitimos volver a intentar.
        console.error('[AsideNav] No se pudo cerrar la sesión.', error);
        this.isLoggingOut = false;
        this.logoutError = 'No se pudo cerrar la sesión. Intenta nuevamente.';
        this.changeDetectorRef.markForCheck();
      },
    });
  }
}
