import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../../services/auth';

@Component({
  imports: [ReactiveFormsModule, RouterLink],
  selector: 'app-login',
  styleUrl: './login.scss',
  templateUrl: './login.html',
})
export class Login {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);

  readonly loginForm = new FormGroup({
    loginInput: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(254)],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  isLoading = false;
  errorMessage = '';
  showPassword = false;

  submit(): void {
    console.log('[Login] Evento submit disparado. Formulario válido:', this.loginForm.valid);

    // Si el formulario tiene campos vacíos o datos inválidos, marca los campos
    // como tocados para que Angular muestre sus mensajes de validación.
    if (this.loginForm.invalid) {
      const invalidFields = Object.entries(this.loginForm.controls)
        .filter(([, control]) => control.invalid)
        .map(([name, control]) => ({ campo: name, errores: control.errors }));
      console.warn('[Login] Validación local fallida.', invalidFields);
      this.loginForm.markAllAsTouched();
      return;
    }

    // Activa el estado de carga y limpia cualquier error anterior.
    this.isLoading = true;
    this.errorMessage = '';

    // Obtiene los valores escritos por el usuario y elimina los espacios del
    // correo o nombre de usuario antes de enviarlos al backend.
    const { loginInput, password } = this.loginForm.getRawValue();

    // Llama al servicio Auth, que usa HttpClient para enviar los datos mediante
    // una petición POST al endpoint http://localhost:3000/auth/login.
    this.auth.login({ loginInput: loginInput.trim(), password }).subscribe({
      // next se ejecuta cuando el backend responde que las credenciales son válidas.
      next: (response) => {
        // Finaliza el estado de carga porque ya llegó una respuesta exitosa.
        this.isLoading = false;
        this.changeDetectorRef.markForCheck();

        // Guarda una copia del usuario autenticado en sessionStorage para
        // conservar su información mientras dure la sesión del navegador.
        try {
          sessionStorage.setItem('currentUser', JSON.stringify(response.user));
          console.log('[Login] Sesión iniciada correctamente:', response.user);
        } catch (storageError) {
          console.error('[Login] No se pudo guardar la sesión en sessionStorage.', storageError);
        }

        // Redirige al usuario a la página de publicaciones mediante el Router.
        void this.router.navigate(['/publicaciones']).then(
          (navigated) => {
            if (navigated) {
              console.log('[Login] Navegación exitosa a /publicaciones.');
            } else {
              console.warn('[Login] La navegación a /publicaciones fue cancelada.');
            }
          },
          (navigationError) => {
            console.error('[Login] Error al navegar a /publicaciones.', navigationError);
          },
        );
      },
      // error se ejecuta cuando el backend rechaza las credenciales o ocurre
      // un problema de red o de servidor.
      error: (error: HttpErrorResponse) => {
        this.isLoading = false;
        console.error('[Login] Error en el proceso de inicio de sesión.', error);
        const responseMessage =
          typeof error.error === 'object' && error.error
            ? error.error.message
            : undefined;
        this.errorMessage =
          typeof responseMessage === 'string'
            ? responseMessage
            : 'No se pudo iniciar sesión. Intenta nuevamente.';
        this.changeDetectorRef.markForCheck();
      },
    });
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  fillDemoCredentials(): void {
    this.loginForm.patchValue({
      loginInput: 'tadeovazquez2006@gmail.com',
      password: 'A12345678',
    });
    this.errorMessage = '';
    this.loginForm.markAllAsTouched();
    this.changeDetectorRef.markForCheck();
  }
}
