import {
  EstadoDocumento,
  EstadoUsuario,
  NivelSeguridad,
  PrismaClient,
  TipoContrato
} from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();
const DEMO_PASSWORD = "SecureDocs-Demo-Only-2026!";

const roles = [
  ["ADMINISTRADOR", "Administración completa de la plataforma"],
  ["GERENTE", "Gestión y aprobación de documentos de su área"],
  ["SUPERVISOR", "Supervisión operativa de documentos"],
  ["EMPLEADO", "Trabajo cotidiano con documentos autorizados"],
  ["AUDITOR", "Consulta de documentos y registros de auditoría"],
  ["INVITADO", "Acceso limitado y temporal a documentos publicados"]
] as const;

const permissions = [
  ["CREAR_DOCUMENTO", "Crear documentos"],
  ["CONSULTAR_DOCUMENTO", "Consultar documentos"],
  ["MODIFICAR_DOCUMENTO", "Modificar documentos"],
  ["ELIMINAR_DOCUMENTO", "Eliminar documentos"],
  ["APROBAR_DOCUMENTO", "Aprobar documentos pendientes"],
  ["VER_AUDITORIA", "Consultar registros de auditoría"],
  ["GESTIONAR_USUARIOS", "Administrar usuarios y accesos"],
  ["ASIGNAR_ROLES", "Asignar roles a usuarios"]
] as const;

const permissionsByRole: Record<string, string[]> = {
  ADMINISTRADOR: permissions.map(([code]) => code),
  GERENTE: ["CREAR_DOCUMENTO", "CONSULTAR_DOCUMENTO", "MODIFICAR_DOCUMENTO", "ELIMINAR_DOCUMENTO", "APROBAR_DOCUMENTO", "VER_AUDITORIA"],
  SUPERVISOR: ["CREAR_DOCUMENTO", "CONSULTAR_DOCUMENTO", "MODIFICAR_DOCUMENTO", "APROBAR_DOCUMENTO"],
  EMPLEADO: ["CREAR_DOCUMENTO", "CONSULTAR_DOCUMENTO", "MODIFICAR_DOCUMENTO"],
  AUDITOR: ["CONSULTAR_DOCUMENTO", "VER_AUDITORIA"],
  INVITADO: ["CONSULTAR_DOCUMENTO"]
};

const policies = [
  ["NIVEL_SEGURIDAD", "Nivel de seguridad suficiente", "El usuario debe tener un nivel igual o superior a la confidencialidad del documento.", { atributoUsuario: "nivelSeguridad", operador: "mayor_o_igual", atributoRecurso: "nivelConfidencialidad" }],
  ["MISMO_DEPARTAMENTO", "Pertenencia al departamento", "Limita el acceso a documentos del departamento del usuario, salvo roles privilegiados.", { atributoUsuario: "departamentoId", operador: "igual", atributoRecurso: "departamentoId", excepcionesRol: ["ADMINISTRADOR", "AUDITOR"] }],
  ["PAIS_PERMITIDO", "Coincidencia de país", "Al consultar un documento, el país del usuario debe coincidir con el país asignado al documento.", { acciones: ["CONSULTAR_DOCUMENTO"], atributoUsuario: "pais", operador: "igual", atributoRecurso: "pais" }],
  ["HORARIO_LABORAL", "Horario laboral", "Permite operaciones ordinarias solamente dentro del horario laboral configurado.", { zonaHoraria: "America/Lima", desde: "08:00", hasta: "18:00", dias: [1, 2, 3, 4, 5] }],
  ["DISPOSITIVO_CONFIABLE", "Dispositivo confiable", "Exige un dispositivo administrado para documentos de alta confidencialidad.", { aplicaDesdeNivel: "NIVEL_4", atributoContexto: "dispositivoConfiable", valorRequerido: true }],
  ["INVITADO_RESTRINGIDO", "Acceso restringido para invitados", "Permite a usuarios externos acceder únicamente a documentos de nivel NIVEL_1 que estén PUBLICADO; las tres condiciones son obligatorias simultáneamente.", { operador: "todos", condiciones: [{ atributo: "usuario.tipoContrato", operador: "==", valor: "EXTERNO" }, { atributo: "documento.nivelConfidencialidad", operador: "<=", valor: "NIVEL_1" }, { atributo: "documento.estado", operador: "==", valor: "PUBLICADO" }] }],
  ["PROPIETARIO_DOCUMENTO", "Control del propietario", "Solo el empleado propietario puede modificar un documento.", { roles: ["EMPLEADO"], acciones: ["MODIFICAR_DOCUMENTO"], atributoUsuario: "id", atributoRecurso: "propietarioId" }],
  ["USUARIO_ACTIVO", "Usuario activo", "Permite operaciones únicamente cuando el estado es ACTIVO; deniega los estados INACTIVO y SUSPENDIDO.", { atributoUsuario: "estado", operador: "en", valoresPermitidos: ["ACTIVO"], valoresDenegados: ["INACTIVO", "SUSPENDIDO"] }]
] as const;

