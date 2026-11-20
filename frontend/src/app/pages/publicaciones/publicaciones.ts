import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { finalize, timeout } from 'rxjs';
import { Post, Posts } from '../../services/posts';
import { Session } from '../../services/session';
import { PostLikes } from '../../services/post-likes';
import { AsideNav } from '../../shared/aside-nav/aside-nav';
import { PublicacionCard } from './publicacion-card';
import { ConfirmarBajaDialog } from './confirmar-baja-dialog';

@Component({
  imports: [AsideNav, PublicacionCard, MatDialogModule],
  selector: 'app-publicaciones',
  styleUrl: './publicaciones.scss',
  templateUrl: './publicaciones.html',
})
/**
 * Coordina el feed: carga y ordena páginas de publicaciones, procesa sus
 * interacciones y comunica los estados de carga y error a la plantilla.
 * Las tarjetas muestran los datos y emiten eventos; las peticiones se hacen aquí.
 */
export class Publicaciones implements OnInit {
  // inject obtiene las dependencias registradas en Angular sin pasarlas
  // manualmente al crear el componente.
  private readonly postsService = inject(Posts);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly session = inject(Session);
  private readonly postLikes = inject(PostLikes);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  // Un único diálogo de confirmación puede estar abierto a la vez.
  private confirmationOpen = false;

  // #feedTop identifica la sección del feed en el HTML. Es opcional porque
  // Angular solo puede resolver la referencia cuando la vista está disponible.
  @ViewChild('feedTop') private feedTop?: ElementRef<HTMLElement>;

  readonly currentUser = this.session.getCurrentUser();
  // offset indica cuántas publicaciones omite el servidor y pageSize cuántas
  // solicita. Por ejemplo, offset=4 y pageSize=4 piden la segunda página.
  readonly pageSize = 4;
  posts: Post[] = [];
  offset = 0;
  total = 0;
  ordenar: 'fecha' | 'likes' = 'fecha';
  isLoading = false;
  loadError = '';
  actionError = '';
  // Cada Set contiene los IDs con una petición pendiente. Así se deshabilita
  // solo el botón de la publicación afectada y se evitan solicitudes duplicadas.
  readonly pendingPostIds = new Set<string>();
  readonly deletingPostIds = new Set<string>();
  // Identifica la petición más reciente. Si una búsqueda anterior termina tarde,
  // sus callbacks no deben sobrescribir los datos que corresponden a la vista actual.
  private loadRequestId = 0;

  /** Normaliza las dos formas de identificador que puede guardar la sesión. */
  get currentUserId(): string {
    return this.currentUser?._id ?? this.currentUser?.id ?? '';
  }

  get canGoToPreviousPage(): boolean {
    // Se deshabilita la paginación mientras carga para que offset no cambie
    // varias veces y deje de corresponder a la respuesta mostrada.
    return this.offset > 0 && !this.isLoading;
  }

  get canGoToNextPage(): boolean {
    // Hay otra página si quedan registros después de la página actual.
    return this.offset + this.pageSize < this.total && !this.isLoading;
  }

  /** Angular llama a ngOnInit una vez al inicializar el componente. */
  ngOnInit(): void {
    this.loadPosts();
  }

  onSortChange(value: 'fecha' | 'likes'): void {
    // Repetir el mismo criterio no necesita una nueva consulta.
    if (value === this.ordenar) {
      return;
    }

    this.ordenar = value;
    // La página previa pertenece al orden anterior; el nuevo orden empieza en 0.
    this.offset = 0;
    this.loadPosts();
  }

  goToPreviousPage(): void {
    if (!this.canGoToPreviousPage) {
      return;
    }

    // Math.max evita que el desplazamiento sea negativo.
    this.offset = Math.max(0, this.offset - this.pageSize);
    this.scrollToFeedTop();
    this.loadPosts();
  }

  goToNextPage(): void {
    if (!this.canGoToNextPage) {
      return;
    }

    this.offset += this.pageSize;
    this.scrollToFeedTop();
    this.loadPosts();
  }

