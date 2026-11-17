import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  EventEmitter,
  HostListener,
  HostBinding,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { finalize, timeout } from 'rxjs';
import { TimeAgoPipe } from '../../pipes/time-ago.pipe';
import { CommentAuthor, Comments, PostComment } from '../../services/comments';
import { CurrentUser } from '../../services/current-user';
import { Post } from '../../services/posts';
import { Session } from '../../services/session';

@Component({
  imports: [TimeAgoPipe],
  selector: 'app-comments-aside',
  templateUrl: './comments-aside.html',
  styleUrl: './comments-aside.scss',
})
/**
 * Aside reutilizable para leer, agregar y editar comentarios.
 * En modo incrustado forma parte de una página; en modo normal conserva el
 * comportamiento de panel superpuesto usado desde otras pantallas.
 */
export class CommentsAside implements OnChanges {
  private readonly commentsService = inject(Comments);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly session = inject(Session);

  // El post define el endpoint y el título; embedded solo cambia la presentación del mismo flujo.
  @Input({ required: true }) post!: Post;
  @Input() embedded = false;
  @Output() closed = new EventEmitter<void>();

  readonly currentUser = this.session.getCurrentUser();
  // La carga inicial es pequeña; el usuario pide páginas posteriores explícitamente.
  readonly pageSize = 5;
  comments: PostComment[] = [];
  total = 0;
  draft = '';
  editingCommentId: string | null = null;
  editingText = '';
  isLoading = false;
  isSaving = false;
  loadError = '';
  actionError = '';
  private loadRequestId = 0;

  @HostBinding('class.embedded')
  get isEmbedded(): boolean {
    // La clase del host permite que CSS cambie el overlay por una columna en detalle.
    return this.embedded;
  }

  /** Normaliza las dos formas de ID de sesión admitidas por el resto de la aplicación. */
  get currentUserId(): string {
    return this.currentUser?._id ?? this.currentUser?.id ?? '';
  }

  /** El total remoto y la cantidad ya cargada determinan si se muestra "Cargar más". */
  get canLoadMore(): boolean {
    return this.comments.length < this.total;
  }

