import { Component, Input } from '@angular/core';
import { CommentsPerDay } from '../../../services/statistics';
import { CommentsTimeline, formatTimelineDate } from '../comments-timeline';

/** Muestra el total de comentarios y su evolución diaria en una línea de tiempo SVG. */
@Component({
  selector: 'app-comments-timeline-chart',
  templateUrl: './comments-timeline-chart.html',
  styleUrl: '../dashboard-shared.scss',
})
export class CommentsTimelineChart {
  @Input({ required: true }) total = 0;
  @Input({ required: true }) days: CommentsPerDay[] = [];
  // Ya calculada por el padre, que conoce el rango elegido; null si no hay datos.
  @Input({ required: true }) series: CommentsTimeline | null = null;

  formatCommentsDate(date: string): string {
    return formatTimelineDate(date);
  }
}
