import { Component, inject } from '@angular/core';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { Auth } from '../../services/auth';

/**
 * Modal que advierte al usuario que su sesión está por expirar.
 * Ofrece dos opciones: extender la sesión (refrescar token) o cerrar sesión.
 */
@Component({
  selector: 'app-session-warning-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule],
  template: `
    <div class="session-warning">
      <h2 mat-dialog-title>Tu sesión está por expirar</h2>
      <mat-dialog-content>
        <p>Queda <strong>poco tiempo</strong> antes de que expire tu sesión.</p>
        <p>¿Quieres continuar usando la aplicación?</p>
      </mat-dialog-content>
      <mat-dialog-actions>
        <button (click)="close()" class="cancel-button">Cerrar sesión</button>
        <button (click)="extend()" class="extend-button" [disabled]="isExtending">
          {{ isExtending ? 'Extendiendo...' : 'Extender sesión' }}
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .session-warning {
      padding: 20px;
      text-align: center;
    }

    h2 {
      color: #dc2626;
      margin-bottom: 16px;
      font-size: 18px;
    }

    p {
      margin: 12px 0;
      color: #374151;
      font-size: 14px;
    }

    strong {
      color: #dc2626;
      font-weight: 600;
    }

    mat-dialog-actions {
      display: flex;
      gap: 12px;
      justify-content: center;
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid #e5e7eb;
    }

    button {
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s;
    }

    .cancel-button {
      background: #f3f4f6;
      color: #6b7280;
    }

    .cancel-button:hover {
      background: #e5e7eb;
    }

    .extend-button {
      background: #5b3cc4;
      color: white;
    }

    .extend-button:hover:not(:disabled) {
      background: #4c2fa8;
    }

    .extend-button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  `],
})
export class SessionWarningDialog {
  private readonly dialogRef = inject(MatDialogRef<SessionWarningDialog, number | false>);
  private readonly auth = inject(Auth);

  isExtending = false;

  /**
   * Cierra el modal sin extender la sesión.
   */
  close(): void {
    this.dialogRef.close(false);
  }

  /**
   * Intenta extender la sesión llamando a /auth/refrescar.
   * Si es exitoso, cierra el modal con la nueva fecha de expiración.
   * Si falla, cierra el modal para que el timer maneje la expiración.
   */
  extend(): void {
    if (this.isExtending) {
      return;
    }

    this.isExtending = true;
    console.log('[SessionWarningDialog] Iniciando extensión de sesión...');

    // Solicita un nuevo token al backend.
    this.auth.refresh().subscribe({
      next: (response) => {
        console.log('[SessionWarningDialog] Extensión exitosa. Nueva expiración:', response.expiresAt);
        this.dialogRef.close(response.expiresAt);
      },
      error: (error) => {
        console.error('[SessionWarningDialog] Error al extender la sesión:', error);
        // Cierra el modal sin la nueva expiración para que se maneje como cierre de sesión.
        this.dialogRef.close(false);
      },
    });
  }
}
