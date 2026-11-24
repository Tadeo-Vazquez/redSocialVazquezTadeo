import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { CommentsPerDay, CommentsPerPost, PostsPerUser, Statistics } from '../../../services/statistics';
import { CommentsPerPostChart } from '../comments-per-post-chart/comments-per-post-chart';
import { CommentsTimeline, buildCommentsTimeline } from '../comments-timeline';
import { CommentsTimelineChart } from '../comments-timeline-chart/comments-timeline-chart';
import { notAfterToday, todayLocalDate, validRangeDate } from '../date-range.validators';
import { PostsPerUserChart } from '../posts-per-user-chart/posts-per-user-chart';

/**
 * Formulario de rango de fechas y carga de las tres métricas. Los datos se
 * entregan a los gráficos hijos, que solo se ocupan de dibujarlos.
 */
@Component({
  imports: [ReactiveFormsModule, PostsPerUserChart, CommentsTimelineChart, CommentsPerPostChart],
  selector: 'app-statistics-panel',
  templateUrl: './statistics-panel.html',
  styleUrl: '../dashboard-shared.scss',
})
export class StatisticsPanel implements OnInit {
  private readonly statisticsService = inject(Statistics);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  // Los límites opcionales se comparten entre los tres gráficos; un valor vacío
  // significa que no se solicita ese extremo al backend.
  readonly rangeForm = new FormGroup({
    from: new FormControl('', { nonNullable: true, validators: [validRangeDate, notAfterToday] }),
    to: new FormControl('', { nonNullable: true, validators: [validRangeDate] }),
  });
  // El calendario usa el día local del navegador, incluso si el panel sigue abierto al cambiar de día.
  get today(): string {
    return todayLocalDate();
  }
  // Los navegadores pueden entregar una cadena vacía mientras el usuario
  // escribe una fecha incompleta; badInput permite distinguirla de un campo vacío.
  invalidDateInputs = { from: false, to: false };
  loadingStatistics = false;
  statisticsError = '';
  hasStatistics = false;
  posts: PostsPerUser[] = [];
  commentsTotal = 0;
  commentsDays: CommentsPerDay[] = [];
  commentsTimeline: CommentsTimeline | null = null;
  commentsPerPost: CommentsPerPost[] = [];
  // Identifica la última solicitud válida. Una respuesta anterior no debe
  // sobrescribir resultados de un rango consultado después.
  private statisticsRequestId = 0;

  /** Al crearse el panel (primera vez que se abre la pestaña) carga las métricas. */
  ngOnInit(): void {
    this.loadStatistics();
  }
  /** Registra si el navegador considera inválido el texto que hay en un input de fecha. */
  onRangeDateInput(field: 'from' | 'to', input: HTMLInputElement): void {
    this.invalidDateInputs[field] =
      input.validity.badInput || input.validity.rangeUnderflow || input.validity.rangeOverflow;
    this.statisticsError = '';
  }

  /**
   * Solicita las tres métricas usando el rango elegido y reemplaza los datos
   * del panel únicamente cuando se completa la solicitud más reciente.
   */
  loadStatistics(): void {
    this.rangeForm.markAllAsTouched();
    // Revalidar al enviar contempla que la fecha actual haya cambiado desde la última edición.
    this.rangeForm.controls.from.updateValueAndValidity();
    const { from, to } = this.rangeForm.getRawValue();
    if (this.rangeForm.invalid || this.invalidDateInputs.from || this.invalidDateInputs.to) {
      this.statisticsRequestId++;
      this.loadingStatistics = false;
      this.hasStatistics = false;
      this.statisticsError = '';
      return;
    }
    // Los inputs de fecha entregan YYYY-MM-DD, formato cuyo orden de texto
    // coincide con el cronológico. Si el rango es inválido, incrementar el ID
    // también impide mostrar una respuesta que aún estuviera en camino.
    if (from && to && from > to) {
      this.statisticsRequestId++;
      this.loadingStatistics = false;
      this.hasStatistics = false;
      this.statisticsError = 'La fecha de inicio no puede ser posterior a la fecha de fin.';
      return;
    }
    // Cada carga obtiene una identidad propia para descartar respuestas viejas
    // cuando se solicita otro rango antes de que termine el anterior.
    const requestId = ++this.statisticsRequestId;
    this.loadingStatistics = true;
    this.statisticsError = '';
    this.statisticsService
      .getStatistics(from, to)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          if (requestId === this.statisticsRequestId) {
            this.loadingStatistics = false;
            this.changeDetector.markForCheck();
          }
        }),
      )
      .subscribe({
        next: (result) => {
          if (requestId !== this.statisticsRequestId) return;
          if (!Array.isArray(result.comments?.porDia)) {
            this.hasStatistics = false;
            this.statisticsError = 'No se pudo mostrar la evolución de comentarios. Intentá nuevamente.';
            this.changeDetector.markForCheck();
            return;
          }
          this.posts = result.posts;
          this.commentsTotal = result.comments.total;
          this.commentsDays = result.comments.porDia;
          this.commentsTimeline = buildCommentsTimeline(this.commentsDays, from, to);
          this.commentsPerPost = result.perPost;
          this.hasStatistics = true;
          this.changeDetector.markForCheck();
        },
        error: (error: unknown) => {
          if (requestId !== this.statisticsRequestId) return;
          this.hasStatistics = false;
          this.statisticsError =
            error instanceof HttpErrorResponse && error.status === 403
              ? 'No tenés permiso para consultar las estadísticas.'
              : 'No se pudieron cargar las estadísticas. Revisá las fechas e intentá nuevamente.';
          this.changeDetector.markForCheck();
        },
      });
  }
}
