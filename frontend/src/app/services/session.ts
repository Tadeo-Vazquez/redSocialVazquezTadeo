import { Injectable } from '@angular/core';
import { CurrentUser } from './current-user';

@Injectable({
  providedIn: 'root',
})
export class Session {
  private readonly storageKey = 'currentUser';

  getCurrentUser(): CurrentUser | null {
    try {
      const storedUser = sessionStorage.getItem(this.storageKey);
      if (!storedUser) {
        return null;
      }

      const user: unknown = JSON.parse(storedUser);
      const userId =
        typeof user === 'object' && user !== null
          ? (('_id' in user && typeof user._id === 'string' ? user._id : undefined) ??
            ('id' in user && typeof user.id === 'string' ? user.id : undefined))
          : undefined;
      if (!userId) {
        this.clear();
        return null;
      }

      return user as CurrentUser;
    } catch {
      this.clear();
      return null;
    }
  }

  setCurrentUser(user: CurrentUser): void {
    sessionStorage.setItem(this.storageKey, JSON.stringify(user));
  }

  clear(): void {
    sessionStorage.removeItem(this.storageKey);
  }
}
