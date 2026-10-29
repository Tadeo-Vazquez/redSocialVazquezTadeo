# Instrucciones del Proyecto: TP2 Programación IV (UTN FRA) - Red Social

## Contexto General y Arquitectura
Este repositorio contiene el desarrollo del TP2 (Segundo Parcial) de la materia Programación IV (UTN Avellaneda)[cite: 1].
La aplicación es una Red Social dividida en dos proyectos dentro del mismo repositorio[cite: 1]:
- `/frontend`: Aplicación web en Angular[cite: 1].
- `/backend`: Servidor API REST en NestJS con base de datos MongoDB[cite: 1].

---

## Reglas Estrictas de Negocio y Buenas Prácticas

### 1. Codigos de Estado HTTP (Backend)
- **Cero falsos status:** La API NUNCA debe devolver status 200 en respuestas con error ni status 400 en respuestas correctas[cite: 1].
- **Respuestas explícitas:** Utilizar los decoradores y excepciones nativas de NestJS (`BadRequestException` para 400, `UnauthorizedException` para 401, `Created` 201, `ForbiddenException` para 403, `NotFoundException` para 404)[cite: 1, 5].

### 2. Diseño y Experiencia de Usuario (Frontend)
- **Sin HTML plano:** Diseño trabajado, limpio y uniforme a lo largo de toda la aplicación[cite: 1].
- **Sin alertas nativas:** Prohibido rotundamente el uso de `alert()`. Utilizar modales/diálogos o toasts para avisos y notificaciones[cite: 1].
- **Navegación e información:** Navegación fluida entre componentes e información clara/completa al realizar acciones o mostrar mensajes de error/éxito[cite: 1].

---

## Detalle de Requisitos por Sprint (Sprints 1 al 4)

### 🚀 SPRINT 1: Estructura Base, Autenticación Inicial y Perfiles[cite: 2]

#### Frontend (Angular)[cite: 2]:
1. **Creación del proyecto Angular** y navegación entre componentes sin límites de accesibilidad iniciales[cite: 2].
2. **Favicon:** Implementar un favicon propio para la aplicación[cite: 2].
3. **Deploy:** Debe estar desplegado en un hosting[cite: 2].
4. **Componente Login:**
   - Formulario reactivo con validaciones y mensajes de error acordes[cite: 2].
   - Permite ingreso por correo o por nombre de usuario (ambos deben ser únicos en la BD)[cite: 2].
   - Validación de contraseña: mínimo 8 caracteres, al menos una letra mayúscula y al menos un número[cite: 2].
5. **Componente Registro:**
   - Formulario reactivo con validaciones y mensajes de error[cite: 2].
   - Campos requeridos: Nombre, Apellido, Correo, Nombre de usuario, Contraseña, Repetir contraseña, Fecha de nacimiento y Descripción breve[cite: 2].
   - Campo tipo `file` para la imagen de perfil[cite: 2].
6. **Componente Mi Perfil:**
   - Pantalla para ver y editar el perfil del usuario[cite: 1].
7. **Perfiles/Roles:**
   - Todo usuario tiene el atributo `perfil`. Por defecto es `"usuario"`, pero puede modificarse a `"administrador"`[cite: 2].

#### Backend (NestJS + MongoDB)[cite: 1, 2]:
1. **Creación del proyecto NestJS** y conexión a MongoDB mediante Mongoose[cite: 1, 2].
2. **Módulos obligatorios:** `Autenticación`, `Usuarios` y `Publicaciones`[cite: 2].
3. **Módulo Autenticación:**
   - **Ruta Registro (`POST`):**
     - Recibe datos del usuario, los valida mediante DTOs/`class-validator` y los guarda en la BD[cite: 2].
     - La contraseña debe guardarse estrictamente encriptada (`bcrypt`)[cite: 3].
     - Recibe la imagen de perfil (usar `Multer`), la almacena apropiadamente y guarda su URL en la BD[cite: 3].
   - **Ruta Login (`POST`):**
     - Recibe usuario/correo y contraseña sin encriptar[cite: 3].
     - Encripta/compara la contraseña recibida para verificar el login[cite: 3].
     - Devuelve todos los datos del usuario[cite: 3].

---

### 📰 SPRINT 2: Feeds, Interacción y Lógica de Publicaciones[cite: 3]

