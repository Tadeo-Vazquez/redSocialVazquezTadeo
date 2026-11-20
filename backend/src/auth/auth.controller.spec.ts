import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { vi } from 'vitest';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { AUTH_TOKEN_TTL_MINUTES } from './auth.constants.js';

describe('AuthController cookies', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const result = { accessToken: 'token', user: { username: 'test' } };
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{
        provide: AuthService,
        useValue: {
          login: vi.fn().mockResolvedValue(result),
          register: vi.fn().mockResolvedValue(result),
          refresh: vi.fn().mockResolvedValue(result),
        },
      }],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    vi.unstubAllEnvs();
  });

  it.each([
    { environment: 'development', sameSite: 'Lax', secure: false },
    { environment: 'production', sameSite: 'None', secure: true },
  ])('emite y elimina cookies válidas en $environment', async ({ environment, sameSite, secure }) => {
    vi.stubEnv('NODE_ENV', environment);

    for (const [path, status] of [
      ['/auth/login', 200],
      ['/auth/register', 201],
      ['/auth/refrescar', 200],
    ] as const) {
      const response = await request(app.getHttpServer())
        .post(path)
        .send({ loginInput: 'test', email: 'test@example.com' })
        .expect(status);
      const [cookie] = response.headers['set-cookie'] as string[];

      expect(cookie).toContain('access_token=token;');
      expect(cookie).toContain(`Max-Age=${AUTH_TOKEN_TTL_MINUTES * 60}`);
      expect(cookie).toContain('Path=/');
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain(`SameSite=${sameSite}`);
      expect(cookie.includes('; Secure')).toBe(secure);
      expect(response.body).not.toHaveProperty('accessToken');
    }

    const response = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', 'access_token=token')
      .expect(204);
    const [cookie] = response.headers['set-cookie'] as string[];

    expect(cookie).toContain('access_token=;');
    expect(cookie).toContain('Expires=Thu, 01 Jan 1970');
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain(`SameSite=${sameSite}`);
    expect(cookie.includes('; Secure')).toBe(secure);
  });
});
