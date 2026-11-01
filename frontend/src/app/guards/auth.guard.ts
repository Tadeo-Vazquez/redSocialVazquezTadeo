import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';

export const authGuard: CanActivateFn = (): boolean | UrlTree => {
  const router = inject(Router);

  try {
    const currentUser = sessionStorage.getItem('currentUser');
    if (currentUser && JSON.parse(currentUser)) {
      return true;
    }
  } catch {
    sessionStorage.removeItem('currentUser');
  }

  return router.createUrlTree(['/login']);
};
