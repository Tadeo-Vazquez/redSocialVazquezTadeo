import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { finalize } from 'rxjs';
import { AsideNav } from '../../shared/aside-nav/aside-nav';
import { AdminUser, Users } from '../../services/users';
import { CommentsPerPost, PostsPerUser, Statistics } from '../../services/statistics';
import { Session } from '../../services/session';
import { ConfirmDialog, ConfirmDialogData } from '../../shared/confirm-dialog/confirm-dialog';

function validRangeDate(control: AbstractControl): ValidationErrors | null {
  const value: unknown = control.value;
  if (value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { invalidDate: true };
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  // La comparación detecta fechas imposibles que JavaScript normaliza, como
  // el 31 de febrero, sin depender de la zona horaria del navegador.
  return value.startsWith('0000') ||
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
    ? { invalidDate: true }
    : null;
}

@Component({
  imports: [AsideNav, ReactiveFormsModule, MatDialogModule],
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.scss',
})
/**
 * Coordina las dos secciones del panel: gestiona el formulario y los cambios
 * de estado de usuarios, y prepara los datos que la plantilla usa en gráficos.
 * La ruta está protegida por adminGuard; la autorización definitiva de cada
 * petición se realiza en el backend, no con los datos guardados en el navegador.
 */
export class AdminDashboard implements OnInit {
  // inject recupera servicios compartidos del inyector de Angular. DestroyRef
  // permite cancelar suscripciones cuando el componente deja de existir.
  private readonly usersService = inject(Users);
  private readonly statisticsService = inject(Statistics);
  private readonly session = inject(Session);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(MatDialog);
  private confirmationOpen = false;

  // La sesión puede usar _id o id. Este dato solo sirve para identificar la
  // propia cuenta en la interfaz; no determina permisos en el servidor.
  readonly currentUserId = this.session.getCurrentUser()?._id ?? this.session.getCurrentUser()?.id;
  // Estado compartido con la plantilla para seleccionar la sección visible y
  // presentar el resultado, los mensajes y los indicadores de carga.
  activeTab: 'users' | 'statistics' = 'users';
  users: AdminUser[] = [];
  loadingUsers = false;
  userError = '';
  userMessage = '';
  // Guarda los IDs con una operación pendiente para bloquear solo el botón
  // afectado y evitar enviar la misma acción varias veces.
  pendingUserIds = new Set<string>();
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

  // Los límites opcionales se comparten entre los tres gráficos; un valor vacío
  // significa que no se solicita ese extremo al backend.
  readonly rangeForm = new FormGroup({
    from: new FormControl('', { nonNullable: true, validators: [validRangeDate] }),
    to: new FormControl('', { nonNullable: true, validators: [validRangeDate] }),
  });
  // Los navegadores pueden entregar una cadena vacía mientras el usuario
  // escribe una fecha incompleta; badInput permite distinguirla de un campo vacío.
  invalidDateInputs = { from: false, to: false };
  loadingStatistics = false;
  statisticsError = '';
  hasStatistics = false;
  posts: PostsPerUser[] = [];
  commentsTotal = 0;
  commentsPerPost: CommentsPerPost[] = [];
  // Identifica la última solicitud válida. Una respuesta anterior no debe
  // sobrescribir resultados de un rango consultado después.
  private statisticsRequestId = 0;

  /** Angular llama a este método al inicializar la vista del componente. */
  ngOnInit(): void {
    this.loadUsers();
  }

  /**
   * Cambia la sección visible. Las estadísticas se cargan al entrar por primera
   * vez y se conservan al cambiar de pestaña, sin repetir consultas innecesarias.
   */
  selectTab(tab: 'users' | 'statistics'): void {
    this.activeTab = tab;
    if (tab === 'statistics' && !this.hasStatistics && !this.loadingStatistics) {
      this.loadStatistics();
    }
  }

  /**
   * Consulta la lista administrativa y actualiza la pantalla tanto si llega una
   * respuesta como si falla. La suscripción se libera al destruir el componente.
   */
  loadUsers(): void {
    this.loadingUsers = true;
    this.userError = '';
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
          this.userError = this.errorMessage(error, 'No se pudieron cargar los usuarios.');
          this.changeDetector.markForCheck();
        },
      });
  }

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
    this.userMessage = '';
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
          // el rol predeterminado y se actualiza el listado desde el servidor.
          this.userForm.reset({ perfil: 'usuario' });
          this.selectedImage = null;
          this.imageInputVersion++;
          this.imageError = '';
          this.formSuccess = response.message;
          this.loadUsers();
        },
        error: (error: unknown) => {
          this.formError = this.errorMessage(error, 'No se pudo crear el usuario.');
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
    this.dialog.open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, {
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
    // afterClosed emite true al confirmar, false al cancelar y undefined al
    // cerrar sin elegir; takeUntilDestroyed evita actuar fuera de este panel.
    }).afterClosed().pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((confirmed) => {
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
          this.userError = this.errorMessage(error, `No se pudo ${action} el usuario.`);
          this.changeDetector.markForCheck();
        },
      });
  }

  /**
   * Solicita las tres métricas usando el rango elegido y reemplaza los datos
   * del panel únicamente cuando se completa la solicitud más reciente.
   */
  onRangeDateInput(field: 'from' | 'to', input: HTMLInputElement): void {
    this.invalidDateInputs[field] =
      input.validity.badInput || input.validity.rangeUnderflow || input.validity.rangeOverflow;
    this.statisticsError = '';
  }

  loadStatistics(): void {
    this.rangeForm.markAllAsTouched();
    const { from, to } = this.rangeForm.getRawValue();
    if (this.rangeForm.invalid || this.invalidDateInputs.from || this.invalidDateInputs.to) {
      this.statisticsRequestId++;
      this.loadingStatistics = false;
      this.hasStatistics = false;
      this.statisticsError = '';
      return;
    }
    // Los inputs de fecha entregan YYYY-MM-DD, formato cuyo orden de texto
    // coincide con el cronológico. Si el rango es inválido, incrementar el ID
    // también impide mostrar una respuesta que aún estuviera en camino.
    if (from && to && from > to) {
      this.statisticsRequestId++;
      this.loadingStatistics = false;
      this.hasStatistics = false;
      this.statisticsError = 'La fecha de inicio no puede ser posterior a la fecha de fin.';
      return;
    }
    // Cada carga obtiene una identidad propia para descartar respuestas viejas
    // cuando se solicita otro rango antes de que termine el anterior.
    const requestId = ++this.statisticsRequestId;
    this.loadingStatistics = true;
    this.statisticsError = '';
    this.statisticsService
      .getStatistics(from, to)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          if (requestId === this.statisticsRequestId) {
            this.loadingStatistics = false;
            this.changeDetector.markForCheck();
          }
        }),
      )
      .subscribe({
        next: (result) => {
          if (requestId !== this.statisticsRequestId) return;
          this.posts = result.posts;
          this.commentsTotal = result.comments.total;
          this.commentsPerPost = result.perPost;
          this.hasStatistics = true;
          this.changeDetector.markForCheck();
        },
        error: (error: unknown) => {
          if (requestId !== this.statisticsRequestId) return;
          this.hasStatistics = false;
          this.statisticsError =
            error instanceof HttpErrorResponse && error.status === 403
              ? 'No tenés permiso para consultar las estadísticas.'
              : 'No se pudieron cargar las estadísticas. Revisá las fechas e intentá nuevamente.';
          this.changeDetector.markForCheck();
        },
      });
  }

  /**
   * Escala las barras respecto de la mayor cantidad. El mínimo 1 evita dividir
   * por cero cuando no hay datos o todos los valores son cero.
   */
  get maxPosts(): number {
    return Math.max(1, ...this.posts.map((item) => item.cantidad));
  }

  /**
   * Construye un gradiente circular para representar la proporción de
   * comentarios por publicación. Cada segmento ocupa su porcentaje del total;
   * la leyenda muestra los títulos y valores también como texto.
   */
  get commentsChart(): string {
    const total = this.commentsPerPost.reduce((sum, item) => sum + item.cantidad, 0);
    if (!total) return 'conic-gradient(#2c2940 0 100%)';
    // Cada segmento empieza donde terminó el anterior para cubrir el círculo
    // de forma continua, desde 0 % hasta aproximadamente 100 %.
    let start = 0;
    const segments = this.commentsPerPost.map((item, index) => {
      const end = start + (item.cantidad / total) * 100;
      const segment = `${this.chartColor(index)} ${start}% ${end}%`;
      start = end;
      return segment;
    });
    return `conic-gradient(${segments.join(', ')})`;
  }

  /** Reutiliza la paleta al superar su longitud para que todos tengan color. */
  chartColor(index: number): string {
    const colors = ['#a78bfa', '#f472b6', '#38bdf8', '#34d399', '#fbbf24', '#fb7185', '#818cf8'];
    return colors[index % colors.length];
  }

  /**
   * Extrae el mensaje enviado por NestJS, que puede ser texto o una lista de
   * errores de validación. Para fallos sin ese formato utiliza un mensaje
   * legible, sin asumir la estructura de un valor unknown.
   */
  private errorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      const message: unknown = error.error?.message;
      if (typeof message === 'string') return message;
      if (Array.isArray(message) && message.every((item) => typeof item === 'string')) {
        return message.join(' ');
      }
    }
    return fallback;
  }
}
