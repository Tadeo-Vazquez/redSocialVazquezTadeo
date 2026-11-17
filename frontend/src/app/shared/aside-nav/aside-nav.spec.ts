import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { API_URL } from '../../config/api-url.generated';
import { Session } from '../../services/session';
import { AsideNav } from './aside-nav';

describe('Cerrar sesión', () => {
  let http: HttpTestingController;
  let session: Session;

  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [AsideNav],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(Session);
    session.setCurrentUser({ _id: '123' });
  });

  afterEach(() => {
    http.verify();
    sessionStorage.clear();
  });

  it('elimina la sesión local solo cuando el backend borra la cookie', () => {
    // Espiamos la navegación para verificar el destino sin renderizar el login.
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(AsideNav);
    fixture.componentInstance.logout();

    // Antes de la respuesta el perfil sigue disponible; después del 204 se elimina.
    expect(session.getCurrentUser()).not.toBeNull();
    http.expectOne(`${API_URL}/auth/logout`).flush(null, { status: 204, statusText: 'No Content' });
    expect(session.getCurrentUser()).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it('mantiene la sesión y muestra un error si no se puede borrar la cookie', () => {
    // Un error del servidor no debe aparentar que el cierre fue exitoso.
    const fixture = TestBed.createComponent(AsideNav);
    fixture.componentInstance.logout();
    http.expectOne(`${API_URL}/auth/logout`).flush(
      { message: 'Error' },
      { status: 500, statusText: 'Server Error' },
    );
    fixture.detectChanges();

    expect(session.getCurrentUser()?._id).toBe('123');
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent)
      .toContain('No se pudo cerrar la sesión');
  });
});
