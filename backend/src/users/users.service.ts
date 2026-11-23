import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from './users.schema.js';
import { UpdateProfileDto } from './dtos/update-profile.dto.js';
import { CloudinaryService } from '../utils/cloudinary.service.js';
import bcrypt from 'bcrypt';
import { CreateUserDto } from './dtos/create-user.dto.js';

// Contiene la lógica de negocio de consulta y actualización de perfiles.
@Injectable()
export class UsersService {
  constructor(
    // Modelo Mongoose utilizado para leer y modificar documentos de MongoDB.
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    // Servicio compartido que realiza las operaciones de subida a Cloudinary.
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  /**
   * Lista cuentas activas y deshabilitadas, ordenadas de más recientes a más
   * antiguas, para que el panel pueda mostrar su estado y rehabilitarlas. La
   * conversión a perfil público evita exponer contraseñas.
   */
  async findAll() {
    const users = await this.userModel.find().sort({ createdAt: -1 }).exec();
    return users.map((user) => this.toPublicUser(user));
  }

  /**
   * Crea una cuenta desde el panel administrativo. Valida reglas que dependen
   * de varios campos, convierte la fecha, almacena solo el hash de contraseña
   * y conserva el error de duplicado como un conflicto legible para el cliente.
   */
  async create(dto: CreateUserDto, image?: Express.Multer.File) {
    if (dto.password !== dto.repetirPassword) {
      throw new BadRequestException('Las contraseñas no coinciden.');
    }

    const birthDate = new Date(dto.fechaNacimiento);
    if (Number.isNaN(birthDate.getTime()) || birthDate >= new Date()) {
      throw new BadRequestException(
        'La fecha de nacimiento debe ser anterior a la fecha actual.',
      );
    }

    // Se consultan ambos identificadores en paralelo y también se incluyen
    // cuentas deshabilitadas: sus índices únicos siguen reservando esos valores.
    const [emailExists, usernameExists] = await Promise.all([
      this.userModel.exists({ email: dto.email }),
      this.userModel.exists({ username: dto.username }),
    ]);
    if (emailExists) {
      throw new ConflictException('El correo electrónico ya está registrado.');
    }
    if (usernameExists) {
      throw new ConflictException('El nombre de usuario ya está registrado.');
    }

    // La foto es opcional para mantener compatible el alta por JSON. Cuando
    // existe, el interceptor ya la validó y normalizó antes de llegar aquí.
    const uploadedImage = image
      ? await this.cloudinaryService.uploadImage(image.buffer, 'red-social/perfiles')
      : undefined;

    try {
      const user = await this.userModel.create({
        nombre: dto.nombre,
        apellido: dto.apellido,
        email: dto.email,
        username: dto.username,
        // bcrypt agrega salt y costo de cálculo al hash; nunca se almacena la
        // contraseña recibida en texto plano.
        password: await bcrypt.hash(dto.password, 12),
        fechaNacimiento: birthDate,
        descripcionBreve: dto.descripcionBreve,
        // Guardamos la URL pública, no los bytes; sin foto se conserva el
        // avatar vacío que acepta el esquema.
        avatarUrl: uploadedImage?.secure_url ?? '',
        perfil: dto.perfil,
        isDeleted: false,
      });
      return {
        message: 'Usuario creado correctamente.',
        user: this.toPublicUser(user),
      };
    } catch (error) {
      // Si falla el alta después de subir la foto, se elimina el recurso
      // remoto para evitar que quede una imagen sin usuario asociado.
      if (uploadedImage) {
        await this.cloudinaryService.deleteImage(uploadedImage.public_id);
      }
      // La comprobación previa no evita dos altas simultáneas; los índices
      // únicos de MongoDB son la protección final ante esa condición de carrera.
      if (this.isDuplicateKeyError(error)) {
        const duplicateField = this.getDuplicateField(error);
        throw new ConflictException(
          duplicateField === 'email'
            ? 'El correo electrónico ya está registrado.'
            : 'El nombre de usuario ya está registrado.',
        );
      }
      throw error;
    }
  }

  /**
   * Deshabilita una cuenta sin borrar sus datos. El filtro exige que aún esté
   * activa, de modo que una segunda baja no se interprete como una operación
   * exitosa y las referencias históricas sigan conservándose.
   */
  async disable(id: Types.ObjectId) {
    const user = await this.userModel.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true } },
      { returnDocument: 'after' },
    );
    if (!user) {
      throw new NotFoundException('Usuario no encontrado o ya deshabilitado.');
    }
    return {
      message: 'Usuario deshabilitado correctamente.',
      user: this.toPublicUser(user),
    };
  }

  /**
   * Reactiva una cuenta previamente deshabilitada. El filtro por estado evita
   * modificar cuentas activas y permite informar cuando no hay ningún usuario
   * que coincida con el estado solicitado.
   */
  async enable(id: Types.ObjectId) {
    const user = await this.userModel.findOneAndUpdate(
      { _id: id, isDeleted: true },
      { $set: { isDeleted: false } },
      { returnDocument: 'after' },
    );
    if (!user) {
      throw new NotFoundException('Usuario no encontrado o ya habilitado.');
    }
    return {
      message: 'Usuario habilitado correctamente.',
      user: this.toPublicUser(user),
    };
  }

  /**
   * Busca un perfil por ObjectId y solo devuelve cuentas activas. La contraseña
   * se excluye de la respuesta aunque el documento Mongoose la contenga.
   */
  async findProfile(id: Types.ObjectId) {
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

  /**
   * Actualiza solo los campos enviados. La fecha se convierte a Date y la
   * imagen, si existe, se sube antes de guardar su URL pública en MongoDB.
   */
  async updateProfile(
    id: Types.ObjectId,
    dto: UpdateProfileDto,
    image?: Express.Multer.File,
  ) {
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
    // Si llega una imagen, se guarda en Cloudinary y se actualiza la URL del avatar.
    if (image) {
      const uploadedImage = await this.cloudinaryService.uploadImage(
        image.buffer,
        'red-social/perfiles',
      );
      // MongoDB guarda la URL HTTPS devuelta por Cloudinary, no el archivo local.
      update.avatarUrl = uploadedImage.secure_url;
    }

    // $set modifica solo las propiedades presentes, por lo que las omitidas se
    // conservan. runValidators vuelve a aplicar las reglas del esquema al update.
    const user = await this.userModel.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: update },
      { returnDocument: 'after', runValidators: true },
    );

    if (!user) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    return {
      message: 'Perfil actualizado correctamente.',
      user: this.toPublicUser(user),
    };
  }

  // Convierte el documento a un objeto normal y omite password para impedir
  // que el hash se filtre en los perfiles que devuelve la API.
  private toPublicUser(user: UserDocument) {
    const result = user.toObject();
    const { password: _password, ...publicUser } = result;
    return publicUser;
  }

  // Recibe unknown porque un catch puede capturar cualquier valor, no solo
  // una instancia de Error con una forma conocida.
  private isDuplicateKeyError(error: unknown): error is {
    // El código numérico identifica el tipo de error de MongoDB.
    code: number;
    // keyPattern describe qué campo del índice único provocó la colisión.
    keyPattern?: Record<string, number>;
    // keyValue contiene el nombre del campo y el valor que intentó guardarse.
    keyValue?: Record<string, unknown>;
  } {
    return (
      // Primero confirma que el valor sea un objeto: no se pueden buscar
      // propiedades de forma segura en valores como strings o números.
      typeof error === 'object' &&
      // En JavaScript, typeof null también es "object", por eso se descarta
      // null explícitamente antes de comprobar propiedades.
      error !== null &&
      // El operador in verifica que el objeto tenga una propiedad llamada code.
      'code' in error &&
      // El código 11000 indica que MongoDB rechazó un valor duplicado
      // protegido por un índice único, como email o username.
      error.code === 11000
    );
  }

  // Determina qué dato único chocó para poder devolver un mensaje específico.
  // Devuelve email o username; undefined significa que no pudo reconocerlo.
  private getDuplicateField(error: {
    // MongoDB puede indicar el campo a través de la definición del índice.
    keyPattern?: Record<string, number>;
    // O puede informar directamente el campo y el valor duplicado.
    keyValue?: Record<string, unknown>;
  }): string | undefined {
    // Dependiendo del formato del error del driver, el campo puede aparecer
    // en keyPattern (índice) o keyValue (valor que intentó guardarse).
    // El ?. evita acceder a email si keyPattern no fue incluido en el error.
    // El valor 1 indica que email forma parte del índice que colisionó.
    if (error.keyPattern?.email === 1) return 'email';
    // Hace la misma comprobación para el índice único de username.
    if (error.keyPattern?.username === 1) return 'username';
    // Si no vino keyPattern, "email" in keyValue comprueba que la propiedad
    // existe sin asumir que todos los errores incluyen ese campo.
    if (error.keyValue && 'email' in error.keyValue) return 'email';
    // Repite la comprobación para username cuando MongoDB informa keyValue.
    if (error.keyValue && 'username' in error.keyValue) return 'username';
    // No inventa el campo cuando ninguna de las dos formas permitió detectarlo.
    return undefined;
  }
}
