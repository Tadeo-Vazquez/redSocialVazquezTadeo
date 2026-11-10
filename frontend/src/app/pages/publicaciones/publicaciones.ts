import {
  afterNextRender,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  Injector,
  OnInit,
  ViewChild,
  inject,
  runInInjectionContext,
} from '@angular/core';
import { finalize, timeout } from 'rxjs';
import { Post, Posts } from '../../services/posts';
import { AsideNav } from '../../shared/aside-nav/aside-nav';
import { PublicacionCard } from './publicacion-card';

interface CurrentUser {
  _id?: string;
  id?: string;
  perfil?: string;
}

@Component({
  imports: [AsideNav, PublicacionCard],
  selector: 'app-publicaciones',
  styleUrl: './publicaciones.scss',
  templateUrl: './publicaciones.html',
})
export class Publicaciones implements OnInit {
  private readonly postsService = inject(Posts);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly injector = inject(Injector);

  readonly currentUser = this.readCurrentUser();
  pageSize = 3;
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
  private layoutMeasurementScheduled = false;

  @ViewChild('postsGrid') private postsGrid?: ElementRef<HTMLElement>;
  @ViewChild('pagination') private pagination?: ElementRef<HTMLElement>;
  @ViewChild('feedPage') private feedPage?: ElementRef<HTMLElement>;

  get currentUserId(): string {
    return this.currentUser?._id ?? this.currentUser?.id ?? '';
  }

  get currentPage(): number {
    return Math.floor(this.offset / this.pageSize) + 1;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.total / this.pageSize));
  }

  get canGoToPreviousPage(): boolean {
    return this.offset > 0 && !this.isLoading;
  }

  get canGoToNextPage(): boolean {
    return this.offset + this.pageSize < this.total && !this.isLoading;
  }

  ngOnInit(): void {
    this.pageSize = this.getColumnCount();
    this.loadPosts();
  }

  @HostListener('window:resize')
  onViewportResize(): void {
    this.updatePageSizeFromLayout();
  }

  onSortChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (value !== 'fecha' && value !== 'likes') {
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
    this.loadPosts();
  }

  goToNextPage(): void {
    if (!this.canGoToNextPage) {
      return;
    }

    this.offset += this.pageSize;
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

    const alreadyLiked = this.hasLiked(post, userId);
    this.pendingPostIds.add(post._id);
    this.actionError = '';
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
          this.actionError = alreadyLiked
            ? 'No se pudo quitar el me gusta. Inténtalo nuevamente.'
            : 'No se pudo registrar el me gusta. Inténtalo nuevamente.';
        },
      });
  }

  hasLiked(post: Post, userId = this.currentUserId): boolean {
    return !!userId && (post.likes ?? []).some((like) => this.likeUserId(like) === userId);
  }

  trackPost(_index: number, post: Post): string {
    return post._id;
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
        timeout(10000),
        finalize(() => {
          if (requestId === this.loadRequestId) {
            this.isLoading = false;
            this.changeDetectorRef.markForCheck();
          }
        }),
      )
      .subscribe({
        next: (response) => {
          if (requestId !== this.loadRequestId) {
            return;
          }
          this.posts = response.posts;
          this.total = response.total;
          this.scheduleLayoutMeasurement();
        },
        error: () => {
          if (requestId !== this.loadRequestId) {
            return;
          }
          this.posts = [];
          this.loadError = 'No se pudieron cargar las publicaciones.';
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

  private likeUserId(like: string | { _id?: string }): string {
    return typeof like === 'string' ? like : like._id ?? '';
  }

  private getColumnCount(): number {
    if (window.innerWidth <= 520) {
      return 1;
    }
    return window.innerWidth <= 760 ? 2 : 3;
  }

  private scheduleLayoutMeasurement(): void {
    if (this.layoutMeasurementScheduled) {
      return;
    }

    this.layoutMeasurementScheduled = true;
    runInInjectionContext(this.injector, () => {
      afterNextRender(() => {
        this.layoutMeasurementScheduled = false;
        this.updatePageSizeFromLayout();
      });
    });
  }

  private updatePageSizeFromLayout(): void {
    const grid = this.postsGrid?.nativeElement;
    const firstCard = grid?.firstElementChild;
    const pagination = this.pagination?.nativeElement;
    const feedPage = this.feedPage?.nativeElement;
    if (!(grid && firstCard instanceof HTMLElement && pagination && feedPage)) {
      return;
    }

    const gridStyles = window.getComputedStyle(grid);
    const columnGap = Number.parseFloat(gridStyles.columnGap) || 0;
    const rowGap = Number.parseFloat(gridStyles.rowGap) || 0;
    const gridWidth = grid.getBoundingClientRect().width;
    const cardWidth = firstCard.getBoundingClientRect().width;
    const cardHeight = firstCard.getBoundingClientRect().height;
    if (cardWidth <= 0 || cardHeight <= 0) {
      return;
    }
    const columns = Math.max(
      1,
      Math.floor((gridWidth + columnGap) / (cardWidth + columnGap)),
    );

    const pageStyles = window.getComputedStyle(feedPage);
    const paginationStyles = window.getComputedStyle(pagination);
    const bottomPadding = Number.parseFloat(pageStyles.paddingBottom) || 0;
    const paginationMargin = Number.parseFloat(paginationStyles.marginTop) || 0;
    const reservedPagination =
      pagination.getBoundingClientRect().height + paginationMargin;
    const availableHeight =
      window.innerHeight -
      grid.getBoundingClientRect().top -
      bottomPadding -
      reservedPagination;
    const rows = Math.max(
      1,
      Math.floor((availableHeight + rowGap) / (cardHeight + rowGap)),
    );
    const nextPageSize = Math.min(100, columns * rows);

    if (nextPageSize === this.pageSize) {
      return;
    }

    const currentPageIndex = Math.floor(this.offset / this.pageSize);
    this.pageSize = nextPageSize;
    this.offset = currentPageIndex * this.pageSize;
    this.loadPosts();
  }
}
