# SecureDocs

SecureDocs es el proyecto inicial del laboratorio de Cloud Security. Su objetivo será servir como base para explorar, de forma progresiva, la protección de documentos y los controles de seguridad en una aplicación desplegable en la nube.

Esta etapa contiene únicamente la estructura técnica y la configuración base del proyecto. No incluye lógica de negocio, endpoints, autenticación, autorización, persistencia ni interfaz de usuario.

## Tecnologías

- Monorepo simple.
- Backend: Node.js + Express.
- Frontend: React + Vite.
- Base de datos: PostgreSQL.
- Contenedores: Docker Compose.

## Estructura

```text
apps/
├── api/              # Backend reservado para Node.js + Express
└── web/              # Frontend reservado para React + Vite
docs/
├── architecture/    # Documentación de arquitectura
├── evidence/         # Evidencias del laboratorio
└── testing/          # Estrategia y resultados de pruebas
infra/                # Configuración de infraestructura
docker-compose.yml    # Servicios base de desarrollo local
```

## Arranque futuro

Cuando se implemente la siguiente etapa, se podrá iniciar la base de servicios con:

```bash
cp .env.example .env
docker compose up -d
```

En el estado actual, los servicios `api` y `web` son contenedores base sin aplicación implementada. PostgreSQL se inicia con una configuración local de ejemplo. No se deben añadir secretos reales al repositorio; para entornos reales se utilizará un gestor de secretos apropiado.

## Alcance pendiente

La implementación posterior definirá, de manera separada y documentada, los endpoints, el modelo de datos, la autenticación JWT, los controles RBAC/ABAC, la interfaz web y las pruebas del sistema.
