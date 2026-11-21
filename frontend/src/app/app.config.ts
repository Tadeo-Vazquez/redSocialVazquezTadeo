import { ApplicationConfig, provideBrowserGlobalErrorListeners, isDevMode } from '@angular/core';
import {
  provideHttpClient,
  withInterceptors,
  withInterceptorsFromDi,
  HTTP_INTERCEPTORS,
} from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { UnauthorizedInterceptor } from './interceptors/unauthorized.interceptor';
import { CredentialsInterceptor } from './interceptors/credentials.interceptor';
import { provideServiceWorker } from '@angular/service-worker';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptorsFromDi()),
    // Registra el interceptor que agrega withCredentials: true a todas las peticiones.
    // Esto permite que el navegador envíe la cookie HttpOnly (access_token).
    { provide: HTTP_INTERCEPTORS, useClass: CredentialsInterceptor, multi: true },
    // Registra el interceptor que maneja 401 Unauthorized y redirige al login.
    { provide: HTTP_INTERCEPTORS, useClass: UnauthorizedInterceptor, multi: true },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
