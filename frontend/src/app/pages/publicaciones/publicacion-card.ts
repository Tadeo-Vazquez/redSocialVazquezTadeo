import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormatoFechaPipe } from '../../pipes/formato-fecha.pipe';
import { Post } from '../../services/posts';

@Component({
  imports: [FormatoFechaPipe],
  selector: 'app-publicacion-card',
  styleUrl: './publicacion-card.scss',
  templateUrl: './publicacion-card.html',
})
export class PublicacionCard {
  @Input({ required: true }) post!: Post;
  @Input() currentUserId = '';
  @Input() actionPending = false;
  @Input() showOwnerActions = true;
  @Input() deletePending = false;
  @Input() showCommentsAction = false;

  @Output() likeRequested = new EventEmitter<Post>();
  @Output() deleteRequested = new EventEmitter<Post>();
  @Output() commentsRequested = new EventEmitter<Post>();

  get isOwnPost(): boolean {
    return this.post.usuarioId === this.currentUserId;
  }

  get hasLiked(): boolean {
    return !!this.currentUserId && (this.post.likes ?? []).some((like) =>
      typeof like === 'string'
        ? like === this.currentUserId
        : like._id === this.currentUserId,
    );
  }

  get likesCount(): number {
    return this.post.likesCount ?? this.post.likes?.length ?? 0;
  }

  get authorName(): string {
    const user = this.post.usuario;
    if (user?.username) {
      return `@${user.username}`;
    }

    const fullName = [user?.nombre, user?.apellido].filter(Boolean).join(' ');
    return fullName || 'Usuario';
  }
}
