import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface UserProfileResponse {
  message?: string;
  user?: Record<string, unknown>;
  [key: string]: unknown;
}

@Injectable({
  providedIn: 'root',
})
export class Users {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:3000/users';

  getProfile(id: string): Observable<UserProfileResponse> {
    return this.http.get<UserProfileResponse>(`${this.apiUrl}/${id}`);
  }

  updateProfile(id: string, data: FormData): Observable<UserProfileResponse> {
    return this.http.put<UserProfileResponse>(`${this.apiUrl}/${id}`, data);
  }
}