#### Frontend (Angular)[cite: 3]:
1. **Página Publicaciones:**
   - Muestra el listado de publicaciones, ordenado por defecto por **fecha**[cite: 3].
   - Permite cambiar el ordenamiento a **por cantidad de "Me gusta"**[cite: 3].
   - Paginación: Trae una cantidad limitada de publicaciones con controles de paginación[cite: 3].
   - Componentización: Cada publicación individual debe ser un componente[cite: 3].
   - Interacción: Permitir dar y quitar "Me gusta" según corresponda[cite: 3].
   - Eliminación: El usuario debe ser capaz de eliminar sus propias publicaciones[cite: 3].
2. **Componente Mi Perfil (Ampliación):**
   - Muestra todos los datos del usuario y su foto de perfil[cite: 3].
   - Muestra las **últimas 3 publicaciones** del usuario y sus respectivos comentarios[cite: 3].

#### Backend (NestJS)[cite: 3]:
1. **Módulo Publicaciones (`PublicacionesController`):**
   - **Alta (`POST`):** Guarda una publicación relacionada a un usuario. Campos: Título, descripción/mensaje y URL de la imagen (opcional, guardando la imagen si la posee)[cite: 1, 3].
   - **Listar (`GET`):**
     - Lista publicaciones con parámetros opcionales de ordenamiento (`fecha` / `likes`)[cite: 3].
     - Permite filtrar las publicaciones de un usuario particular[cite: 3].
     - Recibe parámetros `offset` y `limit` para paginación de resultados[cite: 3].
   - **Baja lógica (`DELETE`):** Deshabilita la publicación (`isDeleted: true`). Solo puede realizarla el creador o un administrador[cite: 3].
   - **Dar "Me gusta" (`POST`):** Registra el "Me gusta" de un usuario. Un usuario solo puede dar UN "Me gusta" por publicación[cite: 3].
   - **Quitar "Me gusta" (`DELETE`):** Elimina el "Me gusta" de una publicación, solo si el usuario previamente le había dado like[cite: 3].

---

### 🔒 SPRINT 3: JWT, Comentarios, Guardias y Gestión de Sesión[cite: 4, 5]

#### Backend (NestJS)[cite: 4, 5]:
1. **Módulo Publicaciones - `ComentariosController`:**
   - **Obtener comentarios (`GET`):** Trae comentarios de una publicación específica. Paginado y ordenado con los más recientes primero[cite: 4].
   - **Agregar comentario (`POST`):** Agrega un comentario a una publicación asociando el usuario que lo realizó y la fecha[cite: 4].
   - **Editar comentario (`PUT`):** Modifica el mensaje y asigna/actualiza el atributo `modificado: true` para indicar que fue editado[cite: 4].
2. **Módulo Autenticación (Ampliación JWT):**
   - **Generación de JWT:** Las rutas Login y Registro deben generar un token JWT con payload conteniendo identificación (UUID/correo/username) y rol (`usuario` o `administrador`)[cite: 5]. Devuelto en respuesta o cookies, con **vencimiento estricto de 15 minutos**[cite: 5].
   - **Ruta Autorizar (`POST`):** Valida si el token es válido y no está vencido. Devuelve status `401 Unauthorized` si expiró/es inválido, o los datos del usuario si es válido[cite: 5].
   - **Ruta Refrescar (`POST`):** Valida que el token no esté vencido y genera un nuevo token JWT con el mismo payload por otros 15 minutos[cite: 5].

#### Frontend (Angular)[cite: 4]:
1. **Pantalla Publicación (Detalle):**
   - Muestra la publicación en tamaño grande con sus comentarios ordenados uno debajo del otro[cite: 4].
   - Permite escribir nuevos comentarios[cite: 4].
   - Carga inicial limitada de comentarios con botón "Cargar más" que trae nuevos sin ocultar los anteriores[cite: 4].
   - Edición: El autor de un comentario puede editarlo, mostrando la etiqueta de que fue editado[cite: 4].
2. **Login y Registro:**
   - Al autenticarse, guardar el token JWT devuelto en `localStorage` o utilizar cookies[cite: 4].
