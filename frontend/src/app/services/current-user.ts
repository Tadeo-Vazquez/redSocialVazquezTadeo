export interface CurrentUser {
  _id?: string;
  id?: string;
  nombre?: string;
  apellido?: string;
  email?: string;
  username?: string;
  fechaNacimiento?: string;
  descripcionBreve?: string;
  avatarUrl?: string;
  perfil?: 'usuario' | 'administrador';
}
