import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';

export const adminGuard: CanActivateFn = (): boolean | UrlTree => {
  const router = inject(Router);

  try {
    const storedUser = sessionStorage.getItem('currentUser');
    if (storedUser) {
      const user = JSON.parse(storedUser) as Record<string, unknown>;
      if (user['perfil'] === 'administrador') {
        return true;
      }
      return router.createUrlTree(['/publicaciones']);
    }
  } catch {
    sessionStorage.removeItem('currentUser');
  }

  return router.createUrlTree(['/login']);
};
