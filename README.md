# SecureDocs

SecureDocs es el proyecto del laboratorio de Cloud Security. Esta etapa incorpora la API técnica en Node.js, TypeScript y Express, junto con persistencia PostgreSQL administrada mediante Prisma. Todavía no incluye frontend, autenticación, autorización efectiva ni endpoints de negocio.

## Tecnologías

- Node.js 22 o superior, TypeScript y Express 5.
- PostgreSQL 16.
- Prisma ORM.
- Docker Compose para la base de datos local.

## Estructura

```text
apps/
├── api/
│   ├── prisma/          # Esquema, migraciones y datos semilla
│   └── src/             # API Express y health check
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
| `test` | Ejecuta las pruebas técnicas de la API. |

## Seguridad de los datos demostrativos

Todos los usuarios semilla usan la contraseña `SecureDocs-Demo-Only-2026!`. Es pública, deliberadamente identificada como contraseña de prueba y no debe reutilizarse ni desplegarse en producción. El seed almacena únicamente su hash bcrypt.

El archivo `.env` está ignorado por Git. No agregues credenciales reales al repositorio; en entornos reales utiliza secretos gestionados y una contraseña distinta para PostgreSQL.

El modelo completo, las relaciones y las cuentas de prueba están documentados en [docs/architecture/database-model.md](docs/architecture/database-model.md).
