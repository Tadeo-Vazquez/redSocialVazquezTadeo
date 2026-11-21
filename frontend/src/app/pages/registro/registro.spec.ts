import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { Registro } from './registro';

describe('Registro', () => {
  let component: Registro;
  let fixture: ComponentFixture<Registro>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Registro],
      providers: [provideHttpClient(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Registro);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('resalta un campo inválido mientras se escribe y elimina el resaltado al corregirlo', () => {
    fixture.detectChanges();
    const email: HTMLInputElement = fixture.nativeElement.querySelector('#email');
    expect(email.classList.contains('input-error')).toBe(false);
    expect(email.hasAttribute('aria-invalid')).toBe(false);

    email.value = 'invalido';
    email.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(email.classList.contains('input-error')).toBe(true);
    expect(email.getAttribute('aria-invalid')).toBe('true');

    email.value = 'usuario@ejemplo.com';
    email.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(email.classList.contains('input-error')).toBe(false);
    expect(email.hasAttribute('aria-invalid')).toBe(false);
  });

  it('resalta la confirmación cuando las contraseñas no coinciden', () => {
    component.registerForm.controls.password.setValue('Clave123');
    const repeat: HTMLInputElement = fixture.nativeElement.querySelector('#repetirPassword');
    repeat.value = 'OtraClave123';
    repeat.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(repeat.classList.contains('input-error')).toBe(true);
    expect(repeat.getAttribute('aria-invalid')).toBe('true');

    repeat.value = 'Clave123';
    repeat.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(repeat.classList.contains('input-error')).toBe(false);
    expect(repeat.hasAttribute('aria-invalid')).toBe(false);
  });

  it('resalta todos los campos obligatorios al enviar el formulario vacío', () => {
    component.submit();
    fixture.detectChanges();
    for (const id of [
      'nombre', 'apellido', 'email', 'username', 'fechaNacimiento',
      'password', 'repetirPassword', 'descripcionBreve',
    ]) {
      const field: HTMLElement = fixture.nativeElement.querySelector(`#${id}`);
      expect(field.classList.contains('input-error')).toBe(true);
      expect(field.getAttribute('aria-invalid')).toBe('true');
    }
    expect(fixture.nativeElement.querySelectorAll('.field-error').length).toBe(8);
  });
});
