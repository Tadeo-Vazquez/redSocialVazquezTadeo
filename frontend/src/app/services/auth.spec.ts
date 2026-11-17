import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_URL } from '../config/api-url.generated';
import { Auth } from './auth';

describe('Auth', () => {
  let auth: Auth;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    auth = TestBed.inject(Auth);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('permite recibir cookies al iniciar sesión y registrarse', () => {
    // El cliente de pruebas inspecciona la configuración de ambas peticiones;
    // no comprueba el almacenamiento real de cookies de un navegador.
    auth.login({ loginInput: 'usuario', password: 'Password1' }).subscribe();
    const login = http.expectOne(`${API_URL}/auth/login`);
    expect(login.request.withCredentials).toBe(true);
    login.flush({ message: 'OK', user: { _id: '123' } });

    auth.register(new FormData()).subscribe();
    const register = http.expectOne(`${API_URL}/auth/register`);
    expect(register.request.withCredentials).toBe(true);
    register.flush({ message: 'OK', user: { _id: '123' } });
  });

  it('envía credenciales para eliminar la cookie al cerrar sesión', () => {
    auth.logout().subscribe();
    const logout = http.expectOne(`${API_URL}/auth/logout`);
    expect(logout.request.method).toBe('POST');
    expect(logout.request.withCredentials).toBe(true);
    // El backend responde 204: la operación terminó sin cuerpo JSON.
    logout.flush(null, { status: 204, statusText: 'No Content' });
  });
});
