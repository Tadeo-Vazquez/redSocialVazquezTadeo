import { Component } from '@angular/core';
import { UserCreateForm } from '../user-create-form/user-create-form';
import { UsersList } from '../users-list/users-list';

/**
 * Agrupa la lista y el formulario de alta. Cuando el formulario crea una
 * cuenta, la plantilla le pide a la lista que se recargue.
 */
@Component({
  imports: [UsersList, UserCreateForm],
  selector: 'app-users-tab',
  template: `
    <nav class="user-tabs" aria-label="Opciones de usuarios">
      <button
        type="button"
        [class.active]="activeTab === 'list'"
        [attr.aria-current]="activeTab === 'list' ? 'page' : null"
        (click)="activeTab = 'list'"
      >
        Listado de usuarios
      </button>
      <button
        type="button"
        [class.active]="activeTab === 'create'"
        [attr.aria-current]="activeTab === 'create' ? 'page' : null"
        (click)="activeTab = 'create'"
      >
        Crear usuario
      </button>
    </nav>
    <div [hidden]="activeTab !== 'list'">
      <app-users-list #list />
    </div>
    <div [hidden]="activeTab !== 'create'">
      <app-user-create-form (created)="list.loadUsers()" />
    </div>
  `,
  styles: `
    .user-tabs {
      display: flex;
      justify-content: center;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 26px;
    }

    .user-tabs button {
      border: 1px solid #685292;
      border-radius: 8px;
      padding: 10px 16px;
      background: transparent;
      color: #d7c6ff;
      cursor: pointer;
      font-weight: 700;
    }

    .user-tabs button.active {
      background: #a78bfa;
      color: #1a1033;
    }
  `,
})
export class UsersTab {
  activeTab: 'list' | 'create' = 'list';
}
