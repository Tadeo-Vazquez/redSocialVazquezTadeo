import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, Input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { OverlayContainer } from '@angular/cdk/overlay';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { vi } from 'vitest';
import { API_URL } from '../../config/api-url.generated';
import { Post } from '../../services/posts';
import { Session } from '../../services/session';
import { CommentsAside } from '../../shared/comments-aside/comments-aside';
import { PublicacionDetalle } from './publicacion-detalle';

@Component({ selector: 'app-comments-aside', template: '' })
class CommentsAsideStub {
  @Input() post!: Post;
  @Input() embedded = false;
}

describe('PublicacionDetalle', () => {
  it('muestra la descripción completa como texto, sin interpretar etiquetas', async () => {
    await TestBed.configureTestingModule({
      imports: [PublicacionDetalle],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '1' }) } } },
      ],
    }).overrideComponent(PublicacionDetalle, {
      remove: { imports: [CommentsAside] },
      add: { imports: [CommentsAsideStub] },
    }).compileComponents();

    const fixture = TestBed.createComponent(PublicacionDetalle);
    fixture.detectChanges();
    const description = '<img src=x onerror=alert(1)> &lt;b&gt; ' + 'x'.repeat(250);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne(`${API_URL}/posts/1`).flush({
      _id: '1', usuarioId: '2', titulo: 'Título', descripcion: description,
    });
    fixture.detectChanges();
    const paragraph: HTMLParagraphElement = fixture.nativeElement.querySelector('.detail-copy p');
    expect(paragraph.textContent).toBe(description);
    expect(paragraph.querySelector('img')).toBeNull();
    http.verify();
  });
});

describe('Baja de publicaciones desde el detalle', () => {
      let http: HttpTestingController;
      let overlay: HTMLElement;

      beforeEach(async () => {
        sessionStorage.clear();
        await TestBed.configureTestingModule({
          imports: [PublicacionDetalle],
          providers: [
            provideHttpClient(),
            provideHttpClientTesting(),
            provideRouter([]),
            { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '1' }) } } },
          ],
        }).overrideComponent(PublicacionDetalle, {
          remove: { imports: [CommentsAside] },
          add: { imports: [CommentsAsideStub] },
        }).compileComponents();
        http = TestBed.inject(HttpTestingController);
        overlay = TestBed.inject(OverlayContainer).getContainerElement();
      });

      afterEach(() => {
        http.verify();
        sessionStorage.clear();
      });

      function showDetail(perfil: 'usuario' | 'administrador') {
        TestBed.inject(Session).setCurrentUser({ _id: 'usuario', perfil });
        const fixture = TestBed.createComponent(PublicacionDetalle);
        fixture.detectChanges();
        http.expectOne(`${API_URL}/posts/1`).flush({
          _id: '1', usuarioId: 'otro', titulo: 'Publicación ajena', descripcion: '',
        });
        fixture.detectChanges();
        return fixture;
      }

      it('muestra el botón solo a administradores', () => {
        const fixture = showDetail('usuario');
        expect(fixture.nativeElement.querySelector('.delete-post-button')).toBeNull();
        fixture.componentInstance.confirmDeletePost();
        expect(TestBed.inject(MatDialog).openDialogs.length).toBe(0);
        http.expectNone((req) => req.method === 'DELETE');
      });

      it('confirma la baja y vuelve al listado después de una respuesta exitosa', async () => {
        const fixture = showDetail('administrador');
        const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
        const button: HTMLButtonElement = fixture.nativeElement.querySelector('.delete-post-button');
        expect(button.textContent).toContain('Eliminar publicación');
        button.click();
        button.click();
        fixture.detectChanges();
        await fixture.whenStable();
        expect(overlay.textContent).toContain('Publicación ajena');
        expect(TestBed.inject(MatDialog).openDialogs.length).toBe(1);
        http.expectNone((req) => req.method === 'DELETE');

        const closed = firstValueFrom(TestBed.inject(MatDialog).openDialogs[0].afterClosed());
        overlay.querySelector<HTMLButtonElement>('.confirm-button')!.click();
        await closed;
        const deletion = http.expectOne(`${API_URL}/posts/1`);
        expect(deletion.request.method).toBe('DELETE');
        fixture.detectChanges();
        expect(button.disabled).toBe(true);
        deletion.flush({ message: 'Publicación eliminada correctamente.' });
        expect(navigate).toHaveBeenCalledWith(['/publicaciones']);
      });

      it('no elimina al cancelar y permite volver a abrir la confirmación', async () => {
        const fixture = showDetail('administrador');
        const button: HTMLButtonElement = fixture.nativeElement.querySelector('.delete-post-button');
        button.click();
        fixture.detectChanges();
        await fixture.whenStable();
        const closed = firstValueFrom(TestBed.inject(MatDialog).openDialogs[0].afterClosed());
        overlay.querySelector<HTMLButtonElement>('.cancel-button')!.click();
        await closed;
        http.expectNone((req) => req.method === 'DELETE');
        button.click();
        expect(TestBed.inject(MatDialog).openDialogs.length).toBe(1);
        TestBed.inject(MatDialog).closeAll();
      });

      it('conserva el detalle e informa el error si falla la baja', async () => {
        const fixture = showDetail('administrador');
        const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
        const element: HTMLElement = fixture.nativeElement;
        element.querySelector<HTMLButtonElement>('.delete-post-button')!.click();
        fixture.detectChanges();
        await fixture.whenStable();
        const closed = firstValueFrom(TestBed.inject(MatDialog).openDialogs[0].afterClosed());
        overlay.querySelector<HTMLButtonElement>('.confirm-button')!.click();
        await closed;
        http.expectOne(`${API_URL}/posts/1`).flush(
          { message: 'No autorizado' }, { status: 403, statusText: 'Forbidden' },
        );
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent)
          .toContain('No se pudo eliminar la publicación');
        expect(fixture.nativeElement.querySelector('.detail-copy h2')?.textContent)
          .toContain('Publicación ajena');
        expect(element.querySelector<HTMLButtonElement>('.delete-post-button')!.disabled).toBe(false);
        expect(navigate).not.toHaveBeenCalled();
      });
});
