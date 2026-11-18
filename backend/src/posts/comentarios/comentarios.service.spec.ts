import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import { User } from '../../users/users.schema.js';
import { Post } from '../posts.schema.js';
import { Comentario } from './comentarios.schema.js';
import { ServicioComentarios } from './comentarios.service.js';

describe('ServicioComentarios: edición', () => {
  const usuarioId = new Types.ObjectId();
  const publicacionId = new Types.ObjectId();
  const comentarioId = new Types.ObjectId();
  let service: ServicioComentarios;
  let comentario: {
    usuarioId: Types.ObjectId;
    texto: string;
    modificado: boolean;
    save: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    comentario = {
      usuarioId,
      texto: 'Comentario original',
      modificado: false,
      save: vi.fn().mockResolvedValue(undefined),
    };
    const activeModel = {
      findOne: () => ({ select: () => ({ exec: async () => ({}) }) }),
    };
    const module = await Test.createTestingModule({
      providers: [
        ServicioComentarios,
        { provide: getModelToken(Comentario.name), useValue: { findOne: () => ({ exec: async () => comentario }) } },
        { provide: getModelToken(Post.name), useValue: activeModel },
        { provide: getModelToken(User.name), useValue: activeModel },
      ],
    }).compile();
    service = module.get(ServicioComentarios);
  });

  it.each([false, true])('no guarda si el texto es igual y conserva modificado=%s', async (modificado) => {
    comentario.modificado = modificado;

    const result = await service.editarComentario(publicacionId, comentarioId, {
      usuarioId: usuarioId.toString(),
      texto: 'Comentario original',
    });

    expect(result.comentario.modificado).toBe(modificado);
    expect(comentario.save).not.toHaveBeenCalled();
  });

  it('guarda y marca como modificado si el texto cambió', async () => {
    const result = await service.editarComentario(publicacionId, comentarioId, {
      usuarioId: usuarioId.toString(),
      texto: 'Texto nuevo',
    });

    expect(result.comentario.texto).toBe('Texto nuevo');
    expect(result.comentario.modificado).toBe(true);
    expect(comentario.save).toHaveBeenCalledOnce();
  });
});
