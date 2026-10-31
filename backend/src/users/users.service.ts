import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import { User, UserDocument } from './users.schema.js';
import { UpdateProfileDto } from './dtos/update-profile.dto.js';
import { CloudinaryService } from '../utils/cloudinary.service.js';

// Contiene la lógica de negocio de consulta y actualización de perfiles.
@Injectable()
export class UsersService {
  constructor(
    // Modelo Mongoose utilizado para leer y modificar documentos de MongoDB.
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    // Servicio compartido que realiza las operaciones de subida a Cloudinary.
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  // Obtiene un perfil activo por su identificador.
  async findProfile(id: string) {
    // Rechaza identificadores que no tengan el formato de ObjectId de MongoDB.
    this.validateId(id);
    // Solo devuelve usuarios que todavía están habilitados.
    const user = await this.userModel.findOne({
      _id: id,
      isDeleted: false,
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    // Elimina información privada, como la contraseña, antes de responder.
    return this.toPublicUser(user);
  }

  // Actualiza el nombre, apellido, fecha de nacimiento, descripción y/o foto.
  async updateProfile(
    id: string,
    dto: UpdateProfileDto,
    image?: Express.Multer.File,
  ) {
    this.validateId(id);
    // No se modifica fechaNacimiento directamente: primero se transforma en Date.
    const { fechaNacimiento, ...profileData } = dto;
    const update: Record<string, unknown> = { ...profileData };

    if (fechaNacimiento) {
      const birthDate = new Date(fechaNacimiento);
      if (birthDate >= new Date()) {
        throw new BadRequestException(
          'La fecha de nacimiento debe ser anterior a la fecha actual.',
        );
      }
      update.fechaNacimiento = birthDate;
    }
    // Solo se inicia una subida si el cliente envió una imagen nueva.
    if (image) {
      const uploadedImage = await this.cloudinaryService.uploadImage(
        image.buffer,
        'red-social/perfiles',
      );
      // MongoDB guarda la URL HTTPS devuelta por Cloudinary, no el archivo local.
      update.avatarUrl = uploadedImage.secure_url;
    }

    // Busca el usuario activo y aplica simultáneamente todos los cambios.
    const user = await this.userModel.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: update },
      { new: true, runValidators: true },
    );

    if (!user) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    return {
      message: 'Perfil actualizado correctamente.',
      user: this.toPublicUser(user),
    };
  }

  // Valida que el identificador recibido corresponda al formato ObjectId.
  private validateId(id: string) {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('El identificador del usuario no es válido.');
    }
  }

  // Convierte el documento de Mongoose a objeto público sin password.
  private toPublicUser(user: UserDocument) {
    const result = user.toObject();
    const { password: _password, ...publicUser } = result;
    return publicUser;
  }
}
