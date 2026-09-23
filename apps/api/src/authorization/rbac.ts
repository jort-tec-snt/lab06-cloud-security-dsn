import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../auth";
import { ApiError } from "../lib/errors";
import { prisma } from "../lib/prisma";

export type RbacDecision = {
  permitido: boolean;
  usuario: string;
  rol: string;
  permisoRequerido: string;
  motivo: "PERMISSION_GRANTED" | "MISSING_PERMISSION";
};

export async function getEffectivePermissions(usuarioId: string): Promise<{ usuario: string; rol: string; permisos: string[] }> {
  const user = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: {
      id: true,
      rol: { select: { nombre: true, permisos: { select: { permiso: { select: { codigo: true } } } } } }
    }
  });
  if (!user) throw new ApiError(401, "UNAUTHORIZED", "No autorizado");
  return {
    usuario: user.id,
    rol: user.rol.nombre,
    permisos: user.rol.permisos.map(assignment => assignment.permiso.codigo).sort()
  };
}

export function evaluatePermissions(
  context: Awaited<ReturnType<typeof getEffectivePermissions>>,
  required: readonly string[]
): RbacDecision[] {
  const effective = new Set(context.permisos);
  return required.map(permisoRequerido => ({
    permitido: effective.has(permisoRequerido),
    usuario: context.usuario,
    rol: context.rol,
    permisoRequerido,
    motivo: effective.has(permisoRequerido) ? "PERMISSION_GRANTED" : "MISSING_PERMISSION"
  }));
}

export function requireAllPermissions(required: readonly string[] | ((request: AuthenticatedRequest) => readonly string[])) {
  return async (request: AuthenticatedRequest, _response: Response, next: NextFunction): Promise<void> => {
    try {
      if (!request.auth) throw new ApiError(401, "UNAUTHORIZED", "No autorizado");
      const permissions = typeof required === "function" ? required(request) : required;
      const context = await getEffectivePermissions(request.auth.user.id);
      const decisions = evaluatePermissions(context, permissions);
      const denied = decisions.find(decision => !decision.permitido);
      if (denied) {
        throw new ApiError(403, "RBAC_DENIED", "Permiso insuficiente", {
          permisoFaltante: denied.permisoRequerido
        });
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requirePermission(permission: string) {
  return requireAllPermissions([permission]);
}

export async function myPermissions(request: AuthenticatedRequest, response: Response): Promise<void> {
  if (!request.auth) throw new ApiError(401, "UNAUTHORIZED", "No autorizado");
  const { rol, permisos } = await getEffectivePermissions(request.auth.user.id);
  response.json({ rol, permisos });
}
