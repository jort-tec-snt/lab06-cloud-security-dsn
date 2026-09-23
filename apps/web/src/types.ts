export type Role = "ADMINISTRADOR" | "GERENTE" | "SUPERVISOR" | "EMPLEADO" | "AUDITOR" | "INVITADO";
export type SecurityLevel = "NIVEL_1" | "NIVEL_2" | "NIVEL_3" | "NIVEL_4" | "NIVEL_5";
export type UserStatus = "ACTIVO" | "INACTIVO" | "SUSPENDIDO";
export type ContractType = "INDEFINIDO" | "TEMPORAL" | "CONSULTOR" | "EXTERNO";
export type Permission = "CREAR_DOCUMENTO" | "CONSULTAR_DOCUMENTO" | "MODIFICAR_DOCUMENTO" | "ELIMINAR_DOCUMENTO" | "APROBAR_DOCUMENTO" | "VER_AUDITORIA" | "GESTIONAR_USUARIOS" | "ASIGNAR_ROLES";

export interface User {
  id: string;
  nombre: string;
  correo: string;
  rol: Role;
  departamento: string | null;
  nivelSeguridad: SecurityLevel;
  pais: string;
  tipoContrato: ContractType;
  estado: UserStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentRecord {
  id: string;
  titulo: string;
  descripcion: string;
  propietarioId: string;
  departamentoId: string;
  nivelConfidencialidad: SecurityLevel;
  estado: "PENDIENTE" | "PUBLICADO";
  pais: string;
  fechaCreacion: string;
  createdAt: string;
  updatedAt: string;
}

export interface Department { id: string; nombre: string }

export interface AuditRecord {
  id: string;
  usuarioId: string | null;
  recurso: string;
  accion: string;
  fecha: string;
  resultado: "PERMITIDO" | "DENEGADO" | "ERROR";
  motivo: string;
  direccionIp: string;
  ubicacion: string;
  dispositivo: string;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  permisoFaltante?: string;
  politica?: string;
  motivo?: string;
  valorEsperado?: unknown;
  valorDetectado?: unknown;
  fields?: string[];
}
