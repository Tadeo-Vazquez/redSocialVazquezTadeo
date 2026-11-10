import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { PostLikes } from './post-likes';
import { Posts, Post } from './posts';

describe('PostLikes', () => {
  let postLikes: PostLikes;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: Posts,
          useValue: {
            addLike: () => of({ message: '', likes: 1, likedByUser: true }),
            removeLike: () => of({ message: '', likes: 0, likedByUser: false }),
          },
        },
      ],
    });
    postLikes = TestBed.inject(PostLikes);
  });

  it('detects likes stored as either an id or populated user reference', () => {
    const post: Post = {
      _id: 'post-id',
      usuarioId: 'owner-id',
      titulo: 'Título',
      descripcion: 'Descripción',
      likes: ['user-id', { _id: 'other-user-id' }],
    };

    expect(postLikes.hasLiked(post, 'user-id')).toBe(true);
    expect(postLikes.hasLiked(post, 'other-user-id')).toBe(true);
    expect(postLikes.hasLiked(post, 'missing-user')).toBe(false);
  });

  it('applies a like response to the matching post only', () => {
    const post: Post = {
      _id: 'post-id',
      usuarioId: 'owner-id',
      titulo: 'Título',
      descripcion: 'Descripción',
      likes: [],
    };
    const otherPost: Post = { ...post, _id: 'other-post-id' };

    const updated = postLikes.applyResponse([post, otherPost], 'post-id', 'user-id', {
      message: '',
      likes: 1,
      likedByUser: true,
    });

    expect(updated[0].likes).toEqual(['user-id']);
    expect(updated[0].likesCount).toBe(1);
    expect(updated[1]).toBe(otherPost);
  });
});
