import { ChangeDetectorRef, Component, DestroyRef, EventEmitter, Output, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { Users } from '../../../services/users';
import { errorMessage } from '../http-error-message';

/**
 * Formulario para que un administrador cree cuentas nuevas (usuario o
 * administrador). Avisa al padre con `created` cuando el alta tuvo éxito.
 */
@Component({
  imports: [ReactiveFormsModule],
  selector: 'app-user-create-form',
  templateUrl: './user-create-form.html',
  styleUrl: '../dashboard-shared.scss',
})
export class UserCreateForm {
  private readonly usersService = inject(Users);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  // El padre escucha este evento para recargar la lista de usuarios.
  @Output() created = new EventEmitter<void>();

  submitting = false;
  formError = '';
  formSuccess = '';
  imageError = '';
  selectedImage: File | null = null;
  // La plantilla usa esta versión como clave del input de archivo. Cambiarla
  // después del alta recrea el input y limpia también el nombre visible del archivo.
  imageInputVersion = 0;

  // Cada FormControl mantiene valor, estado de interacción y errores. Los
  // validadores mejoran la respuesta inmediata, pero el backend vuelve a validar
  // los datos recibidos. nonNullable evita que reset deje valores en null.
  readonly userForm = new FormGroup({
    nombre: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.maxLength(50),
        Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]+$/),
      ],
    }),
    apellido: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.maxLength(50),
        Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]+$/),
      ],
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
    fechaNacimiento: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(8),
        Validators.pattern(/^(?=.*[A-Z])(?=.*\d)/),
      ],
    }),
    repetirPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    descripcionBreve: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(280)],
    }),
    perfil: new FormControl<'usuario' | 'administrador'>('usuario', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  /**
   * Guarda la foto elegida solo si su tipo y tamaño son válidos. Esta revisión
   * da una respuesta rápida en el navegador; el servidor comprueba y normaliza
   * el contenido real de la imagen antes de almacenarla.
   */
  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    // Al elegir otro archivo se descarta la selección anterior, incluso si el
    // nuevo archivo resulta inválido o el diálogo se cierra sin una elección.
    this.selectedImage = null;
    this.imageError = '';
    if (!file) return;
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
    this.selectedImage = file;
  }

  /**
   * Valida el formulario, construye una petición multipart con la foto y crea
   * la cuenta sin cambiar la sesión del administrador que realiza el alta.
   */
  createUser(): void {
    // Bloquea envíos duplicados mientras la solicitud anterior está pendiente.
    if (this.submitting) return;
    this.formError = '';
    this.formSuccess = '';
    // Marcar los campos permite que la plantilla muestre sus errores concretos
    // aunque el usuario no haya pasado por cada uno antes de enviar.
    this.userForm.markAllAsTouched();
    if (this.userForm.invalid) {
      this.formError = 'Revisá los campos del formulario antes de continuar.';
      return;
    }
    // La coincidencia de contraseñas y la fecha anterior al momento actual son
    // reglas adicionales a las validaciones individuales de cada control.
    const values = this.userForm.getRawValue();
    if (values.password !== values.repetirPassword) {
      this.formError = 'Las contraseñas deben coincidir.';
      return;
    }
    const birthDate = new Date(`${values.fechaNacimiento}T00:00:00`);
    if (Number.isNaN(birthDate.getTime()) || birthDate >= new Date()) {
      this.formError = 'La fecha de nacimiento debe ser anterior a la fecha actual.';
      return;
    }
    if (!this.selectedImage) {
      this.imageError = 'Seleccioná una foto de perfil.';
      return;
    }

    // FormData combina campos de texto y archivo. Se eliminan espacios externos
    // de los datos textuales, pero nunca de las contraseñas: sus caracteres
    // deben llegar exactamente como los escribió el administrador.
    const data = new FormData();
    for (const [key, value] of Object.entries(values)) {
      data.append(key, key === 'password' || key === 'repetirPassword' ? value : value.trim());
    }
    data.append('image', this.selectedImage, this.selectedImage.name);
    this.submitting = true;
    this.usersService
      .createUser(data)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.submitting = false;
          this.changeDetector.markForCheck();
        }),
      )
      .subscribe({
        next: (response) => {
          // Solo tras el éxito se limpia el formulario y la foto, se restablece
          // el rol predeterminado y se avisa al padre para actualizar el listado.
          this.userForm.reset({ perfil: 'usuario' });
          this.selectedImage = null;
          this.imageInputVersion++;
          this.imageError = '';
          this.formSuccess = response.message;
          this.created.emit();
          this.changeDetector.markForCheck();
        },
        error: (error: unknown) => {
          this.formError = errorMessage(error, 'No se pudo crear el usuario.');
          this.changeDetector.markForCheck();
        },
      });
  }
}
