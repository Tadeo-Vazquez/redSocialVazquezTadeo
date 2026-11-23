import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { OverlayContainer } from '@angular/cdk/overlay';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { API_URL } from '../../config/api-url.generated';
import { Session } from '../../services/session';
import { Publicaciones } from './publicaciones';

describe('Permisos de publicaciones', () => {
  let http: HttpTestingController;
  let session: Session;
  let overlay: HTMLElement;
  const posts = [
    { _id: 'propia', usuarioId: 'usuario', titulo: 'Propia', descripcion: '' },
    { _id: 'ajena', usuarioId: 'otro', titulo: 'Ajena', descripcion: '' },
  ];

  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [Publicaciones],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(Session);
    overlay = TestBed.inject(OverlayContainer).getContainerElement();
  });

  afterEach(() => {
    http.verify();
    sessionStorage.clear();
  });

  function showFeed(perfil: 'usuario' | 'administrador') {
    session.setCurrentUser({ _id: 'usuario', perfil });
    const fixture = TestBed.createComponent(Publicaciones);
    fixture.detectChanges();
    http.expectOne((req) => req.url === `${API_URL}/posts`).flush({
      posts, total: posts.length, offset: 0, limit: 4,
    });
    fixture.detectChanges();
    return fixture;
  }

  it('confirma antes de eliminar una publicación ajena como administrador', async () => {
    const fixture = showFeed('administrador');
    expect(fixture.nativeElement.querySelector('a[aria-label="Publicaciones"]')).toBeTruthy();
    const buttons: NodeListOf<HTMLButtonElement> =
      fixture.nativeElement.querySelectorAll('.delete-post-button');
    expect(buttons.length).toBe(2);
    buttons[1].click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(overlay.textContent).toContain('Ajena');
    http.expectNone(`${API_URL}/posts/ajena`);
    const closed = firstValueFrom(TestBed.inject(MatDialog).openDialogs[0].afterClosed());
    const confirmButton: HTMLButtonElement = overlay.querySelector('.confirm-button')!;
    confirmButton.click();
    await closed;
    const deletion = http.expectOne(`${API_URL}/posts/ajena`);
    expect(deletion.request.method).toBe('DELETE');
    deletion.flush({ message: 'Publicación eliminada correctamente.' });
    http.expectOne((req) => req.url === `${API_URL}/posts`).flush({
      posts: [posts[0]], total: 1, offset: 0, limit: 4,
    });

    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.delete-post-button').length).toBe(1);
  });

  it('no elimina la publicación al cancelar la confirmación', async () => {
    const fixture = showFeed('usuario');
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.delete-post-button');
    button.click();
    button.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(overlay.textContent).toContain('Propia');
    expect(TestBed.inject(MatDialog).openDialogs.length).toBe(1);
    const closed = firstValueFrom(TestBed.inject(MatDialog).openDialogs[0].afterClosed());
    const cancelButton: HTMLButtonElement = overlay.querySelector('.cancel-button')!;
    cancelButton.click();
    await closed;
    http.expectNone(`${API_URL}/posts/propia`);
    expect(fixture.nativeElement.querySelectorAll('app-publicacion-card').length).toBe(2);

    button.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const closedByEscape = firstValueFrom(TestBed.inject(MatDialog).openDialogs[0].afterClosed());
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
    await closedByEscape;
    http.expectNone(`${API_URL}/posts/propia`);
  });

  it('muestra al usuario común el botón solo en sus publicaciones', () => {
    const fixture = showFeed('usuario');
    const cards: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('app-publicacion-card');
    expect(cards[0].querySelector('.delete-post-button')).toBeTruthy();
    expect(cards[1].querySelector('.delete-post-button')).toBeNull();
  });

  it('informa el error y conserva la publicación si falla la baja', async () => {
    const fixture = showFeed('administrador');
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.delete-post-button');
    button.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const closed = firstValueFrom(TestBed.inject(MatDialog).openDialogs[0].afterClosed());
    const confirmButton: HTMLButtonElement = overlay.querySelector('.confirm-button')!;
    confirmButton.click();
    await closed;
    http.expectOne(`${API_URL}/posts/propia`).flush(
      { message: 'No autorizado' }, { status: 403, statusText: 'Forbidden' },
    );
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent)
      .toContain('No se pudo eliminar la publicación');
    expect(fixture.nativeElement.querySelectorAll('app-publicacion-card').length).toBe(2);
  });
});
