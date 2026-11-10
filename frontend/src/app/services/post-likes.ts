import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { LikeActionResponse, Post, Posts } from './posts';

export interface PostLikeAction {
  alreadyLiked: boolean;
  request: Observable<LikeActionResponse>;
}

@Injectable({
  providedIn: 'root',
})
export class PostLikes {
  private readonly postsService = inject(Posts);

  hasLiked(post: Post, userId: string): boolean {
    return (
      !!userId &&
      (post.likes ?? []).some((like) =>
        typeof like === 'string' ? like === userId : like._id === userId,
      )
    );
  }

  toggle(post: Post, userId: string): PostLikeAction {
    const alreadyLiked = this.hasLiked(post, userId);
    return {
      alreadyLiked,
      request: alreadyLiked
        ? this.postsService.removeLike(post._id, userId)
        : this.postsService.addLike(post._id, userId),
    };
  }

  applyResponse(
    posts: Post[],
    postId: string,
    userId: string,
    response: LikeActionResponse,
  ): Post[] {
    return posts.map((post) => {
      if (post._id !== postId) {
        return post;
      }

      const likes = (post.likes ?? []).filter((like) =>
        typeof like === 'string' ? like !== userId : like._id !== userId,
      );
      if (response.likedByUser) {
        likes.push(userId);
      }

      return { ...post, likes, likesCount: response.likes };
    });
  }
}