async function main(): Promise<void> {
  const roleRecords = new Map<string, { id: string }>();
  for (const [nombre, descripcion] of roles) {
    const role = await prisma.rol.upsert({
      where: { nombre },
      update: { descripcion },
      create: { nombre, descripcion }
    });
    roleRecords.set(nombre, role);
  }

  const permissionRecords = new Map<string, { id: string }>();
  for (const [codigo, descripcion] of permissions) {
    const permission = await prisma.permiso.upsert({
      where: { codigo },
      update: { descripcion },
      create: { codigo, descripcion }
    });
    permissionRecords.set(codigo, permission);
  }

  for (const [roleName, permissionCodes] of Object.entries(permissionsByRole)) {
    const role = roleRecords.get(roleName);
    if (!role) throw new Error(`Rol semilla no encontrado: ${roleName}`);
    await prisma.rolPermiso.deleteMany({ where: { rolId: role.id } });
    for (const code of permissionCodes) {
      const permission = permissionRecords.get(code);
      if (!permission) throw new Error(`Permiso semilla no encontrado: ${code}`);
      await prisma.rolPermiso.upsert({
        where: { rolId_permisoId: { rolId: role.id, permisoId: permission.id } },
        update: {},
        create: { rolId: role.id, permisoId: permission.id }
      });
    }
  }

  const departmentRecords = new Map<string, { id: string }>();
  for (const nombre of ["FINANZAS", "RRHH", "TECNOLOGIA"]) {
    const department = await prisma.departamento.upsert({
      where: { nombre },
      update: {},
      create: { nombre }
    });
    departmentRecords.set(nombre, department);
  }

  const passwordHash = await hash(DEMO_PASSWORD, 12);
  const users = [
    ["Ada Administradora", "admin@securedocs.test", "ADMINISTRADOR", "TECNOLOGIA", NivelSeguridad.NIVEL_5, "PERU", TipoContrato.INDEFINIDO, EstadoUsuario.ACTIVO],
    ["Gabriela Gerente", "gerente@securedocs.test", "GERENTE", "FINANZAS", NivelSeguridad.NIVEL_4, "PERU", TipoContrato.INDEFINIDO, EstadoUsuario.ACTIVO],
    ["Sergio Supervisor", "supervisor@securedocs.test", "SUPERVISOR", "RRHH", NivelSeguridad.NIVEL_3, "PERU", TipoContrato.INDEFINIDO, EstadoUsuario.ACTIVO],
    ["Elena Empleada", "empleado@securedocs.test", "EMPLEADO", "TECNOLOGIA", NivelSeguridad.NIVEL_2, "PERU", TipoContrato.TEMPORAL, EstadoUsuario.ACTIVO],
    ["Augusto Auditor", "auditor@securedocs.test", "AUDITOR", "FINANZAS", NivelSeguridad.NIVEL_5, "PERU", TipoContrato.CONSULTOR, EstadoUsuario.ACTIVO],
    ["Ines Invitada", "invitado@securedocs.test", "INVITADO", "TECNOLOGIA", NivelSeguridad.NIVEL_1, "PERU", TipoContrato.EXTERNO, EstadoUsuario.ACTIVO],
    ["Ivan Inactivo", "inactivo@securedocs.test", "EMPLEADO", "RRHH", NivelSeguridad.NIVEL_2, "PERU", TipoContrato.TEMPORAL, EstadoUsuario.INACTIVO],
    ["Externa Invitada", "externo@partner.test", "INVITADO", null, NivelSeguridad.NIVEL_1, "CHILE", TipoContrato.EXTERNO, EstadoUsuario.ACTIVO],
    ["Susana Suspendida", "suspendido@securedocs.test", "EMPLEADO", "TECNOLOGIA", NivelSeguridad.NIVEL_2, "PERU", TipoContrato.TEMPORAL, EstadoUsuario.SUSPENDIDO]
  ] as const;

  const userRecords = new Map<string, { id: string }>();
  for (const [nombre, correo, roleName, departmentName, nivelSeguridad, pais, tipoContrato, estado] of users) {
    const role = roleRecords.get(roleName);
    const department = departmentName ? departmentRecords.get(departmentName) : undefined;
    if (!role) throw new Error(`Rol semilla no encontrado: ${roleName}`);
    if (departmentName && !department) throw new Error(`Departamento semilla no encontrado: ${departmentName}`);
    const user = await prisma.usuario.upsert({
      where: { correo },
      update: { nombre, passwordHash, rolId: role.id, departamentoId: department?.id ?? null, nivelSeguridad, pais, tipoContrato, estado },
      create: { nombre, correo, passwordHash, rolId: role.id, departamentoId: department?.id ?? null, nivelSeguridad, pais, tipoContrato, estado }
    });
    userRecords.set(correo, user);
  }

  const documents = [
    ["00000000-0000-4000-8000-000000000001", "Planilla mensual", "Resumen de remuneraciones del mes.", "gerente@securedocs.test", "FINANZAS", NivelSeguridad.NIVEL_5, EstadoDocumento.PUBLICADO, "PERU"],
    ["00000000-0000-4000-8000-000000000002", "Presupuesto anual", "Propuesta presupuestaria pendiente de aprobación.", "gerente@securedocs.test", "FINANZAS", NivelSeguridad.NIVEL_4, EstadoDocumento.PENDIENTE, "PERU"],
    ["00000000-0000-4000-8000-000000000003", "Guía de onboarding", "Proceso de incorporación para personal nuevo.", "supervisor@securedocs.test", "RRHH", NivelSeguridad.NIVEL_2, EstadoDocumento.PUBLICADO, "PERU"],
    ["00000000-0000-4000-8000-000000000004", "Evaluaciones internas", "Lineamientos para evaluaciones de desempeño.", "supervisor@securedocs.test", "RRHH", NivelSeguridad.NIVEL_3, EstadoDocumento.PENDIENTE, "PERU"],
    ["00000000-0000-4000-8000-000000000005", "Manual de herramientas", "Herramientas aprobadas para el trabajo diario.", "empleado@securedocs.test", "TECNOLOGIA", NivelSeguridad.NIVEL_1, EstadoDocumento.PUBLICADO, "PERU"]
  ] as const;

  for (const [id, titulo, descripcion, ownerEmail, departmentName, nivelConfidencialidad, estado, pais] of documents) {
    const owner = userRecords.get(ownerEmail);
    const department = departmentRecords.get(departmentName);
    if (!owner || !department) throw new Error(`Relaciones incompletas para documento ${id}`);
    await prisma.documento.upsert({
      where: { id },
      update: { titulo, descripcion, propietarioId: owner.id, departamentoId: department.id, nivelConfidencialidad, estado, pais },
      create: { id, titulo, descripcion, propietarioId: owner.id, departamentoId: department.id, nivelConfidencialidad, estado, pais }
    });
  }

  for (const [codigo, nombre, descripcion, configuracion] of policies) {
    await prisma.politica.upsert({
      where: { codigo },
      update: { nombre, descripcion, configuracion, activa: true },
      create: { codigo, nombre, descripcion, configuracion, activa: true }
    });
  }

  await prisma.permiso.deleteMany({
    where: { codigo: { notIn: permissions.map(([codigo]) => codigo) } }
  });
  await prisma.politica.deleteMany({
    where: { codigo: { notIn: policies.map(([codigo]) => codigo) } }
  });

  console.log("Datos semilla de SecureDocs cargados correctamente.");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
