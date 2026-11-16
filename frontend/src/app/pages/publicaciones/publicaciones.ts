import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { finalize, timeout } from 'rxjs';
import { Post, Posts } from '../../services/posts';
import { Session } from '../../services/session';
import { PostLikes } from '../../services/post-likes';
import { AsideNav } from '../../shared/aside-nav/aside-nav';
import { PublicacionCard } from './publicacion-card';

@Component({
  imports: [AsideNav, PublicacionCard],
  selector: 'app-publicaciones',
  styleUrl: './publicaciones.scss',
  templateUrl: './publicaciones.html',
})
export class Publicaciones implements OnInit {
  private readonly postsService = inject(Posts);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly session = inject(Session);
  private readonly postLikes = inject(PostLikes);

  @ViewChild('feedTop') private feedTop?: ElementRef<HTMLElement>;

  readonly currentUser = this.session.getCurrentUser();
  readonly pageSize = 4;
  posts: Post[] = [];
  offset = 0;
  total = 0;
  ordenar: 'fecha' | 'likes' = 'fecha';
  isLoading = false;
  loadError = '';
  actionError = '';
  readonly pendingPostIds = new Set<string>();
  readonly deletingPostIds = new Set<string>();
  private loadRequestId = 0;

  get currentUserId(): string {
    return this.currentUser?._id ?? this.currentUser?.id ?? '';
  }

  get canGoToPreviousPage(): boolean {
    return this.offset > 0 && !this.isLoading;
  }

  get canGoToNextPage(): boolean {
    return this.offset + this.pageSize < this.total && !this.isLoading;
  }

  ngOnInit(): void {
    this.loadPosts();
  }

  onSortChange(value: 'fecha' | 'likes'): void {
    if (value === this.ordenar) {
      return;
    }

    this.ordenar = value;
    this.offset = 0;
    this.loadPosts();
  }

  goToPreviousPage(): void {
    if (!this.canGoToPreviousPage) {
      return;
    }

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

  deletePost(post: Post): void {
    if (!this.currentUserId || this.deletingPostIds.has(post._id)) {
      return;
    }

    this.deletingPostIds.add(post._id);
    this.actionError = '';
    this.changeDetectorRef.markForCheck();
    this.postsService
      .deletePost(post._id, this.currentUserId)
      .pipe(
        timeout(10000),
        finalize(() => {
          this.deletingPostIds.delete(post._id);
          this.changeDetectorRef.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          this.total = Math.max(0, this.total - 1);
          if (this.posts.length === 1 && this.offset > 0) {
            this.offset = Math.max(0, this.offset - this.pageSize);
          }
          this.loadPosts();
        },
        error: () => {
          this.actionError = 'No se pudo eliminar la publicación. Inténtalo nuevamente.';
        },
      });
  }

  toggleLike(post: Post): void {
    const userId = this.currentUserId;
    if (!userId || this.pendingPostIds.has(post._id)) {
      return;
    }

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
          this.posts = this.postLikes.applyResponse(this.posts, post._id, userId, response);
        },
        error: () => {
          this.actionError = likeAction.alreadyLiked
            ? 'No se pudo quitar el me gusta. Inténtalo nuevamente.'
            : 'No se pudo registrar el me gusta. Inténtalo nuevamente.';
        },
      });
  }

  hasLiked(post: Post, userId = this.currentUserId): boolean {
    return this.postLikes.hasLiked(post, userId);
  }

  trackPost(_index: number, post: Post): string {
    return post._id;
  }

  private scrollToFeedTop(): void {
    this.feedTop?.nativeElement.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }

  private loadPosts(): void {
    const requestId = ++this.loadRequestId;
    this.isLoading = true;
    this.loadError = '';
    this.actionError = '';
    this.changeDetectorRef.markForCheck();
    this.postsService
      .getPosts(this.ordenar, this.offset, this.pageSize)
      .pipe(
        timeout({ first: 10000 }),
        finalize(() => this.finishLoading(requestId)),
      )
      .subscribe({
        next: (response) => {
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

  private finishLoading(requestId: number): void {
    if (requestId !== this.loadRequestId) {
      return;
    }

    this.isLoading = false;
    this.changeDetectorRef.markForCheck();
  }
}
