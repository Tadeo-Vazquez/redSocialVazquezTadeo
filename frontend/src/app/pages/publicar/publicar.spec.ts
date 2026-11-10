import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { Publicar } from './publicar';

describe('Publicar', () => {
  let component: Publicar;
  let fixture: ComponentFixture<Publicar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Publicar],
      providers: [provideHttpClient(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Publicar);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('starts on the image step and allows continuing without an image', () => {
    expect(component.step).toBe(1);
    expect(component.continueLabel).toBe('Continuar sin imagen');

    component.continueToDetails();

    expect(component.step).toBe(2);
  });
});
