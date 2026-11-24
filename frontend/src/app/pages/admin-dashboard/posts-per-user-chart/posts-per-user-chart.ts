import { Component, Input } from '@angular/core';
import { PostsPerUser } from '../../../services/statistics';

/** Gráfico de barras horizontales con las publicaciones de cada usuario. */
@Component({
  selector: 'app-posts-per-user-chart',
  templateUrl: './posts-per-user-chart.html',
  styleUrl: '../dashboard-shared.scss',
})
export class PostsPerUserChart {
  // Cada entrada aporta usuarioId, nombre/username y cantidad de publicaciones.
  @Input({ required: true }) posts: PostsPerUser[] = [];

  /**
   * Escala las barras respecto de la mayor cantidad. El mínimo 1 evita dividir
   * por cero cuando no hay datos o todos los valores son cero.
   */
  get maxPosts(): number {
    return Math.max(1, ...this.posts.map((item) => item.cantidad));
  }
}
