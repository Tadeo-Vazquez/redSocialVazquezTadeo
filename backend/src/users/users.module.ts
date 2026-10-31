import { Module } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { UsersController } from './users.controller.js';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './users.schema.js';

// Agrupa el controlador, el servicio y el modelo del módulo Users.
@Module({
  imports: [
    // Registra el modelo User y permite inyectarlo en UsersService.
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  // Instancias disponibles dentro de NestJS para el módulo Users.
  providers: [UsersService],
  // Controlador que registra las rutas GET y PUT de usuarios.
  controllers: [UsersController],
  exports: [UsersService, MongooseModule],
})
export class UsersModule {}
