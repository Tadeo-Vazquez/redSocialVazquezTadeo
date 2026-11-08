import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface Post {
  _id: string;
  titulo: string;
  descripcion: string;
  imagenUrl?: string;
  likes?: unknown[];
  likesCount?: number;
  createdAt?: string;
}

export interface PostsListResponse {
  offset: number;
  limit: number;
  total: number;
  posts: Post[];
}

@Injectable({
  providedIn: 'root',
})
export class Posts {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:3000/posts';

  getUserPosts(usuarioId: string, limit = 3): Observable<PostsListResponse> {
    const params = new HttpParams()
      .set('usuarioId', usuarioId)
      .set('ordenar', 'fecha')
      .set('offset', '0')
      .set('limit', String(limit));

    return this.http.get<PostsListResponse>(this.apiUrl, { params });
  }
}
