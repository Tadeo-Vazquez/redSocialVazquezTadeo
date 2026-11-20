import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { Login } from './login';

describe('Login', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [provideHttpClient(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('enfoca el usuario al abrir el formulario sin desplazar un foco ya elegido', async () => {
    (document.activeElement as HTMLElement | null)?.blur();
    fixture.detectChanges();
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
    const loginInput: HTMLInputElement = fixture.nativeElement.querySelector('#loginInput');
    expect(document.activeElement).toBe(loginInput);

    fixture.destroy();
    const secondFixture = TestBed.createComponent(Login);
    secondFixture.detectChanges();
    const password: HTMLInputElement = secondFixture.nativeElement.querySelector('#password');
    password.focus();
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
    expect(document.activeElement).toBe(password);
    secondFixture.destroy();
  });

  it('resalta los campos inválidos tocados y quita el error al corregirlos', () => {
    fixture.detectChanges();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('#loginInput');
    expect(input.classList.contains('input-error')).toBe(false);
    expect(input.hasAttribute('aria-invalid')).toBe(false);

    component.loginForm.controls.loginInput.markAsTouched();
    fixture.detectChanges();
    expect(input.classList.contains('input-error')).toBe(true);
    expect(input.getAttribute('aria-invalid')).toBe('true');

    component.loginForm.controls.loginInput.setValue('usuario');
    fixture.detectChanges();
    expect(input.classList.contains('input-error')).toBe(false);
    expect(input.hasAttribute('aria-invalid')).toBe(false);
  });
});
