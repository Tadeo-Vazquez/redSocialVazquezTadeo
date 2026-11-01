import { Component } from '@angular/core';
import { FormatoFechaPipe } from '../../pipes/formato-fecha.pipe';
import { AsideNav } from '../../shared/aside-nav/aside-nav';

interface CurrentUser {
  nombre?: string;
  apellido?: string;
  email?: string;
  username?: string;
  fechaNacimiento?: string;
  descripcionBreve?: string;
  avatarUrl?: string;
}

@Component({
  imports: [FormatoFechaPipe, AsideNav],
  selector: 'app-mi-perfil',
  styleUrl: './mi-perfil.scss',
  templateUrl: './mi-perfil.html',
})
export class MiPerfil {
  readonly currentUser = this.readCurrentUser();

  private readCurrentUser(): CurrentUser | null {
    try {
      const storedUser = sessionStorage.getItem('currentUser');
      return storedUser ? (JSON.parse(storedUser) as CurrentUser) : null;
    } catch {
      return null;
    }
  }
}
