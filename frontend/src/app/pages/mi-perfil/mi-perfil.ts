import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { finalize, timeout } from 'rxjs';
import { FormatoFechaPipe } from '../../pipes/formato-fecha.pipe';
import { AsideNav } from '../../shared/aside-nav/aside-nav';
import { Post, Posts } from '../../services/posts';
import { PublicacionCard } from '../publicaciones/publicacion-card';

interface CurrentUser {
  _id?: string;
  id?: string;
  nombre?: string;
  apellido?: string;
  email?: string;
  username?: string;
  fechaNacimiento?: string;
  descripcionBreve?: string;
  avatarUrl?: string;
}

@Component({
  imports: [FormatoFechaPipe, AsideNav, PublicacionCard],
  selector: 'app-mi-perfil',
  styleUrl: './mi-perfil.scss',
  templateUrl: './mi-perfil.html',
})
export class MiPerfil implements OnInit {
  private readonly postsService = inject(Posts);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);

  readonly currentUser = this.readCurrentUser();
  posts: Post[] = [];
  isLoadingPosts = false;
  postsError = '';
  likeError = '';
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

    const alreadyLiked = this.hasLiked(post, userId);
    this.pendingPostIds.add(post._id);
    this.likeError = '';
    this.changeDetectorRef.markForCheck();

    const action = alreadyLiked
      ? this.postsService.removeLike(post._id, userId)
      : this.postsService.addLike(post._id, userId);

    action
      .pipe(
        timeout(10000),
        finalize(() => {
          this.pendingPostIds.delete(post._id);
          this.changeDetectorRef.markForCheck();
        }),
      )
      .subscribe({
        next: (response) => {
          this.posts = this.posts.map((item) => {
            if (item._id !== post._id) {
              return item;
            }

            const likes = (item.likes ?? []).filter(
              (like) => this.likeUserId(like) !== userId,
            );
            if (response.likedByUser) {
              likes.push(userId);
            }

            return { ...item, likes, likesCount: response.likes };
          });
        },
        error: () => {
          this.likeError = alreadyLiked
            ? 'No se pudo quitar el me gusta. Inténtalo nuevamente.'
            : 'No se pudo registrar el me gusta. Inténtalo nuevamente.';
        },
      });
  }

  hasLiked(post: Post, userId = this.userId ?? ''): boolean {
    return !!userId && (post.likes ?? []).some((like) => this.likeUserId(like) === userId);
  }

  private likeUserId(like: string | { _id?: string }): string {
    return typeof like === 'string' ? like : like._id ?? '';
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

  private readCurrentUser(): CurrentUser | null {
    try {
      const storedUser = sessionStorage.getItem('currentUser');
      return storedUser ? (JSON.parse(storedUser) as CurrentUser) : null;
    } catch {
      return null;
    }
  }
}
