# Autorización HTTP de documentos

Ejecuta migración, seed y `npm --prefix apps/api test` con PostgreSQL local. Las pruebas HTTP reales de `apps/api/src/documents.test.ts` usan `DEMO_MODE=true` dentro del proceso de prueba y limpian sus documentos temporales. Las futuras capturas se guardarán como `EVID-01` a `EVID-17`.

| Caso | Usuario | Recurso | Contexto | Endpoint | Resultado | Motivo esperado | Evidencia futura |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 01 | EMPLEADO | Manual de herramientas, Tecnología, nivel 1 | Perú | `GET /documentos/:id` | 200 | RBAC y ABAC permiten | EVID-01 |
| 02 | EMPLEADO | Guía de onboarding, RRHH | Área diferente | `GET /documentos/:id` | 403 | ABAC `MISMO_DEPARTAMENTO` | EVID-02 |
| 03 | SUPERVISOR | Evaluaciones internas, RRHH | Pendiente | `POST /documentos/:id/aprobar` | 200 | Aprobación permitida; queda PUBLICADO | EVID-03 |
| 04 | EMPLEADO | Evaluaciones internas | Sin permiso de aprobación | `POST /documentos/:id/aprobar` | 403 | RBAC `APROBAR_DOCUMENTO` faltante | EVID-04 |
| 05 | EMPLEADO nivel 2 | Documento temporal nivel 4 de Tecnología | 11:00, dispositivo corporativo | `GET /documentos/:id` | 403 | ABAC `NIVEL_SEGURIDAD` | EVID-05 |
| 06 | GERENTE | Documento temporal de Finanzas | Nivel 2 | `DELETE /documentos/:id` | 204 | Eliminación permitida | EVID-06 |
| 07 | AUDITOR | Manual de herramientas | Sin permiso de edición | `PUT /documentos/:id` | 403 | RBAC `MODIFICAR_DOCUMENTO` faltante | EVID-07 |
| 08 | EMPLEADO inactivado | Manual de herramientas | JWT expedido antes de inactivar | `GET /documentos/:id` | 401 | AUTH `USUARIO_INACTIVO` | EVID-08 |
| 09 | ADMINISTRADOR | Presupuesto anual, nivel 4 | Hora demo 19:00, corporativo | `GET /documentos/:id` | 403 | ABAC `HORARIO_LABORAL` | EVID-09 |
| 10 | ADMINISTRADOR nivel 5 | Planilla mensual, nivel 5 | Hora demo 11:00, personal | `GET /documentos/:id` | 403 | ABAC `DISPOSITIVO_CONFIABLE` | EVID-10 |
| 11 | INVITADO | Manual público, nivel 1 | Externo, Perú | `GET /documentos/:id` | 200 | ABAC permite | EVID-11 |
| 12 | INVITADO | Documento temporal confidencial nivel 2 | Externo, Perú | `GET /documentos/:id` | 403 | ABAC `NIVEL_SEGURIDAD` e `INVITADO_RESTRINGIDO` | EVID-12 |
| 13 | EMPLEADO | Manual propio, Tecnología | Edita descripción | `PUT /documentos/:id` | 200 | ABAC `PROPIETARIO_DOCUMENTO` permite | EVID-13 |
| 14 | GERENTE | Guía ajena, RRHH | Edita descripción | `PUT /documentos/:id` | 200 | Excepción de propiedad del motor ABAC | EVID-14 |
| 15 | INVITADO externo Chile | Manual público, Perú | País de usuario CHILE | `GET /documentos/:id` | 403 | ABAC `PAIS_PERMITIDO` | EVID-15 |
| 16 | ADMINISTRADOR | Documento nuevo de Tecnología | Propietario derivado del JWT | `POST /documentos` | 201 | Creación permitida, PENDIENTE | EVID-16 |
| 17 | AUDITOR | Auditorías | Página de 10 | `GET /auditoria` | 200 | RBAC `VER_AUDITORIA` presente | EVID-17 |

La suite también comprueba auditorías `PERMITIDO` y `DENEGADO` con motivos AUTH, RBAC y ABAC; `403` sin `VER_AUDITORIA`; listado sin metadatos denegados; PUT sobre candidato; propietario protegido; `404` seguro; filtros de auditoría y ausencia de rutas de mutación de auditorías.
