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

  logout(): void {
    sessionStorage.removeItem('currentUser');
    void this.router.navigate(['/login']);
  }
}
