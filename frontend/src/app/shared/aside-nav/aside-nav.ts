import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Session } from '../../services/session';

@Component({
  imports: [RouterLink, RouterLinkActive],
  selector: 'app-aside-nav',
  styleUrl: './aside-nav.scss',
  templateUrl: './aside-nav.html',
})
export class AsideNav {
  private readonly router = inject(Router);
  private readonly session = inject(Session);
  readonly currentUser = this.session.getCurrentUser();

  logout(): void {
    this.session.clear();
    void this.router.navigate(['/login']);
  }
}