  /**
   * Solicita confirmación antes de dar de baja. Cancelar, cerrar con Escape o
   * hacer clic fuera del diálogo no ejecuta la eliminación.
   */
  confirmDeletePost(post: Post): void {
    // El guard también evita abrir varios diálogos por clics rápidos.
    // La autorización real de autor o administrador corresponde al backend.
    if (!this.currentUserId || this.deletingPostIds.has(post._id) || this.confirmationOpen) {
      return;
    }

    this.confirmationOpen = true;
    // Los tipos indican componente, datos de entrada (título) y resultado
    // booleano. El foco inicial queda en el primer botón, que es Cancelar.
    this.dialog.open<ConfirmarBajaDialog, string, boolean>(ConfirmarBajaDialog, {
      data: post.titulo,
      width: '420px',
      maxWidth: '90vw',
      role: 'alertdialog',
      autoFocus: 'first-tabbable',
    }).afterClosed().pipe(
      // Si se destruye esta vista, no se procesa posteriormente el resultado
      // de un diálogo asociado al componente anterior.
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((confirmed) => {
      this.confirmationOpen = false;
      // Solo el botón de confirmación devuelve true; cualquier otro cierre
      // deja intacta la publicación.
      if (confirmed === true) {
        this.deletePost(post);
      }
    });
  }

  /**
   * Envía la baja lógica confirmada. La cookie de sesión identifica al actor
   * ante el backend, que decide si puede eliminar esta publicación.
   */
  private deletePost(post: Post): void {
    // El Set bloquea únicamente la tarjeta afectada, sin impedir otras acciones
    // en publicaciones distintas.
    if (!this.currentUserId || this.deletingPostIds.has(post._id)) {
      return;
    }

    this.deletingPostIds.add(post._id);
    this.actionError = '';
    // Solicita a Angular que revise la vista para reflejar el botón deshabilitado.
    this.changeDetectorRef.markForCheck();
    this.postsService
      .deletePost(post._id)
      .pipe(
        timeout(10000),
        // El indicador se limpia también si la solicitud termina por error o timeout.
        finalize(() => {
          this.deletingPostIds.delete(post._id);
          this.changeDetectorRef.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          // Si se eliminó la última tarjeta de una página que no es la primera,
          // retrocedemos antes de recargar para no dejar una página vacía.
          this.total = Math.max(0, this.total - 1);
          if (this.posts.length === 1 && this.offset > 0) {
            this.offset = Math.max(0, this.offset - this.pageSize);
          }
          this.loadPosts();
        },
        error: () => {
          // Se conserva la tarjeta si la API rechaza la baja o vence el timeout.
          this.actionError = 'No se pudo eliminar la publicación. Inténtalo nuevamente.';
        },
      });
  }

  /** Alterna el me gusta usando el estado actual y aplica la respuesta de la API. */
  toggleLike(post: Post): void {
    const userId = this.currentUserId;
    // Se rastrea la acción por ID para no emitir mutaciones duplicadas sobre la
    // misma publicación durante una petición pendiente.
    if (!userId || this.pendingPostIds.has(post._id)) {
      return;
    }

    // PostLikes determina si corresponde agregar o quitar el like y devuelve
    // tanto la petición como el estado anterior para elegir el mensaje de error.
    const likeAction = this.postLikes.toggle(post, userId);
    this.pendingPostIds.add(post._id);
    this.actionError = '';
    this.changeDetectorRef.markForCheck();

    likeAction.request
      .pipe(
        timeout(10000),
        finalize(() => {
          this.pendingPostIds.delete(post._id);
          this.changeDetectorRef.markForCheck();
        }),
      )
      .subscribe({
        next: (response) => {
          // Se reemplaza la colección con los datos actualizados sin recargar
          // todas las publicaciones de la página.
          this.posts = this.postLikes.applyResponse(this.posts, post._id, userId, response);
        },
        error: () => {
          this.actionError = likeAction.alreadyLiked
            ? 'No se pudo quitar el me gusta. Inténtalo nuevamente.'
            : 'No se pudo registrar el me gusta. Inténtalo nuevamente.';
        },
      });
  }

  /** Consulta si el usuario indicado ya dio me gusta a la publicación. */
  hasLiked(post: Post, userId = this.currentUserId): boolean {
    return this.postLikes.hasLiked(post, userId);
  }

  // El ID estable permite que @for identifique cada tarjeta entre actualizaciones.
  trackPost(_index: number, post: Post): string {
    return post._id;
  }

  // Al cambiar de página, vuelve al encabezado del feed si la vista existe.
  private scrollToFeedTop(): void {
    this.feedTop?.nativeElement.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }

  /**
   * Consulta la página y el orden seleccionados. Cada petición tiene un número
   * propio para que una respuesta antigua no reemplace una selección más reciente.
   */
  private loadPosts(): void {
    // Cada carga recibe una identidad propia para descartar respuestas obsoletas
    // cuando se cambia de orden o página antes de que termine la solicitud anterior.
    const requestId = ++this.loadRequestId;
    this.isLoading = true;
    this.loadError = '';
    this.actionError = '';
    this.changeDetectorRef.markForCheck();
    this.postsService
      .getPosts(this.ordenar, this.offset, this.pageSize)
      .pipe(
        timeout({ first: 10000 }),
        // finalize también se ejecuta ante error, timeout o desuscripción;
        // finishLoading ignora IDs que ya quedaron obsoletos.
        finalize(() => this.finishLoading(requestId)),
      )
      .subscribe({
        next: (response) => {
          // Una respuesta vieja puede llegar después de que el usuario cambió
          // de orden o página. Se ignora sin modificar la vista actual.
          if (requestId !== this.loadRequestId) {
            return;
          }

          // Aunque la solicitud haya sido exitosa, el servidor puede devolver
          // datos inválidos. En ese caso, se muestra un error explícito.
          if (
            !response ||
            !Array.isArray(response.posts) ||
            !Number.isFinite(response.total)
          ) {
            this.posts = [];
            this.loadError = 'El servidor devolvió una respuesta inválida.';
            this.finishLoading(requestId);
            return;
          }

          // El servidor es la fuente de verdad tanto para la página como para
          // el total usado al habilitar la navegación.
          this.posts = response.posts;
          this.total = response.total;
          this.finishLoading(requestId);
        },
        error: () => {
          if (requestId !== this.loadRequestId) {
            return;
          }
          this.posts = [];
          this.loadError = 'No se pudieron cargar las publicaciones.';
          this.finishLoading(requestId);
        },
      });
  }

  /** Libera el estado de carga únicamente para la petición que sigue vigente. */
  private finishLoading(requestId: number): void {
    // Solo la solicitud vigente puede apagar el indicador de carga; una respuesta
    // antigua no debe hacer parecer que la petición más reciente ya terminó.
    if (requestId !== this.loadRequestId) {
      return;
    }

    this.isLoading = false;
    this.changeDetectorRef.markForCheck();
  }
}
