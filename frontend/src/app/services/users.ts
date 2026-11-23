import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../config/api-url.generated';
import { CurrentUser } from './current-user';

export interface UserProfileResponse {
  message?: string;
  user?: CurrentUser;
  [key: string]: unknown;
}

// Forma de un usuario en el listado administrativo. El backend devuelve
// isDeleted incluso para cuentas dadas de baja y nunca incluye la contraseña.
export interface AdminUser {
  _id: string;
  nombre: string;
  apellido: string;
  username: string;
  email: string;
  perfil: 'usuario' | 'administrador';
  isDeleted: boolean;
  avatarUrl?: string;
}

// Las operaciones de alta, baja y rehabilitación devuelven un mensaje y el
// usuario resultante; el componente puede actualizar la pantalla con esos datos.
export interface AdminUserResponse {
  message: string;
  user: AdminUser;
}

@Injectable({
  providedIn: 'root',
})
export class Users {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${API_URL}/users`;

  /**
   * Solicita el listado completo para el dashboard, incluidas las cuentas
   * deshabilitadas. El Observable permite al componente manejar carga y error;
   * el backend verifica que la cookie corresponda a un administrador activo.
   */
  listUsers(): Observable<AdminUser[]> {
    return this.http.get<AdminUser[]>(this.apiUrl);
  }

  /**
   * Envía datos y foto como multipart/form-data. No se asigna manualmente el
   * Content-Type: el navegador lo genera con el boundary necesario para separar
   * los campos del archivo. Esta ruta no reemplaza la sesión del administrador.
   */
  createUser(data: FormData): Observable<AdminUserResponse> {
    return this.http.post<AdminUserResponse>(this.apiUrl, data);
  }

  /**
   * Solicita la baja lógica: el servidor conserva el usuario, pero marca su
   * cuenta como deshabilitada y deja de aceptar su sesión.
   */
  disableUser(id: string): Observable<AdminUserResponse> {
    return this.http.delete<AdminUserResponse>(`${this.apiUrl}/${id}`);
  }

  /** Solicita rehabilitar una cuenta dada de baja usando su identificador. */
  enableUser(id: string): Observable<AdminUserResponse> {
    return this.http.post<AdminUserResponse>(`${this.apiUrl}/${id}/habilitar`, {});
  }

  getProfile(id: string): Observable<UserProfileResponse> {
    return this.http.get<UserProfileResponse>(`${this.apiUrl}/${id}`);
  }

  // Envía el formulario multipart al PUT /users/:id; puede incluir una foto nueva.
  updateProfile(id: string, data: FormData): Observable<UserProfileResponse> {
    return this.http.put<UserProfileResponse>(`${this.apiUrl}/${id}`, data);
  }
}
