import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../config/api-url.generated';

export interface CommentAuthor {
  _id: string;
  nombre?: string;
  apellido?: string;
  username?: string;
  avatarUrl?: string;
}

/** Forma que devuelve el API; usuarioId puede ser el ID simple o el autor populado. */
export interface PostComment {
  _id: string;
  publicacionId: string;
  usuarioId: string | CommentAuthor;
  texto: string;
  modificado: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** Metadatos de paginación que acompañan cada página de comentarios. */
export interface CommentsListResponse {
  publicacionId: string;
  desplazamiento: number;
  limite: number;
  total: number;
  comentarios: PostComment[];
}

/** Respuesta común del API al crear o editar un comentario. */
export interface CommentResponse {
  mensaje: string;
  comentario: PostComment;
}

@Injectable({
  providedIn: 'root',
})
export class Comments {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${API_URL}/posts`;

  /**
   * Solicita una página de comentarios de una publicación.
   * El offset indica cuántos ya se mostraron y el límite acota el trabajo del
   * servidor y el contenido inicial; el total permite decidir si hay más.
   */
  getComments(
    postId: string,
    offset: number,
    limit: number,
  ): Observable<CommentsListResponse> {
    const params = new HttpParams()
      .set('offset', String(offset))
      .set('limit', String(limit));

    return this.http.get<CommentsListResponse>(
      `${this.apiUrl}/${postId}/comments`,
      { params },
    );
  }

  /** Envía texto y autor al endpoint de creación y recibe el comentario guardado. */
  createComment(postId: string, usuarioId: string, texto: string): Observable<CommentResponse> {
    return this.http.post<CommentResponse>(`${this.apiUrl}/${postId}/comments`, {
      usuarioId,
      texto,
    });
  }

  /**
   * Actualiza un comentario concreto dentro de la publicación indicada.
   * El backend coteja el comentario, la publicación y el usuario indicados;
   * la interfaz además solo presenta esta acción al autor de la sesión local.
   */
  updateComment(
    postId: string,
    commentId: string,
    usuarioId: string,
    texto: string,
  ): Observable<CommentResponse> {
    return this.http.put<CommentResponse>(
      `${this.apiUrl}/${postId}/comments/${commentId}`,
      { usuarioId, texto },
    );
  }
}
