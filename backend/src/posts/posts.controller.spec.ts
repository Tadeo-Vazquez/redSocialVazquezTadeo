import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { Types } from 'mongoose';
import request from 'supertest';
import { vi } from 'vitest';
import { AuthService } from '../auth/auth.service.js';
import { User } from '../users/users.schema.js';
import { CloudinaryService } from '../utils/cloudinary.service.js';
import { Post } from './posts.schema.js';
import { PostsController } from './posts.controller.js';
import { PostsService } from './posts.service.js';
import { ControladorComentarios } from './comentarios/comentarios.controlador.js';
import { Comentario } from './comentarios/comentarios.schema.js';
import { ServicioComentarios } from './comentarios/comentarios.service.js';

describe('DELETE /posts/:id', () => {
  let app: INestApplication;
  const jwt = new JwtService({ secret: 'test-secret' });
  const ownerId = new Types.ObjectId();
  const adminId = new Types.ObjectId();
  const otherId = new Types.ObjectId();
  const postId = new Types.ObjectId();
  let post: { usuarioId: Types.ObjectId; isDeleted: boolean; save: ReturnType<typeof vi.fn> };
  let commentModel: { find: ReturnType<typeof vi.fn>; countDocuments: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    post = { usuarioId: ownerId, isDeleted: false, save: vi.fn().mockResolvedValue(undefined) };
    const users = [
      { _id: ownerId, perfil: 'usuario' },
      { _id: adminId, perfil: 'administrador' },
      { _id: otherId, perfil: 'usuario' },
    ];
    const userModel = {
      findOne: vi.fn(({ _id }: { _id: string }) => {
        const found = users.find((user) => user._id.toString() === _id);
        const user = found ? { ...found, toObject: () => found } : null;
        const result = Promise.resolve(user);
        return Object.assign(result, { exec: () => result });
      }),
    };
    const postModel = {
      findOne: vi.fn((filter: { isDeleted?: boolean }) => {
        const found = filter.isDeleted === false && post.isDeleted ? null : post;
        const result = Promise.resolve(found);
        return Object.assign(result, { select: () => ({ exec: () => result }) });
      }),
      aggregate: vi.fn((pipeline: Array<{ $match?: { isDeleted?: boolean }; $facet?: unknown }>) => {
        const visible = pipeline[0].$match?.isDeleted === false && post.isDeleted ? [] : [post];
        const isList = pipeline.some((stage) => stage.$facet);
        return { exec: async () => isList ? [{ posts: visible, total: visible.length }] : visible };
      }),
    };
    commentModel = { find: vi.fn(), countDocuments: vi.fn() };
    const module = await Test.createTestingModule({
      controllers: [PostsController, ControladorComentarios],
      providers: [
        PostsService,
        AuthService,
        ServicioComentarios,
        { provide: JwtService, useValue: jwt },
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: getModelToken(Post.name), useValue: postModel },
        { provide: getModelToken(Comentario.name), useValue: commentModel },
        { provide: CloudinaryService, useValue: {} },
      ],
    }).compile();
    app = module.createNestApplication();
    app.use(cookieParser());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  async function tokenFor(id: Types.ObjectId): Promise<string> {
    return jwt.signAsync({ sub: id.toString() }, { expiresIn: '5m' });
  }

  it.each([
    ['autor', ownerId],
    ['administrador', adminId],
  ])('permite al %s dar de baja la publicación', async (_role, id) => {
    const token = await tokenFor(id);
    await request(app.getHttpServer())
      .delete(`/posts/${postId}`)
      .set('Cookie', `access_token=${token}`)
      .expect(200);
    expect(post.isDeleted).toBe(true);
    expect(post.save).toHaveBeenCalledOnce();

    await request(app.getHttpServer())
      .delete(`/posts/${postId}`)
      .set('Cookie', `access_token=${token}`)
      .expect(404);
  });

  it('rechaza a otro usuario aunque envíe el ID del autor o administrador', async () => {
    const token = await tokenFor(otherId);
    for (const id of [ownerId, adminId]) {
      await request(app.getHttpServer())
        .delete(`/posts/${postId}?usuarioId=${id}`)
        .set('Cookie', `access_token=${token}`)
        .send({ usuarioId: id.toString() })
        .expect(403);
    }
    expect(post.isDeleted).toBe(false);
    expect(post.save).not.toHaveBeenCalled();
  });

  it('rechaza sesiones ausentes, inválidas o de cuentas inactivas', async () => {
    await request(app.getHttpServer()).delete(`/posts/${postId}`).expect(401);
    await request(app.getHttpServer())
      .delete(`/posts/${postId}`)
      .set('Cookie', 'access_token=invalid')
      .expect(401);
    const inactiveToken = await tokenFor(new Types.ObjectId());
    await request(app.getHttpServer())
      .delete(`/posts/${postId}`)
      .set('Cookie', `access_token=${inactiveToken}`)
      .expect(401);
    expect(post.save).not.toHaveBeenCalled();
  });

  it('oculta la publicación y sus comentarios después de la baja', async () => {
    const token = await tokenFor(adminId);
    await request(app.getHttpServer())
      .delete(`/posts/${postId}`)
      .set('Cookie', `access_token=${token}`)
      .expect(200);
    const response = await request(app.getHttpServer()).get('/posts').expect(200);
    expect(response.body.posts).toEqual([]);
    await request(app.getHttpServer()).get(`/posts/${postId}`).expect(404);
    await request(app.getHttpServer()).get(`/posts/${postId}/comments`).expect(404);
    expect(commentModel.find).not.toHaveBeenCalled();
  });
});
