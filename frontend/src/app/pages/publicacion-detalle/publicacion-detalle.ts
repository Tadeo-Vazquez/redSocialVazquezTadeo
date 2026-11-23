import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { finalize, timeout } from 'rxjs';
import { TimeAgoPipe } from '../../pipes/time-ago.pipe';
import { EscapeHtmlPipe } from '../../pipes/escape-html.pipe';
import { Post, Posts } from '../../services/posts';
import { PostLikes } from '../../services/post-likes';
import { Session } from '../../services/session';
import { AsideNav } from '../../shared/aside-nav/aside-nav';
import { CommentsAside } from '../../shared/comments-aside/comments-aside';
import { ConfirmDialog, ConfirmDialogData } from '../../shared/confirm-dialog/confirm-dialog';
import { PublicacionImageDialog } from './image-dialog/publicacion-image-dialog';

@Component({
  imports: [AsideNav, CommentsAside, TimeAgoPipe, EscapeHtmlPipe, MatDialogModule, RouterLink],
  selector: 'app-publicacion-detalle',
  styleUrl: './publicacion-detalle.scss',
  templateUrl: './publicacion-detalle.html',
})
/**
 * Coordina la carga de una publicación y sus interacciones en la vista detalle.
 * Los comentarios se delegan al componente CommentsAside para mantener una
 * sola implementación del panel, tanto aquí como en el perfil.
 */
