import { NivelSeguridad } from "@prisma/client";
import type { AbacContext, PolicyEvaluation } from "./types";

export const policyCodes = [
  "MISMO_DEPARTAMENTO", "NIVEL_SEGURIDAD", "PROPIETARIO_DOCUMENTO",
  "HORARIO_LABORAL", "PAIS_PERMITIDO", "DISPOSITIVO_CONFIABLE",
  "USUARIO_ACTIVO", "INVITADO_RESTRINGIDO"
] as const;

export type PolicyCode = typeof policyCodes[number];
type PolicyRule = (context: AbacContext) => PolicyEvaluation | null;

const levels: Record<NivelSeguridad, number> = {
  NIVEL_1: 1, NIVEL_2: 2, NIVEL_3: 3, NIVEL_4: 4, NIVEL_5: 5
};

function result(politica: PolicyCode, permitido: boolean, valorEsperado: unknown, valorDetectado: unknown): PolicyEvaluation {
  return {
    permitido, politica, resultado: permitido ? "PERMITIDO" : "DENEGADO",
    motivo: permitido ? "CONDICION_CUMPLIDA" : "CONDICION_INCUMPLIDA",
    valorEsperado, valorDetectado
  };
}

function isSensitive(context: AbacContext): boolean {
  return levels[context.documento.nivelConfidencialidad] >= 4;
}

function limaTime(date: Date): string {
  if (Number.isNaN(date.getTime())) throw new Error("Fecha ABAC inválida");
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Lima", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).format(date);
}

// Único registro de reglas. La tabla Politica controla cuáles se ejecutan; las
// condiciones del laboratorio se mantienen aquí para evitar lógica en rutas.
export const policyRegistry: Record<PolicyCode, PolicyRule> = {
  MISMO_DEPARTAMENTO: ({ usuario, documento }) => {
    if (usuario.rol !== "EMPLEADO") return null;
    return result("MISMO_DEPARTAMENTO", usuario.departamentoId !== null && usuario.departamentoId === documento.departamentoId,
      documento.departamentoId, usuario.departamentoId);
  },
  NIVEL_SEGURIDAD: ({ usuario, documento }) => result("NIVEL_SEGURIDAD",
    levels[usuario.nivelSeguridad] >= levels[documento.nivelConfidencialidad],
    `>= ${documento.nivelConfidencialidad}`, usuario.nivelSeguridad),
  PROPIETARIO_DOCUMENTO: ({ usuario, documento, accion }) => {
    if (usuario.rol !== "EMPLEADO" || accion !== "MODIFICAR_DOCUMENTO") return null;
    return result("PROPIETARIO_DOCUMENTO", usuario.id === documento.propietarioId, documento.propietarioId, usuario.id);
  },
  HORARIO_LABORAL: context => {
    if (context.accion !== "CONSULTAR_DOCUMENTO" || !isSensitive(context)) return null;
    const detected = limaTime(context.entorno.fechaHora);
    return result("HORARIO_LABORAL", detected >= "08:00" && detected < "18:00",
      "08:00 <= hora < 18:00 (America/Lima)", detected);
  },
  PAIS_PERMITIDO: ({ usuario, documento, accion }) => {
    if (accion !== "CONSULTAR_DOCUMENTO") return null;
    return result("PAIS_PERMITIDO", usuario.pais === documento.pais, documento.pais, usuario.pais);
  },
  DISPOSITIVO_CONFIABLE: context => {
    if (context.accion !== "CONSULTAR_DOCUMENTO" || !isSensitive(context)) return null;
    return result("DISPOSITIVO_CONFIABLE", context.entorno.dispositivo === "CORPORATIVO",
      "CORPORATIVO", context.entorno.dispositivo);
  },
  USUARIO_ACTIVO: ({ usuario }) => result("USUARIO_ACTIVO", usuario.estado === "ACTIVO", "ACTIVO", usuario.estado),
  INVITADO_RESTRINGIDO: ({ usuario, documento }) => {
    if (usuario.rol !== "INVITADO") return null;
    const expected = { tipoContrato: "EXTERNO", nivelConfidencialidad: "NIVEL_1", estado: "PUBLICADO" };
    const detected = {
      tipoContrato: usuario.tipoContrato,
      nivelConfidencialidad: documento.nivelConfidencialidad,
      estado: documento.estado
    };
    return result("INVITADO_RESTRINGIDO", detected.tipoContrato === expected.tipoContrato
      && detected.nivelConfidencialidad === expected.nivelConfidencialidad
      && detected.estado === expected.estado, expected, detected);
  }
};
