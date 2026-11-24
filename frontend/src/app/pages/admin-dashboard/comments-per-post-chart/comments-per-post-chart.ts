import { Component, Input } from '@angular/core';
import { CommentsPerPost } from '../../../services/statistics';

/** Gráfico de torta (donut) con la distribución de comentarios por publicación. */
@Component({
  selector: 'app-comments-per-post-chart',
  templateUrl: './comments-per-post-chart.html',
  styleUrl: '../dashboard-shared.scss',
})
export class CommentsPerPostChart {
  // items identifica cada publicación y su cantidad; total se muestra en el centro.
  @Input({ required: true }) items: CommentsPerPost[] = [];
  @Input({ required: true }) total = 0;

  /**
   * Construye un gradiente circular para representar la proporción de
   * comentarios por publicación. Los porcentajes se calculan sobre la suma de
   * items; total es el valor recibido aparte para mostrar en el centro.
   * Sin comentarios se usa un fondo uniforme.
   */
  get chartBackground(): string {
    const total = this.items.reduce((sum, item) => sum + item.cantidad, 0);
    if (!total) return 'conic-gradient(#2c2940 0 100%)';
    // Cada segmento empieza donde terminó el anterior para cubrir el círculo
    // de forma continua, desde 0 % hasta aproximadamente 100 %.
    let start = 0;
    const segments = this.items.map((item, index) => {
      const end = start + (item.cantidad / total) * 100;
      const segment = `${this.chartColor(index)} ${start}% ${end}%`;
      start = end;
      return segment;
    });
    return `conic-gradient(${segments.join(', ')})`;
  }

  /** Reutiliza la paleta al superar su longitud para que todos tengan color. */
  chartColor(index: number): string {
    const colors = ['#a78bfa', '#f472b6', '#38bdf8', '#34d399', '#fbbf24', '#fb7185', '#818cf8'];
    return colors[index % colors.length];
  }
}
