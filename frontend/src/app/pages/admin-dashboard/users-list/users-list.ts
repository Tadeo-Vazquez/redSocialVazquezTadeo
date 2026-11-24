import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { finalize } from 'rxjs';
import { AdminUser, Users } from '../../../services/users';
import { Session } from '../../../services/session';
import { ConfirmDialog, ConfirmDialogData } from '../../../shared/confirm-dialog/confirm-dialog';
import { errorMessage } from '../http-error-message';

/**
 * Muestra la lista de cuentas y permite habilitarlas o deshabilitarlas
 * (baja lógica) previa confirmación en un modal.
 */
@Component({
  imports: [MatDialogModule],
  selector: 'app-users-list',
  templateUrl: './users-list.html',
  styleUrl: '../dashboard-shared.scss',
})
export class UsersList implements OnInit {
  private readonly usersService = inject(Users);
  private readonly session = inject(Session);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(MatDialog);
  private confirmationOpen = false;

  // La sesión puede usar _id o id. Este dato solo sirve para identificar la
  // propia cuenta en la interfaz; no determina permisos en el servidor.
  readonly currentUserId = this.session.getCurrentUser()?._id ?? this.session.getCurrentUser()?.id;
  users: AdminUser[] = [];
  loadingUsers = false;
  userError = '';
  userMessage = '';
  // Guarda los IDs con una operación pendiente para bloquear solo el botón
  // afectado y evitar enviar la misma acción varias veces.
  pendingUserIds = new Set<string>();

  /** Angular llama a este método al inicializar la vista del componente. */
  ngOnInit(): void {
    this.loadUsers();
  }

  /**
   * Consulta la lista administrativa y actualiza la pantalla tanto si llega una
   * respuesta como si falla. También la usa el padre para refrescar tras un alta.
   */
  loadUsers(): void {
    this.loadingUsers = true;
    this.userError = '';
    this.userMessage = '';
    this.usersService
      .listUsers()
      .pipe(
        // Evita procesar respuestas si el usuario abandona el panel.
        takeUntilDestroyed(this.destroyRef),
        // finalize también se ejecuta ante errores o cancelación, por lo que
        // el indicador de carga no queda encendido.
        finalize(() => {
          this.loadingUsers = false;
          this.changeDetector.markForCheck();
        }),
      )
      .subscribe({
        next: (users) => {
          this.users = users;
          this.changeDetector.markForCheck();
        },
        error: (error: unknown) => {
          this.userError = errorMessage(error, 'No se pudieron cargar los usuarios.');
          this.changeDetector.markForCheck();
        },
      });
  }

  /**
   * Confirma y ejecuta la acción correspondiente al estado actual: rehabilita
   * cuentas deshabilitadas o aplica la baja lógica a las habilitadas.
   */
  toggleUser(user: AdminUser): void {
    if (this.pendingUserIds.has(user._id) || this.confirmationOpen) return;
    const action = user.isDeleted ? 'habilitar' : 'deshabilitar';
    // Si el administrador deshabilita su propia cuenta, el token dejará de
    // autorizar nuevas peticiones; por eso la confirmación lo advierte.
    const warning =
      user._id === this.currentUserId && !user.isDeleted ? ' Tu sesión dejará de ser válida.' : '';
    // Solo una confirmación puede estar abierta a la vez. Cancelar, usar
    // Escape o cerrar el diálogo sin confirmar no inicia ninguna petición.
    this.confirmationOpen = true;
    // `data` define el texto y el estilo del modal para esta cuenta. No se
    // envía una función: la acción se decide al recibir el resultado.
    this.dialog
      .open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, {
        data: {
          title: `¿${user.isDeleted ? 'Habilitar' : 'Deshabilitar'} usuario?`,
          message: `¿Querés ${action} a ${user.username}?${warning}`,
          confirmLabel: user.isDeleted ? 'Habilitar' : 'Deshabilitar',
          destructive: !user.isDeleted,
        },
        width: '420px',
        maxWidth: '90vw',
        role: 'alertdialog',
        autoFocus: 'first-tabbable',
      })
      // afterClosed emite true al confirmar, false al cancelar y undefined al
      // cerrar sin elegir; takeUntilDestroyed evita actuar fuera de este panel.
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        this.confirmationOpen = false;
        // Este es el punto donde se indica qué hacer al confirmar: pasar el
        // usuario seleccionado a changeUserStatus. Con false o undefined no
        // se llama al servicio ni se modifica la cuenta.
        if (confirmed === true) this.changeUserStatus(user);
      });
  }

  private changeUserStatus(user: AdminUser): void {
    if (this.pendingUserIds.has(user._id)) return;
    const action = user.isDeleted ? 'habilitar' : 'deshabilitar';
    this.userError = '';
    this.userMessage = '';
    this.pendingUserIds.add(user._id);
    // El servicio devuelve un Observable; la petición elegida se inicia cuando
    // nos suscribimos, después de registrar que el usuario está pendiente.
    const request = user.isDeleted
      ? this.usersService.enableUser(user._id)
      : this.usersService.disableUser(user._id);
    request
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.pendingUserIds.delete(user._id);
          this.changeDetector.markForCheck();
        }),
      )
      .subscribe({
        next: (response) => {
          // Sustituye solamente la fila modificada con la versión que devolvió
          // el backend y conserva intactos los demás usuarios del listado.
          this.users = this.users.map((item) => (item._id === user._id ? response.user : item));
          this.userMessage = response.message;
          this.changeDetector.markForCheck();
        },
        error: (error: unknown) => {
          this.userError = errorMessage(error, `No se pudo ${action} el usuario.`);
          this.changeDetector.markForCheck();
        },
      });
  }
}