  /**
   * Angular llama este hook cuando llega el post seleccionado. Se limpia el
   * estado anterior para no mezclar comentarios de publicaciones distintas y
   * se solicita la primera página.
   */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['post'] && this.post?._id) {
      this.comments = [];
      this.total = 0;
      this.draft = '';
      this.editingCommentId = null;
      this.loadComments(false);
    }
  }

  /** Escape cierra únicamente el panel flotante; en detalle no debe abandonar la página. */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (!this.embedded) {
      this.close();
    }
  }

  /** Pide la página siguiente usando como offset los comentarios ya visibles. */
  loadMore(): void {
    if (!this.isLoading && this.canLoadMore) {
      this.loadComments(true);
    }
  }

  /** Vuelve a solicitar la primera página tras un error inicial de lectura. */
  retryLoad(): void {
    if (!this.isLoading) {
      this.loadComments(false);
    }
  }

  /**
   * Valida el borrador, lo envía al API y agrega la respuesta al principio de
   * la lista, que está ordenada del comentario más reciente al más antiguo.
   */
  submitComment(event: Event): void {
    event.preventDefault();
    const text = this.draft.trim();
    if (!text || !this.currentUserId || this.isSaving) {
      return;
    }

    this.isSaving = true;
    this.actionError = '';
    this.commentsService
      .createComment(this.post._id, this.currentUserId, text)
      .pipe(
        timeout(10000),
        finalize(() => {
          this.isSaving = false;
          this.refreshView();
        }),
      )
      .subscribe({
        next: ({ comentario }) => {
          // La respuesta del POST no popula usuarioId; se completa con el perfil local
          // para que el comentario recién creado muestre su nombre y avatar de inmediato.
          this.comments = [this.withSessionAuthor(comentario), ...this.comments];
          this.total += 1;
          this.draft = '';
        },
        error: () => {
          this.actionError = 'No se pudo agregar el comentario. Inténtalo nuevamente.';
        },
      });
  }

  /** Ofrece el modo edición solo si la identidad local coincide con el autor guardado. */
  beginEdit(comment: PostComment): void {
    if (this.commentAuthorId(comment) !== this.currentUserId) {
      return;
    }
    this.editingCommentId = comment._id;
    this.editingText = comment.texto;
    this.actionError = '';
  }

  /** Descarta el texto temporal y vuelve a mostrar el comentario sin cambios. */
  cancelEdit(): void {
    this.editingCommentId = null;
    this.editingText = '';
  }

  /** Persiste la edición y reemplaza solo el elemento actualizado en la lista. */
  saveEdit(comment: PostComment): void {
    const text = this.editingText.trim();
    if (!text || !this.currentUserId || this.isSaving) {
      return;
    }

    this.isSaving = true;
    this.actionError = '';
    this.commentsService
      .updateComment(this.post._id, comment._id, this.currentUserId, text)
      .pipe(
        timeout(10000),
        finalize(() => {
          this.isSaving = false;
          this.refreshView();
        }),
      )
      .subscribe({
        next: ({ comentario }) => {
          // El backend devuelve modificado=true; la plantilla lo muestra como "Editado".
          this.comments = this.comments.map((item) =>
            item._id === comentario._id ? this.withSessionAuthor(comentario) : item,
          );
          this.cancelEdit();
        },
        error: () => {
          this.actionError = 'No se pudo editar el comentario. Inténtalo nuevamente.';
        },
      });
  }

  /** Copia el valor del textarea al estado del formulario de creación. */
  onDraftInput(event: Event): void {
    this.draft = (event.target as HTMLTextAreaElement).value;
  }

  /** Copia el valor del textarea de edición al borrador temporal correspondiente. */
  onEditInput(event: Event): void {
    this.editingText = (event.target as HTMLTextAreaElement).value;
  }

  /** Convierte el ID del autor populado o sin poblar a una cadena comparable. */
  commentAuthorId(comment: PostComment): string {
    return typeof comment.usuarioId === 'string'
      ? comment.usuarioId
      : comment.usuarioId._id;
  }

  /** Prioriza el username; si no está disponible, utiliza el nombre personal. */
  authorName(comment: PostComment): string {
    const author = this.commentAuthor(comment);
    if (author?.username) {
      return `@${author.username}`;
    }
    return [author?.nombre, author?.apellido].filter(Boolean).join(' ') || 'Usuario';
  }

  /** Devuelve avatar solo cuando el API pobló los datos del autor. */
  authorAvatar(comment: PostComment): string | undefined {
    return this.commentAuthor(comment)?.avatarUrl;
  }

  /** Usa el ID estable del comentario para que Angular conserve cada fila entre cambios. */
  trackComment(_index: number, comment: PostComment): string {
    return comment._id;
  }

  /** Notifica al componente padre para que este retire el aside del árbol visual. */
  close(): void {
    this.closed.emit();
  }

  /**
   * Carga inicial o página adicional. El requestId evita que una respuesta
   * atrasada de otro post sobrescriba el estado actual.
   */
  private loadComments(append: boolean): void {
    const requestId = ++this.loadRequestId;
    this.isLoading = true;
    this.loadError = '';
    this.changeDetectorRef.markForCheck();
    this.commentsService
      .getComments(this.post._id, append ? this.comments.length : 0, this.pageSize)
      .pipe(
        timeout(10000),
        finalize(() => this.finishLoading(requestId)),
      )
      .subscribe({
        next: (response) => {
          // Ignora respuestas viejas si el usuario cambió de publicación durante la petición.
          if (requestId !== this.loadRequestId) {
            return;
          }
          // Un HTTP 200 no garantiza que el JSON tenga la estructura esperada por la vista.
          if (!response || !Array.isArray(response.comentarios) || !Number.isFinite(response.total)) {
            this.loadError = 'El servidor devolvió una respuesta inválida.';
            this.finishLoading(requestId);
            return;
          }
          // Al paginar se concatenan filas; una recarga sustituye la lista completa.
          this.comments = append
            ? [...this.comments, ...response.comentarios]
            : response.comentarios;
          this.total = response.total;
          this.finishLoading(requestId);
        },
        error: () => {
          if (requestId === this.loadRequestId) {
            this.loadError = 'No se pudieron cargar los comentarios.';
            this.finishLoading(requestId);
          }
        },
      });
  }

  /** Finaliza solo la petición vigente para no apagar el indicador de otra carga activa. */
  private finishLoading(requestId: number): void {
    if (requestId !== this.loadRequestId) {
      return;
    }
    this.isLoading = false;
    this.changeDetectorRef.markForCheck();
  }

  /** Devuelve datos del autor solo cuando el API incluyó el objeto populado. */
  private commentAuthor(comment: PostComment): CurrentUser | undefined {
    return typeof comment.usuarioId === 'string'
      ? undefined
      : comment.usuarioId;
  }

  private withSessionAuthor(comment: PostComment): PostComment {
    const author: CommentAuthor = {
      _id: this.currentUserId,
      nombre: this.currentUser?.nombre,
      apellido: this.currentUser?.apellido,
      username: this.currentUser?.username,
      avatarUrl: this.currentUser?.avatarUrl,
    };
    return { ...comment, usuarioId: author };
  }

  /**
   * HttpClient callbacks can complete outside the template's current change
   * detection pass. Run a local check when the request settles so the new row
   * and the button's non-loading state appear without another user interaction.
   */
  private refreshView(): void {
    if (!this.destroyRef.destroyed) {
      this.changeDetectorRef.detectChanges();
    }
  }
}
