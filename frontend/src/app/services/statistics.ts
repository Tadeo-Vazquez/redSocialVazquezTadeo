import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { forkJoin } from 'rxjs';
import { API_URL } from '../config/api-url.generated';

// Cada fila identifica al autor y la cantidad de publicaciones activas
// creadas en el intervalo consultado.
export interface PostsPerUser {
  usuarioId: string;
  nombre?: string;
  apellido?: string;
  username?: string;
  cantidad: number;
}

// Cada fila representa los comentarios del intervalo para una publicación activa.
export interface CommentsPerPost {
  publicacionId: string;
  titulo: string;
  cantidad: number;
}

@Injectable({ providedIn: 'root' })
export class Statistics {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/statistics`;

  /**
   * Consulta las tres estadísticas con el mismo rango. Los extremos vacíos se
   * omiten, por lo que el servidor no aplica ese límite de fecha.
   */
  getStatistics(from: string, to: string) {
    // HttpParams es inmutable: set devuelve una nueva instancia, que se
    // reasigna para conservar los parámetros agregados.
    let params = new HttpParams();
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);

    // forkJoin ejecuta las peticiones y emite una sola respuesta cuando todas
    // terminan. Si alguna falla, comunica el error y cancela las pendientes;
    // así el panel no mezcla gráficos de rangos distintos.
    return forkJoin({
      posts: this.http.get<PostsPerUser[]>(`${this.url}/posts-per-user`, { params }),
      comments: this.http.get<{ total: number }>(`${this.url}/comments`, { params }),
      perPost: this.http.get<CommentsPerPost[]>(`${this.url}/comments-per-post`, { params }),
    });
  }
}
