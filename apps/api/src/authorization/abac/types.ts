import type { EstadoDocumento, EstadoUsuario, NivelSeguridad, TipoContrato } from "@prisma/client";

export type AbacSubject = {
  id: string;
  rol: string;
  departamentoId: string | null;
  nivelSeguridad: NivelSeguridad;
  pais: string;
  tipoContrato: TipoContrato;
  estado: EstadoUsuario;
};

export type AbacDocument = {
  id: string;
  propietarioId: string;
  departamentoId: string;
  nivelConfidencialidad: NivelSeguridad;
  estado: EstadoDocumento;
  pais: string;
};

export type DocumentAction =
  | "CONSULTAR_DOCUMENTO"
  | "MODIFICAR_DOCUMENTO"
  | "ELIMINAR_DOCUMENTO"
  | "APROBAR_DOCUMENTO";

export type AbacEnvironment = {
  fechaHora: Date;
  direccionIp: string;
  ubicacion: string | null;
  dispositivo: "CORPORATIVO" | "PERSONAL" | null;
};

export type AbacContext = {
  usuario: AbacSubject;
  documento: AbacDocument;
  accion: DocumentAction;
  entorno: AbacEnvironment;
};

export type PolicyEvaluation = {
  permitido: boolean;
  politica: string;
  resultado: "PERMITIDO" | "DENEGADO";
  motivo: string;
  valorEsperado: unknown;
  valorDetectado: unknown;
};

export type AbacDecision = {
  permitido: boolean;
  politica: string | null;
  resultado: "ABAC_ALLOWED" | "ABAC_DENIED";
  motivo: string;
  valorEsperado: unknown;
  valorDetectado: unknown;
  evaluaciones: PolicyEvaluation[];
};
