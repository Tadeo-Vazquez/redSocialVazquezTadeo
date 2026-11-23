import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import sharp from 'sharp';
import { vi } from 'vitest';
import { AuthService } from '../auth/auth.service.js';
import { AdminGuard } from '../auth/guards/admin.guard.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

describe('administrative user routes', () => {
  let app: INestApplication;
  const usersService = {
    findAll: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ user: { username: 'new-user' } }),
    disable: vi.fn().mockResolvedValue({ message: 'disabled' }),
    enable: vi.fn().mockResolvedValue({ message: 'enabled' }),
  };
  const authService = {
    authorize: vi.fn(async (token?: string) => {
      if (!token) throw new UnauthorizedException();
      return {
        user: {
          perfil: token === 'admin-token' ? 'administrador' : 'usuario',
        },
      };
    }),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        AdminGuard,
        { provide: UsersService, useValue: usersService },
        { provide: AuthService, useValue: authService },
      ],
    }).compile();
    app = module.createNestApplication();
    app.use(cookieParser());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('requires an active administrator for administrative routes', async () => {
    await request(app.getHttpServer()).get('/users').expect(401);
    await request(app.getHttpServer())
      .get('/users')
      .set('Cookie', 'access_token=user-token')
      .expect(403);
    await request(app.getHttpServer())
      .get('/users')
      .set('Cookie', 'access_token=admin-token')
      .expect(200, []);
  });

  it('allows administrators to create, disable, and re-enable users', async () => {
    const cookie = 'access_token=admin-token';

    await request(app.getHttpServer())
      .post('/users')
      .set('Cookie', cookie)
      .send({})
      .expect(201);
    await request(app.getHttpServer())
      .delete('/users/507f1f77bcf86cd799439011')
      .set('Cookie', cookie)
      .expect(200);
    await request(app.getHttpServer())
      .post('/users/507f1f77bcf86cd799439011/habilitar')
      .set('Cookie', cookie)
      .expect(200);

    expect(usersService.create).toHaveBeenCalledOnce();
    expect(usersService.disable).toHaveBeenCalledOnce();
    expect(usersService.enable).toHaveBeenCalledOnce();
  });

  it('accepts and normalizes a profile image for an administrator', async () => {
    const image = await sharp({
      create: { width: 2, height: 2, channels: 3, background: '#ffffff' },
    }).png().toBuffer();
    await request(app.getHttpServer())
      .post('/users')
      .set('Cookie', 'access_token=admin-token')
      .field('nombre', 'Ana')
      .attach('image', image, { filename: 'avatar.png', contentType: 'image/png' })
      .expect(201);
    expect(usersService.create).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: 'Ana' }),
      expect.objectContaining({ mimetype: 'image/webp' }),
    );
  });
});
