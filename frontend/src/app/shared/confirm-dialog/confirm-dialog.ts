import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';

/**
 * Datos que el componente que abre el modal le entrega mediante `data`.
 * No incluyen una función: el modal solo muestra la pregunta y comunica
 * la decisión; quien lo abrió decide qué hacer con la respuesta.
 */
export interface ConfirmDialogData {
  // Texto principal que identifica la acción que se quiere confirmar.
  title: string;
  // Explicación de la acción y, si corresponde, sus consecuencias.
  message: string;
  // Texto del botón que confirma, por ejemplo "Eliminar" o "Habilitar".
  confirmLabel: string;
  // Cambia el color para advertir que la acción es destructiva; no ejecuta nada.
  destructive: boolean;
}

/**
 * Diálogo reutilizable de Angular Material. La plantilla usa `data` para
 * mostrar título y mensaje; `[mat-dialog-close]="false"` cierra al cancelar y
 * `[mat-dialog-close]="true"` cierra al confirmar. Esos valores llegan al
 * componente que abrió el diálogo mediante `afterClosed()`.
 *
 * Si se cierra con Escape o haciendo clic fuera, el resultado es undefined.
 * El diálogo no conoce usuarios, publicaciones ni servicios: así puede
 * reutilizarse sin realizar acciones por sí mismo.
 */
@Component({
  selector: 'app-confirm-dialog',
  imports: [MatDialogModule],
  template: `
    <div class="confirmation">
      <h2 mat-dialog-title [class.destructive-title]="data.destructive">{{ data.title }}</h2>
      <mat-dialog-content>
        <p>{{ data.message }}</p>
      </mat-dialog-content>
      <mat-dialog-actions>
        <button type="button" class="cancel-button" [mat-dialog-close]="false">Cancelar</button>
        <button
          type="button"
          class="confirm-button"
          [class.destructive-button]="data.destructive"
          [mat-dialog-close]="true"
        >
          {{ data.confirmLabel }}
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [
    `
      .confirmation {
        padding: 20px;
        text-align: center;
      }

      h2 {
        color: #5b21b6;
        font-size: 18px;
      }

      h2.destructive-title {
        color: #dc2626;
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

      .confirm-button {
        background: #6d28d9;
        color: white;
      }

      .destructive-button {
        background: #dc2626;
      }

      .cancel-button:hover {
        background: #e5e7eb;
      }

      .confirm-button:hover {
        background: #5b21b6;
      }

      .destructive-button:hover {
        background: #b91c1c;
      }
    `,
  ],
})
export class ConfirmDialog {
  // Angular Material pone los datos enviados en `open(..., { data })` en el
  // token MAT_DIALOG_DATA. inject los recupera para usarlos en la plantilla.
  readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
}
