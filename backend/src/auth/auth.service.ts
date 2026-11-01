import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import bcrypt from 'bcrypt';
import { User, UserDocument } from '../users/users.schema.js';
import { RegisterDto } from './dtos/register.dto.js';
import { LoginDto } from './dtos/login.dto.js';
import { CloudinaryService } from '../utils/cloudinary.service.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async register(dto: RegisterDto, image?: Express.Multer.File) {
    if (dto.password !== dto.repetirPassword) {
      throw new BadRequestException('Las contraseñas no coinciden.');
    }
    if (!image) {
      throw new BadRequestException('La imagen de perfil es obligatoria.');
    }

    const birthDate = new Date(dto.fechaNacimiento);
    if (birthDate >= new Date()) {
      throw new BadRequestException(
        'La fecha de nacimiento debe ser anterior a la fecha actual.',
      );
    }

    this.logger.log(
      `Registro iniciado: buscando un usuario existente con email ${dto.email} o username ${dto.username}`,
    );
    const [emailExists, usernameExists] = await Promise.all([
      this.userModel.exists({ email: dto.email, isDeleted: false }),
      this.userModel.exists({ username: dto.username, isDeleted: false }),
    ]);

    if (emailExists) {
      this.logger.warn(`Registro rechazado: el email ${dto.email} ya está registrado`);
      throw new ConflictException('El correo electrónico ya está registrado.');
    }
    if (usernameExists) {
      this.logger.warn(
        `Registro rechazado: el username ${dto.username} ya está registrado`,
      );
      throw new ConflictException('El nombre de usuario ya está registrado.');
    }

    this.logger.log(`Registro: iniciando hasheo de la contraseña para ${dto.email}`);
    const password = await bcrypt.hash(dto.password, 12);
    this.logger.log(`Registro: contraseña hasheada para ${dto.email}`);
    const uploadedImage = await this.cloudinaryService.uploadImage(
      image.buffer,
      'red-social/perfiles',
    );
    let createdUser: UserDocument;

    try {
      createdUser = await this.userModel.create({
        nombre: dto.nombre,
        apellido: dto.apellido,
        email: dto.email,
        username: dto.username,
        password,
        fechaNacimiento: birthDate,
        descripcionBreve: dto.descripcionBreve,
        avatarUrl: uploadedImage.secure_url,
        perfil: 'usuario',
        isDeleted: false,
      });
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        const duplicateField = this.getDuplicateField(error);
        this.logger.warn(
          `Registro rechazado por duplicado: ${duplicateField ?? 'usuario'} ya está registrado`,
        );
        throw new ConflictException(
          duplicateField === 'email'
            ? 'El correo electrónico ya está registrado.'
            : 'El nombre de usuario ya está registrado.',
        );
      }
      throw error;
    }

    this.logger.log(
      `Registro guardado en la base de datos: usuario creado con ID ${createdUser._id} y email ${createdUser.email}`,
    );
    return {
      message: 'Usuario registrado correctamente.',
      user: this.toPublicUser(createdUser),
    };
  }

  async login(dto: LoginDto) {
    this.logger.log(
      `Login: buscando usuario por email o username con el identificador ${dto.loginInput}`,
    );
    const user = await this.userModel
      .findOne({
        $or: [{ email: dto.loginInput }, { username: dto.loginInput }],
        isDeleted: false,
      })
      .select('+password')
      .exec();

    if (!user) {
      this.logger.warn(
        `Login: no se encontró un usuario para el identificador ${dto.loginInput}`,
      );
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    this.logger.log(
      `Login: iniciando comparación del hash de contraseña para el usuario ${dto.loginInput}`,
    );
    const passwordMatches = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatches) {
      this.logger.warn(
        `Login: contraseña incorrecta para el usuario ${dto.loginInput}`,
      );
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    this.logger.log(
      `Login exitoso para ${user.email}: credenciales válidas y autenticación completada`,
    );
    return {
      message: 'Inicio de sesión correcto.',
      user: this.toPublicUser(user),
    };
  }

  private toPublicUser(user: UserDocument) {
    const result = user.toObject();
    const { password: _password, ...publicUser } = result;
    return publicUser;
  }

  private isDuplicateKeyError(error: unknown): error is {
    code: number;
    keyPattern?: Record<string, number>;
    keyValue?: Record<string, unknown>;
  } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    );
  }

  private getDuplicateField(error: {
    keyPattern?: Record<string, number>;
    keyValue?: Record<string, unknown>;
  }): string | undefined {
    const keyPattern = error.keyPattern ?? {};
    if (keyPattern.email === 1) return 'email';
    if (keyPattern.username === 1) return 'username';

    const keyValue = error.keyValue ?? {};
    if ('email' in keyValue) return 'email';
    if ('username' in keyValue) return 'username';
    return undefined;
  }
}
