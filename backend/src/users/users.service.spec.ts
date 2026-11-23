import { ConflictException } from '@nestjs/common';
import type { Model } from 'mongoose';
import { vi } from 'vitest';
import type { CloudinaryService } from '../utils/cloudinary.service.js';
import type { UserDocument } from './users.schema.js';
import { UsersService } from './users.service.js';
import type { CreateUserDto } from './dtos/create-user.dto.js';

describe('administrative user creation with image', () => {
  const dto: CreateUserDto = {
    nombre: 'Ana',
    apellido: 'Perez',
    email: 'ana@example.com',
    username: 'ana',
    password: 'Password1',
    repetirPassword: 'Password1',
    fechaNacimiento: '2000-01-01',
    descripcionBreve: 'Hola',
    perfil: 'administrador',
  };
  const image = { buffer: Buffer.from('image') } as Express.Multer.File;
  const userModel = {
    exists: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
  };
  const cloudinary = {
    uploadImage: vi.fn().mockResolvedValue({
      secure_url: 'https://example.com/avatar.webp',
      public_id: 'avatar-id',
    }),
    deleteImage: vi.fn().mockResolvedValue(undefined),
  };
  const service = new UsersService(
    userModel as unknown as Model<UserDocument>,
    cloudinary as unknown as CloudinaryService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stores the uploaded avatar and excludes the password from the response', async () => {
    userModel.create.mockResolvedValue({
      toObject: () => ({ username: 'ana', password: 'hash', perfil: 'administrador' }),
    });
    const result = await service.create(dto, image);
    expect(cloudinary.uploadImage).toHaveBeenCalledWith(image.buffer, 'red-social/perfiles');
    expect(userModel.create).toHaveBeenCalledWith(expect.objectContaining({
      avatarUrl: 'https://example.com/avatar.webp',
      perfil: 'administrador',
    }));
    expect(result.user).not.toHaveProperty('password');
  });

  it('removes the uploaded image if database creation fails', async () => {
    userModel.create.mockRejectedValue({ code: 11000, keyPattern: { email: 1 } });
    await expect(service.create(dto, image)).rejects.toBeInstanceOf(ConflictException);
    expect(cloudinary.deleteImage).toHaveBeenCalledWith('avatar-id');
  });
});
