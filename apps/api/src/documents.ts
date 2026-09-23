import { randomUUID } from "node:crypto";
import { NivelSeguridad, ResultadoAuditoria, type Documento } from "@prisma/client";
import type { NextFunction, Response } from "express";
import { z } from "zod";
import { authenticateRequest, AuthenticationError, type AuthenticatedRequest } from "./auth";
import { AuditWriteError, auditReason, auditResult, recordAudit } from "./audit";
import { authorizeLoadedDocument } from "./authorization/abac/authorize-document";
import type { DocumentAction } from "./authorization/abac";
import { evaluatePermissions, getEffectivePermissions } from "./authorization/rbac";
import { ApiError } from "./lib/errors";
import { prisma } from "./lib/prisma";

const uuid = z.uuid();
const documentInput = z.strictObject({
  titulo: z.string().trim().min(1).max(200),
  descripcion: z.string().trim().min(1).max(5000),
  departamentoId: uuid,
  nivelConfidencialidad: z.enum(NivelSeguridad),
  pais: z.string().regex(/^[A-Z]{2,80}(?: [A-Z]{2,80})*$/).max(80)
});
const documentUpdate = documentInput.partial().refine(value => Object.keys(value).length > 0);
const emptyBody = z.strictObject({});
const auditQuery = z.strictObject({
  resultado: z.enum(ResultadoAuditoria).optional(),
  usuario: uuid.optional(),
  accion: z.string().regex(/^[A-Z_]{3,40}$/).optional(),
  limite: z.coerce.number().int().min(1).max(100).default(20),
  pagina: z.coerce.number().int().min(1).max(10000).default(1)
});

type Scope = { recurso: string; usuarioId: string | null };
type Output = { status: number; body?: unknown };

async function runAccess(
  request: AuthenticatedRequest, response: Response, next: NextFunction,
  accion: string, permiso: string, recurso: string,
  operation: (scope: Scope) => Promise<Output>
): Promise<void> {
  const scope: Scope = { recurso, usuarioId: null };
  try {
    request.auth = await authenticateRequest(request);
    scope.usuarioId = request.auth.user.id;
    const permissions = await getEffectivePermissions(scope.usuarioId);
    const denied = evaluatePermissions(permissions, [permiso]).find(item => !item.permitido);
    if (denied) throw new ApiError(403, "RBAC_DENIED", "Permiso insuficiente", { permisoFaltante: permiso });
    const result = await operation(scope);
    await recordAudit(request, { ...scope, accion, resultado: "PERMITIDO", motivo: permiso === "VER_AUDITORIA"
      ? "AUTH: válida; RBAC: permiso concedido; consulta de auditoría permitida"
      : "AUTH: válida; RBAC: permiso concedido; ABAC: políticas cumplidas" });
    if (result.body === undefined) response.status(result.status).send();
    else response.status(result.status).json(result.body);
  } catch (error) {
    if (error instanceof AuditWriteError) { next(error); return; }
    try {
      if (error instanceof AuthenticationError) scope.usuarioId = error.usuarioId;
      await recordAudit(request, {
        ...scope, accion,
        resultado: auditResult(error),
        motivo: auditReason(error)
      });
    } catch (auditError) {
      next(auditError);
      return;
    }
    next(error);
  }
}

function id(request: AuthenticatedRequest): string {
  return uuid.parse(request.params.id);
}

async function loadDocument(documentId: string): Promise<Documento> {
  const document = await prisma.documento.findUnique({ where: { id: documentId } });
  if (!document) throw new ApiError(404, "NOT_FOUND", "Documento no encontrado");
  return document;
}

async function departmentExists(departamentoId: string): Promise<void> {
  if (!await prisma.departamento.findUnique({ where: { id: departamentoId }, select: { id: true } })) {
    throw new ApiError(400, "VALIDATION_ERROR", "Departamento inválido");
  }
}

export async function listDocuments(request: AuthenticatedRequest, response: Response, next: NextFunction): Promise<void> {
  await runAccess(request, response, next, "CONSULTAR_DOCUMENTO", "CONSULTAR_DOCUMENTO", "documentos", async scope => {
    const documents = await prisma.documento.findMany({ orderBy: { fechaCreacion: "desc" } });
    const allowed: Documento[] = [];
    for (const document of documents) {
      try {
        await authorizeLoadedDocument(request, document, "CONSULTAR_DOCUMENTO");
        allowed.push(document);
        await recordAudit(request, { usuarioId: scope.usuarioId, recurso: `documentos/${document.id}`, accion: "CONSULTAR_DOCUMENTO", resultado: "PERMITIDO", motivo: "AUTH: válida; RBAC: permiso concedido; ABAC: políticas cumplidas" });
      } catch (error) {
        if (!(error instanceof ApiError) || error.code !== "ABAC_DENIED") throw error;
        await recordAudit(request, { usuarioId: scope.usuarioId, recurso: `documentos/${document.id}`, accion: "CONSULTAR_DOCUMENTO", resultado: "DENEGADO", motivo: auditReason(error) });
      }
    }
    return { status: 200, body: { documentos: allowed } };
  });
}

