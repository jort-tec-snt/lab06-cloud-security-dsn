# Autorización RBAC de SecureDocs

## Flujo de decisión

```text
JWT válido → Usuario actual en PostgreSQL → Rol actual → RolPermiso → Permiso → Operación
```

`authenticate` valida firma, vigencia, revocación y estado del usuario. Después, `requirePermission` o `requireAllPermissions` consulta las asignaciones actuales mediante `getEffectivePermissions`. El rol declarado en el JWT no decide el acceso. Cada evaluación produce una decisión estructurada con `permitido`, `usuario`, `rol`, `permisoRequerido` y `motivo`. Si falta un permiso, el manejador central responde HTTP 403 con `RBAC_DENIED`, mensaje seguro y `permisoFaltante`. La consulta a PostgreSQL ocurre en cada solicitud protegida; no hay caché de permisos.

## Matriz de permisos semilla

La matriz refleja exactamente las 24 asignaciones de `prisma/seed.ts`. `✓` significa permiso asignado y `—` ausencia de asignación.

| Rol | CREAR_DOCUMENTO | CONSULTAR_DOCUMENTO | MODIFICAR_DOCUMENTO | ELIMINAR_DOCUMENTO | APROBAR_DOCUMENTO | VER_AUDITORIA | GESTIONAR_USUARIOS | ASIGNAR_ROLES |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| ADMINISTRADOR | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| GERENTE | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
| SUPERVISOR | ✓ | ✓ | ✓ | — | ✓ | — | — | — |
| EMPLEADO | ✓ | ✓ | ✓ | — | — | — | — | — |
| AUDITOR | — | ✓ | — | — | — | ✓ | — | — |
| INVITADO | — | ✓ | — | — | — | — | — | — |

## Uso en la API

Las rutas declaran los permisos requeridos en `src/app.ts`; los controladores de usuarios no conocen nombres de roles. `GET /usuarios` requiere `GESTIONAR_USUARIOS`; `POST /usuarios` requiere además `ASIGNAR_ROLES`. `PUT /usuarios/:id` requiere `GESTIONAR_USUARIOS` y agrega `ASIGNAR_ROLES` cuando el cuerpo incluye `rol`. Esto permite reutilizar el motor en operaciones futuras sin duplicar reglas en controladores.

`GET /auth/permissions` exige autenticación y devuelve solamente el nombre del rol actual y los códigos de permisos efectivos. No devuelve hashes, datos privados ni detalles de otros usuarios. RBAC define permisos por operación; las políticas ABAC y el CRUD de documentos quedan para otra etapa.
