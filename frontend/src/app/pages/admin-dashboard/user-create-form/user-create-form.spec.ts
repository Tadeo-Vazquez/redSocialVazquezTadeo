import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_URL } from '../../../config/api-url.generated';
import { Session } from '../../../services/session';
import { UserCreateForm } from './user-create-form';

describe('Formulario de alta de usuarios del dashboard', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [UserCreateForm],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    TestBed.inject(Session).setCurrentUser({ _id: 'admin', perfil: 'administrador' });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    sessionStorage.clear();
  });

  function fillForm(component: UserCreateForm, overrides: Partial<Record<string, string>> = {}) {
    component.userForm.setValue({
      nombre: 'Ana',
      apellido: 'Perez',
      email: 'ana@example.com',
      username: 'ana',
      fechaNacimiento: '2000-01-01',
      password: 'Password1',
      repetirPassword: 'Password1',
      descripcionBreve: 'Hola',
      perfil: 'usuario',
      ...overrides,
    } as ReturnType<typeof component.userForm.getRawValue>);
  }

  it('crea un administrador con sus datos y foto sin reemplazar la sesión', () => {
    const fixture = TestBed.createComponent(UserCreateForm);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const created = vi.fn();
    component.created.subscribe(created);
    fillForm(component, { perfil: 'administrador' });
    component.selectedImage = new File(['image'], 'avatar.png', { type: 'image/png' });
    component.createUser();
    const create = http.expectOne(`${API_URL}/users`);
    expect(create.request.method).toBe('POST');
    expect(create.request.body.get('perfil')).toBe('administrador');
    expect(create.request.body.get('image')).toBeTruthy();
    create.flush({ message: 'Creado', user: { _id: 'user1', perfil: 'administrador' } });
    expect(created).toHaveBeenCalledTimes(1);
    expect(TestBed.inject(Session).getCurrentUser()?._id).toBe('admin');
    expect(component.userForm.controls.perfil.value).toBe('usuario');
    expect(component.selectedImage).toBeNull();
  });

  it('rechaza contraseñas diferentes y muestra errores del servidor', () => {
    const fixture = TestBed.createComponent(UserCreateForm);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const created = vi.fn();
    component.created.subscribe(created);
    fillForm(component, { repetirPassword: 'Password2' });
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
    expect(created).not.toHaveBeenCalled();
  });
});
