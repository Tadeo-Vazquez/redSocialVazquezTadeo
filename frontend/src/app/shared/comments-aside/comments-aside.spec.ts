import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommentsAside } from './comments-aside';
import { Post } from '../../services/posts';

describe('CommentsAside', () => {
  let component: CommentsAside;
  let fixture: ComponentFixture<CommentsAside>;

  const post: Post = {
    _id: 'post-id',
    usuarioId: 'user-id',
    titulo: 'Publicación de prueba',
    descripcion: 'Descripción',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommentsAside],
    }).compileComponents();

    fixture = TestBed.createComponent(CommentsAside);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('post', post);
    fixture.detectChanges();
  });

  it('shows an empty comments panel for the selected post', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('[role="dialog"]')).toBeTruthy();
    expect(element.textContent).toContain(post.titulo);
    expect(element.textContent).toContain('Los comentarios aparecerán aquí');
  });

  it('emits when the panel is closed', () => {
    const closed = vi.fn();
    component.closed.subscribe(closed);

    component.close();

    expect(closed).toHaveBeenCalledOnce();
  });
});
