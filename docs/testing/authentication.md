# Pruebas de autenticación

Preparación: iniciar PostgreSQL, aplicar migraciones y ejecutar el seed. Las cuentas y la contraseña de demostración están en el README; son exclusivas de desarrollo local. Ejecutar `npm --prefix apps/api test` para las pruebas automatizadas HTTP.

| Caso | Solicitud | Resultado esperado |
| --- | --- | --- |
| Login válido | `POST /auth/login` con `admin@securedocs.test` y la contraseña de demostración | `200`, `accessToken` y usuario sin `passwordHash` |
| Contraseña incorrecta | Mismo correo con contraseña incorrecta | `401`, `INVALID_CREDENTIALS` |
| Usuario INACTIVO | Login de `inactivo@securedocs.test` | `401`, `INVALID_CREDENTIALS` |
| Usuario SUSPENDIDO | Login de `suspendido@securedocs.test` | `401`, `INVALID_CREDENTIALS` |
| Token inválido | `GET /auth/me` con `Authorization: Bearer invalid.token.value` | `401`, `UNAUTHORIZED` |
| Sin token | `GET /auth/me` sin `Authorization` | `401`, `UNAUTHORIZED` |
| Token válido | `GET /auth/me` con el JWT del login | `200`, datos vigentes del usuario, sin hash |
| Logout y revocación | `POST /auth/logout` con JWT válido; reutilizar JWT en `/auth/me` | `204` al cerrar sesión y luego `401`; la fila `tokens_revocados` permanece en PostgreSQL |

El middleware también verifica firma, vencimiento y que el usuario siga `ACTIVO` en la base. Los endpoints de usuarios ya exigen los permisos RBAC correspondientes. Los intentos a documentos y a `GET /auditoria`, incluidos rechazos AUTH, generan registros de auditoría.
