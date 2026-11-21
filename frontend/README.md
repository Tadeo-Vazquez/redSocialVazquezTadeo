# Frontend

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.1.5.

## Sesión

El backend guarda el JWT en una cookie HttpOnly al iniciar sesión o registrarse.
El frontend envía credenciales en las peticiones de autenticación y, al iniciar,
consulta `POST /auth/autorizar` antes de mostrar publicaciones o el login.
Cerrar sesión elimina la cookie mediante `POST /auth/logout`.
En desarrollo, el frontend y el backend deben usar el mismo hostname (por
ejemplo, `localhost` en ambos, sin mezclarlo con `127.0.0.1`) y el origen del
frontend debe estar permitido por `FRONTEND_URL` en el backend. En producción,
la cookie permite peticiones entre sitios y requiere HTTPS.

## PWA

FrontEo se puede instalar desde una compilación de producción servida por HTTPS
o localhost. El service worker guarda los archivos de la aplicación y sus
íconos, pero no almacena respuestas de la API: iniciar sesión y consultar
publicaciones requieren conexión. En desarrollo con `ng serve` está desactivado.

## Directivas y pipes propios

El inicio de sesión usa `appAutofocus` para enfocar el primer campo y
`appHighlightError` para resaltar errores de validación. Las tarjetas aplican
`appDebounceClick` al botón de me gusta para ignorar clics repetidos breves.
`truncateText` limita la vista previa de la descripción; en el detalle se
mantiene el texto completo. `escapeHtml` convierte el contenido ingresado por
usuarios en texto para mostrarlo con `[innerHTML]` sin omitir la sanitización
de Angular. Para interpolaciones normales (`{{ ... }}`), Angular ya escapa el
contenido automáticamente.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
