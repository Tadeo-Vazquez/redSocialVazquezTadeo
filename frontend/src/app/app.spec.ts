import { Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { App } from './app';
import { API_URL } from './config/api-url.generated';
import { authGuard } from './guards/auth.guard';
import { Session } from './services/session';

// Una vista mínima permite comprobar la navegación sin cargar páginas completas.
@Component({ template: 'Destino' })
class Destination {}

describe('Inicio de la aplicación', () => {
  let http: HttpTestingController;
  let session: Session;

  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideHttpClient(),
        // Sustituye la red real para controlar las respuestas de autorización.
        provideHttpClientTesting(),
        provideRouter([
          { path: 'login', component: Destination },
          { path: 'publicaciones', component: Destination, canActivate: [authGuard] },
        ]),
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(Session);
  });

  afterEach(() => {
    // Cada prueba debe responder todas las peticiones y dejar limpio el navegador.
    http.verify();
    sessionStorage.clear();
  });

  it('muestra la carga y restaura el usuario antes de ir a publicaciones', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.spinner')).toBeTruthy();
    // flush simula que el backend acepta la cookie y devuelve el perfil vigente.
    const request = http.expectOne(`${API_URL}/auth/autorizar`);
    expect(request.request.method).toBe('POST');
    expect(request.request.withCredentials).toBe(true);
    request.flush({ message: 'Sesión autorizada.', user: { _id: '123', perfil: 'usuario' } });

    // La navegación es asíncrona: esperamos antes de comprobar la ruta y la vista.
    await fixture.whenStable();
    fixture.detectChanges();
    expect(session.getCurrentUser()?._id).toBe('123');
    expect(TestBed.inject(Router).url).toBe('/publicaciones');
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeNull();
  });

  it('borra los datos locales y va al login si la autorización falla', async () => {
    // Un perfil anterior no debe considerarse válido cuando el servidor rechaza el JWT.
    session.setCurrentUser({ _id: 'anterior' });
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    http.expectOne(`${API_URL}/auth/autorizar`).flush(
      { message: 'Token inválido' },
      { status: 401, statusText: 'Unauthorized' },
    );

    await fixture.whenStable();
    fixture.detectChanges();
    expect(session.getCurrentUser()).toBeNull();
    expect(TestBed.inject(Router).url).toBe('/login');
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeNull();
  });
});
