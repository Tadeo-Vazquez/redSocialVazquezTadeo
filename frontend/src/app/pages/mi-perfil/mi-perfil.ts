import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { finalize, timeout } from 'rxjs';
import { FormatoFechaPipe } from '../../pipes/formato-fecha.pipe';
import { AsideNav } from '../../shared/aside-nav/aside-nav';
import { Post, Posts } from '../../services/posts';
import { PublicacionCard } from '../publicaciones/publicacion-card';
import { Session } from '../../services/session';
import { PostLikes } from '../../services/post-likes';
import { CommentsAside } from '../../shared/comments-aside/comments-aside';
import { EditarPerfil } from './editar-perfil/editar-perfil';
import { CurrentUser } from '../../services/current-user';

@Component({
  imports: [FormatoFechaPipe, AsideNav, PublicacionCard, CommentsAside, EditarPerfil],
  selector: 'app-mi-perfil',
  styleUrl: './mi-perfil.scss',
  templateUrl: './mi-perfil.html',
})
export class MiPerfil implements OnInit {
  private readonly postsService = inject(Posts);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly session = inject(Session);
  private readonly postLikes = inject(PostLikes);

  currentUser = this.session.getCurrentUser();
  posts: Post[] = [];
  isLoadingPosts = false;
  postsError = '';
  likeError = '';
  selectedCommentsPost: Post | null = null;
  isEditProfileOpen = false;
  readonly pendingPostIds = new Set<string>();

  ngOnInit(): void {
    if (this.userId) {
      this.loadPosts();
    } else {
      this.isLoadingPosts = false;
      this.postsError = 'No se pudo identificar al usuario de la sesión.';
      this.changeDetectorRef.markForCheck();
    }
  }

  get userId(): string | undefined {
    return this.currentUser?._id || this.currentUser?.id;
  }

  toggleLike(post: Post): void {
    const userId = this.userId;
    if (!userId || this.pendingPostIds.has(post._id)) {
      return;
    }

    const likeAction = this.postLikes.toggle(post, userId);
    this.pendingPostIds.add(post._id);
    this.likeError = '';
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
          this.posts = this.postLikes.applyResponse(this.posts, post._id, userId, response);
        },
        error: () => {
          this.likeError = likeAction.alreadyLiked
            ? 'No se pudo quitar el me gusta. Inténtalo nuevamente.'
            : 'No se pudo registrar el me gusta. Inténtalo nuevamente.';
        },
      });
  }

  hasLiked(post: Post, userId = this.userId ?? ''): boolean {
    return this.postLikes.hasLiked(post, userId);
  }

  openComments(post: Post): void {
    this.selectedCommentsPost = post;
  }

  closeComments(): void {
    this.selectedCommentsPost = null;
  }

  openEditProfile(): void {
    this.isEditProfileOpen = true;
  }

  closeEditProfile(): void {
    this.isEditProfileOpen = false;
  }

  onProfileUpdated(user: CurrentUser): void {
    // Mantiene consistente la tarjeta del perfil y los datos usados al navegar por la app.
    this.currentUser = user;
    this.session.setCurrentUser(user);
    this.isEditProfileOpen = false;
  }

  private loadPosts(): void {
    const userId = this.userId;
    if (!userId) {
      this.isLoadingPosts = false;
      return;
    }

    this.isLoadingPosts = true;
    this.postsError = '';
    this.changeDetectorRef.markForCheck();
    this.postsService
      .getUserPosts(userId, 3)
      .pipe(
        timeout(8000),
        finalize(() => {
          this.isLoadingPosts = false;
          this.changeDetectorRef.markForCheck();
        }),
      )
      .subscribe({
        next: (response) => {
          this.posts = response.posts.slice(0, 3);
        },
        error: () => {
          this.posts = [];
          this.postsError = 'No se pudieron cargar tus publicaciones.';
        },
      });
  }
}
