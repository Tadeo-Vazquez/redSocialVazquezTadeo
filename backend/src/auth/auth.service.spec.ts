import { UnauthorizedException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import type { Model } from 'mongoose';
import bcrypt from 'bcrypt';
import { vi } from 'vitest';
import type { UserDocument } from '../users/users.schema.js';
import type { CloudinaryService } from '../utils/cloudinary.service.js';
import { AuthService } from './auth.service.js';

describe('AuthService disabled accounts', () => {
  it('explains that a disabled account must be re-enabled by an administrator', async () => {
    const user = {
      password: await bcrypt.hash('ValidPass1', 4),
      isDeleted: true,
    };
    const query = {
      select: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue(user),
    };
    const userModel = {
      findOne: vi.fn().mockReturnValue(query),
    } as unknown as Model<UserDocument>;
    const service = new AuthService(
      userModel,
      {} as CloudinaryService,
      {} as JwtService,
    );

    await expect(
      service.login({ loginInput: 'disabled-user', password: 'ValidPass1' }),
    ).rejects.toMatchObject({
      message:
        'La cuenta está deshabilitada. Contactá a un administrador para rehabilitarla.',
    } satisfies Partial<UnauthorizedException>);
  });
});
