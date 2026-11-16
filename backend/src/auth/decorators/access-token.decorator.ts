import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Obtiene el token de sesión de la cookie HttpOnly `access_token`.

 * Este decorador solo extrae el token; no lo autentica ni autoriza la petición.
 * Esas comprobaciones siguen siendo responsabilidad de AuthService, que
 * responde con un error 401 si el token falta, es inválido o expiró.
 */
export const AccessToken = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | undefined => {
    // El contexto puede representar distintas plataformas; en este caso,
    // seleccionamos la request HTTP de Express que recibe las cookies.
    const request = context.switchToHttp().getRequest<Request>();

    // El valor se trata como unknown porque los datos de la request no deben
    // considerarse confiables. Solo aceptamos una cookie con formato string;
    // si falta o tiene otro formato, AuthService recibirá undefined.
    const cookieValue: unknown = request.cookies?.access_token;
    return typeof cookieValue === 'string' ? cookieValue : undefined;
  },
);
