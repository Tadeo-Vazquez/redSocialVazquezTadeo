import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, Input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { API_URL } from '../../config/api-url.generated';
import { Post } from '../../services/posts';
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
