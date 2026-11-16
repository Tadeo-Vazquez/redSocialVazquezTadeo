import {
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { isValidObjectId, Types } from 'mongoose';

/**
 * Valida un parámetro de ruta y lo convierte a un ObjectId de Mongoose.
 *
 * Nest ejecuta las pipes antes de llamar al controlador. Así, los servicios
 * reciben un ID ya validado y tipado como ObjectId, y no necesitan conocer
 * cómo validar el formato de un valor que proviene de una URL.
 */
@Injectable()
export class ParseMongoIdPipe implements PipeTransform<string, Types.ObjectId> {
  transform(value: string): Types.ObjectId {
    // isValidObjectId mantiene el criterio usado previamente por los servicios
    // y evita que Mongoose lance un error de casteo durante la consulta.
    if (!isValidObjectId(value)) {
      throw new BadRequestException(
        'El identificador no es un ObjectId de MongoDB válido.',
      );
    }

    // La conversión hace explícito el tipo del dato que recibe el servicio;
    // Mongoose puede utilizar el ObjectId directamente en filtros y relaciones.
    return new Types.ObjectId(value);
  }
}
