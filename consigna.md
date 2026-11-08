# UTN Avellaneda - Tecnicatura Universitaria en Programación
**Materia:** Programación IV  
**Nivel:** $4^{\circ}$ Cuatrimestre  
**Tipo de Examen:** Trabajo Práctico (Corresponde a Segundo parcial)  
**Ciclo:** 2026 C1  

---

## TP #2 - Red Social

### Enunciado General
Se debe realizar la aplicación **"Red social"**. 
* La forma de corrección será por sprint de una semana.
* La aplicación debe permitir a los usuarios hacer publicaciones, reaccionar y comentar las mismas.
* Cada usuario debe poder ver y editar su perfil.
* Solo se puede acceder a la aplicación estando registrado o logueado.
* La aplicación debe tener un diseño trabajado, **no HTML plano**. No utilizar `alert()`, sino modales.

### Arquitectura del Proyecto
La "Red social" será una aplicación dividida en dos proyectos (Frontend y Backend):
1. **Frontend:** Angular.
2. **Backend:** NestJS.
3. **Base de Datos:** MongoDB.
4. **Autenticación:** Login y registro de usuarios contra el servidor en Nest propio usando **JWT**.
5. **Respuestas de API:** Códigos de estado HTTP correctos (`400 Bad Request`, `401 Unauthorized`, `201 Created`, etc.). No debe haber status `200` en errores ni `400` en respuestas correctas.
6. **Publicaciones:**
   * Título, mensaje e imagen opcional.
   * Reacciones de "Me gusta".
   * Sección de comentarios.
7. **Experiencia de Usuario (UX):**
   * Diseños trabajados y uniformes.
   * Navegación clara entre pantallas.
   * Mensajes informativos y retroalimentación completa ante acciones.

---

## Requisitos por Sprint

### Sprint #1

#### Frontend (Angular)
* Creación del proyecto en Angular.
* **Pantallas iniciales:**
  * Registro
  * Login
  * Publicaciones
  * Mi Perfil
* Deploy en hosting.
* Navegación entre componentes (sin límites de accesibilidad iniciales).
* Implementar un favicon propio.
* **Componente Login:**
  * Formulario con validaciones y mensajes acordes.
  * Puede ser por correo o nombre de usuario (debe ser único en la BD).
  * Contraseña: mínimo 8 caracteres, al menos una mayúscula y un número.
* **Componente Registro:**
  * Formulario con validaciones y mensajes acordes.
  * Campos obligatorios: Nombre, Apellido, Correo, Nombre de usuario, Contraseña, Repetir contraseña, Fecha de nacimiento, Descripción breve.
  * Campo de tipo `file` para imagen de perfil.
* **Roles/Perfiles:** Atributo `perfil`. Por defecto "usuario", modificable a "administrador".

#### Backend (NestJS)
* Creación del proyecto NestJS.
* **Módulos principales:** `Publicaciones`, `Autenticación`, `Usuarios`.
* **Módulo Autenticación:**
  * `POST /registro`: Recibe datos completos, valida y guarda en BD. Encripta la contraseña. Guarda la imagen de perfil y almacena la URL en la BD.
  * `POST /login`: Recibe usuario/correo y contraseña en texto plano. Encripta para verificar credenciales. Devuelve los datos del usuario.

---

### Sprint #2

#### Frontend (Angular)
* **Página Publicaciones:**
  * Muestra el listado de publicaciones ordenadas por fecha por defecto.
  * Permitir cambiar ordenamiento por cantidad de "Me gusta".
  * Listado paginado (carga limitada).
  * Cada publicación representada por un componente.
  * Funcionalidad para dar y quitar "Me gusta".
  * Permitir eliminar publicaciones propias.
* **Componente Mi Perfil:**
  * Muestra datos del usuario y foto de perfil.
  * Muestra sus últimas 3 publicaciones y sus comentarios.

#### Backend (NestJS)
* **Módulo Publicaciones (`PublicacionesController`):**
  * Alta, listado y baja lógica de publicaciones.
  * `POST`: Guarda publicación vinculada a un usuario (Título, descripción, URL de imagen si posee). La imagen debe guardarse físicamente/almacenamiento.
  * `DELETE`: Baja lógica. Solo realizable por el creador o un administrador.
  * `GET`: Listar publicaciones recientes. Admite parámetros para:
    * Cambiar orden (`fecha` / `me_gusta`).
    * Filtrar por usuario específico.
    * Paginación (`offset` y `limit`).
  * `POST /like`: Dar "Me gusta" a una publicación (límite: 1 like por usuario por publicación).
  * `DELETE /like`: Eliminar "Me gusta" previamente otorgado por el usuario.

---

### Sprint #3

#### Frontend (Angular)
* **Página Publicación (Detalle):**
  * Vista ampliada de la publicación con todos sus comentarios.
  * Formulario/input para escribir comentarios.
  * Comentarios ordenados uno debajo de otro. Carga inicial limitada con botón "Cargar más" para no sobrecargar la vista.
  * Edición de comentarios propios (debe marcarse explícitamente cuando un comentario fue editado).
* **Pantalla Login y Registro:**
  * Almacenar el JWT token devuelto en LocalStorage o Cookies.
