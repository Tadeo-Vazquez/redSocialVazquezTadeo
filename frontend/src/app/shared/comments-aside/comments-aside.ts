import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { Post } from '../../services/posts';

@Component({
  selector: 'app-comments-aside',
  templateUrl: './comments-aside.html',
  styleUrl: './comments-aside.scss',
})
export class CommentsAside {
  @Input({ required: true }) post!: Post;
  @Output() closed = new EventEmitter<void>();

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }

  close(): void {
    this.closed.emit();
  }
}
