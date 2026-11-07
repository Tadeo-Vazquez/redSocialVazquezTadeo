import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  imports: [RouterLink, RouterLinkActive],
  selector: 'app-aside-nav',
  styleUrl: './aside-nav.scss',
  templateUrl: './aside-nav.html',
})
export class AsideNav {
  private readonly router = inject(Router);
  readonly currentUser = this.readCurrentUser();

  private readCurrentUser(): Record<string, unknown> | null {
    try {
      const storedUser = sessionStorage.getItem('currentUser');
      return storedUser ? (JSON.parse(storedUser) as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }

  logout(): void {
    sessionStorage.removeItem('currentUser');
    void this.router.navigate(['/login']);
  }
}
