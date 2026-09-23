# SecureDocs

SecureDocs es el proyecto del laboratorio de Cloud Security. Incluye autenticación JWT, revocación persistida, autorización RBAC centralizada, gestión de usuarios y un motor ABAC centralizado sobre PostgreSQL. El motor ABAC se aplicará al CRUD de documentos en la siguiente etapa; aún no existen rutas de documentos. El frontend queda para una etapa posterior.

## Tecnologías

- Node.js 22 o superior, TypeScript y Express 5.
- PostgreSQL 16.
- Prisma ORM, bcrypt, Zod, Helmet y CORS.
- Docker Compose para la base de datos local.

## Estructura

```text
apps/
├── api/
│   ├── prisma/          # Esquema, migraciones y datos semilla
│   └── src/             # API Express, autenticación, usuarios y autorización
└── web/                 # Reservado; fuera del alcance de esta etapa
docs/
└── architecture/        # Modelo y decisiones de arquitectura
docker-compose.yml       # PostgreSQL y servicios locales
```

## Instalación local

Requisitos: Node.js 22+, npm y Docker con el complemento Compose. Desde la raíz del repositorio, ejecuta en este orden:

1. Copia la configuración local de ejemplo. Sus valores son exclusivamente de desarrollo.

   ```bash
   cp .env.example .env
   ```

2. Inicia PostgreSQL y espera a que el healthcheck indique que está disponible.

   ```bash
   docker compose up -d postgres
   docker compose ps postgres
   ```

3. Instala las dependencias de la API.

   ```bash
   npm --prefix apps/api install
   ```

4. Aplica la migración versionada.

   ```bash
   npm --prefix apps/api run prisma:migrate
   ```

5. Carga los datos semilla. El comando es idempotente y puede repetirse.

   ```bash
   npm --prefix apps/api run prisma:seed
   ```

6. Inicia la API y, en otra terminal, consulta el health check.

   ```bash
   npm --prefix apps/api run dev
   curl --fail http://localhost:3000/health
   ```

Una respuesta saludable tiene código HTTP `200`, `status: "ok"` y `database: "connected"`. Si PostgreSQL no está accesible, el endpoint responde HTTP `503` y estado degradado.

## Configuración y autenticación

`.env.example` contiene valores **exclusivos de desarrollo local**. Copia el archivo a `.env` y reemplaza `JWT_SECRET` por un secreto propio de al menos 32 caracteres antes de cualquier uso fuera del laboratorio. `.env` está ignorado por Git.

| Variable | Uso local |
| --- | --- |
| `DATABASE_URL` | Conexión PostgreSQL de la API local. |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_PORT` | Base local de Docker Compose. |
| `API_PORT` | Puerto HTTP; predeterminado `3000`. |
| `JWT_SECRET` | Clave de firma HS256; el valor de ejemplo es público y solo local. |
| `JWT_EXPIRES_IN` | Duración del JWT, por ejemplo `1h` (`s`, `m`, `h`, `d`). |
| `CORS_ORIGIN` | Único origen web permitido por CORS; ejemplo `http://localhost:5173`. |

Todas las cuentas semilla usan `SecureDocs-Demo-Only-2026!`, **solo para desarrollo local**. Para probar el acceso, usa `admin@securedocs.test`; `inactivo@securedocs.test` y `suspendido@securedocs.test` sirven para comprobar el rechazo. Las demás cuentas figuran en el [modelo de datos](docs/architecture/database-model.md). Estas credenciales públicas no deben usarse en despliegues.

```bash
curl -sS -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"correo":"admin@securedocs.test","password":"SecureDocs-Demo-Only-2026!"}'
```

El resultado contiene `accessToken`. Envíalo como `Authorization: Bearer <accessToken>` a `GET /auth/me`, `GET /auth/permissions`, `POST /auth/logout` y `/usuarios`. Logout guarda el `jti` revocado en PostgreSQL: el mismo token devuelve `401` desde ese momento. `GET /auth/permissions` devuelve el rol y los códigos de permisos efectivos del usuario autenticado, consultados desde PostgreSQL.

