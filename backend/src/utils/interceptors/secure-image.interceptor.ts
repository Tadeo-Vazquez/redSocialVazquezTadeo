import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Type,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import multer from 'multer';
import sharp from 'sharp';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 20_000_000;
export const MAX_IMAGE_WIDTH = 1600;

export function SecureImageInterceptor(fieldName = 'image'): Type<NestInterceptor> {
  @Injectable()
  class SecureImageInterceptorClass implements NestInterceptor {
    async intercept(
      context: ExecutionContext,
      next: CallHandler,
    ): Promise<Observable<unknown>> {
      const request = context.switchToHttp().getRequest();
      await this.receiveFile(request, fieldName);

      if (request.file) {
        await this.normalizeAndSave(request.file as Express.Multer.File);
      }

      return next.handle();
    }

    private receiveFile(
      request: {
        file?: Express.Multer.File;
      },
      field: string,
    ): Promise<void> {
      return new Promise((resolve, reject) => {
        const upload = multer({
          storage: multer.memoryStorage(),
          limits: { fileSize: MAX_IMAGE_BYTES },
          fileFilter: (_request, file, callback) => {
            const allowedMimeTypes = [
              'image/jpeg',
              'image/png',
              'image/webp',
            ];

            if (!allowedMimeTypes.includes(file.mimetype)) {
              callback(
                new BadRequestException(
                  'Solo se permiten imágenes JPG, PNG o WEBP.',
                ),
              );
              return;
            }

            callback(null, true);
          },
        });

        upload.single(field)(
          request as never,
          {} as never,
          (error?: unknown) => {
            if (error instanceof Error) {
              reject(error);
              return;
            }
            resolve();
          },
        );
      });
    }

    private async normalizeAndSave(file: Express.Multer.File): Promise<void> {
      if (!file.buffer || file.buffer.length === 0) {
        throw new BadRequestException('La imagen está vacía.');
      }

      if (file.size > MAX_IMAGE_BYTES) {
        throw new BadRequestException(
          'La imagen no puede superar los 5 MB.',
        );
      }

      let metadata: {
        format?: string;
        width?: number;
        height?: number;
      };
      try {
        metadata = await sharp(file.buffer, { failOn: 'error' }).metadata();
      } catch {
        throw new BadRequestException('La imagen contiene datos inválidos.');
      }

      if (!metadata.format || !['jpeg', 'png', 'webp'].includes(metadata.format)) {
        throw new BadRequestException(
          'El contenido no corresponde a una imagen JPG, PNG o WEBP.',
        );
      }

      const width = metadata.width ?? 0;
      const height = metadata.height ?? 0;
      if (
        width === 0 ||
        height === 0 ||
        width * height > MAX_IMAGE_PIXELS
      ) {
        throw new BadRequestException(
          'La imagen excede el límite permitido de píxeles.',
        );
      }

      let normalizedBuffer: Buffer;
      try {
        normalizedBuffer = await sharp(file.buffer, { failOn: 'error' })
          .rotate()
          .resize({
            width: MAX_IMAGE_WIDTH,
            height: MAX_IMAGE_WIDTH,
            fit: 'inside',
            withoutEnlargement: true,
          })
          .toFormat('webp', { quality: 85 })
          .toBuffer();
      } catch {
        throw new BadRequestException('No se pudo procesar la imagen.');
      }

      file.buffer = normalizedBuffer;
      file.size = normalizedBuffer.length;
      file.mimetype = 'image/webp';
    }
  }

  return SecureImageInterceptorClass;
}
