import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { isValidObjectId, Model } from 'mongoose';
import bcrypt from 'bcrypt';
import { User, UserDocument } from '../users/users.schema.js';
import { RegisterDto } from './dtos/register.dto.js';
import { LoginDto } from './dtos/login.dto.js';
import { CloudinaryService } from '../utils/cloudinary.service.js';
import { AUTH_TOKEN_TTL_MINUTES } from './auth.constants.js';

@Injectable()
export class AuthService {
  // Logger usado para registrar cada etapa importante del registro y del inicio de sesión.
  private readonly logger = new Logger(AuthService.name);

  constructor(
    // Modelo de Mongoose que permite consultar y crear documentos de usuarios.
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    // Servicio encargado de enviar las imágenes de perfil a Cloudinary.
    private readonly cloudinaryService: CloudinaryService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Completa el alta de una cuenta: valida datos de negocio, prepara la imagen,
   * guarda al usuario y finalmente genera la respuesta de sesión.
   */
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
    // Ejecuta ambas búsquedas en paralelo porque son independientes; además de
    // acelerar el alta, permite responder si cualquiera de los identificadores ya está ocupado.
    const [emailExists, usernameExists] = await Promise.all([
      this.userModel.exists({ email: dto.email, isDeleted: false }),
      this.userModel.exists({ username: dto.username, isDeleted: false }),
    ]);

    // Rechaza el registro si el correo ya pertenece a una cuenta activa.
    if (emailExists) {
      this.logger.warn(
        `Registro rechazado: el email ${dto.email} ya está registrado`,
      );
      throw new ConflictException('El correo electrónico ya está registrado.');
    }
    // Rechaza el registro si el nombre de usuario ya pertenece a una cuenta activa.
    if (usernameExists) {
      this.logger.warn(
        `Registro rechazado: el username ${dto.username} ya está registrado`,
      );
      throw new ConflictException('El nombre de usuario ya está registrado.');
    }

    this.logger.log(
      `Registro: iniciando hasheo de la contraseña para ${dto.email}`,
    );
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
        // El rol elevado solo puede asignarse desde las rutas protegidas de
        // administración; el dato opcional enviado en el registro público se ignora.
        perfil: 'usuario',
        isDeleted: false,
      });
    } catch (error) {
      // La consulta previa mejora el mensaje, pero no evita una carrera entre
      // dos registros simultáneos. Los índices únicos de MongoDB son la garantía final.
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
    return this.createSessionResponse(
      'Usuario registrado correctamente.',
      createdUser,
    );
  }

  /**
   * Autentica usando correo o nombre de usuario y contraseña. La respuesta
   * contiene el perfil público y el JWT que el controlador coloca en una cookie.
   */
  async login(dto: LoginDto) {
    this.logger.log(
      `Login: buscando usuario por email o username con el identificador ${dto.loginInput}`,
    );
    // Busca por correo o nombre de usuario incluyendo cuentas deshabilitadas
    // para poder distinguirlas después de comprobar que la contraseña es válida.
    const user = await this.userModel
      .findOne({
        $or: [{ email: dto.loginInput }, { username: dto.loginInput }],
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

    if (user.isDeleted) {
      // El mensaje específico se muestra solo tras validar la contraseña, así
      // no se revela el estado de cuentas con credenciales incorrectas.
      throw new UnauthorizedException(
        'La cuenta está deshabilitada. Contactá a un administrador para rehabilitarla.',
      );
    }

    this.logger.log(
      `Login exitoso para ${user.email}: credenciales válidas y autenticación completada`,
    );
    return this.createSessionResponse('Inicio de sesión correcto.', user);
  }

  /**
   * Valida la sesión actual y entrega el perfil vigente del usuario, no una
   * copia potencialmente desactualizada de los datos guardados en el JWT.
   */
  async authorize(accessToken?: string) {
    const { user, expiresAt } = await this.getActiveUserFromToken(accessToken);

    // Se devuelve el perfil actual y nunca el hash de contraseña ni el JWT.
    return {
      message: 'Sesión autorizada.',
      user: this.toPublicUser(user),
      expiresAt,
    };
  }

  /**
   * Renueva solo sesiones que todavía son válidas: primero verifica el JWT
   * existente y luego firma otro con la información actual del usuario.
   */
  async refresh(accessToken?: string) {
    // No se renueva un token vencido: primero se verifica firma y `exp` igual
    // que en /autorizar. Luego se emite otro JWT desde los datos actuales del usuario.
    const { user } = await this.getActiveUserFromToken(accessToken);
    return this.createSessionResponse('Sesión renovada correctamente.', user);
  }

  /**
   * Centraliza la verificación de una sesión para autorizar y refrescar:
   * comprueba el JWT, valida su identificador y confirma que la cuenta siga activa.
   */
  private async getActiveUserFromToken(
    accessToken?: string,
  ): Promise<{ user: UserDocument; expiresAt: number }> {
    // Sin cookie no existe una sesión que se pueda validar; se usa 401 para
    // que el frontend sepa que debe pedir login en lugar de tratarlo como error 200.
    if (!accessToken) {
      throw new UnauthorizedException('No hay una sesión activa.');
    }

    let payload: { sub?: unknown; exp?: unknown };
    try {
      // verifyAsync comprueba la firma con JWT_SECRET y el vencimiento `exp`;
      // también rechaza tokens alterados o firmados con otra clave.
      payload = await this.jwtService.verifyAsync<{
        sub?: unknown;
        exp?: unknown;
      }>(accessToken);
    } catch {
      throw new UnauthorizedException('El token es inválido o expiró.');
    }

    // `sub` identifica al usuario. Validar su formato antes de consultar Mongo
    // evita errores de casteo si el token contiene un identificador mal formado.
    if (typeof payload.sub !== 'string' || !isValidObjectId(payload.sub)) {
      throw new UnauthorizedException(
        'El token no identifica un usuario válido.',
      );
    }
    if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) {
      throw new UnauthorizedException(
        'El token no tiene una fecha de expiración válida.',
      );
    }

    // El token podría seguir vigente aunque la cuenta haya sido deshabilitada
    // después del login, por eso se confirma el estado actual en la base de datos.
    const user = await this.userModel
      .findOne({ _id: payload.sub, isDeleted: false })
      .exec();
    if (!user) {
      throw new UnauthorizedException(
        'La cuenta no existe o está deshabilitada.',
      );
    }

    return { user, expiresAt: payload.exp * 1000 };
  }

  /**
   * Construye la forma común de las respuestas de login, registro y refresh.
   * El controlador separa accessToken del JSON y lo envía en una cookie HttpOnly.
   */
  private async createSessionResponse(message: string, user: UserDocument) {
    // Firma un token con la identidad y el rol ya guardados en la base de datos.
    // `sub` (subject) es el identificador estable del usuario; `role` habilitará
    // comprobaciones de permisos y `username` evita consultar el nombre en cada request.
    const issuedAt = Math.floor(Date.now() / 1000);
    const accessToken = await this.jwtService.signAsync({
      iat: issuedAt,
      sub: user._id.toString(),
      username: user.username,
      // role conserva compatibilidad con consumidores existentes; rol es el
      // nombre de claim requerido por el contrato del sprint.
      role: user.perfil,
      rol: user.perfil,
    });

    return {
      message,
      user: this.toPublicUser(user),
      expiresAt: (issuedAt + AUTH_TOKEN_TTL_MINUTES * 60) * 1000,
      // El controlador extrae este campo y lo coloca en una cookie HttpOnly;
      // no debe formar parte del JSON que recibe el frontend.
      accessToken,
    };
  }

  /**
   * Convierte el documento Mongoose a un objeto simple y excluye la contraseña
   * antes de exponer cualquier dato de usuario en una respuesta HTTP.
   */
  private toPublicUser(user: UserDocument) {
    const result = user.toObject();
    const { password: _password, ...publicUser } = result;
    return publicUser;
  }

  // Los errores de MongoDB llegan como unknown; esta guarda verifica primero
  // su forma y su código antes de leer campos propios de un duplicado.
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

  // MongoDB incluye la clave duplicada en keyPattern o keyValue; se revisan
  // ambas formas para conservar un mensaje útil sin exponer el error interno.
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
