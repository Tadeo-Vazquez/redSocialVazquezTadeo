import { HttpErrorResponse } from '@angular/common/http';
import { DecimalPipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { ImageCropperComponent, ImageCroppedEvent, ImageTransform } from 'ngx-image-cropper';
import { Posts } from '../../services/posts';
import { AsideNav } from '../../shared/aside-nav/aside-nav';
import { Session } from '../../services/session';

@Component({
  imports: [AsideNav, ReactiveFormsModule, ImageCropperComponent, DecimalPipe],
  selector: 'app-publicar',
  styleUrl: './publicar.scss',
  templateUrl: './publicar.html',
})
export class Publicar implements OnDestroy {
  private readonly postsService = inject(Posts);
  private readonly router = inject(Router);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly session = inject(Session);
  readonly currentUser = this.session.getCurrentUser();

  readonly postForm = new FormGroup({
    titulo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100)],
    }),
    descripcion: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(1000)],
    }),
  });

  selectedImage: File | null = null;
  imageChangedEvent: Event | null = null;
  croppedImageBlob: Blob | null = null;
  imageTransform: ImageTransform = { scale: 1 };
  imagePreview = '';
  imageError = '';
  errorMessage = '';
  isSubmitting = false;
  step: 1 | 2 = 1;

  get continueLabel(): string {
    return this.selectedImage ? 'Continuar' : 'Continuar sin imagen';
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.imageError = '';

    if (!file) {
      this.selectedImage = null;
      this.imageChangedEvent = null;
      this.croppedImageBlob = null;
      this.clearImagePreview();
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      this.imageError = 'Solo se permiten imágenes JPG, PNG o WEBP.';
      input.value = '';
      this.selectedImage = null;
      this.imageChangedEvent = null;
      this.croppedImageBlob = null;
      this.clearImagePreview();
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.imageError = 'La imagen no puede superar los 5 MB.';
      input.value = '';
      this.selectedImage = null;
      this.imageChangedEvent = null;
      this.croppedImageBlob = null;
      this.clearImagePreview();
      return;
    }

    this.clearImagePreview();
    this.selectedImage = file;
    this.imageChangedEvent = event;
    this.croppedImageBlob = null;
    this.imageTransform = { scale: 1 };
  }

  onImageCropped(event: ImageCroppedEvent): void {
    if (event.blob) {
      this.croppedImageBlob = event.blob;
    }
  }

  onTransformChange(transform: ImageTransform): void {
    this.imageTransform = transform;
  }

  onZoomChange(event: Event): void {
    const scale = Number((event.target as HTMLInputElement).value);
    this.imageTransform = { ...this.imageTransform, scale };
  }

  onCropperLoadFailed(): void {
    this.imageError = 'No se pudo cargar la imagen para recortarla.';
    this.selectedImage = null;
    this.imageChangedEvent = null;
    this.croppedImageBlob = null;
  }

  removeImage(input: HTMLInputElement): void {
    this.selectedImage = null;
    this.imageChangedEvent = null;
    this.croppedImageBlob = null;
    this.imageTransform = { scale: 1 };
    input.value = '';
    this.imageError = '';
    this.clearImagePreview();
  }

  continueToDetails(): void {
    if (this.imageError) {
      return;
    }

    if (this.selectedImage) {
      if (!this.croppedImageBlob) {
        this.imageError = 'Espera a que termine de procesarse el recorte.';
        return;
      }

      this.selectedImage = new File([this.croppedImageBlob], 'publicacion.webp', {
        type: 'image/webp',
      });
      this.clearImagePreview();
      this.imagePreview = URL.createObjectURL(this.croppedImageBlob);
    }

    this.errorMessage = '';
    this.step = 2;
  }

  backToImage(): void {
    if (this.isSubmitting) {
      return;
    }

    this.errorMessage = '';
    this.step = 1;
  }

  submit(): void {
    if (this.step !== 2) {
      return;
    }

    this.errorMessage = '';
    this.postForm.markAllAsTouched();
    if (this.postForm.invalid) {
      return;
    }

    const usuarioId = this.currentUser?._id ?? this.currentUser?.id;
    if (!usuarioId) {
      this.errorMessage = 'No se pudo identificar tu sesión. Cierra sesión e inicia nuevamente.';
      return;
    }

    const data = new FormData();
    data.append('usuarioId', usuarioId);
    data.append('titulo', this.postForm.controls.titulo.value.trim());
    data.append('descripcion', this.postForm.controls.descripcion.value.trim());
    if (this.selectedImage) {
      data.append('image', this.selectedImage, this.selectedImage.name);
    }

    this.isSubmitting = true;
    this.postsService
      .createPost(data)
      .pipe(
        finalize(() => {
          this.isSubmitting = false;
          this.changeDetectorRef.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          this.clearImagePreview();
          void this.router.navigate(['/publicaciones']);
        },
        error: (error: HttpErrorResponse) => {
          const message = error.error?.message;
          this.errorMessage = Array.isArray(message)
            ? message.join(' ')
            : typeof message === 'string'
              ? message
              : 'No se pudo crear la publicación. Inténtalo nuevamente.';
          this.changeDetectorRef.markForCheck();
        },
      });
  }

  ngOnDestroy(): void {
    this.clearImagePreview();
  }

  private clearImagePreview(): void {
    if (this.imagePreview) {
      URL.revokeObjectURL(this.imagePreview);
      this.imagePreview = '';
    }
  }
}