* **Pantalla Cargando (Splash/Spinner):**
  * Al iniciar la app, validar el token contra la ruta de autorización.
  * Si es válido $\rightarrow$ redirigir a Publicaciones.
  * Si es inválido/inexistente $\rightarrow$ redirigir a Login.
* **Gestión de Sesión a Nivel App:**
  * Temporizador de 10 minutos al iniciar sesión. Al cumplirse, mostrar un modal avisando que quedan 5 minutos de sesión (expiración total JWT: 15 minutos) con opción de extender sesión (refrescar token).
  * Ante cualquier respuesta `401 Unauthorized`, redirigir inmediatamente al login.

#### Backend (NestJS)
* **Módulo Publicaciones (`ComentariosController`):**
  * `POST`: Agrega un comentario a una publicación (asociado a usuario y fecha).
  * `PUT`: Modifica el texto del comentario. Setea el campo `modificado: true`.
  * `GET`: Obtiene comentarios de una publicación. Soporta paginación y ordena por fecha descendente (más recientes primero).
* **Módulo Autenticación:**
  * Rutas `login` y `registro`: Emiten JWT con payload conteniendo identificador (`uuid`/`correo`/`username`) y `rol` (`usuario` o `administrador`). Vencimiento: 15 minutos.
  * `POST /autorizar`: Valida vigencia y firma del token. Devuelve `401` si falla, o datos del usuario si es válido.
  * `POST /refrescar`: Valida token actual y genera uno nuevo con la misma payload por 15 minutos adicionales.

---

### Sprint #4

#### Frontend (Angular)
* **Página Publicación / Publicaciones:**
  * Si se inicia sesión con rol `administrador`, habilitar botones para dar de baja cualquier publicación (aplica baja lógica que oculta la publicación y sus comentarios).
* **Página Dashboard / Usuarios (Exclusivo Administradores):**
  * Listado general de usuarios.
  * Creación de usuarios con selección de rol (`usuario` o `administrador`) mediante *radio buttons*.
  * Alta y baja lógica de usuarios (habilitar/deshabilitar). Un usuario deshabilitado no podrá autenticarse y verá un mensaje explicativo al intentarlo.
* **Página Dashboard / Estadísticas (Exclusivo Administradores):**
  * Visualización de gráficos estadísticos dinámicos en rangos de tiempo elegibles:
    1. Cantidad de publicaciones por usuario.
    2. Cantidad total de comentarios realizados.
    3. Cantidad de comentarios por publicación.
  * Variedad en tipos de gráficos (barras, torta, líneas, etc.).
* **Nivel Aplicación:**
  * Implementar características de PWA (Progressive Web App).
  * Implementar 3 Pipes PROPIAS.
  * Implementar 3 Directivas PROPIAS.

#### Backend (NestJS)
* **Módulo Usuarios (`UsuariosController`):** *(Requiere validación de rol Administrador)*
  * `GET`: Listar todos los usuarios.
  * `POST`: Alta de nuevo usuario (permite asignar rol `administrador` o `usuario`).
  * `DELETE`: Deshabilitar usuario (baja lógica).
  * `POST /habilitar`: Alta lógica (rehabilitar usuario previamente deshabilitado).
* **Módulo Publicaciones (`EstadisticasController`):** *(Requiere validación de rol Administrador)*
  * Endpoints `GET` necesarios para alimentar los gráficos estadísticos solicitados en el frontend.

---

### Sprint #5 (Recuperatorio)

#### Frontend (Angular)
* **Pantalla Perfil de Terceros:**
  * Clickear en el nombre/foto de otro usuario navega a su perfil, mostrando sus datos públicos y sus últimas 3 publicaciones.
  * Mantener acciones administrativas (baja lógica de publicaciones por administradores).
* **Pantalla Publicaciones:**
  * Reemplazar la paginación convencional por **Scroll Infinito**.
* **Página Dashboard / Estadísticas (Nuevos Gráficos):**
  * Cantidad de ingresos (*logins*) por usuario.
  * Cantidad de visitas al perfil por parte de terceros.
  * Cantidad de "Me gusta" otorgados por día.

#### Backend (NestJS)
* Extensión de servicios y controladores para soportar visitas a perfiles, conteo de logins y métricas de likes diarios.

---

### Sprint #6 (Fecha de Final)

#### Frontend (Angular)
* **Guardado de Publicaciones:**
  * Opción para guardar/quitar publicaciones guardadas en detalle.
  * Indicador visual del estado guardado.
  * **Pantalla Guardados:** Vista dedicada para consultar e interactuar con publicaciones guardadas.
* **Compartir Publicaciones:**
  * Botón para compartir publicaciones seleccionando un usuario destinatario.
  * **Pantalla Compartidos:** Vista dedicada con publicaciones recibidas y el usuario remitente.
* **Nuevos Ordenamientos en Publicaciones:**
  * Por cantidad de veces que se guardó.
  * Por cantidad de veces que se compartió.

#### Backend (NestJS)
* **Módulo Publicaciones:**
  * `POST /guardar`: Guarda la publicación en la colección del usuario autenticado.
  * `POST /desguardar`: Remueve la publicación de los guardados.
  * `POST /compartir`: Registra la acción de compartir una publicación con un destinatario.
  * `GET /compartidos`: Retorna publicaciones compartidas con el usuario autenticado junto a la información del emisor.
  * Lógica adicional para los ordenamientos por guardados y compartidos.