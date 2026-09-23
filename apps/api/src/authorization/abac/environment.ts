import type { Request } from "express";
import type { AbacEnvironment } from "./types";

/** Un adaptador de producción obtiene señales únicamente de fuentes confiables. */
export interface EnvironmentAdapter {
  fromRequest(request: Request): AbacEnvironment | Promise<AbacEnvironment>;
}

/**
 * Base segura para la etapa 6. Express usa la conexión directa para request.ip
 * (trust proxy permanece desactivado). Ubicación y dispositivo son desconocidos
 * hasta conectar un proveedor verificado; nunca se leen del body ni de headers.
 */
export const serverEnvironmentAdapter: EnvironmentAdapter = {
  fromRequest(request) {
    return {
      fechaHora: new Date(),
      direccionIp: request.ip ?? "",
      ubicacion: null,
      dispositivo: null
    };
  }
};
