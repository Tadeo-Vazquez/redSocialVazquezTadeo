import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { OverlayContainer } from '@angular/cdk/overlay';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { API_URL } from '../../config/api-url.generated';
import { Session } from '../../services/session';
import type { AdminUser } from '../../services/users';
import { AdminDashboard } from './admin-dashboard';

describe('Dashboard de administración', () => {
  let http: HttpTestingController;
  let overlay: HTMLElement;
  const user: AdminUser = {
    _id: 'user1',
    nombre: 'Ana',
    apellido: 'Pérez',
    email: 'ana@example.com',
    username: 'ana',
    perfil: 'usuario',
    isDeleted: false,
  };

  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [AdminDashboard],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    TestBed.inject(Session).setCurrentUser({ _id: 'admin', perfil: 'administrador' });
    http = TestBed.inject(HttpTestingController);
    overlay = TestBed.inject(OverlayContainer).getContainerElement();
  });

  afterEach(() => {
    http.verify();
    sessionStorage.clear();
  });

  function showDashboard() {
    const fixture = TestBed.createComponent(AdminDashboard);
    fixture.detectChanges();
    http.expectOne(`${API_URL}/users`).flush([user]);
    fixture.detectChanges();
    return fixture;
  }

  function showStatistics(fixture: ReturnType<typeof showDashboard>) {
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.tabs button:nth-child(2)');
    button.click();
    fixture.detectChanges();
    http.expectOne(`${API_URL}/statistics/posts-per-user`).flush([]);
    http.expectOne(`${API_URL}/statistics/comments`).flush({ total: 0 });
    http.expectOne(`${API_URL}/statistics/comments-per-post`).flush([]);
    fixture.detectChanges();
  }

  it('confirma antes de deshabilitar y rehabilitar usuarios', async () => {
    const fixture = showDashboard();
    expect(fixture.nativeElement.textContent).toContain('ana@example.com');
    fixture.nativeElement.querySelector('.action-button').click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(overlay.textContent).toContain('¿Deshabilitar usuario?');
    expect(overlay.textContent).toContain('ana');
    http.expectNone(`${API_URL}/users/user1`);
    const disabledDialog = firstValueFrom(TestBed.inject(MatDialog).openDialogs[0].afterClosed());
    (overlay.querySelector('.confirm-button') as HTMLButtonElement).click();
    await disabledDialog;
    const disable = http.expectOne(`${API_URL}/users/user1`);
    expect(disable.request.method).toBe('DELETE');
    disable.flush({ message: 'Deshabilitado', user: { ...user, isDeleted: true } });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Deshabilitado');
    fixture.nativeElement.querySelector('.action-button').click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(overlay.textContent).toContain('¿Habilitar usuario?');
    const enabledDialog = firstValueFrom(TestBed.inject(MatDialog).openDialogs[0].afterClosed());
    (overlay.querySelector('.confirm-button') as HTMLButtonElement).click();
    await enabledDialog;
    const enable = http.expectOne(`${API_URL}/users/user1/habilitar`);
    expect(enable.request.method).toBe('POST');
    enable.flush({ message: 'Habilitado', user });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Habilitado');
  });

  it('no modifica usuarios al cancelar, cerrar con Escape o hacer clic fuera', async () => {
    const fixture = showDashboard();
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.action-button');
    const dialog = TestBed.inject(MatDialog);

    button.click();
    button.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(dialog.openDialogs.length).toBe(1);
    let closed = firstValueFrom(dialog.openDialogs[0].afterClosed());
    (overlay.querySelector('.cancel-button') as HTMLButtonElement).click();
    await closed;
    http.expectNone(`${API_URL}/users/user1`);

    button.click();
    fixture.detectChanges();
    await fixture.whenStable();
    closed = firstValueFrom(dialog.openDialogs[0].afterClosed());
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
    await closed;
    http.expectNone(`${API_URL}/users/user1`);

    button.click();
    fixture.detectChanges();
    await fixture.whenStable();
    closed = firstValueFrom(dialog.openDialogs[0].afterClosed());
    (overlay.querySelector('.cdk-overlay-backdrop') as HTMLElement).click();
    await closed;
    http.expectNone(`${API_URL}/users/user1`);
    expect(fixture.componentInstance.users[0].isDeleted).toBe(false);
  });

  it('advierte al administrador antes de deshabilitar su propia cuenta', async () => {
    const fixture = showDashboard();
    fixture.componentInstance.toggleUser({ ...user, _id: 'admin' });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(overlay.textContent).toContain('Tu sesión dejará de ser válida.');
    const closed = firstValueFrom(TestBed.inject(MatDialog).openDialogs[0].afterClosed());
    (overlay.querySelector('.cancel-button') as HTMLButtonElement).click();
    await closed;
    http.expectNone(`${API_URL}/users/admin`);
  });

  it('informa el error si falla la modificación confirmada', async () => {
    const fixture = showDashboard();
    fixture.nativeElement.querySelector('.action-button').click();
    fixture.detectChanges();
    await fixture.whenStable();
    const closed = firstValueFrom(TestBed.inject(MatDialog).openDialogs[0].afterClosed());
    (overlay.querySelector('.confirm-button') as HTMLButtonElement).click();
    await closed;
    http.expectOne(`${API_URL}/users/user1`).flush(
      { message: 'No se pudo deshabilitar la cuenta.' },
      { status: 403, statusText: 'Forbidden' },
    );
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No se pudo deshabilitar la cuenta.');
    expect(fixture.componentInstance.users[0].isDeleted).toBe(false);
  });

  it('no envía la acción si el panel se destruye antes de cerrar el diálogo', async () => {
    const fixture = showDashboard();
    fixture.nativeElement.querySelector('.action-button').click();
    fixture.detectChanges();
    await fixture.whenStable();
    const dialogRef = TestBed.inject(MatDialog).openDialogs[0];
    const closed = firstValueFrom(dialogRef.afterClosed());
    fixture.destroy();
    dialogRef.close(true);
    await closed;
    http.expectNone(`${API_URL}/users/user1`);
  });

  it('crea un administrador con sus datos y foto sin reemplazar la sesión', () => {
    const fixture = showDashboard();
    const component = fixture.componentInstance;
    component.userForm.setValue({
      nombre: 'Ana',
      apellido: 'Perez',
      email: 'ana@example.com',
      username: 'ana',
      fechaNacimiento: '2000-01-01',
      password: 'Password1',
      repetirPassword: 'Password1',
      descripcionBreve: 'Hola',
      perfil: 'administrador',
    });
    component.selectedImage = new File(['image'], 'avatar.png', { type: 'image/png' });
    component.createUser();
    const create = http.expectOne(`${API_URL}/users`);
    expect(create.request.method).toBe('POST');
    expect(create.request.body.get('perfil')).toBe('administrador');
    expect(create.request.body.get('image')).toBeTruthy();
    create.flush({ message: 'Creado', user: { ...user, perfil: 'administrador' } });
    http.expectOne(`${API_URL}/users`).flush([user]);
    expect(TestBed.inject(Session).getCurrentUser()?._id).toBe('admin');
    expect(component.userForm.controls.perfil.value).toBe('usuario');
    expect(component.selectedImage).toBeNull();
  });

  it('rechaza contraseñas diferentes y muestra errores del servidor', () => {
    const fixture = showDashboard();
    const component = fixture.componentInstance;
    component.userForm.setValue({
      nombre: 'Ana',
      apellido: 'Perez',
      email: 'ana@example.com',
      username: 'ana',
      fechaNacimiento: '2000-01-01',
      password: 'Password1',
      repetirPassword: 'Password2',
      descripcionBreve: 'Hola',
      perfil: 'usuario',
    });
    component.createUser();
    expect(component.formError).toContain('contraseñas');
    http.expectNone((req) => req.method === 'POST' && req.url === `${API_URL}/users`);
    component.userForm.controls.repetirPassword.setValue('Password1');
    component.selectedImage = new File(['image'], 'avatar.png', { type: 'image/png' });
    component.createUser();
    http
      .expectOne(`${API_URL}/users`)
      .flush(
        { message: 'El correo electrónico ya está registrado.' },
        { status: 409, statusText: 'Conflict' },
      );
    expect(component.formError).toContain('correo electrónico');
  });

  it('consulta los tres gráficos con el mismo rango y rechaza rangos invertidos', () => {
    const fixture = showDashboard();
    const component = fixture.componentInstance;
    component.rangeForm.setValue({ from: '2026-01-01', to: '2026-01-31' });
    component.selectTab('statistics');
    for (const [path, body] of [
      ['posts-per-user', [{ usuarioId: 'user1', username: 'ana', cantidad: 2 }]],
      ['comments', { total: 3 }],
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

  it.each([
    ['from', '2026-02-30', 'inicio'],
    ['to', '0000-01-01', 'fin'],
  ] as const)(
    'rechaza fechas imposibles en %s antes de consultar el servidor',
    (field, value, label) => {
      const fixture = showDashboard();
      const component = fixture.componentInstance;
      showStatistics(fixture);
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
    const fixture = showDashboard();
    const component = fixture.componentInstance;
    showStatistics(fixture);
    const input: HTMLInputElement = fixture.nativeElement.querySelector('[formcontrolname="from"]');
    Object.defineProperty(input, 'validity', {
      configurable: true,
      value: { badInput: true, rangeUnderflow: false, rangeOverflow: false },
    });
    input.dispatchEvent(new Event('input'));
    component.loadStatistics();
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Ingresá una fecha de inicio válida.');
    http.expectNone((req) => req.url.includes('/statistics/'));
  });

  it('permite un solo extremo y acepta el mismo día en ambos extremos', () => {
    const fixture = showDashboard();
    const component = fixture.componentInstance;
    component.activeTab = 'statistics';
    for (const range of [
      { from: '', to: '2024-02-29' },
      { from: '2024-02-29', to: '2024-02-29' },
    ]) {
      component.rangeForm.setValue(range);
      component.loadStatistics();
      for (const [path, body] of [
        ['posts-per-user', []],
        ['comments', { total: 0 }],
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
    const fixture = showDashboard();
    const component = fixture.componentInstance;
    component.selectTab('statistics');
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
    const fixture = showDashboard();
    const component = fixture.componentInstance;
    component.selectTab('statistics');
    const failed = http.expectOne(`${API_URL}/statistics/posts-per-user`);
    const pendingTotal = http.expectOne(`${API_URL}/statistics/comments`);
    const pendingPerPost = http.expectOne(`${API_URL}/statistics/comments-per-post`);
    failed.flush([], { status: 500, statusText: 'Error' });
    expect(pendingTotal.cancelled).toBe(true);
    expect(pendingPerPost.cancelled).toBe(true);
    expect(component.statisticsError).toContain('No se pudieron cargar');
    component.loadStatistics();
    http.expectOne(`${API_URL}/statistics/posts-per-user`).flush([]);
    http.expectOne(`${API_URL}/statistics/comments`).flush({ total: 0 });
    http.expectOne(`${API_URL}/statistics/comments-per-post`).flush([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No hay publicaciones en este período');
    expect(fixture.nativeElement.textContent).toContain('No hay comentarios en este período');
    expect(component.commentsTotal).toBe(0);
  });
});
