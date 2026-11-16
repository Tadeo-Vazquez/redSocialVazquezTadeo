import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { CommentResponse, Comments } from '../../services/comments';
import { CommentsAside } from './comments-aside';
import { Post } from '../../services/posts';
import { Session } from '../../services/session';

describe('CommentsAside', () => {
  let component: CommentsAside;
  let fixture: ComponentFixture<CommentsAside>;
  let commentsApi: {
    getComments: ReturnType<typeof vi.fn>;
    createComment: ReturnType<typeof vi.fn>;
  };

  const post: Post = {
    _id: 'post-id',
    usuarioId: 'user-id',
    titulo: 'Publicación de prueba',
    descripcion: 'Descripción',
  };

  beforeEach(async () => {
    commentsApi = {
      getComments: vi.fn().mockReturnValue(
        of({
          publicacionId: post._id,
          desplazamiento: 0,
          limite: 5,
          total: 0,
          comentarios: [],
        }),
      ),
      createComment: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [CommentsAside],
      providers: [
        {
          provide: Comments,
          useValue: commentsApi,
        },
        {
          provide: Session,
          useValue: {
            getCurrentUser: () => ({
              _id: 'user-id',
              nombre: 'Tadeo',
              apellido: 'Vazquez',
              username: 'tadeo',
              avatarUrl: '/avatar.png',
            }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CommentsAside);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('post', post);
    fixture.detectChanges();
  });

  it('loads the initial page and shows the empty state for the selected post', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('[role="dialog"]')).toBeTruthy();
    expect(element.textContent).toContain('0 comentarios');
    expect(element.textContent).toContain('Aún no hay comentarios');
    expect(commentsApi.getComments).toHaveBeenCalledWith(post._id, 0, 5);
  });

  it('immediately renders a new comment with the current user profile', () => {
    const response = new Subject<CommentResponse>();
    commentsApi.createComment.mockReturnValue(response);
    component.draft = 'Comentario de prueba';

    const form = (fixture.nativeElement as HTMLElement).querySelector('form');
    form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(component.isSaving).toBe(true);

    response.next({
      mensaje: 'Comentario agregado correctamente.',
      comentario: {
        _id: 'comment-id',
        publicacionId: post._id,
        usuarioId: 'user-id',
        texto: 'Comentario de prueba',
        modificado: false,
      },
    });
    response.complete();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('@tadeo');
    expect(element.textContent).toContain('Comentario de prueba');
    expect(element.querySelector('img[alt="Foto de @tadeo"]')).toBeTruthy();
    expect(element.textContent).not.toContain('Enviando...');
  });

  it('emits when the panel is closed', () => {
    const closed = vi.fn();
    component.closed.subscribe(closed);

    component.close();

    expect(closed).toHaveBeenCalledOnce();
  });
});
