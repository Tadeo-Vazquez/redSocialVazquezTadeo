import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TimeAgoPipe } from '../../pipes/time-ago.pipe';
import { Post } from '../../services/posts';

@Component({
  imports: [TimeAgoPipe, RouterLink],
  selector: 'app-publicacion-card',
  styleUrl: './publicacion-card.scss',
  templateUrl: './publicacion-card.html',
})
export class PublicacionCard {
  // La tarjeta recibe su contenido y capacidades desde el padre; de ese modo
  // puede usarse en el feed y en otras pantallas sin conocer cómo se carga la API.
  @Input({ required: true }) post!: Post;
  @Input() currentUserId = '';
  @Input() actionPending = false;
  @Input() showOwnerActions = true;
  @Input() deletePending = false;
  @Input() showCommentsAction = false;
  @Input() showFullContent = false;

  // Estas salidas comunican intenciones al componente contenedor, que conserva
  // la responsabilidad de autorizar y ejecutar las acciones.
  @Output() likeRequested = new EventEmitter<Post>();
  @Output() deleteRequested = new EventEmitter<Post>();
  @Output() commentsRequested = new EventEmitter<Post>();

  get isOwnPost(): boolean {
    return this.post.usuarioId === this.currentUserId;
  }

  get hasLiked(): boolean {
    // La API puede entregar cada like como ID o como usuario expandido; comparar
    // ambos formatos evita que el estado visual dependa de la forma de la respuesta.
    return !!this.currentUserId && (this.post.likes ?? []).some((like) =>
      typeof like === 'string'
        ? like === this.currentUserId
        : like._id === this.currentUserId,
    );
  }

  get likesCount(): number {
    // Usa el contador agregado cuando está disponible y el arreglo como alternativa
    // para respuestas que todavía no incluyen likesCount.
    return this.post.likesCount ?? this.post.likes?.length ?? 0;
  }

  get authorName(): string {
    const user = this.post.usuario;
    if (user?.username) {
      return `@${user.username}`;
    }

    // username tiene prioridad; el nombre completo permite mostrar un autor útil
    // cuando el perfil no tiene nombre de usuario.
    const fullName = [user?.nombre, user?.apellido].filter(Boolean).join(' ');
    return fullName || 'Usuario';
  }
}
