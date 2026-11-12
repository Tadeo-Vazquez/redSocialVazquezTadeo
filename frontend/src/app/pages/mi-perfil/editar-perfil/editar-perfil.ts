import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnInit,
  OnDestroy,
  Output,
  inject,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { CurrentUser } from '../../../services/current-user';
import { Users } from '../../../services/users';

@Component({
  imports: [ReactiveFormsModule],
  selector: 'app-editar-perfil',
  styleUrl: './editar-perfil.scss',
  templateUrl: './editar-perfil.html',
})
export class EditarPerfil implements OnInit, OnDestroy {
  private readonly usersService = inject(Users);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);

  @Input({ required: true }) user!: CurrentUser;
  @Output() closed = new EventEmitter<void>();
  @Output() profileUpdated = new EventEmitter<CurrentUser>();

  readonly profileForm = new FormGroup({
    nombre: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(50)],
    }),
    apellido: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(50)],
    }),
    fechaNacimiento: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    descripcionBreve: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(280)],
    }),
  });

  selectedImage: File | null = null;
  imagePreview = '';
  imageError = '';
  errorMessage = '';
  isSaving = false;

  get today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  ngOnInit(): void {
    this.profileForm.patchValue({
      nombre: this.user.nombre ?? '',
      apellido: this.user.apellido ?? '',
      fechaNacimiento: this.user.fechaNacimiento?.slice(0, 10) ?? '',
      descripcionBreve: this.user.descripcionBreve ?? '',
    });
  }

  ngOnDestroy(): void {
    this.clearImagePreview();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }

  close(): void {
    if (!this.isSaving) {
      this.closed.emit();
    }
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.imageError = '';

    if (!file) {
      this.selectedImage = null;
      this.clearImagePreview();
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      this.imageError = 'Solo se permiten imágenes JPG, PNG o WEBP.';
      input.value = '';
      this.selectedImage = null;
      this.clearImagePreview();
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.imageError = 'La imagen no puede superar los 5 MB.';
      input.value = '';
      this.selectedImage = null;
      this.clearImagePreview();
      return;
    }

    this.clearImagePreview();
    this.selectedImage = file;
    this.imagePreview = URL.createObjectURL(file);
  }

  submit(): void {
    this.errorMessage = '';
    this.imageError = '';
    this.profileForm.markAllAsTouched();

    if (this.profileForm.invalid) {
      return;
    }

    const userId = this.user._id ?? this.user.id;
    if (!userId) {
      this.errorMessage = 'No se pudo identificar tu perfil. Vuelve a iniciar sesión.';
      return;
    }

    const formData = new FormData();
    const values = this.profileForm.getRawValue();
    formData.append('nombre', values.nombre.trim());
    formData.append('apellido', values.apellido.trim());
    formData.append('fechaNacimiento', values.fechaNacimiento);
    formData.append('descripcionBreve', values.descripcionBreve.trim());
    if (this.selectedImage) {
      formData.append('image', this.selectedImage, this.selectedImage.name);
    }

    this.isSaving = true;
    this.usersService
      .updateProfile(userId, formData)
      .pipe(
        finalize(() => {
          this.isSaving = false;
          this.changeDetectorRef.markForCheck();
        }),
      )
      .subscribe({
        next: (response) => {
          if (!response.user) {
            this.errorMessage = 'El servidor no devolvió los datos del perfil actualizado.';
            this.changeDetectorRef.markForCheck();
            return;
          }

          this.clearImagePreview();
          this.profileUpdated.emit(response.user);
        },
        error: (error: HttpErrorResponse) => {
          const message = error.error?.message;
          this.errorMessage = Array.isArray(message)
            ? message.join(' ')
            : typeof message === 'string'
              ? message
              : 'No se pudieron guardar los cambios. Inténtalo nuevamente.';
          this.changeDetectorRef.markForCheck();
        },
      });
  }

  private clearImagePreview(): void {
    if (this.imagePreview) {
      URL.revokeObjectURL(this.imagePreview);
      this.imagePreview = '';
    }
  }
}
