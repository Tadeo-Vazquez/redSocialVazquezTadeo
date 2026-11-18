import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { finalize, timeout } from 'rxjs';
import { TimeAgoPipe } from '../../pipes/time-ago.pipe';
import { Post, Posts } from '../../services/posts';
import { PostLikes } from '../../services/post-likes';
import { Session } from '../../services/session';
import { AsideNav } from '../../shared/aside-nav/aside-nav';
import { CommentsAside } from '../../shared/comments-aside/comments-aside';
import { PublicacionImageDialog } from './image-dialog/publicacion-image-dialog';

@Component({
  imports: [AsideNav, CommentsAside, TimeAgoPipe, MatDialogModule, RouterLink],
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
  private readonly postsService = inject(Posts);
  private readonly session = inject(Session);
  private readonly postLikes = inject(PostLikes);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly dialog = inject(MatDialog);

  // Se conserva el usuario de sesión para identificar sus "me gusta" y enviar su ID al API.
  readonly currentUser = this.session.getCurrentUser();
  // El template usa null para distinguir una carga pendiente de una publicación disponible.
  post: Post | null = null;
  isLoading = true;
  isLikePending = false;
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
