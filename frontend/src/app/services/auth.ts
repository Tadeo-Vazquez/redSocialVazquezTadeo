import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { throwError } from 'rxjs';

export interface LoginRequest {
  loginInput: string;
  password: string;
}

export interface AuthResponse {
  message: string;
  user: Record<string, unknown>;
}

@Injectable({
  providedIn: 'root',
})
export class Auth {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:3000/auth';

  login(data: LoginRequest): Observable<AuthResponse> {
    console.log('[Auth] Enviando solicitud de login.', { loginInput: data.loginInput });
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, data).pipe(
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
    return this.http.post<AuthResponse>(`${this.apiUrl}/register`, data).pipe(
      tap((response) => console.log('[Auth] Respuesta exitosa de registro.', response)),
      catchError((error) => {
        console.error('[Auth] Respuesta fallida de registro.', error);
        return throwError(() => error);
      }),
    );
  }
}
