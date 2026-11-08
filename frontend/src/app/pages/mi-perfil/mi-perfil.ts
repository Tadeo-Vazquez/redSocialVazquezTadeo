import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { finalize, timeout } from 'rxjs';
import { FormatoFechaPipe } from '../../pipes/formato-fecha.pipe';
import { AsideNav } from '../../shared/aside-nav/aside-nav';
import { Post, Posts } from '../../services/posts';

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
  imports: [FormatoFechaPipe, AsideNav],
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

  ngOnInit(): void {
    if (this.userId) {
      this.loadPosts();
    } else {
      this.isLoadingPosts = false;
      this.postsError = 'No se pudo identificar al usuario de la sesión.';
      this.changeDetectorRef.markForCheck();
    }
  }

  private get userId(): string | undefined {
    return this.currentUser?._id || this.currentUser?.id;
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
