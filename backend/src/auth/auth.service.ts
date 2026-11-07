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
  // Logger usado para registrar cada etapa importante del registro y del inicio de sesión.
  private readonly logger = new Logger(AuthService.name);

  constructor(
    // Modelo de Mongoose que permite consultar y crear documentos de usuarios.
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    // Servicio encargado de enviar las imágenes de perfil a Cloudinary.
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  // Crea una cuenta nueva luego de validar los datos y comprobar que no exista el usuario.
  async register(dto: RegisterDto, image?: Express.Multer.File) {
    // Los dos campos de contraseña deben coincidir antes de continuar.
    if (dto.password !== dto.repetirPassword) {
      throw new BadRequestException('Las contraseñas no coinciden.');
    }
    // El registro requiere obligatoriamente una imagen de perfil.
    if (!image) {
      throw new BadRequestException('La imagen de perfil es obligatoria.');
    }

    // Convierte la fecha recibida como texto a un objeto Date de JavaScript.
    const birthDate = new Date(dto.fechaNacimiento);
    // Impide registrar fechas de nacimiento iguales a hoy o futuras.
    if (birthDate >= new Date()) {
      throw new BadRequestException(
        'La fecha de nacimiento debe ser anterior a la fecha actual.',
      );
    }

    this.logger.log(
      `Registro iniciado: buscando un usuario existente con email ${dto.email} o username ${dto.username}`,
    );
    // Ejecuta ambas búsquedas al mismo tiempo para verificar que el email y el username estén disponibles.
    const [emailExists, usernameExists] = await Promise.all([
      this.userModel.exists({ email: dto.email, isDeleted: false }),
      this.userModel.exists({ username: dto.username, isDeleted: false }),
    ]);

    // Rechaza el registro si el correo ya pertenece a una cuenta activa.
    if (emailExists) {
      this.logger.warn(`Registro rechazado: el email ${dto.email} ya está registrado`);
      throw new ConflictException('El correo electrónico ya está registrado.');
    }
    // Rechaza el registro si el nombre de usuario ya pertenece a una cuenta activa.
    if (usernameExists) {
      this.logger.warn(
        `Registro rechazado: el username ${dto.username} ya está registrado`,
      );
      throw new ConflictException('El nombre de usuario ya está registrado.');
    }

    this.logger.log(`Registro: iniciando hasheo de la contraseña para ${dto.email}`);
    // Convierte la contraseña en un hash seguro antes de almacenarla; 12 define el costo de bcrypt.
    const password = await bcrypt.hash(dto.password, 12);
    this.logger.log(`Registro: contraseña hasheada para ${dto.email}`);
    // Sube el contenido binario de la imagen y organiza el archivo dentro de una carpeta de Cloudinary.
    const uploadedImage = await this.cloudinaryService.uploadImage(
      image.buffer,
      'red-social/perfiles',
    );
    let createdUser: UserDocument;

    try {
      // Crea el documento final en MongoDB con los datos validados y la URL segura de la imagen.
      createdUser = await this.userModel.create({
        nombre: dto.nombre,
        apellido: dto.apellido,
        email: dto.email,
        username: dto.username,
        password,
        fechaNacimiento: birthDate,
        descripcionBreve: dto.descripcionBreve,
        avatarUrl: uploadedImage.secure_url,
        perfil: dto.perfil === 'administrador' ? 'administrador' : 'usuario',
        isDeleted: false,
      });
    } catch (error) {
      // MongoDB puede rechazar duplicados incluso si pasaron las búsquedas previas.
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
    // Devuelve únicamente un mensaje y los datos públicos del usuario recién creado.
    return {
      message: 'Usuario registrado correctamente.',
      user: this.toPublicUser(createdUser),
    };
  }

  // Verifica las credenciales e inicia conceptualmente la sesión del usuario.
  async login(dto: LoginDto) {
    this.logger.log(
      `Login: buscando usuario por email o username con el identificador ${dto.loginInput}`,
    );
    // Permite usar el correo o el nombre de usuario; además, excluye cuentas eliminadas.
    const user = await this.userModel
      .findOne({
        $or: [{ email: dto.loginInput }, { username: dto.loginInput }],
        isDeleted: false,
      })
      // Solicita explícitamente la contraseña, porque el esquema puede ocultarla por defecto.
      .select('+password')
      .exec();

    // No revela si el identificador existe ni muestra una diferencia entre ambos errores.
    if (!user) {
      this.logger.warn(
        `Login: no se encontró un usuario para el identificador ${dto.loginInput}`,
      );
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    this.logger.log(
      `Login: iniciando comparación del hash de contraseña para el usuario ${dto.loginInput}`,
    );
    // Compara la contraseña ingresada con el hash almacenado sin guardar texto plano.
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
    // Respuesta pública con los datos básicos del usuario autenticado.
    return {
      message: 'Inicio de sesión correcto.',
      user: this.toPublicUser(user),
    };
  }

  // Prepara una representación segura del usuario para no enviar su contraseña.
  private toPublicUser(user: UserDocument) {
    const result = user.toObject();
    const { password: _password, ...publicUser } = result;
    return publicUser;
  }

  // Comprueba si el error recibido corresponde al código 11000 de MongoDB por clave duplicada.
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

  // Identifica si el duplicado proviene del correo o del nombre de usuario.
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
