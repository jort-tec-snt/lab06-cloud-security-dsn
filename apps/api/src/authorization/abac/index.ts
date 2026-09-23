import { prisma } from "../../lib/prisma";
import { policyCodes, policyRegistry } from "./policies";
import type { AbacContext, AbacDecision } from "./types";

export type { AbacContext, AbacDecision, AbacDocument, AbacEnvironment, AbacSubject, DocumentAction, PolicyEvaluation } from "./types";

/** Evalúa todas las reglas activas y aplicables, sin detenerse en la primera denegación. */
export async function evaluateAbac(context: AbacContext): Promise<AbacDecision> {
  const policies = await prisma.politica.findMany({
    where: { activa: true }, select: { codigo: true }
  });
  const active = new Set(policies.map(policy => policy.codigo));
  const unknown = [...active].filter(code => !(code in policyRegistry));
  if (unknown.length) throw new Error(`Política ABAC activa sin implementación: ${unknown.join(", ")}`);

  const evaluaciones = policyCodes
    .filter(code => active.has(code))
    .map(code => policyRegistry[code](context))
    .filter((evaluation): evaluation is NonNullable<typeof evaluation> => evaluation !== null);
  const denied = evaluaciones.find(evaluation => !evaluation.permitido);
  return {
    permitido: !denied,
    politica: denied?.politica ?? null,
    resultado: denied ? "ABAC_DENIED" : "ABAC_ALLOWED",
    motivo: denied?.motivo ?? "POLITICAS_CUMPLIDAS",
    valorEsperado: denied?.valorEsperado ?? null,
    valorDetectado: denied?.valorDetectado ?? null,
    evaluaciones
  };
}
