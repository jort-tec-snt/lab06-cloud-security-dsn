import { Prisma, ResultadoAuditoria } from "@prisma/client";
import type { NextFunction, Response } from "express";
import { z } from "zod";
import { authenticateRequest, AuthenticationError, type AuthenticatedRequest } from "./auth";
import { documentEnvironmentAdapter, serverEnvironmentAdapter } from "./authorization/abac/environment";
import { evaluatePermissions, getEffectivePermissions } from "./authorization/rbac";
import { ApiError } from "./lib/errors";
import { prisma } from "./lib/prisma";

export type AuditEvent = {
  usuarioId: string | null;
  recurso: string;
  accion: string;
  resultado: ResultadoAuditoria;
  motivo: string;
};

export type AuditScope = { usuarioId: string | null; recurso: string };
export type AuditResponse = { status: number; body?: unknown };

export class AuditWriteError extends ApiError {
  constructor() { super(500, "INTERNAL_ERROR", "Error interno del servidor"); }
}

export async function recordAudit(request: AuthenticatedRequest, event: AuditEvent): Promise<void> {
  try {
    let environment;
    try {
      environment = await documentEnvironmentAdapter.fromRequest(request);
    } catch {
      environment = await serverEnvironmentAdapter.fromRequest(request);
    }
    await prisma.auditoria.create({
      data: {
        usuarioId: event.usuarioId,
        recurso: event.recurso,
        accion: event.accion,
        resultado: event.resultado,
        motivo: event.motivo,
        fecha: new Date(),
        direccionIp: environment.direccionIp,
        ubicacion: environment.ubicacion ?? "DESCONOCIDA",
        dispositivo: environment.dispositivo ?? "DESCONOCIDO"
      }
    });
  } catch {
    throw new AuditWriteError();
  }
}

export function auditReason(error: unknown): string {
  if (error instanceof AuthenticationError) return `AUTH: ${error.reason}`;
  if (error instanceof z.ZodError) return `VALIDATION_ERROR: ${error.issues.map(issue => issue.path.join(".") || "body").join(", ")}`;
  if (error instanceof ApiError) {
    if (error.code === "INVALID_CREDENTIALS") return "AUTH: CREDENCIALES_INVALIDAS";
    if (error.code === "RBAC_DENIED") return `RBAC: permiso faltante ${String(error.details?.permisoFaltante)}`;
    if (error.code === "ABAC_DENIED") return `ABAC: política ${String(error.details?.politica)}, condición ${String(error.details?.motivo)}, esperado ${JSON.stringify(error.details?.valorEsperado)}, detectado ${JSON.stringify(error.details?.valorDetectado)}`;
    if (error.code === "VALIDATION_ERROR" || error.code === "INVALID_ROLE" || error.code === "INVALID_DEPARTMENT") return `VALIDATION_ERROR: ${error.code}`;
    return `ERROR: ${error.code}`;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return "VALIDATION_ERROR: CONFLICT";
  return "ERROR: fallo interno";
}

export function auditResult(error: unknown): ResultadoAuditoria {
  return error instanceof ApiError && error.status < 500 || error instanceof z.ZodError ||
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" ? "DENEGADO" : "ERROR";
}

type AuditedRouteOptions = {
  accion: string;
  recurso: (request: AuthenticatedRequest) => string;
  auth?: boolean;
  permissions?: readonly string[] | ((request: AuthenticatedRequest) => readonly string[]);
  successReason: string;
};

export function auditedRoute(
  options: AuditedRouteOptions,
  operation: (request: AuthenticatedRequest, scope: AuditScope) => Promise<AuditResponse> | AuditResponse
) {
  return async (request: AuthenticatedRequest, response: Response, next: NextFunction): Promise<void> => {
    const scope: AuditScope = { usuarioId: null, recurso: options.recurso(request) };
    try {
      if (options.auth) {
        request.auth = await authenticateRequest(request);
        scope.usuarioId = request.auth.user.id;
      }
      if (options.permissions) {
        const required = typeof options.permissions === "function" ? options.permissions(request) : options.permissions;
        const context = await getEffectivePermissions(scope.usuarioId!);
        const denied = evaluatePermissions(context, required).find(decision => !decision.permitido);
        if (denied) throw new ApiError(403, "RBAC_DENIED", "Permiso insuficiente", { permisoFaltante: denied.permisoRequerido });
      }
      const result = await operation(request, scope);
      await recordAudit(request, { ...scope, accion: options.accion, resultado: "PERMITIDO", motivo: options.successReason });
      if (result.body === undefined) response.status(result.status).send();
      else response.status(result.status).json(result.body);
    } catch (error) {
      if (error instanceof AuditWriteError) { next(error); return; }
      if (error instanceof AuthenticationError) scope.usuarioId = error.usuarioId;
      try {
        await recordAudit(request, { ...scope, accion: options.accion, resultado: auditResult(error), motivo: auditReason(error) });
      } catch (auditError) { next(auditError); return; }
      next(error);
    }
  };
}
