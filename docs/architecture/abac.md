# Motor ABAC de SecureDocs

La función `evaluateAbac(context)` vive en `apps/api/src/authorization/abac/`. Recibe usuario, documento ya cargado, acción y entorno explícito. Consulta `Politica.activa` en PostgreSQL en cada evaluación y ejecuta las reglas correspondientes del registro central `policyRegistry`, vinculado por `codigo`. Las condiciones del laboratorio residen en ese registro; el JSON descriptivo del catálogo semilla no sustituye las reglas. Una política desactivada no se evalúa. Un código activo sin implementación produce error y nunca concede acceso por omisión.

El CRUD integrado usa `authorizeLoadedDocument` con esta secuencia: **authenticate → RBAC → cargar o construir recurso → ABAC → operación → auditoría**. Para conectar fuentes verificadas, `createDocumentAuthorizer` acepta un `EnvironmentAdapter` provisto por código del servidor. No hay endpoint público de evaluación. RBAC decide si el rol tiene permiso para la operación; ABAC comprueba atributos del usuario, documento y entorno. La creación construye un candidato y usa la acción `CREAR_DOCUMENTO` con las mismas ocho políticas.

## Atributos y políticas

| Código | Cuándo aplica | Condición |
| --- | --- | --- |
| `MISMO_DEPARTAMENTO` | Empleado sobre documento cargado; incluye consulta y modificación | `usuario.departamentoId` existe y coincide con `documento.departamentoId`. |
| `NIVEL_SEGURIDAD` | Toda acción sobre documento | `usuario.nivelSeguridad >= documento.nivelConfidencialidad`. |
| `PROPIETARIO_DOCUMENTO` | Solo `usuario.rol == EMPLEADO` y acción `MODIFICAR_DOCUMENTO` | `usuario.id == documento.propietarioId`. Para SUPERVISOR, GERENTE y ADMINISTRADOR no aplica. |
| `HORARIO_LABORAL` | Consulta de nivel 4 o 5 | Hora de Lima desde 08:00 inclusive hasta 18:00 exclusiva. |
| `PAIS_PERMITIDO` | Consulta de cualquier documento | `usuario.pais == documento.pais`; los valores de Perú se representan como `PERU`. |
| `DISPOSITIVO_CONFIABLE` | Consulta de nivel 4 o 5 | `entorno.dispositivo == CORPORATIVO`. |
| `USUARIO_ACTIVO` | Toda acción sobre documento | `usuario.estado == ACTIVO`; INACTIVO y SUSPENDIDO se deniegan. |
| `INVITADO_RESTRINGIDO` | Rol INVITADO | Simultáneamente `tipoContrato == EXTERNO`, nivel del documento `NIVEL_1` y estado `PUBLICADO`. |

El sujeto incluye ID, rol, departamento, nivel, país, contrato y estado; el recurso incluye ID, propietario, departamento, nivel, estado y país. La acción es creación sobre un documento candidato, o consulta, modificación, eliminación o aprobación sobre uno cargado. El entorno incluye fecha/hora, IP, ubicación y dispositivo. La IP y la ubicación quedan disponibles para auditoría y mejoras futuras; ninguna sustituye `usuario.pais` en `PAIS_PERMITIDO`.

## Precedencia y decisión

Solo se consideran políticas activas y aplicables. Se evalúan todas en el orden del registro, incluso si alguna falla. Si una falla, la decisión global es `ABAC_DENIED`; la primera fallida determina los campos superiores `politica`, `motivo`, `valorEsperado` y `valorDetectado`. `evaluaciones` conserva cada resultado `PERMITIDO` o `DENEGADO`, para mostrar fallas simultáneas como departamento y nivel. Si ninguna falla, el resultado es `ABAC_ALLOWED`. Una política que no aplica no aparece en `evaluaciones`. Una falla al leer el catálogo propaga el error y no autoriza.

## Fuente confiable del entorno

`serverEnvironmentAdapter` toma el reloj del servidor y la IP de la conexión que Express expone en `request.ip`; la aplicación no habilita `trust proxy`. No lee ubicación ni dispositivo desde el body, query, cookies o headers enviados por el cliente. Actualmente ambas señales quedan en `null` hasta integrar un proveedor verificado de geolocalización y gestión de dispositivos. La ubicación desconocida no altera `PAIS_PERMITIDO`; el dispositivo desconocido deniega consultas de nivel 4 o 5. El modo demostración descrito en el [flujo integrado](authorization-flow.md) acepta cabeceras estrictamente validadas solo fuera de producción y con `DEMO_MODE=true`.
