import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

describe('AuthController logout', () => {
  let app: INestApplication;

  beforeEach(async () => {
    // Creamos una aplicación Nest aislada con el controlador real. logout no
    // utiliza AuthService, por lo que un objeto vacío evita depender de MongoDB.
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: {} }],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('elimina la cookie de sesión', async () => {
    // Supertest envía una petición HTTP a la aplicación de prueba y comprueba
    // que el cierre de sesión responda 204, sin necesitar un navegador real.
    const response = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', 'access_token=token')
      .expect(204);

    // El encabezado debe vaciar la cookie y establecer su vencimiento, manteniendo
    // la ruta y las opciones HttpOnly y SameSite usadas por la cookie original.
    expect(response.headers['set-cookie']).toEqual([
      expect.stringMatching(/^access_token=;.*Path=\/;.*Expires=.*HttpOnly; SameSite=Lax/),
    ]);
  });
});