export async function getDocument(request: AuthenticatedRequest, response: Response, next: NextFunction): Promise<void> {
  await runAccess(request, response, next, "CONSULTAR_DOCUMENTO", "CONSULTAR_DOCUMENTO", `documentos/${request.params.id}`, async () => {
    const document = await loadDocument(id(request));
    await authorizeLoadedDocument(request, document, "CONSULTAR_DOCUMENTO");
    return { status: 200, body: { documento: document } };
  });
}

export async function createDocument(request: AuthenticatedRequest, response: Response, next: NextFunction): Promise<void> {
  await runAccess(request, response, next, "CREAR_DOCUMENTO", "CREAR_DOCUMENTO", "documentos", async scope => {
    const input = documentInput.parse(request.body);
    await departmentExists(input.departamentoId);
    const candidate = {
      id: randomUUID(), ...input, propietarioId: request.auth!.user.id, estado: "PENDIENTE" as const
    };
    await authorizeLoadedDocument(request, candidate, "CREAR_DOCUMENTO");
    const document = await prisma.documento.create({ data: candidate });
    scope.recurso = `documentos/${document.id}`;
    return { status: 201, body: { documento: document } };
  });
}

export async function updateDocument(request: AuthenticatedRequest, response: Response, next: NextFunction): Promise<void> {
  await runAccess(request, response, next, "MODIFICAR_DOCUMENTO", "MODIFICAR_DOCUMENTO", `documentos/${request.params.id}`, async () => {
    const current = await loadDocument(id(request));
    const input = documentUpdate.parse(request.body);
    if (input.departamentoId) await departmentExists(input.departamentoId);
    await authorizeLoadedDocument(request, current, "MODIFICAR_DOCUMENTO");
    const candidate = { ...current, ...input };
    await authorizeLoadedDocument(request, candidate, "MODIFICAR_DOCUMENTO");
    const document = await prisma.documento.update({ where: { id: current.id }, data: input });
    return { status: 200, body: { documento: document } };
  });
}

export async function deleteDocument(request: AuthenticatedRequest, response: Response, next: NextFunction): Promise<void> {
  await runAccess(request, response, next, "ELIMINAR_DOCUMENTO", "ELIMINAR_DOCUMENTO", `documentos/${request.params.id}`, async () => {
    const document = await loadDocument(id(request));
    await authorizeLoadedDocument(request, document, "ELIMINAR_DOCUMENTO");
    await prisma.documento.delete({ where: { id: document.id } });
    return { status: 204 };
  });
}

export async function approveDocument(request: AuthenticatedRequest, response: Response, next: NextFunction): Promise<void> {
  await runAccess(request, response, next, "APROBAR_DOCUMENTO", "APROBAR_DOCUMENTO", `documentos/${request.params.id}`, async () => {
    emptyBody.parse(request.body ?? {});
    const document = await loadDocument(id(request));
    await authorizeLoadedDocument(request, document, "APROBAR_DOCUMENTO");
    if (document.estado !== "PENDIENTE") throw new ApiError(409, "INVALID_STATE", "El documento no está pendiente");
    const approved = await prisma.documento.update({ where: { id: document.id }, data: { estado: "PUBLICADO" } });
    return { status: 200, body: { documento: approved } };
  });
}

export async function listAudit(request: AuthenticatedRequest, response: Response, next: NextFunction): Promise<void> {
  await runAccess(request, response, next, "VER_AUDITORIA", "VER_AUDITORIA", "auditoria", async () => {
    const input = auditQuery.parse(request.query);
    const where = { resultado: input.resultado, usuarioId: input.usuario, accion: input.accion };
    const [total, auditorias] = await prisma.$transaction([
      prisma.auditoria.count({ where }),
      prisma.auditoria.findMany({ where, orderBy: [{ fecha: "desc" }, { id: "desc" }], skip: (input.pagina - 1) * input.limite, take: input.limite })
    ]);
    return { status: 200, body: { auditorias, total, pagina: input.pagina, limite: input.limite } };
  });
}
