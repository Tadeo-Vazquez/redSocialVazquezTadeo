import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';

@Component({
  selector: 'app-confirmar-baja-dialog',
  imports: [MatDialogModule],
  template: `
    <div class="confirmation">
      <h2 mat-dialog-title>¿Eliminar publicación?</h2>
      <mat-dialog-content>
        <p>Se ocultará la publicación "{{ titulo }}" y sus comentarios.</p>
      </mat-dialog-content>
      <mat-dialog-actions>
        <button type="button" class="cancel-button" [mat-dialog-close]="false">Cancelar</button>
        <button type="button" class="delete-button" [mat-dialog-close]="true">Eliminar</button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .confirmation {
      padding: 20px;
      text-align: center;
    }

    h2 {
      color: #dc2626;
      font-size: 18px;
    }

    p {
      color: #374151;
      font-size: 14px;
      overflow-wrap: anywhere;
    }

    mat-dialog-actions {
      display: flex;
      justify-content: center;
      gap: 12px;
      margin-top: 16px;
      border-top: 1px solid #e5e7eb;
      padding-top: 16px;
    }

    button {
      padding: 8px 16px;
      border: 0;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
    }

    .cancel-button {
      background: #f3f4f6;
      color: #374151;
    }

    .delete-button {
      background: #dc2626;
      color: white;
    }

    .cancel-button:hover {
      background: #e5e7eb;
    }

    .delete-button:hover {
      background: #b91c1c;
    }
  `],
})
export class ConfirmarBajaDialog {
  readonly titulo = inject<string>(MAT_DIALOG_DATA);
}
