import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors, withInterceptorsFromDi, HTTP_INTERCEPTORS } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { UnauthorizedInterceptor } from './interceptors/unauthorized.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // Habilita el envío de cookies (withCredentials) por defecto en todas las peticiones.
    // Sin esto, el navegador no adjunta la cookie HttpOnly a las peticiones HTTP.
    provideHttpClient(withInterceptorsFromDi()),
    // Registra el interceptor que maneja 401 Unauthorized y redirige al login.
    { provide: HTTP_INTERCEPTORS, useClass: UnauthorizedInterceptor, multi: true },
  ]
};