## Usuarios

`GET /usuarios` lista usuarios; `POST /usuarios` crea uno; `PUT /usuarios/:id` actualiza campos enviados. Los tres endpoints exigen JWT válido y permisos RBAC actuales:

| Endpoint | Permisos requeridos |
| --- | --- |
| `GET /usuarios` | `GESTIONAR_USUARIOS` |
| `POST /usuarios` | `GESTIONAR_USUARIOS` y `ASIGNAR_ROLES` |
| `PUT /usuarios/:id` sin `rol` | `GESTIONAR_USUARIOS` |
| `PUT /usuarios/:id` con `rol` | `GESTIONAR_USUARIOS` y `ASIGNAR_ROLES` |

Si falta un permiso, la API devuelve HTTP `403` con `error.code: "RBAC_DENIED"` y `error.permisoFaltante`. Con las asignaciones semilla, solamente ADMINISTRADOR puede administrar usuarios. El cuerpo de creación requiere `nombre`, `correo`, `password`, `rol`, `departamento` (nombre o `null`), `nivelSeguridad`, `pais` (nombre de 2 a 80 letras, con espacios simples; se recortan los extremos y se convierte a mayúsculas, por ejemplo `PERU`), `tipoContrato` y `estado`. `PUT` acepta cualquier subconjunto no vacío de esos campos. La contraseña se almacena como hash bcrypt y nunca se devuelve.

Los valores de `rol` son `ADMINISTRADOR`, `GERENTE`, `SUPERVISOR`, `EMPLEADO`, `AUDITOR`, `INVITADO`; los departamentos semilla son `FINANZAS`, `RRHH`, `TECNOLOGIA`. `nivelSeguridad` admite `NIVEL_1` a `NIVEL_5`; `tipoContrato`, `INDEFINIDO`, `TEMPORAL`, `CONSULTOR`, `EXTERNO`; `estado`, `ACTIVO`, `INACTIVO`, `SUSPENDIDO`.

La [arquitectura RBAC](docs/architecture/rbac.md) contiene el flujo y la matriz completa de permisos. Los [escenarios RBAC](docs/testing/rbac.md) describen las respuestas y la evidencia.

## ABAC

`evaluateAbac(context)` evalúa usuario, documento, acción y entorno contra las ocho políticas activas de PostgreSQL. Devuelve una decisión detallada y todas las evaluaciones aplicables. `authorizeLoadedDocument` prepara su uso después de autenticación, RBAC y carga del documento. No se expone un endpoint ABAC. La ubicación y el dispositivo del adaptador de servidor permanecen desconocidos hasta conectar fuentes verificadas; los valores inyectados se usan solo en pruebas. Consulta la [arquitectura ABAC](docs/architecture/abac.md) y la [matriz de pruebas](docs/testing/abac.md).

## Scripts de la API

Ejecuta cada script desde la raíz con `npm --prefix apps/api run <script>`:

| Script | Uso |
| --- | --- |
| `dev` | Inicia la API en modo desarrollo y observa cambios. |
| `build` | Compila TypeScript en `apps/api/dist`. |
| `start` | Ejecuta la versión compilada. |
| `prisma:generate` | Regenera Prisma Client. |
| `prisma:migrate` | Aplica las migraciones pendientes con `prisma migrate deploy`. |
| `prisma:seed` | Carga o actualiza el catálogo y los datos demostrativos. |
| `test` | Ejecuta pruebas de autenticación, RBAC y ABAC contra PostgreSQL local ya migrado y poblado. |

## Seguridad de los datos demostrativos

Todos los usuarios semilla usan la contraseña pública de prueba indicada arriba. El seed almacena únicamente su hash bcrypt.

El archivo `.env` está ignorado por Git. No agregues credenciales reales al repositorio; en entornos reales utiliza secretos gestionados y una contraseña distinta para PostgreSQL.

El modelo completo, las relaciones y las cuentas de prueba están documentados en [docs/architecture/database-model.md](docs/architecture/database-model.md).
Los escenarios de prueba están en [docs/testing/authentication.md](docs/testing/authentication.md).
