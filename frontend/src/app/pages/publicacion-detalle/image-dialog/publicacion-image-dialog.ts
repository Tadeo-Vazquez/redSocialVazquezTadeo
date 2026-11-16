import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export interface PublicacionImageDialogData {
  imageUrl: string;
  imageAlt: string;
}

@Component({
  selector: 'app-publicacion-image-dialog',
  standalone: true,
  styleUrl: './publicacion-image-dialog.scss',
  templateUrl: './publicacion-image-dialog.html',
})
export class PublicacionImageDialog {
  readonly data = inject<PublicacionImageDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<PublicacionImageDialog>);

  close(): void {
    this.dialogRef.close();
  }
}
