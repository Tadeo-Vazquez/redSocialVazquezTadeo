<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Authentication configuration

Set `JWT_SECRET` in the backend environment to a long, random secret before starting the application. Login and registration issue an `HttpOnly` cookie whose lifetime matches the JWT (`AUTH_TOKEN_TTL_MINUTES`). With `NODE_ENV=production` the cookie uses `SameSite=None; Secure` for cross-site HTTPS deployments; otherwise it uses `SameSite=Lax` without `Secure` for local HTTP development. In local development, use the same hostname for frontend and backend (for example `localhost`, not a mix of `localhost` and `127.0.0.1`) and allow the frontend origin with `FRONTEND_URL`. The token is not included in the JSON response.

`POST /auth/autorizar` validates the session cookie and returns the current user; `POST /auth/refrescar` renews it while it is still valid. The `/autorizar` and `/refrescar` paths are also available to match the sprint specification. JWT claims include the user identifier (`sub`), `username`, and `rol`.

`DELETE /posts/:id` requires a valid session cookie. The authenticated author or an active administrator can logically delete a post; the post and its comments are then hidden. The endpoint does not use a client-supplied user ID to determine permissions.

## Administración y estadísticas (Sprint 4)

Las rutas de administración requieren una cookie `access_token` válida cuyo usuario tenga el rol `administrador`. `GET /users` lista los perfiles sin contraseñas; `POST /users` crea un usuario con `nombre`, `apellido`, `email`, `username`, `password`, `repetirPassword`, `fechaNacimiento`, `descripcionBreve` y `perfil` (`usuario` o `administrador`). `DELETE /users/:id` deshabilita la cuenta y `POST /users/:id/habilitar` la rehabilita. Las cuentas deshabilitadas no pueden iniciar sesión; al presentar credenciales correctas reciben un mensaje que indica que contacten a un administrador.

`POST /users` también acepta `multipart/form-data` con una foto opcional en el campo `image` (JPG, PNG o WEBP, máximo 5 MB); sigue admitiendo JSON sin foto.

El registro público (`POST /auth/register`) siempre crea cuentas con rol `usuario`; la asignación del rol administrador se limita a la ruta administrativa.

Las estadísticas también requieren rol administrador:

- `GET /statistics/posts-per-user`: publicaciones activas por usuario.
- `GET /statistics/comments`: total de comentarios asociados a publicaciones activas.
- `GET /statistics/comments-per-post`: comentarios activos por publicación.

Los tres endpoints aceptan `from` y `to` opcionales como fechas ISO-8601. Para valores `YYYY-MM-DD`, el rango incluye el día completo de ambos extremos; para timestamps se usan los límites exactos enviados.

## API de comentarios

Los comentarios forman parte de Publicaciones y usan rutas anidadas para identificar la publicación en cada acción:

- `POST /posts/:postId/comments` crea un comentario. El cuerpo JSON contiene `usuarioId` y `texto`; una solicitud exitosa devuelve `201 Created`.
- `GET /posts/:postId/comments?offset=0&limit=10` lista los comentarios del más reciente al más antiguo. La respuesta incluye la página solicitada y el total; el parámetro `limit` está limitado a 100.
- `PUT /posts/:postId/comments/:commentId` edita un comentario. El cuerpo JSON contiene `usuarioId` y `texto`; solo el autor puede editarlo y, al hacerlo, `modificado` pasa a `true`.

Las tres rutas rechazan identificadores no válidos y referencias a usuarios o publicaciones inexistentes o inactivos. No se pueden consultar ni modificar comentarios cuando su publicación fue eliminada lógicamente.

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

For Render, set the service's root directory to `backend` and use
`npm ci --include=dev && npm run build` as the build command. The build needs
development dependencies such as the Nest CLI, TypeScript, and type definitions;
`--include=dev` ensures npm installs them even when `NODE_ENV=production`.
Use `npm run start:prod` as the start command and set `NODE_ENV=production`
in the service's environment variables so that authentication cookies use
`SameSite=None; Secure`.

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Observability

In production applications, observability is essential for understanding how your system behaves, detecting issues early, and maintaining reliable performance.

[NestJS Observe](https://observe.nestjs.com) automatically instruments your NestJS application, giving you deep visibility into your system with minimal setup:

- **Distributed tracing:** Follow requests across services and understand how they flow through your system.
- **Waterfall analysis:** Visualize request execution and identify slow operations, bottlenecks, and unexpected delays.
- **Performance analysis:** Analyze application performance in real time and quickly pinpoint areas that need optimization.
- **Metrics:** Track key application and infrastructure metrics to understand system health and performance trends.
- **Logging:** Centralize and correlate logs with traces and other telemetry to make debugging easier.
- **Error tracking:** Detect errors quickly and investigate their root causes with the surrounding context.
- **SLA monitoring:** Track service-level objectives and identify when your application is approaching or exceeding defined thresholds.
- **Alarms and alerts:** Set up alerts for critical errors, performance degradation, SLA violations, and other anomalies so your team can react quickly.

To add it to this project, run this and approve the code it prints at [observe.nestjs.com/link](https://observe.nestjs.com/link) - signing up for free if you have no account:

```bash
$ npx @nestjs/observe link
```

It installs `@nestjs/observe`, wires it into `AppModule` and `main.ts`, and writes the app key and secret into `.env`, which every `nest start` script (`start`, `start:dev`, `start:debug`) then loads. In production, set `OBSERVE_APP_KEY` and `OBSERVE_APP_SECRET` in the environment instead.

Or do it by hand:

```bash
$ npm install @nestjs/observe
```

Then follow the [setup guide](https://docs.nestjs.com/observability/sdk) - it takes a single import and an app key.

The free plan needs no payment details and covers 300,000 events a month. You can also browse the [live demo](https://www.observe-demo.nestjs.com/dashboard) first - the whole dashboard over a busy service's data, with nothing to install.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Auto-instrument your application with [NestJS Observe](https://observe.nestjs.com). Distributed tracing, metrics, and logging made easy. Error tracking and performance monitoring for your NestJS applications.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
