import { Component } from '@angular/core';
import { AsideNav } from '../../shared/aside-nav/aside-nav';

@Component({
  imports: [AsideNav],
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.scss',
})
export class AdminDashboard {}
