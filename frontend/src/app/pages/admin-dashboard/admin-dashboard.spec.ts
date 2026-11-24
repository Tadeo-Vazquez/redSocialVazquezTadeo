import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { API_URL } from '../../config/api-url.generated';
import { Session } from '../../services/session';
import { AdminDashboard } from './admin-dashboard';
import { UserCreateForm } from './user-create-form/user-create-form';

describe('Dashboard de administración', () => {
  let http: HttpTestingController;

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
  });

  it('carga las estadísticas solo al abrir la pestaña y las conserva al volver', () => {
    const fixture = TestBed.createComponent(AdminDashboard);
    fixture.detectChanges();
    http.expectOne(`${API_URL}/users`).flush([]);
    http.expectNone((req) => req.url.includes('/statistics/'));

    const tabs: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('.tabs button');
    tabs[1].click();
    fixture.detectChanges();
    http.expectOne(`${API_URL}/statistics/posts-per-user`).flush([]);
    http.expectOne(`${API_URL}/statistics/comments`).flush({ total: 0, porDia: [] });
    http.expectOne(`${API_URL}/statistics/comments-per-post`).flush([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-users-tab')).toBeNull();

    tabs[0].click();
    fixture.detectChanges();
    http.expectOne(`${API_URL}/users`).flush([]);
    tabs[1].click();
    fixture.detectChanges();
    http.expectNone((req) => req.url.includes('/statistics/'));
    expect(fixture.nativeElement.querySelector('app-statistics-panel')).not.toBeNull();
  });

  it('permite alternar entre el listado y el formulario y actualiza la lista al crear', () => {
    const fixture = TestBed.createComponent(AdminDashboard);
    fixture.detectChanges();
    http.expectOne(`${API_URL}/users`).flush([]);

    const tabs: NodeListOf<HTMLButtonElement> =
      fixture.nativeElement.querySelectorAll('.user-tabs button');
    const list = fixture.nativeElement.querySelector('app-users-list').parentElement as HTMLElement;
    const form = fixture.nativeElement.querySelector('app-user-create-form').parentElement as HTMLElement;
    expect(list.hidden).toBe(false);
    expect(form.hidden).toBe(true);

    tabs[1].click();
    fixture.detectChanges();
    expect(list.hidden).toBe(true);
    expect(form.hidden).toBe(false);
    expect(tabs[1].getAttribute('aria-current')).toBe('page');

    const createForm = fixture.debugElement.query(By.directive(UserCreateForm)).componentInstance as UserCreateForm;
    createForm.userForm.controls.nombre.setValue('Nombre');
    createForm.created.emit();
    http.expectOne(`${API_URL}/users`).flush([]);

    tabs[0].click();
    fixture.detectChanges();
    expect(list.hidden).toBe(false);
    expect(form.hidden).toBe(true);
    tabs[1].click();
    fixture.detectChanges();
    expect(createForm.userForm.controls.nombre.value).toBe('Nombre');
  });
});
