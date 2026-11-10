import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { Posts } from '../../services/posts';
import { Publicaciones } from './publicaciones';

describe('Publicaciones', () => {
  let component: Publicaciones;
  let fixture: ComponentFixture<Publicaciones>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Publicaciones],
      providers: [
        provideRouter([]),
        {
          provide: Posts,
          useValue: {
            getPosts: () =>
              of({ offset: 0, limit: 6, total: 0, posts: [] }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Publicaciones);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
