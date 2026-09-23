# Pruebas ABAC

Ejecutar `npm --prefix apps/api test` después de migrar y sembrar PostgreSQL. `src/abac.test.ts` invoca el motor sin publicar una ruta HTTP y restaura el estado de cualquier política que desactiva temporalmente.

| Escenario | Permitido | Denegado |
| --- | --- | --- |
| MISMO_DEPARTAMENTO | Empleado consulta y modifica documento de su departamento | Empleado consulta y modifica otro departamento |
| NIVEL_SEGURIDAD | Nivel igual al documento | Nivel inferior |
| PROPIETARIO_DOCUMENTO | Empleado modifica documento propio; para SUPERVISOR, GERENTE, ADMINISTRADOR y otras acciones no aplica | Empleado modifica documento ajeno |
| HORARIO_LABORAL | Nivel 5 a las 11:30 de Lima | Nivel 5 a las 19:00 |
| PAIS_PERMITIDO | Usuario y documento con país `PERU` (o ambos `CHILE`), incluso con ubicación distinta o desconocida | País de usuario distinto al del documento, incluso con ubicación coincidente; fuera de consulta no aplica |
| DISPOSITIVO_CONFIABLE | Nivel 5 desde CORPORATIVO | Nivel 5 desde PERSONAL |
| USUARIO_ACTIVO | ACTIVO | INACTIVO y SUSPENDIDO |
| INVITADO_RESTRINGIDO | EXTERNO, nivel 1, PUBLICADO | Contrato no externo, nivel 2 o PENDIENTE |
| Combinación de la guía | Supervisor Finanzas nivel 3 aprueba documento Finanzas nivel 3 desde PERU, CORPORATIVO, 11:30 | Empleado RRHH nivel 2 modifica documento Finanzas nivel 4: fallan departamento y nivel |
| Estado del catálogo | Política activa se evalúa | Política desactivada se omite |
| Fuente de entorno | IP y fecha del servidor; ubicación conservada en el contexto para auditoría y mejoras futuras | Headers de ubicación y dispositivo ignorados; ubicación no sustituye `usuario.pais` |

En la etapa 6, tras **authenticate → RBAC → cargar recurso → ABAC → operación**, una denegación ABAC se devolverá como HTTP **403**, `error.code = ABAC_DENIED`, con política y motivo. Un rechazo previo de autenticación seguirá siendo 401 y uno de RBAC seguirá siendo 403 con `RBAC_DENIED`. La evidencia HTTP del CRUD, incluidos cuerpos de respuesta y auditoría, se añadirá cuando existan sus endpoints; las pruebas actuales verifican directamente la decisión estructurada y que las pruebas previas de autenticación y RBAC continúen pasando.
