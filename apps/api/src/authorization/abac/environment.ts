import type { Request } from "express";
import type { AbacEnvironment } from "./types";
import { ApiError } from "../../lib/errors";

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

/** Las cabeceras de demostración se interpretan solo durante desarrollo local. */
export const documentEnvironmentAdapter: EnvironmentAdapter = {
  fromRequest(request) {
    const base = serverEnvironmentAdapter.fromRequest(request) as AbacEnvironment;
    if (process.env.NODE_ENV === "production" || process.env.DEMO_MODE !== "true") return base;
    const hour = request.headers["x-demo-hour"];
    const location = request.headers["x-demo-location"];
    const device = request.headers["x-demo-device"];
    if (hour !== undefined) {
      if (typeof hour !== "string" || !/^(?:[01]?\d|2[0-3])$/.test(hour)) throw new ApiError(400, "VALIDATION_ERROR", "X-Demo-Hour inválida");
      const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(base.fechaHora);
      const part = (type: string) => parts.find(item => item.type === type)!.value;
      const day = `${part("year")}-${part("month")}-${part("day")}`;
      base.fechaHora = new Date(`${day}T${hour.padStart(2, "0")}:00:00-05:00`);
    }
    if (location !== undefined) {
      if (typeof location !== "string" || !/^[A-Z]{2,80}(?: [A-Z]{2,80})*$/.test(location) || location.length > 80) throw new ApiError(400, "VALIDATION_ERROR", "X-Demo-Location inválida");
      base.ubicacion = location;
    }
    if (device !== undefined) {
      if (device !== "CORPORATIVO" && device !== "PERSONAL") throw new ApiError(400, "VALIDATION_ERROR", "X-Demo-Device inválida");
      base.dispositivo = device;
    }
    return base;
  }
};
