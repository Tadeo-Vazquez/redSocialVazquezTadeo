import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PublicacionCard } from './publicacion-card';

describe('PublicacionCard', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PublicacionCard],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('muestra la descripción como texto literal y limita la vista previa', () => {
    const fixture = TestBed.createComponent(PublicacionCard);
    const unsafeText = '<img src=x onerror=alert(1)> &lt;b&gt; "hola"';
    const description = unsafeText + 'x'.repeat(220);
    fixture.componentInstance.post = {
      _id: '1', usuarioId: '2', titulo: 'Título', descripcion: description,
    };
    fixture.detectChanges();
    const paragraph: HTMLParagraphElement = fixture.nativeElement.querySelector('.post-description');
    expect(paragraph.textContent).toBe(description.substring(0, 200).trim() + '...');
    expect(paragraph.querySelector('img')).toBeNull();

    fixture.componentRef.setInput('showFullContent', true);
    fixture.detectChanges();
    expect(paragraph.textContent).toBe(description);
    expect(paragraph.querySelector('img')).toBeNull();
  });

  it('emite el primer me gusta e ignora clics repetidos durante el intervalo', () => {
    vi.useFakeTimers();
    try {
      const fixture = TestBed.createComponent(PublicacionCard);
      fixture.componentInstance.post = { _id: '1', usuarioId: '2', titulo: 'Título', descripcion: '' };
      fixture.componentInstance.currentUserId = '2';
      const emit = vi.spyOn(fixture.componentInstance.likeRequested, 'emit');
      fixture.detectChanges();
      const button: HTMLButtonElement = fixture.nativeElement.querySelector('.like-toggle');
      button.click();
      button.click();
      expect(emit).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(500);
      button.click();
      expect(emit).toHaveBeenCalledTimes(2);
      fixture.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('no corta un emoji al final del límite de la vista previa', () => {
    const fixture = TestBed.createComponent(PublicacionCard);
    const prefix = 'a'.repeat(199) + '😀';
    fixture.componentRef.setInput('post', {
      _id: '1', usuarioId: '2', titulo: 'Título', descripcion: prefix,
    });
    fixture.detectChanges();
    const paragraph: HTMLParagraphElement = fixture.nativeElement.querySelector('.post-description');
    expect(paragraph.textContent).toBe(prefix);

    fixture.componentRef.setInput('post', {
      _id: '1', usuarioId: '2', titulo: 'Título', descripcion: prefix + 'b',
    });
    fixture.detectChanges();
    expect(paragraph.textContent).toBe(prefix + '...');
  });
});
