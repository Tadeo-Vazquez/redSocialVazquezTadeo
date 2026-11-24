import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_URL } from '../../../config/api-url.generated';
import { StatisticsPanel } from './statistics-panel';

describe('Panel de estadísticas del dashboard', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatisticsPanel],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  // El panel consulta al crearse, por lo que el rango se fija antes del primer detectChanges.
  function createPanel(range?: { from: string; to: string }) {
    const fixture = TestBed.createComponent(StatisticsPanel);
    if (range) fixture.componentInstance.rangeForm.setValue(range);
    fixture.detectChanges();
    return fixture;
  }

  function flushStatistics(
    posts: unknown = [],
    comments: unknown = { total: 0, porDia: [] },
    perPost: unknown = [],
  ) {
    http.expectOne((req) => req.url.endsWith('/statistics/posts-per-user')).flush(posts as object);
    http.expectOne((req) => req.url.endsWith('/statistics/comments')).flush(comments as object);
    http.expectOne((req) => req.url.endsWith('/statistics/comments-per-post')).flush(perPost as object);
  }

  function showEmptyPanel() {
    const fixture = createPanel();
    flushStatistics();
    fixture.detectChanges();
    return fixture;
  }

  it('consulta los tres gráficos con el mismo rango y rechaza rangos invertidos', () => {
    const fixture = createPanel({ from: '2026-01-01', to: '2026-01-31' });
    const component = fixture.componentInstance;
    for (const [path, body] of [
      ['posts-per-user', [{ usuarioId: 'user1', username: 'ana', cantidad: 2 }]],
      ['comments', { total: 3, porDia: [{ fecha: '2026-01-02', cantidad: 3 }] }],
      ['comments-per-post', [{ publicacionId: 'post1', titulo: 'Hola', cantidad: 3 }]],
    ] as const) {
      const request = http.expectOne((req) => req.url === `${API_URL}/statistics/${path}`);
      expect(request.request.params.get('from')).toBe('2026-01-01');
      expect(request.request.params.get('to')).toBe('2026-01-31');
      request.flush(body);
    }
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('@ana');
    expect(fixture.nativeElement.textContent).toContain('Hola');
    expect(component.commentsTotal).toBe(3);
    component.rangeForm.setValue({ from: '2026-02-01', to: '2026-01-01' });
    component.loadStatistics();
    expect(component.statisticsError).toContain('posterior');
    expect(component.hasStatistics).toBe(false);
    http.expectNone((req) => req.url.includes('/statistics/'));
  });

  it('representa cantidades diarias, días sin actividad y extremos del rango', () => {
    const fixture = createPanel({ from: '2026-01-01', to: '2026-01-10' });
    flushStatistics([], {
      total: 7,
      porDia: [
        { fecha: '2026-01-02', cantidad: 2 },
        { fecha: '2026-01-05', cantidad: 4 },
        { fecha: '2026-01-06', cantidad: 1 },
      ],
    });
    fixture.detectChanges();

    const timeline = fixture.componentInstance.commentsTimeline!;
    expect(timeline.points.map((point) => [point.fecha, point.cantidad])).toEqual([
      ['2026-01-01', 0], ['2026-01-02', 2], ['2026-01-03', 0],
      ['2026-01-04', 0], ['2026-01-05', 4], ['2026-01-06', 1],
      ['2026-01-07', 0], ['2026-01-10', 0],
    ]);
    expect(timeline.points[0].x).toBe(8);
    expect(timeline.points[7].x).toBe(592);
    expect(timeline.points[4].y).toBe(8);
    expect(timeline.points[0].y).toBe(192);
    expect(fixture.nativeElement.querySelector('.timeline-line').getAttribute('points')).toBe(timeline.line);
    expect(fixture.nativeElement.querySelector('.total-graphic').textContent).toContain('7');
    expect(fixture.nativeElement.querySelector('.timeline-details').textContent).toContain('05/01/2026: 4');
  });

  it('muestra un punto si el rango abarca un único día', () => {
    const fixture = createPanel({ from: '2026-01-01', to: '2026-01-01' });
    flushStatistics([], { total: 2, porDia: [{ fecha: '2026-01-01', cantidad: 2 }] });
    fixture.detectChanges();
    expect(fixture.componentInstance.commentsTimeline?.points).toEqual([
      { fecha: '2026-01-01', cantidad: 2, x: 300, y: 8 },
    ]);
    expect(fixture.nativeElement.querySelectorAll('.timeline-point').length).toBe(1);
  });

  it('usa la primera y última fecha con actividad si no se eligen límites', () => {
    const component = createPanel().componentInstance;
    flushStatistics([], {
      total: 3,
      porDia: [{ fecha: '2024-02-28', cantidad: 1 }, { fecha: '2024-03-01', cantidad: 2 }],
    });
    expect(component.commentsTimeline?.start).toBe('28/02/2024');
    expect(component.commentsTimeline?.end).toBe('01/03/2024');
    expect(component.commentsTimeline?.points.map((point) => [point.fecha, point.cantidad])).toEqual([
      ['2024-02-28', 1], ['2024-02-29', 0], ['2024-03-01', 2],
    ]);
  });

  it('informa si el servidor no devuelve la serie diaria', () => {
    const fixture = createPanel();
    flushStatistics([], { total: 1 });
    fixture.detectChanges();
    expect(fixture.componentInstance.hasStatistics).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('No se pudo mostrar la evolución de comentarios');
  });

  it.each([
    ['from', '2026-02-30', 'inicio'],
    ['to', '0000-01-01', 'fin'],
  ] as const)(
    'rechaza fechas imposibles en %s antes de consultar el servidor',
    (field, value, label) => {
      const fixture = showEmptyPanel();
      const component = fixture.componentInstance;
      component.rangeForm.controls[field].setValue(value);
      component.loadStatistics();
      fixture.changeDetectorRef.markForCheck();
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain(`Ingresá una fecha de ${label} válida.`);
      expect(fixture.nativeElement.querySelector(`[formcontrolname="${field}"]`)
        .getAttribute('aria-invalid')).toBe('true');
      http.expectNone((req) => req.url.includes('/statistics/'));
    },
  );

  it('rechaza una fecha incompleta que el navegador interpreta como entrada inválida', () => {
    const fixture = showEmptyPanel();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('[formcontrolname="from"]');
    Object.defineProperty(input, 'validity', {
      configurable: true,
      value: { badInput: true, rangeUnderflow: false, rangeOverflow: false },
    });
    input.dispatchEvent(new Event('input'));
    fixture.componentInstance.loadStatistics();
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Ingresá una fecha de inicio válida.');
    http.expectNone((req) => req.url.includes('/statistics/'));
  });

  it('rechaza una fecha de inicio futura y permite volver a consultar con la fecha de hoy', () => {
    const fixture = showEmptyPanel();
    const component = fixture.componentInstance;
    const input: HTMLInputElement = fixture.nativeElement.querySelector('[formcontrolname="from"]');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowText = [
      String(tomorrow.getFullYear()).padStart(4, '0'),
      String(tomorrow.getMonth() + 1).padStart(2, '0'),
      String(tomorrow.getDate()).padStart(2, '0'),
    ].join('-');

    expect(input.max).toBe(component.today);
    input.value = tomorrowText;
    input.dispatchEvent(new Event('input'));
    component.loadStatistics();
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('La fecha de inicio no puede ser posterior a hoy.');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('from-date-error');
    http.expectNone((req) => req.url.includes('/statistics/'));

    input.value = component.today;
    input.dispatchEvent(new Event('input'));
    component.rangeForm.controls.to.setValue(tomorrowText);
    component.loadStatistics();
    for (const [path, body] of [
      ['posts-per-user', []],
      ['comments', { total: 0, porDia: [] }],
      ['comments-per-post', []],
    ] as const) {
      const request = http.expectOne((req) => req.url === `${API_URL}/statistics/${path}`);
      expect(request.request.params.get('from')).toBe(component.today);
      expect(request.request.params.get('to')).toBe(tomorrowText);
      request.flush(body);
    }
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    expect(input.getAttribute('aria-invalid')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('La fecha de inicio no puede ser posterior a hoy.');
  });

  it('permite un solo extremo y acepta el mismo día en ambos extremos', () => {
    const fixture = showEmptyPanel();
    const component = fixture.componentInstance;
    for (const range of [
      { from: '', to: '2024-02-29' },
      { from: '2024-02-29', to: '2024-02-29' },
    ]) {
      component.rangeForm.setValue(range);
      component.loadStatistics();
      for (const [path, body] of [
        ['posts-per-user', []],
        ['comments', { total: 0, porDia: [] }],
        ['comments-per-post', []],
      ] as const) {
        const request = http.expectOne((req) => req.url === `${API_URL}/statistics/${path}`);
        expect(request.request.params.get('from')).toBe(range.from || null);
        expect(request.request.params.get('to')).toBe(range.to);
        request.flush(body);
      }
    }
    expect(component.statisticsError).toBe('');
  });

  it('no muestra mensajes técnicos del servidor cuando falla la consulta', () => {
    const component = createPanel().componentInstance;
    const failed = http.expectOne(`${API_URL}/statistics/posts-per-user`);
    http.expectOne(`${API_URL}/statistics/comments`);
    http.expectOne(`${API_URL}/statistics/comments-per-post`);
    failed.flush(
      { message: ['from debe ser una fecha ISO-8601 válida.'] },
      { status: 400, statusText: 'Bad Request' },
    );
    expect(component.statisticsError).toBe(
      'No se pudieron cargar las estadísticas. Revisá las fechas e intentá nuevamente.',
    );
  });

  it('muestra estados vacíos y permite volver a intentar si fallan las estadísticas', () => {
    const fixture = createPanel();
    const component = fixture.componentInstance;
    const failed = http.expectOne(`${API_URL}/statistics/posts-per-user`);
    const pendingTotal = http.expectOne(`${API_URL}/statistics/comments`);
    const pendingPerPost = http.expectOne(`${API_URL}/statistics/comments-per-post`);
    failed.flush([], { status: 500, statusText: 'Error' });
    expect(pendingTotal.cancelled).toBe(true);
    expect(pendingPerPost.cancelled).toBe(true);
    expect(component.statisticsError).toContain('No se pudieron cargar');
    component.loadStatistics();
    flushStatistics();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No hay publicaciones en este período');
    expect(fixture.nativeElement.textContent).toContain('No hay comentarios en este período');
    expect(component.commentsTotal).toBe(0);
  });
});
