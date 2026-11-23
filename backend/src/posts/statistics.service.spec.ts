import type { Model } from 'mongoose';
import { vi } from 'vitest';
import { validate } from 'class-validator';
import { StatisticsRangeDto } from './dtos/statistics-range.dto.js';
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
    ).rejects.toThrow('La fecha de inicio no puede ser posterior a la fecha de fin.');
    expect(commentAggregate).not.toHaveBeenCalled();
  });

  it('accepts equal timestamp bounds and includes both endpoints', async () => {
    await service.postsPerUser({
      from: '2026-03-01T10:00:00Z',
      to: '2026-03-01T10:00:00Z',
    });
    expect(postModel.aggregate.mock.calls[0][0][0]).toEqual({
      $match: {
        isDeleted: false,
        createdAt: {
          $gte: new Date('2026-03-01T10:00:00Z'),
          $lte: new Date('2026-03-01T10:00:00Z'),
        },
      },
    });
  });
});

describe('StatisticsRangeDto', () => {
  it('reports invalid calendar dates in clear Spanish', async () => {
    const dto = new StatisticsRangeDto();
    dto.from = '2026-02-29';
    dto.to = 'fecha inválida';
    const errors = await validate(dto);
    expect(errors.map((error) => Object.values(error.constraints ?? {}))).toEqual([
      ['La fecha de inicio no es válida.'],
      ['La fecha de fin no es válida.'],
    ]);
  });

  it('accepts optional dates and leap days', async () => {
    const dto = new StatisticsRangeDto();
    dto.from = '2024-02-29';
    expect(await validate(dto)).toEqual([]);
    expect(await validate(new StatisticsRangeDto())).toEqual([]);
  });
});
