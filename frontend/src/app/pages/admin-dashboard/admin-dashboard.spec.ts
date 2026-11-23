import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { API_URL } from '../../config/api-url.generated';
import { Session } from '../../services/session';
import { AdminDashboard } from './admin-dashboard';

describe('Dashboard de administración', () => {
  let http: HttpTestingController;
  const user = {
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
  });

  afterEach(() => {
    http.verify();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  function showDashboard() {
    const fixture = TestBed.createComponent(AdminDashboard);
    fixture.detectChanges();
    http.expectOne(`${API_URL}/users`).flush([user]);
    fixture.detectChanges();
    return fixture;
  }

  it('lista usuarios y permite deshabilitarlos y rehabilitarlos', () => {
    const fixture = showDashboard();
    expect(fixture.nativeElement.textContent).toContain('ana@example.com');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fixture.nativeElement.querySelector('.action-button').click();
    const disable = http.expectOne(`${API_URL}/users/user1`);
    expect(disable.request.method).toBe('DELETE');
    disable.flush({ message: 'Deshabilitado', user: { ...user, isDeleted: true } });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Deshabilitado');
    fixture.nativeElement.querySelector('.action-button').click();
    const enable = http.expectOne(`${API_URL}/users/user1/habilitar`);
    expect(enable.request.method).toBe('POST');
    enable.flush({ message: 'Habilitado', user });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Habilitado');
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
