import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { Session } from '../services/session';

export const adminGuard: CanActivateFn = (): boolean | UrlTree => {
  const router = inject(Router);
  const currentUser = inject(Session).getCurrentUser();
  if (currentUser?.perfil === 'administrador') {
    return true;
  }

  return currentUser ? router.createUrlTree(['/publicaciones']) : router.createUrlTree(['/login']);
};
