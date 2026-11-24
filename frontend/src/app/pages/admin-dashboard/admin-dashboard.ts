import { Component } from '@angular/core';
import { AsideNav } from '../../shared/aside-nav/aside-nav';
import { StatisticsPanel } from './statistics-panel/statistics-panel';
import { UsersTab } from './users-tab/users-tab';

/**
 * Contenedor del panel: muestra el encabezado, las pestañas y la sección
 * elegida. La lógica de cada sección vive en su propio componente. La ruta
 * está protegida por adminGuard; la autorización definitiva de cada petición
 * se realiza en el backend, no con los datos guardados en el navegador.
 */
@Component({
  imports: [AsideNav, UsersTab, StatisticsPanel],
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.scss',
})
export class AdminDashboard {
  activeTab: 'users' | 'statistics' = 'users';
  // El panel de estadísticas se crea la primera vez que se abre la pestaña
  // (y carga sus datos entonces); luego solo se oculta, así conserva el
  // rango elegido y los resultados al volver a Usuarios.
  statisticsOpened = false;

  /** Cambia la sección visible. */
  selectTab(tab: 'users' | 'statistics'): void {
    this.activeTab = tab;
    if (tab === 'statistics') this.statisticsOpened = true;
  }
}
