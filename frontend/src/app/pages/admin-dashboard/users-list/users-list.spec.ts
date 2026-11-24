import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { OverlayContainer } from '@angular/cdk/overlay';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { API_URL } from '../../../config/api-url.generated';
import { Session } from '../../../services/session';
import type { AdminUser } from '../../../services/users';
import { UsersList } from './users-list';

describe('Lista de usuarios del dashboard', () => {
  let http: HttpTestingController;
  let overlay: HTMLElement;
  const user: AdminUser = {
    _id: 'user1',
    nombre: 'Ana',
    apellido: 'Pérez',
    email: 'ana@example.com',
    username: 'ana',
    perfil: 'usuario',
    isDeleted: false,
  };

  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [UsersList],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    TestBed.inject(Session).setCurrentUser({ _id: 'admin', perfil: 'administrador' });
    http = TestBed.inject(HttpTestingController);
    overlay = TestBed.inject(OverlayContainer).getContainerElement();
  });

  afterEach(() => {
    http.verify();
    sessionStorage.clear();
  });

  function showList() {
    const fixture = TestBed.createComponent(UsersList);
    fixture.detectChanges();
    http.expectOne(`${API_URL}/users`).flush([user]);
    fixture.detectChanges();
    return fixture;
  }

  it('confirma antes de deshabilitar y rehabilitar usuarios', async () => {
    const fixture = showList();
    expect(fixture.nativeElement.textContent).toContain('ana@example.com');
    fixture.nativeElement.querySelector('.action-button').click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(overlay.textContent).toContain('¿Deshabilitar usuario?');
    expect(overlay.textContent).toContain('ana');
    http.expectNone(`${API_URL}/users/user1`);
    const disabledDialog = firstValueFrom(TestBed.inject(MatDialog).openDialogs[0].afterClosed());
    (overlay.querySelector('.confirm-button') as HTMLButtonElement).click();
    await disabledDialog;
    const disable = http.expectOne(`${API_URL}/users/user1`);
    expect(disable.request.method).toBe('DELETE');
    disable.flush({ message: 'Deshabilitado', user: { ...user, isDeleted: true } });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Deshabilitado');
    fixture.nativeElement.querySelector('.action-button').click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(overlay.textContent).toContain('¿Habilitar usuario?');
    const enabledDialog = firstValueFrom(TestBed.inject(MatDialog).openDialogs[0].afterClosed());
    (overlay.querySelector('.confirm-button') as HTMLButtonElement).click();
    await enabledDialog;
    const enable = http.expectOne(`${API_URL}/users/user1/habilitar`);
    expect(enable.request.method).toBe('POST');
    enable.flush({ message: 'Habilitado', user });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Habilitado');
  });

  it('no modifica usuarios al cancelar, cerrar con Escape o hacer clic fuera', async () => {
    const fixture = showList();
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.action-button');
    const dialog = TestBed.inject(MatDialog);

    button.click();
    button.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(dialog.openDialogs.length).toBe(1);
    let closed = firstValueFrom(dialog.openDialogs[0].afterClosed());
    (overlay.querySelector('.cancel-button') as HTMLButtonElement).click();
    await closed;
    http.expectNone(`${API_URL}/users/user1`);

    button.click();
    fixture.detectChanges();
    await fixture.whenStable();
    closed = firstValueFrom(dialog.openDialogs[0].afterClosed());
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
    await closed;
    http.expectNone(`${API_URL}/users/user1`);

    button.click();
    fixture.detectChanges();
    await fixture.whenStable();
    closed = firstValueFrom(dialog.openDialogs[0].afterClosed());
    (overlay.querySelector('.cdk-overlay-backdrop') as HTMLElement).click();
    await closed;
    http.expectNone(`${API_URL}/users/user1`);
    expect(fixture.componentInstance.users[0].isDeleted).toBe(false);
  });

  it('advierte al administrador antes de deshabilitar su propia cuenta', async () => {
    const fixture = showList();
    fixture.componentInstance.toggleUser({ ...user, _id: 'admin' });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(overlay.textContent).toContain('Tu sesión dejará de ser válida.');
    const closed = firstValueFrom(TestBed.inject(MatDialog).openDialogs[0].afterClosed());
    (overlay.querySelector('.cancel-button') as HTMLButtonElement).click();
    await closed;
    http.expectNone(`${API_URL}/users/admin`);
  });

  it('informa el error si falla la modificación confirmada', async () => {
    const fixture = showList();
    fixture.nativeElement.querySelector('.action-button').click();
    fixture.detectChanges();
    await fixture.whenStable();
    const closed = firstValueFrom(TestBed.inject(MatDialog).openDialogs[0].afterClosed());
    (overlay.querySelector('.confirm-button') as HTMLButtonElement).click();
    await closed;
    http.expectOne(`${API_URL}/users/user1`).flush(
      { message: 'No se pudo deshabilitar la cuenta.' },
      { status: 403, statusText: 'Forbidden' },
    );
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No se pudo deshabilitar la cuenta.');
    expect(fixture.componentInstance.users[0].isDeleted).toBe(false);
  });

  it('no envía la acción si el panel se destruye antes de cerrar el diálogo', async () => {
    const fixture = showList();
    fixture.nativeElement.querySelector('.action-button').click();
    fixture.detectChanges();
    await fixture.whenStable();
    const dialogRef = TestBed.inject(MatDialog).openDialogs[0];
    const closed = firstValueFrom(dialogRef.afterClosed());
    fixture.destroy();
    dialogRef.close(true);
    await closed;
    http.expectNone(`${API_URL}/users/user1`);
  });
});
