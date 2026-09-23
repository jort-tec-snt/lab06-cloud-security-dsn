# Pruebas RBAC

Ejecuta `npm --prefix apps/api run prisma:seed` y `npm --prefix apps/api test` con PostgreSQL disponible. Las pruebas HTTP automatizadas viven en `apps/api/src/rbac.test.ts`; el script ejecuta los archivos de prueba en serie porque un escenario cambia temporalmente una asignación y la restaura en `finally`.

| Escenario | Petición | Resultado esperado | HTTP | Evidencia futura |
| --- | --- | --- | --- | --- |
| Permisos del administrador | `GET /auth/permissions` con JWT admin | Rol ADMINISTRADOR y 8 permisos; sin hash | 200 | Captura de respuesta JSON |
| Administración permitida | `GET /usuarios` con JWT admin | Lista de usuarios sin hashes | 200 | Captura de respuesta |
| Acceso no autorizado por rol | `GET /usuarios` con JWT de gerente, supervisor, empleado, auditor e invitado | `RBAC_DENIED`, `permisoFaltante: GESTIONAR_USUARIOS` | 403 | Cinco respuestas JSON |
| Creación denegada | `POST /usuarios` con JWT de empleado | `RBAC_DENIED`; no se crea usuario | 403 | Respuesta y consulta de base |
| Actualización denegada | `PUT /usuarios/:id` con JWT de empleado, con y sin campo `rol` | `RBAC_DENIED`; sin cambio | 403 | Respuestas y consulta de base |
| Creación permitida | `POST /usuarios` con JWT admin y datos válidos | Usuario creado | 201 | Respuesta JSON |
| Cambio de rol permitido | `PUT /usuarios/:id` con JWT admin y `rol: AUDITOR` | Rol actualizado | 200 | Respuesta JSON |
| Revocación efectiva con token vigente | Retirar temporalmente `GESTIONAR_USUARIOS` del rol admin y repetir `GET /usuarios` con el mismo JWT | `RBAC_DENIED`; `/auth/permissions` ya no lista el permiso; al restaurarlo se recupera acceso | 403, 200 | Respuestas antes, durante y después |
| Segundo permiso condicional | Retirar temporalmente `ASIGNAR_ROLES` del rol admin; llamar `GET`, `POST` y `PUT /usuarios/:id` con y sin `rol` | Listado y edición sin rol permitidos; creación y cambio de rol denegados con `permisoFaltante: ASIGNAR_ROLES` | 200, 403 | Respuestas de las cuatro peticiones |
| Compatibilidad de auth | Login, `/auth/me`, logout y token revocado | Conservan el comportamiento anterior | 200, 204, 401 | Salida de `npm test` |
| Endpoint protegido | `GET /auth/permissions` sin JWT | `UNAUTHORIZED` | 401 | Respuesta JSON |

Para evidencia manual, inicia la API y usa el token devuelto por `POST /auth/login` con las cuentas semilla `admin@securedocs.test` y `empleado@securedocs.test`. Envía `Authorization: Bearer <accessToken>` a `GET /usuarios`; guarda el estado HTTP y el JSON de cada respuesta. Las credenciales semilla son exclusivamente locales y están descritas en el README.

Los permisos de documentos y `VER_AUDITORIA` ya se aplican en las rutas HTTP; consulta la [matriz de 17 casos](document-authorization.md). Los rechazos RBAC de esas rutas quedan auditados con el permiso faltante.
