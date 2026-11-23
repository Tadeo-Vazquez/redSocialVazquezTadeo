import { BadRequestException } from '@nestjs/common';
import type { Model } from 'mongoose';
import { vi } from 'vitest';
import type { ComentarioDocumento } from './comentarios/comentarios.schema.js';
import type { PostDocument } from './posts.schema.js';
import { StatisticsService } from './statistics.service.js';

describe('StatisticsService', () => {
  const postAggregate = vi.fn(() => ({
    exec: vi.fn().mockResolvedValue([]),
  }));
  const commentAggregate = vi.fn(() => ({
    exec: vi.fn().mockResolvedValue([]),
  }));
  const postModel = {
    aggregate: postAggregate,
  } as unknown as Model<PostDocument>;
  const commentModel = {
    aggregate: commentAggregate,
  } as unknown as Model<ComentarioDocumento>;
  const service = new StatisticsService(postModel, commentModel);

  beforeEach(() => {
    postAggregate.mockClear();
    commentAggregate.mockClear();
  });

  it('counts only active posts and includes both date-only range days', async () => {
    await service.postsPerUser({ from: '2026-03-01', to: '2026-03-05' });
    const pipeline = postModel.aggregate.mock.calls[0][0];

    expect(pipeline[0]).toEqual({
      $match: {
        isDeleted: false,
        createdAt: {
          $gte: new Date('2026-03-01T00:00:00.000Z'),
          $lt: new Date('2026-03-06T00:00:00.000Z'),
        },
      },
    });
  });

  it('excludes comments whose publication was logically deleted', async () => {
    await service.totalComments({});
    const pipeline = commentModel.aggregate.mock.calls[0][0];

    expect(pipeline[1]).toEqual({
      $lookup: {
        from: 'posts',
        let: { postId: '$publicacionId' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$_id', '$$postId'] },
                  { $eq: ['$isDeleted', false] },
                ],
              },
            },
          },
          { $project: { titulo: 1 } },
        ],
        as: 'publicacion',
      },
    });
    expect(pipeline[2]).toEqual({ $unwind: '$publicacion' });
  });

  it('rejects inverted date ranges without querying MongoDB', async () => {
    await expect(
      service.commentsPerPost({ from: '2026-03-06', to: '2026-03-05' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(commentAggregate).not.toHaveBeenCalled();
  });
});
