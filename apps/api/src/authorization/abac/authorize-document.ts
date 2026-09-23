import type { Documento } from "@prisma/client";
import type { AuthenticatedRequest } from "../../auth";
import { ApiError } from "../../lib/errors";
import { evaluateAbac } from "./index";
import { serverEnvironmentAdapter, type EnvironmentAdapter } from "./environment";
import type { AbacDecision, DocumentAction } from "./types";

/**
 * Llamar después de authenticate, RBAC y la carga del documento en la etapa 6:
 * authenticate -> RBAC -> cargar recurso -> ABAC -> operación.
 */
export function createDocumentAuthorizer(environmentAdapter: EnvironmentAdapter) {
  return async (
    request: AuthenticatedRequest,
    document: Pick<Documento, "id" | "propietarioId" | "departamentoId" | "nivelConfidencialidad" | "estado" | "pais">,
    action: DocumentAction
  ): Promise<AbacDecision> => {
    if (!request.auth) throw new ApiError(401, "UNAUTHORIZED", "No autorizado");
    const user = request.auth.user;
    const decision = await evaluateAbac({
      usuario: {
        id: user.id, rol: user.rol.nombre, departamentoId: user.departamentoId,
        nivelSeguridad: user.nivelSeguridad, pais: user.pais,
        tipoContrato: user.tipoContrato, estado: user.estado
      },
      documento: document,
      accion: action,
      entorno: await environmentAdapter.fromRequest(request)
    });
    if (!decision.permitido) {
      throw new ApiError(403, "ABAC_DENIED", "Acceso denegado por política", {
        politica: decision.politica,
        resultado: decision.resultado,
        motivo: decision.motivo,
        valorEsperado: decision.valorEsperado,
        valorDetectado: decision.valorDetectado,
        evaluaciones: decision.evaluaciones
      });
    }
    return decision;
  };
}

export const authorizeLoadedDocument = createDocumentAuthorizer(serverEnvironmentAdapter);
