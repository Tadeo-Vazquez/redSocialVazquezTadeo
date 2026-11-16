import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ParseMongoIdPipe } from './parse-mongo-id.pipe.js';

describe('ParseMongoIdPipe', () => {
  const pipe = new ParseMongoIdPipe();

  it('converts a valid MongoDB ID into an ObjectId', () => {
    const id = '507f1f77bcf86cd799439011';

    expect(pipe.transform(id)).toEqual(new Types.ObjectId(id));
  });

  it('rejects a value that is not a valid MongoDB ID', () => {
    expect(() => pipe.transform('not-an-object-id')).toThrow(
      BadRequestException,
    );
  });
});
