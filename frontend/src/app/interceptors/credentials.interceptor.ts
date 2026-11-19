import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
} from '@angular/common/http';
import { Observable } from 'rxjs';

/**
 * Interceptor que agrega withCredentials: true a todas las peticiones HTTP.
 * Esto permite que el navegador envíe la cookie HttpOnly (access_token) automáticamente.
 * Sin esto, CORS rechaza la petición y el servidor responde 401.
 */
@Injectable()
export class CredentialsInterceptor implements HttpInterceptor {
  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // Clone la petición y agregue withCredentials: true
    const credentialsRequest = request.clone({
      withCredentials: true,
    });
    return next.handle(credentialsRequest);
  }
}
