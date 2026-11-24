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
    <app-users-list #list />
    <app-user-create-form (created)="list.loadUsers()" />
  `,
})
export class UsersTab {}
