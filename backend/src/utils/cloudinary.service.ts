import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  constructor(configService: ConfigService) {
    // Cloudinary mantiene esta configuración en su cliente compartido. El
    // secreto se lee del entorno y nunca se incluye en respuestas de la API.
    cloudinary.config({
      cloud_name: configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: configService.get<string>('CLOUDINARY_API_SECRET'),
      secure: true,
    });
  }

  async uploadImage(
    buffer: Buffer,
    folder = 'red-social/perfiles',
  ): Promise<UploadApiResponse> {
    // El SDK transmite el archivo como stream y reporta el resultado mediante
    // callback; Promise permite que los servicios Nest lo esperen con await.
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
          // Normaliza el formato de salida para almacenar y servir imágenes web.
          format: 'webp',
        },
        (error, result) => {
          if (error || !result) {
            reject(
              new BadGatewayException(
                'No se pudo subir la imagen a Cloudinary.',
              ),
            );
            return;
          }
          resolve(result);
        },
      );

      stream.end(buffer);
    });
  }

  // publicId es el identificador interno de Cloudinary, no la URL visible;
  // el recurso se indica como imagen para borrar el tipo de archivo correcto.
  async deleteImage(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
  }
}
