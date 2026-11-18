import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { Auth } from './services/auth';
import { Session } from './services/session';
import { SessionTimer } from './services/session-timer';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App implements OnInit {
  private readonly auth = inject(Auth);
  private readonly session = inject(Session);
  private readonly router = inject(Router);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly sessionTimer = inject(SessionTimer);
  private minimumLoadingTime!: Promise<void>;

  // La plantilla mantiene visible el spinner mientras se comprueba la sesión y
  // se completa la navegación inicial, evitando mostrar una página intermedia.
  isLoading = true;

  ngOnInit(): void {
    // El mínimo empieza junto con la validación, no después de recibir la respuesta.
    this.minimumLoadingTime = new Promise((resolve) => setTimeout(resolve, 2000));

    // Esta comprobación se ejecuta al crear el componente raíz. No confiamos
    // únicamente en un usuario guardado localmente: su cookie puede haber vencido.
    this.auth.authorize().subscribe({
      next: (response) => {
        // Guardamos el perfil actualizado para los guards y las vistas; el JWT
        // permanece en la cookie HttpOnly y nunca se copia a sessionStorage.
        this.session.setCurrentUser(response.user);
        // Inicia el temporizador de sesión: 10 min hasta aviso, 15 min hasta logout.
        this.sessionTimer.startTimer();
        this.finishLoading('/publicaciones');
      },
      error: (error) => {
        // Ante cualquier error, incluido un 401 o un problema de red, descartamos
        // el perfil local y mostramos el login en vez de asumir que hay sesión.
        console.error('[App] No se pudo autorizar la sesión.', error);
        this.session.clear();
        this.finishLoading('/login');
      },
    });
  }

  private finishLoading(destination: string): void {
    // El spinner permanece hasta completar tanto la navegación como el tiempo mínimo.
    const navigation = this.router.navigate([destination]).then(
      (navigated) => {
        if (!navigated) {
          console.error('[App] No se pudo completar la navegación inicial.');
        }
      },
      (error) => {
        console.error('[App] Error en la navegación inicial.', error);
      },
    );
    void Promise.all([navigation, this.minimumLoadingTime]).then(() => {
      this.isLoading = false;
      this.changeDetectorRef.markForCheck();
    });
  }
}