3. **Pantalla Cargando (Splash/Spinner Initializer):**
   - Al iniciar la app, muestra pantalla con spinner mientras se valida contra la ruta `/auth/authorize`[cite: 4].
   - Si es válido: Redirige a Publicaciones[cite: 4].
   - Si es inválido/expiró: Redirige a Login[cite: 4].
4. **Manejo de Sesión a Nivel Aplicación:**
   - **Temporizador:** Al iniciar sesión, arranca un contador de 10 minutos[cite: 4].
   - **Aviso Expiración:** Al llegar a los 10 min (quedando 5 min de sesión), muestra un modal informando el tiempo restante y preguntando si desea extender la sesión. Si acepta, llama a `/auth/refresh`[cite: 4].
   - **Interceptor HTTP:** Si cualquier petición devuelve error `401 Unauthorized`, redirigir al Login[cite: 4].

---

### 👑 SPRINT 4: Panel Administrador, Métricas, PWA y Personalizaciones[cite: 5, 6, 7]

#### Backend (NestJS)[cite: 6, 7]:
1. **Módulo Usuarios (`UsuariosController`):**
   - Todas las rutas deben validar mediante Guards que el token pertenezca a un perfil `administrador`[cite: 6].
   - **GET:** Listado completo de usuarios[cite: 6].
   - **POST:** Alta de un nuevo usuario, pudiendo establecer su rol como `usuario` o `administrador`[cite: 6].
   - **DELETE:** Baja lógica (deshabilita al usuario)[cite: 6]. Si intenta ingresar a la app estando deshabilitado, el login debe notificarle que no está autorizado[cite: 6].
   - **POST (Rehabilitar):** Alta lógica, reactiva al usuario para permitirle acceder nuevamente[cite: 7].
2. **Módulo Publicaciones - `EstadisticasController`:**
   - Rutas `GET` protegidas para administradores que calculen los datos requeridos por los gráficos del front[cite: 7].

#### Frontend (Angular)[cite: 5, 6]:
1. **Modo Administrador en Feeds:**
   - Si se loguea un `administrador`, habilitar botones para dar de baja cualquier publicación en la vista principal o detalle (desaparece la publicación y sus comentarios)[cite: 5].
2. **Dashboard / Usuarios (Solo Admin):**
   - Vista para listar todos los usuarios[cite: 5].
   - Formulario para crear usuarios seleccionando mediante dos radio buttons si es "usuario" o "administrador"[cite: 5].
   - Botones para realizar alta y baja lógica (habilitar/deshabilitar)[cite: 5].
3. **Dashboard / Estadísticas (Solo Admin):**
   - Integrar gráficos variados (barras, torta, líneas, etc.)[cite: 6].
   - **Métrica 1:** Cantidad de publicaciones realizadas por cada usuario en un lapso de tiempo (con selector de rango de fecha)[cite: 6].
   - **Métrica 2:** Cantidad de comentarios realizados en un lapso de tiempo (con selector de fecha)[cite: 6].
   - **Métrica 3:** Cantidad de comentarios en cada publicación en un lapso de tiempo (con selector de fecha)[cite: 6].
4. **PWA:** Configurar la app como Progressive Web App[cite: 6].
5. **Personalizaciones Angular:**
   - Implementar **3 Pipes propias** (ej. formateo relativo de fechas, truncado de texto, badges)[cite: 6].
   - Implementar **3 Directivas propias** (ej. resaltado hover, directiva estructural de roles, directiva de imagen fallback)[cite: 6].

---

## Guía de Código y Arquitectura

### Backend (NestJS)
- Utilizar DTOs con `class-validator` y `class-transformer` para toda la validación de entrada[cite: 1, 2].
- Separar estrictamente la lógica de negocio en Servicios (`Injectable`) y dejar Controladores limpios[cite: 3].
- Mongoose Schemas con timestamps nativos (`createdAt`, `updatedAt`) y campos `isDeleted: Boolean` para borrado lógico[cite: 3, 6].

### Frontend (Angular)
- Organizar por módulos o componentes Standalone agrupados en `core/`, `features/` y `shared/`[cite: 2].
- Uso de `ReactiveFormsModule` para todos los formularios[cite: 2].
- Manejo de token con `HttpInterceptor`[cite: 4].
- Uso de Guards (`AuthGuard`, `RoleGuard`) para proteger rutas en el `RouterModule`[cite: 5, 6].