import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../config/api-url.generated';

export interface Post {
  _id: string;
  usuarioId: string;
  titulo: string;
  descripcion: string;
  imagenUrl?: string;
  imagenPublicId?: string;
  likes?: Array<string | { _id?: string }>;
  likesCount?: number;
  createdAt?: string;
  usuario?: {
    _id: string;
    nombre?: string;
    apellido?: string;
    username?: string;
    avatarUrl?: string;
  };
}

export interface PostsListResponse {
  offset: number;
  limit: number;
  total: number;
  posts: Post[];
}

export interface CreatePostResponse {
  message: string;
  post: Post;
}

@Injectable({
  providedIn: 'root',
})
export class Posts {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${API_URL}/posts`;

  createPost(data: FormData): Observable<CreatePostResponse> {
    return this.http.post<CreatePostResponse>(this.apiUrl, data);
  }

  getUserPosts(usuarioId: string, limit = 3): Observable<PostsListResponse> {
    const params = new HttpParams()
      .set('usuarioId', usuarioId)
      .set('ordenar', 'fecha')
      .set('offset', '0')
      .set('limit', String(limit));

    return this.http.get<PostsListResponse>(this.apiUrl, { params });
  }

  getPosts(
    ordenar: 'fecha' | 'likes',
    offset: number,
    limit: number,
  ): Observable<PostsListResponse> {
    const params = new HttpParams()
      .set('ordenar', ordenar)
      .set('offset', String(offset))
      .set('limit', String(limit));

    return this.http.get<PostsListResponse>(this.apiUrl, { params });
  }

  addLike(postId: string, usuarioId: string): Observable<LikeActionResponse> {
    const params = new HttpParams().set('usuarioId', usuarioId);
    return this.http.post<LikeActionResponse>(
      `${this.apiUrl}/${postId}/likes`,
      {},
      { params },
    );
  }

  removeLike(postId: string, usuarioId: string): Observable<LikeActionResponse> {
    const params = new HttpParams().set('usuarioId', usuarioId);
    return this.http.delete<LikeActionResponse>(
      `${this.apiUrl}/${postId}/likes`,
      { params },
    );
  }

  deletePost(postId: string, usuarioId: string): Observable<unknown> {
    const params = new HttpParams().set('usuarioId', usuarioId);
    return this.http.delete(`${this.apiUrl}/${postId}`, { params });
  }
}

export interface LikeActionResponse {
  message: string;
  likes: number;
  likedByUser: boolean;
}
