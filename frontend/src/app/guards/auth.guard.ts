import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { Session } from '../services/session';

export const authGuard: CanActivateFn = (): boolean | UrlTree => {
  const router = inject(Router);
  return inject(Session).getCurrentUser() ? true : router.createUrlTree(['/login']);
};
