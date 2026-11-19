import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../../services/auth';
import { SessionTimer } from '../../services/session-timer';

@Component({
  imports: [ReactiveFormsModule, RouterLink],
  selector: 'app-registro',
  styleUrl: './registro.scss',
  templateUrl: './registro.html',
})
export class Registro {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly sessionTimer = inject(SessionTimer);

  // La mayoría de las reglas pertenecen a cada campo; la coincidencia entre
  // contraseñas es una regla del grupo porque compara dos controles relacionados.
  readonly registerForm = new FormGroup(
    {
      nombre: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(50)],
      }),
      apellido: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(50)],
      }),
      email: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.email, Validators.maxLength(254)],
      }),
      username: new FormControl('', {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.maxLength(30),
          Validators.pattern(/^[a-zA-Z0-9._-]+$/),
        ],
      }),
      password: new FormControl('', {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.minLength(8),
          Validators.pattern(/^(?=.*[A-Z])(?=.*\d)/),
        ],
      }),
      repetirPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      fechaNacimiento: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, this.birthDateValidator()],
      }),
      descripcionBreve: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(280)],
      }),
      esAdmin: new FormControl(false, { nonNullable: true }),
    },
    { validators: this.passwordsMatchValidator() },
  );

  selectedImage: File | null = null;
  imagePreview = '';
  imageError = '';
  errorMessage = '';
  successMessage = '';
  isLoading = false;
  showPassword = false;
  showRepeatPassword = false;

  // Abre la vista previa de la imagen y valida el tamaño/mime antes de enviarla.
  onImageSelected(event: Event): void {
    // Comprobar formato y tamaño en el navegador mejora la respuesta inmediata,
    // pero el servidor también debe validar el archivo al recibirlo.
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.imageError = '';

    if (!file) {
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      this.imageError = 'Solo se permiten imágenes JPG, PNG o WEBP.';
      input.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.imageError = 'La imagen no puede superar los 5 MB.';
      input.value = '';
      return;
    }

    if (this.imagePreview) {
      URL.revokeObjectURL(this.imagePreview);
    }
    this.selectedImage = file;
    this.imagePreview = URL.createObjectURL(file);
  }

  submit(): void {
    this.errorMessage = '';
    this.successMessage = '';
    console.log('[Registro] Evento submit disparado. Formulario válido:', this.registerForm.valid);

    if (this.registerForm.invalid) {
      // Angular conserva errores por control y por grupo; ambos se reportan para
      // facilitar el diagnóstico de reglas locales que no pasan.
      const invalidFields = Object.entries(this.registerForm.controls)
        .filter(([, control]) => control.invalid)
        .map(([name, control]) => ({ campo: name, errores: control.errors }));
      const formErrors = this.registerForm.errors ?? null;
      console.warn('[Registro] Validación local fallida.', {
        campos: invalidFields,
        erroresFormulario: formErrors,
      });
      this.registerForm.markAllAsTouched();
      return;
    }

    if (!this.selectedImage) {
      console.warn('[Registro] Validación local fallida.', {
        campos: [{ campo: 'imagen', errores: { required: true } }],
      });
      this.imageError = 'Debes seleccionar una imagen de perfil.';
      return;
    }

    const birthDateIso = this.toIsoDate(this.registerForm.controls.fechaNacimiento.value);
    // El validador del campo revisa formato/calendario; esta condición adicional
    // protege el envío por si el valor se modifica desde otra fuente.
    const birthDate = new Date(`${birthDateIso}T00:00:00`);
    if (birthDate >= new Date()) {
      console.warn('[Registro] Validación local fallida.', {
        campos: [{ campo: 'fechaNacimiento', errores: { debeSerAnterior: true } }],
      });
      this.errorMessage = 'La fecha de nacimiento debe ser anterior a la fecha actual.';
      return;
    }

    this.isLoading = true;

    // FormData es necesario porque el registro incluye campos normales y un archivo.
    const data = new FormData();
    const values = this.registerForm.getRawValue();

    // FormData serializa conjuntamente el archivo y los campos para una petición
    // multipart. El checkbox de administrador se traduce al campo perfil que espera la API.
    Object.entries(values).forEach(([key, value]) => {
      if (key === 'esAdmin') {
        if (value === true) {
          data.append('perfil', 'administrador');
        }
        return;
      }
      const formattedValue =
        key === 'fechaNacimiento'
          ? this.toIsoDate(value as string)
          : typeof value === 'string'
            ? value.trim()
            : String(value);
      data.append(
        key,
        key === 'email' || key === 'username'
          ? formattedValue.toLowerCase()
          : formattedValue,
      );
    });
    data.append('image', this.selectedImage, this.selectedImage.name);

    this.auth.register(data).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.successMessage = response.message || 'Usuario registrado correctamente.';
        this.errorMessage = '';
        console.log('[Registro] Registro completado exitosamente.', response);
        this.changeDetectorRef.markForCheck();

        // Inicia el temporizador de sesión: 10 min hasta aviso, 15 min hasta logout.
        this.sessionTimer.startTimer(response.expiresAt);

        // Redirige a publicaciones tras un breve tiempo para que se vea el mensaje de éxito.
        setTimeout(() => {
          void this.router.navigate(['/publicaciones']);
        }, 1500);
      },
      error: (error: HttpErrorResponse) => {
        this.isLoading = false;
        console.error('[Registro] Error en el proceso de registro.', error);
        const message = error.error?.message;
        this.errorMessage = Array.isArray(message)
          ? message.join(' ')
          : typeof message === 'string'
            ? message
            : 'No se pudo completar el registro. Intenta nuevamente.';
        this.successMessage = '';
        this.changeDetectorRef.markForCheck();
      },
    });
  }

  goToLogin(): void {
    if (this.imagePreview) {
      URL.revokeObjectURL(this.imagePreview);
    }
    void this.router.navigate(['/login']);
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  toggleRepeatPassword(): void {
    this.showRepeatPassword = !this.showRepeatPassword;
  }

  formatBirthDate(event: Event): void {
    // El usuario puede escribir solo dígitos; se van agrupando como DD/MM/AAAA
    // y se limita la entrada a ocho para mantener un valor que entienda el validador.
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, 8);
    const day = digits.slice(0, 2);
    const month = digits.slice(2, 4);
    const year = digits.slice(4, 8);
    const formatted =
      digits.length <= 2
        ? day
        : digits.length <= 4
          ? `${day}/${month}`
          : `${day}/${month}/${year}`;

    input.value = formatted;
    this.registerForm.controls.fechaNacimiento.setValue(formatted);
  }

  private passwordsMatchValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      // Los errores de grupo permiten mostrar que la pareja no coincide sin
      // asignar artificialmente el error a uno de los dos campos.
      const form = control as FormGroup;
      const password = form.controls['password']?.value;
      const repeatPassword = form.controls['repetirPassword']?.value;
      return password && repeatPassword && password !== repeatPassword
        ? { passwordsMismatch: true }
        : null;
    };
  }

  private birthDateValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value as string;
      // El campo puede estar vacío durante la edición; Validators.required se
      // encarga de ese caso por separado.
      if (!value) {
        return null;
      }

      if (!/^(\d{2})\/(\d{2})\/(\d{4})$/.test(value)) {
        return { invalidBirthDate: true };
      }

      const [day, month, year] = value.split('/').map(Number);
      const date = new Date(year, month - 1, day);
      // JavaScript normaliza fechas imposibles (por ejemplo, 31/02) al mes
      // siguiente; comparar sus componentes detecta esa normalización.
      const isValid =
        date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day &&
        date < new Date();

      return isValid ? null : { invalidBirthDate: true };
    };
  }

  private toIsoDate(value: string): string {
    // El formulario muestra una fecha local legible, mientras que la API recibe
    // el formato estándar YYYY-MM-DD.
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
    return match ? `${match[3]}-${match[2]}-${match[1]}` : value;
  }
}