export class PublicacionDetalle implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly postsService = inject(Posts);
  private readonly session = inject(Session);
  private readonly postLikes = inject(PostLikes);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private confirmationOpen = false;

  // Se conserva el usuario de sesión para identificar sus "me gusta" y enviar su ID al API.
  readonly currentUser = this.session.getCurrentUser();
  // El template usa null para distinguir una carga pendiente de una publicación disponible.
  post: Post | null = null;
  isLoading = true;
  isLikePending = false;
  isDeletePending = false;
  loadError = '';
  actionError = '';

  get currentUserId(): string {
    // Algunas respuestas antiguas usan id y otras _id; normalizarlo aquí evita
    // repetir esa compatibilidad en cada interacción de la vista.
    return this.currentUser?._id ?? this.currentUser?.id ?? '';
  }

  get authorName(): string {
    const user = this.post?.usuario;
    if (user?.username) {
      return `@${user.username}`;
    }
    return [user?.nombre, user?.apellido].filter(Boolean).join(' ') || 'Usuario';
  }

  get authorInitial(): string {
    // Se deriva una inicial del nombre ya formateado para reutilizar la misma
    // regla de presentación tanto con username como con nombre y apellido.
    return this.authorName.replace(/^@/, '').charAt(0).toUpperCase() || 'U';
  }

  get hasLiked(): boolean {
    return !!this.post && this.postLikes.hasLiked(this.post, this.currentUserId);
  }

  get likesCount(): number {
    return this.post?.likesCount ?? this.post?.likes?.length ?? 0;
  }

  openImageDialog(): void {
    const post = this.post;
    // El diálogo necesita una imagen real; si no hay publicación o URL, no se abre.
    if (!post?.imagenUrl) {
      return;
    }

    this.dialog.open(PublicacionImageDialog, {
      data: { imageUrl: post.imagenUrl, imageAlt: post.titulo },
      ariaLabel: `Imagen ampliada de ${post.titulo}`,
      autoFocus: false,
      maxWidth: '96vw',
      maxHeight: '96dvh',
      panelClass: 'publication-image-dialog-panel',
      backdropClass: 'publication-image-dialog-backdrop',
    });
  }

  /** La ruta ya contiene el ID; al iniciar la pantalla, comienza la consulta puntual. */
  ngOnInit(): void {
    this.loadPost();
  }

  /** Repite la misma consulta tras un error, evitando iniciar duplicados mientras carga. */
  retryLoad(): void {
    if (!this.isLoading) {
      this.loadPost();
    }
  }

  /** El modal solo devuelve la decisión; esta vista decide si envía la baja. */
  confirmDeletePost(): void {
    const post = this.post;
    // El control de rol limita la interfaz; el backend verifica la autorización real.
    if (!post || this.currentUser?.perfil !== 'administrador' || this.isDeletePending || this.confirmationOpen) {
      return;
    }

    this.confirmationOpen = true;
    this.dialog.open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, {
      data: {
        title: '¿Eliminar publicación?',
        message: `Se ocultará la publicación "${post.titulo}" y sus comentarios.`,
        confirmLabel: 'Eliminar',
        destructive: true,
      },
      width: '420px',
      maxWidth: '90vw',
      role: 'alertdialog',
      autoFocus: 'first-tabbable',
    }).afterClosed().pipe(
      // Al abandonar la pantalla no debe ejecutarse una decisión tardía del modal.
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((confirmed) => {
      this.confirmationOpen = false;
      if (confirmed === true) {
        this.deletePost(post);
      }
    });
  }

  private deletePost(post: Post): void {
    this.isDeletePending = true;
    this.actionError = '';
    this.changeDetectorRef.markForCheck();
    this.postsService.deletePost(post._id).pipe(
      timeout(10000),
      takeUntilDestroyed(this.destroyRef),
      // Se libera el botón tanto si la API falla como si vence el tiempo de espera.
      finalize(() => {
        this.isDeletePending = false;
        this.changeDetectorRef.markForCheck();
      }),
    ).subscribe({
      // La publicación ya no está disponible en detalle: volver al listado.
      next: () => { void this.router.navigate(['/publicaciones']); },
      error: () => {
        this.actionError = 'No se pudo eliminar la publicación. Inténtalo nuevamente.';
      },
    });
  }

  private loadPost(): void {
    // El ID de ruta es el vínculo entre la tarjeta, el endpoint /posts/:id y esta pantalla.
    const postId = this.route.snapshot.paramMap.get('id');
    if (!postId) {
      this.isLoading = false;
      this.loadError = 'No se encontró el identificador de la publicación.';
      return;
    }

    this.isLoading = true;
    this.loadError = '';
    this.changeDetectorRef.markForCheck();
    // El timeout evita dejar la interfaz bloqueada indefinidamente si la API no responde.
    this.postsService
      .getPostById(postId)
      .pipe(
        timeout(10000),
        // El indicador debe liberarse incluso al agotarse el tiempo de espera.
        finalize(() => {
          this.isLoading = false;
          this.changeDetectorRef.markForCheck();
        }),
      )
      .subscribe({
        next: (post) => {
          // Verificar la respuesta evita renderizar un recurso inesperado como si fuera el solicitado.
          if (!post || post._id !== postId) {
            this.loadError = 'El servidor devolvió una publicación inválida.';
            return;
          }
          this.post = post;
        },
        error: () => {
          this.loadError = 'No se pudo cargar la publicación.';
        },
      });
  }

  /**
   * Reutiliza el servicio común de likes. La respuesta del servidor actualiza
   * localmente el conteo y el estado del botón, sin recargar la publicación.
   */
  toggleLike(): void {
    const post = this.post;
    const userId = this.currentUserId;
    // No se puede mutar sin una publicación cargada o una sesión identificable;
    // el bloqueo adicional evita enviar varias acciones simultáneas.
    if (!post || !userId || this.isLikePending) {
      return;
    }

    const likeAction = this.postLikes.toggle(post, userId);
    this.isLikePending = true;
    this.actionError = '';
    likeAction.request
      .pipe(
        timeout(10000),
        finalize(() => {
          this.isLikePending = false;
          this.changeDetectorRef.markForCheck();
        }),
      )
      .subscribe({
        next: (response) => {
          // applyResponse mantiene en un solo lugar la lógica para agregar/quitar el ID del usuario.
          this.post = this.postLikes.applyResponse([post], post._id, userId, response)[0];
        },
        error: () => {
          this.actionError = likeAction.alreadyLiked
            ? 'No se pudo quitar el me gusta. Inténtalo nuevamente.'
            : 'No se pudo registrar el me gusta. Inténtalo nuevamente.';
        },
      });
  }

}
