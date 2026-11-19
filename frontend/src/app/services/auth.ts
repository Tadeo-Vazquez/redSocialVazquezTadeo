import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { CurrentUser } from './current-user';
import { API_URL } from '../config/api-url.generated';

export interface LoginRequest {
  loginInput: string;
  password: string;
}

export interface AuthResponse {
  message: string;
  user: CurrentUser;
  expiresAt: number;
}

@Injectable({
  providedIn: 'root',
})
export class Auth {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${API_URL}/auth`;

  login(data: LoginRequest): Observable<AuthResponse> {
    console.log('[Auth] Enviando solicitud de login.', { loginInput: data.loginInput });
    // El JWT no viene en el JSON: el backend lo envía en Set-Cookie con HttpOnly.
    // withCredentials permite que el navegador acepte esa cookie en una petición
    // entre distintos orígenes, siempre que el backend también permita credenciales.
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, data, { withCredentials: true }).pipe(
      tap((response) => console.log('[Auth] Respuesta exitosa de login.', response)),
      catchError((error) => {
        console.error('[Auth] Respuesta fallida de login.', error);
        return throwError(() => error);
      }),
    );
  }

  register(data: FormData): Observable<AuthResponse> {
    console.log('[Auth] Enviando solicitud de registro.', {
      campos: Array.from(data.keys()),
    });
    // El registro también crea una sesión. FormData incluye la imagen y la cookie
    // de la respuesta se guarda en el navegador, no en sessionStorage ni en JS.
    return this.http.post<AuthResponse>(`${this.apiUrl}/register`, data, { withCredentials: true }).pipe(
      tap((response) => console.log('[Auth] Respuesta exitosa de registro.', response)),
      catchError((error) => {
        console.error('[Auth] Respuesta fallida de registro.', error);
        return throwError(() => error);
      }),
    );
  }

  authorize(): Observable<AuthResponse> {
    // Enviamos la cookie automáticamente para que el servidor verifique la firma,
    // el vencimiento y el estado de la cuenta. El cuerpo es null porque el token
    // viaja en la cookie, no como dato accesible desde JavaScript.
    return this.http.post<AuthResponse>(`${this.apiUrl}/autorizar`, null, {
      withCredentials: true,
    });
  }

  logout(): Observable<void> {
    // Una cookie HttpOnly no puede borrarse desde JavaScript: solicitamos al
    // backend que la expire y esperamos una respuesta 204 sin cuerpo.
    return this.http.post<void>(`${this.apiUrl}/logout`, null, { withCredentials: true });
  }

  refresh(): Observable<AuthResponse> {
    // Solicita un token renovado. El backend valida el JWT actual y emite uno nuevo
    // por otros 15 minutos. Se llama desde el modal de sesión expirando.
    return this.http.post<AuthResponse>(`${this.apiUrl}/refrescar`, null, {
      withCredentials: true,
    });
  }
}
